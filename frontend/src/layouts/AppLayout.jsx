import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/progress', label: 'Progress & Streaks' },
  { to: '/resume', label: 'Resume Analyzer' },
  { to: '/skills', label: 'Skill Profile' },
  { to: '/projects', label: 'Project Analyzer' },
  { to: '/assessment', label: 'Skill Assessment' },
  { to: '/interview', label: 'AI Mock Interview', stage: 3 },
  { to: '/skill-gap', label: 'Skill Gap' },
  { to: '/roadmap', label: 'Learning Roadmap', stage: 5 },
  { to: '/practice', label: 'Practice', stage: 5 },
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="shell">
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand">SkillForge<span>AI</span></div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} onClick={() => setOpen(false)}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="me">
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block', flex: 1 }}
            title="View Profile"
          >
            <b>{user?.name || 'Student'}</b>
            <small>{user?.targetRole || 'Full Stack Developer'}</small>
          </Link>
          <button type="button" className="ghost" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main>
        <button type="button" className="menu" onClick={() => setOpen(!open)} aria-label="Toggle menu">Menu</button>
        <Outlet />
      </main>
    </div>
  );
}

