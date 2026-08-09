import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon } from '../components/Icons.jsx';

/**
 * Public landing page. Signed-in users are sent straight to their dashboard;
 * everyone else gets a brand hero with sign-up / log-in calls to action.
 */
const FEATURES = [
  { icon: 'i-users', title: 'Clubs', body: 'Discover student clubs, request to join, and manage your own.' },
  { icon: 'i-calendar', title: 'Events', body: 'Register for campus events with live, real-time seat counts.' },
  { icon: 'i-book', title: 'Attendance', body: 'Track your attendance and analytics, course by course.' },
];

export default function Home() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div className="loading">Loading…</div>;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="authwrap">
      <div style={{ width: '100%', maxWidth: 760, textAlign: 'center' }}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 22 }}>
          <span className="logo">
            <Icon name="i-cap" />
          </span>
          <b style={{ fontSize: 20 }}>
            Campus<span>Hub</span>
          </b>
        </div>

        <div className="eyebrow">All-in-one campus ecosystem</div>
        <h1 style={{ fontSize: 40, margin: '10px 0 14px', lineHeight: 1.05 }}>
          Everything on campus,
          <br />
          in one place.
        </h1>
        <p className="muted" style={{ fontSize: 16, maxWidth: 520, margin: '0 auto 26px', lineHeight: 1.6 }}>
          Clubs, events, and attendance — CampusHub brings student life together
          so nothing gets lost across a dozen apps.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" className="btn primary">
            Get started <Icon name="i-arrow" />
          </Link>
          <Link to="/login" className="btn ghost">
            Log in
          </Link>
        </div>

        <div className="club-grid" style={{ marginTop: 40, textAlign: 'left' }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <span className="ic coral" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', marginBottom: 12 }}>
                <Icon name={f.icon} style={{ width: 20, height: 20 }} />
              </span>
              <h3 style={{ fontSize: 16, marginBottom: 6 }}>{f.title}</h3>
              <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
