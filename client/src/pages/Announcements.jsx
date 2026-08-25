import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  listAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} from '../services/announcements.js';
import { listClubs } from '../services/clubs.js';
import { listCourses } from '../services/courses.js';
import { canPostAnnouncement, scopeLabel } from '../utils/announcements.js';
import { Icon } from '../components/Icons.jsx';

/** Encode/decode an audience option as a single select value. */
const encode = (scope, targetId) => `${scope}:${targetId ?? ''}`;
const decode = (value) => {
  const [scope, targetId] = value.split(':');
  return { scope, targetId: targetId || null };
};

function formatWhen(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Announcements feed (Phase 6). Everyone sees the announcements for their college
 * and any club/course they belong to. Faculty, admins, and club leads also get a
 * composer scoped to the audiences they're allowed to post to; posting fans out
 * a real-time notification to that audience.
 */
export default function Announcements() {
  const { user } = useAuth();
  const toast = useToast();
  const canPost = canPostAnnouncement(user.role);

  const [announcements, setAnnouncements] = useState([]);
  const [audiences, setAudiences] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  // Composer state.
  const [audience, setAudience] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        // Announcements for everyone; audience sources only if they can post.
        const [feed, clubs, courses] = await Promise.all([
          listAnnouncements(),
          canPost ? listClubs() : Promise.resolve([]),
          canPost && user.role !== 'club_lead' ? listCourses() : Promise.resolve([]),
        ]);
        if (!active) return;

        const opts = [];
        if (user.role === 'faculty' || user.role === 'admin') {
          opts.push({ value: encode('college', null), label: 'College-wide' });
        }
        for (const club of clubs) {
          if (club.viewer?.isLead) {
            opts.push({ value: encode('club', club.id), label: `Club — ${club.name}` });
          }
        }
        for (const course of courses) {
          opts.push({
            value: encode('course', course.id),
            label: `Course — ${course.code} ${course.name}`,
          });
        }

        setAnnouncements(feed);
        setAudiences(opts);
        setAudience((prev) => prev || (opts[0]?.value ?? ''));
        setState('ready');
      } catch (err) {
        if (active) {
          setError(err.message);
          setState('error');
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [canPost, user.role]);

  const canSubmit = useMemo(
    () => audience && title.trim() && body.trim() && !posting,
    [audience, title, body, posting]
  );

  const handlePost = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setPosting(true);
    try {
      const { scope, targetId } = decode(audience);
      const created = await createAnnouncement({
        scope,
        targetId,
        title: title.trim(),
        body: body.trim(),
        pinned,
      });
      // Prepend, keeping pinned items first.
      setAnnouncements((list) =>
        [created, ...list].sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            new Date(b.createdAt) - new Date(a.createdAt)
        )
      );
      setTitle('');
      setBody('');
      setPinned(false);
      toast.success('Announcement posted.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAnnouncement(id);
      setAnnouncements((list) => list.filter((a) => a.id !== id));
      toast.success('Announcement deleted.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="eyebrow">Communication</div>
          <h1>Announcements</h1>
          <p>Updates from your college, clubs, and courses — all in one feed.</p>
        </div>
      </div>

      {canPost && audiences.length > 0 && (
        <form className="card announce-composer" onSubmit={handlePost}>
          <div className="announce-composer__row">
            <label className="field">
              <span className="field__label">Audience</span>
              <select
                className="input"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                {audiences.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Title</span>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Class cancelled tomorrow"
                maxLength={140}
              />
            </label>
          </div>

          <label className="field">
            <span className="field__label">Message</span>
            <textarea
              className="textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the details…"
              rows={3}
            />
          </label>

          <div className="announce-composer__foot">
            <label className="checkline">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              Pin to top
            </label>
            <button className="btn primary" type="submit" disabled={!canSubmit}>
              <Icon name="i-mega" /> {posting ? 'Posting…' : 'Post announcement'}
            </button>
          </div>
        </form>
      )}

      {state === 'loading' && <p className="muted">Loading announcements…</p>}
      {state === 'error' && <p className="form-error">{error}</p>}
      {state === 'ready' && announcements.length === 0 && (
        <div className="empty-state">
          <p>No announcements yet.</p>
        </div>
      )}

      <div className="announce-list">
        {announcements.map((a) => (
          <article key={a.id} className={`card announce${a.pinned ? ' pinned' : ''}`}>
            <div className="announce__top">
              <div className="announce__meta">
                <span className={`chip ${a.scope === 'college' ? 'role' : 'soft'}`}>
                  {scopeLabel(a.scope)}
                </span>
                {a.pinned && (
                  <span className="chip live">
                    <Icon name="i-star" style={{ width: 12, height: 12, verticalAlign: '-1px' }} />{' '}
                    Pinned
                  </span>
                )}
              </div>
              {a.canManage && (
                <button
                  className="iconbtn sm"
                  type="button"
                  title="Delete announcement"
                  aria-label="Delete announcement"
                  onClick={() => handleDelete(a.id)}
                >
                  <Icon name="i-trash" style={{ width: 15, height: 15 }} />
                </button>
              )}
            </div>

            <h3 className="announce__title">{a.title}</h3>
            <p className="announce__body">{a.body}</p>

            <div className="announce__foot">
              <span>{a.author?.name ?? 'Unknown'}</span>
              <span className="dot-sep">·</span>
              <span>{formatWhen(a.createdAt)}</span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
