import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon } from '../components/Icons.jsx';

/**
 * Student signup. The server forces role: 'student' regardless of input —
 * faculty/admin accounts are seeded, not self-registered.
 */
export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    rollNumber: '',
    department: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Sign up failed.');
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

        <h1>Create your account</h1>
        <p className="sub">Sign up as a student to get started.</p>

        {error && <p className="form-error">{error}</p>}

        <label className="field">
          <span className="field__label">Full name</span>
          <input
            className="input"
            type="text"
            name="name"
            value={form.name}
            onChange={onChange}
            autoComplete="name"
            required
          />
        </label>

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
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">
              Roll number <span className="field__hint">(optional)</span>
            </span>
            <input
              className="input"
              type="text"
              name="rollNumber"
              value={form.rollNumber}
              onChange={onChange}
            />
          </label>

          <label className="field">
            <span className="field__label">
              Department <span className="field__hint">(optional)</span>
            </span>
            <input
              className="input"
              type="text"
              name="department"
              value={form.department}
              onChange={onChange}
            />
          </label>
        </div>

        <button type="submit" className="btn primary block" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>

        <p className="foot">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
