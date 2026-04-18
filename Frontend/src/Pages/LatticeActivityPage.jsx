import React, { useCallback, useEffect, useState } from 'react';
import { GitFork, Sparkles, History, Link as LinkIcon, MessageSquare, CheckCheck, UserPlus, FolderPlus, Trash2, RotateCcw, SmilePlus, Radio } from 'lucide-react';

import { LatticeFrame } from './LatticeFrame';
import { getForkActivity } from '../services/latticeApi';
import './LatticePages.css';

const LAST_SEEN_STORAGE_KEY = 'latticeActivityLastSeenAt';

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
  if (event.type === 'collaborator_invited') {
    const roleName = event.payload?.roleName ? ` as ${event.payload.roleName}` : '';
    const inviteeEmail = event.payload?.inviteeEmail || 'a collaborator';
    return `${event.actor?.isYou ? 'You' : event.actor?.name || 'Someone'} invited ${inviteeEmail}${roleName}`;
  }

  if (event.type === 'project_created') {
    const projectName = event.payload?.projectName || event.project?.name || 'a lattice';
    return `${event.actor?.isYou ? 'You' : event.actor?.name || 'Someone'} created ${projectName}`;
  }

  if (event.type === 'link_deleted') {
    const title = event.link?.title || event.payload?.title || 'a link';
    return `${event.actor?.isYou ? 'You' : event.actor?.name || 'Someone'} removed ${title}`;
  }

  if (event.type === 'link_restored') {
    const title = event.link?.title || event.payload?.title || 'a link';
    return `${event.actor?.isYou ? 'You' : event.actor?.name || 'Someone'} restored ${title}`;
  }

  if (event.type === 'reaction_updated') {
    const title = event.link?.title || event.payload?.title || 'a link';
    const action = event.payload?.action === 'removed' ? 'removed' : 'added';
    const emoji = event.payload?.emoji || 'a reaction';
    return `${event.actor?.isYou ? 'You' : event.actor?.name || 'Someone'} ${action} ${emoji} on ${title}`;
  }

  if (event.type === 'collaborator_joined_room') {
    return `${event.actor?.isYou ? 'You' : event.actor?.name || 'Someone'} joined the collaboration room`;
  }

  if (event.type === 'collaborator_sent_chat') {
    return `${event.actor?.isYou ? 'You' : event.actor?.name || 'Someone'} sent a collaboration message`;
  }

  if (event.type === 'bookmarks_imported') {
    const count = Number(event.payload?.importedCount) || 0;
    return `${event.actor?.isYou ? 'You' : event.actor?.name || 'Someone'} imported ${count} bookmark${count === 1 ? '' : 's'}`;
  }

  if (event.type === 'role_created') {
    return `${event.actor?.isYou ? 'You' : event.actor?.name || 'Someone'} created role ${event.payload?.roleName || 'new role'}`;
  }

  if (event.type === 'collaborator_added') {
    const collaborator = event.payload?.collaboratorName || 'a collaborator';
    return `${collaborator} joined as a collaborator`;
  }

  if (event.type === 'link_added') {
    return `${event.actor?.isYou ? 'You' : event.actor?.name || 'Someone'} added ${event.link?.title || 'a link'}`;
  }

  if (event.type === 'comment_added') {
    return `${event.actor?.isYou ? 'You' : event.actor?.name || 'Someone'} commented on ${event.link?.title || 'a link'}`;
  }

  if (event.type === 'comment_resolved') {
    return `${event.actor?.isYou ? 'You' : event.actor?.name || 'Someone'} resolved a comment on ${event.link?.title || 'a link'}`;
  }

  if (event.type === 'member_joined') {
    return `${event.actor?.isYou ? 'You' : event.actor?.name || 'Someone'} joined ${event.project?.name || 'a lattice'}`;
  }

  if (event.type === 'forked_by_you') {
    return `You forked ${event.source?.name || 'a source lattice'}`;
  }

  if (event.type === 'forked_from_you') {
    return `${event.actor?.name || 'Someone'} forked your lattice ${event.source?.name || ''}`;
  }

  return `You updated fork ${event.project?.name || ''}`;
};

const getEventIcon = (type) => {
  if (type === 'collaborator_invited') {
    return <UserPlus size={15} />;
  }

  if (type === 'project_created') {
    return <FolderPlus size={15} />;
  }

  if (type === 'link_deleted') {
    return <Trash2 size={15} />;
  }

  if (type === 'link_restored') {
    return <RotateCcw size={15} />;
  }

  if (type === 'reaction_updated') {
    return <SmilePlus size={15} />;
  }

  if (type === 'collaborator_joined_room' || type === 'collaborator_sent_chat') {
    return <Radio size={15} />;
  }

  if (type === 'bookmarks_imported') {
    return <History size={15} />;
  }

  if (type === 'role_created') {
    return <Sparkles size={15} />;
  }

  if (type === 'collaborator_added') {
    return <UserPlus size={15} />;
  }

  if (type === 'link_added') {
    return <LinkIcon size={15} />;
  }

  if (type === 'comment_added') {
    return <MessageSquare size={15} />;
  }

  if (type === 'comment_resolved') {
    return <CheckCheck size={15} />;
  }

  if (type === 'member_joined') {
    return <UserPlus size={15} />;
  }

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
  const [lastSeenAt, setLastSeenAt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadActivity = useCallback(async () => {
    setErrorMessage('');
    setIsLoading(true);

    let previousLastSeen = null;
    try {
      previousLastSeen = window.localStorage.getItem(LAST_SEEN_STORAGE_KEY);
    } catch (error) {
      previousLastSeen = null;
    }

    setLastSeenAt(previousLastSeen || null);

    try {
      const response = await getForkActivity();
      setEvents(Array.isArray(response?.events) ? response.events : []);

      try {
        window.localStorage.setItem(LAST_SEEN_STORAGE_KEY, new Date().toISOString());
        window.dispatchEvent(new CustomEvent('lattice:activity-seen'));
      } catch (error) {
        // Ignore storage write failures.
      }
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load recent activity.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const feedRows = (() => {
    if (!Array.isArray(events) || events.length === 0) {
      return [];
    }

    const cutoff = lastSeenAt ? new Date(lastSeenAt) : null;
    const hasValidCutoff = cutoff && !Number.isNaN(cutoff.getTime());
    let markerInserted = false;
    const rows = [];

    for (const event of events) {
      const eventDate = new Date(event.createdAt);
      const isNew = hasValidCutoff ? eventDate.getTime() > cutoff.getTime() : false;

      if (!isNew && hasValidCutoff && !markerInserted) {
        rows.push({ kind: 'marker', id: 'since-last-seen-marker' });
        markerInserted = true;
      }

      rows.push({ kind: 'event', id: event.id, event, isNew });
    }

    return rows;
  })();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadActivity();
    }, 0);

    const poller = window.setInterval(() => {
      void loadActivity();
    }, 15000);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poller);
    };
  }, [loadActivity]);

  return (
    <LatticeFrame>
      <div className="directory-container activity-page-container">
        <header className="activity-head">
          <h1>Recent Activity</h1>
          <p>Cross-project updates from you and collaborators, grouped by what happened while you were away.</p>
        </header>

        {isLoading ? <p className="directory-status">Loading activity...</p> : null}
        {errorMessage ? <p className="directory-status directory-status-error">{errorMessage}</p> : null}

        {!isLoading && !errorMessage && events.length === 0 ? (
          <div className="project-empty-state">
            <p>No recent activity in this window.</p>
            <p>Come back after new collaboration updates.</p>
          </div>
        ) : null}

        {!isLoading && feedRows.length > 0 ? (
          <section className="activity-feed-list">
            {feedRows.map((row) => {
              if (row.kind === 'marker') {
                return (
                  <div key={row.id} className="activity-since-last-seen">
                    <span>Seen before this point</span>
                  </div>
                );
              }

              const { event, isNew } = row;

              return (
                <article key={row.id} className="activity-feed-item">
                  <div className="activity-feed-icon">{getEventIcon(event.type)}</div>
                  <div className="activity-feed-copy">
                    <p className="activity-feed-title">
                      {getEventCopy(event)}
                      {isNew ? <span className="activity-new-pill">NEW</span> : null}
                    </p>
                    <p className="activity-feed-meta">
                      Lattice: {event.project?.name || '—'} • {formatDate(event.createdAt)}
                    </p>
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
