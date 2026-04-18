import React from 'react';

export const ProfileIdentityFields = ({
  name,
  bio,
  avatar,
  onNameChange,
  onBioChange,
  onAvatarChange,
  disabled = false,
  bioMaxLength = 300,
  avatarPlaceholder = 'https://...',
  avatarHint = '',
  fieldClassName = '',
}) => {
  const labelClassName = fieldClassName || undefined;

  return (
    <>
      <label className={labelClassName}>
        <span>Name</span>
        <input type="text" value={name} onChange={(event) => onNameChange(event.target.value)} maxLength={80} disabled={disabled} />
      </label>

      <label className={labelClassName}>
        <span>Bio</span>
        <textarea rows={4} value={bio} onChange={(event) => onBioChange(event.target.value)} maxLength={bioMaxLength} disabled={disabled} />
      </label>

      <label className={labelClassName}>
        <span>Avatar URL</span>
        <input type="url" value={avatar} onChange={(event) => onAvatarChange(event.target.value)} placeholder={avatarPlaceholder} disabled={disabled} />
        {avatarHint ? <small>{avatarHint}</small> : null}
      </label>
    </>
  );
};