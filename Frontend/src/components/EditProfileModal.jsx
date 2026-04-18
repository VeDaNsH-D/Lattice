import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export const EditProfileModal = ({ user, onClose, onSave }) => {
    const [name, setName] = useState(user?.name || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [avatar, setAvatar] = useState(user?.avatar || '');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = useCallback(() => {
        if (isClosing) {
            return;
        }

        setIsClosing(true);
        window.setTimeout(() => {
            onClose();
        }, 160);
    }, [isClosing, onClose]);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                handleClose();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [handleClose]);

    useEffect(() => {
        setName(user?.name || '');
        setBio(user?.bio || '');
        setAvatar(user?.avatar || '');
    }, [user]);

    const initialValues = useMemo(() => ({
        name: user?.name || '',
        bio: user?.bio || '',
        avatar: user?.avatar || '',
    }), [user]);

    const handleBackdropClick = (event) => {
        if (event.target === event.currentTarget) {
            handleClose();
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        const payload = {};

        if (name.trim() !== initialValues.name) {
            payload.name = name.trim();
        }

        if (bio.trim() !== initialValues.bio) {
            payload.bio = bio.trim();
        }

        const nextAvatar = avatar.trim();
        if (nextAvatar && nextAvatar !== initialValues.avatar) {
            payload.avatar = nextAvatar;
        }

        if (!Object.keys(payload).length || isSaving) {
            if (!Object.keys(payload).length) {
                handleClose();
            }

            return;
        }

        setIsSaving(true);
        setErrorMessage('');

        try {
            await onSave(payload);
            onClose();
        } catch (error) {
            setErrorMessage(error?.message || 'Unable to update profile.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) {
        return null;
    }

    return createPortal(
        <div className={`edit-profile-modal-backdrop ${isClosing ? 'is-closing' : ''}`} onMouseDown={handleBackdropClick} role="dialog" aria-modal="true">
            <div className={`edit-profile-modal ${isClosing ? 'is-closing' : ''}`} onMouseDown={(event) => event.stopPropagation()}>
                <div className="edit-profile-modal-header">
                    <div>
                        <h3>Edit Profile</h3>
                        <p>Update your name, bio, and avatar.</p>
                    </div>
                    <button type="button" className="edit-profile-modal-close" onClick={handleClose} aria-label="Close edit profile dialog">
                        <X size={16} />
                    </button>
                </div>

                <form className="edit-profile-modal-form" onSubmit={handleSubmit}>
                    <label className="edit-profile-field">
                        <span>Name</span>
                        <input type="text" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} disabled={isSaving} />
                    </label>

                    <label className="edit-profile-field">
                        <span>Bio</span>
                        <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={240} rows={4} disabled={isSaving} />
                    </label>

                    <label className="edit-profile-field">
                        <span>Avatar URL</span>
                        <input type="url" value={avatar} onChange={(event) => setAvatar(event.target.value)} placeholder="https://example.com/avatar.jpg" disabled={isSaving} />
                        <small>Leave blank to keep your current avatar.</small>
                    </label>

                    {errorMessage ? <p className="edit-profile-error">{errorMessage}</p> : null}

                    <div className="edit-profile-modal-actions">
                        <button type="button" className="edit-profile-btn edit-profile-btn-ghost" onClick={handleClose} disabled={isSaving}>Cancel</button>
                        <button type="submit" className="edit-profile-btn edit-profile-btn-primary" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};