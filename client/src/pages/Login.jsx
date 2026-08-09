import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon } from '../components/Icons.jsx';

/** Login page. On success, returns the user to where they came from (or /dashboard). */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="authwrap">
      <form className="authcard" onSubmit={onSubmit}>
        <Link to="/" className="brand">
          <span className="logo">
            <Icon name="i-cap" />
          </span>
          <b>
            Campus<span>Hub</span>
          </b>
        </Link>

        <h1>Welcome back</h1>
        <p className="sub">Log in to your CampusHub account.</p>

        {error && <p className="form-error">{error}</p>}

        <label className="field">
          <span className="field__label">Email</span>
          <input
            className="input"
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            autoComplete="email"
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Password</span>
          <input
            className="input"
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" className="btn primary block" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>

        <p className="foot">
          No account? <Link to="/register">Sign up</Link>
        </p>
      </form>
    </div>
  );
}
