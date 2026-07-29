const common = {
  width: 18,
  height: 18,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function DashboardIcon() {
  return (
    <svg {...common}>
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.5" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}

export function DevelopmentsIcon() {
  return (
    <svg {...common}>
      <path d="M2.5 6.5 10 2.5l7.5 4-7.5 4-7.5-4Z" />
      <path d="M2.5 10 10 14l7.5-4" />
      <path d="M2.5 13.5 10 17.5l7.5-4" />
    </svg>
  );
}

export function TasksIcon() {
  return (
    <svg {...common}>
      <rect x="3" y="3" width="14" height="14" rx="2.5" />
      <path d="M6.5 10.2 8.6 12.3 13.5 7.4" />
    </svg>
  );
}

export function ListIcon() {
  return (
    <svg {...common}>
      <path d="M7 5h10" />
      <path d="M7 10h10" />
      <path d="M7 15h10" />
      <circle cx="3.3" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="3.3" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="3.3" cy="15" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ValidationIcon() {
  return (
    <svg {...common}>
      <path d="M10 2.5 17 5v4.8c0 4-3 6.9-7 7.7-4-.8-7-3.7-7-7.7V5l7-2.5Z" />
      <path d="M7 10 9.2 12.2 13.3 8" />
    </svg>
  );
}

export function UsersIcon() {
  return (
    <svg {...common}>
      <circle cx="7.3" cy="6.5" r="3" />
      <path d="M1.8 17c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" />
      <circle cx="14.5" cy="7" r="2.3" />
      <path d="M13 12.3c2.2.4 3.6 1.8 4.1 4.2" />
    </svg>
  );
}

export function RolesIcon() {
  return (
    <svg {...common}>
      <circle cx="7" cy="7" r="4" />
      <path d="M9.8 9.8 17.5 17.5" />
      <path d="M13.5 13.5 15.5 11.5" />
      <path d="M15.7 15.7 17.7 13.7" />
    </svg>
  );
}

export function ProfileIcon() {
  return (
    <svg {...common}>
      <circle cx="10" cy="6.8" r="3.3" />
      <path d="M3.3 17c.9-3.7 3.4-5.7 6.7-5.7s5.8 2 6.7 5.7" />
    </svg>
  );
}

export function CollapseIcon({ collapsed }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {collapsed ? <path d="M7.5 4.5 13 10l-5.5 5.5" /> : <path d="M12.5 4.5 7 10l5.5 5.5" />}
    </svg>
  );
}
