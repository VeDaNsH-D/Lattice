import React, { useCallback, useEffect, useState } from 'react';
import { GitFork, Sparkles, History } from 'lucide-react';

import { LatticeFrame } from './LatticeFrame';
import { getForkActivity } from '../services/latticeApi';
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

const getEventCopy = (event) => {
  if (event.type === 'forked_by_you') {
    return `You forked ${event.source?.name || 'a source lattice'}`;
  }

  if (event.type === 'forked_from_you') {
    return `${event.actor?.name || 'Someone'} forked your lattice ${event.source?.name || ''}`;
  }

  return `You updated fork ${event.project?.name || ''}`;
};

const getEventIcon = (type) => {
  if (type === 'updated_fork') {
    return <History size={15} />;
  }

  if (type === 'forked_from_you') {
    return <Sparkles size={15} />;
  }

  return <GitFork size={15} />;
};

export const LatticeActivityPage = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadActivity = useCallback(async () => {
    setErrorMessage('');

    try {
      const response = await getForkActivity();
      setEvents(Array.isArray(response?.events) ? response.events : []);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load recent activity.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadActivity();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadActivity]);

  return (
    <LatticeFrame>
      <div className="directory-container activity-page-container">
        <header className="activity-head">
          <h1>Recent Activity</h1>
          <p>Fork and remix history across repositories you forked and repositories forked from you.</p>
        </header>

        {isLoading ? <p className="directory-status">Loading activity...</p> : null}
        {errorMessage ? <p className="directory-status directory-status-error">{errorMessage}</p> : null}

        {!isLoading && !errorMessage && events.length === 0 ? (
          <div className="project-empty-state">
            <p>No recent fork activity.</p>
            <p>Fork a public lattice to start your activity feed.</p>
          </div>
        ) : null}

        {!isLoading && events.length > 0 ? (
          <section className="activity-feed-list">
            {events.map((event) => (
              <article key={event.id} className="activity-feed-item">
                <div className="activity-feed-icon">{getEventIcon(event.type)}</div>
                <div className="activity-feed-copy">
                  <p className="activity-feed-title">{getEventCopy(event)}</p>
                  <p className="activity-feed-meta">
                    Fork: {event.project?.name || '—'} • {formatDate(event.createdAt)}
                  </p>
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </LatticeFrame>
  );
};
