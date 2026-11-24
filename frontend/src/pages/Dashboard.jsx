import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CARDS = [
  ['overall', 'Overall skill score'],
  ['technical', 'Technical'],
  ['interview', 'Interview'],
  ['project', 'Project health'],
  ['readiness', 'Role readiness'],
];

const ACTIONS = [
  ['/interview', 'Start AI interview'],
  ['/assessment', 'Take skill test'],
  ['/resume', 'Analyze resume'],
  ['/projects', 'Analyze project'],
  ['/roadmap', 'View roadmap'],
];

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const loadDashboard = () => {
    setLoading(true);
    setErr('');
    api('/dashboard/summary')
      .then((data) => {
        setD(data);
        setLoading(false);
      })
      .catch((e) => {
        setErr(e.message || 'Failed to load dashboard data. Please try again.');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (err) {
    return (
      <div className="empty" style={{ margin: '40px auto', maxWidth: 480, textAlign: 'center' }}>
        <h2>Dashboard Error</h2>
        <p className="muted" style={{ margin: '8px 0 16px' }}>{err}</p>
        <button type="button" className="primary" onClick={loadDashboard}>
          Try again
        </button>
      </div>
    );
  }

  if (loading || !d) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="skeleton" style={{ height: 60, width: 320 }} />
        <div className="skeleton-grid">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 90 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 180 }} />
        <div className="skeleton" style={{ height: 260 }} />
      </div>
    );
  }

  const chart = (d.skills || []).map((s) => ({ name: s.name, score: s.score }));
  const inProgressItems = Array.isArray(d.inProgressItems) ? d.inProgressItems : [];

  return (
    <>
      <header className="hero">
        <h1>{greet()}, {user?.name ? user.name.split(' ')[0] : 'Student'}</h1>
        <p className="muted">Let's improve your career readiness today.</p>
      </header>

      {/* Real Stat Cards */}
      <section className="cards">
        {CARDS.map(([k, label]) => (
          <div className="card stat" key={k}>
            <small>{label}</small>
            <b>
              {d.scores && d.scores[k] !== null && d.scores[k] !== undefined ? `${d.scores[k]}%` : '—'}
            </b>
            {(!d.scores || d.scores[k] === null || d.scores[k] === undefined) && (
              <span className="muted small">Complete an activity to unlock</span>
            )}
          </div>
        ))}
      </section>

      {/* In Progress Section */}
      <section className="card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>In Progress</h2>
          {inProgressItems.length > 0 && (
            <span className="tag mid" style={{ fontSize: '0.78rem' }}>
              {inProgressItems.length} active {inProgressItems.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        {inProgressItems.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              background: 'var(--pri-subtle)',
              borderRadius: 10,
              border: '1px dashed var(--line)',
            }}
          >
            <span style={{ fontSize: '1.6rem', display: 'block', marginBottom: 6 }}>🎯</span>
            <strong style={{ display: 'block', color: 'var(--ink)' }}>No in-progress items</strong>
            <p className="muted small" style={{ margin: '4px 0 14px' }}>
              You're all caught up! You have no unfinished assessments or mock interviews.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/assessment" className="btn" style={{ fontSize: '0.82rem', padding: '7px 14px' }}>
                Start Skill Assessment
              </Link>
              <Link to="/interview" className="btn" style={{ fontSize: '0.82rem', padding: '7px 14px' }}>
                Start Mock Interview
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid2" style={{ gap: 14 }}>
            {inProgressItems.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{
                  margin: 0,
                  padding: '16px 18px',
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span className={`tag ${item.type === 'interview' ? 'ok' : 'mid'}`} style={{ textTransform: 'capitalize' }}>
                      {item.badge || item.type}
                    </span>
                    <span className="muted small">{item.level}</span>
                  </div>
                  <strong style={{ fontSize: '1rem', display: 'block', marginBottom: 6 }}>{item.title}</strong>
                  <div className="bar" style={{ height: 6, margin: '8px 0 6px' }}>
                    <i style={{ width: `${item.progressPercent}%` }} />
                  </div>
                  <span className="muted small">{item.progressText}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <Link
                    to={item.link}
                    className="btn"
                    style={{
                      fontSize: '0.82rem',
                      padding: '7px 16px',
                      background: 'var(--pri)',
                      color: '#ffffff',
                      borderColor: 'var(--pri)',
                      fontWeight: 600,
                    }}
                  >
                    Resume →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Real Skills Breakdown */}
      <section className="card" style={{ marginTop: 20 }}>
        <h2>Skills</h2>
        {chart.length === 0 ? (
          <div className="empty" style={{ padding: '24px 0', textAlign: 'center' }}>
            <p className="muted">No skills recorded yet.</p>
            <Link to="/resume" className="btn" style={{ marginTop: 8 }}>
              Upload Resume to Extract Skills
            </Link>
          </div>
        ) : (
          <>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#fce7f1" />
                  <XAxis dataKey="name" tickLine={false} fontSize={12} />
                  <YAxis domain={[0, 100]} tickLine={false} fontSize={12} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {chart.map((c, i) => (
                      <Cell key={i} fill={c.score < 50 ? '#fb7185' : '#e11d48'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="muted small" style={{ marginTop: 8 }}>
              Scores below 50% are highlighted as key areas for targeted practice.
            </p>
          </>
        )}
      </section>

      {/* Grid: Actions & Recent Activity */}
      <div className="grid2" style={{ marginTop: 20, gap: 20 }}>
        <section className="card" style={{ margin: 0 }}>
          <h2>Quick actions</h2>
          <div className="actions">
            {ACTIONS.map(([to, l]) => (
              <Link key={to} to={to} className="btn">
                {l}
              </Link>
            ))}
          </div>
        </section>

        <section className="card" style={{ margin: 0 }}>
          <h2>Recent activity</h2>
          {(!d.recentActivity || d.recentActivity.length === 0) ? (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <p className="muted small">Nothing yet. Take a skill test or interview to get started.</p>
              <Link to="/assessment" className="btn" style={{ fontSize: '0.82rem', marginTop: 6 }}>
                Take Assessment
              </Link>
            </div>
          ) : (
            <ul className="feed">
              {d.recentActivity.map((a) => (
                <li key={a._id}>
                  <span>
                    <b style={{ textTransform: 'capitalize' }}>{a.type}</b> {a.title}
                  </span>
                  {a.score != null && <em>{a.score}%</em>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
