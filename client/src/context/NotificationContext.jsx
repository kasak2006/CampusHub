import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notifications.js';
import { subscribeToNotifications, reconnectSocket } from '../services/socket.js';

/**
 * Notification state (Phase 6). Loads the current user's notifications once they
 * log in, then keeps the list + unread count live via the socket `notification`
 * event — the same real-time channel Phase 3 used for event counts. Any new
 * arrival also raises a toast. Consumed by the topbar bell.
 */
const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevUserId = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Silent — the bell just stays empty if the fetch fails.
    }
  }, []);

  // Load (and reconnect the socket for the new identity) when the user changes.
  useEffect(() => {
    const id = user?.id ?? null;
    if (id === prevUserId.current) return;
    prevUserId.current = id;

    // Re-handshake so the server joins/leaves this user's notification room.
    reconnectSocket();

    if (id) {
      refresh();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, refresh]);

  // Subscribe to live pushes while logged in.
  useEffect(() => {
    if (!user) return undefined;
    const off = subscribeToNotifications((n) => {
      setNotifications((list) => [n, ...list].slice(0, 50));
      setUnreadCount((c) => c + 1);
      toast.info(n.text);
    });
    return off;
  }, [user, toast]);

  const markRead = useCallback(async (id) => {
    // Optimistic — flip locally, then persist.
    setNotifications((list) =>
      list.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await markNotificationRead(id);
    } catch {
      // Re-sync on failure so the badge doesn't drift.
      refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      refresh();
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ notifications, unreadCount, refresh, markRead, markAllRead }),
    [notifications, unreadCount, refresh, markRead, markAllRead]
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
}

export default NotificationContext;
