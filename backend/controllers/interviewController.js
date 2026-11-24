const InterviewSession = require('../models/InterviewSession');
const Activity = require('../models/Activity');

const avg = (arr) => (arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : null);

exports.getSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Fetch completed and in-progress sessions
    const completedSessions = await InterviewSession.find({
      userId,
      status: 'completed',
    }).sort({ createdAt: -1 });

    const inProgressSessions = await InterviewSession.find({
      userId,
      status: 'in_progress',
    }).sort({ updatedAt: -1 });

    // Also fetch activities of type 'interview' (e.g. seed data or external)
    const interviewActivities = await Activity.find({
      userId,
      type: 'interview',
    }).sort({ createdAt: -1 });

    // Combine recent interviews for display
    let recentInterviews = completedSessions.map((s) => ({
      id: s._id,
      role: s.role,
      experienceLevel: s.experienceLevel,
      overallScore: s.overallScore,
      verdict: s.verdict,
      questionCount: s.transcript?.length || 0,
      durationSeconds: s.sessionSeconds,
      createdAt: s.createdAt,
    }));

    // If there are activities that don't match any completed session, include them so seed data displays properly
    if (recentInterviews.length === 0 && interviewActivities.length > 0) {
      recentInterviews = interviewActivities.map((act) => ({
        id: act._id,
        role: act.title ? act.title.split('·')[0].trim() : 'Technical Interview',
        experienceLevel: 'mid',
        overallScore: act.score,
        verdict: act.score >= 75 ? 'Strong technical demonstration' : 'Satisfactory foundational knowledge',
        questionCount: 4,
        durationSeconds: 900,
        createdAt: act.createdAt,
      }));
    }

    const allScores = [
      ...completedSessions.map((s) => s.overallScore).filter((s) => s !== null && s !== undefined),
      ...(completedSessions.length === 0 ? interviewActivities.map((a) => a.score).filter((s) => s !== null) : []),
    ];

    const averageScore = avg(allScores);
    const lastScore = allScores.length ? allScores[0] : null;
    const totalInterviews = Math.max(completedSessions.length, interviewActivities.length);

    // Compute category breakdown averages
    const validCategorySessions = completedSessions.filter((s) => s.categoryScores && s.categoryScores.technicalDepth != null);
    const categoryAverages = {
      technicalDepth: avg(validCategorySessions.map((s) => s.categoryScores.technicalDepth)) ?? (averageScore || null),
      communication: avg(validCategorySessions.map((s) => s.categoryScores.communication)) ?? (averageScore || null),
      problemSolving: avg(validCategorySessions.map((s) => s.categoryScores.problemSolving)) ?? (averageScore || null),
      practicalExperience: avg(validCategorySessions.map((s) => s.categoryScores.practicalExperience)) ?? (averageScore || null),
    };

    const inProgress = inProgressSessions.map((s) => ({
      id: s._id,
      role: s.role,
      experienceLevel: s.experienceLevel,
      currentDifficulty: s.currentDifficulty,
      questionCount: s.transcript?.length || 0,
      currentQuestion: s.currentQuestion,
      sessionSeconds: s.sessionSeconds,
      timeLimitMinutes: s.timeLimitMinutes,
      startedAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    res.json({
      stats: {
        totalInterviews,
        averageScore,
        lastScore,
        categoryAverages,
      },
      recentInterviews,
      inProgress,
    });
  } catch (error) {
    next(error);
  }
};

exports.startSession = async (req, res, next) => {
  try {
    const { role, experienceLevel, timeLimitMinutes, firstQuestion, currentDifficulty } = req.body;

    if (!role) {
      return res.status(400).json({ message: 'Role is required' });
    }

    const session = await InterviewSession.create({
      userId: req.user._id,
      role: String(role).trim(),
      experienceLevel: experienceLevel || 'mid',
      timeLimitMinutes: Number(timeLimitMinutes) || 0,
      currentDifficulty: currentDifficulty || 'medium',
      currentQuestion: firstQuestion || '',
      status: 'in_progress',
      transcript: [],
    });

    res.status(201).json({ ok: true, session });
  } catch (error) {
    next(error);
  }
};

exports.updateProgress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await InterviewSession.findOne({ _id: id, userId: req.user._id });

    if (!session) {
      return res.status(404).json({ message: 'Interview session not found' });
    }

    const { transcript, currentQuestion, currentDifficulty, sessionSeconds } = req.body;

    if (Array.isArray(transcript)) {
      session.transcript = transcript;
    }
    if (typeof currentQuestion === 'string') {
      session.currentQuestion = currentQuestion;
    }
    if (currentDifficulty) {
      session.currentDifficulty = currentDifficulty;
    }
    if (typeof sessionSeconds === 'number') {
      session.sessionSeconds = sessionSeconds;
    }

    await session.save();
    res.json({ ok: true, session });
  } catch (error) {
    next(error);
  }
};

exports.completeSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    let session = await InterviewSession.findOne({ _id: id, userId: req.user._id });

    const {
      overallScore,
      categoryScores,
      verdict,
      strengths,
      weaknesses,
      suggestions,
      pacingFeedback,
      transcript,
      sessionSeconds,
      role,
      experienceLevel,
    } = req.body;

    const safeScore = Math.min(100, Math.max(0, Math.round(Number(overallScore) || 70)));

    if (!session) {
      // If no session existed before, create completed session
      session = new InterviewSession({
        userId: req.user._id,
        role: role || 'Software Engineer',
        experienceLevel: experienceLevel || 'mid',
      });
    }

    session.status = 'completed';
    session.overallScore = safeScore;
    session.categoryScores = categoryScores || {};
    session.verdict = verdict || '';
    session.strengths = Array.isArray(strengths) ? strengths : [];
    session.weaknesses = Array.isArray(weaknesses) ? weaknesses : [];
    session.suggestions = Array.isArray(suggestions) ? suggestions : [];
    session.pacingFeedback = pacingFeedback || '';
    if (Array.isArray(transcript)) {
      session.transcript = transcript;
    }
    if (typeof sessionSeconds === 'number') {
      session.sessionSeconds = sessionSeconds;
    }

    await session.save();

    // Create activity record for Dashboard and readiness scores
    await Activity.create({
      userId: req.user._id,
      type: 'interview',
      title: `${session.role} · Technical Interview`,
      score: safeScore,
    });

    res.json({ ok: true, session });
  } catch (error) {
    next(error);
  }
};

exports.getSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await InterviewSession.findOne({ _id: id, userId: req.user._id });

    if (!session) {
      return res.status(404).json({ message: 'Interview session not found' });
    }

    res.json(session);
  } catch (error) {
    next(error);
  }
};

exports.abandonSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await InterviewSession.findOneAndDelete({ _id: id, userId: req.user._id });

    if (!session) {
      return res.status(404).json({ message: 'Interview session not found' });
    }

    res.json({ ok: true, message: 'Interview session removed' });
  } catch (error) {
    next(error);
  }
};
