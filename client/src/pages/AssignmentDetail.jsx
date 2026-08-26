import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icons.jsx';
import {
  getAssignment,
  listSubmissions,
  submitAssignment,
  gradeSubmission,
  deleteAssignment,
} from '../services/assignments.js';
import { useToast } from '../context/ToastContext.jsx';
import { dueLabel, isOverdue, submissionChip, fileToDataUrl } from '../utils/assignments.js';

function fmtWhen(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/* ─────────────────────────── student view ─────────────────────────── */

function StudentSubmit({ assignment, onSubmitted }) {
  const toast = useToast();
  const sub = assignment.mySubmission;
  const graded = sub?.status === 'graded';

  const [text, setText] = useState(sub?.text ?? '');
  const [fileData, setFileData] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileData(await fileToDataUrl(file));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() && !fileData) {
      toast.error('Add some text or a file first.');
      return;
    }
    setBusy(true);
    try {
      const payload = { text };
      if (fileData) payload.file = fileData;
      await submitAssignment(assignment.id, payload);
      toast.success(sub ? 'Submission updated.' : 'Submitted!');
      setFileData('');
      setFileName('');
      onSubmitted();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Current standing */}
      {sub && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="ch">
            <h3>Your submission</h3>
            <span className={`chip ${submissionChip(sub).cls}`}>{submissionChip(sub).label}</span>
          </div>
          {sub.submittedAt && (
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
              Submitted {fmtWhen(sub.submittedAt)}
              {sub.late ? ' · after the deadline' : ''}
            </p>
          )}
          {graded && (
            <div className="grade-box" style={{ marginTop: 12 }}>
              <div className="grade-box__score">
                <span className="v tnum">
                  {sub.grade}
                  <small>/{assignment.points}</small>
                </span>
                <span className="k">Grade</span>
              </div>
              {sub.feedback && (
                <div className="grade-box__fb">
                  <div className="field__label">Feedback</div>
                  <p style={{ margin: '4px 0 0', lineHeight: 1.5 }}>{sub.feedback}</p>
                </div>
              )}
            </div>
          )}
          {sub.fileUrl && (
            <a
              className="btn ghost sm"
              style={{ marginTop: 12 }}
              href={sub.fileUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="i-book" /> View submitted file
            </a>
          )}
        </div>
      )}

      {/* Submit / resubmit form (locked once graded) */}
      {graded ? (
        <p className="muted" style={{ marginTop: 12 }}>
          This assignment has been graded and can no longer be changed.
        </p>
      ) : (
        <form className="card" onSubmit={onSubmit} style={{ marginTop: 8 }}>
          <div className="ch">
            <h3>{sub ? 'Update your submission' : 'Submit your work'}</h3>
          </div>
          <label className="field" style={{ marginTop: 8 }}>
            <span className="field__label">Text</span>
            <textarea
              className="textarea"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your answer, notes, or a link…"
            />
          </label>
          <label className="field">
            <span className="field__label">
              File <span className="field__hint">(optional)</span>
            </span>
            <input className="file" type="file" onChange={onFile} />
            {fileName && <span className="muted" style={{ fontSize: 12 }}>Selected: {fileName}</span>}
          </label>
          <button className="btn primary" type="submit" disabled={busy}>
            <Icon name="i-check" /> {busy ? 'Submitting…' : sub ? 'Update submission' : 'Submit'}
          </button>
        </form>
      )}
    </>
  );
}

/* ─────────────────────────── faculty grading ─────────────────────────── */

function GradeRow({ entry, points, onGraded }) {
  const toast = useToast();
  const { student, submission } = entry;
  const [grade, setGrade] = useState(submission?.grade ?? '');
  const [feedback, setFeedback] = useState(submission?.feedback ?? '');
  const [busy, setBusy] = useState(false);

  const chip = submissionChip(submission);

  const onSave = async () => {
    if (grade === '' || Number.isNaN(Number(grade))) {
      toast.error('Enter a numeric grade.');
      return;
    }
    setBusy(true);
    try {
      await gradeSubmission(submission.id, { grade: Number(grade), feedback });
      toast.success(`Saved grade for ${student.name}.`);
      onGraded();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card grade-row">
      <div className="grade-row__head">
        <div>
          <b>{student.name}</b>{' '}
          {student.rollNumber && <span className="chip soft">{student.rollNumber}</span>}
        </div>
        <span className={`chip ${chip.cls}`}>{chip.label}</span>
      </div>

      {submission ? (
        <>
          {submission.text && (
            <p className="grade-row__text">{submission.text}</p>
          )}
          {submission.fileUrl && (
            <a className="btn ghost sm" href={submission.fileUrl} target="_blank" rel="noreferrer">
              <Icon name="i-book" /> View file
            </a>
          )}
          <div className="grade-row__form">
            <label className="field" style={{ flex: '0 0 120px', marginBottom: 0 }}>
              <span className="field__label">Grade / {points}</span>
              <input
                className="input"
                type="number"
                min={0}
                max={points}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              />
            </label>
            <label className="field" style={{ flex: 1, marginBottom: 0 }}>
              <span className="field__label">Feedback</span>
              <input
                className="input"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Optional note to the student"
              />
            </label>
            <button className="btn primary" onClick={onSave} disabled={busy} style={{ alignSelf: 'flex-end' }}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      ) : (
        <p className="muted" style={{ margin: '8px 0 0' }}>No submission yet.</p>
      )}
    </li>
  );
}

function FacultyRoster({ assignment }) {
  const [roster, setRoster] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await listSubmissions(assignment.id);
    setRoster(data.roster);
  }, [assignment.id]);

  useEffect(() => {
    let active = true;
    load()
      .then(() => active && setState('ready'))
      .catch((err) => active && (setError(err.message), setState('error')));
    return () => {
      active = false;
    };
  }, [load]);

  const submittedCount = roster.filter((r) => r.submission).length;
  const gradedCount = roster.filter((r) => r.submission?.status === 'graded').length;

  return (
    <section style={{ marginTop: 8 }}>
      <div className="section-h">
        <h2>Submissions</h2>
        <span className="ln" />
        <span className="chip soft">
          {submittedCount} submitted · {gradedCount} graded
        </span>
      </div>

      {state === 'loading' && <p className="muted">Loading submissions…</p>}
      {state === 'error' && <p className="form-error">{error}</p>}
      {state === 'ready' && (
        <ul className="list" style={{ gap: 10 }}>
          {roster.map((entry) => (
            <GradeRow
              key={entry.student.id}
              entry={entry}
              points={assignment.points}
              onGraded={load}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/* ─────────────────────────── page ─────────────────────────── */

export default function AssignmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [assignment, setAssignment] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setAssignment(await getAssignment(id));
  }, [id]);

  const onDelete = async () => {
    if (!window.confirm('Delete this assignment? All submissions for it will be removed.')) return;
    try {
      const courseId = assignment.course.id;
      await deleteAssignment(id);
      toast.success('Assignment deleted.');
      navigate(`/courses/${courseId}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    let active = true;
    load()
      .then(() => active && setState('ready'))
      .catch((err) => active && (setError(err.message), setState('error')));
    return () => {
      active = false;
    };
  }, [load]);

  if (state === 'loading') return <div className="loading">Loading…</div>;
  if (state === 'error')
    return (
      <>
        <Link to="/courses" className="back-link">
          <Icon name="i-back" /> Back to courses
        </Link>
        <p className="form-error" style={{ marginTop: 16 }}>
          {error}
        </p>
      </>
    );

  const overdue = isOverdue(assignment.dueAt);

  return (
    <>
      <Link to={`/courses/${assignment.course.id}`} className="back-link">
        <Icon name="i-back" /> Back to {assignment.course.code}
      </Link>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="club-detail__head">
          <span className="club-logo club-logo--ph club-detail__logo">
            <Icon name="i-edit" />
          </span>
          <div className="club-detail__title">
            <h1>{assignment.title}</h1>
            <div className="club-detail__meta">
              <span className="chip soft">{assignment.course.code}</span>
              <span className={`chip ${overdue ? 'b-crit' : 'b-good'}`}>{dueLabel(assignment.dueAt)}</span>
              <span className="chip soft">{assignment.points} pts</span>
            </div>
          </div>
        </div>

        {assignment.description && (
          <p className="muted" style={{ margin: '16px 0 0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {assignment.description}
          </p>
        )}

        {(assignment.attachmentUrl || assignment.linkUrl) && (
          <div className="club-detail__actions" style={{ marginTop: 14 }}>
            {assignment.attachmentUrl && (
              <a
                className="btn ghost sm"
                href={assignment.attachmentUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="i-book" /> Assignment PDF
              </a>
            )}
            {assignment.linkUrl && (
              <a
                className="btn soft sm"
                href={assignment.linkUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="i-arrow" /> Open form / link
              </a>
            )}
          </div>
        )}

        {assignment.canManage && (
          <div className="club-detail__actions" style={{ marginTop: 12 }}>
            <Link to={`/assignments/${assignment.id}/edit`} className="btn ghost">
              <Icon name="i-edit" /> Edit
            </Link>
            <button className="btn danger" onClick={onDelete}>
              <Icon name="i-trash" /> Delete
            </button>
          </div>
        )}
      </div>

      {assignment.canManage ? (
        <FacultyRoster assignment={assignment} />
      ) : (
        <StudentSubmit assignment={assignment} onSubmitted={load} />
      )}
    </>
  );
}
