import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icons.jsx';
import { getGradebook } from '../services/assignments.js';

/** Chip class for a percentage, mirroring the attendance pctClass buckets. */
function pctClass(pct) {
  if (pct === null || pct === undefined) return 'soft';
  if (pct >= 75) return 'b-good';
  if (pct >= 50) return 'b-warn';
  return 'b-crit';
}

/**
 * Course gradebook (faculty/admin): every enrolled student's grade on each
 * assignment plus their overall average, all from a server-side aggregation.
 */
export default function Gradebook() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getGradebook(id)
      .then((d) => active && (setData(d), setState('ready')))
      .catch((err) => active && (setError(err.message), setState('error')));
    return () => {
      active = false;
    };
  }, [id]);

  if (state === 'loading') return <div className="loading">Loading…</div>;
  if (state === 'error')
    return (
      <>
        <Link to={`/courses/${id}`} className="back-link">
          <Icon name="i-back" /> Back to course
        </Link>
        <p className="form-error" style={{ marginTop: 16 }}>
          {error}
        </p>
      </>
    );

  const graded = data.rows.filter((r) => r.averagePct !== null);
  const classAvg = graded.length
    ? Math.round(graded.reduce((sum, r) => sum + r.averagePct, 0) / graded.length)
    : null;

  return (
    <>
      <Link to={`/courses/${id}`} className="back-link">
        <Icon name="i-back" /> Back to {data.course.code}
      </Link>

      <div className="pagehead" style={{ marginTop: 14 }}>
        <div>
          <div className="eyebrow">Grades</div>
          <h1>Gradebook</h1>
          <p>{data.course.code} · every student&apos;s grade across all assignments.</p>
        </div>
      </div>

      <div className="stats stats--4" style={{ marginTop: 4 }}>
        <div className="tile">
          <div>
            <div className="v tnum">{data.rows.length}</div>
            <div className="k">Students</div>
          </div>
        </div>
        <div className="tile">
          <div>
            <div className="v tnum">{data.assignments.length}</div>
            <div className="k">Assignments</div>
          </div>
        </div>
        <div className="tile">
          <div>
            <div className="v tnum">{data.totalPoints}</div>
            <div className="k">Total points</div>
          </div>
        </div>
        <div className="tile">
          <div>
            <div className="v tnum">{classAvg === null ? '—' : `${classAvg}%`}</div>
            <div className="k">Class average</div>
          </div>
        </div>
      </div>

      {data.assignments.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 12 }}>
          <p>No assignments yet — create one from the course page.</p>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto', padding: 0, marginTop: 12 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Student</th>
                {data.assignments.map((a) => (
                  <th key={a.id} className="num" title={a.title}>
                    {a.title.length > 16 ? `${a.title.slice(0, 15)}…` : a.title}
                    <small className="muted"> /{a.points}</small>
                  </th>
                ))}
                <th className="num">Average</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.student.id}>
                  <td>
                    <b>{row.student.name}</b>
                    {row.student.rollNumber && (
                      <small className="muted"> · {row.student.rollNumber}</small>
                    )}
                  </td>
                  {row.grades.map((g, i) => (
                    <td key={data.assignments[i].id} className="num">
                      {g.grade === null ? (
                        <span className="muted">—</span>
                      ) : (
                        <>
                          {g.grade}
                          {g.late && <span className="chip b-warn" style={{ marginLeft: 6 }}>late</span>}
                        </>
                      )}
                    </td>
                  ))}
                  <td className="num">
                    {row.averagePct === null ? (
                      <span className="muted">—</span>
                    ) : (
                      <span className={`chip ${pctClass(row.averagePct)}`}>{row.averagePct}%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
