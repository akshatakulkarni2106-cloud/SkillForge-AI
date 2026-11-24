const Activity = require('../models/Activity');
const AssessmentSession = require('../models/AssessmentSession');
const InterviewSession = require('../models/InterviewSession');
const ROLES = require('../utils/roles');
const avg = (a) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null);

/* Score definitions (no invented numbers):
   technical = mean of the student's skill scores
   interview = mean of the last 3 interview scores;  project = latest project-health score
   overall   = weighted mean of the available parts (technical .5, interview .3, project .2), weights renormalised
   readiness = mean over the target role's required skills of min(current / required, 1) * 100  (a learning indicator, not a job prediction) */
exports.summary = async (req, res, next) => {
  try {
    const u = req.user;
    const acts = await Activity.find({ userId: u._id }).sort({ createdAt: -1 }).limit(30);
    const technical = avg(u.skills.map((s) => s.score));
    const interview = avg(acts.filter((a) => a.type === 'interview').slice(0, 3).map((a) => a.score));
    const project = acts.find((a) => a.type === 'project')?.score ?? null;
    const parts = [[technical, 0.5], [interview, 0.3], [project, 0.2]].filter(([v]) => v !== null);
    const w = parts.reduce((s, [, x]) => s + x, 0);
    const overall = w ? Math.round(parts.reduce((s, [v, x]) => s + v * x, 0) / w) : null;
    const need = ROLES[u.targetRole] || {};
    const have = Object.fromEntries(u.skills.map((s) => [s.name, s.score]));
    const ratios = Object.entries(need).map(([k, n]) => Math.min((have[k] || 0) / n, 1) * 100);

    // Fetch active in-progress items
    const [activeInterviews, activeAssessments] = await Promise.all([
      InterviewSession.find({ userId: u._id, status: 'in_progress' }).sort({ updatedAt: -1 }).limit(5),
      AssessmentSession.find({ userId: u._id, status: 'active' }).sort({ updatedAt: -1 }).limit(5),
    ]);

    const inProgressItems = [
      ...activeInterviews.map((item) => ({
        id: String(item._id),
        type: 'interview',
        title: `${item.role} Mock Interview`,
        badge: 'Interview',
        level: item.experienceLevel ? `${item.experienceLevel} level` : 'Adaptive',
        progressText: `${item.transcript?.length || 0} questions answered`,
        progressPercent: Math.min(100, Math.max(15, Math.round(((item.transcript?.length || 0) / 5) * 100))),
        updatedAt: item.updatedAt || item.createdAt,
        link: `/interview?session=${item._id}`,
      })),
      ...activeAssessments.map((item) => {
        const answered = item.questions?.filter((q) => q.userIndex !== null).length || 0;
        const total = item.questions?.length || item.defaultLength || 10;
        return {
          id: String(item._id),
          type: 'assessment',
          title: `${item.skill} Skill Assessment`,
          badge: 'Assessment',
          level: item.currentDifficulty ? `${item.currentDifficulty} difficulty` : 'Adaptive',
          progressText: `${answered} of ${total} answered`,
          progressPercent: Math.min(100, Math.max(10, Math.round((answered / total) * 100))),
          updatedAt: item.updatedAt || item.createdAt,
          link: `/assessment?session=${item._id}`,
        };
      }),
    ];

    res.json({
      scores: { overall, technical, interview, project, readiness: ratios.length ? avg(ratios) : null },
      skills: u.skills,
      targetRole: u.targetRole,
      recentActivity: acts.slice(0, 5),
      inProgressItems,
    });
  } catch (e) { next(e); }
};

