import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { canCreateClub } from '../utils/roles.js';
import { Icon } from './Icons.jsx';

/**
 * App-shell sidebar: brand, role-aware navigation, and a "start a club"
 * upsell. Live modules link out; not-yet-built ones are marked "soon".
 */
const OVERVIEW = [
  { to: '/dashboard', icon: 'i-grid', label: 'Dashboard' },
  { to: '/clubs', icon: 'i-users', label: 'Clubs' },
  { to: '/events', icon: 'i-calendar', label: 'Events' },
  { icon: 'i-mega', label: 'Announcements', soon: true },
];

function manageItemsFor(role) {
  if (role === 'faculty')
    return [
      { to: '/courses', icon: 'i-book', label: 'Attendance' },
      { icon: 'i-chart', label: 'Analytics', soon: true },
    ];
  if (role === 'admin')
    return [
      { to: '/courses', icon: 'i-book', label: 'Attendance' },
      { icon: 'i-chart', label: 'Analytics', soon: true },
      { icon: 'i-settings', label: 'Settings', soon: true },
    ];
  return [
    { to: '/courses', icon: 'i-book', label: 'My attendance' },
    { icon: 'i-life', label: 'Help Center', soon: true },
  ];
}

function NavItem({ item }) {
  if (item.soon) {
    return (
      <a className="nav-soon" aria-disabled>
        <Icon name={item.icon} /> {item.label} <span className="soon">Soon</span>
      </a>
    );
  }
  return (
    <NavLink to={item.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
      <Icon name={item.icon} /> {item.label}
    </NavLink>
  );
}

export default function Sidebar({ open = false }) {
  const { user } = useAuth();

  return (
    <aside className={`side${open ? ' open' : ''}`}>
      <Link to="/dashboard" className="brand">
        <span className="logo">
          <Icon name="i-cap" />
        </span>
        <b>
          Campus<span>Hub</span>
        </b>
      </Link>

      <div>
        <div className="navlabel">Overview</div>
        <nav className="nav">
          {OVERVIEW.map((item) => (
            <NavItem key={item.label} item={item} />
          ))}
        </nav>
      </div>

      <div>
        <div className="navlabel">Manage</div>
        <nav className="nav">
          {manageItemsFor(user.role).map((item) => (
            <NavItem key={item.label} item={item} />
          ))}
        </nav>
      </div>

      <div className="spacer" />

      {canCreateClub(user.role) && (
        <div className="upsell">
          <b>Start a club</b>
          <p>Rally members, plan events, and track engagement in one place.</p>
          <Link to="/clubs/new" className="btn primary block">
            <Icon name="i-plus" /> New club
          </Link>
        </div>
      )}
    </aside>
  );
}
