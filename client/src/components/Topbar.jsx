import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
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

/** Compact relative time, e.g. "just now", "5m", "3h", "2d". */
function timeAgo(iso) {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

/** Bell + dropdown of the user's notifications, with a live unread badge. */
function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = (n) => {
    if (!n.read) markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="notif" ref={ref}>
      <button
        className="iconbtn"
        type="button"
        title="Notifications"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="i-bell" />
        {unreadCount > 0 && <span className="dot" />}
      </button>

      {open && (
        <div className="notif__panel" role="menu">
          <div className="notif__head">
            <b>Notifications</b>
            {unreadCount > 0 && (
              <button className="notif__mark" type="button" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notif__list">
            {notifications.length === 0 ? (
              <div className="notif__empty">You&apos;re all caught up.</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`notif__item${n.read ? '' : ' unread'}`}
                  onClick={() => openItem(n)}
                >
                  <span className="notif__ic">
                    <Icon name="i-mega" style={{ width: 14, height: 14 }} />
                  </span>
                  <span className="notif__body">
                    <span className="notif__text">{n.text}</span>
                    <span className="notif__time">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="notif__unreaddot" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Glassy sticky topbar: search, live notifications, and the current user with a
 * logout control. Search is presentational for now (no global search yet).
 */
export default function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="topbar">
      <button
        className="iconbtn topbar__menu"
        type="button"
        title="Menu"
        aria-label="Open menu"
        onClick={onMenu}
      >
        <Icon name="i-menu" />
      </button>

      <div className="search">
        <Icon name="i-search" />
        <input placeholder="Search clubs, events, people…" aria-label="Search" />
      </div>

      <NotificationBell />

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
