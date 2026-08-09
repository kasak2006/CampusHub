import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createClub, getClub, updateClub } from '../services/clubs.js';
import { Icon } from '../components/Icons.jsx';

/**
 * Create or edit a club. Edit mode when a :id param is present. Logo can be an
 * image URL or a file read to a data URI (uploaded to Cloudinary server-side
 * when configured).
 */
export default function ClubForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', description: '', category: '' });
  const [logo, setLogo] = useState('');
  const [preview, setPreview] = useState('');
  const [state, setState] = useState(isEdit ? 'loading' : 'idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    getClub(id)
      .then((club) => {
        if (!active) return;
        setForm({
          name: club.name,
          description: club.description ?? '',
          category: club.category ?? '',
        });
        setPreview(club.logoUrl ?? '');
        setState('idle');
      })
      .catch((err) => active && (setError(err.message), setState('idle')));
    return () => {
      active = false;
    };
  }, [id, isEdit]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onLogoUrl = (e) => {
    setLogo(e.target.value);
    setPreview(e.target.value);
  };

  const onLogoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLogo(reader.result);
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setState('saving');
    setError('');
    const payload = { ...form };
    if (logo) payload.logo = logo;
    try {
      const club = isEdit ? await updateClub(id, payload) : await createClub(payload);
      navigate(`/clubs/${club.id}`);
    } catch (err) {
      setError(err.message || 'Could not save club.');
      setState('idle');
    }
  };

  if (state === 'loading') return <div className="loading">Loading…</div>;

  return (
    <>
      <Link to={isEdit ? `/clubs/${id}` : '/clubs'} className="back-link">
        <Icon name="i-back" /> Back
      </Link>

      <div className="pagehead" style={{ marginTop: 14 }}>
        <div>
          <div className="eyebrow">{isEdit ? 'Edit' : 'New'}</div>
          <h1>{isEdit ? 'Edit club' : 'Create a club'}</h1>
          <p>
            {isEdit
              ? 'Update your club profile.'
              : "You'll automatically become the club's first lead."}
          </p>
        </div>
      </div>

      <form className="card" style={{ maxWidth: 560 }} onSubmit={onSubmit}>
        {error && <p className="form-error">{error}</p>}

        <label className="field">
          <span className="field__label">Club name</span>
          <input
            className="input"
            type="text"
            name="name"
            value={form.name}
            onChange={onChange}
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Category</span>
          <input
            className="input"
            type="text"
            name="category"
            value={form.category}
            onChange={onChange}
            placeholder="e.g. Technology, Arts, Sports"
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
            placeholder="What is your club about?"
          />
        </label>

        <div className="field">
          <span className="field__label">
            Logo <span className="field__hint">— image URL or upload a file</span>
          </span>
          <input
            className="input"
            type="url"
            value={logo.startsWith('data:') ? '' : logo}
            onChange={onLogoUrl}
            placeholder="https://…/logo.png"
            disabled={logo.startsWith('data:')}
          />
          <input className="file" type="file" accept="image/*" onChange={onLogoFile} />
          {preview && <img className="logo-preview" src={preview} alt="Logo preview" />}
        </div>

        <button type="submit" className="btn primary block" disabled={state === 'saving'}>
          {state === 'saving' ? 'Saving…' : isEdit ? 'Save changes' : 'Create club'}
        </button>
      </form>
    </>
  );
}
