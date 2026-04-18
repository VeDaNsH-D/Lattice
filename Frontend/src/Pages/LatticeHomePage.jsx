import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LatticeFrame } from './LatticeFrame';
import { BookOpen, PenTool, Code2, Share2, ArrowUpRight, Atom, Blocks, Plus, X, Link as LinkIcon, ChevronDown, SlidersHorizontal, ArrowDownUp, LayoutGrid, Command, Search, Users, GitFork, CircleUserRound, Sparkles } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { forkPublicProject, searchDiscover } from '../services/latticeApi';
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
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [discoverUsers, setDiscoverUsers] = useState([]);
  const [discoverProjects, setDiscoverProjects] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState('');
  const [selectedDiscoverUserId, setSelectedDiscoverUserId] = useState('');

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

  const selectedDiscoverUser = useMemo(
    () => discoverUsers.find((user) => user.id === selectedDiscoverUserId) || null,
    [discoverUsers, selectedDiscoverUserId]
  );

  const filteredDiscoverProjects = useMemo(() => {
    if (!selectedDiscoverUserId) {
      return discoverProjects;
    }

    return discoverProjects.filter((project) => String(project.createdBy?.id || project.createdBy?._id || '') === String(selectedDiscoverUserId));
  }, [discoverProjects, selectedDiscoverUserId]);

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

  useEffect(() => {
    let isMounted = true;

    const loadDiscover = async () => {
      setDiscoverLoading(true);
      setDiscoverError('');

      try {
        const response = await searchDiscover({
          query: discoverQuery.trim(),
          limit: 12,
        });

        if (!isMounted) {
          return;
        }

        const nextUsers = Array.isArray(response?.users) ? response.users : [];
        const nextProjects = Array.isArray(response?.projects) ? response.projects : [];

        setDiscoverUsers(nextUsers);
        setDiscoverProjects(nextProjects);
        setSelectedDiscoverUserId((previous) => {
          if (nextUsers.some((user) => user.id === previous)) {
            return previous;
          }

          return nextUsers[0]?.id || '';
        });
      } catch (error) {
        if (isMounted) {
          setDiscoverUsers([]);
          setDiscoverProjects([]);
          setDiscoverError(error.message || 'Unable to search public people and projects.');
        }
      } finally {
        if (isMounted) {
          setDiscoverLoading(false);
        }
      }
    };

    const timer = window.setTimeout(() => {
      void loadDiscover();
    }, 240);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [discoverQuery]);

  const handleForkPublicProject = async (project) => {
    const projectId = project?.id;
    if (!projectId) {
      return;
    }

    try {
      setDiscoverError('');
      const response = await forkPublicProject(projectId);
      const forkedProject = response?.project;

      if (forkedProject?.id) {
        navigate(`/lattice/project/${forkedProject.id}`, {
          state: {
            projectName: forkedProject.name,
            projectType: forkedProject.projectType,
          },
        });
      }
    } catch (error) {
      setDiscoverError(error.message || 'Unable to fork project.');
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
      <div className="lattice-home-hero">
        <div className="lattice-home-mesh" />

        <div className="lattice-home-hero-content">
          <div className="lattice-hero-rings" style={{ marginBottom: '16px' }}>
            <Command size={64} strokeWidth={1.2} color="#111" />
          </div>
          
          <p className="lattice-hero-subtitle">Capture a link and assign access in one step.</p>
          <h1 className="lattice-hero-title">Data-Powered<br />Workspace Intelligence.</h1>

          <form className="lattice-hero-form" onSubmit={onSubmitBookmark}>
             <div className="lattice-hero-input-group tall">
                <input 
                  type="url" 
                  placeholder="Type a link or URL..." 
                  value={bookmarkUrl}
                  onChange={(e) => setBookmarkUrl(e.target.value)}
                  className="lattice-hero-input"
                  required
                />
                
                <div className="lattice-hero-options-inline">
                  <div className="lattice-hero-select-wrap" style={{width: '200px', flexShrink: 0}}>
                    <select
                      value={bookmarkProjectSelection}
                      onChange={(e) => setBookmarkProjectSelection(e.target.value)}
                      className="lattice-hero-select-subtle"
                    >
                      <option value="">Select project...</option>
                      {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      <option value="__new__">+ New project...</option>
                    </select>
                    <ChevronDown size={14} className="hero-select-chevron" />
                  </div>
                  
                  {isBookmarkNewProject && (
                    <>
                      <input 
                        type="text" 
                        placeholder="Project name"
                        value={bookmarkNewProjectName}
                        onChange={(e) => setBookmarkNewProjectName(e.target.value)}
                        className="lattice-hero-select-subtle name-input"
                      />
                      <div className="lattice-hero-select-wrap" style={{width: '120px', flexShrink: 0}}>
                        <select
                          value={bookmarkProjectType}
                          onChange={(e) => setBookmarkProjectType(e.target.value)}
                          className="lattice-hero-select-subtle"
                        >
                          <option value="personal">Personal</option>
                          <option value="collaborative">Group</option>
                        </select>
                        <ChevronDown size={14} className="hero-select-chevron" />
                      </div>
                    </>
                  )}
                </div>
             </div>

             <button type="submit" className="lattice-hero-submit" disabled={bookmarkSubmitting}>
               {bookmarkSubmitting ? 'Saving...' : 'Add Link \u2192'}
             </button>

             {bookmarkError && <p className="hero-feedback-error">{bookmarkError}</p>}
             {bookmarkSuccess && <p className="hero-feedback-success">{bookmarkSuccess}</p>}
          </form>
        </div>
      </div>

      <section className="home-discovery-panel">
        <div className="home-discovery-header">
          <div>
            <p className="home-discovery-kicker">Discover people & public spaces</p>
            <h2>Search another user's profile and fork a public project</h2>
          </div>

          <div className="home-discovery-searchbar">
            <Search size={16} />
            <input
              type="search"
              value={discoverQuery}
              onChange={(event) => setDiscoverQuery(event.target.value)}
              placeholder="Search a person or public project..."
              aria-label="Search users and public projects"
            />
          </div>
        </div>

        {discoverError ? <p className="home-discovery-error">{discoverError}</p> : null}

        <div className="home-discovery-grid">
          <section className="home-discovery-column">
            <div className="home-discovery-section-head">
              <h3><Users size={16} /> User profiles</h3>
              <span>{discoverUsers.length}</span>
            </div>

            <div className="home-user-grid">
              {discoverLoading ? (
                <div className="home-discovery-empty">Searching profiles...</div>
              ) : discoverUsers.length ? discoverUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className={`home-user-card ${selectedDiscoverUserId === user.id ? 'active' : ''}`}
                  onClick={() => setSelectedDiscoverUserId(user.id)}
                >
                  <span className="home-user-avatar">
                    {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} /> : <CircleUserRound size={18} />}
                  </span>
                  <span className="home-user-copy">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                    <em>{user.publicProjectCount || 0} public project{(user.publicProjectCount || 0) === 1 ? '' : 's'}</em>
                  </span>
                  <span className="home-user-chip">{user.publicProjectCount || 0}</span>
                </button>
              )) : (
                <div className="home-discovery-empty">No profiles matched.</div>
              )}
            </div>

            {selectedDiscoverUser ? (
              <div className="home-selected-user-projects">
                <p className="home-discovery-section-subhead">
                  Public spaces by {selectedDiscoverUser.name}
                </p>

                {selectedDiscoverUser.publicProjects?.length ? (
                  <div className="home-mini-project-list">
                    {selectedDiscoverUser.publicProjects.map((project) => (
                      <div key={project.id} className="home-mini-project-item">
                        <div>
                          <strong>{project.name}</strong>
                          <span>{project.lineageDepth > 0 ? `Remix depth ${project.lineageDepth}` : 'Original shelf'}</span>
                        </div>
                        <button type="button" onClick={() => void handleForkPublicProject(project)}>
                          <GitFork size={14} /> Fork
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="home-discovery-empty">This user has no public projects yet.</div>
                )}
              </div>
            ) : null}
          </section>

          <section className="home-discovery-column wide">
            <div className="home-discovery-section-head">
              <h3><Sparkles size={16} /> Public projects</h3>
              <span>{filteredDiscoverProjects.length}</span>
            </div>

            <div className="home-public-project-grid">
              {discoverLoading ? (
                <div className="home-discovery-empty">Loading public projects...</div>
              ) : filteredDiscoverProjects.length ? filteredDiscoverProjects.map((project) => (
                <article key={project.id} className="home-public-project-card">
                  <div className="home-public-project-topline">
                    <span className="home-public-project-owner">
                      {project.createdBy?.avatarUrl ? <img src={project.createdBy.avatarUrl} alt={project.createdBy.name} /> : <CircleUserRound size={14} />}
                      {project.createdBy?.name || 'Unknown curator'}
                    </span>
                    <span className="home-public-project-pill">Public</span>
                  </div>
                  <h4>{project.name}</h4>
                  <p>{project.kind === 'collaborative' ? 'Collaborative public shelf' : 'Personal public shelf'}</p>
                  <div className="home-public-project-footer">
                    <span>{project.remixCount || 0} remixes</span>
                    <button type="button" onClick={() => void handleForkPublicProject(project)}>
                      <GitFork size={14} /> Fork for me
                    </button>
                  </div>
                </article>
              )) : (
                <div className="home-discovery-empty">No public projects found.</div>
              )}
            </div>
          </section>
        </div>
      </section>
    </LatticeFrame>
  );
};
