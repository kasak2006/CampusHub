import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { listCourses } from '../services/courses.js';
import { Icon } from '../components/Icons.jsx';
import { pctClass } from '../utils/attendance.js';

/**
 * Courses directory — role-aware. Faculty/admins manage the courses they own and
 * create new ones; students see the courses they're enrolled in with a live
 * attendance percentage.
 */
export default function Courses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  const canCreate = user.role === 'faculty' || user.role === 'admin';
  const isStudent = !canCreate;

  useEffect(() => {
    let active = true;
    listCourses()
      .then((data) => active && (setCourses(data), setState('ready')))
      .catch((err) => active && (setError(err.message), setState('error')));
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="eyebrow">{isStudent ? 'Your standing' : 'Teaching'}</div>
          <h1>{isStudent ? 'My attendance' : 'Courses'}</h1>
          <p>
            {isStudent
              ? 'Your attendance across every course you’re enrolled in.'
              : 'Create courses, enroll students, and take attendance.'}
          </p>
        </div>
        {canCreate && (
          <Link to="/courses/new" className="btn primary">
            <Icon name="i-plus" /> New course
          </Link>
        )}
      </div>

      {state === 'loading' && <p className="muted">Loading courses…</p>}
      {state === 'error' && <p className="form-error">{error}</p>}
      {state === 'ready' && courses.length === 0 && (
        <div className="empty-state">
          <p>
            {isStudent
              ? 'You’re not enrolled in any courses yet. Your faculty adds you by email.'
              : 'No courses yet — create your first one to start taking attendance.'}
          </p>
        </div>
      )}

      <ul className="list">
        {courses.map((c) => (
          <li key={c.id}>
            <Link to={`/courses/${c.id}`} className="event-row">
              <div className="evtdate">
                <b className="tnum" style={{ fontSize: 13 }}>
                  {c.code.split('-').pop()}
                </b>
                <small>{c.code.split('-')[0]}</small>
              </div>
              <div className="event-row__body">
                <b>{c.name}</b>
                <small className="muted">
                  {c.code} · {c.faculty?.name ?? 'Faculty'}
                  {!isStudent ? ` · ${c.studentCount} student${c.studentCount === 1 ? '' : 's'}` : ''}
                </small>
              </div>
              <div className="event-row__meta">
                {isStudent && c.myAttendance ? (
                  c.myAttendance.total === 0 ? (
                    <span className="chip soft">No sessions yet</span>
                  ) : (
                    <>
                      <span className={`chip ${pctClass(c.myAttendance.pct)}`}>
                        {c.myAttendance.pct}%
                      </span>
                      <span className="muted tnum" style={{ fontSize: 12.5 }}>
                        {c.myAttendance.attended}/{c.myAttendance.total}
                      </span>
                    </>
                  )
                ) : (
                  <span className="chip soft">Manage</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
