import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

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
  const { isDark, toggleTheme } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <div className="shell">
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>SkillForge<span>AI</span></div>
          <button
            type="button"
            className="theme-toggle-btn ghost"
            onClick={toggleTheme}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
            style={{
              padding: '4px 8px',
              fontSize: '1.05rem',
              borderRadius: 8,
              border: '1px solid var(--line-strong)',
              cursor: 'pointer',
              lineHeight: 1,
            }}
            aria-label="Toggle theme"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
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
          <button
            type="button"
            className="theme-toggle-btn ghost"
            onClick={toggleTheme}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
            style={{ padding: '6px 8px', fontSize: '1rem', borderRadius: 8, cursor: 'pointer' }}
            aria-label="Toggle theme"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <button type="button" className="ghost" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button type="button" className="menu" onClick={() => setOpen(!open)} aria-label="Toggle menu">Menu</button>
          <div style={{ marginLeft: 'auto' }}>
            <button
              type="button"
              className="btn theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                fontSize: '.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>{isDark ? '☀️' : '🌙'}</span>
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

