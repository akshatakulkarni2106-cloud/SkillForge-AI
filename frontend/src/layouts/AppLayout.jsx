import { useState } from 'react'; import { NavLink, Outlet } from 'react-router-dom'; import { useAuth } from '../context/AuthContext';
export const NAV = [
  { to: '/dashboard', label: 'Dashboard' }, { to: '/resume', label: 'Resume Analyzer'  }, { to: '/skills', label: 'Skill Profile' },
  { to: '/projects', label: 'Project Analyzer' },
  { to: '/assessment', label: 'Skill Assessment'  }, { to: '/interview', label: 'AI Mock Interview', stage: 3 },
  { to: '/skill-gap', label: 'Skill Gap' },
  { to: '/roadmap', label: 'Learning Roadmap', stage: 5 }, { to: '/practice', label: 'Practice', stage: 5 }, { to: '/progress', label: 'Progress', stage: 5 },
  { to: '/profile', label: 'Profile'  }, { to: '/settings', label: 'Settings', stage: 6 },
];
export default function AppLayout() {
  const { user, logout } = useAuth(); const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand">SkillForge<span>AI</span></div>
        <nav>{NAV.map((n) => <NavLink key={n.to} to={n.to} onClick={() => setOpen(false)}>{n.label}</NavLink>)}</nav>
        <div className="me"><div><b>{user.name}</b><small>{user.targetRole}</small></div><button className="ghost" onClick={logout}>Log out</button></div>
      </aside>
      <main><button className="menu" onClick={() => setOpen(!open)} aria-label="Toggle menu">Menu</button><Outlet /></main>
    </div>
  );
}
