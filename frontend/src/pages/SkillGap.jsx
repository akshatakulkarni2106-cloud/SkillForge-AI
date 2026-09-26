import { useEffect, useState } from 'react'; import { Link } from 'react-router-dom'; import { api } from '../services/api';
const GROUPS = [['strong', 'Strong skills'], ['improve', 'Skills to improve'], ['learn', 'Skills to learn']];
export default function SkillGap() {
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  const load = (role = '') => api('/skill-gap/analyze' + (role ? '?role=' + encodeURIComponent(role) : '')).then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  if (err) return <div className="empty"><p>{err}</p></div>; if (!d) return <div className="skeleton" style={{ height: 200 }} />;
  return (<><h1>Skill Gap</h1><label style={{ maxWidth: 300 }}>Compare against role<select value={d.role} onChange={(e) => load(e.target.value)}>{d.roles.map((r) => <option key={r}>{r}</option>)}</select></label>
    <section className="card" style={{ marginTop: 16 }}>{d.rows.map((r) => (<div key={r.skill} className="gap"><div><b>{r.skill}</b><span className="muted small"> {r.current}% of {r.required}% required</span></div>
      <div className="bar"><i style={{ width: r.current + '%' }} className={r.status === 'strong' ? '' : 'warm'} /><u style={{ left: r.required + '%' }} /></div></div>))}</section>
    <div className="grid3">{GROUPS.map(([k, t]) => (<section className="card" key={k}><h2>{t}</h2>{d.rows.filter((r) => r.status === k).map((r) => <p key={r.skill}>{r.skill}</p>)}
      {!d.rows.some((r) => r.status === k) && <p className="muted small">None</p>}</section>))}</div>
    <p className="small muted">Learn = below 30%, improve = 30% up to the requirement. Required levels are set per role. <Link to="/assessment">Take an assessment</Link> to update your scores.</p></>);
}
