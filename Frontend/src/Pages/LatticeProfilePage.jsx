import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CircleUserRound, ImageOff, LayoutGrid, ExternalLink, Pencil } from 'lucide-react';
import { LatticeFrame } from './LatticeFrame';
import { EditProfileModal } from '../components/EditProfileModal';
import { getCurrentSessionUser, getUserProfile, updateCurrentUserProfile, updateLatticeVisibility } from '../services/latticeApi';
import './LatticePages.css';

const getLatticeDescription = (lattice) => {
    if (typeof lattice?.description === 'string' && lattice.description.trim()) {
        return lattice.description.trim();
    }

    if (lattice?.projectType === 'collaborative') {
        return 'Shared public lattice for collaborative work.';
    }

    return 'Public personal lattice for selected ideas and bookmarks.';
};

const getAvatarContent = (user) => {
    if (user?.avatar) {
        return <img src={user.avatar} alt={user.name || 'Profile avatar'} className="profile-avatar-image" />;
    }

    return <CircleUserRound size={44} strokeWidth={1.7} />;
};

export const LatticeProfilePage = () => {
    const { userId } = useParams();
    const [profileUser, setProfileUser] = useState(null);
    const [lattices, setLattices] = useState([]);
    const [currentUserId, setCurrentUserId] = useState('');
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [updatingLatticeId, setUpdatingLatticeId] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const loadProfile = async () => {
            if (!userId) {
                setErrorMessage('Profile not found.');
                setLoading(false);
                return;
            }

            setLoading(true);
            setErrorMessage('');

            try {
                const [profileResponse, sessionUser] = await Promise.all([
                    getUserProfile(userId),
                    getCurrentSessionUser(),
                ]);

                if (!isMounted) {
                    return;
                }

                setProfileUser(profileResponse?.user || null);
                setLattices(Array.isArray(profileResponse?.lattices) ? profileResponse.lattices : []);
                setCurrentUserId(sessionUser?.id || sessionUser?._id || '');
            } catch (error) {
                if (!isMounted) {
                    return;
                }

                setErrorMessage(error.message || 'Unable to load profile.');
                setProfileUser(null);
                setLattices([]);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        void loadProfile();

        return () => {
            isMounted = false;
        };
    }, [userId]);

    const isOwner = useMemo(() => {
        if (!currentUserId || !profileUser?._id) {
            return false;
        }

        return String(currentUserId) === String(profileUser._id);
    }, [currentUserId, profileUser]);

    const handleVisibilityToggle = async (lattice) => {
        if (!isOwner || updatingLatticeId) {
            return;
        }

        const nextVisibility = !Boolean(lattice.isPublic);
        const previousLattices = lattices;

        setUpdatingLatticeId(lattice.id);

        if (!nextVisibility) {
            setLattices((previous) => previous.filter((item) => item.id !== lattice.id));
        } else {
            setLattices((previous) => previous.map((item) => (item.id === lattice.id ? { ...item, isPublic: nextVisibility } : item)));
        }

        try {
            const response = await updateLatticeVisibility(lattice.id, nextVisibility);
            const updatedLattice = response?.lattice;

            if (updatedLattice && nextVisibility) {
                setLattices((previous) => previous.map((item) => (item.id === lattice.id ? updatedLattice : item)));
            }
        } catch (error) {
            setLattices(previousLattices);
            setErrorMessage(error.message || 'Unable to update lattice visibility.');
        } finally {
            setUpdatingLatticeId('');
        }
    };

    const handleProfileSave = async (payload) => {
        const response = await updateCurrentUserProfile(payload);
        const updatedUser = response?.user || null;

        if (updatedUser) {
            setProfileUser((previous) => ({
                ...previous,
                _id: updatedUser.id || previous?._id,
                name: updatedUser.name || previous?.name,
                bio: updatedUser.bio || '',
                avatar: updatedUser.avatar || previous?.avatar || null,
            }));

            window.dispatchEvent(new CustomEvent('lattice:current-user-updated', {
                detail: updatedUser,
            }));
        }
    };

    return (
        <LatticeFrame>
            <div className="profile-page-container">
                <div className="profile-page-topbar">
                    <Link to="/lattice" className="profile-back-link">
                        <ArrowLeft size={14} />
                        Back to dashboard
                    </Link>
                    <span className="profile-page-kicker">
                        <LayoutGrid size={14} />
                        Public profile
                    </span>
                </div>

                {loading ? <p className="directory-status">Loading profile...</p> : null}
                {errorMessage ? <p className="directory-status directory-status-error">{errorMessage}</p> : null}

                {!loading && profileUser ? (
                    <section className="profile-hero-card">
                        <div className="profile-avatar-wrap">
                            <div className="profile-avatar">
                                {getAvatarContent(profileUser)}
                            </div>
                        </div>

                        <div className="profile-hero-copy">
                            <h1>{profileUser.name}</h1>
                            {profileUser.bio ? <p className="profile-bio">{profileUser.bio}</p> : <p className="profile-bio profile-bio-muted">No bio added yet.</p>}
                            <div className="profile-hero-meta">
                                <span>{lattices.length} public lattice{lattices.length === 1 ? '' : 's'}</span>
                                {isOwner ? <span className="profile-owner-chip">You are viewing your profile</span> : null}
                            </div>
                            {isOwner ? (
                                <div className="profile-hero-actions">
                                    <button type="button" className="profile-edit-btn" onClick={() => setIsEditModalOpen(true)}>
                                        <Pencil size={14} />
                                        Edit Profile
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </section>
                ) : null}

                {!loading && !errorMessage && lattices.length === 0 ? (
                    <div className="profile-empty-state">
                        <ImageOff size={22} />
                        <p>No public lattices yet</p>
                    </div>
                ) : null}

                {!loading && lattices.length > 0 ? (
                    <section className="profile-lattice-grid">
                        {lattices.map((lattice) => (
                            <article key={lattice.id} className="profile-lattice-card">
                                <div className="profile-lattice-card-head">
                                    <div>
                                        <span className="profile-lattice-pill">{lattice.projectType === 'collaborative' ? 'Collaborative' : 'Personal'}</span>
                                        <h3>{lattice.name}</h3>
                                    </div>
                                    {lattice.isPublic ? <span className="profile-lattice-status">Public</span> : null}
                                </div>

                                <p className="profile-lattice-description">{getLatticeDescription(lattice)}</p>

                                <div className="profile-lattice-actions">
                                    <Link
                                        to={`/lattice/project/${lattice.id}`}
                                        state={{ projectName: lattice.name, projectType: lattice.projectType }}
                                        className="profile-lattice-view-btn"
                                    >
                                        View
                                        <ExternalLink size={14} />
                                    </Link>

                                    {isOwner ? (
                                        <button
                                            type="button"
                                            className="profile-lattice-visibility-btn"
                                            onClick={() => void handleVisibilityToggle(lattice)}
                                            disabled={updatingLatticeId === lattice.id}
                                        >
                                            {lattice.isPublic ? 'Make Private' : 'Make Public'}
                                        </button>
                                    ) : null}
                                </div>
                            </article>
                        ))}
                    </section>
                ) : null}

                {isOwner && profileUser && isEditModalOpen ? (
                    <EditProfileModal
                        user={profileUser}
                        onClose={() => setIsEditModalOpen(false)}
                        onSave={handleProfileSave}
                    />
                ) : null}
            </div>
        </LatticeFrame>
    );
};
