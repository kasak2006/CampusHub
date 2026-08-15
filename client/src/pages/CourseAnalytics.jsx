import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Icon } from '../components/Icons.jsx';
import { getCourseAnalytics } from '../services/courses.js';
import { pctClass } from '../utils/attendance.js';

/** Read the current theme's CSS custom properties for chart colors. */
function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    primary: v('--primary', '#E16447'),
    crit: v('--crit', '#D2453B'),
    muted: v('--muted', '#726C67'),
    border: v('--border', '#EBE3DD'),
    surface: v('--surface', '#fff'),
    ink: v('--ink', '#181B21'),
  };
}

function shortDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Faculty analytics for a course. Every number comes from a server-side
 * aggregation: per-student attendance %, the below-threshold flag, and the
 * per-session trend rendered as a Recharts line.
 */
export default function CourseAnalytics() {
  const { id } = useParams();
  const [threshold, setThreshold] = useState(75);
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(
    (active = { value: true }) =>
      getCourseAnalytics(id, threshold)
        .then((d) => active.value && (setData(d), setState('ready')))
        .catch((err) => active.value && (setError(err.message), setState('error'))),
    [id, threshold]
  );

  useEffect(() => {
    const active = { value: true };
    load(active);
    return () => {
      active.value = false;
    };
  }, [load]);

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

  const c = themeColors();
  const chartData = data.trend.map((t) => ({
    name: shortDate(t.date),
    pct: t.pct,
    label: t.title || shortDate(t.date),
  }));

  return (
    <>
      <Link to={`/courses/${id}`} className="back-link">
        <Icon name="i-back" /> Back to course
      </Link>

      <div className="pagehead" style={{ marginTop: 14 }}>
        <div>
          <div className="eyebrow">Analytics</div>
          <h1>Attendance analytics</h1>
          <p>Per-student standing and the class trend over time.</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="stats stats--4" style={{ marginTop: 4 }}>
        <div className="tile">
          <div>
            <div className="v tnum">{data.enrolledCount}</div>
            <div className="k">Enrolled</div>
          </div>
        </div>
        <div className="tile">
          <div>
            <div className="v tnum">{data.totalSessions}</div>
            <div className="k">Sessions held</div>
          </div>
        </div>
        <div className="tile">
          <div>
            <div className="v tnum">{data.averagePct}%</div>
            <div className="k">Class average</div>
          </div>
        </div>
        <div className="tile">
          <div>
            <div className="v tnum" style={{ color: data.belowThreshold.length ? 'var(--crit)' : undefined }}>
              {data.belowThreshold.length}
            </div>
            <div className="k">Below {data.threshold}%</div>
          </div>
        </div>
      </div>

      {/* Trend chart */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="ch">
          <h3>Attendance trend</h3>
          <span className="muted" style={{ fontSize: 12.5 }}>
            % of class present each session
          </span>
        </div>
        {chartData.length === 0 ? (
          <p className="muted">No sessions recorded yet.</p>
        ) : (
          <div style={{ width: '100%', height: 260, marginTop: 8 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
                <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: c.muted, fontSize: 12 }}
                  stroke={c.border}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: c.muted, fontSize: 12 }}
                  stroke={c.border}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: c.surface,
                    border: `1px solid ${c.border}`,
                    borderRadius: 11,
                    color: c.ink,
                    fontSize: 13,
                  }}
                  formatter={(v) => [`${v}%`, 'Present']}
                />
                <ReferenceLine
                  y={data.threshold}
                  stroke={c.crit}
                  strokeDasharray="5 4"
                  label={{ value: `${data.threshold}%`, fill: c.crit, fontSize: 11, position: 'right' }}
                />
                <Line
                  type="monotone"
                  dataKey="pct"
                  stroke={c.primary}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: c.primary }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Per-student table */}
      <section style={{ marginTop: 8 }}>
        <div className="section-h">
          <h2>Per-student</h2>
          <span className="ln" />
          <label className="thresh">
            <span className="muted">Threshold</span>
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            <span className="muted">%</span>
          </label>
        </div>

        {data.perStudent.length === 0 ? (
          <p className="muted">No students enrolled yet.</p>
        ) : (
          <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Student</th>
                  <th className="num">Present</th>
                  <th className="num">Late</th>
                  <th className="num">Absent</th>
                  <th className="num">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {data.perStudent.map((p) => (
                  <tr key={p.student.id} className={p.belowThreshold ? 'row-flag' : undefined}>
                    <td>
                      <b>{p.student.name}</b>
                      {p.student.rollNumber && (
                        <small className="muted"> · {p.student.rollNumber}</small>
                      )}
                    </td>
                    <td className="num">{p.present}</td>
                    <td className="num">{p.late}</td>
                    <td className="num">{p.absent}</td>
                    <td className="num">
                      <span className={`chip ${pctClass(p.pct)}`}>{p.pct}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
