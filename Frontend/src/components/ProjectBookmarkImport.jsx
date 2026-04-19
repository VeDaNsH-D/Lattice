import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../utils/api';

const IMPORT_API_URL = `${API_BASE_URL}/bookmarks/import`;

function extractBookmarksFromNodes(nodes) {
    const flattened = [];

    const walk = (items) => {
        if (!Array.isArray(items)) {
            return;
        }

        for (const item of items) {
            if (item?.url) {
                flattened.push({
                    title: typeof item.title === 'string' ? item.title : '',
                    url: item.url,
                });
            }

            if (Array.isArray(item?.children) && item.children.length > 0) {
                walk(item.children);
            }
        }
    };

    walk(nodes);
    return flattened;
}

export default function ProjectBookmarkImport({ projectId, token, isCollaborativeProject = false, roles = [], onImportCompleted }) {
    const [bookmarks, setBookmarks] = useState([]);
    const [selected, setSelected] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [requested, setRequested] = useState(false);
    const [accessType, setAccessType] = useState('public');
    const [selectedRoleIds, setSelectedRoleIds] = useState([]);
    const responseTimeoutRef = useRef(null);

    useEffect(() => {
        const onMessage = (event) => {
            const messageType = event?.data?.type;

            if (messageType !== 'BOOKMARKS_DATA' && messageType !== 'BOOKMARKS_ERROR') {
                return;
            }

            if (responseTimeoutRef.current) {
                window.clearTimeout(responseTimeoutRef.current);
                responseTimeoutRef.current = null;
            }

            if (messageType === 'BOOKMARKS_ERROR') {
                setLoading(false);
                setMessage(event?.data?.error || 'Extension returned an error while loading bookmarks.');
                return;
            }

            const tree = Array.isArray(event?.data?.tree)
                ? event.data.tree
                : (Array.isArray(event?.data?.payload?.tree) ? event.data.payload.tree : []);

            const flattened = extractBookmarksFromNodes(tree).slice(0, 100);

            setBookmarks(flattened);
            setSelected([]);
            setLoading(false);

            if (flattened.length === 0) {
                setMessage('No bookmarks found from extension response.');
            } else {
                setMessage(`Loaded ${flattened.length} bookmarks.`);
            }
        };

        window.addEventListener('message', onMessage);

        return () => {
            window.removeEventListener('message', onMessage);
            if (responseTimeoutRef.current) {
                window.clearTimeout(responseTimeoutRef.current);
            }
        };
    }, []);

    const selectedSet = useMemo(() => {
        return new Set(selected.map((item) => item.url));
    }, [selected]);

    const requestBookmarks = () => {
        setRequested(true);
        setLoading(true);
        setMessage('Requesting bookmarks from extension...');

        window.postMessage({ type: 'GET_BOOKMARKS' }, '*');

        if (responseTimeoutRef.current) {
            window.clearTimeout(responseTimeoutRef.current);
        }

        responseTimeoutRef.current = window.setTimeout(() => {
            setLoading(false);
            setMessage('Extension not responding. Please ensure the extension bridge is active.');
        }, 5000);
    };

    const toggleSelection = (bookmark) => {
        setSelected((previous) => {
            const exists = previous.some((item) => item.url === bookmark.url);
            if (exists) {
                return previous.filter((item) => item.url !== bookmark.url);
            }

            return [...previous, bookmark];
        });
    };

    const importSelectedBookmarks = async () => {
        if (!projectId) {
            setMessage('Project ID missing.');
            return;
        }

        if (!token) {
            setMessage('Auth token missing. Please login again.');
            return;
        }

        if (selected.length === 0) {
            setMessage('Select at least one bookmark to import.');
            return;
        }

        if (isCollaborativeProject && accessType === 'role_based' && selectedRoleIds.length === 0) {
            setMessage('Select at least one role for role-based access.');
            return;
        }

        setLoading(true);
        setMessage('Importing selected bookmarks...');

        let didImportSucceed = false;

        try {
            const response = await fetch(IMPORT_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    projectId,
                    bookmarks: selected,
                    accessType: isCollaborativeProject ? accessType : 'public',
                    allowedRoles: isCollaborativeProject && accessType === 'role_based' ? selectedRoleIds : [],
                }),
            });

            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(payload?.message || `Request failed with status ${response.status}`);
            }

            const importedCount = Number.isFinite(payload?.imported) ? payload.imported : selected.length;
            setMessage(`Imported ${importedCount} bookmarks into project`);
            didImportSucceed = true;

            if (typeof onImportCompleted === 'function') {
                await onImportCompleted();
            }
        } catch (error) {
            setMessage(error.message || 'Import failed.');
        } finally {
            if (didImportSucceed) {
                // Return to default state after successful import.
                setRequested(false);
                setBookmarks([]);
                setSelected([]);
            }

            setLoading(false);
        }
    };

    const onRoleToggle = (roleId) => {
        setSelectedRoleIds((previous) => {
            if (previous.includes(roleId)) {
                return previous.filter((currentRoleId) => currentRoleId !== roleId);
            }

            return [...previous, roleId];
        });
    };

    return (
        <section className="project-bookmark-panel">
            <div className="project-bookmark-panel-head">
                <h3>Import Bookmarks</h3>
                <p>Load bookmarks from extension and import selected ones into this project.</p>
            </div>

            <div className="project-bookmark-actions" style={{ marginTop: 0 }}>
                <button type="button" className="project-bookmark-submit" onClick={requestBookmarks} disabled={loading}>
                    {loading ? 'Working...' : 'Import Bookmarks'}
                </button>
            </div>

            {requested ? (
                <div style={{ marginTop: '14px' }}>
                    <div
                        style={{
                            maxHeight: '160px',
                            overflowY: 'auto',
                            border: '1px solid #d8dde6',
                            borderRadius: '10px',
                            padding: '10px',
                            background: '#fff',
                        }}
                    >
                        {bookmarks.length === 0 ? (
                            <p style={{ margin: 0, color: '#5f6b7c' }}>No bookmarks to display.</p>
                        ) : (
                            bookmarks.map((bookmark) => (
                                <label key={bookmark.url} style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedSet.has(bookmark.url)}
                                        onChange={() => toggleSelection(bookmark)}
                                        disabled={loading}
                                        style={{ marginRight: '8px' }}
                                    />
                                    {bookmark.title || bookmark.url}
                                </label>
                            ))
                        )}
                    </div>

                    <div className="project-bookmark-actions" style={{ marginTop: '12px' }}>
                        <button
                            type="button"
                            className="project-bookmark-submit"
                            onClick={importSelectedBookmarks}
                            disabled={loading || selected.length === 0}
                        >
                            {loading ? 'Importing...' : 'Import to Project'}
                        </button>
                    </div>

                    {isCollaborativeProject ? (
                        <div style={{ marginTop: '12px' }}>
                            <div className="bookmark-field">
                                <label htmlFor="import-access-type">Access type</label>
                                <div className="bookmark-select-wrap">
                                    <select
                                        id="import-access-type"
                                        value={accessType}
                                        onChange={(event) => {
                                            const nextValue = event.target.value;
                                            setAccessType(nextValue);
                                            if (nextValue !== 'role_based') {
                                                setSelectedRoleIds([]);
                                            }
                                        }}
                                        disabled={loading}
                                    >
                                        <option value="public">Public (all project members)</option>
                                        <option value="role_based" disabled={roles.length === 0}>Role-based access</option>
                                    </select>
                                </div>
                            </div>

                            {accessType === 'role_based' ? (
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
                                                        disabled={loading}
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
                        </div>
                    ) : null}
                </div>
            ) : null}

            {message ? (
                <p className="bookmark-feedback" style={{ marginTop: '12px' }}>
                    {message}
                </p>
            ) : null}
        </section>
    );
}
