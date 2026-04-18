import React, { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { LatticeFrame } from './LatticeFrame';
import { ProfileIdentityFields } from '../components/ProfileIdentityFields';
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

  const socialFields = [
    { key: 'linkedinUrl', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/...' },
    { key: 'githubUrl', label: 'GitHub URL', placeholder: 'https://github.com/...' },
    { key: 'websiteUrl', label: 'Website URL', placeholder: 'https://...' },
    { key: 'xUrl', label: 'X URL', placeholder: 'https://x.com/...' },
  ];

  return (
    <LatticeFrame>
      <div className="directory-container settings-page-container">
        <header className="settings-head">
          <span className="settings-kicker">
            <SlidersHorizontal size={14} />
            Workspace controls
          </span>
          <h1>Settings</h1>
          <p>Configure your identity and tune lifecycle rules for how stale links are handled in your workspace.</p>
        </header>

        {isLoading ? <p className="directory-status">Loading settings...</p> : null}

        {!isLoading ? (
          <form className="settings-form" onSubmit={onSubmit}>
            {errorMessage ? <p className="directory-status directory-status-error">{errorMessage}</p> : null}
            {successMessage ? <p className="directory-status" style={{ color: '#166534' }}>{successMessage}</p> : null}

            <div className="settings-layout">
              <div className="settings-main-column">
                <section className="settings-card">
                  <h3>Profile Identity</h3>

                  <ProfileIdentityFields
                    name={form.name}
                    bio={form.bio}
                    avatar={form.avatarUrl}
                    onNameChange={(value) => onFieldChange('name', value)}
                    onBioChange={(value) => onFieldChange('bio', value)}
                    onAvatarChange={(value) => onFieldChange('avatarUrl', value)}
                  />
                </section>

                <section className="settings-card">
                  <h3>Public Links</h3>

                  {socialFields.map((field) => (
                    <label key={field.key}>
                      <span>{field.label}</span>
                      <input
                        type="url"
                        value={form[field.key]}
                        onChange={(event) => onFieldChange(field.key, event.target.value)}
                        placeholder={field.placeholder}
                      />
                    </label>
                  ))}
                </section>
              </div>

              <aside className="settings-side-column">
                <section className="settings-card settings-card-accent">
                  <h3>Link Decay Rules</h3>

                  <label>
                    <span>Shrink starts after (days)</span>
                    <input type="number" min={1} max={365} value={form.linkDecayStartDays} onChange={(event) => onFieldChange('linkDecayStartDays', event.target.value)} />
                  </label>

                  <label>
                    <span>Move to graveyard after (days)</span>
                    <input type="number" min={2} max={730} value={form.linkGraveyardDays} onChange={(event) => onFieldChange('linkGraveyardDays', event.target.value)} />
                  </label>

                  <p className="settings-note">Default behavior starts shrinking at day 14 and moves links to graveyard at day 30.</p>

                  <div className="settings-actions">
                    <button type="submit" className="bookmark-submit-btn" disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </section>
              </aside>
            </div>
          </form>
        ) : null}
      </div>
    </LatticeFrame>
  );
};
