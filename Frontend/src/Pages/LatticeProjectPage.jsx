import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ExternalLink, ImageOff, ArrowLeft, Plus, ChevronDown, UserPlus } from 'lucide-react';
import { Network } from 'lucide-react';
import { LatticeFrame } from './LatticeFrame';
import { ProjectRealtimePanel } from './ProjectRealtimePanel';
import ProjectBookmarkImport from '../components/ProjectBookmarkImport';
import { apiRequest } from '../utils/api';
import './LatticePages.css';

export const LatticeProjectPage = () => {
    const { projectId } = useParams();
    const location = useLocation();
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

    const loadProjectLinks = useCallback(async () => {
        if (!projectId) {
            setErrorMessage('Project not found.');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setErrorMessage('');

        try {
            const response = await apiRequest(`/links?projectId=${projectId}`, { method: 'GET' });
            setLinks(response?.links || []);
        } catch (error) {
            setErrorMessage(error.message || 'Unable to load bookmarks for this project.');
            setLinks([]);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        let isMounted = true;

        const loadProjectContext = async () => {
            if (!projectId || (projectType && resolvedProjectName)) {
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

                setProjectType(matchedProject.projectType || 'personal');
                setResolvedProjectName(matchedProject.name || null);
            } catch {
                // Ignore context loading failures; page still works with fallbacks.
            }
        };

        loadProjectContext();

        return () => {
            isMounted = false;
        };
    }, [projectId, projectType, resolvedProjectName]);

    useEffect(() => {
        void loadProjectLinks();
    }, [loadProjectLinks]);

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

    return (
        <LatticeFrame>
            <div className="project-page-container">
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
                    </div>
                </header>

                {isCollaborativeProject ? (
                    <>
                        <ProjectRealtimePanel projectId={projectId} projectName={projectName} />

                        <section className="project-role-panel">
                            <div className="project-role-panel-head">
                                <h3>Define Roles</h3>
                                <p>Create roles and permissions for this collaborative project.</p>
                            </div>

                            <form className="project-role-form" onSubmit={onCreateRole}>
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

                            {roles.length ? (
                                <div className="project-role-list-wrap">
                                    <p className="project-role-list-title">Current roles</p>
                                    <div className="project-role-list">
                                        {roles.map((role) => (
                                            <span key={role.id} className="project-role-pill">
                                                {role.name}
                                                <span className="project-role-pill-permission">{role.permissions.replace(/_/g, ' ')}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </section>

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
                ) : null}

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

                    <ProjectBookmarkImport projectId={projectId} token={token} onImportCompleted={loadProjectLinks} />
                </div>

                {isLoading ? <p className="directory-status">Loading bookmarks...</p> : null}
                {errorMessage ? <p className="directory-status directory-status-error">{errorMessage}</p> : null}

                {!isLoading && !errorMessage && links.length === 0 ? (
                    <div className="project-empty-state">
                        <p>No bookmarks in this project yet.</p>
                        <p>Add one above to get started.</p>
                    </div>
                ) : null}

                {!isLoading && !errorMessage && links.length > 0 ? (
                    <section className="project-links-grid">
                        {links.map((item) => {
                            const summary = item.summary || item.description || 'No summary available for this bookmark yet.';
                            const title = item.title || item.url;

                            return (
                                <article key={item._id || item.id || item.url} className="bookmark-tile">
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="bookmark-tile-visual"
                                        aria-label={`Open ${title}`}
                                    >
                                        {item.image ? (
                                            <img src={item.image} alt={title} loading="lazy" />
                                        ) : (
                                            <div className="bookmark-tile-placeholder">
                                                <ImageOff size={18} />
                                                <span>No preview</span>
                                            </div>
                                        )}
                                    </a>

                                    <div className="bookmark-tile-body">
                                        <h3 title={title}>{title}</h3>
                                        <p className="bookmark-tile-summary">{summary}</p>
                                        <a href={item.url} target="_blank" rel="noreferrer" className="bookmark-tile-link">
                                            Visit source
                                            <ExternalLink size={14} />
                                        </a>
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

