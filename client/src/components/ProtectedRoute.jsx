import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Route guard. While the session is being restored it shows a loading state
 * (so we don't bounce a logged-in user to /login on refresh). Once resolved:
 *   - not authenticated → redirect to /login (remembering where they came from)
 *   - authenticated but wrong role (when `roles` is given) → redirect to /dashboard
 */
export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading">Loading…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
