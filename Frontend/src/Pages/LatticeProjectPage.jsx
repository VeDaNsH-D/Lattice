import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
    ExternalLink,
    ImageOff,
    ArrowLeft,
    Plus,
    ChevronDown,
    UserPlus,
    Trash2,
    SmilePlus,
    PanelRightOpen,
    PanelRightClose,
    Shield,
    Users,
    MessageCircle,
} from 'lucide-react';
import { Network } from 'lucide-react';
import { LatticeFrame } from './LatticeFrame';
import { ProjectRealtimePanel } from './ProjectRealtimePanel';
import ProjectBookmarkImport from '../components/ProjectBookmarkImport';
import LinkModal from '../components/LinkModal';
import { apiRequest } from '../utils/api';
import { markLinkViewed } from '../services/latticeApi';
import { formatVibeLabel, getVibeTheme } from '../utils/vibeTheme';
import './LatticePages.css';

const BOOKMARK_SIGNAL_KEY = 'bookmarkSaveSignal';

const formatDate = (value) => {
    if (!value) {
        return '—';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return '—';
    }

    return parsed.toLocaleDateString();
};

const ENRICHMENT_PENDING_WINDOW_MS = 15 * 60 * 1000;

function isLinkEnrichmentPending(link) {
    if (!link || link.collisionCheckedAt) {
        return false;
    }

    const createdAt = new Date(link.createdAt || link.updatedAt || 0).getTime();
    if (!createdAt || Number.isNaN(createdAt)) {
        return false;
    }

    const isRecent = Date.now() - createdAt <= ENRICHMENT_PENDING_WINDOW_MS;
    if (!isRecent) {
        return false;
    }

    const hasSummary = Boolean(link.summary && String(link.summary).trim());
    const hasImage = Boolean(link.image && String(link.image).trim());
    const hasTags = Array.isArray(link.tags) && link.tags.length > 0;

    return !hasSummary || !hasImage || !hasTags;
}

function getLinkKey(link) {
    return link?._id || link?.id || link?.url || '';
}

function normalizeTrendLabel(value) {
    const trend = String(value || '').trim().toLowerCase();

    if (trend === 'rapid evolution') {
        return 'Intense';
    }

    if (trend === 'evolving') {
        return 'Active';
    }

    return 'Calm';
}

function getTrendClassName(value) {
    const trend = String(value || '').trim().toLowerCase();

    if (trend === 'rapid evolution') {
        return 'bookmark-status-badge-trend-intense';
    }

    if (trend === 'evolving') {
        return 'bookmark-status-badge-trend-active';
    }

    return 'bookmark-status-badge-trend-calm';
}

export const LatticeProjectPage = () => {
    const reactionOptions = ['👍', '🔥', '❤️', '😂', '👏', '🤯'];
    const { projectId } = useParams();
    const location = useLocation();
    const pendingOpenLinkIdRef = useRef(location.state?.openLinkId || '');
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') : '';
    const [links, setLinks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [projectType, setProjectType] = useState(location.state?.projectType || null);
    const [resolvedProjectName, setResolvedProjectName] = useState(location.state?.projectName || null);
    const [newBookmarkUrl, setNewBookmarkUrl] = useState('');
    const [accessType, setAccessType] = useState('public');
    const [selectedRoleIds, setSelectedRoleIds] = useState([]);
    const [roles, setRoles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');
    const [newRoleName, setNewRoleName] = useState('');
    const [newRolePermission, setNewRolePermission] = useState('view_only');
    const [isCreatingRole, setIsCreatingRole] = useState(false);
    const [roleFormError, setRoleFormError] = useState('');
    const [roleFormSuccess, setRoleFormSuccess] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRoleId, setInviteRoleId] = useState('');
    const [isInvitingUser, setIsInvitingUser] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [inviteSuccess, setInviteSuccess] = useState('');
    const [deletingLinkId, setDeletingLinkId] = useState('');
    const [reactionPickerLinkId, setReactionPickerLinkId] = useState('');
    const [reactingLinkId, setReactingLinkId] = useState('');
    const [selectedLink, setSelectedLink] = useState(null);
    const [projectOwnerId, setProjectOwnerId] = useState('');
    const [currentUserId, setCurrentUserId] = useState('');
    const [selectedRoleFilterId, setSelectedRoleFilterId] = useState('all');
    const [onlineParticipants, setOnlineParticipants] = useState([]);
    const [isCollabPaneExpanded, setIsCollabPaneExpanded] = useState(false);
    const [timelineByLinkId, setTimelineByLinkId] = useState({});
    const isRefreshingLinksRef = useRef(false);
    const timelineInFlightRef = useRef(new Set());
    const [projectMembers, setProjectMembers] = useState([]);
    const [isMembersLoading, setIsMembersLoading] = useState(false);

    const projectName = useMemo(() => {
        if (typeof resolvedProjectName === 'string' && resolvedProjectName.trim()) {
            return resolvedProjectName.trim();
        }

        const stateName = location.state?.projectName;
        if (typeof stateName === 'string' && stateName.trim()) {
            return stateName.trim();
        }

        return 'Project';
    }, [location.state, resolvedProjectName]);

    const isCollaborativeProject = projectType === 'collaborative';
    const effectiveAccessType = isCollaborativeProject ? accessType : 'public';
    const effectiveInviteRoleId = roles.some((role) => role.id === inviteRoleId)
        ? inviteRoleId
        : (roles[0]?.id || '');

    const loadProjectLinks = useCallback(async (options = {}) => {
        const { silent = false } = options;

        if (!projectId) {
            setErrorMessage('Project not found.');
            setIsLoading(false);
            return;
        }

        if (isRefreshingLinksRef.current) {
            return;
        }

        isRefreshingLinksRef.current = true;

        if (!silent) {
            setIsLoading(true);
            setErrorMessage('');
        }

        try {
            const response = await apiRequest(`/links?projectId=${projectId}`, { method: 'GET' });
            setLinks(response?.links || []);
        } catch (error) {
            if (!silent) {
                setErrorMessage(error.message || 'Unable to load bookmarks for this project.');
                setLinks([]);
            }
        } finally {
            if (!silent) {
                setIsLoading(false);
            }
            isRefreshingLinksRef.current = false;
        }
    }, [projectId]);

    const hasPendingEnrichment = useMemo(
        () => links.some((link) => isLinkEnrichmentPending(link)),
        [links],
    );

    const selectedLinkTimeline = useMemo(() => {
        const selectedKey = getLinkKey(selectedLink);
        return selectedKey ? timelineByLinkId[selectedKey] : null;
    }, [selectedLink, timelineByLinkId]);

    const loadContextFeedForLink = useCallback(async (link, options = {}) => {
        const { force = false, triggerSnapshot = false } = options;
        const linkKey = getLinkKey(link);
        const url = String(link?.url || '').trim();

        if (!linkKey || !url) {
            return;
        }

        const existing = timelineByLinkId[linkKey];
        const isFresh = existing?.fetchedAt && Date.now() - existing.fetchedAt < 60 * 1000;
        if (!force && (isFresh || timelineInFlightRef.current.has(linkKey))) {
            return;
        }

        timelineInFlightRef.current.add(linkKey);
        setTimelineByLinkId((previous) => ({
            ...previous,
            [linkKey]: {
                ...(previous[linkKey] || {}),
                isLoading: true,
                error: '',
            },
        }));

        try {
            const params = new URLSearchParams({ url });
            if (link?.title) {
                params.set('title', String(link.title));
            }

            if (triggerSnapshot) {
                await apiRequest(`/snapshot?${params.toString()}`, { method: 'POST' });
            }

            const [timelinePayload, historyPayload] = await Promise.all([
                apiRequest(`/timeline?${params.toString()}`, { method: 'GET' }),
                apiRequest(`/history?${params.toString()}`, { method: 'GET' }),
            ]);

            const eventsRaw = Array.isArray(timelinePayload?.events)
                ? timelinePayload.events
                : (Array.isArray(timelinePayload?.data) ? timelinePayload.data : []);
            const events = [...eventsRaw].sort(
                (a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime(),
            );

            const snapshotsRaw = Array.isArray(historyPayload?.data)
                ? historyPayload.data
                : (Array.isArray(historyPayload?.snapshots) ? historyPayload.snapshots : []);
            const snapshots = [...snapshotsRaw].sort(
                (a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime(),
            );

            const insights = timelinePayload?.insights || {
                total_changes: events.length,
                major_changes: events.filter((event) => event?.type === 'major').length,
                minor_changes: events.filter((event) => event?.type === 'minor').length,
                trend: 'stable',
            };

            const sinceLastSeen = timelinePayload?.since_last_seen || { major: 0, minor: 0 };

            setTimelineByLinkId((previous) => ({
                ...previous,
                [linkKey]: {
                    isLoading: false,
                    error: '',
                    insights,
                    sinceLastSeen,
                    events,
                    snapshots,
                    fetchedAt: Date.now(),
                },
            }));
        } catch (error) {
            setTimelineByLinkId((previous) => ({
                ...previous,
                [linkKey]: {
                    ...(previous[linkKey] || {}),
                    isLoading: false,
                    error: error?.message || 'Unable to load context feed.',
                    fetchedAt: Date.now(),
                },
            }));
        } finally {
            timelineInFlightRef.current.delete(linkKey);
        }
    }, [timelineByLinkId]);

    const loadProjectMembers = useCallback(async () => {
        if (!projectId || !isCollaborativeProject) {
            return;
        }

        setIsMembersLoading(true);

        try {
            const response = await apiRequest(`/projects/${projectId}/members`, { method: 'GET' });
            setProjectMembers(response?.members || []);
        } catch (error) {
            // Silently fail - members are optional
            setProjectMembers([]);
        } finally {
            setIsMembersLoading(false);
        }
    }, [projectId, isCollaborativeProject]);

    useEffect(() => {
        let isMounted = true;

        const loadProjectContext = async () => {
            const hasProjectMeta = Boolean(projectType && resolvedProjectName);
            const hasOwner = Boolean(projectOwnerId);

            if (!projectId || (hasProjectMeta && hasOwner)) {
                return;
            }

            try {
                const response = await apiRequest('/projects', { method: 'GET' });
                const allProjects = [
                    ...(response?.personalProjects || []),
                    ...(response?.collaborativeProjects || []),
                ];

                const matchedProject = allProjects.find((project) => project.id === projectId);
                if (!matchedProject || !isMounted) {
                    return;
                }

                if (!projectType) {
                    setProjectType(matchedProject.projectType || 'personal');
                }

                if (!resolvedProjectName) {
                    setResolvedProjectName(matchedProject.name || null);
                }

                setProjectOwnerId(
                    matchedProject?.createdBy?.id
                    || matchedProject?.createdBy?._id
                    || ''
                );
            } catch {
                // Ignore context loading failures; page still works with fallbacks.
            }
        };

        loadProjectContext();

        return () => {
            isMounted = false;
        };
    }, [projectId, projectType, resolvedProjectName, projectOwnerId]);

    useEffect(() => {
        if (!pendingOpenLinkIdRef.current || !links.length) {
            return;
        }

        const matchedLink = links.find((entry) => String(entry._id || entry.id) === String(pendingOpenLinkIdRef.current));
        if (matchedLink) {
            setSelectedLink(matchedLink);
            pendingOpenLinkIdRef.current = '';
        }
    }, [links]);

    useEffect(() => {
        let isMounted = true;

        const loadCurrentUser = async () => {
            try {
                const response = await apiRequest('/auth/me', { method: 'GET' });
                if (!isMounted) {
                    return;
                }

                setCurrentUserId(response?.user?.id || response?.user?._id || '');
            } catch {
                if (isMounted) {
                    setCurrentUserId('');
                }
            }
        };

        void loadCurrentUser();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadProjectLinks();
            void loadProjectMembers();
        }, 0);

        return () => {
            window.clearTimeout(timer);
        };
    }, [loadProjectLinks, loadProjectMembers]);

    useEffect(() => {
        const onBookmarkSaved = (event) => {
            const incomingProjectId = event?.detail?.projectId;
            if (!incomingProjectId || incomingProjectId === projectId) {
                void loadProjectLinks();
            }
        };

        const onStorage = (event) => {
            if (event.key !== BOOKMARK_SIGNAL_KEY || !event.newValue) {
                return;
            }

            try {
                const parsed = JSON.parse(event.newValue);
                const incomingProjectId = parsed?.projectId;
                if (!incomingProjectId || incomingProjectId === projectId) {
                    void loadProjectLinks();
                }
            } catch {
                // Ignore malformed storage payloads.
            }
        };

        const onOpenAddLink = (event) => {
            const incomingProjectId = event?.detail?.projectId;
            if (incomingProjectId && incomingProjectId !== projectId) {
                return;
            }

            const input = document.getElementById('project-bookmark-url');
            if (input) {
                input.focus();
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        };

        const onOpenNodeModal = (event) => {
            const requestedId = event?.detail?.id;
            if (!requestedId) {
                return;
            }

            const matchedLink = links.find((entry) => String(entry._id || entry.id) === String(requestedId));
            if (matchedLink) {
                setSelectedLink(matchedLink);
                return;
            }

            setErrorMessage('Selected node is not available in this lattice view.');
        };

        const onOpenLinkModal = (event) => {
            const requestedId = event?.detail?.id;
            const requestedProjectId = event?.detail?.projectId;

            if (requestedProjectId && String(requestedProjectId) !== String(projectId)) {
                return;
            }

            if (!requestedId) {
                return;
            }

            const matchedLink = links.find((entry) => String(entry._id || entry.id) === String(requestedId));
            if (matchedLink) {
                setSelectedLink(matchedLink);
                return;
            }

            if (event?.detail?.payload) {
                setSelectedLink(event.detail.payload);
            }
        };

        window.addEventListener('bookmark:saved', onBookmarkSaved);
        window.addEventListener('storage', onStorage);
        window.addEventListener('lattice:open-add-link-modal', onOpenAddLink);
        window.addEventListener('lattice:open-node-modal', onOpenNodeModal);
        window.addEventListener('lattice:open-link-modal', onOpenLinkModal);

        return () => {
            window.removeEventListener('bookmark:saved', onBookmarkSaved);
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('lattice:open-add-link-modal', onOpenAddLink);
            window.removeEventListener('lattice:open-node-modal', onOpenNodeModal);
            window.removeEventListener('lattice:open-link-modal', onOpenLinkModal);
        };
    }, [projectId, loadProjectLinks, links]);

    useEffect(() => {
        if (!hasPendingEnrichment) {
            return;
        }

        void loadProjectLinks({ silent: true });

        const pollId = window.setInterval(() => {
            void loadProjectLinks({ silent: true });
        }, 5000);

        return () => {
            window.clearInterval(pollId);
        };
    }, [hasPendingEnrichment, loadProjectLinks]);

    useEffect(() => {
        if (!links.length) {
            return;
        }

        links.forEach((link) => {
            void loadContextFeedForLink(link);
        });
    }, [links, loadContextFeedForLink]);

    useEffect(() => {
        let isMounted = true;

        const loadRoles = async () => {
            if (!projectId || !isCollaborativeProject) {
                if (isMounted) {
                    setRoles([]);
                }
                return;
            }

            try {
                const response = await apiRequest(`/roles?projectId=${projectId}`, { method: 'GET' });
                if (isMounted) {
                    setRoles(response?.roles || []);
                }
            } catch {
                if (isMounted) {
                    setRoles([]);
                }
            }
        };

        loadRoles();

        return () => {
            isMounted = false;
        };
    }, [projectId, isCollaborativeProject]);

    const onRoleToggle = (roleId) => {
        setSelectedRoleIds((previous) => {
            if (previous.includes(roleId)) {
                return previous.filter((currentRoleId) => currentRoleId !== roleId);
            }

            return [...previous, roleId];
        });
    };

    const onCreateRole = async (event) => {
        event.preventDefault();

        const trimmedRoleName = newRoleName.trim();
        if (!trimmedRoleName) {
            setRoleFormError('Role name is required.');
            return;
        }

        setIsCreatingRole(true);
        setRoleFormError('');
        setRoleFormSuccess('');

        try {
            const response = await apiRequest('/roles', {
                method: 'POST',
                body: JSON.stringify({
                    projectId,
                    name: trimmedRoleName,
                    permissions: newRolePermission,
                }),
            });

            const createdRole = response?.role;
            if (createdRole) {
                setRoles((previous) => {
                    const exists = previous.some((item) => item.id === createdRole.id);
                    if (exists) {
                        return previous;
                    }

                    return [...previous, createdRole];
                });
            }

            setNewRoleName('');
            setNewRolePermission('view_only');
            setRoleFormSuccess('Role created successfully.');
        } catch (error) {
            setRoleFormError(error.message || 'Unable to create role.');
        } finally {
            setIsCreatingRole(false);
        }
    };

    const onCreateBookmark = async (event) => {
        event.preventDefault();

        const trimmedUrl = newBookmarkUrl.trim();
        if (!trimmedUrl) {
            setFormError('Bookmark URL is required.');
            return;
        }

        if (effectiveAccessType === 'role_based' && selectedRoleIds.length === 0) {
            setFormError('Select at least one role for role-based access.');
            return;
        }

        setIsSubmitting(true);
        setFormError('');
        setFormSuccess('');

        try {
            const response = await apiRequest('/links', {
                method: 'POST',
                body: JSON.stringify({
                    projectId,
                    url: trimmedUrl,
                    accessType: effectiveAccessType,
                    allowedRoles: effectiveAccessType === 'role_based' ? selectedRoleIds : [],
                }),
            });

            const createdLink = response?.link;
            if (createdLink) {
                setLinks((previous) => [createdLink, ...previous]);
            }

            setNewBookmarkUrl('');
            setAccessType('public');
            setSelectedRoleIds([]);
            setFormSuccess('Bookmark added to this project.');
        } catch (error) {
            setFormError(error.message || 'Unable to create bookmark for this project.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const onInviteUser = async (event) => {
        event.preventDefault();

        const trimmedEmail = inviteEmail.trim().toLowerCase();
        if (!trimmedEmail) {
            setInviteError('Email is required.');
            return;
        }

        if (!effectiveInviteRoleId) {
            setInviteError('Select access role for the invited user.');
            return;
        }

        setIsInvitingUser(true);
        setInviteError('');
        setInviteSuccess('');

        try {
            await apiRequest('/invites', {
                method: 'POST',
                body: JSON.stringify({
                    email: trimmedEmail,
                    projectId,
                    roleId: effectiveInviteRoleId,
                }),
            });

            setInviteEmail('');
            setInviteSuccess('Invitation sent. The user will be notified via email.');
        } catch (error) {
            setInviteError(error.message || 'Unable to send invite.');
        } finally {
            setIsInvitingUser(false);
        }
    };

    const onDeleteLink = async (linkId) => {
        if (!linkId || deletingLinkId) {
            return;
        }

        const shouldDelete = window.confirm('Delete this bookmark? This cannot be undone.');
        if (!shouldDelete) {
            return;
        }

        setDeletingLinkId(linkId);
        setFormError('');
        setFormSuccess('');

        try {
            await apiRequest(`/links/${linkId}`, {
                method: 'DELETE',
            });

            setLinks((previous) => previous.filter((entry) => (entry._id || entry.id) !== linkId));
        } catch (error) {
            setFormError(error.message || 'Unable to delete bookmark.');
        } finally {
            setDeletingLinkId('');
        }
    };

    const onReactToLink = async (linkId, emoji) => {
        if (!linkId || !emoji || reactingLinkId) {
            return;
        }

        setReactingLinkId(linkId);

        try {
            const response = await apiRequest(`/links/${linkId}/reactions`, {
                method: 'POST',
                body: JSON.stringify({ emoji }),
            });

            const updatedLink = response?.link;
            if (updatedLink) {
                setLinks((previous) => previous.map((entry) => {
                    const entryId = entry._id || entry.id;
                    if (entryId !== linkId) {
                        return entry;
                    }

                    return updatedLink;
                }));
            }
        } catch (error) {
            setFormError(error.message || 'Unable to add reaction.');
        } finally {
            setReactingLinkId('');
            setReactionPickerLinkId('');
        }
    };

    const onLinkOpened = async (linkId) => {
        if (!linkId) {
            return;
        }

        try {
            const response = await markLinkViewed(linkId);
            const nextLink = response?.link;

            if (nextLink) {
                setLinks((previous) => previous.map((item) => {
                    const itemId = item._id || item.id;
                    if (String(itemId) !== String(linkId)) {
                        return item;
                    }

                    return {
                        ...item,
                        ...nextLink,
                    };
                }));
            }
        } catch {
            // best-effort tracking
        }
    };

    const isOwner = Boolean(currentUserId) && Boolean(projectOwnerId) && String(currentUserId) === String(projectOwnerId);

    const selectedRoleFilter = roles.find((role) => role.id === selectedRoleFilterId) || null;

    const visibleLinks = useMemo(() => {
        if (selectedRoleFilterId === 'all') {
            return links;
        }

        return links.filter((item) => {
            const linkAccessType = item.accessType || 'public';
            if (linkAccessType === 'public') {
                return true;
            }

            const allowedRoles = Array.isArray(item.allowedRoles) ? item.allowedRoles : [];
            return allowedRoles.some((roleId) => String(roleId) === String(selectedRoleFilterId));
        });
    }, [links, selectedRoleFilterId]);

    return (
        <LatticeFrame>
            <div className={`project-page-container discord-project-shell ${isCollabPaneExpanded ? 'collab-expanded' : ''}`}>
                <header className="project-page-header">
                    <div className="project-page-title-group">
                        <Link to="/lattice" className="project-back-link">
                            <ArrowLeft size={15} />
                            Back to Hubs
                        </Link>
                        <h2>{projectName}</h2>
                        <p>All bookmarks in this project.</p>
                    </div>
                    <div className="project-page-actions">
                        <Link
                            to={`/lattice/project/${projectId}/graph`}
                            state={{ projectName }}
                            className="directory-create-btn"
                        >
                            <Network size={15} />
                            Open Knowledge Graph
                        </Link>
                        <div className="project-page-count-pill">
                            {links.length} Bookmark{links.length === 1 ? '' : 's'}
                        </div>
                        {isCollaborativeProject ? (
                            <button
                                type="button"
                                className="project-pane-toggle"
                                onClick={() => setIsCollabPaneExpanded((previous) => !previous)}
                            >
                                {isCollabPaneExpanded ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                                {isCollabPaneExpanded ? 'Back To Workspace' : 'Focus Collaboration'}
                            </button>
                        ) : null}
                    </div>
                </header>

                <div className="project-workspace-grid">
                    <aside className="project-left-rail">
                        <section className="project-role-panel">
                            <div className="project-role-panel-head">
                                <h3>Roles</h3>
                                <p>Define role-based access controls for this project.</p>
                            </div>

                            <div className="project-role-list-wrap">
                                <p className="project-role-list-title">Existing roles</p>
                                <div className="project-role-stack">
                                    <button
                                        type="button"
                                        className={`project-role-row ${selectedRoleFilterId === 'all' ? 'active' : ''}`}
                                        onClick={() => setSelectedRoleFilterId('all')}
                                    >
                                        <span className="project-role-row-main">Everyone</span>
                                        <span className="project-role-row-meta">All links</span>
                                    </button>

                                    {roles.length ? roles.map((role) => (
                                        <button
                                            type="button"
                                            key={role.id}
                                            className={`project-role-row ${selectedRoleFilterId === role.id ? 'active' : ''}`}
                                            onClick={() => setSelectedRoleFilterId(role.id)}
                                        >
                                            <span className="project-role-row-main">
                                                <Shield size={14} />
                                                {role.name}
                                            </span>
                                            <span className="project-role-row-meta">{role.permissions.replace(/_/g, ' ')}</span>
                                        </button>
                                    )) : (
                                        <p className="project-left-note">No roles defined yet.</p>
                                    )}
                                </div>
                            </div>

                            {isCollaborativeProject && isOwner ? (
                                <form className="project-role-form" onSubmit={onCreateRole}>
                                    <div className="project-owner-callout">
                                        <span className="project-owner-callout-title">Add role</span>
                                        <span className="project-owner-callout-copy">Owner-only control for assigning project access levels.</span>
                                    </div>
                                    <div className="project-role-grid">
                                        <div className="bookmark-field">
                                            <label htmlFor="project-role-name">Role name</label>
                                            <input
                                                id="project-role-name"
                                                type="text"
                                                placeholder="Designer"
                                                value={newRoleName}
                                                onChange={(event) => setNewRoleName(event.target.value)}
                                                disabled={isCreatingRole}
                                                maxLength={60}
                                                required
                                            />
                                        </div>

                                        <div className="bookmark-field">
                                            <label htmlFor="project-role-permission">Permission</label>
                                            <div className="bookmark-select-wrap">
                                                <select
                                                    id="project-role-permission"
                                                    value={newRolePermission}
                                                    onChange={(event) => setNewRolePermission(event.target.value)}
                                                    disabled={isCreatingRole}
                                                >
                                                    <option value="full_access">Full access</option>
                                                    <option value="restricted_access">Restricted access</option>
                                                    <option value="view_only">View only</option>
                                                </select>
                                                <ChevronDown size={16} className="bookmark-select-chevron" />
                                            </div>
                                        </div>
                                    </div>

                                    {roleFormError ? <p className="bookmark-feedback bookmark-feedback-error">{roleFormError}</p> : null}
                                    {roleFormSuccess ? <p className="bookmark-feedback bookmark-feedback-success">{roleFormSuccess}</p> : null}

                                    <div className="project-role-actions">
                                        <button type="submit" className="project-role-submit" disabled={isCreatingRole}>
                                            <Plus size={15} />
                                            {isCreatingRole ? 'Creating...' : 'Create Role'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <p className="project-left-note">
                                    {isCollaborativeProject
                                        ? 'Only the project owner can add roles.'
                                        : 'Switch this project to collaborative mode to configure roles.'}
                                </p>
                            )}
                        </section>

                        <section className="project-role-panel project-online-panel">
                            <div className="project-role-panel-head">
                                <h3>Online</h3>
                                <p>Live project presence.</p>
                            </div>

                            <div className="project-online-list">
                                {onlineParticipants.length > 0 ? onlineParticipants.map((participant) => (
                                    <div key={participant.id} className="project-online-item">
                                        <span className="project-online-dot" />
                                        <span>{participant.username || participant.name || 'Guest'}</span>
                                    </div>
                                )) : (
                                    <p className="project-left-note">No one online in this room yet.</p>
                                )}
                            </div>
                        </section>
                    </aside>

                    <section className="project-middle-pane">
                        <div className="project-bookmark-row">
                            <section className="project-bookmark-panel">
                                <div className="project-bookmark-panel-head">
                                    <h3>Add Bookmark To This Project</h3>
                                    <p>Quickly save a link here without going back to Home.</p>
                                </div>

                                <form className="project-bookmark-form" onSubmit={onCreateBookmark}>
                                    <div className="project-bookmark-grid">
                                        <div className="bookmark-field project-bookmark-field-wide">
                                            <label htmlFor="project-bookmark-url">Link URL</label>
                                            <input
                                                id="project-bookmark-url"
                                                type="url"
                                                placeholder="https://example.com/interesting-article"
                                                value={newBookmarkUrl}
                                                onChange={(event) => setNewBookmarkUrl(event.target.value)}
                                                disabled={isSubmitting}
                                                required
                                            />
                                        </div>

                                        <div className="bookmark-field">
                                            <label htmlFor="project-bookmark-access">Access type</label>
                                            <div className="bookmark-select-wrap">
                                                <select
                                                    id="project-bookmark-access"
                                                    value={effectiveAccessType}
                                                    onChange={(event) => {
                                                        const nextValue = event.target.value;
                                                        setAccessType(nextValue);
                                                        if (nextValue !== 'role_based') {
                                                            setSelectedRoleIds([]);
                                                        }
                                                    }}
                                                    disabled={isSubmitting || !isCollaborativeProject}
                                                >
                                                    <option value="public">Public (all project members)</option>
                                                    <option value="role_based" disabled={!isCollaborativeProject || roles.length === 0}>Role-based access</option>
                                                </select>
                                                <ChevronDown size={16} className="bookmark-select-chevron" />
                                            </div>
                                        </div>
                                    </div>

                                    {effectiveAccessType === 'role_based' && isCollaborativeProject ? (
                                        <div className="bookmark-role-section project-bookmark-roles">
                                            <p className="bookmark-role-label">Roles with access</p>
                                            {roles.length ? (
                                                <div className="bookmark-role-list">
                                                    {roles.map((role) => (
                                                        <label key={role.id} className="bookmark-role-chip">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedRoleIds.includes(role.id)}
                                                                onChange={() => onRoleToggle(role.id)}
                                                                disabled={isSubmitting}
                                                            />
                                                            <span>{role.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="bookmark-role-empty">No roles exist for this project yet.</p>
                                            )}
                                        </div>
                                    ) : null}

                                    {formError ? <p className="bookmark-feedback bookmark-feedback-error">{formError}</p> : null}
                                    {formSuccess ? <p className="bookmark-feedback bookmark-feedback-success">{formSuccess}</p> : null}

                                    <div className="project-bookmark-actions">
                                        <button type="submit" className="project-bookmark-submit" disabled={isSubmitting}>
                                            <Plus size={15} />
                                            {isSubmitting ? 'Adding...' : 'Add Bookmark'}
                                        </button>
                                    </div>
                                </form>
                            </section>

                            <ProjectBookmarkImport
                                projectId={projectId}
                                token={token}
                                isCollaborativeProject={isCollaborativeProject}
                                roles={roles}
                                onImportCompleted={loadProjectLinks}
                            />
                        </div>

                        {isLoading ? <p className="directory-status">Loading bookmarks...</p> : null}
                        {errorMessage ? <p className="directory-status directory-status-error">{errorMessage}</p> : null}

                        {!isLoading && !errorMessage ? (
                            <p className="project-left-note project-filter-indicator">
                                Showing: {selectedRoleFilter ? `${selectedRoleFilter.name} + public` : 'All links'}
                            </p>
                        ) : null}

                        {!isLoading && !errorMessage && visibleLinks.length === 0 ? (
                            <div className="project-empty-state">
                                <p>{selectedRoleFilter ? 'No links found for this role yet.' : 'No bookmarks in this project yet.'}</p>
                                <p>{selectedRoleFilter ? 'Try switching role filter or add role-based links.' : 'Add one above to get started.'}</p>
                            </div>
                        ) : null}

                        {!isLoading && !errorMessage && visibleLinks.length > 0 ? (
                            <section className="project-links-grid">
                                {visibleLinks.map((item) => {
                                    const summary = item.summary || item.description || 'No summary available for this bookmark yet.';
                                    const title = item.title || item.url;
                                    const linkId = getLinkKey(item);
                                    const reactions = Array.isArray(item.reactions) ? item.reactions : [];
                                    const decayProgress = Number.isFinite(item.decayProgress) ? item.decayProgress : 0;
                                    const isDecayWindow = Boolean(item.isDecayWindow);
                                    const scaleValue = isDecayWindow ? Math.max(0.72, 1 - decayProgress * 0.28) : 1;
                                    const saturationValue = isDecayWindow ? Math.max(0.18, 1 - decayProgress * 0.75) : 1;
                                    const enrichmentPending = isLinkEnrichmentPending(item);
                                    const timelineMeta = timelineByLinkId[linkId] || null;
                                    const sinceMajor = Number(timelineMeta?.sinceLastSeen?.major || 0);
                                    const sinceMinor = Number(timelineMeta?.sinceLastSeen?.minor || 0);
                                    const hasSinceLastSeen = sinceMajor > 0 || sinceMinor > 0;
                                    const trend = timelineMeta?.insights?.trend || 'stable';
                                    const vibeTheme = getVibeTheme(item.vibe);
                                    const vibeLabel = formatVibeLabel(item.vibe);

                                    return (
                                        <article
                                            key={linkId || item.url}
                                            className={`bookmark-tile ${item.commentCount > 0 ? 'has-comments' : ''} ${isDecayWindow ? 'is-decaying' : ''}${enrichmentPending ? ' bookmark-tile-pending' : ''}`}
                                            style={{
                                                transform: `scale(${scaleValue})`,
                                                filter: `saturate(${saturationValue})`,
                                                '--vibe-bg-start': vibeTheme.start,
                                                '--vibe-bg-mid': vibeTheme.mid,
                                                '--vibe-bg-end': vibeTheme.end,
                                                '--vibe-glow': vibeTheme.glow,
                                                '--vibe-tint': vibeTheme.tint,
                                                '--vibe-card-tint': vibeTheme.cardTint,
                                                '--vibe-badge-bg': vibeTheme.badgeBg,
                                                '--vibe-badge-border': vibeTheme.badgeBorder,
                                                '--vibe-badge-text': vibeTheme.badgeText,
                                            }}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => {
                                                setSelectedLink(item);
                                                void loadContextFeedForLink(item, { force: true });
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    setSelectedLink(item);
                                                    void loadContextFeedForLink(item, { force: true });
                                                }
                                            }}
                                            aria-label={`Open details for ${title}`}
                                        >
                                            <div className="bookmark-tile-visual" aria-hidden="true">
                                                {item.image ? (
                                                    <img src={item.image} alt={title} loading="lazy" />
                                                ) : (
                                                    <div className="bookmark-tile-placeholder">
                                                        <ImageOff size={18} />
                                                        <span>No preview</span>
                                                    </div>
                                                )}
                                            </div>

                                            {item.commentCount > 0 ? (
                                                <div className="bookmark-tile-comment-badge" aria-label={`${item.commentCount} comments`}>
                                                    <span className="bookmark-tile-comment-avatar">
                                                        {item.latestCommenter?.avatarUrl ? (
                                                            <img src={item.latestCommenter.avatarUrl} alt={item.latestCommenter.name || 'Commenter'} />
                                                        ) : (
                                                            <MessageCircle size={13} />
                                                        )}
                                                    </span>
                                                    <span className="bookmark-tile-comment-count">{item.commentCount}</span>
                                                </div>
                                            ) : null}

                                            <div className="bookmark-tile-body">
                                                <div className="bookmark-tile-actions">
                                                    <div className="bookmark-tile-statuses">
                                                        <span className="bookmark-status-badge bookmark-status-badge-vibe">
                                                            {vibeLabel}
                                                        </span>
                                                        {enrichmentPending ? (
                                                            <span className="bookmark-status-badge bookmark-status-badge-pending">
                                                                Enrichment pending
                                                            </span>
                                                        ) : null}
                                                        {!enrichmentPending && hasSinceLastSeen ? (
                                                            <span className="bookmark-status-badge bookmark-status-badge-since">
                                                                Since seen: {sinceMajor ? `${sinceMajor} major` : ''}{sinceMajor && sinceMinor ? ' • ' : ''}{sinceMinor ? `${sinceMinor} minor` : ''}
                                                            </span>
                                                        ) : null}
                                                        {!enrichmentPending && !hasSinceLastSeen ? (
                                                            <span className={`bookmark-status-badge ${getTrendClassName(trend)}`}>
                                                                {normalizeTrendLabel(trend)}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="bookmark-tile-delete"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            onDeleteLink(linkId);
                                                        }}
                                                        disabled={!linkId || deletingLinkId === linkId}
                                                        aria-label="Delete bookmark"
                                                    >
                                                        <Trash2 size={14} />
                                                        {deletingLinkId === linkId ? 'Deleting...' : 'Delete'}
                                                    </button>
                                                </div>
                                                <h3 title={title}>{title}</h3>
                                                <p className="bookmark-tile-summary">{summary}</p>
                                                <p className="bookmark-tile-dates">
                                                    Last viewed: {formatDate(item.lastViewedAt)} • Last modified: {formatDate(item.lastModifiedAt)}
                                                </p>
                                                <a
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="bookmark-tile-link"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void onLinkOpened(linkId);
                                                    }}
                                                >
                                                    Visit source
                                                    <ExternalLink size={14} />
                                                </a>

                                                {isCollaborativeProject ? (
                                                    <div className="bookmark-tile-reactions-wrap">
                                                        <div className="bookmark-tile-reactions">
                                                            {reactions.map((reaction) => {
                                                                const count = Array.isArray(reaction.users) ? reaction.users.length : 0;

                                                                if (!count) {
                                                                    return null;
                                                                }

                                                                return (
                                                                    <button
                                                                        key={`${linkId}-${reaction.emoji}`}
                                                                        type="button"
                                                                        className="bookmark-reaction-chip"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            onReactToLink(linkId, reaction.emoji);
                                                                        }}
                                                                        disabled={reactingLinkId === linkId}
                                                                    >
                                                                        <span>{reaction.emoji}</span>
                                                                        <span>{count}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        <div className="bookmark-reaction-picker-wrap">
                                                            <button
                                                                type="button"
                                                                className="bookmark-reaction-add"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    setReactionPickerLinkId((previous) => (previous === linkId ? '' : linkId));
                                                                }}
                                                                disabled={reactingLinkId === linkId}
                                                                aria-label="Add emoji reaction"
                                                            >
                                                                <SmilePlus size={14} />
                                                            </button>

                                                            {reactionPickerLinkId === linkId ? (
                                                                <div className="bookmark-reaction-popover">
                                                                    {reactionOptions.map((emoji) => (
                                                                        <button
                                                                            key={`${linkId}-${emoji}`}
                                                                            type="button"
                                                                            className="bookmark-reaction-option"
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                onReactToLink(linkId, emoji);
                                                                            }}
                                                                            disabled={reactingLinkId === linkId}
                                                                        >
                                                                            {emoji}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </article>
                                    );
                                })}
                            </section>
                        ) : null}
                    </section>

                    <aside className="project-right-pane">
                        {isCollaborativeProject ? (
                            <>
                                <ProjectRealtimePanel
                                    projectId={projectId}
                                    projectName={projectName}
                                    projectMembers={projectMembers}
                                    onParticipantsChange={setOnlineParticipants}
                                />

                                {projectMembers.length > 0 ? (
                                    <section className="project-members-panel">
                                        <div className="project-members-panel-head">
                                            <h3>
                                                <Users size={16} />
                                                Team Members
                                            </h3>
                                            <p>{projectMembers.length} member{projectMembers.length === 1 ? '' : 's'}</p>
                                        </div>

                                        <div className="project-members-list">
                                            {projectMembers.map((member) => (
                                                <Link
                                                    key={member.id}
                                                    to={`/profile/${member.id}`}
                                                    className="project-member-item"
                                                    title={`Open ${member.name}'s profile`}
                                                >
                                                    <div className="project-member-avatar">
                                                        {member.avatar ? (
                                                            <img src={member.avatar} alt={member.name} className="project-member-avatar-img" />
                                                        ) : (
                                                            <div className="project-member-avatar-fallback">
                                                                {member.name.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="project-member-info">
                                                        <div className="project-member-name">
                                                            {member.name}
                                                            {member.isOwner ? <span className="project-member-owner-badge">Owner</span> : null}
                                                        </div>
                                                        {member.email ? <div className="project-member-email">{member.email}</div> : null}
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    </section>
                                ) : null}

                                <section className="project-invite-panel">
                                    <div className="project-invite-panel-head">
                                        <h3>Add Collaborator</h3>
                                        <p>Invite a teammate by email and assign their access role.</p>
                                    </div>

                                    <form className="project-invite-form" onSubmit={onInviteUser}>
                                        <div className="project-invite-grid">
                                            <div className="bookmark-field">
                                                <label htmlFor="project-invite-email">User email</label>
                                                <input
                                                    id="project-invite-email"
                                                    type="email"
                                                    placeholder="teammate@example.com"
                                                    value={inviteEmail}
                                                    onChange={(event) => setInviteEmail(event.target.value)}
                                                    disabled={isInvitingUser}
                                                    required
                                                />
                                            </div>

                                            <div className="bookmark-field">
                                                <label htmlFor="project-invite-role">Access role</label>
                                                <div className="bookmark-select-wrap">
                                                    <select
                                                        id="project-invite-role"
                                                        value={effectiveInviteRoleId}
                                                        onChange={(event) => setInviteRoleId(event.target.value)}
                                                        disabled={isInvitingUser || roles.length === 0}
                                                    >
                                                        {roles.length === 0 ? (
                                                            <option value="">Create a role first</option>
                                                        ) : null}
                                                        {roles.map((role) => (
                                                            <option key={role.id} value={role.id}>
                                                                {role.name} ({role.permissions.replace(/_/g, ' ')})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={16} className="bookmark-select-chevron" />
                                                </div>
                                            </div>
                                        </div>

                                        {roles.length === 0 ? <p className="bookmark-feedback">Create at least one role before inviting users.</p> : null}
                                        {inviteError ? <p className="bookmark-feedback bookmark-feedback-error">{inviteError}</p> : null}
                                        {inviteSuccess ? <p className="bookmark-feedback bookmark-feedback-success">{inviteSuccess}</p> : null}

                                        <div className="project-invite-actions">
                                            <button
                                                type="submit"
                                                className="project-invite-submit"
                                                disabled={isInvitingUser || roles.length === 0}
                                            >
                                                <UserPlus size={15} />
                                                {isInvitingUser ? 'Sending invite...' : 'Send Invite'}
                                            </button>
                                        </div>
                                    </form>
                                </section>
                            </>
                        ) : (
                            <section className="project-invite-panel">
                                <div className="project-invite-panel-head">
                                    <h3><Users size={16} /> Collaboration Panel</h3>
                                    <p>Realtime call, chat, and invites are available for collaborative projects.</p>
                                </div>
                            </section>
                        )}
                    </aside>
                </div>

                {selectedLink ? (
                    <LinkModal
                        link={selectedLink}
                        contextFeed={selectedLinkTimeline}
                        onRefreshContextFeed={(options = {}) => {
                            if (selectedLink) {
                                void loadContextFeedForLink(selectedLink, { force: true, ...options });
                            }
                        }}
                        onClose={() => setSelectedLink(null)}
                    />
                ) : null}
            </div>
        </LatticeFrame>
    );
};

