import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createEvent, getEvent, updateEvent } from '../services/events.js';
import { listClubs } from '../services/clubs.js';
import { Icon } from '../components/Icons.jsx';

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
 * Create or edit an event. Only a lead of the owning club (or an admin) may do
 * so — the club dropdown lists just the clubs the current user leads.
 */
export default function EventForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [ledClubs, setLedClubs] = useState([]);
  const [form, setForm] = useState({
    clubId: params.get('clubId') || '',
    title: '',
    description: '',
    location: '',
    startAt: '',
    endAt: '',
    capacity: '',
  });
  const [banner, setBanner] = useState('');
  const [preview, setPreview] = useState('');
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([listClubs(), isEdit ? getEvent(id) : Promise.resolve(null)])
      .then(([clubs, event]) => {
        if (!active) return;
        setLedClubs(clubs.filter((c) => c.viewer?.isLead));
        if (event) {
          setForm({
            clubId: event.club.id,
            title: event.title,
            description: event.description ?? '',
            location: event.location ?? '',
            startAt: toLocalInput(event.startAt),
            endAt: toLocalInput(event.endAt),
            capacity: String(event.capacity),
          });
          setPreview(event.bannerUrl ?? '');
        }
        setState('idle');
      })
      .catch((err) => active && (setError(err.message), setState('idle')));
    return () => {
      active = false;
    };
  }, [id, isEdit]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onBannerFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBanner(reader.result);
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };
  const onBannerUrl = (e) => {
    setBanner(e.target.value);
    setPreview(e.target.value);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setState('saving');
    const payload = {
      ...form,
      capacity: Number(form.capacity),
      endAt: form.endAt || undefined,
    };
    if (banner) payload.banner = banner;
    try {
      const event = isEdit ? await updateEvent(id, payload) : await createEvent(payload);
      navigate(`/events/${event.id}`);
    } catch (err) {
      setError(err.message || 'Could not save event.');
      setState('idle');
    }
  };

  const noLedClubs = useMemo(() => !isEdit && ledClubs.length === 0, [isEdit, ledClubs]);

  if (state === 'loading') return <div className="loading">Loading…</div>;

  return (
    <>
      <Link to={isEdit ? `/events/${id}` : '/events'} className="back-link">
        <Icon name="i-back" /> Back
      </Link>

      <div className="pagehead" style={{ marginTop: 14 }}>
        <div>
          <div className="eyebrow">{isEdit ? 'Edit' : 'New'}</div>
          <h1>{isEdit ? 'Edit event' : 'Create an event'}</h1>
          <p>Only clubs you lead can host events.</p>
        </div>
      </div>

      {noLedClubs ? (
        <div className="empty-state">
          <p>You don’t lead any clubs yet. Create a club first, then host events under it.</p>
          <Link to="/clubs/new" className="btn primary" style={{ marginTop: 12 }}>
            <Icon name="i-plus" /> Create a club
          </Link>
        </div>
      ) : (
        <form className="card" style={{ maxWidth: 620 }} onSubmit={onSubmit}>
          {error && <p className="form-error">{error}</p>}

          <label className="field">
            <span className="field__label">Club</span>
            <select
              className="input"
              name="clubId"
              value={form.clubId}
              onChange={onChange}
              required
              disabled={isEdit}
            >
              <option value="" disabled>
                Select a club…
              </option>
              {ledClubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Title</span>
            <input className="input" type="text" name="title" value={form.title} onChange={onChange} required />
          </label>

          <label className="field">
            <span className="field__label">Description</span>
            <textarea
              className="textarea"
              name="description"
              rows={3}
              value={form.description}
              onChange={onChange}
              placeholder="What’s happening?"
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field__label">Location</span>
              <input className="input" type="text" name="location" value={form.location} onChange={onChange} placeholder="e.g. Auditorium B" />
            </label>
            <label className="field">
              <span className="field__label">Capacity</span>
              <input className="input" type="number" name="capacity" min="1" value={form.capacity} onChange={onChange} required />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span className="field__label">Starts</span>
              <input className="input" type="datetime-local" name="startAt" value={form.startAt} onChange={onChange} required />
            </label>
            <label className="field">
              <span className="field__label">
                Ends <span className="field__hint">(optional)</span>
              </span>
              <input className="input" type="datetime-local" name="endAt" value={form.endAt} onChange={onChange} />
            </label>
          </div>

          <div className="field">
            <span className="field__label">
              Banner <span className="field__hint">— image URL or upload a file</span>
            </span>
            <input
              className="input"
              type="url"
              value={banner.startsWith('data:') ? '' : banner}
              onChange={onBannerUrl}
              placeholder="https://…/banner.jpg"
              disabled={banner.startsWith('data:')}
            />
            <input className="file" type="file" accept="image/*" onChange={onBannerFile} />
            {preview && <img className="logo-preview" style={{ width: '100%', height: 140 }} src={preview} alt="Banner preview" />}
          </div>

          <button type="submit" className="btn primary block" disabled={state === 'saving'}>
            {state === 'saving' ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
          </button>
        </form>
      )}
    </>
  );
}
