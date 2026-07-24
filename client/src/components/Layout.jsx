import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import Logo from './Logo';

export default function Layout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__logo">
            <Logo size={30} />
          </span>
          <span className="brand-wordmark">devflow</span>
        </div>
        <nav className="sidebar__nav">
          <NavLink to="/" end>
            Developments
          </NavLink>
          <NavLink to="/my-tasks">My Tasks</NavLink>
          {can('viewAllTasks') && <NavLink to="/all-tasks">All Tasks</NavLink>}
          {can('validateTasks') && <NavLink to="/validation">Validation</NavLink>}
          {can('manageUsers') && <NavLink to="/users">Users</NavLink>}
          {can('manageUsers') && <NavLink to="/roles">Roles</NavLink>}
          <NavLink to="/profile">Profile</NavLink>
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
      </div>
    </div>
  );
}
