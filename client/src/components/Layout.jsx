import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import Logo from './Logo';
import { branding } from '../branding';
import {
  BrandingIcon,
  CollapseIcon,
  DashboardIcon,
  DevelopmentsIcon,
  ListIcon,
  ProfileIcon,
  RolesIcon,
  TasksIcon,
  UsersIcon,
  ValidationIcon,
} from './icons';

const COLLAPSE_KEY = 'devflow_sidebar_collapsed';

function NavItem({ to, end, icon, label }) {
  return (
    <NavLink to={to} end={end} title={label}>
      <span className="sidebar__nav-icon">{icon}</span>
      <span className="sidebar__nav-label">{label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
        <div className="sidebar__brand">
          <span className="sidebar__logo">
            <Logo size={28} />
          </span>
          {!collapsed && <span className="brand-wordmark">{branding.appName.toLowerCase()}</span>}
          <button
            className="sidebar__collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>
        <nav className="sidebar__nav">
          <NavItem to="/" end icon={<DashboardIcon />} label="Dashboard" />
          <NavItem to="/developments" icon={<DevelopmentsIcon />} label="Developments" />
          <NavItem to="/my-tasks" icon={<TasksIcon />} label="My Tasks" />
          {can('viewAllTasks') && <NavItem to="/all-tasks" icon={<ListIcon />} label="All Tasks" />}
          {can('validateTasks') && <NavItem to="/validation" icon={<ValidationIcon />} label="Validation" />}
          {can('manageUsers') && <NavItem to="/users" icon={<UsersIcon />} label="Users" />}
          {can('manageUsers') && <NavItem to="/roles" icon={<RolesIcon />} label="Roles" />}
          {user?.role === 'admin' && <NavItem to="/branding" icon={<BrandingIcon />} label="Branding" />}
          <NavItem to="/profile" icon={<ProfileIcon />} label="Profile" />
        </nav>
      </aside>
      <div className="app-shell__main">
        <header className="topbar">
          <div />
          <div className="topbar__user">
            <span className="topbar__name">{user?.name}</span>
            <span className={`role-pill role-pill--${user?.role}`}>{user?.roleLabel}</span>
            <Avatar name={user?.name} src={user?.avatarPath} size={32} />
            <button className="btn btn--ghost" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
        <footer className="app-footer">© Ana Trabucho {new Date().getFullYear()}. All Rights Reserved.</footer>
      </div>
    </div>
  );
}
