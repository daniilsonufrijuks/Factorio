export default function Avatar({ portrait, size = 56 }) {
  const style = portrait?.style || 'short';
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <rect width="80" height="80" rx="8" fill={portrait?.bg || '#2a2a2a'} />
      {style === 'robot' ? <Robot portrait={portrait} /> : <Person portrait={portrait} style={style} />}
    </svg>
  );
}

function Person({ portrait, style }) {
  return (
    <g>
      <path d="M14 66c4-12 12-18 26-18s22 6 26 18" fill={portrait.suit} />
      <circle cx="40" cy="36" r="16" fill={portrait.skin} />
      <Hair style={style} color={portrait.hair} />
      <path d="M22 24h36v8c-6 6-30 6-36 0z" fill={portrait.hat} />
      <path d="M28 18h24v8h-24z" fill={portrait.hat} />
      <circle cx="34" cy="36" r="1.7" fill="#1b2430" />
      <circle cx="46" cy="36" r="1.7" fill="#1b2430" />
      <path d="M35 43c2 2 8 2 10 0" fill="none" stroke="#7a4b38" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function Hair({ style, color }) {
  if (style === 'bun') {
    return (
      <g fill={color}>
        <path d="M24 34c0-12 8-20 16-20s16 8 16 18c-6-6-22-6-32 2z" />
        <circle cx="56" cy="28" r="7" />
      </g>
    );
  }
  if (style === 'curls') {
    return (
      <g fill={color}>
        <circle cx="26" cy="30" r="7" />
        <circle cx="34" cy="22" r="7" />
        <circle cx="46" cy="22" r="7" />
        <circle cx="54" cy="30" r="7" />
      </g>
    );
  }
  if (style === 'bob') {
    return <path d="M22 36c2-16 10-22 18-22s16 6 18 20c-2 8-8 10-18 8-8 2-16 0-18-6z" fill={color} />;
  }
  if (style === 'wrap') {
    return <path d="M24 28c2-12 10-16 16-16 8 0 16 6 16 16 2 6-2 8-4 8H28c-4 0-6-2-4-8z" fill={color} />;
  }
  if (style === 'side') {
    return <path d="M24 34c1-14 10-20 20-18 6 8 8 16 4 22-8-8-18-8-24-4z" fill={color} />;
  }
  if (style === 'puff') {
    return (
      <g fill={color}>
        <circle cx="24" cy="32" r="8" />
        <circle cx="56" cy="32" r="8" />
        <path d="M28 24c2-10 8-14 12-14s10 4 12 14z" />
      </g>
    );
  }
  return <path d="M24 34c0-12 7-18 16-18s16 6 16 16c-4-7-10-8-16-8s-12 2-16 10z" fill={color} />;
}

function Robot({ portrait }) {
  return (
    <g>
      <rect x="22" y="18" width="36" height="28" rx="8" fill={portrait.suit} />
      <rect x="28" y="24" width="24" height="12" rx="3" fill="#102433" />
      <circle cx="36" cy="30" r="2" fill={portrait.hat} />
      <circle cx="46" cy="30" r="2" fill={portrait.hat} />
      <rect x="37" y="8" width="6" height="10" fill={portrait.hat} />
      <circle cx="40" cy="8" r="4" fill={portrait.hat} />
      <rect x="18" y="34" width="8" height="18" rx="3" fill={portrait.skin} />
      <rect x="54" y="34" width="8" height="18" rx="3" fill={portrait.skin} />
    </g>
  );
}
