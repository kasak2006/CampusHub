import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createCourse, getCourse, updateCourse } from '../services/courses.js';
import { Icon } from '../components/Icons.jsx';

/**
 * Create or edit a course. Faculty and admins only (the route is reachable from
 * their sidebar; the server also enforces the role). On save it lands on the
 * course detail page, where students get enrolled.
 */
export default function CourseForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [state, setState] = useState(isEdit ? 'loading' : 'idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return undefined;
    let active = true;
    getCourse(id)
      .then((course) => {
        if (!active) return;
        setForm({
          name: course.name,
          code: course.code,
          description: course.description ?? '',
        });
        setState('idle');
      })
      .catch((err) => active && (setError(err.message), setState('idle')));
    return () => {
      active = false;
    };
  }, [id, isEdit]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setState('saving');
    try {
      const course = isEdit ? await updateCourse(id, form) : await createCourse(form);
      navigate(`/courses/${course.id}`);
    } catch (err) {
      setError(err.message || 'Could not save course.');
      setState('idle');
    }
  };

  if (state === 'loading') return <div className="loading">Loading…</div>;

  return (
    <>
      <Link to={isEdit ? `/courses/${id}` : '/courses'} className="back-link">
        <Icon name="i-back" /> Back
      </Link>

      <div className="pagehead" style={{ marginTop: 14 }}>
        <div>
          <div className="eyebrow">{isEdit ? 'Edit' : 'New'}</div>
          <h1>{isEdit ? 'Edit course' : 'Create a course'}</h1>
          <p>You’ll enroll students and take attendance from the course page.</p>
        </div>
      </div>

      <form className="card" style={{ maxWidth: 620 }} onSubmit={onSubmit}>
        {error && <p className="form-error">{error}</p>}

        <div className="field-row">
          <label className="field" style={{ flex: '0 0 40%' }}>
            <span className="field__label">Course code</span>
            <input
              className="input"
              type="text"
              name="code"
              value={form.code}
              onChange={onChange}
              placeholder="e.g. CS-301"
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              className="input"
              type="text"
              name="name"
              value={form.name}
              onChange={onChange}
              placeholder="e.g. Data Structures"
              required
            />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            className="textarea"
            name="description"
            rows={3}
            value={form.description}
            onChange={onChange}
            placeholder="What this course covers…"
          />
        </label>

        <button type="submit" className="btn primary block" disabled={state === 'saving'}>
          {state === 'saving' ? 'Saving…' : isEdit ? 'Save changes' : 'Create course'}
        </button>
      </form>
    </>
  );
}
