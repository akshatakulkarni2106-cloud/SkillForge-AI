import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ComingSoon from './pages/ComingSoon';
import Resume from './pages/Resume';
import SkillProfile from './pages/SkillProfile';
import Assessment from './pages/Assessment';
import SkillGap from './pages/SkillGap';
import InterviewPage from './pages/InterviewPage';
import PracticePage from './pages/PracticePage';
import RoadmapPage from './pages/RoadmapPage';
import ProjectAnalyzer from './pages/ProjectAnalyzer';
import LandingPage from './pages/LandingPage';
import Profile from './pages/Profile';
import Progress from './pages/Progress';
import Settings from './pages/Settings';
import { NAV } from './layouts/AppLayout';

function Protected({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="center muted">Loading your workspace…</div>;

  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<Protected><AppLayout /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/resume" element={<Resume />} />
        <Route path="/skills" element={<SkillProfile />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/assessment" element={<Assessment />} />
        <Route path="/interview" element={<InterviewPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/skill-gap" element={<SkillGap />} />
        <Route path="/projects" element={<ProjectAnalyzer />} />
        {NAV.filter((n) => n.stage && n.to !== '/roadmap' && n.to !== '/projects').map((n) => (
          <Route key={n.to} path={n.to} element={<ComingSoon title={n.label} stage={n.stage} />} />
        ))}
      </Route>


      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
