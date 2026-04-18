import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LatticeFrame } from './LatticeFrame';
import { BookOpen, PenTool, Code2, Share2, ArrowUpRight, Atom, Blocks, Plus } from 'lucide-react';
import { apiRequest } from '../utils/api';
import './LatticePages.css';

const personalIcons = [BookOpen, PenTool, Code2, Share2];
const collaborativeIcons = [Blocks, ArrowUpRight, Atom, PenTool];

const renderProjectCards = (projects, icons, idOffset = 0) => {
  if (!projects.length) {
    return <p className="directory-empty">No active projects yet.</p>;
  }

  return (
    <section className="directory-grid">
      {projects.map((project, index) => {
        const IconComponent = icons[index % icons.length];
        const displayIndex = String(index + 1 + idOffset).padStart(2, '0');

        return (
          <div className="dir-card" key={project.id}>
            <div className="dir-hover-bg"></div>

            <div className="dir-index">{`{ ${displayIndex} }`}</div>

            <div className="dir-icon-wrapper">
              <div className="dir-icon-blob"></div>
              <div className="dir-icon"><IconComponent color="#7a9b3e" size={26} /></div>
            </div>

            <div className="dir-bottom">
              <h3 className="dir-title">{project.name.toUpperCase()}</h3>
              <div className="dir-meta">
                <span>{project.createdBy?.name || 'You'}</span>
                <span className="dir-line"></span>
                <span>{project.memberCount} Member{project.memberCount === 1 ? '' : 's'}</span>
              </div>
            </div>

            <div className="dir-action-circle">
              <ArrowUpRight size={18} strokeWidth={2.5} color="#5e8027" />
            </div>
          </div>
        );
      })}
    </section>
  );
};

export const LatticeHomePage = () => {
  const [personalProjects, setPersonalProjects] = useState([]);
  const [collaborativeProjects, setCollaborativeProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [creatingType, setCreatingType] = useState(null);

  const hasProjects = useMemo(
    () => personalProjects.length > 0 || collaborativeProjects.length > 0,
    [personalProjects.length, collaborativeProjects.length]
  );

  const loadProjects = useCallback(async () => {
    setErrorMessage('');

    try {
      const response = await apiRequest('/projects', { method: 'GET' });
      setPersonalProjects(response?.personalProjects || []);
      setCollaborativeProjects(response?.collaborativeProjects || []);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const onCreateProject = async (projectType) => {
    const promptTitle = projectType === 'personal' ? 'New personal project name' : 'New collaborative project name';
    const name = window.prompt(promptTitle, '');

    if (!name || !name.trim()) {
      return;
    }

    setCreatingType(projectType);
    setErrorMessage('');

    try {
      await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          projectType,
        }),
      });

      await loadProjects();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to create project.');
    } finally {
      setCreatingType(null);
    }
  };

  return (
    <LatticeFrame>
      <div className="directory-container">
        <header className="directory-header directory-header-row">
          <h2>Personal Hub</h2>
          <button
            type="button"
            className="directory-create-btn"
            onClick={() => onCreateProject('personal')}
            disabled={creatingType !== null}
          >
            <Plus size={16} />
            {creatingType === 'personal' ? 'Creating...' : 'New Personal Project'}
          </button>
        </header>

        {loading ? <p className="directory-status">Loading projects...</p> : renderProjectCards(personalProjects, personalIcons)}

        <header className="directory-header directory-header-row" style={{ marginTop: '60px' }}>
          <h2>Collaborative Hub</h2>
          <button
            type="button"
            className="directory-create-btn"
            onClick={() => onCreateProject('collaborative')}
            disabled={creatingType !== null}
          >
            <Plus size={16} />
            {creatingType === 'collaborative' ? 'Creating...' : 'New Collaborative Project'}
          </button>
        </header>

        {loading ? null : renderProjectCards(collaborativeProjects, collaborativeIcons, 50)}

        {errorMessage ? <p className="directory-status directory-status-error">{errorMessage}</p> : null}
        {!loading && !hasProjects ? <p className="directory-status">Create your first project to get started.</p> : null}

      </div>
    </LatticeFrame>
  );
};
