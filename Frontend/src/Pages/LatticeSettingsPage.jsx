import React, { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { LatticeFrame } from './LatticeFrame';
import { ProfileIdentityFields } from '../components/ProfileIdentityFields';
import { getCurrentSessionUser, updateCurrentUserProfile } from '../services/latticeApi';
import { apiRequest } from '../utils/api';
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
  const [isGeneratingTelegramToken, setIsGeneratingTelegramToken] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramError, setTelegramError] = useState('');
  const [telegramSuccess, setTelegramSuccess] = useState('');

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

  const extractToken = (payload) => {
    if (!payload) {
      return '';
    }

    return payload.token || payload.telegramToken || payload.loginToken || payload?.data?.token || '';
  };

  const onGenerateTelegramToken = async () => {
    if (isGeneratingTelegramToken) {
      return;
    }

    setIsGeneratingTelegramToken(true);
    setTelegramError('');
    setTelegramSuccess('');

    try {
      const response = await apiRequest('/telegram/generate-token', {
        method: 'POST',
      });

      const token = extractToken(response);
      if (!token) {
        throw new Error('Token was not returned by the server.');
      }

      setTelegramToken(token);
      setTelegramSuccess('Telegram token generated.');
    } catch (error) {
      if (error?.status === 401) {
        setTelegramError('You are not authorized. Please log in again.');
      } else {
        setTelegramError(error.message || 'Unable to generate Telegram token.');
      }
    } finally {
      setIsGeneratingTelegramToken(false);
    }
  };

  const onCopyTelegramToken = async () => {
    if (!telegramToken) {
      return;
    }

    try {
      await navigator.clipboard.writeText(telegramToken);
      setTelegramError('');
      setTelegramSuccess('Token copied to clipboard.');
    } catch {
      setTelegramError('Unable to copy token. Please copy manually.');
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

                <section className="settings-card">
                  <h3>Telegram Integration</h3>
                  <p className="settings-note">
                    Connect your Telegram account to save bookmarks directly from Telegram.
                  </p>

                  <div className="settings-inline-actions">
                    <button
                      type="button"
                      className="settings-btn settings-btn-primary"
                      onClick={onGenerateTelegramToken}
                      disabled={isGeneratingTelegramToken}
                    >
                      {isGeneratingTelegramToken ? 'Generating...' : telegramToken ? 'Regenerate Token' : 'Connect Telegram'}
                    </button>
                  </div>

                  {telegramError ? <p className="settings-status settings-status-error">{telegramError}</p> : null}
                  {telegramSuccess ? <p className="settings-status settings-status-success">{telegramSuccess}</p> : null}

                  {telegramToken ? (
                    <div className="telegram-token-block">
                      <p className="telegram-token-label">Your login token:</p>
                      <div className="telegram-token-value">{telegramToken}</div>

                      <p className="telegram-token-label">Use this command in Telegram:</p>
                      <div className="telegram-command-value">/login {telegramToken}</div>

                      <div className="settings-inline-actions">
                        <button
                          type="button"
                          className="settings-btn settings-btn-ghost"
                          onClick={onCopyTelegramToken}
                        >
                          Copy Token
                        </button>
                      </div>
                    </div>
                  ) : null}
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
