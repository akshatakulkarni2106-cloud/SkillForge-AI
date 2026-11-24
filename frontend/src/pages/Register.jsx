import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'Python Developer',
  'Java Developer',
  'Data Analyst',
  'AI/ML Engineer',
];

export default function Register() {
  const { user, register } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: '',
    email: '',
    password: '',
    college: '',
    branch: '',
    year: '3',
    targetRole: ROLES[0],
  });

  if (user) return <Navigate to="/dashboard" replace />;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return; // Guard against double-submits and race conditions
    setBusy(true);

    try {
      await register(f);
      toast.success('Account created successfully!');
      nav('/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      toast.error(err.message || 'Could not create account. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <form onSubmit={submit} className="card wide">
        <Link to="/" className="brand" style={{ textDecoration: 'none' }}>
          SkillForge<span>AI</span>
        </Link>
        <h1>Create your account</h1>
        <div className="grid2">
          <label>
            Full name
            <input required value={f.name} onChange={set('name')} disabled={busy} />
          </label>
          <label>
            Email
            <input type="email" required value={f.email} onChange={set('email')} disabled={busy} />
          </label>
          <label>
            Password
            <input type="password" minLength={8} required value={f.password} onChange={set('password')} disabled={busy} />
          </label>
          <label>
            College
            <input value={f.college} onChange={set('college')} disabled={busy} />
          </label>
          <label>
            Branch
            <input value={f.branch} onChange={set('branch')} disabled={busy} />
          </label>
          <label>
            Year
            <select value={f.year} onChange={set('year')} disabled={busy}>
              {[1, 2, 3, 4].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Target role
          <select value={f.targetRole} onChange={set('targetRole')} disabled={busy}>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <button className="primary" disabled={busy} type="submit" style={{ cursor: busy ? 'not-allowed' : 'pointer' }}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="small">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
