import React, { useEffect, useState } from 'react';

import { LatticeFrame } from './LatticeFrame';
import { getCurrentSessionUser, updateCurrentUserProfile } from '../services/latticeApi';
import './LatticePages.css';

const clampNumber = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
};

export const LatticeSettingsPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [form, setForm] = useState({
    name: '',
    bio: '',
    avatarUrl: '',
    linkedinUrl: '',
    githubUrl: '',
    websiteUrl: '',
    xUrl: '',
    linkDecayStartDays: 14,
    linkGraveyardDays: 30,
  });

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      try {
        const user = await getCurrentSessionUser();

        if (!isMounted || !user) {
          return;
        }

        setForm({
          name: user.name || '',
          bio: user.bio || '',
          avatarUrl: user.avatarUrl || '',
          linkedinUrl: user.linkedinUrl || '',
          githubUrl: user.githubUrl || '',
          websiteUrl: user.websiteUrl || '',
          xUrl: user.xUrl || '',
          linkDecayStartDays: clampNumber(user.linkDecayStartDays, 1, 365, 14),
          linkGraveyardDays: clampNumber(user.linkGraveyardDays, 2, 730, 30),
        });
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message || 'Unable to load settings.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const onFieldChange = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    const decayStart = clampNumber(form.linkDecayStartDays, 1, 365, 14);
    const graveyardDays = clampNumber(form.linkGraveyardDays, 2, 730, 30);

    if (graveyardDays <= decayStart) {
      setErrorMessage('Graveyard days must be greater than shrink start days.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await updateCurrentUserProfile({
        name: form.name,
        bio: form.bio,
        avatarUrl: form.avatarUrl,
        linkedinUrl: form.linkedinUrl,
        githubUrl: form.githubUrl,
        websiteUrl: form.websiteUrl,
        xUrl: form.xUrl,
        linkDecayStartDays: decayStart,
        linkGraveyardDays: graveyardDays,
      });

      const updatedUser = response?.user;
      if (updatedUser) {
        window.dispatchEvent(new CustomEvent('lattice:current-user-updated', {
          detail: updatedUser,
        }));
      }

      setSuccessMessage('Settings saved.');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <LatticeFrame>
      <div className="directory-container settings-page-container">
        <header className="settings-head">
          <h1>Settings</h1>
          <p>Update profile details and customize when link shrinking and graveyard transitions happen.</p>
        </header>

        {isLoading ? <p className="directory-status">Loading settings...</p> : null}

        {!isLoading ? (
          <form className="settings-form" onSubmit={onSubmit}>
            <section className="settings-card">
              <h3>Profile</h3>

              <label>
                <span>Name</span>
                <input type="text" value={form.name} onChange={(event) => onFieldChange('name', event.target.value)} maxLength={80} />
              </label>

              <label>
                <span>Bio</span>
                <textarea rows={4} value={form.bio} onChange={(event) => onFieldChange('bio', event.target.value)} maxLength={300} />
              </label>

              <label>
                <span>Avatar URL</span>
                <input type="url" value={form.avatarUrl} onChange={(event) => onFieldChange('avatarUrl', event.target.value)} placeholder="https://..." />
              </label>

              <label>
                <span>LinkedIn URL</span>
                <input type="url" value={form.linkedinUrl} onChange={(event) => onFieldChange('linkedinUrl', event.target.value)} placeholder="https://linkedin.com/in/..." />
              </label>

              <label>
                <span>GitHub URL</span>
                <input type="url" value={form.githubUrl} onChange={(event) => onFieldChange('githubUrl', event.target.value)} placeholder="https://github.com/..." />
              </label>

              <label>
                <span>Website URL</span>
                <input type="url" value={form.websiteUrl} onChange={(event) => onFieldChange('websiteUrl', event.target.value)} placeholder="https://..." />
              </label>

              <label>
                <span>X URL</span>
                <input type="url" value={form.xUrl} onChange={(event) => onFieldChange('xUrl', event.target.value)} placeholder="https://x.com/..." />
              </label>
            </section>

            <section className="settings-card">
              <h3>Link Decay Rules</h3>

              <label>
                <span>Shrink starts after (days)</span>
                <input type="number" min={1} max={365} value={form.linkDecayStartDays} onChange={(event) => onFieldChange('linkDecayStartDays', event.target.value)} />
              </label>

              <label>
                <span>Move to graveyard after (days)</span>
                <input type="number" min={2} max={730} value={form.linkGraveyardDays} onChange={(event) => onFieldChange('linkGraveyardDays', event.target.value)} />
              </label>

              <p className="settings-note">Default is 14 days for shrinking and 30 days for graveyard.</p>
            </section>

            {errorMessage ? <p className="directory-status directory-status-error">{errorMessage}</p> : null}
            {successMessage ? <p className="directory-status" style={{ color: '#166534' }}>{successMessage}</p> : null}

            <div className="settings-actions">
              <button type="submit" className="bookmark-submit-btn" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </LatticeFrame>
  );
};
