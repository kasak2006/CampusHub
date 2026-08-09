import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listEvents } from '../services/events.js';
import { Icon } from '../components/Icons.jsx';

function eventDate(iso) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString(undefined, { day: '2-digit' }),
    mon: d.toLocaleDateString(undefined, { month: 'short' }),
    time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
}

/**
 * Events directory — every event in the college, soonest first, with a live-ish
 * registration count and the viewer's status. Counts are point-in-time here;
 * the detail page updates live over sockets.
 */
export default function Events() {
  const [events, setEvents] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listEvents()
      .then((data) => active && (setEvents(data), setState('ready')))
      .catch((err) => active && (setError(err.message), setState('error')));
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="eyebrow">What’s on</div>
          <h1>Events</h1>
          <p>Register for campus events — seats update live as people join.</p>
        </div>
        <Link to="/events/new" className="btn primary">
          <Icon name="i-plus" /> Create event
        </Link>
      </div>

      {state === 'loading' && <p className="muted">Loading events…</p>}
      {state === 'error' && <p className="form-error">{error}</p>}
      {state === 'ready' && events.length === 0 && (
        <div className="empty-state">
          <p>No events scheduled yet.</p>
        </div>
      )}

      <ul className="list">
        {events.map((ev) => {
          const d = eventDate(ev.startAt);
          const cancelled = ev.status === 'cancelled';
          return (
            <li key={ev.id}>
              <Link to={`/events/${ev.id}`} className="event-row">
                <div className="evtdate">
                  <b className="tnum">{d.day}</b>
                  <small>{d.mon}</small>
                </div>
                <div className="event-row__body">
                  <b>{ev.title}</b>
                  <small className="muted">
                    {ev.club.name} · {d.time}
                    {ev.location ? ` · ${ev.location}` : ''}
                  </small>
                </div>
                <div className="event-row__meta">
                  {cancelled ? (
                    <span className="chip" style={{ background: 'color-mix(in srgb,var(--crit) 15%,transparent)', color: 'var(--crit)' }}>Cancelled</span>
                  ) : ev.viewerStatus === 'registered' ? (
                    <span className="chip live">Going</span>
                  ) : ev.viewerStatus === 'waitlisted' ? (
                    <span className="chip soon">Waitlisted</span>
                  ) : ev.isFull ? (
                    <span className="chip soon">Full</span>
                  ) : (
                    <span className="chip soft">{ev.spotsLeft} left</span>
                  )}
                  <span className="muted tnum" style={{ fontSize: 12.5 }}>
                    {ev.registeredCount}/{ev.capacity}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
