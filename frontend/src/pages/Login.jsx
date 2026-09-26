import { useState } from 'react'; import { Link, Navigate, useNavigate } from 'react-router-dom'; import toast from 'react-hot-toast'; import { useAuth } from '../context/AuthContext';
export default function Login() {
  const { user, login } = useAuth(); const nav = useNavigate(); const [f, setF] = useState({ email: '', password: '' }); const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;
  const submit = async (e) => { e.preventDefault(); setBusy(true);
    try { await login(f); nav('/dashboard'); } catch (err) { toast.error(err.message); } finally { setBusy(false); } };
  return (
    <div className="auth"><form onSubmit={submit} className="card">
      <Link to="/" className="brand" style={{ textDecoration: 'none' }}>SkillForge<span>AI</span></Link><h1>Welcome back</h1><p className="muted">Test. Improve. Grow.</p>
      <label>Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <label>Password<input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
      <button className="primary" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      <p className="muted small">Demo: demo@skillforge.ai / Demo@1234</p>
      <p className="small">New here? <Link to="/register">Create an account</Link></p>
    </form></div>);
}
