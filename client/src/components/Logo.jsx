import { branding } from '../branding';

export default function Logo({ size = 30 }) {
  if (branding.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={branding.appName}
        width={size}
        height={size}
        style={{ flexShrink: 0, objectFit: 'contain' }}
      />
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="2" y="2" width="60" height="60" rx="10" fill="var(--color-primary)" />
      <path
        d="M18 42 L18 34 L30 34 L30 24 L46 24"
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <rect x="42" y="20" width="8" height="8" fill="#fff" />
    </svg>
  );
}
