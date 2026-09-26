import { useEffect, useState } from 'react'; import { Link } from 'react-router-dom'; import { api } from '../services/api';
const level = (s) => (s < 50 ? 'Beginner' : s < 75 ? 'Intermediate' : 'Advanced');
const status = (s) => (s.verified ? ['Verified', 'ok'] : s.score > 0 ? ['Estimated · not verified', 'mid'] : ['Not assessed', 'low']);
export default function SkillProfile() {
  const [u, setU] = useState(null);
  useEffect(() => { api('/user/profile').then(setU); }, []);
  if (!u) return <div className="skeleton-grid">{[...Array(4)].map((_, i) => <div key={i} className="skeleton" />)}</div>;
  if (!u.skills.length) return <div className="empty"><p>No skills yet.</p><Link className="btn" to="/resume">Analyze your resume</Link></div>;
  return (<><h1>Skill Profile</h1><p className="muted">Levels come from your assessment scores: below 50% Beginner, below 75% Intermediate, otherwise Advanced.</p>
    <div className="cards wideCards">{u.skills.map((s) => { const [t, c] = status(s); return (
      <div className="card" key={s.name}><h2>{s.name}</h2><div className="bar"><i style={{ width: s.score + '%' }} className={s.score < 50 ? 'warm' : ''} /></div>
        <p><b>{s.score}%</b> · {s.score ? level(s.score) : 'Unrated'}</p><span className={'tag ' + c}>{t}</span>
        <p className="small muted">{s.lastAssessed ? 'Last assessed ' + new Date(s.lastAssessed).toLocaleDateString() : 'Never assessed'}</p>
        <Link className="small" to="/assessment">{s.verified ? 'Practice again' : 'Take assessment'}</Link></div>); })}</div></>);
}
