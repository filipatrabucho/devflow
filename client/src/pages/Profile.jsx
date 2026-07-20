import { useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';

export default function Profile() {
  const { user, refresh } = useAuth();
  const fileInputRef = useRef(null);

  const [avatarError, setAvatarError] = useState('');
  const [avatarSaving, setAvatarSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');
    setAvatarSaving(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await api.post('/users/me/avatar', formData, { isFormData: true });
      await refresh();
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setAvatarSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    setPasswordSaving(true);
    try {
      await api.put('/users/me/password', passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setPasswordSuccess('Password updated successfully.');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Profile</h1>
      </div>

      <div className="card profile-card">
        <Avatar name={user?.name} src={user?.avatarPath} size={72} />
        <div>
          <h3>{user?.name}</h3>
          <p className="muted">{user?.email}</p>
          <span className={`role-pill role-pill--${user?.role}`}>{user?.role}</span>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleAvatarChange}
            hidden
            id="avatar-input"
          />
          <label htmlFor="avatar-input" className="btn btn--secondary">
            {avatarSaving ? 'Uploading...' : 'Change avatar'}
          </label>
        </div>
      </div>
      {avatarError && <div className="alert alert--error">{avatarError}</div>}

      <form className="card form" onSubmit={handlePasswordSubmit}>
        <h3>Change password</h3>
        {passwordError && <div className="alert alert--error">{passwordError}</div>}
        {passwordSuccess && <div className="alert alert--success">{passwordSuccess}</div>}
        <label className="field">
          <span>Current password</span>
          <input
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>New password</span>
          <input
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            minLength={8}
            required
          />
        </label>
        <button className="btn btn--primary" type="submit" disabled={passwordSaving}>
          {passwordSaving ? 'Saving...' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
