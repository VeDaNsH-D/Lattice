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

export default function LinkModal({ link, onClose }) {
    const [comments, setComments] = useState([]);
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [commentsError, setCommentsError] = useState('');
    const [commentText, setCommentText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [resolvingCommentId, setResolvingCommentId] = useState('');
    const [isClosing, setIsClosing] = useState(false);
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
