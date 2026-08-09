import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon } from './Icons.jsx';

/** Initials for the avatar block. */
function initials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'U'
  );
}

/**
 * Glassy sticky topbar: search, notifications, and the current user with a
 * logout control. Search is presentational for now (no global search yet).
 */
export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="topbar">
      <div className="search">
        <Icon name="i-search" />
        <input placeholder="Search clubs, events, people…" aria-label="Search" />
      </div>

      <button className="iconbtn" type="button" title="Notifications">
        <Icon name="i-bell" />
        <span className="dot" />
      </button>

      <button
        className="iconbtn"
        type="button"
        title="Profile"
        onClick={() => navigate('/profile')}
      >
        <Icon name="i-user" />
      </button>

      <div className="who">
        <div className="avatar">{initials(user.name)}</div>
        <div>
          <div className="nm">{user.name}</div>
          <div className="rl">{user.role.replace('_', ' ')}</div>
        </div>
      </div>

      <button className="iconbtn" type="button" title="Log out" onClick={handleLogout}>
        <Icon name="i-logout" />
      </button>
    </div>
  );
}
