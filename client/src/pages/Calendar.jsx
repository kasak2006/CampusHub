import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCalendar } from '../services/calendar.js';
import { Icon } from '../components/Icons.jsx';

/**
 * Unified calendar (Phase 8). A month grid (default) or single-week view that
 * merges the user's registered events, class sessions, and assignment due dates
 * — one screen for "what's happening / what's due". Each item is color-coded by
 * type and deep-links to its source record. Types can be toggled via the legend.
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TYPES = [
  { key: 'event', label: 'Events' },
  { key: 'session', label: 'Class sessions' },
  { key: 'due', label: 'Assignments due' },
];

/** Local 'YYYY-MM-DD' key (calendar day, not UTC). */
function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** Monday on or before `d` (weeks start Monday). Returns a fresh midnight Date. */
function mondayOf(d) {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (out.getDay() + 6) % 7; // 0 = Sun → 6, 1 = Mon → 0, …
  out.setDate(out.getDate() - offset);
  return out;
}

function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** The inclusive [gridStart, gridEnd] and the flat day list for the view. */
function buildGrid(cursor, view) {
  if (view === 'week') {
    const start = mondayOf(cursor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return { days, start, end: days[6] };
  }
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const start = mondayOf(monthStart);
  // Extend to the Sunday on/after the month's last day (5–6 rows).
  const endOffset = (7 - ((monthEnd.getDay() + 6) % 7) - 1 + 7) % 7;
  const end = addDays(monthEnd, endOffset);
  const count = Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
  const days = Array.from({ length: count }, (_, i) => addDays(start, i));
  return { days, start, end };
}

export default function Calendar() {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState('month');
  const [active, setActive] = useState({ event: true, session: true, due: true });
  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading');

  const { days, start, end } = useMemo(() => buildGrid(cursor, view), [cursor, view]);

  useEffect(() => {
    let alive = true;
    setState('loading');
    const from = new Date(start.getFullYear(), start.getMonth(), start.getDate()).toISOString();
    const to = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate(),
      23,
      59,
      59
    ).toISOString();
    getCalendar({ from, to })
      .then((data) => alive && (setItems(data), setState('ready')))
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, [start, end]);

  // Bucket items into day cells once, then filter by active types at render.
  const byDay = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = dayKey(new Date(it.when));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    return map;
  }, [items]);

  const todayKey = dayKey(new Date());
  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const weekLabel = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(
    undefined,
    { month: 'short', day: 'numeric' }
  )}`;

  const step = (dir) => {
    setCursor((c) => {
      if (view === 'week') return addDays(mondayOf(c), dir * 7);
      return new Date(c.getFullYear(), c.getMonth() + dir, 1);
    });
  };

  const toggleType = (key) => setActive((a) => ({ ...a, [key]: !a[key] }));

  const activeCount = items.filter((it) => active[it.type]).length;

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="eyebrow">Calendar</div>
          <h1>{view === 'week' ? weekLabel : monthLabel}</h1>
          <p>Your events, class sessions, and assignment due dates in one view.</p>
        </div>
        <div className="cal-toolbar">
          <div className="cal-nav">
            <button className="btn ghost sm" onClick={() => step(-1)} aria-label="Previous">
              <Icon name="i-back" />
            </button>
            <button className="btn ghost sm" onClick={() => setCursor(new Date())}>
              Today
            </button>
            <button className="btn ghost sm" onClick={() => step(1)} aria-label="Next">
              <Icon name="i-arrow" />
            </button>
          </div>
          <div className="seg">
            <button
              className={`seg__btn${view === 'month' ? ' on on-present' : ''}`}
              onClick={() => setView('month')}
            >
              Month
            </button>
            <button
              className={`seg__btn${view === 'week' ? ' on on-present' : ''}`}
              onClick={() => setView('week')}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      <div className="cal-legend">
        {TYPES.map((t) => (
          <button
            key={t.key}
            className={`cal-leg cal-leg--${t.key}${active[t.key] ? '' : ' off'}`}
            onClick={() => toggleType(t.key)}
            aria-pressed={active[t.key]}
          >
            <span className="dot" /> {t.label}
          </button>
        ))}
      </div>

      {state === 'error' && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted">Couldn’t load your calendar. Refresh to try again.</p>
        </div>
      )}

      {state !== 'error' && (
        <div className={`cal-grid${view === 'week' ? ' week' : ''}`}>
          {WEEKDAYS.map((d) => (
            <div key={d} className="cal-dow">
              {d}
            </div>
          ))}

          {days.map((d) => {
            const key = dayKey(d);
            const inMonth = view === 'week' || d.getMonth() === cursor.getMonth();
            const dayItems = (byDay.get(key) ?? []).filter((it) => active[it.type]);
            const shown = dayItems.slice(0, view === 'week' ? 8 : 3);
            const extra = dayItems.length - shown.length;
            return (
              <div
                key={key}
                className={`cal-cell${inMonth ? '' : ' out'}${key === todayKey ? ' today' : ''}`}
              >
                <div className="cal-daynum">{d.getDate()}</div>
                {shown.map((it) => (
                  <button
                    key={`${it.type}-${it.refId}`}
                    className={`cal-pill cal-pill--${it.type}`}
                    title={it.title}
                    onClick={() => navigate(it.url)}
                  >
                    {it.title}
                  </button>
                ))}
                {extra > 0 && <div className="cal-more">+{extra} more</div>}
              </div>
            );
          })}
        </div>
      )}

      {state === 'ready' && activeCount === 0 && (
        <p className="muted" style={{ marginTop: 14, fontSize: 13.5 }}>
          Nothing scheduled in this {view}. Register for an event or check back later.
        </p>
      )}
    </>
  );
}
