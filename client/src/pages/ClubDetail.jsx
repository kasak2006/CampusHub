import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Icon } from '../components/Icons.jsx';
import {
  getClub,
  deleteClub,
  requestToJoin,
  leaveClub,
  listJoinRequests,
  decideJoinRequest,
} from '../services/clubs.js';
import { listEvents } from '../services/events.js';

function initials(name = '') {
  return name.trim().charAt(0).toUpperCase() || '?';
}

/**
 * Club detail: profile, member list, and role-aware actions.
 *   - Non-members: request to join (or see a pending state).
 *   - Members: leave the club.
 *   - Leads / admins: edit, delete, and approve/reject join requests.
 */
export default function ClubDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const toast = useToast();

  const [club, setClub] = useState(null);
  const [requests, setRequests] = useState([]);
  const [events, setEvents] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [action, setAction] = useState({ busy: false });

  const canManage = club?.viewer?.isLead || user.role === 'admin';
  // Staff (admin/faculty) manage rather than participate — hide join actions.
  const isStaff = user.role === 'admin' || user.role === 'faculty';

  const load = useCallback(async () => {
    const data = await getClub(id);
    setClub(data);
    if (data.viewer?.isLead || user.role === 'admin') {
      setRequests(await listJoinRequests(id));
    }
    setEvents(await listEvents(id).catch(() => []));
  }, [id, user.role]);

  useEffect(() => {
    let active = true;
    load()
      .then(() => active && setState('ready'))
      .catch((err) => active && (setError(err.message), setState('error')));
    return () => {
      active = false;
    };
  }, [load]);

  const run = async (fn, okMessage) => {
    setAction({ busy: true });
    try {
      await fn();
      await load();
      await refresh?.();
      setAction({ busy: false });
      toast.success(okMessage);
    } catch (err) {
      setAction({ busy: false });
      toast.error(err.message);
    }
  };

  const onDelete = async () => {
    if (!window.confirm('Delete this club? This cannot be undone.')) return;
    try {
      await deleteClub(id);
      await refresh?.();
      toast.success('Club deleted.');
      navigate('/clubs');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (state === 'loading') return <div className="loading">Loading…</div>;
  if (state === 'error')
    return (
      <>
        <Link to="/clubs" className="back-link">
          <Icon name="i-back" /> Back to clubs
        </Link>
        <p className="form-error" style={{ marginTop: 16 }}>
          {error}
        </p>
      </>
    );

  const { viewer } = club;

  return (
    <>
      <Link to="/clubs" className="back-link">
        <Icon name="i-back" /> Back to clubs
      </Link>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="club-detail__head">
          {club.logoUrl ? (
            <img className="club-logo club-detail__logo" src={club.logoUrl} alt="" />
          ) : (
            <span className="club-logo club-logo--ph club-detail__logo">
              {initials(club.name)}
            </span>
          )}
          <div className="club-detail__title">
            <h1>{club.name}</h1>
            <div className="club-detail__meta">
              <span className="chip soft">{club.category}</span>
              <span>
                <Icon name="i-users" style={{ width: 14, height: 14, verticalAlign: '-2px' }} />{' '}
                {club.memberCount} member{club.memberCount === 1 ? '' : 's'}
              </span>
              <span>
                {club.leadCount} lead{club.leadCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>

        <p className="muted" style={{ margin: '16px 0', lineHeight: 1.6 }}>
          {club.description || 'No description yet.'}
        </p>

        <div className="club-detail__actions">
          {!isStaff && !viewer.isMember && !viewer.hasPendingRequest && (
            <button
              className="btn primary"
              disabled={action.busy}
              onClick={() => run(() => requestToJoin(id), 'Join request sent!')}
            >
              <Icon name="i-plus" /> Request to join
            </button>
          )}
          {!isStaff && !viewer.isMember && viewer.hasPendingRequest && (
            <span className="chip soon" style={{ padding: '8px 14px' }}>
              <Icon name="i-clock" style={{ width: 13, height: 13, verticalAlign: '-2px' }} />{' '}
              Request pending
            </span>
          )}
          {viewer.isMember && !viewer.isLead && (
            <button
              className="btn ghost"
              disabled={action.busy}
              onClick={() => run(() => leaveClub(id), 'You left the club.')}
            >
              Leave club
            </button>
          )}
          {canManage && (
            <>
              {/* Only a club's lead can author its events — admins manage
                  existing clubs/events but don't host new events. */}
              {viewer.isLead && (
                <Link to={`/events/new?clubId=${id}`} className="btn soft">
                  <Icon name="i-calendar" /> New event
                </Link>
              )}
              <Link to={`/clubs/${id}/edit`} className="btn ghost">
                <Icon name="i-edit" /> Edit
              </Link>
              <button className="btn danger" disabled={action.busy} onClick={onDelete}>
                <Icon name="i-trash" /> Delete
              </button>
            </>
          )}
        </div>

      </div>

      {/* Pending requests (leads/admin) */}
      {canManage && (
        <section style={{ marginTop: 8 }}>
          <div className="section-h">
            <h2>Pending join requests</h2>
            <span className="ln" />
            <span className="chip soft">{requests.length}</span>
          </div>
          {requests.length === 0 ? (
            <p className="muted">No pending requests right now.</p>
          ) : (
            <ul className="list">
              {requests.map((req) => (
                <li key={req.id} className="req-item">
                  <div>
                    <strong>{req.user?.name ?? 'Unknown user'}</strong>
                    {req.user?.rollNumber && (
                      <span className="muted"> · {req.user.rollNumber}</span>
                    )}
                    {req.message && <p className="req-item__msg">“{req.message}”</p>}
                  </div>
                  <div className="req-item__actions">
                    <button
                      className="btn primary sm"
                      disabled={action.busy}
                      onClick={() =>
                        run(
                          () => decideJoinRequest(id, req.id, 'approve'),
                          `${req.user?.name ?? 'User'} approved.`
                        )
                      }
                    >
                      <Icon name="i-check" /> Approve
                    </button>
                    <button
                      className="btn ghost sm"
                      disabled={action.busy}
                      onClick={() =>
                        run(() => decideJoinRequest(id, req.id, 'reject'), 'Request rejected.')
                      }
                    >
                      <Icon name="i-x" /> Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Events */}
      <section style={{ marginTop: 8 }}>
        <div className="section-h">
          <h2>Events</h2>
          <span className="ln" />
          <span className="chip soft">{events.length}</span>
        </div>
        {events.length === 0 ? (
          <p className="muted">No events yet.</p>
        ) : (
          <ul className="list">
            {events.map((ev) => {
              const d = new Date(ev.startAt);
              return (
                <li key={ev.id}>
                  <Link to={`/events/${ev.id}`} className="event-row">
                    <div className="evtdate">
                      <b className="tnum">{d.toLocaleDateString(undefined, { day: '2-digit' })}</b>
                      <small>{d.toLocaleDateString(undefined, { month: 'short' })}</small>
                    </div>
                    <div className="event-row__body">
                      <b>{ev.title}</b>
                      <small className="muted">
                        {d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                        {ev.location ? ` · ${ev.location}` : ''}
                      </small>
                    </div>
                    <span className="muted tnum" style={{ fontSize: 12.5 }}>
                      {ev.registeredCount}/{ev.capacity}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Member list */}
      <section style={{ marginTop: 8 }}>
        <div className="section-h">
          <h2>Members</h2>
          <span className="ln" />
          <span className="chip soft">{club.memberCount}</span>
        </div>
        <ul className="list">
          {club.members?.map((m) => {
            const isLead = club.leads?.some((l) => l.id === m.id);
            return (
              <li key={m.id} className="member-item">
                <span className="thumb">{initials(m.name)}</span>
                <span className="member-item__name">{m.name}</span>
                {isLead && <span className="chip role">Lead</span>}
                {m.department && <span className="member-item__meta">{m.department}</span>}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
