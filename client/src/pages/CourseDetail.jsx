import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icons.jsx';
import {
  getCourse,
  deleteCourse,
  enrollStudents,
  unenrollStudent,
} from '../services/courses.js';
import { listSessions, createSession, deleteSession } from '../services/attendance.js';
import { listAssignments } from '../services/assignments.js';
import { listResources, createResource, deleteResource } from '../services/resources.js';
import { useToast } from '../context/ToastContext.jsx';
import { pctClass } from '../utils/attendance.js';
import { dueLabel, isOverdue, submissionChip, fileToDataUrl } from '../utils/assignments.js';

function initials(name = '') {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const STATUS_CHIP = {
  present: { cls: 'b-good', label: 'Present' },
  late: { cls: 'b-warn', label: 'Late' },
  absent: { cls: 'b-crit', label: 'Absent' },
};

/** Today as the YYYY-MM-DD value an <input type="date"> expects. */
function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Course detail. Faculty/admin owners manage the roster and sessions; enrolled
 * students see their own attendance summary and per-session history.
 */
export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [course, setCourse] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [resources, setResources] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [action, setAction] = useState({ busy: false });

  const [emails, setEmails] = useState('');
  const [sessionDate, setSessionDate] = useState(todayInput());
  const [sessionTitle, setSessionTitle] = useState('');

  const [resTitle, setResTitle] = useState('');
  const [resLink, setResLink] = useState('');
  const [resFile, setResFile] = useState({ data: '', name: '' });
  const [resFormKey, setResFormKey] = useState(0);

  const load = useCallback(async () => {
    const data = await getCourse(id);
    setCourse(data);
    const [sess, asg, res] = await Promise.all([
      listSessions(id).catch(() => []),
      listAssignments(id).catch(() => []),
      listResources(id)
        .then((d) => d.resources)
        .catch(() => []),
    ]);
    setSessions(sess);
    setAssignments(asg);
    setResources(res);
  }, [id]);

  useEffect(() => {
    let active = true;
    load()
      .then(() => active && setState('ready'))
      .catch((err) => active && (setError(err.message), setState('error')));
    return () => {
      active = false;
    };
  }, [load]);

  const run = async (fn, okMessage) => {
    setAction({ busy: true });
    try {
      const result = await fn();
      await load();
      setAction({ busy: false });
      toast.success(okMessage(result));
      return result;
    } catch (err) {
      setAction({ busy: false });
      toast.error(err.message);
      return null;
    }
  };

  const onEnroll = async (e) => {
    e.preventDefault();
    const list = emails
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    const result = await run(
      () => enrollStudents(id, list),
      (r) => {
        const parts = [`Enrolled ${r.added} student${r.added === 1 ? '' : 's'}.`];
        if (r.notFound.length) parts.push(`Not found: ${r.notFound.join(', ')}.`);
        return parts.join(' ');
      }
    );
    if (result) setEmails('');
  };

  const onCreateSession = async (e) => {
    e.preventDefault();
    const session = await run(
      () => createSession({ courseId: id, date: sessionDate, title: sessionTitle }),
      () => 'Session created.'
    );
    if (session) navigate(`/sessions/${session.id}`);
  };

  const onDeleteCourse = async () => {
    if (!window.confirm('Delete this course? All sessions and attendance records will be removed.'))
      return;
    try {
      await deleteCourse(id);
      toast.success('Course deleted.');
      navigate('/courses');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const onDeleteSession = (sid) =>
    run(() => deleteSession(sid), () => 'Session deleted.');

  const onResFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResFile({ data: await fileToDataUrl(file), name: file.name });
  };

  const onAddResource = async (e) => {
    e.preventDefault();
    const payload = { title: resTitle.trim() };
    if (resFile.data) {
      payload.file = resFile.data;
      payload.type = (resFile.name.split('.').pop() || 'file').toLowerCase();
    } else {
      payload.linkUrl = resLink.trim();
      payload.type = 'link';
    }
    const created = await run(() => createResource(id, payload), () => 'Material added.');
    if (created) {
      setResTitle('');
      setResLink('');
      setResFile({ data: '', name: '' });
      setResFormKey((k) => k + 1); // remount the file input to clear its label
    }
  };

  const onDeleteResource = (rid) =>
    run(() => deleteResource(rid), () => 'Material removed.');

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

  const canManage = course.viewer?.canManage;
  const my = course.myAttendance;

  return (
    <>
      <Link to="/courses" className="back-link">
        <Icon name="i-back" /> Back to courses
      </Link>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="club-detail__head">
          <span className="club-logo club-logo--ph club-detail__logo">
            <Icon name="i-book" />
          </span>
          <div className="club-detail__title">
            <h1>{course.name}</h1>
            <div className="club-detail__meta">
              <span className="chip soft">{course.code}</span>
              <span>{course.faculty?.name ?? 'Faculty'}</span>
              {canManage && (
                <span>
                  <Icon name="i-users" style={{ width: 14, height: 14, verticalAlign: '-2px' }} />{' '}
                  {course.studentCount} student{course.studentCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="muted" style={{ margin: '16px 0', lineHeight: 1.6 }}>
          {course.description || 'No description yet.'}
        </p>

        {canManage && (
          <div className="club-detail__actions">
            <Link to={`/courses/${id}/analytics`} className="btn soft">
              <Icon name="i-chart" /> Analytics
            </Link>
            <Link to={`/courses/${id}/gradebook`} className="btn soft">
              <Icon name="i-book" /> Gradebook
            </Link>
            <Link to={`/courses/${id}/edit`} className="btn ghost">
              <Icon name="i-edit" /> Edit
            </Link>
            <button className="btn danger" disabled={action.busy} onClick={onDeleteCourse}>
              <Icon name="i-trash" /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Student's own attendance summary */}
      {!canManage && my && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="ch">
            <h3>Your attendance</h3>
            {my.total > 0 && (
              <span className={`chip ${pctClass(my.pct)}`}>{my.pct}%</span>
            )}
          </div>
          {my.total === 0 ? (
            <p className="muted">No sessions have been held yet.</p>
          ) : (
            <div className="stats stats--row" style={{ marginTop: 6 }}>
              <div className="tile">
                <div>
                  <div className="v tnum">
                    {my.attended}/{my.total}
                  </div>
                  <div className="k">Sessions attended</div>
                </div>
              </div>
              <div className="tile">
                <div>
                  <div className="v tnum">
                    {my.present} · {my.late} · {my.absent}
                  </div>
                  <div className="k">Present · Late · Absent</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Enrollment (manage) */}
      {canManage && (
        <section style={{ marginTop: 8 }}>
          <div className="section-h">
            <h2>Enrolled students</h2>
            <span className="ln" />
            <span className="chip soft">{course.studentCount}</span>
          </div>

          <form className="card" onSubmit={onEnroll} style={{ marginBottom: 12 }}>
            <label className="field" style={{ marginBottom: 8 }}>
              <span className="field__label">
                Add students <span className="field__hint">— emails, separated by commas or spaces</span>
              </span>
              <textarea
                className="textarea"
                rows={2}
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="student@campushub.test, nina@campushub.test"
              />
            </label>
            <button className="btn primary" disabled={action.busy || !emails.trim()}>
              <Icon name="i-plus" /> Enroll
            </button>
          </form>

          {course.students?.length ? (
            <ul className="list">
              {course.students.map((s) => (
                <li key={s.id} className="member-item">
                  <span className="thumb">{initials(s.name)}</span>
                  <span className="member-item__name">{s.name}</span>
                  {s.rollNumber && <span className="chip soft">{s.rollNumber}</span>}
                  <button
                    className="btn ghost sm"
                    style={{ marginLeft: 'auto' }}
                    disabled={action.busy}
                    onClick={() =>
                      run(() => unenrollStudent(id, s.id), () => `${s.name} unenrolled.`)
                    }
                  >
                    <Icon name="i-x" /> Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No students enrolled yet.</p>
          )}
        </section>
      )}

      {/* Assignments */}
      <section style={{ marginTop: 8 }}>
        <div className="section-h">
          <h2>Assignments</h2>
          <span className="ln" />
          <span className="chip soft">{assignments.length}</span>
          {canManage && (
            <Link to={`/courses/${id}/assignments/new`} className="btn primary sm">
              <Icon name="i-plus" /> New assignment
            </Link>
          )}
        </div>

        {assignments.length === 0 ? (
          <p className="muted">No assignments yet.</p>
        ) : (
          <ul className="list">
            {assignments.map((a) => {
              const overdue = isOverdue(a.dueAt);
              const chip = !canManage ? submissionChip(a.mySubmission) : null;
              return (
                <li key={a.id} className="session-li">
                  <Link to={`/assignments/${a.id}`} className="event-row" style={{ flex: 1 }}>
                    <div className="evtdate">
                      <b className="tnum">{new Date(a.dueAt).getDate()}</b>
                      <small>
                        {new Date(a.dueAt).toLocaleDateString(undefined, { month: 'short' })}
                      </small>
                    </div>
                    <div className="event-row__body">
                      <b>{a.title}</b>
                      <small className="muted">
                        {dueLabel(a.dueAt)} · {a.points} pts
                      </small>
                    </div>
                    <div className="event-row__meta">
                      {canManage ? (
                        <span className="chip soft">
                          {a.stats.graded}/{a.stats.submitted} graded · {a.stats.enrolled} enrolled
                        </span>
                      ) : chip ? (
                        <span className={`chip ${chip.cls}`}>{chip.label}</span>
                      ) : (
                        <span className={`chip ${overdue ? 'b-crit' : 'soft'}`}>
                          {overdue ? 'Overdue' : 'Open'}
                        </span>
                      )}
                      <Icon name="i-arrow" className="svg-ico" style={{ color: 'var(--faint)' }} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Materials */}
      <section style={{ marginTop: 8 }}>
        <div className="section-h">
          <h2>Materials</h2>
          <span className="ln" />
          <span className="chip soft">{resources.length}</span>
        </div>

        {canManage && (
          <form className="card" onSubmit={onAddResource} style={{ marginBottom: 12 }}>
            <label className="field" style={{ marginBottom: 10 }}>
              <span className="field__label">Title</span>
              <input
                className="input"
                type="text"
                value={resTitle}
                onChange={(e) => setResTitle(e.target.value)}
                placeholder="e.g. Lecture 3 slides"
                required
              />
            </label>
            <div className="field-row" style={{ alignItems: 'flex-end' }}>
              <label className="field">
                <span className="field__label">
                  File <span className="field__hint">(PDF, doc, slides…)</span>
                </span>
                <input key={resFormKey} className="file" type="file" onChange={onResFile} />
                {resFile.name && (
                  <span className="muted" style={{ fontSize: 12 }}>
                    Selected: {resFile.name}
                  </span>
                )}
              </label>
              <label className="field">
                <span className="field__label">
                  or Link <span className="field__hint">(Drive, video…)</span>
                </span>
                <input
                  className="input"
                  type="url"
                  value={resLink}
                  onChange={(e) => setResLink(e.target.value)}
                  placeholder="https://…"
                  disabled={Boolean(resFile.data)}
                />
              </label>
              <button
                className="btn primary"
                disabled={action.busy || !resTitle.trim() || (!resFile.data && !resLink.trim())}
                style={{ marginBottom: 2 }}
              >
                <Icon name="i-plus" /> Add
              </button>
            </div>
          </form>
        )}

        {resources.length === 0 ? (
          <p className="muted">No materials yet.</p>
        ) : (
          <ul className="list">
            {resources.map((r) => {
              const href = r.fileUrl || r.linkUrl;
              const isLink = !r.fileUrl && Boolean(r.linkUrl);
              return (
                <li key={r.id} className="session-li">
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="event-row"
                    style={{ flex: 1, textDecoration: 'none' }}
                  >
                    <span className="res-ic">
                      <Icon name={isLink ? 'i-link' : 'i-file'} />
                    </span>
                    <div className="event-row__body">
                      <b>{r.title}</b>
                      <small className="muted">
                        {(r.type || 'file').toUpperCase()} · {r.uploadedBy?.name ?? 'Faculty'}
                      </small>
                    </div>
                    <div className="event-row__meta">
                      <span className="chip soft">
                        <Icon
                          name={isLink ? 'i-link' : 'i-download'}
                          style={{ width: 13, height: 13, verticalAlign: '-2px' }}
                        />{' '}
                        {isLink ? 'Open' : 'Download'}
                      </span>
                    </div>
                  </a>
                  {canManage && (
                    <button
                      className="btn ghost sm session-li__del"
                      disabled={action.busy}
                      onClick={() => onDeleteResource(r.id)}
                      title="Delete material"
                    >
                      <Icon name="i-trash" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Sessions */}
      <section style={{ marginTop: 8 }}>
        <div className="section-h">
          <h2>Sessions</h2>
          <span className="ln" />
          <span className="chip soft">{sessions.length}</span>
        </div>

        {canManage && (
          <form className="card" onSubmit={onCreateSession} style={{ marginBottom: 12 }}>
            <div className="field-row" style={{ alignItems: 'flex-end' }}>
              <label className="field" style={{ flex: '0 0 34%' }}>
                <span className="field__label">Date</span>
                <input
                  className="input"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field__label">
                  Topic <span className="field__hint">(optional)</span>
                </span>
                <input
                  className="input"
                  type="text"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="e.g. Binary trees"
                />
              </label>
              <button className="btn primary" disabled={action.busy} style={{ marginBottom: 2 }}>
                <Icon name="i-plus" /> New session
              </button>
            </div>
          </form>
        )}

        {sessions.length === 0 ? (
          <p className="muted">No sessions yet.</p>
        ) : (
          <ul className="list">
            {sessions.map((s) => {
              const chip = !canManage && s.myStatus ? STATUS_CHIP[s.myStatus] : null;
              const row = (
                <>
                  <div className="evtdate">
                    <b className="tnum">{new Date(s.date).getUTCDate()}</b>
                    <small>
                      {new Date(s.date).toLocaleDateString(undefined, {
                        month: 'short',
                        timeZone: 'UTC',
                      })}
                    </small>
                  </div>
                  <div className="event-row__body">
                    <b>{s.title || fmtDate(s.date)}</b>
                    <small className="muted">
                      {s.title ? fmtDate(s.date) : 'Class session'}
                      {canManage ? ` · ${s.marked}/${s.enrolled} marked` : ''}
                    </small>
                  </div>
                  <div className="event-row__meta">
                    {canManage ? (
                      <>
                        {s.marked > 0 && (
                          <span className="chip soft">
                            {s.present}P · {s.late}L · {s.absent}A
                          </span>
                        )}
                        <Icon name="i-arrow" className="svg-ico" style={{ color: 'var(--faint)' }} />
                      </>
                    ) : chip ? (
                      <span className={`chip ${chip.cls}`}>{chip.label}</span>
                    ) : (
                      <span className="chip soft">Unmarked</span>
                    )}
                  </div>
                </>
              );
              return (
                <li key={s.id} className="session-li">
                  {canManage ? (
                    <>
                      <Link to={`/sessions/${s.id}`} className="event-row" style={{ flex: 1 }}>
                        {row}
                      </Link>
                      <button
                        className="btn ghost sm session-li__del"
                        disabled={action.busy}
                        onClick={() => onDeleteSession(s.id)}
                        title="Delete session"
                      >
                        <Icon name="i-trash" />
                      </button>
                    </>
                  ) : (
                    <div className="event-row">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
