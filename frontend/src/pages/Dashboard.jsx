import { useEffect, useState } from 'react'; import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api'; import { useAuth } from '../context/AuthContext';
const CARDS = [['overall', 'Overall skill score'], ['technical', 'Technical'], ['interview', 'Interview'], ['project', 'Project health'], ['readiness', 'Role readiness']];
const ACTIONS = [['/interview', 'Start AI interview'], ['/assessment', 'Take skill test'], ['/resume', 'Analyze resume'], ['/projects', 'Analyze project'], ['/roadmap', 'View roadmap']];
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
export default function Dashboard() {
  const { user } = useAuth(); const [d, setD] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api('/dashboard/summary').then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="empty"><p>{err}</p><button className="primary" onClick={() => location.reload()}>Try again</button></div>;
  if (!d) return <div className="skeleton-grid">{[...Array(5)].map((_, i) => <div key={i} className="skeleton" />)}</div>;
  const chart = d.skills.map((s) => ({ name: s.name, score: s.score }));
  return (
    <>
      <header className="hero"><h1>{greet()}, {user.name.split(' ')[0]}</h1><p className="muted">Let's improve your career readiness today.</p></header>
      <section className="cards">{CARDS.map(([k, label]) => (
        <div className="card stat" key={k}><small>{label}</small><b>{d.scores[k] ?? '—'}{d.scores[k] !== null && '%'}</b>
          {d.scores[k] === null && <span className="muted small">Complete an activity to unlock</span>}</div>))}</section>
      <section className="card"><h2>Skills</h2>
        {chart.length === 0 ? <p className="muted">No skills yet. Upload your resume to extract them.</p> :
          <div style={{ height: 260 }}><ResponsiveContainer><BarChart data={chart} margin={{ left: -20 }}>
            <CartesianGrid vertical={false} stroke="#fce7f1" /><XAxis dataKey="name" tickLine={false} fontSize={12} /><YAxis domain={[0, 100]} tickLine={false} fontSize={12} />
            <Tooltip formatter={(v) => v + '%'} /><Bar dataKey="score" radius={[6, 6, 0, 0]}>{chart.map((c, i) => <Cell key={i} fill={c.score < 50 ? '#fb7185' : '#e11d48'} />)}</Bar>
          </BarChart></ResponsiveContainer></div>}
        <p className="muted small">Scores below 50% are highlighted as areas to work on.</p></section>
      <div className="grid2">
        <section className="card"><h2>Quick actions</h2><div className="actions">{ACTIONS.map(([to, l]) => <Link key={to} to={to} className="btn">{l}</Link>)}</div></section>
        <section className="card"><h2>Recent activity</h2>{d.recentActivity.length === 0 ? <p className="muted">Nothing yet. Take a skill test to get started.</p> :
          <ul className="feed">{d.recentActivity.map((a) => <li key={a._id}><span><b>{a.type}</b> {a.title}</span>{a.score != null && <em>{a.score}%</em>}</li>)}</ul>}</section>
      </div>
    </>);
}
