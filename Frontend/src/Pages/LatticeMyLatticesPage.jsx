import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LatticeFrame } from './LatticeFrame';
import { BookOpen, PenTool, Code2, Share2, ArrowUpRight, Atom, Blocks, Plus, X, Link as LinkIcon, ChevronDown, SlidersHorizontal, ArrowDownUp, LayoutGrid, Lock, Unlock } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { updateLatticeVisibility } from '../services/latticeApi';
import './LatticePages.css';

const personalIcons = [BookOpen, PenTool, Code2, Share2];
const collaborativeIcons = [Blocks, ArrowUpRight, Atom, PenTool];

const pastelColors = ['#c5d0f6', '#e9e48f', '#f9c5d1', '#bbf7d0', '#fce7f3', '#e0e7ff'];

const renderProjectCards = (projects, icons, onProjectClick, onVisibilityToggle, visibilityLoadingId, idOffset = 0) => {
  if (!projects.length) {
    return <p className="directory-empty">No active projects yet.</p>;
  }

  return (
    <section className="modern-directory-grid">
      {projects.map((project, index) => {
        const IconComponent = icons[index % icons.length];
        const bgColor = pastelColors[(index + idOffset) % pastelColors.length];
        
        const description = project.projectType === 'collaborative'
          ? "We organize our workspaces with a focus on real-time strategy and mutual support."
          : "Fun and productive personal workspace for managing links and internal logic blocks.";
        const isPublic = Boolean(project.isPublic);

        return (
          <div
            className="modern-project-card"
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
            <div className="modern-project-top">
              <div className="modern-project-header">
                <div className="modern-project-header-group">
                  <span className="modern-project-badge">{project.memberCount * 2 + 10} modules</span>
                  <span className={`modern-project-visibility-pill ${isPublic ? 'is-public' : 'is-private'}`}>
                    {isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
                <div className="modern-project-arrow">
                  <ArrowUpRight size={18} strokeWidth={2.5} />
                </div>
              </div>
              <div className="modern-project-content">
                <h3 className="modern-project-title">
                  {project.name.split(' ').map((word, i) => <React.Fragment key={i}>{word}<br/></React.Fragment>)}
                </h3>
                <p className="modern-project-desc">{description}</p>
                {onVisibilityToggle ? (
                  <div className="modern-project-actions">
                    <button
                      type="button"
                      className="modern-project-visibility-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        onVisibilityToggle(project);
                      }}
                      disabled={visibilityLoadingId === project.id}
                    >
                      {isPublic ? <><Lock size={14} /> Make Private</> : <><Unlock size={14} /> Make Public</>}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            
            <div className="modern-project-graphic" style={{ backgroundColor: bgColor }}>
               <IconComponent size={100} strokeWidth={1} color="#111827" style={{ opacity: 0.9 }} />
            </div>
          </div>
        );
      })}
    </section>
  );
};

export const LatticeMyLatticesPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [personalProjects, setPersonalProjects] = useState([]);
  const [collaborativeProjects, setCollaborativeProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [creatingType, setCreatingType] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [modalError, setModalError] = useState('');
  const [visibilityLoadingId, setVisibilityLoadingId] = useState('');

  const isModalOpen = modalType !== null;
  const isForkedView = location.pathname === '/lattice/shared';

  const hasProjects = useMemo(
    () => personalProjects.length > 0 || collaborativeProjects.length > 0,
    [personalProjects.length, collaborativeProjects.length]
  );

  const allProjects = useMemo(
    () => [...personalProjects, ...collaborativeProjects],
    [personalProjects, collaborativeProjects]
  );

  const forkedProjects = useMemo(
    () => allProjects.filter((project) => Boolean(project.parentProjectId)),
    [allProjects]
  );

  const loadProjects = useCallback(async () => {
    setErrorMessage('');

    try {
      const response = await apiRequest('/projects', { method: 'GET' });
      const nextPersonal = response?.personalProjects || [];
      const nextCollaborative = response?.collaborativeProjects || [];

      setPersonalProjects(nextPersonal);
      setCollaborativeProjects(nextCollaborative);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load projects.');
    } finally {
      setLoading(false);
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
    const onOpenCreateModal = () => {
      openCreateModal('personal');
    };

    window.addEventListener('lattice:open-create-modal', onOpenCreateModal);

    return () => {
      window.removeEventListener('lattice:open-create-modal', onOpenCreateModal);
    };
  }, []);

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

  const onToggleVisibility = async (project) => {
    if (!project?.id || visibilityLoadingId) {
      return;
    }

    const nextVisibility = !Boolean(project.isPublic);
    const previousPersonal = personalProjects;
    const previousCollaborative = collaborativeProjects;

    setVisibilityLoadingId(project.id);

    const updateProjects = (list) => list.map((entry) => (entry.id === project.id ? { ...entry, isPublic: nextVisibility } : entry));

    if (nextVisibility) {
      setPersonalProjects((previous) => updateProjects(previous));
      setCollaborativeProjects((previous) => updateProjects(previous));
    } else {
      setPersonalProjects((previous) => previous.filter((entry) => entry.id !== project.id));
      setCollaborativeProjects((previous) => previous.filter((entry) => entry.id !== project.id));
    }

    try {
      const response = await updateLatticeVisibility(project.id, nextVisibility);
      const updatedLattice = response?.lattice;

      if (updatedLattice && nextVisibility) {
        setPersonalProjects((previous) => updateProjects(previous));
        setCollaborativeProjects((previous) => updateProjects(previous));
      }
    } catch (error) {
      setPersonalProjects(previousPersonal);
      setCollaborativeProjects(previousCollaborative);
      setErrorMessage(error.message || 'Unable to update lattice visibility.');
    } finally {
      setVisibilityLoadingId('');
    }
  };

  const onProjectOpen = (project) => {
    navigate(`/lattice/project/${project.id}`, {
      state: {
        projectName: project.name,
        projectType: project.projectType,
      },
    });
  };

  if (isForkedView) {
    return (
      <LatticeFrame>
        <div className="directory-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', margin: 0, letterSpacing: '-0.02em', color: '#111827' }}>Forked Lattices</h1>
              <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '0.95rem' }}>Projects you forked from other authors.</p>
            </div>
          </div>

          <header className="directory-dashboard-header">
            <div className="dash-header-title">
              <h2>Forked Repositories</h2>
              <span className="dash-header-count">{forkedProjects.length}</span>
            </div>
          </header>

          {loading ? <p className="directory-status">Loading forked lattices...</p> : renderProjectCards(forkedProjects, collaborativeIcons, onProjectOpen, null, visibilityLoadingId)}
          {!loading && forkedProjects.length === 0 ? <p className="directory-status">No forked lattices yet. Fork a public project from Home.</p> : null}
          {errorMessage ? <p className="directory-status directory-status-error">{errorMessage}</p> : null}
        </div>
      </LatticeFrame>
    );
  }

  return (
    <LatticeFrame>
      <div className="directory-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', margin: 0, letterSpacing: '-0.02em', color: '#111827' }}>My Lattices</h1>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '0.95rem' }}>Manage and explore your workspaces.</p>
          </div>
          <button 
            className="bookmark-submit-btn" 
            onClick={() => openCreateModal('personal')} 
            disabled={creatingType !== null}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} /> New Project
          </button>
        </div>

        <header className="directory-dashboard-header">
          <div className="dash-header-title">
            <h2>Personal Projects</h2>
            <span className="dash-header-count">{personalProjects.length}</span>
          </div>

          <div className="dash-header-controls">
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

        {loading ? <p className="directory-status">Loading projects...</p> : renderProjectCards(personalProjects, personalIcons, onProjectOpen, onToggleVisibility, visibilityLoadingId)}

        <header className="directory-dashboard-header" style={{ marginTop: '50px' }}>
          <div className="dash-header-title">
            <h2>Group Projects</h2>
            <span className="dash-header-count">{collaborativeProjects.length}</span>
          </div>

          <div className="dash-header-controls">
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

        {loading ? null : renderProjectCards(collaborativeProjects, collaborativeIcons, onProjectOpen, onToggleVisibility, visibilityLoadingId, 50)}

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

              <h3 className="project-modal-title">Create New Project</h3>
              <p className="project-modal-subtitle">
                Give your project a clear name and select its workspace type.
              </p>

              <form onSubmit={onCreateProject} className="project-modal-form">
                <label htmlFor="project-name" className="project-modal-label">Project Name</label>
                <input
                  id="project-name"
                  className="project-modal-input"
                  type="text"
                  placeholder="e.g., Growth Sprint Q2"
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  maxLength={80}
                  autoFocus
                  disabled={creatingType !== null}
                />
                
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#374151', cursor: 'pointer' }}>
                     <input type="radio" name="projectType" value="personal" checked={modalType === 'personal'} onChange={() => setModalType('personal')} disabled={creatingType !== null} />
                     Personal Workspace
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#374151', cursor: 'pointer' }}>
                     <input type="radio" name="projectType" value="collaborative" checked={modalType === 'collaborative'} onChange={() => setModalType('collaborative')} disabled={creatingType !== null} />
                     Group Workspace
                  </label>
                </div>

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
