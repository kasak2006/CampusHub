import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createAssignment, getAssignment, updateAssignment } from '../services/assignments.js';
import { Icon } from '../components/Icons.jsx';
import { fileToDataUrl } from '../utils/assignments.js';

/** Convert an ISO date to the value a <input type="datetime-local"> expects. */
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/**
 * Create or edit an assignment (Phase 7). Only the owning course faculty (or an
 * admin) can reach this — the server enforces it. Create is reached from a course
 * page (`/courses/:courseId/assignments/new`); edit from an assignment
 * (`/assignments/:id/edit`).
 */
export default function AssignmentForm() {
  const { courseId, id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [backCourseId, setBackCourseId] = useState(courseId || '');
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueAt: '',
    points: '100',
    linkUrl: '',
  });
  // PDF/file attachment: a freshly picked file (data URI) + the existing one.
  const [attachment, setAttachment] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [existingFile, setExistingFile] = useState('');
  const [state, setState] = useState(isEdit ? 'loading' : 'idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return undefined;
    let active = true;
    getAssignment(id)
      .then((a) => {
        if (!active) return;
        setForm({
          title: a.title,
          description: a.description ?? '',
          dueAt: toLocalInput(a.dueAt),
          points: String(a.points),
          linkUrl: a.linkUrl ?? '',
        });
        setExistingFile(a.attachmentUrl ?? '');
        setBackCourseId(a.course.id);
        setState('idle');
      })
      .catch((err) => active && (setError(err.message), setState('idle')));
    return () => {
      active = false;
    };
  }, [id, isEdit]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentName(file.name);
    setAttachment(await fileToDataUrl(file));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setState('saving');
    const payload = {
      title: form.title,
      description: form.description,
      dueAt: form.dueAt,
      points: Number(form.points) || 0,
      linkUrl: form.linkUrl.trim(),
    };
    if (attachment) payload.attachment = attachment;
    try {
      const assignment = isEdit
        ? await updateAssignment(id, payload)
        : await createAssignment(courseId, payload);
      navigate(`/assignments/${assignment.id}`);
    } catch (err) {
      setError(err.message || 'Could not save assignment.');
      setState('idle');
    }
  };

  if (state === 'loading') return <div className="loading">Loading…</div>;

  return (
    <>
      <Link
        to={isEdit ? `/assignments/${id}` : `/courses/${backCourseId}`}
        className="back-link"
      >
        <Icon name="i-back" /> Back
      </Link>

      <div className="pagehead" style={{ marginTop: 14 }}>
        <div>
          <div className="eyebrow">{isEdit ? 'Edit' : 'New'}</div>
          <h1>{isEdit ? 'Edit assignment' : 'Create an assignment'}</h1>
          <p>Set a deadline, attach a PDF or a form link, and points.</p>
        </div>
      </div>

      <form className="card" style={{ maxWidth: 620 }} onSubmit={onSubmit}>
        {error && <p className="form-error">{error}</p>}

        <label className="field">
          <span className="field__label">Title</span>
          <input
            className="input"
            type="text"
            name="title"
            value={form.title}
            onChange={onChange}
            placeholder="e.g. Binary Tree Traversals"
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            className="textarea"
            name="description"
            rows={4}
            value={form.description}
            onChange={onChange}
            placeholder="Instructions, requirements, grading notes…"
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Due</span>
            <input
              className="input"
              type="datetime-local"
              name="dueAt"
              value={form.dueAt}
              onChange={onChange}
              required
            />
          </label>
          <label className="field" style={{ flex: '0 0 120px' }}>
            <span className="field__label">Points</span>
            <input
              className="input"
              type="number"
              name="points"
              min="0"
              value={form.points}
              onChange={onChange}
            />
          </label>
        </div>

        <label className="field">
          <span className="field__label">
            Google Form / link <span className="field__hint">(optional)</span>
          </span>
          <input
            className="input"
            type="url"
            name="linkUrl"
            value={form.linkUrl}
            onChange={onChange}
            placeholder="https://forms.gle/…"
          />
        </label>

        <div className="field">
          <span className="field__label">
            Attachment PDF <span className="field__hint">(optional)</span>
          </span>
          <input className="file" type="file" accept="application/pdf,.pdf" onChange={onFile} />
          {attachmentName ? (
            <span className="muted" style={{ fontSize: 12 }}>
              Selected: {attachmentName}
            </span>
          ) : (
            existingFile && (
              <a
                className="btn ghost sm"
                style={{ alignSelf: 'flex-start' }}
                href={existingFile}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="i-book" /> Current file — replace by choosing a new one
              </a>
            )
          )}
        </div>

        <button type="submit" className="btn primary block" disabled={state === 'saving'}>
          {state === 'saving' ? 'Saving…' : isEdit ? 'Save changes' : 'Create assignment'}
        </button>
      </form>
    </>
  );
}
