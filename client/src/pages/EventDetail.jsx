import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getEvent,
  cancelEvent,
  registerForEvent,
  cancelRegistration,
  listEventRegistrations,
} from '../services/events.js';
import { subscribeToEvent } from '../services/socket.js';
import { Icon } from '../components/Icons.jsx';

function formatWhen(startAt, endAt) {
  if (!startAt) return '';
  const s = new Date(startAt);
  const date = s.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = s.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const end = endAt
    ? ` – ${new Date(endAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
    : '';
  return `${date} · ${time}${end}`;
}

/**
 * Event detail with a live registration count. On mount we join the event's
 * socket room; `registrationUpdate` broadcasts keep the count (and the lead's
 * roster) current with no refresh. Register/cancel is race-safe server-side.
 */
export default function EventDetail() {
  const { id } = useParams();

  const [event, setEvent] = useState(null);
  const [roster, setRoster] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const canManageRef = useRef(false);

  const loadRoster = useCallback(async () => {
    try {
      setRoster(await listEventRegistrations(id));
    } catch {
      /* non-managers get 403 — ignore */
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    getEvent(id)
      .then((e) => {
        if (!active) return;
        setEvent(e);
        canManageRef.current = e.canManage;
        setState('ready');
        if (e.canManage) loadRoster();
      })
      .catch((err) => active && (setError(err.message), setState('error')));
    return () => {
      active = false;
    };
  }, [id, loadRoster]);

  // Live updates: merge broadcast counts into the event; refresh lead roster.
  useEffect(() => {
    const off = subscribeToEvent(id, (counts) => {
      setEvent((prev) => (prev ? { ...prev, ...counts } : prev));
      if (canManageRef.current) loadRoster();
    });
    return off;
  }, [id, loadRoster]);

  const act = async (fn) => {
    setBusy(true);
    setActionError('');
    try {
      const res = await fn();
      // Merge new counts + our own status straight away (socket echo follows).
      // The API returns the caller's own status as `registrationStatus` (the
      // `status` field carries the event's lifecycle status).
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              ...res,
              viewerStatus:
                res.registrationStatus === 'cancelled' ? null : res.registrationStatus,
            }
          : prev
      );
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onCancelEvent = async () => {
    if (!window.confirm('Cancel this event for everyone? This cannot be undone.')) return;
    try {
      await cancelEvent(id);
      setEvent((prev) => ({ ...prev, status: 'cancelled' }));
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (state === 'loading') return <div className="loading">Loading…</div>;
  if (state === 'error')
    return (
      <>
        <Link to="/events" className="back-link">
          <Icon name="i-back" /> Back to events
        </Link>
        <p className="form-error" style={{ marginTop: 16 }}>
          {error}
        </p>
      </>
    );

  const cancelled = event.status === 'cancelled';
  const past = new Date(event.startAt).getTime() <= Date.now();
  const pct = event.capacity ? Math.min(100, Math.round((event.registeredCount / event.capacity) * 100)) : 0;

  return (
    <>
      <Link to="/events" className="back-link">
        <Icon name="i-back" /> Back to events
      </Link>

      <div className="card" style={{ marginTop: 14, overflow: 'hidden', padding: 0 }}>
        {event.bannerUrl && (
          <img
            src={event.bannerUrl}
            alt=""
            style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
          />
        )}
        <div style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <Link to={`/clubs/${event.club.id}`} className="chip soft" style={{ textDecoration: 'none' }}>
              {event.club.name}
            </Link>
            {cancelled && <span className="chip" style={{ background: 'color-mix(in srgb,var(--crit) 15%,transparent)', color: 'var(--crit)' }}>Cancelled</span>}
            {!cancelled && past && <span className="chip soft">Ended</span>}
          </div>

          <h1 style={{ fontSize: 26 }}>{event.title}</h1>
          <div className="club-detail__meta">
            <span><Icon name="i-clock" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> {formatWhen(event.startAt, event.endAt)}</span>
            {event.location && <span><Icon name="i-pin" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> {event.location}</span>}
          </div>

          {event.description && (
            <p className="muted" style={{ margin: '16px 0', lineHeight: 1.6 }}>{event.description}</p>
          )}

          {/* Live registration count */}
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, margin: '4px 0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="live-dot" title="Live" />
                <b className="tnum" style={{ fontSize: 20 }}>{event.registeredCount}</b>
                <span className="muted">/ {event.capacity} registered</span>
              </div>
              {event.isFull ? (
                <span className="chip soon">Full{event.waitlistCount ? ` · ${event.waitlistCount} waitlisted` : ''}</span>
              ) : (
                <span className="chip live">{event.spotsLeft} spot{event.spotsLeft === 1 ? '' : 's'} left</span>
              )}
            </div>
            <div className="pbar"><i style={{ width: `${pct}%` }} /></div>
          </div>

          {/* Register / cancel */}
          {!cancelled && !past && (
            <div className="club-detail__actions">
              {event.viewerStatus === 'registered' && (
                <>
                  <span className="badge2 b-good"><Icon name="i-check" style={{ width: 14, height: 14 }} /> You’re registered</span>
                  <button className="btn ghost" disabled={busy} onClick={() => act(() => cancelRegistration(id))}>Cancel registration</button>
                </>
              )}
              {event.viewerStatus === 'waitlisted' && (
                <>
                  <span className="badge2 b-warn"><Icon name="i-clock" style={{ width: 14, height: 14 }} /> You’re on the waitlist</span>
                  <button className="btn ghost" disabled={busy} onClick={() => act(() => cancelRegistration(id))}>Leave waitlist</button>
                </>
              )}
              {!event.viewerStatus && (
                <button className="btn primary" disabled={busy} onClick={() => act(() => registerForEvent(id))}>
                  {event.isFull ? 'Join waitlist' : 'Register'}
                </button>
              )}
            </div>
          )}
          {cancelled && <p className="muted">This event has been cancelled.</p>}
          {!cancelled && past && <p className="muted">Registration is closed — this event has started.</p>}

          {actionError && <p className="form-error" style={{ marginTop: 14, marginBottom: 0 }}>{actionError}</p>}

          {/* Manager controls */}
          {event.canManage && (
            <div className="club-detail__actions" style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <Link to={`/events/${id}/edit`} className="btn ghost"><Icon name="i-edit" /> Edit</Link>
              {!cancelled && (
                <button className="btn danger" onClick={onCancelEvent}><Icon name="i-x" /> Cancel event</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Live roster (lead/admin) */}
      {event.canManage && roster && (
        <section style={{ marginTop: 8 }}>
          <div className="section-h">
            <h2>Registrations</h2>
            <span className="ln" />
            <span className="live-dot" title="Live" />
            <span className="chip soft">{roster.counts.registeredCount} in · {roster.counts.waitlistCount} waiting</span>
          </div>
          {roster.registrations.length === 0 ? (
            <p className="muted">No registrations yet.</p>
          ) : (
            <ul className="list">
              {roster.registrations.map((r) => (
                <li key={r.id} className="member-item">
                  <span className="thumb">{(r.user?.name ?? '?').charAt(0).toUpperCase()}</span>
                  <span className="member-item__name">{r.user?.name ?? 'Unknown'}</span>
                  {r.status === 'waitlisted' ? (
                    <span className="chip soon">Waitlist</span>
                  ) : (
                    <span className="chip live">Going</span>
                  )}
                  {r.user?.rollNumber && <span className="member-item__meta">{r.user.rollNumber}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
