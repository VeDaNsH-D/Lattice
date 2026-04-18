import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Globe, Lock, UserRound } from 'lucide-react';
import { LatticeFrame } from './LatticeFrame';
import { getCurrentSessionUser, getLatticeById } from '../services/latticeApi';
import { MembersList } from '../components/MembersList';
import './LatticePages.css';

export const LatticePublicPage = () => {
    const { latticeId } = useParams();
    const [lattice, setLattice] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusCode, setStatusCode] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        let isMounted = true;

        setLoading(true);
        setLattice(null);
        setCurrentUser(null);
        setStatusCode(0);
        setErrorMessage('');

        const loadLattice = async () => {
            if (!latticeId) {
                if (isMounted) {
                    setLoading(false);
                    setStatusCode(404);
                    setErrorMessage('Lattice not found.');
                }
                return;
            }

            try {
                const [sessionUser, latticeResponse] = await Promise.all([
                    getCurrentSessionUser(),
                    getLatticeById(latticeId),
                ]);

                if (!isMounted) {
                    return;
                }

                setCurrentUser(sessionUser || null);
                setLattice(latticeResponse?.lattice || null);
            } catch (error) {
                if (!isMounted) {
                    return;
                }

                const nextStatus = Number(error?.status || 500);
                setStatusCode(nextStatus);

                if (nextStatus === 401) {
                    setErrorMessage('Please login to view this lattice');
                } else if (nextStatus === 403) {
                    setErrorMessage('You do not have access to this lattice');
                } else {
                    setErrorMessage(error?.message || 'Unable to load lattice right now.');
                }
                setLattice(null);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        void loadLattice();

        return () => {
            isMounted = false;
        };
    }, [latticeId]);

    const isOwner = useMemo(() => {
        if (!lattice || !currentUser) {
            return false;
        }

        return String(currentUser.id || currentUser._id || '') === String(lattice.createdBy?.id || '');
    }, [currentUser, lattice]);

    if (loading) {
        return (
            <LatticeFrame>
                <div className="lattice-public-page">
                    <div className="lattice-public-card">
                        <p className="directory-status">Loading lattice...</p>
                    </div>
                </div>
            </LatticeFrame>
        );
    }

    if (!lattice) {
        return (
            <LatticeFrame>
                <div className="lattice-public-page">
                    <div className="lattice-public-card">
                        <h1>{statusCode === 401 ? 'Login Required' : statusCode === 403 ? 'Access Denied' : 'Lattice Unavailable'}</h1>
                        <p>{errorMessage}</p>
                        <div className="lattice-public-actions">
                            {statusCode === 401 ? <Link to="/login" className="lattice-public-btn">Go to Login</Link> : null}
                            <Link to="/" className="lattice-public-btn lattice-public-btn-ghost">Back to Home</Link>
                        </div>
                    </div>
                </div>
            </LatticeFrame>
        );
    }

    return (
        <LatticeFrame>
            <div className="lattice-public-page">
                <section className="lattice-public-card">
                    <div className="lattice-public-topbar">
                        <Link to="/" className="lattice-public-back-link">
                            <ArrowLeft size={14} />
                            Back
                        </Link>

                        <span className={`lattice-public-visibility ${lattice.isPublic ? 'is-public' : 'is-private'}`}>
                            {lattice.isPublic ? <Globe size={13} /> : <Lock size={13} />}
                            {lattice.isPublic ? 'Public' : 'Private'}
                        </span>
                    </div>

                    <h1>{lattice.name}</h1>

                    <p className="lattice-public-description">
                        {lattice.description || 'This lattice is available for viewing.'}
                    </p>

                    <div className="lattice-public-meta">
                        <span>
                            <UserRound size={14} />
                            {lattice.createdBy?.name || 'Unknown owner'}
                        </span>
                    </div>

                    <MembersList members={lattice.members} />

                    {isOwner ? (
                        <div className="lattice-public-actions">
                            <Link to={`/lattice/project/${lattice.id}`} className="lattice-public-btn">
                                Open in workspace
                                <ExternalLink size={14} />
                            </Link>
                        </div>
                    ) : null}
                </section>
            </div>
        </LatticeFrame>
    );
};
