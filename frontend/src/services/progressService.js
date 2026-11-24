// Progress Tracking Service for SkillForge AI
// Tracks learning activities, streaks, milestones, goals, and trends.

const PROGRESS_STORAGE_KEY = 'sf_progress_data';

export const ACTIVITY_TYPES = [
  { id: 'practice', label: 'Practice Question', icon: '📝', color: '#db2777' },
  { id: 'assessment', label: 'Skill Assessment', icon: '⚡', color: '#e11d48' },
  { id: 'interview', label: 'Mock Interview', icon: '🎙️', color: '#7c3aed' },
  { id: 'resume', label: 'Resume Analysis', icon: '📄', color: '#059669' },
  { id: 'project', label: 'Project Review', icon: '💻', color: '#d97706' },
];

export const MILESTONES_CONFIG = [
  {
    id: 'first_step',
    title: 'First Step',
    description: 'Complete your first practice, assessment, or interview.',
    icon: '🚀',
    category: 'Getting Started',
    evaluator: (activities) => activities.length >= 1,
    progress: (activities) => Math.min(100, Math.round((activities.length / 1) * 100)),
  },
  {
    id: 'streak_3',
    title: 'Consistent Forge',
    description: 'Build a 3-day active practice streak.',
    icon: '🔥',
    category: 'Streaks',
    evaluator: (_, streak) => (streak.longest || streak.current) >= 3,
    progress: (_, streak) => Math.min(100, Math.round((Math.max(streak.current, streak.longest) / 3) * 100)),
  },
  {
    id: 'streak_7',
    title: 'Unstoppable Habit',
    description: 'Maintain a 7-day active learning streak.',
    icon: '⚡',
    category: 'Streaks',
    evaluator: (_, streak) => (streak.longest || streak.current) >= 7,
    progress: (_, streak) => Math.min(100, Math.round((Math.max(streak.current, streak.longest) / 7) * 100)),
  },
  {
    id: 'interview_master',
    title: 'Interview Ready',
    description: 'Complete 3 AI Mock Interview sessions.',
    icon: '🎙️',
    category: 'Interviews',
    evaluator: (activities) => activities.filter((a) => a.type === 'interview').length >= 3,
    progress: (activities) => Math.min(100, Math.round((activities.filter((a) => a.type === 'interview').length / 3) * 100)),
  },
  {
    id: 'skill_assessment_pro',
    title: 'Certified Competent',
    description: 'Pass 3 Skill Assessments with score 70% or higher.',
    icon: '🏆',
    category: 'Assessments',
    evaluator: (activities) => activities.filter((a) => a.type === 'assessment' && (a.score || 0) >= 70).length >= 3,
    progress: (activities) => Math.min(100, Math.round((activities.filter((a) => a.type === 'assessment' && (a.score || 0) >= 70).length / 3) * 100)),
  },
  {
    id: 'century_club',
    title: 'Century Club',
    description: 'Log 25 total technical preparation activities.',
    icon: '💯',
    category: 'Mastery',
    evaluator: (activities) => activities.length >= 25,
    progress: (activities) => Math.min(100, Math.round((activities.length / 25) * 100)),
  },
];

// Generates sensible seed history so the dashboard is immediately demonstrative
const getInitialSeedData = () => {
  const now = new Date();
  const sampleActivities = [
    {
      id: 'act-1',
      type: 'practice',
      title: 'JavaScript Async/Await & Event Loop',
      score: 92,
      durationMinutes: 15,
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'act-2',
      type: 'interview',
      title: 'Full Stack Developer Technical Screen',
      score: 85,
      durationMinutes: 25,
      timestamp: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'act-3',
      type: 'assessment',
      title: 'React Hooks & State Management',
      score: 80,
      durationMinutes: 18,
      timestamp: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'act-4',
      type: 'resume',
      title: 'Full Stack Resume ATS Critique',
      score: 88,
      durationMinutes: 10,
      timestamp: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'act-5',
      type: 'practice',
      title: 'SQL Window Functions & Indexing',
      score: 95,
      durationMinutes: 20,
      timestamp: new Date(now.getTime() - 96 * 60 * 60 * 1000).toISOString(),
    },
  ];

  return {
    activities: sampleActivities,
    streak: {
      current: 4,
      longest: 7,
      lastActiveDate: now.toISOString().slice(0, 10),
      freezeAvailable: true,
      freezeActive: false,
    },
    milestonesUnlocked: ['first_step', 'streak_3'],
  };
};

export const progressService = {
  // Load raw state
  getState: () => {
    try {
      const stored = localStorage.getItem(PROGRESS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load progress state, initializing defaults:', e);
    }
    const initial = getInitialSeedData();
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(initial));
    return initial;
  },

  // Persist state
  saveState: (state) => {
    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save progress state:', e);
    }
  },

  // Get all activities sorted descending
  getActivities: () => {
    const state = progressService.getState();
    return (state.activities || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  // Add new activity
  addActivity: ({ type, title, score, durationMinutes = 15, metadata = {} }) => {
    const state = progressService.getState();
    const id = 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const newEntry = {
      id,
      type: type || 'practice',
      title: title || 'Completed Activity',
      score: typeof score === 'number' ? score : undefined,
      durationMinutes: Number(durationMinutes) || 15,
      metadata,
      timestamp: new Date().toISOString(),
    };

    const activities = [newEntry, ...(state.activities || [])];

    // Recompute streak
    const streak = progressService.calculateStreak(activities, state.streak);

    // Evaluate milestones
    const newUnlocked = [];
    const currentlyUnlocked = new Set(state.milestonesUnlocked || []);

    MILESTONES_CONFIG.forEach((m) => {
      if (!currentlyUnlocked.has(m.id) && m.evaluator(activities, streak)) {
        currentlyUnlocked.add(m.id);
        newUnlocked.push(m);
      }
    });

    const nextState = {
      activities,
      streak,
      milestonesUnlocked: Array.from(currentlyUnlocked),
    };

    progressService.saveState(nextState);

    return {
      entry: newEntry,
      newMilestones: newUnlocked,
      streak,
    };
  },

  // Edit an activity
  updateActivity: (id, updates) => {
    const state = progressService.getState();
    const activities = (state.activities || []).map((a) => (a.id === id ? { ...a, ...updates } : a));
    const streak = progressService.calculateStreak(activities, state.streak);
    const nextState = { ...state, activities, streak };
    progressService.saveState(nextState);
    return nextState;
  },

  // Delete an activity
  deleteActivity: (id) => {
    const state = progressService.getState();
    const activities = (state.activities || []).filter((a) => a.id !== id);
    const streak = progressService.calculateStreak(activities, state.streak);
    const nextState = { ...state, activities, streak };
    progressService.saveState(nextState);
    return nextState;
  },

  // Clear all progress data
  clearProgress: () => {
    const cleared = {
      activities: [],
      streak: {
        current: 0,
        longest: 0,
        lastActiveDate: '',
        freezeAvailable: true,
        freezeActive: false,
      },
      milestonesUnlocked: [],
    };
    progressService.saveState(cleared);
    return cleared;
  },

  // Streak calculator
  calculateStreak: (activities, existingStreak = {}) => {
    if (!activities || !activities.length) {
      return {
        current: 0,
        longest: existingStreak.longest || 0,
        lastActiveDate: '',
        freezeAvailable: true,
        freezeActive: false,
      };
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const activeDates = new Set(activities.map((a) => a.timestamp.slice(0, 10)));

    let current = 0;
    let checkDate = new Date();

    // Check if user was active today or yesterday
    const todayActive = activeDates.has(todayStr);
    if (!todayActive) {
      // Step back to yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dStr = checkDate.toISOString().slice(0, 10);
      if (activeDates.has(dStr)) {
        current += 1;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (existingStreak.freezeActive && current > 0) {
        // Freeze utilized for one missed day
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    const longest = Math.max(current, existingStreak.longest || 0);

    return {
      current,
      longest,
      lastActiveDate: activities[0]?.timestamp.slice(0, 10) || '',
      freezeAvailable: existingStreak.freezeAvailable ?? true,
      freezeActive: existingStreak.freezeActive ?? false,
    };
  },

  // Toggle streak freeze
  toggleStreakFreeze: () => {
    const state = progressService.getState();
    const freezeActive = !state.streak.freezeActive;
    const streak = { ...state.streak, freezeActive };
    progressService.saveState({ ...state, streak });
    return streak;
  },

  // Compute summary aggregates
  getAggregates: (goals = {}) => {
    const activities = progressService.getActivities();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // Start of week
    const dayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon
    const startOfWeek = new Date(now);
    const diff = goals.weekStartDay === 'sunday' ? dayOfWeek : (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    startOfWeek.setDate(now.getDate() - diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // Start of month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayActivities = activities.filter((a) => a.timestamp.slice(0, 10) === todayStr);
    const weekActivities = activities.filter((a) => new Date(a.timestamp) >= startOfWeek);
    const monthActivities = activities.filter((a) => new Date(a.timestamp) >= startOfMonth);

    const dailyTarget = goals.dailyQuestions || 5;
    const weeklyTarget = (goals.weeklyInterviews || 2) + (goals.weeklyAssessments || 1) + (goals.dailyQuestions || 5) * 5;

    const todayScoreList = todayActivities.filter((a) => typeof a.score === 'number').map((a) => a.score);
    const todayAvgScore = todayScoreList.length ? Math.round(todayScoreList.reduce((s, x) => s + x, 0) / todayScoreList.length) : null;

    const allScores = activities.filter((a) => typeof a.score === 'number').map((a) => a.score);
    const allTimeAvgScore = allScores.length ? Math.round(allScores.reduce((s, x) => s + x, 0) / allScores.length) : null;

    const totalMinutes = activities.reduce((sum, a) => sum + (a.durationMinutes || 15), 0);
    const todayMinutes = todayActivities.reduce((sum, a) => sum + (a.durationMinutes || 15), 0);

    return {
      todayCount: todayActivities.length,
      todayPercent: Math.min(100, Math.round((todayActivities.length / dailyTarget) * 100)),
      dailyTarget,
      todayMinutes,
      todayAvgScore,
      weekCount: weekActivities.length,
      weeklyTarget,
      weekPercent: Math.min(100, Math.round((weekActivities.length / weeklyTarget) * 100)),
      monthCount: monthActivities.length,
      allTimeCount: activities.length,
      allTimeAvgScore,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    };
  },

  // Heatmap data generator (e.g. last 28 days)
  getHeatmapData: (daysCount = 28) => {
    const activities = progressService.getActivities();
    const countByDate = {};

    activities.forEach((a) => {
      const d = a.timestamp.slice(0, 10);
      countByDate[d] = (countByDate[d] || 0) + 1;
    });

    const cells = [];
    const now = new Date();

    for (let i = daysCount - 1; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const count = countByDate[dateStr] || 0;

      let level = 0;
      if (count >= 5) level = 4;
      else if (count >= 3) level = 3;
      else if (count >= 2) level = 2;
      else if (count >= 1) level = 1;

      cells.push({
        date: dateStr,
        dayLabel: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        count,
        level,
      });
    }

    return cells;
  },

  // Trend chart data (Daily / Weekly / Monthly)
  getTrendData: (range = 'daily') => {
    const activities = progressService.getActivities();

    if (range === 'monthly') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const byMonth = {};
      activities.forEach((a) => {
        const d = new Date(a.timestamp);
        const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
        if (!byMonth[key]) byMonth[key] = { count: 0, scores: [] };
        byMonth[key].count += 1;
        if (typeof a.score === 'number') byMonth[key].scores.push(a.score);
      });

      return Object.entries(byMonth)
        .slice(-6)
        .map(([label, val]) => ({
          label,
          count: val.count,
          avgScore: val.scores.length ? Math.round(val.scores.reduce((s, x) => s + x, 0) / val.scores.length) : null,
        }));
    }

    if (range === 'weekly') {
      const byWeek = {};
      const now = new Date();
      for (let i = 5; i >= 0; i -= 1) {
        const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
        const label = `Wk ${end.getMonth() + 1}/${end.getDate()}`;
        byWeek[label] = { start, end, count: 0, scores: [] };
      }

      activities.forEach((a) => {
        const time = new Date(a.timestamp).getTime();
        Object.values(byWeek).forEach((w) => {
          if (time >= w.start.getTime() && time <= w.end.getTime()) {
            w.count += 1;
            if (typeof a.score === 'number') w.scores.push(a.score);
          }
        });
      });

      return Object.entries(byWeek).map(([label, val]) => ({
        label,
        count: val.count,
        avgScore: val.scores.length ? Math.round(val.scores.reduce((s, x) => s + x, 0) / val.scores.length) : null,
      }));
    }

    // Default: daily (last 7 days)
    const result = [];
    const now = new Date();

    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

      const dayActs = activities.filter((a) => a.timestamp.slice(0, 10) === dateStr);
      const scores = dayActs.filter((a) => typeof a.score === 'number').map((a) => a.score);

      result.push({
        label: dayName,
        date: dateStr,
        count: dayActs.length,
        avgScore: scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : null,
      });
    }

    return result;
  },

  // Insights computation
  getWeeklyInsights: () => {
    const activities = progressService.getActivities();
    if (!activities.length) {
      return {
        bestDay: 'N/A',
        improvementPercent: 0,
        suggestion: 'Start your first practice session or mock interview to unlock personalized insights.',
      };
    }

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayCounts = {};
    days.forEach((d) => (dayCounts[d] = 0));

    activities.forEach((a) => {
      const dayName = days[new Date(a.timestamp).getDay()];
      dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
    });

    let bestDay = days[1];
    let maxCount = -1;
    Object.entries(dayCounts).forEach(([day, count]) => {
      if (count > maxCount) {
        maxCount = count;
        bestDay = day;
      }
    });

    // Improvement vs last week
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const thisWeekCount = activities.filter((a) => new Date(a.timestamp) >= oneWeekAgo).length;
    const lastWeekCount = activities.filter((a) => new Date(a.timestamp) >= twoWeeksAgo && new Date(a.timestamp) < oneWeekAgo).length;

    let improvementPercent = 0;
    if (lastWeekCount === 0) {
      improvementPercent = thisWeekCount > 0 ? 100 : 0;
    } else {
      improvementPercent = Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100);
    }

    let suggestion = `You are most productive on ${bestDay}s. Schedule your upcoming mock interview on ${bestDay} for peak performance!`;
    if (thisWeekCount < 3) {
      suggestion = 'Aim for at least one 15-minute practice session today to maintain your learning momentum.';
    }

    return {
      bestDay,
      improvementPercent,
      suggestion,
    };
  },

  // Export to CSV
  exportToCsv: () => {
    const activities = progressService.getActivities();
    const headers = ['ID', 'Type', 'Title', 'Score', 'DurationMinutes', 'Timestamp'];
    const rows = activities.map((a) => [
      `"${a.id}"`,
      `"${a.type}"`,
      `"${(a.title || '').replace(/"/g, '""')}"`,
      a.score ?? '',
      a.durationMinutes || '',
      `"${a.timestamp}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return csvContent;
  },
};
