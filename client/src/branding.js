// Central white-label config, read from Vite env vars set per client deploy
// (see client/.env.example). Every client instance can override the app
// name, colors, and logo without touching a single line of code — only
// their own .env / Netlify environment variables.
export const branding = {
  appName: import.meta.env.VITE_APP_NAME || 'DevFlow',
  tagline: import.meta.env.VITE_APP_TAGLINE || 'Task management for engineering teams',
  primaryColor: import.meta.env.VITE_PRIMARY_COLOR || '#552f86',
  primaryHoverColor: import.meta.env.VITE_PRIMARY_HOVER_COLOR || '#40166d',
  primaryLightColor: import.meta.env.VITE_PRIMARY_LIGHT_COLOR || '#9769dc',
  logoUrl: import.meta.env.VITE_LOGO_URL || '',
  faviconUrl: import.meta.env.VITE_FAVICON_URL || '',
};

// DB-stored settings (edited from the in-app Branding page, admin only) win
// over env vars, which win over the hardcoded DevFlow defaults above. Called
// once at boot, before the app renders, so every component reads the final
// values from the start — no stale-object/missed-re-render issues from
// mutating `branding` after components already mounted with the old values.
export async function loadBrandingOverrides() {
  try {
    const res = await fetch('/api/branding');
    if (!res.ok) return;
    const { branding: db } = await res.json();
    if (!db) return;
    if (db.appName) branding.appName = db.appName;
    if (db.tagline) branding.tagline = db.tagline;
    if (db.primaryColor) branding.primaryColor = db.primaryColor;
    if (db.primaryHoverColor) branding.primaryHoverColor = db.primaryHoverColor;
    if (db.primaryLightColor) branding.primaryLightColor = db.primaryLightColor;
    if (db.logoUrl) branding.logoUrl = db.logoUrl;
    if (db.faviconUrl) branding.faviconUrl = db.faviconUrl;
  } catch {
    // API not reachable (e.g. offline) — keep the env-var/hardcoded defaults.
  }
}

export function applyBrandingCssVars() {
  const root = document.documentElement.style;
  root.setProperty('--color-primary', branding.primaryColor);
  root.setProperty('--color-primary-hover', branding.primaryHoverColor);
  root.setProperty('--color-primary-light', branding.primaryLightColor);
}

// index.html ships safe static fallbacks (in case this runs in a context
// without JS, e.g. a crawler); this overrides them once the app boots, so a
// client's own env vars reach the tab title/meta tags without needing Vite's
// build-time %VITE_XXX% HTML placeholders (which show up as literal text if
// a var isn't set — too easy to forget when provisioning a new instance).
export function applyBrandingMeta() {
  document.title = branding.appName;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', branding.tagline);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', branding.appName);
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) ogDescription.setAttribute('content', branding.tagline);

  if (branding.faviconUrl) {
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) favicon.setAttribute('href', branding.faviconUrl);
  }
}
