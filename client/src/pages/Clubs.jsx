import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listClubs } from '../services/clubs.js';
import { Icon } from '../components/Icons.jsx';

/**
 * Club directory. Lists every club with membership counts and the viewer's
 * relationship (member / lead / pending). Anyone logged in can browse and
 * create a club (self-service).
 */
export default function Clubs() {
  const [clubs, setClubs] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listClubs()
      .then((data) => active && (setClubs(data), setState('ready')))
      .catch((err) => active && (setError(err.message), setState('error')));
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="eyebrow">Community</div>
          <h1>Clubs</h1>
          <p>Browse student clubs and request to join — or start your own.</p>
        </div>
        <Link to="/clubs/new" className="btn primary">
          <Icon name="i-plus" /> Create club
        </Link>
      </div>

      {state === 'loading' && <p className="muted">Loading clubs…</p>}
      {state === 'error' && <p className="form-error">{error}</p>}
      {state === 'ready' && clubs.length === 0 && (
        <div className="empty-state">
          <p>No clubs yet. Be the first to create one!</p>
          <Link to="/clubs/new" className="btn primary" style={{ marginTop: 12 }}>
            <Icon name="i-plus" /> Create a club
          </Link>
        </div>
      )}

      <div className="club-grid">
        {clubs.map((club, i) => (
          <Link key={club.id} to={`/clubs/${club.id}`} className="club-card">
            <div className="club-card__head">
              {club.logoUrl ? (
                <img className="club-logo" src={club.logoUrl} alt="" />
              ) : (
                <span className={`club-logo club-logo--ph g${(i % 4) + 1}`}>
                  {club.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div>
                <h3 className="club-card__name">{club.name}</h3>
                <span className="chip soft">{club.category}</span>
              </div>
            </div>

            <p className="club-card__desc">{club.description || 'No description yet.'}</p>

            <div className="club-card__foot">
              <span>
                <Icon name="i-users" style={{ width: 14, height: 14, verticalAlign: '-2px' }} />{' '}
                {club.memberCount} member{club.memberCount === 1 ? '' : 's'}
              </span>
              {club.viewer?.isLead ? (
                <span className="chip role">Lead</span>
              ) : club.viewer?.isMember ? (
                <span className="chip live">Member</span>
              ) : club.viewer?.hasPendingRequest ? (
                <span className="chip soon">Requested</span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
