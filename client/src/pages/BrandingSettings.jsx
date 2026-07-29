import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export default function BrandingSettings() {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/branding');
      setForm(
        data.branding || {
          appName: 'DevFlow',
          tagline: '',
          primaryColor: '#552f86',
          primaryHoverColor: '#40166d',
          primaryLightColor: '#9769dc',
          logoUrl: '',
          faviconUrl: '',
        }
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await api.put('/branding', {
        appName: form.appName,
        tagline: form.tagline,
        primaryColor: form.primaryColor,
        primaryHoverColor: form.primaryHoverColor,
        primaryLightColor: form.primaryLightColor,
      });
      setForm(data.branding);
      setSuccess('Branding saved. Reload the page to see it applied everywhere.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAssetUpload(e, path, field) {
    const file = e.target.files?.[0];
    if (!file) return;
    const setUploading = field === 'logoUrl' ? setUploadingLogo : setUploadingFavicon;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api.post(`/branding/${path}`, formData, { isFormData: true });
      setForm((prev) => ({ ...prev, [field]: data.url }));
      setSuccess('Image uploaded. Reload the page to see it applied everywhere.');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  if (loading || !form) return <p>Loading...</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Branding</h1>
          <p className="muted">
            Customize how this instance looks for its users — name, tagline, colors, logo and favicon.
          </p>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {success && <div className="alert alert--success">{success}</div>}

      <form className="card form" onSubmit={handleSave}>
        <label className="field">
          <span>App name</span>
          <input
            value={form.appName}
            onChange={(e) => setForm({ ...form, appName: e.target.value })}
            maxLength={60}
            required
          />
        </label>
        <label className="field">
          <span>Tagline</span>
          <input
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            maxLength={160}
          />
        </label>
        <label className="field">
          <span>Primary color</span>
          <div className="branding-color-field">
            <input
              type="color"
              value={form.primaryColor}
              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
            />
            <input
              value={form.primaryColor}
              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              maxLength={20}
            />
          </div>
        </label>
        <label className="field">
          <span>Primary hover color</span>
          <div className="branding-color-field">
            <input
              type="color"
              value={form.primaryHoverColor}
              onChange={(e) => setForm({ ...form, primaryHoverColor: e.target.value })}
            />
            <input
              value={form.primaryHoverColor}
              onChange={(e) => setForm({ ...form, primaryHoverColor: e.target.value })}
              maxLength={20}
            />
          </div>
        </label>
        <label className="field">
          <span>Primary light color</span>
          <div className="branding-color-field">
            <input
              type="color"
              value={form.primaryLightColor}
              onChange={(e) => setForm({ ...form, primaryLightColor: e.target.value })}
            />
            <input
              value={form.primaryLightColor}
              onChange={(e) => setForm({ ...form, primaryLightColor: e.target.value })}
              maxLength={20}
            />
          </div>
        </label>

        <button className="btn btn--primary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>

      <div className="card branding-assets-card">
        <h3>Logo</h3>
        <div className="branding-asset-row">
          {form.logoUrl ? (
            <img src={form.logoUrl} alt="Logo" className="branding-asset-preview" />
          ) : (
            <div className="branding-asset-preview branding-asset-preview--empty">Default mark</div>
          )}
          <div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              hidden
              onChange={(e) => handleAssetUpload(e, 'logo', 'logoUrl')}
            />
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
            >
              {uploadingLogo ? 'Uploading...' : 'Upload logo'}
            </button>
          </div>
        </div>

        <h3>Favicon</h3>
        <div className="branding-asset-row">
          {form.faviconUrl ? (
            <img src={form.faviconUrl} alt="Favicon" className="branding-asset-preview branding-asset-preview--small" />
          ) : (
            <div className="branding-asset-preview branding-asset-preview--empty branding-asset-preview--small">
              Default
            </div>
          )}
          <div>
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/png,image/x-icon,image/svg+xml"
              hidden
              onChange={(e) => handleAssetUpload(e, 'favicon', 'faviconUrl')}
            />
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => faviconInputRef.current?.click()}
              disabled={uploadingFavicon}
            >
              {uploadingFavicon ? 'Uploading...' : 'Upload favicon'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
