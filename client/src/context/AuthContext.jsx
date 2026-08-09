import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../services/api.js';

/**
 * Auth state via Context API (Redux is overkill for this scope — see phase plan).
 * Holds the current user and exposes register/login/logout backed by the API.
 * On mount it restores the session from the httpOnly cookie via GET /auth/me,
 * gating render with `loading` so protected routes don't flash before we know
 * whether the user is signed in.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Start true: we don't yet know if a cookie session exists.
  const [loading, setLoading] = useState(true);

  // Restore session on first load.
  useEffect(() => {
    let active = true;
    api
      .get('/auth/me')
      .then((res) => {
        if (active) setUser(res.data.user);
      })
      .catch(() => {
        // 401 (no/expired cookie) is expected when logged out — stay null.
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const register = useCallback(async (payload) => {
    const res = await api.post('/auth/register', payload);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const login = useCallback(async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  // Re-fetch the current user from the server. Membership actions in the Clubs
  // module can change a user's global role (student ↔ club_lead), so pages call
  // this afterwards to keep the navbar/dashboard in sync.
  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      return res.data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const res = await api.patch('/users/me', payload);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const value = {
    user,
    loading,
    register,
    login,
    logout,
    refresh,
    updateProfile,
    isAuthenticated: Boolean(user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export default AuthContext;
