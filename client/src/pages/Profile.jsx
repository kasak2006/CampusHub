import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * View + edit the current user's profile. Only name, roll number, and
 * department are editable (per the server contract).
 */
export default function Profile() {
  const { user, updateProfile } = useAuth();

  const [form, setForm] = useState({
    name: user.name ?? '',
    rollNumber: user.rollNumber ?? '',
    department: user.department ?? '',
  });
  const [status, setStatus] = useState({ state: 'idle', message: '' });

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus({ state: 'saving', message: '' });
    try {
      await updateProfile(form);
      setStatus({ state: 'ok', message: 'Profile saved.' });
    } catch (err) {
      setStatus({ state: 'error', message: err.message || 'Could not save profile.' });
    }
  };

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="eyebrow">Account</div>
          <h1>Profile</h1>
          <p>Update your details.</p>
        </div>
      </div>

      <form className="card" style={{ maxWidth: 560 }} onSubmit={onSubmit}>
        <div className="field-row">
          <div className="field">
            <span className="field__label">Email</span>
            <input className="input" value={user.email} disabled />
          </div>
          <div className="field">
            <span className="field__label">Role</span>
            <input
              className="input"
              value={user.role.replace('_', ' ')}
              disabled
              style={{ textTransform: 'capitalize' }}
            />
          </div>
        </div>

        <label className="field">
          <span className="field__label">Full name</span>
          <input
            className="input"
            type="text"
            name="name"
            value={form.name}
            onChange={onChange}
            required
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Roll number</span>
            <input
              className="input"
              type="text"
              name="rollNumber"
              value={form.rollNumber}
              onChange={onChange}
            />
          </label>
          <label className="field">
            <span className="field__label">Department</span>
            <input
              className="input"
              type="text"
              name="department"
              value={form.department}
              onChange={onChange}
            />
          </label>
        </div>

        {status.state === 'ok' && <p className="form-success">{status.message}</p>}
        {status.state === 'error' && <p className="form-error">{status.message}</p>}

        <button type="submit" className="btn primary block" disabled={status.state === 'saving'}>
          {status.state === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </>
  );
}
