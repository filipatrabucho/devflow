function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function Avatar({ name, src, size = 36 }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };

  if (src) {
    return (
      <img
        className="avatar"
        style={style}
        src={src}
        alt={name || 'User avatar'}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  return (
    <div className="avatar avatar--fallback" style={style} aria-label={name}>
      {initials(name) || '?'}
    </div>
  );
}
