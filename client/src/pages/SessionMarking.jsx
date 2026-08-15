import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icons.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getSession, markSession } from '../services/attendance.js';

function initials(name = '') {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
];

/**
 * Attendance marking for one session. Faculty sees the enrolled roster and sets
 * each student present / late / absent, then submits. Existing marks pre-fill;
 * unmarked students default to Present (toggle the exceptions, or use the bulk
 * buttons). Submitting upserts every roster entry.
 */
export default function SessionMarking() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [marks, setMarks] = useState({});
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState({ busy: false, message: '', error: '' });

  useEffect(() => {
    let active = true;
    getSession(sessionId)
      .then((d) => {
        if (!active) return;
        setData(d);
        // Pre-fill from existing marks; default the rest to present.
        const init = {};
        for (const row of d.roster) init[row.student.id] = row.status ?? 'present';
        setMarks(init);
        setState('ready');
      })
      .catch((err) => active && (setError(err.message), setState('error')));
    return () => {
      active = false;
    };
  }, [sessionId]);

  const setAll = (value) => {
    if (!data) return;
    const next = {};
    for (const row of data.roster) next[row.student.id] = value;
    setMarks(next);
  };

  const tally = useMemo(() => {
    const t = { present: 0, late: 0, absent: 0 };
    for (const v of Object.values(marks)) t[v] += 1;
    return t;
  }, [marks]);

  const onSubmit = async () => {
    setSaveState({ busy: true, message: '', error: '' });
    try {
      const records = data.roster.map((row) => ({
        studentId: row.student.id,
        status: marks[row.student.id],
      }));
      const res = await markSession(sessionId, records);
      setSaveState({ busy: false, message: res.message, error: '' });
      toast.success(res.message);
    } catch (err) {
      setSaveState({ busy: false, message: '', error: err.message });
      toast.error(err.message);
    }
  };

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

  const { session, course, roster } = data;

  return (
    <>
      <Link to={`/courses/${course.id}`} className="back-link">
        <Icon name="i-back" /> Back to {course.code}
      </Link>

      <div className="pagehead" style={{ marginTop: 14 }}>
        <div>
          <div className="eyebrow">
            {course.code} · {course.name}
          </div>
          <h1>{session.title || 'Take attendance'}</h1>
          <p>{fmtDate(session.date)}</p>
        </div>
      </div>

      {roster.length === 0 ? (
        <div className="empty-state">
          <p>No students are enrolled yet. Enroll students on the course page first.</p>
          <Link to={`/courses/${course.id}`} className="btn primary" style={{ marginTop: 12 }}>
            Go to course
          </Link>
        </div>
      ) : (
        <>
          <div className="card mark-toolbar">
            <div className="mark-tally">
              <span className="b-good chip">{tally.present} present</span>
              <span className="b-warn chip">{tally.late} late</span>
              <span className="b-crit chip">{tally.absent} absent</span>
            </div>
            <div className="mark-bulk">
              <button className="btn ghost sm" onClick={() => setAll('present')}>
                All present
              </button>
              <button className="btn ghost sm" onClick={() => setAll('absent')}>
                All absent
              </button>
            </div>
          </div>

          <ul className="list" style={{ marginTop: 12 }}>
            {roster.map((row) => (
              <li key={row.student.id} className="mark-row">
                <span className="thumb">{initials(row.student.name)}</span>
                <div className="mark-row__id">
                  <b>{row.student.name}</b>
                  <small className="muted">
                    {row.student.rollNumber || row.student.email}
                  </small>
                </div>
                <div className="seg" role="group" aria-label={`Attendance for ${row.student.name}`}>
                  {OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`seg__btn${
                        marks[row.student.id] === opt.value ? ` on on-${opt.value}` : ''
                      }`}
                      aria-pressed={marks[row.student.id] === opt.value}
                      onClick={() =>
                        setMarks((m) => ({ ...m, [row.student.id]: opt.value }))
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          {saveState.message && (
            <p className="form-success" style={{ marginTop: 14 }}>
              {saveState.message}
            </p>
          )}
          {saveState.error && (
            <p className="form-error" style={{ marginTop: 14 }}>
              {saveState.error}
            </p>
          )}

          <div className="mark-actions">
            <button className="btn primary" disabled={saveState.busy} onClick={onSubmit}>
              <Icon name="i-check" /> {saveState.busy ? 'Saving…' : 'Save attendance'}
            </button>
            <button
              className="btn ghost"
              onClick={() => navigate(`/courses/${course.id}`)}
            >
              Done
            </button>
          </div>
        </>
      )}
    </>
  );
}
