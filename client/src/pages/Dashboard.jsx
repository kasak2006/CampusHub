import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { listClubs } from '../services/clubs.js';
import { Icon } from '../components/Icons.jsx';

const WEEK_BARS = [
  { d: 'Mon', h: 42 },
  { d: 'Tue', h: 66 },
  { d: 'Wed', h: 38 },
  { d: 'Thu', h: 78 },
  { d: 'Fri', h: 96, hi: true },
  { d: 'Sat', h: 54 },
  { d: 'Sun', h: 30 },
];

const HERO = {
  student: {
    eyebrow: 'This semester',
    title: 'Stay involved, all in one hub',
    body: 'Browse clubs, request to join, and keep up with everything happening on campus — all from one place.',
    cta: 'Explore clubs',
  },
  club_lead: {
    eyebrow: 'Your clubs',
    title: 'Lead with less busywork',
    body: 'Review join requests, grow your membership, and keep your club active — right from your dashboard.',
    cta: 'Manage clubs',
  },
  faculty: {
    eyebrow: 'Teaching',
    title: 'Attendance, minus the paperwork',
    body: 'Create courses, enroll students, and mark attendance in seconds — with per-student analytics and a live class trend.',
    cta: 'Take attendance',
    to: '/courses',
  },
  admin: {
    eyebrow: 'Oversight',
    title: 'The whole campus, one view',
    body: 'Keep an eye on every club and its membership. More admin tooling lands as new modules ship.',
    cta: 'View all clubs',
  },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [clubs, setClubs] = useState([]);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let active = true;
    listClubs()
      .then((data) => active && (setClubs(data), setState('ready')))
      .catch(() => active && setState('error'));
    return () => {
      active = false;
    };
  }, []);

  const { joined, led, trending } = useMemo(() => {
    return {
      joined: clubs.filter((c) => c.viewer?.isMember).length,
      led: clubs.filter((c) => c.viewer?.isLead).length,
      trending: [...clubs].sort((a, b) => b.memberCount - a.memberCount).slice(0, 4),
    };
  }, [clubs]);

  const hero = HERO[user.role] ?? HERO.student;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const firstName = user.name.split(' ')[0];

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="eyebrow">{today}</div>
          <h1>Welcome back, {firstName}</h1>
          <p>
            {state === 'ready'
              ? `You're a member of ${joined} club${joined === 1 ? '' : 's'}${
                  led ? ` and lead ${led}` : ''
                }.`
              : 'Here’s what’s happening on campus.'}
          </p>
        </div>
        <Link to="/clubs/new" className="btn primary">
          <Icon name="i-plus" /> Create club
        </Link>
      </div>

      <div className="bento">
        {/* Hero */}
        <div className="card hero">
          <div className="htext">
            <div className="eyebrow" style={{ color: 'rgba(255,255,255,.85)' }}>
              {hero.eyebrow}
            </div>
            <h2>{hero.title}</h2>
            <p>{hero.body}</p>
            <Link to={hero.to ?? '/clubs'} className="cta">
              {hero.cta} <Icon name="i-arrow" />
            </Link>
          </div>
          <div className="orbit">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="11" />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="#fff"
                strokeWidth="11"
                strokeLinecap="round"
                strokeDasharray="314"
                strokeDashoffset="82"
                transform="rotate(-90 60 60)"
              />
            </svg>
            <span className="pct tnum">74%</span>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="stats">
          <div className="tile">
            <span className="ic coral">
              <Icon name="i-users" />
            </span>
            <div>
              <div className="v tnum">{joined}</div>
              <div className="k">Clubs joined</div>
            </div>
          </div>
          <div className="tile">
            <span className="ic amber">
              <Icon name="i-star" />
            </span>
            <div>
              <div className="v tnum">{led}</div>
              <div className="k">Clubs you lead</div>
            </div>
          </div>
        </div>

        {/* Activity chart (illustrative) */}
        <div className="card col-7">
          <div className="ch">
            <h3>Campus activity</h3>
            <span className="link">This week</span>
          </div>
          <div className="chart">
            <div className="grid-lines">
              <i />
              <i />
              <i />
              <i />
            </div>
            {WEEK_BARS.map((b) => (
              <div key={b.d} className={`bar${b.hi ? ' hi' : ''}`}>
                <div className="stack" style={{ '--h': `${b.h}%` }}>
                  <div className="fill" />
                </div>
                <small>{b.d}</small>
              </div>
            ))}
          </div>
        </div>

        {/* Trending clubs */}
        <div className="card col-5">
          <div className="ch">
            <h3>Trending clubs</h3>
            <Link to="/clubs" className="link">
              Browse all
            </Link>
          </div>
          {state === 'loading' && <p className="muted">Loading…</p>}
          {state === 'ready' && trending.length === 0 && (
            <p className="muted">No clubs yet — be the first to create one.</p>
          )}
          {trending.map((c, i) => (
            <Link key={c.id} to={`/clubs/${c.id}`} className="rowitem" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className={`thumb g${(i % 4) + 1}`}>
                {c.logoUrl ? <img src={c.logoUrl} alt="" /> : c.name.charAt(0).toUpperCase()}
              </div>
              <div className="rt">
                <b>{c.name}</b>
                <small>
                  {c.memberCount} member{c.memberCount === 1 ? '' : 's'} · {c.category}
                </small>
              </div>
              {c.viewer?.isLead ? (
                <span className="chip role">Lead</span>
              ) : c.viewer?.isMember ? (
                <span className="chip soft">Joined</span>
              ) : c.viewer?.hasPendingRequest ? (
                <span className="chip soon">Requested</span>
              ) : (
                <span className="chip soft">View</span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
