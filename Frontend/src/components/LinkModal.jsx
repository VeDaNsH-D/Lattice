import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, CircleUserRound, ExternalLink, RotateCcw, X } from 'lucide-react';
import { apiRequest } from '../utils/api';

const getCommentList = (payload) => {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (Array.isArray(payload?.comments)) {
        return payload.comments;
    }

    return [];
};

const formatTimestamp = (value) => {
    if (!value) {
        return 'Just now';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Just now';
    }

    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
};

const formatRelativeTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Unknown time';
    }

    const diffMs = Date.now() - date.getTime();
    const minuteMs = 60 * 1000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;

    if (diffMs < minuteMs) {
        return 'just now';
    }

    if (diffMs < hourMs) {
        const minutes = Math.max(1, Math.floor(diffMs / minuteMs));
        return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }

    if (diffMs < dayMs) {
        const hours = Math.max(1, Math.floor(diffMs / hourMs));
        return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }

    const days = Math.max(1, Math.floor(diffMs / dayMs));
    return `${days} day${days === 1 ? '' : 's'} ago`;
};

const getTrendUi = (trendValue) => {
    const trend = String(trendValue || '').trim().toLowerCase();

    if (trend === 'rapid evolution') {
        return {
            icon: '🔴',
            label: 'Intense',
            className: 'context-feed-trend-intense',
        };
    }

    if (trend === 'evolving') {
        return {
            icon: '🟡',
            label: 'Active',
            className: 'context-feed-trend-active',
        };
    }

    return {
        icon: '🟢',
        label: 'Calm',
        className: 'context-feed-trend-calm',
    };
};

const normalizeSummaryForGrouping = (value) => {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
};

const buildCompactedSnapshotLogs = (snapshots) => {
    const compacted = [];

    snapshots.forEach((snapshot) => {
        const changeLevel = String(snapshot?.change_level || '').toLowerCase();
        const summary = String(snapshot?.summary || '').trim();
        const summaryKey = normalizeSummaryForGrouping(summary);
        const previous = compacted[compacted.length - 1];

        const canGroupWithPrevious =
            previous &&
            previous.change_level === 'none' &&
            changeLevel === 'none' &&
            previous.summaryKey === summaryKey;

        if (canGroupWithPrevious) {
            previous.grouped_count += 1;
            previous.oldest_timestamp = snapshot?.timestamp || previous.oldest_timestamp;
            return;
        }

        compacted.push({
            ...snapshot,
            grouped_count: 1,
            oldest_timestamp: snapshot?.timestamp,
            summaryKey,
        });
    });

    return compacted;
};

const SUMMARY_PREVIEW_MAX_CHARS = 180;

const truncateSummary = (text, maxChars = SUMMARY_PREVIEW_MAX_CHARS) => {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();

    if (normalized.length <= maxChars) {
        return {
            preview: normalized,
            isTruncated: false,
        };
    }

    return {
        preview: `${normalized.slice(0, maxChars).trimEnd()}...`,
        isTruncated: true,
    };
};

export default function LinkModal({ link, contextFeed, onRefreshContextFeed, onClose }) {
    const [comments, setComments] = useState([]);
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [commentsError, setCommentsError] = useState('');
    const [commentText, setCommentText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [resolvingCommentId, setResolvingCommentId] = useState('');
    const [isClosing, setIsClosing] = useState(false);
    const [isShowingFullLog, setIsShowingFullLog] = useState(false);
    const [expandedSummaryRows, setExpandedSummaryRows] = useState({});
    const commentsEndRef = useRef(null);
    const closeTimeoutRef = useRef(null);

    const linkId = link?._id || link?.id;

    const tags = useMemo(() => {
        if (Array.isArray(link?.tags)) {
            return link.tags.filter(Boolean);
        }

        if (typeof link?.tags === 'string') {
            return link.tags
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean);
        }

        return [];
    }, [link?.tags]);

    const timelineEvents = useMemo(() => {
        const events = Array.isArray(contextFeed?.events) ? contextFeed.events : [];
        return [...events].sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime());
    }, [contextFeed?.events]);

    const timelineInsights = contextFeed?.insights || {
        total_changes: timelineEvents.length,
        major_changes: timelineEvents.filter((event) => event?.type === 'major').length,
        minor_changes: timelineEvents.filter((event) => event?.type === 'minor').length,
        trend: 'stable',
    };

    const snapshotLogs = useMemo(() => {
        const snapshots = Array.isArray(contextFeed?.snapshots) ? contextFeed.snapshots : [];
        return [...snapshots].sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime());
    }, [contextFeed?.snapshots]);

    const compactedSnapshotLogs = useMemo(() => {
        return buildCompactedSnapshotLogs(snapshotLogs);
    }, [snapshotLogs]);

    const sinceLastSeen = contextFeed?.sinceLastSeen || { major: 0, minor: 0 };
    const sinceMajor = Number(sinceLastSeen?.major || 0);
    const sinceMinor = Number(sinceLastSeen?.minor || 0);
    const hasSinceLastSeen = sinceMajor > 0 || sinceMinor > 0;
    const trendUi = getTrendUi(timelineInsights?.trend);
    const visibleSnapshots = isShowingFullLog
        ? snapshotLogs
        : compactedSnapshotLogs.slice(0, 4);

    useEffect(() => {
        setIsShowingFullLog(false);
        setExpandedSummaryRows({});
    }, [linkId]);

    const toggleSummaryRowExpansion = (rowKey) => {
        setExpandedSummaryRows((previous) => ({
            ...previous,
            [rowKey]: !previous[rowKey],
        }));
    };

    useEffect(() => {
        if (!linkId) {
            setComments([]);
            return;
        }

        let isMounted = true;

        const fetchComments = async () => {
            setIsLoadingComments(true);
            setCommentsError('');

            try {
                const payload = await apiRequest(`/comments/links/${linkId}`, {
                    method: 'GET',
                });

                if (!isMounted) {
                    return;
                }

                setComments(getCommentList(payload));
            } catch (error) {
                if (!isMounted) {
                    return;
                }

                setCommentsError(error?.message || 'Unable to load comments.');
                setComments([]);
            } finally {
                if (isMounted) {
                    setIsLoadingComments(false);
                }
            }
        };

        fetchComments();

        return () => {
            isMounted = false;
        };
    }, [linkId]);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    const handleClose = useCallback(() => {
        if (isClosing) {
            return;
        }

        setIsClosing(true);
        closeTimeoutRef.current = window.setTimeout(() => {
            onClose();
        }, 180);
    }, [isClosing, onClose]);

    useEffect(() => {
        const onEscape = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                handleClose();
            }
        };

        window.addEventListener('keydown', onEscape);
        return () => {
            window.removeEventListener('keydown', onEscape);
        };
    }, [handleClose]);

    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [comments]);

    useEffect(() => {
        return () => {
            if (closeTimeoutRef.current) {
                window.clearTimeout(closeTimeoutRef.current);
            }
        };
    }, []);

    const handleOverlayMouseDown = (event) => {
        if (event.target === event.currentTarget) {
            handleClose();
        }
    };

    const submitComment = async () => {
        const trimmed = commentText.trim();
        if (!trimmed || !linkId || isSending) {
            return;
        }

        setIsSending(true);

        try {
            const payload = await apiRequest(`/comments/links/${linkId}`, {
                method: 'POST',
                body: JSON.stringify({
                    projectId: link?.projectId,
                    text: trimmed,
                }),
            });

            const created = payload?.comment || payload?.data || payload;
            const optimisticComment = {
                _id: created?._id || `temp-${Date.now()}`,
                text: created?.text || trimmed,
                createdAt: created?.createdAt || new Date().toISOString(),
                user: created?.user,
                userName: created?.userName,
            };

            setComments((previous) => [...previous, optimisticComment]);
            setCommentText('');
        } catch (error) {
            setCommentsError(error?.message || 'Unable to send comment.');
        } finally {
            setIsSending(false);
        }
    };

    const toggleResolve = async (comment) => {
        const commentId = comment?._id || comment?.id;
        if (!commentId || resolvingCommentId) {
            return;
        }

        setResolvingCommentId(commentId);

        try {
            const payload = await apiRequest(`/comments/${commentId}/resolve`, {
                method: 'PATCH',
                body: JSON.stringify({
                    projectId: link?.projectId,
                    resolved: !comment.resolved,
                }),
            });

            const updated = payload?.comment || payload?.data || payload;
            if (updated) {
                setComments((previous) => previous.map((item) => {
                    const itemId = item._id || item.id;
                    if (String(itemId) !== String(commentId)) {
                        return item;
                    }

                    return updated;
                }));
            }
        } catch (error) {
            setCommentsError(error?.message || 'Unable to update comment resolution.');
        } finally {
            setResolvingCommentId('');
        }
    };

    const handleInputKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void submitComment();
        }
    };

    if (!link) {
        return null;
    }

    const summary = link.summary || 'No AI summary available for this bookmark yet.';
    const title = link.title || link.url || 'Untitled link';
    const description = link.description || 'No description available.';
    const source = link.url || '';
    const createdLabel = link.createdAt ? formatTimestamp(link.createdAt) : '';

    const modalContent = (
        <div
            className={`link-modal-overlay ${isClosing ? 'is-closing' : ''}`}
            onMouseDown={handleOverlayMouseDown}
            aria-modal="true"
            role="dialog"
        >
            <div
                className={`link-modal-shell ${isClosing ? 'is-closing' : ''}`}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="link-modal-header">
                    <div className="link-modal-heading-wrap">
                        <h2 className="link-modal-title">{title}</h2>
                        {createdLabel ? <p className="link-modal-created">Added {createdLabel}</p> : null}
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="link-modal-close-btn"
                        aria-label="Close modal"
                    >
                        <X size={18} />
                    </button>
                </header>

                <div className="link-modal-body">
                    {link.image ? (
                        <div className="link-modal-image-wrap">
                            <img src={link.image} alt={title} className="link-modal-image" loading="lazy" />
                        </div>
                    ) : null}

                    <section className="link-modal-meta">
                        <p className="link-modal-description">{description}</p>
                        {source ? (
                            <a
                                href={source}
                                target="_blank"
                                rel="noreferrer"
                                className="link-modal-source-link"
                            >
                                Visit source
                                <ExternalLink size={14} />
                            </a>
                        ) : null}
                    </section>

                    <section className="link-modal-summary-box">
                        <p className="link-modal-section-label">AI Summary</p>
                        <p className="link-modal-summary-text">{summary}</p>
                    </section>

                    {tags.length ? (
                        <section className="link-modal-tags-section">
                            <p className="link-modal-section-label">Tags</p>
                            <div className="link-modal-tags-list">
                                {tags.map((tag) => (
                                    <span key={tag} className="link-modal-tag-pill">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <section className="link-modal-context-feed-section">
                        <div className="link-modal-context-feed-card">
                            <div className="link-modal-context-feed-head">
                                <p className="link-modal-section-label">Context Feed</p>
                                <button
                                    type="button"
                                    className="context-feed-refresh-btn"
                                    onClick={() => onRefreshContextFeed?.({ triggerSnapshot: true })}
                                    disabled={Boolean(contextFeed?.isLoading)}
                                >
                                    {contextFeed?.isLoading ? 'Refreshing...' : 'Refresh'}
                                </button>
                            </div>

                            <div className="context-feed-summary-row">
                                <span className={`context-feed-trend-pill ${trendUi.className}`}>
                                    <span aria-hidden="true">{trendUi.icon}</span>
                                    <span>{trendUi.label}</span>
                                </span>
                                <p className="context-feed-summary-text">
                                    {Number(timelineInsights?.major_changes || 0)} Major Changes • {Number(timelineInsights?.minor_changes || 0)} Minor Updates
                                </p>
                            </div>

                            {hasSinceLastSeen ? (
                                <div className="context-feed-since-section">
                                    <p>Since your last visit:</p>
                                    {sinceMajor > 0 ? <p>• {sinceMajor} major update{sinceMajor === 1 ? '' : 's'}</p> : null}
                                    {sinceMinor > 0 ? <p>• {sinceMinor} minor update{sinceMinor === 1 ? '' : 's'}</p> : null}
                                </div>
                            ) : null}

                            <div className="context-feed-insights-row">
                                <span>Total Changes: {Number(timelineInsights?.total_changes || 0)}</span>
                                <span>Major: {Number(timelineInsights?.major_changes || 0)} | Minor: {Number(timelineInsights?.minor_changes || 0)}</span>
                            </div>
                        </div>

                        <div className="context-feed-log-wrap">
                            <div className="context-feed-log-head">
                                <p className="link-modal-section-label">Summary Changes</p>
                                <button
                                    type="button"
                                    className="context-feed-toggle-btn"
                                    onClick={() => setIsShowingFullLog((previous) => !previous)}
                                >
                                    {isShowingFullLog ? 'Show compact view' : 'View full log'}
                                </button>
                            </div>

                            {contextFeed?.error ? <p className="context-feed-error">{contextFeed.error}</p> : null}

                            {!contextFeed?.error && visibleSnapshots.length === 0 ? (
                                <p className="context-feed-empty">No checks recorded yet</p>
                            ) : null}

                            {!contextFeed?.error && visibleSnapshots.length > 0 ? (
                                <div className="context-feed-flow-list">
                                    {visibleSnapshots.map((snapshot, index) => {
                                        const eventType = String(snapshot?.change_level || '').toLowerCase();
                                        const isMajor = eventType === 'major';
                                        const isMinor = eventType === 'minor';
                                        const summaryText = String(snapshot?.summary || '').trim() || 'Summary unavailable for this check.';
                                        const checkedAt = snapshot?.timestamp;
                                        const groupedCount = Number(snapshot?.grouped_count || 1);
                                        const rowKey = snapshot?.id || `${snapshot?.timestamp}-${index}`;
                                        const { preview, isTruncated } = truncateSummary(summaryText);
                                        const isExpanded = Boolean(expandedSummaryRows[rowKey]);
                                        const displaySummary = isShowingFullLog || isExpanded ? summaryText : preview;

                                        return (
                                            <article key={rowKey} className="context-feed-flow-item">
                                                <span
                                                    className={`context-feed-flow-dot ${isMajor ? 'context-feed-flow-dot-major' : 'context-feed-flow-dot-minor'}`}
                                                    aria-hidden="true"
                                                />
                                                <div className="context-feed-flow-card">
                                                    <p className="context-feed-flow-check-time">
                                                        Checked at {formatTimestamp(checkedAt)}
                                                    </p>
                                                    {!isShowingFullLog && groupedCount > 1 ? (
                                                        <p className="context-feed-flow-compact-note">
                                                            {groupedCount} repeated no-significant checks merged
                                                        </p>
                                                    ) : null}
                                                    <p className={`context-feed-flow-type ${isMajor ? 'context-feed-flow-type-major' : isMinor ? 'context-feed-flow-type-minor' : 'context-feed-flow-type-none'}`}>
                                                        {isMajor ? 'Major update detected' : isMinor ? 'Minor update detected' : 'No significant update'}
                                                    </p>
                                                    <p className="context-feed-flow-description">Summary: {displaySummary}</p>
                                                    {!isShowingFullLog && isTruncated ? (
                                                        <button
                                                            type="button"
                                                            className="context-feed-summary-toggle"
                                                            onClick={() => toggleSummaryRowExpansion(rowKey)}
                                                        >
                                                            {isExpanded ? 'Show less' : 'View full text'}
                                                        </button>
                                                    ) : null}
                                                    <p className="context-feed-flow-time">{formatRelativeTime(checkedAt)}</p>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>
                    </section>

                    <section className="link-modal-comments-section">
                        <div className="link-modal-comments-header">
                            <p className="link-modal-comments-title">Comments</p>
                            {isLoadingComments ? <p className="link-modal-comments-loading">Loading...</p> : null}
                        </div>

                        <div className="link-modal-comments-list">
                            {commentsError ? <p className="link-modal-comments-error">{commentsError}</p> : null}

                            {!commentsError && !isLoadingComments && comments.length === 0 ? (
                                <p className="link-modal-comments-empty">No comments yet. Start the discussion.</p>
                            ) : null}

                            {comments.map((comment) => {
                                const commentId = comment._id || comment.id || `${comment.text}-${comment.createdAt}`;
                                const label = comment.user?.name || comment.userName || 'User';
                                const avatarUrl = comment.user?.avatarUrl || '';
                                const initials = label.slice(0, 1).toUpperCase();

                                return (
                                    <article
                                        key={commentId}
                                        className={`link-modal-comment-card ${comment.resolved ? 'is-resolved' : ''}`}
                                    >
                                        <div className="link-modal-comment-avatar-col">
                                            <span className="link-modal-comment-avatar">
                                                {avatarUrl ? <img src={avatarUrl} alt={label} /> : <CircleUserRound size={15} />}
                                            </span>
                                        </div>

                                        <div className="link-modal-comment-body">
                                            <div className="link-modal-comment-topline">
                                                <p className="link-modal-comment-meta">{label} • {formatTimestamp(comment.createdAt)}</p>
                                                {comment.resolved ? (
                                                    <span className="link-modal-comment-resolved-badge">
                                                        <CheckCircle2 size={12} /> Resolved
                                                    </span>
                                                ) : null}
                                            </div>

                                            <p className="link-modal-comment-text">{comment.text}</p>

                                            <button
                                                type="button"
                                                className="link-modal-comment-resolve-btn"
                                                onClick={() => void toggleResolve(comment)}
                                                disabled={resolvingCommentId === commentId}
                                            >
                                                {comment.resolved ? <RotateCcw size={13} /> : <CheckCircle2 size={13} />}
                                                {resolvingCommentId === commentId
                                                    ? 'Updating...'
                                                    : comment.resolved
                                                        ? 'Unresolve'
                                                        : 'Resolve'}
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                            <div ref={commentsEndRef} />
                        </div>

                        <div className="link-modal-comment-input-row">
                            <input
                                type="text"
                                value={commentText}
                                onChange={(event) => setCommentText(event.target.value)}
                                onKeyDown={handleInputKeyDown}
                                placeholder="Write a comment..."
                                className="link-modal-comment-input"
                                disabled={isSending}
                                maxLength={400}
                            />
                            <button
                                type="button"
                                onClick={() => void submitComment()}
                                disabled={!commentText.trim() || isSending}
                                className="link-modal-comment-send"
                            >
                                {isSending ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
