import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, Skull, ExternalLink } from 'lucide-react';

import { LatticeFrame } from './LatticeFrame';
import { listGraveyardLinks, restoreGraveyardLink } from '../services/latticeApi';
import './LatticePages.css';

const formatDate = (value) => {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString();
};

export const LatticeGraveyardPage = () => {
  const navigate = useNavigate();
  const [links, setLinks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [restoringId, setRestoringId] = useState('');

  const loadGraveyard = useCallback(async () => {
    setErrorMessage('');

    try {
      const response = await listGraveyardLinks();
      setLinks(Array.isArray(response?.links) ? response.links : []);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load graveyard links.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadGraveyard();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadGraveyard]);

  const onRestore = async (link) => {
    const linkId = link?._id || link?.id;
    if (!linkId || restoringId) {
      return;
    }

    setRestoringId(linkId);
    setErrorMessage('');

    try {
      await restoreGraveyardLink(linkId);
      setLinks((previous) => previous.filter((item) => String(item._id || item.id) !== String(linkId)));
    } catch (error) {
      setErrorMessage(error.message || 'Unable to restore link.');
    } finally {
      setRestoringId('');
    }
  };

  return (
    <LatticeFrame>
      <div className="directory-container graveyard-page-container">
        <header className="graveyard-head">
          <div>
            <p className="graveyard-kicker">Recoverable area</p>
            <h1>Compost Heap</h1>
            <p>Dead or manually deleted links live here and can be restored.</p>
          </div>
        </header>

        {isLoading ? <p className="directory-status">Loading graveyard...</p> : null}
        {errorMessage ? <p className="directory-status directory-status-error">{errorMessage}</p> : null}

        {!isLoading && !errorMessage && links.length === 0 ? (
          <div className="project-empty-state">
            <p>Graveyard is empty.</p>
            <p>No dead or deleted links to recover right now.</p>
          </div>
        ) : null}

        {!isLoading && links.length > 0 ? (
          <section className="graveyard-grid">
            {links.map((link) => {
              const linkId = link._id || link.id;
              const title = link.title || link.url;

              return (
                <article key={linkId} className="graveyard-card">
                  <div className="graveyard-card-top">
                    <span className="graveyard-reason-pill">
                      <Skull size={13} /> {link.graveyardReason === 'deleted' ? 'Deleted' : 'Expired'}
                    </span>
                    <span className="graveyard-project-pill">
                      {link.project?.name || 'Unknown project'}
                    </span>
                  </div>

                  <h3>{title}</h3>
                  <p className="graveyard-link-url">{link.url}</p>

                  <dl className="graveyard-meta-grid">
                    <div>
                      <dt>Last viewed</dt>
                      <dd>{formatDate(link.lastViewedAt)}</dd>
                    </div>
                    <div>
                      <dt>Last modified</dt>
                      <dd>{formatDate(link.lastModifiedAt)}</dd>
                    </div>
                    <div>
                      <dt>Moved to graveyard</dt>
                      <dd>{formatDate(link.movedToCompostAt || link.deletedAt)}</dd>
                    </div>
                  </dl>

                  <div className="graveyard-actions">
                    <button
                      type="button"
                      className="graveyard-restore-btn"
                      onClick={() => void onRestore(link)}
                      disabled={restoringId === linkId}
                    >
                      <RotateCcw size={14} />
                      {restoringId === linkId ? 'Restoring...' : 'Restore link'}
                    </button>

                    <button
                      type="button"
                      className="graveyard-open-project-btn"
                      onClick={() => {
                        if (link.project?.id) {
                          navigate(`/lattice/project/${link.project.id}`, {
                            state: {
                              projectName: link.project.name,
                              projectType: link.project.projectType,
                            },
                          });
                        }
                      }}
                      disabled={!link.project?.id}
                    >
                      Open project <ExternalLink size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}
      </div>
    </LatticeFrame>
  );
};