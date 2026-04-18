import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LatticeFrame } from './LatticeFrame';
import { BookOpen, PenTool, Code2, Share2, ArrowUpRight, Atom, Blocks, Plus, X, Link as LinkIcon, ChevronDown, SlidersHorizontal, ArrowDownUp, LayoutGrid } from 'lucide-react';
import { apiRequest } from '../utils/api';
import './LatticePages.css';

const personalIcons = [BookOpen, PenTool, Code2, Share2];
const collaborativeIcons = [Blocks, ArrowUpRight, Atom, PenTool];

const renderProjectCards = (projects, icons, onProjectClick, idOffset = 0) => {
  if (!projects.length) {
    return <p className="directory-empty">No active projects yet.</p>;
  }

  return (
    <section className="directory-grid">
      {projects.map((project, index) => {
        const IconComponent = icons[index % icons.length];
        const displayIndex = String(index + 1 + idOffset).padStart(2, '0');
        const variantIndex = index % 6;

        return (
          <div
            className={`dir-card dir-variant-${variantIndex}`}
            key={project.id}
            role="button"
            tabIndex={0}
            onClick={() => onProjectClick(project)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onProjectClick(project);
              }
            }}
          >
            <div className="dir-top-meta">
              <span className="dir-lessons-badge">{project.memberCount * 2 + 10} modules</span>
              <div className="dir-action-circle" style={{ opacity: 1, position: 'relative', bottom: 'auto', right: 'auto', transform: 'none', background: 'transparent', boxShadow: 'none', width: 'auto', height: 'auto'}}>
                <span style={{fontSize: '0.8rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500'}}>
                  {project.projectType === 'collaborative' ? 'Shared' : 'Private'} <ArrowUpRight size={14} strokeWidth={2.5} color="#6b7280" />
                </span>
              </div>
            </div>

            <div className="dir-icon-area">
               <div className="dir-icon-squircle">
                 <IconComponent size={32} />
               </div>
            </div>

            <div className="dir-tags">
              <span className="dir-tag">{project.projectType === 'personal' ? 'UX design' : 'Architecture'}</span>
              <span className="dir-tag">{index % 2 === 0 ? 'Visual design' : 'System logic'}</span>
            </div>

            <h3 className="dir-title">{project.name}</h3>

            <div className="dir-bottom">
              <span className="dir-level">Level: <strong style={{color: '#374151'}}>{index % 3 === 0 ? 'Advance' : index % 2 === 0 ? 'Medium' : 'Junior'}</strong></span>
              <div className="dir-progress-wrap">
                <span style={{color: '#6b7280', fontWeight: '500'}}>Progress:</span>
                <div className="dir-progress-ring"></div>
                <span>{index * 15 + 10}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
};

export const LatticeHomePage = () => {
  const navigate = useNavigate();
  const [personalProjects, setPersonalProjects] = useState([]);
  const [collaborativeProjects, setCollaborativeProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [creatingType, setCreatingType] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [modalError, setModalError] = useState('');
  const [bookmarkUrl, setBookmarkUrl] = useState('');
  const [bookmarkProjectSelection, setBookmarkProjectSelection] = useState('');
  const [bookmarkProjectType, setBookmarkProjectType] = useState('personal');
  const [bookmarkNewProjectName, setBookmarkNewProjectName] = useState('');
  const [bookmarkAccessType, setBookmarkAccessType] = useState('public');
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [rolesByProject, setRolesByProject] = useState({});
  const [bookmarkSubmitting, setBookmarkSubmitting] = useState(false);
  const [bookmarkError, setBookmarkError] = useState('');
  const [bookmarkSuccess, setBookmarkSuccess] = useState('');

  const isModalOpen = modalType !== null;

  const hasProjects = useMemo(
    () => personalProjects.length > 0 || collaborativeProjects.length > 0,
    [personalProjects.length, collaborativeProjects.length]
  );

  const allProjects = useMemo(
    () => [...personalProjects, ...collaborativeProjects],
    [personalProjects, collaborativeProjects]
  );

  const isBookmarkNewProject = bookmarkProjectSelection === '__new__';
  const selectedProjectRoles = !isBookmarkNewProject
    ? rolesByProject[bookmarkProjectSelection] || []
    : [];

  const loadProjects = useCallback(async () => {
    setErrorMessage('');

    try {
      const response = await apiRequest('/projects', { method: 'GET' });
      const nextPersonal = response?.personalProjects || [];
      const nextCollaborative = response?.collaborativeProjects || [];

      setPersonalProjects(nextPersonal);
      setCollaborativeProjects(nextCollaborative);

      const nextAllProjects = [...nextPersonal, ...nextCollaborative];
      if (nextAllProjects.length > 0) {
        setBookmarkProjectSelection((previousSelection) => {
          if (previousSelection === '__new__') {
            return previousSelection;
          }

          if (nextAllProjects.some((project) => project.id === previousSelection)) {
            return previousSelection;
          }

          return nextAllProjects[0].id;
        });
      }
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRolesForProject = useCallback(async (projectId) => {
    if (!projectId || projectId === '__new__') {
      return;
    }

    try {
      const response = await apiRequest(`/roles?projectId=${projectId}`, { method: 'GET' });
      setRolesByProject((previous) => ({
        ...previous,
        [projectId]: response?.roles || []
      }));
    } catch {
      setRolesByProject((previous) => ({
        ...previous,
        [projectId]: []
      }));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProjects();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadProjects]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (bookmarkProjectSelection && bookmarkProjectSelection !== '__new__') {
        setSelectedRoleIds([]);
        setBookmarkAccessType('public');
        void loadRolesForProject(bookmarkProjectSelection);
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [bookmarkProjectSelection, loadRolesForProject]);

  const openCreateModal = (projectType) => {
    setModalType(projectType);
    setNewProjectName('');
    setModalError('');
  };

  const closeCreateModal = () => {
    if (creatingType !== null) {
      return;
    }

    setModalType(null);
    setNewProjectName('');
    setModalError('');
  };

  const onCreateProject = async (event) => {
    event.preventDefault();

    if (!modalType) {
      return;
    }

    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
      setModalError('Project name is required.');
      return;
    }

    setCreatingType(modalType);
    setErrorMessage('');
    setModalError('');

    try {
      await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          projectType: modalType,
        }),
      });

      closeCreateModal();
      await loadProjects();
    } catch (error) {
      const message = error.message || 'Unable to create project.';
      setModalError(message);
      setErrorMessage(message);
    } finally {
      setCreatingType(null);
    }
  };

  const onSubmitBookmark = async (event) => {
    event.preventDefault();

    const trimmedUrl = bookmarkUrl.trim();
    if (!trimmedUrl) {
      setBookmarkError('Bookmark URL is required.');
      return;
    }

    let resolvedProjectId = bookmarkProjectSelection;

    if (!bookmarkProjectSelection) {
      setBookmarkError('Select a project or create a new one.');
      return;
    }

    if (isBookmarkNewProject) {
      const trimmedProjectName = bookmarkNewProjectName.trim();

      if (!trimmedProjectName) {
        setBookmarkError('New project name is required.');
        return;
      }

      setBookmarkSubmitting(true);
      setBookmarkError('');
      setBookmarkSuccess('');

      try {
        const createdProjectResponse = await apiRequest('/projects', {
          method: 'POST',
          body: JSON.stringify({
            name: trimmedProjectName,
            projectType: bookmarkProjectType,
          }),
        });

        resolvedProjectId = createdProjectResponse?.project?.id;

        if (!resolvedProjectId) {
          throw new Error('Failed to create project for bookmark.');
        }

        await loadProjects();
        setBookmarkProjectSelection(resolvedProjectId);
      } catch (error) {
        setBookmarkError(error.message || 'Unable to create project for bookmark.');
        setBookmarkSubmitting(false);
        return;
      }
    }

    if (!resolvedProjectId || resolvedProjectId === '__new__') {
      setBookmarkError('Please choose a valid project.');
      setBookmarkSubmitting(false);
      return;
    }

    if (bookmarkAccessType === 'role_based' && selectedRoleIds.length === 0) {
      setBookmarkError('Select at least one role for role-based access.');
      setBookmarkSubmitting(false);
      return;
    }

    setBookmarkSubmitting(true);
    setBookmarkError('');
    setBookmarkSuccess('');

    try {
      await apiRequest('/links', {
        method: 'POST',
        body: JSON.stringify({
          projectId: resolvedProjectId,
          url: trimmedUrl,
          accessType: bookmarkAccessType,
          allowedRoles: bookmarkAccessType === 'role_based' ? selectedRoleIds : [],
        }),
      });

      setBookmarkUrl('');
      setSelectedRoleIds([]);
      setBookmarkAccessType('public');
      setBookmarkSuccess('Bookmark added successfully.');
    } catch (error) {
      setBookmarkError(error.message || 'Unable to add bookmark.');
    } finally {
      setBookmarkSubmitting(false);
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

  const onProjectOpen = (project) => {
    navigate(`/lattice/project/${project.id}`, {
      state: {
        projectName: project.name,
        projectType: project.projectType,
      },
    });
  };

  return (
    <LatticeFrame>
      <div className="directory-container">
        <section className="bookmark-entry-panel">
          <div className="bookmark-entry-head">
            <div className="bookmark-entry-title-wrap">
              <span className="bookmark-entry-icon"><LinkIcon size={16} /></span>
              <h3>Add New Bookmark</h3>
            </div>
            <p>Capture a link and assign access in one step.</p>
          </div>

          <form className="bookmark-entry-form" onSubmit={onSubmitBookmark}>
            <div className="bookmark-grid">
              <div className="bookmark-field bookmark-field-wide">
                <label htmlFor="bookmark-url">Link URL</label>
                <input
                  id="bookmark-url"
                  type="url"
                  placeholder="https://example.com/interesting-article"
                  value={bookmarkUrl}
                  onChange={(event) => setBookmarkUrl(event.target.value)}
                  disabled={bookmarkSubmitting}
                  required
                />
              </div>

              <div className="bookmark-field">
                <label htmlFor="bookmark-project-select">Project</label>
                <div className="bookmark-select-wrap">
                  <select
                    id="bookmark-project-select"
                    value={bookmarkProjectSelection}
                    onChange={(event) => setBookmarkProjectSelection(event.target.value)}
                    disabled={bookmarkSubmitting}
                  >
                    <option value="">Select project</option>
                    {allProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                    <option value="__new__">+ Add to new project</option>
                  </select>
                  <ChevronDown size={16} className="bookmark-select-chevron" />
                </div>
              </div>

              {isBookmarkNewProject ? (
                <>
                  <div className="bookmark-field">
                    <label htmlFor="bookmark-new-project-name">New project name</label>
                    <input
                      id="bookmark-new-project-name"
                      type="text"
                      placeholder="Project name"
                      value={bookmarkNewProjectName}
                      onChange={(event) => setBookmarkNewProjectName(event.target.value)}
                      disabled={bookmarkSubmitting}
                    />
                  </div>
                  <div className="bookmark-field">
                    <label htmlFor="bookmark-new-project-type">Project type</label>
                    <div className="bookmark-select-wrap">
                      <select
                        id="bookmark-new-project-type"
                        value={bookmarkProjectType}
                        onChange={(event) => setBookmarkProjectType(event.target.value)}
                        disabled={bookmarkSubmitting}
                      >
                        <option value="personal">Personal</option>
                        <option value="collaborative">Collaborative</option>
                      </select>
                      <ChevronDown size={16} className="bookmark-select-chevron" />
                    </div>
                  </div>
                </>
              ) : null}

              <div className="bookmark-field">
                <label htmlFor="bookmark-access-type">Access type</label>
                <div className="bookmark-select-wrap">
                  <select
                    id="bookmark-access-type"
                    value={bookmarkAccessType}
                    onChange={(event) => setBookmarkAccessType(event.target.value)}
                    disabled={bookmarkSubmitting || isBookmarkNewProject}
                  >
                    <option value="public">Public (all project members)</option>
                    <option value="role_based" disabled={selectedProjectRoles.length === 0}>
                      Role-based access
                    </option>
                  </select>
                  <ChevronDown size={16} className="bookmark-select-chevron" />
                </div>
              </div>
            </div>

            {bookmarkAccessType === 'role_based' && !isBookmarkNewProject ? (
              <div className="bookmark-role-section">
                <p className="bookmark-role-label">Roles with access</p>
                {selectedProjectRoles.length ? (
                  <div className="bookmark-role-list">
                    {selectedProjectRoles.map((role) => (
                      <label key={role.id} className="bookmark-role-chip">
                        <input
                          type="checkbox"
                          checked={selectedRoleIds.includes(role.id)}
                          onChange={() => onRoleToggle(role.id)}
                          disabled={bookmarkSubmitting}
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

            {bookmarkError ? <p className="bookmark-feedback bookmark-feedback-error">{bookmarkError}</p> : null}
            {bookmarkSuccess ? <p className="bookmark-feedback bookmark-feedback-success">{bookmarkSuccess}</p> : null}

            <div className="bookmark-actions">
              <button
                type="submit"
                className="bookmark-submit-btn"
                disabled={bookmarkSubmitting}
              >
                {bookmarkSubmitting ? 'Saving bookmark...' : 'Add Bookmark'}
              </button>
            </div>
          </form>
        </section>

        <header className="directory-dashboard-header">
          <div className="dash-header-title">
            <h2>Personal Projects</h2>
            <span className="dash-header-count">{personalProjects.length}</span>
          </div>

          <div className="dash-header-controls">
            <button 
              className="dash-control-btn" 
              onClick={() => openCreateModal('personal')} 
              disabled={creatingType !== null}
              style={{ background: '#111827', color: '#fff', border: 'none' }}
            >
              <Plus size={14} /> New Personal Project
            </button>
            <div style={{width: 1, height: 24, background: 'rgba(0,0,0,0.1)', margin: '0 6px'}} />
            <button className="dash-control-btn">
              <SlidersHorizontal size={14} /> Filter
            </button>
            <button className="dash-control-btn">
              <ArrowDownUp size={14} /> Sort
            </button>
            <button className="dash-control-btn-icon">
              <LayoutGrid size={16} />
            </button>
          </div>
        </header>

        {loading ? <p className="directory-status">Loading projects...</p> : renderProjectCards(personalProjects, personalIcons, onProjectOpen)}

        <header className="directory-dashboard-header" style={{ marginTop: '50px' }}>
          <div className="dash-header-title">
            <h2>Group Projects</h2>
            <span className="dash-header-count">{collaborativeProjects.length}</span>
          </div>

          <div className="dash-header-controls">
            <button 
              className="dash-control-btn" 
              onClick={() => openCreateModal('collaborative')} 
              disabled={creatingType !== null}
              style={{ background: '#111827', color: '#fff', border: 'none' }}
            >
              <Plus size={14} /> New Group Project
            </button>
            <div style={{width: 1, height: 24, background: 'rgba(0,0,0,0.1)', margin: '0 6px'}} />
            <button className="dash-control-btn">
              <SlidersHorizontal size={14} /> Filter
            </button>
            <button className="dash-control-btn">
              <ArrowDownUp size={14} /> Sort
            </button>
            <button className="dash-control-btn-icon">
              <LayoutGrid size={16} />
            </button>
          </div>
        </header>

        {loading ? null : renderProjectCards(collaborativeProjects, collaborativeIcons, onProjectOpen, 50)}

        {errorMessage ? <p className="directory-status directory-status-error">{errorMessage}</p> : null}
        {!loading && !hasProjects ? <p className="directory-status">Create your first project to get started.</p> : null}

        {isModalOpen ? (
          <div className="project-modal-backdrop" onClick={closeCreateModal}>
            <div className="project-modal" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="project-modal-close"
                onClick={closeCreateModal}
                aria-label="Close create project dialog"
              >
                <X size={16} />
              </button>

              <h3 className="project-modal-title">
                {modalType === 'collaborative' ? 'Create collaborative project' : 'Create personal project'}
              </h3>
              <p className="project-modal-subtitle">
                Give your project a clear name. You can refine details later.
              </p>

              <form onSubmit={onCreateProject} className="project-modal-form">
                <label htmlFor="project-name" className="project-modal-label">Project name</label>
                <input
                  id="project-name"
                  className="project-modal-input"
                  type="text"
                  placeholder={modalType === 'collaborative' ? 'Growth Sprint Q2' : 'AI Research Notes'}
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  maxLength={80}
                  autoFocus
                  disabled={creatingType !== null}
                />

                {modalError ? <p className="project-modal-error">{modalError}</p> : null}

                <div className="project-modal-actions">
                  <button
                    type="button"
                    className="project-modal-btn project-modal-btn-ghost"
                    onClick={closeCreateModal}
                    disabled={creatingType !== null}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="project-modal-btn project-modal-btn-primary"
                    disabled={creatingType !== null}
                  >
                    {creatingType === modalType ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

      </div>
    </LatticeFrame>
  );
};
