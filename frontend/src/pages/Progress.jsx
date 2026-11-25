import { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import { progressService, ACTIVITY_TYPES, MILESTONES_CONFIG } from '../services/progressService';

export default function Progress() {
  const { settings } = useSettings();
  const [activities, setActivities] = useState([]);
  const [streak, setStreak] = useState({ current: 0, longest: 0, freezeActive: false });
  const [trendRange, setTrendRange] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Add / Edit Activity
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activityForm, setActivityForm] = useState({
    type: 'practice',
    title: '',
    score: '',
    durationMinutes: 15,
  });

  // Recent Celebration Banner
  const [recentCelebration, setRecentCelebration] = useState(null);

  const loadData = () => {
    const list = progressService.getActivities();
    const st = progressService.getState().streak || { current: 0, longest: 0, freezeActive: false };
    setActivities(list);
    setStreak(st);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Aggregates computed with live settings goals
  const aggregates = useMemo(() => {
    return progressService.getAggregates(settings.goals);
  }, [activities, settings.goals]);

  // Heatmap data
  const heatmapData = useMemo(() => {
    return progressService.getHeatmapData(28);
  }, [activities]);

  // Trend chart data
  const trendData = useMemo(() => {
    return progressService.getTrendData(trendRange);
  }, [activities, trendRange]);

  // Insights
  const insights = useMemo(() => {
    return progressService.getWeeklyInsights();
  }, [activities]);

  // Milestones with live status
  const milestones = useMemo(() => {
    const state = progressService.getState();
    const unlockedIds = new Set(state.milestonesUnlocked || []);

    return MILESTONES_CONFIG.map((m) => {
      const isUnlocked = unlockedIds.has(m.id) || m.evaluator(activities, streak);
      const prog = isUnlocked ? 100 : m.progress(activities, streak);
      return {
        ...m,
        isUnlocked,
        progressPercent: prog,
      };
    });
  }, [activities, streak]);

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      const matchesType = typeFilter === 'all' || act.type === typeFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        act.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        act.type.toLowerCase().includes(searchQuery.trim().toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [activities, typeFilter, searchQuery]);

  // Streak Freeze handler
  const handleToggleFreeze = () => {
    const updated = progressService.toggleStreakFreeze();
    setStreak(updated);
    toast.success(
      updated.freezeActive
        ? 'Streak Freeze activated! Your streak is protected if you miss a day.'
        : 'Streak Freeze deactivated.'
    );
  };

  // Add / Edit submission
  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!activityForm.title.trim()) {
      toast.error('Please enter an activity title.');
      return;
    }

    const scoreNum = activityForm.score !== '' ? Math.min(100, Math.max(0, Number(activityForm.score))) : undefined;
    const durationNum = Math.max(1, Number(activityForm.durationMinutes) || 15);

    if (editingId) {
      progressService.updateActivity(editingId, {
        type: activityForm.type,
        title: activityForm.title.trim(),
        score: scoreNum,
        durationMinutes: durationNum,
      });
      toast.success('Activity updated.');
    } else {
      const result = progressService.addActivity({
        type: activityForm.type,
        title: activityForm.title.trim(),
        score: scoreNum,
        durationMinutes: durationNum,
      });

      if (result.newMilestones && result.newMilestones.length > 0) {
        const milestone = result.newMilestones[0];
        setRecentCelebration(milestone);
        toast.success(`🎉 Achievement Unlocked: ${milestone.title}!`);
      } else {
        toast.success('Activity logged successfully.');
      }
    }

    setModalOpen(false);
    setEditingId(null);
    setActivityForm({ type: 'practice', title: '', score: '', durationMinutes: 15 });
    loadData();
  };

  // Delete activity
  const handleDelete = (id) => {
    if (window.confirm('Delete this activity entry?')) {
      progressService.deleteActivity(id);
      loadData();
      toast.success('Activity deleted.');
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setActivityForm({ type: 'practice', title: '', score: '', durationMinutes: 15 });
    setModalOpen(true);
  };

  const openEditModal = (act) => {
    setEditingId(act.id);
    setActivityForm({
      type: act.type,
      title: act.title,
      score: act.score !== undefined ? String(act.score) : '',
      durationMinutes: act.durationMinutes || 15,
    });
    setModalOpen(true);
  };

  const getTypeMeta = (typeId) => {
    return ACTIVITY_TYPES.find((t) => t.id === typeId) || { label: typeId, icon: '📌', color: 'var(--pri)' };
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1>Preparation Progress</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Track daily targets, preparation streaks, achievement milestones, and comprehensive learning history.
          </p>
        </div>
        <button type="button" className="primary" onClick={openAddModal}>
          + Log Activity
        </button>
      </div>

      {/* Celebration Banner if recently unlocked */}
      {recentCelebration && (
        <div
          className="card celebration-banner"
          style={{
            background: 'linear-gradient(135deg, #180815, #350c26)',
            color: '#fff',
            border: '2px solid #f43f5e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: '2.5rem' }}>{recentCelebration.icon}</span>
            <div>
              <div style={{ fontSize: '.85rem', color: '#fb7185', fontWeight: 700, textTransform: 'uppercase' }}>
                New Milestone Unlocked!
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{recentCelebration.title}</div>
              <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '.9rem' }}>{recentCelebration.description}</p>
            </div>
          </div>
          <button
            type="button"
            className="ghost"
            style={{ color: '#fff', borderColor: '#fb7185' }}
            onClick={() => setRecentCelebration(null)}
          >
            Dismiss ✕
          </button>
        </div>
      )}

      {/* Overview KPI Cards */}
      <div className="cards">
        <div className="card stat">
          <small>Today vs Goal</small>
          <b>
            {aggregates.todayCount} <span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--mut)' }}>/ {aggregates.dailyTarget}</span>
          </b>
          <div className="bar" style={{ height: 6, margin: '8px 0 4px' }}>
            <div
              style={{
                width: `${aggregates.todayPercent}%`,
                height: '100%',
                borderRadius: 99,
                background: 'var(--pri-gradient)',
              }}
            />
          </div>
          <small className="muted">{aggregates.todayPercent}% completed today</small>
        </div>

        <div className="card stat">
          <small>This Week</small>
          <b>
            {aggregates.weekCount} <span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--mut)' }}>/ {aggregates.weeklyTarget}</span>
          </b>
          <div className="bar" style={{ height: 6, margin: '8px 0 4px' }}>
            <div
              style={{
                width: `${aggregates.weekPercent}%`,
                height: '100%',
                borderRadius: 99,
                background: 'var(--pri-gradient)',
              }}
            />
          </div>
          <small className="muted">{aggregates.weekPercent}% of weekly target</small>
        </div>

        <div className="card stat">
          <small>All-Time Prepared</small>
          <b>{aggregates.allTimeCount}</b>
          <small className="muted" style={{ marginTop: 8, display: 'block' }}>
            {aggregates.totalHours} active hours logged
          </small>
        </div>

        <div className="card stat">
          <small>Average Score</small>
          <b>{aggregates.allTimeAvgScore !== null ? `${aggregates.allTimeAvgScore}%` : 'N/A'}</b>
          <small className="muted" style={{ marginTop: 8, display: 'block' }}>
            Evaluated assessments & interviews
          </small>
        </div>
      </div>

      {/* Streaks & Insights Row */}
      <div className="grid2" style={{ marginBottom: 20 }}>
        {/* Streak Tracker */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Consistency Streaks</h2>
              <span
                style={{
                  background: 'var(--pri-subtle)',
                  color: 'var(--pri)',
                  padding: '4px 10px',
                  borderRadius: 99,
                  fontWeight: 700,
                  fontSize: '.85rem',
                }}
              >
                🔥 Active
              </span>
            </div>

            <div style={{ display: 'flex', gap: 24, margin: '16px 0' }}>
              <div>
                <span className="muted small">Current Streak</span>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'Bricolage Grotesque, Inter', color: 'var(--pri)' }}>
                  {streak.current} <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--ink)' }}>days</span>
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 24 }}>
                <span className="muted small">Longest Streak</span>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'Bricolage Grotesque, Inter', color: 'var(--ink)' }}>
                  {streak.longest} <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--mut)' }}>days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Streak Freeze Control */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: 12,
              background: streak.freezeActive ? 'rgba(59, 130, 246, 0.15)' : 'var(--pri-subtle)',
              border: '1px solid',
              borderColor: streak.freezeActive ? 'rgba(59, 130, 246, 0.35)' : 'var(--line)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '.9rem', color: streak.freezeActive ? '#3b82f6' : 'var(--ink)' }}>
                ❄️ Streak Freeze {streak.freezeActive ? '(Active)' : '(Available)'}
              </div>
              <div style={{ fontSize: '.78rem', color: 'var(--mut)' }}>
                Protects your streak if you miss a day due to exams or travel.
              </div>
            </div>
            <button
              type="button"
              className="btn"
              onClick={handleToggleFreeze}
              style={{
                fontSize: '.82rem',
                padding: '6px 12px',
                borderColor: streak.freezeActive ? '#3b82f6' : 'var(--line-strong)',
                color: streak.freezeActive ? '#1d4ed8' : 'var(--ink)',
              }}
            >
              {streak.freezeActive ? 'Deactivate Freeze' : 'Equip Freeze'}
            </button>
          </div>
        </div>

        {/* Weekly Insights */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2>Weekly Performance Insights</h2>
            <div style={{ margin: '14px 0', display: 'flex', gap: 20 }}>
              <div>
                <span className="muted small">Peak Productivity Day</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>
                  {insights.bestDay}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 20 }}>
                <span className="muted small">Velocity vs Last Week</span>
                <div
                  style={{
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    marginTop: 4,
                    color: insights.improvementPercent >= 0 ? '#059669' : '#e11d48',
                  }}
                >
                  {insights.improvementPercent >= 0 ? `+${insights.improvementPercent}%` : `${insights.improvementPercent}%`}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              background: 'var(--card)',
              border: '1px solid var(--line-strong)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <span style={{ fontSize: '1.3rem' }}>💡</span>
            <div style={{ fontSize: '.88rem', lineHeight: 1.5, color: 'var(--ink)' }}>
              <b>Smart Suggestion:</b> {insights.suggestion}
            </div>
          </div>
        </div>
      </div>

      {/* Activity Heatmap Calendar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2>Activity Calendar Heatmap</h2>
            <span className="muted small">Past 28 days of technical practice and interview sessions</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.78rem', color: 'var(--mut)' }}>
            <span>Less</span>
            <span className="heatmap-cell level-0" style={{ width: 14, height: 14, display: 'inline-block' }} />
            <span className="heatmap-cell level-1" style={{ width: 14, height: 14, display: 'inline-block' }} />
            <span className="heatmap-cell level-2" style={{ width: 14, height: 14, display: 'inline-block' }} />
            <span className="heatmap-cell level-3" style={{ width: 14, height: 14, display: 'inline-block' }} />
            <span className="heatmap-cell level-4" style={{ width: 14, height: 14, display: 'inline-block' }} />
            <span>More</span>
          </div>
        </div>

        <div className="heatmap-grid">
          {heatmapData.map((cell) => (
            <div
              key={cell.date}
              className={`heatmap-cell level-${cell.level}`}
              title={`${cell.dayLabel}: ${cell.count} activities logged`}
            />
          ))}
        </div>
      </div>

      {/* Activity Trend Chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2>Preparation Trends</h2>
            <span className="muted small">Volume of technical sessions completed</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['daily', 'weekly', 'monthly'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTrendRange(r)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: '.82rem',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  border: '1px solid',
                  borderColor: trendRange === r ? 'var(--pri)' : 'var(--line)',
                  background: trendRange === r ? 'var(--pri-subtle)' : 'transparent',
                  color: trendRange === r ? 'var(--pri)' : 'var(--ink)',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: 240, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--mut)" fontSize={12} tickLine={false} />
              <YAxis allowDecimals={false} stroke="var(--mut)" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--line-strong)',
                  borderRadius: 10,
                  color: 'var(--ink)',
                  fontSize: 12,
                }}
                formatter={(val, name) => [val, name === 'count' ? 'Activities' : 'Avg Score']}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {trendData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.count > 0 ? 'var(--pri)' : 'var(--line-strong)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Milestones and Badges */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 6 }}>Milestones & Achievement Badges</h2>
        <p className="muted small" style={{ margin: '0 0 18px' }}>
          Celebrate your engineering preparation wins as you hit key milestones.
        </p>

        <div className="badge-grid">
          {milestones.map((m) => (
            <div key={m.id} className={`badge-card ${m.isUnlocked ? 'unlocked' : 'locked'}`}>
              <div className="badge-icon">{m.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--ink)' }}>{m.title}</div>
              <p className="muted" style={{ margin: 0, fontSize: '.8rem', lineHeight: 1.4 }}>
                {m.description}
              </p>
              <div style={{ width: '100%', marginTop: 'auto', paddingTop: 8 }}>
                <div className="bar" style={{ height: 6, margin: '4px 0' }}>
                  <div
                    style={{
                      width: `${m.progressPercent}%`,
                      height: '100%',
                      borderRadius: 99,
                      background: m.isUnlocked ? '#059669' : 'var(--pri)',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: 'var(--mut)' }}>
                  <span>{m.category}</span>
                  <span>{m.isUnlocked ? 'Unlocked ✓' : `${m.progressPercent}%`}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* History Log */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>Activity History Log</h2>
            <span className="muted small">{filteredActivities.length} total logged sessions</span>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search history…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 180, fontSize: '.85rem', padding: '6px 12px' }}
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ fontSize: '.85rem', padding: '6px 12px' }}
            >
              <option value="all">All Types</option>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredActivities.length === 0 ? (
          <div className="empty" style={{ padding: '40px 20px' }}>
            <h3>No activities found</h3>
            <p className="muted" style={{ margin: '8px 0 16px' }}>
              {searchQuery ? 'Try adjusting your search filters.' : 'Log your first practice question or interview above.'}
            </p>
            <button type="button" className="primary" onClick={openAddModal}>
              Log Activity Now
            </button>
          </div>
        ) : (
          <ul className="feed">
            {filteredActivities.map((act) => {
              const meta = getTypeMeta(act.type);
              const dateFormatted = new Date(act.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <li key={act.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: 'var(--pri-subtle)',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '1.15rem',
                        flexShrink: 0,
                      }}
                    >
                      {meta.icon}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{act.title}</div>
                      <div className="muted small" style={{ marginTop: 2 }}>
                        {meta.label} • {act.durationMinutes || 15} mins • {dateFormatted}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {typeof act.score === 'number' && (
                      <em>{act.score}%</em>
                    )}
                    <button
                      type="button"
                      className="btn"
                      onClick={() => openEditModal(act)}
                      style={{ padding: '4px 8px', fontSize: '.78rem' }}
                      title="Edit Entry"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => handleDelete(act.id)}
                      style={{ padding: '4px 8px', fontSize: '.78rem', color: '#e11d48' }}
                      title="Delete Entry"
                    >
                      🗑️
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add / Edit Activity Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div className="card" style={{ maxWidth: 460, width: '100%', margin: 0 }}>
            <h3>{editingId ? 'Edit Activity Entry' : 'Log Technical Preparation'}</h3>
            <form onSubmit={handleFormSubmit} style={{ marginTop: 16 }}>
              <label style={{ marginBottom: 12 }}>
                Activity Type
                <select
                  value={activityForm.type}
                  onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}
                >
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </label>

              <label style={{ marginBottom: 12 }}>
                Title / Topic *
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Caching with Redis"
                  value={activityForm.title}
                  onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                />
              </label>

              <div className="grid2" style={{ marginBottom: 20 }}>
                <label>
                  Score (0-100, Optional)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 88"
                    value={activityForm.score}
                    onChange={(e) => setActivityForm({ ...activityForm, score: e.target.value })}
                  />
                </label>

                <label>
                  Duration (Minutes)
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={activityForm.durationMinutes}
                    onChange={(e) => setActivityForm({ ...activityForm, durationMinutes: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary">
                  {editingId ? 'Save Changes' : 'Log Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
