import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ExternalLink, ImageOff, ArrowLeft } from 'lucide-react';
import { LatticeFrame } from './LatticeFrame';
import { apiRequest } from '../utils/api';
import './LatticePages.css';

export const LatticeProjectPage = () => {
    const { projectId } = useParams();
    const location = useLocation();
    const [links, setLinks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const projectName = useMemo(() => {
        const stateName = location.state?.projectName;
        if (typeof stateName === 'string' && stateName.trim()) {
            return stateName.trim();
        }

        return 'Project';
    }, [location.state]);

    useEffect(() => {
        let isMounted = true;

        const loadProjectLinks = async () => {
            if (!projectId) {
                setErrorMessage('Project not found.');
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setErrorMessage('');

            try {
                const response = await apiRequest(`/links?projectId=${projectId}`, { method: 'GET' });
                if (isMounted) {
                    setLinks(response?.links || []);
                }
            } catch (error) {
                if (isMounted) {
                    setErrorMessage(error.message || 'Unable to load bookmarks for this project.');
                    setLinks([]);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadProjectLinks();

        return () => {
            isMounted = false;
        };
    }, [projectId]);

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
                    <div className="project-page-count-pill">
                        {links.length} Bookmark{links.length === 1 ? '' : 's'}
                    </div>
                </header>

                {isLoading ? <p className="directory-status">Loading bookmarks...</p> : null}
                {errorMessage ? <p className="directory-status directory-status-error">{errorMessage}</p> : null}

                {!isLoading && !errorMessage && links.length === 0 ? (
                    <div className="project-empty-state">
                        <p>No bookmarks in this project yet.</p>
                        <Link to="/lattice" className="project-empty-cta">Add your first bookmark from Home</Link>
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
