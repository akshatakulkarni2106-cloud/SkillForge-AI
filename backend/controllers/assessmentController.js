const { z } = require('zod');
const { randomUUID } = require('crypto');
const AssessmentSession = require('../models/AssessmentSession');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { ALL_SKILLS } = require('../utils/skillDictionary');
const { LEVELS, getNextDifficulty, normalizeDifficulty } = require('../utils/adaptive');
const { generateQuestion, evaluate } = require('../services/aiClient');

const SKILLS = ALL_SKILLS;
const DEFAULT_SESSION_LENGTH = 10;
const AI_ERROR_MESSAGE = "Couldn't generate a question, try again";
const AI_SERVICE_UNREACHABLE_MESSAGE = 'AI service is not running or unreachable. Start the ai-service on port 8000 and try again.';
const AI_SERVICE_REJECTED_MESSAGE = 'AI service rejected the request. Check the OpenAI API key and quota, then retry.';

const normalizeQuestionText = (questionText = '') => String(questionText)
  .toLowerCase()
  .trim()
  .replace(/[\p{P}$+<>=^`{|}~]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const pick = (skill, difficulty, alreadyAsked = []) => {
  const normalizedAsked = new Set((Array.isArray(alreadyAsked) ? alreadyAsked : []).map((id) => String(id)));
  const candidate = (() => {
    const numericIds = (Array.isArray(alreadyAsked) ? alreadyAsked : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value));
    return numericIds.length ? Math.max(...numericIds) + 1 : 0;
  })();

  if (normalizedAsked.has(String(candidate))) {
    return candidate + 1;
  }

  return candidate;
};

const stringifyIdentifier = (id) => String(id);

const toFrontendQuestion = (question, index, total) => ({
  id: stringifyIdentifier(question._id),
  text: question.text,
  options: question.options,
  topic: question.topic,
  difficulty: question.difficulty,
  index,
  total,
});

const serializeResult = (session) => ({
  id: stringifyIdentifier(session._id),
  skill: session.skill,
  status: session.status,
  score: session.result?.scoreSummary?.score_percent ?? null,
  correct: session.questions.filter((q) => q.isCorrect === true).length,
  total: session.questions.length,
  weakTopics: session.result?.weakTopics || [],
  strongTopics: session.result?.strengths || [],
  improvementPlan: session.result?.improvementPlan || [],
  path: session.questions.map((q) => q.difficulty),
});

const ensureSessionOwner = (session, userId) => {
  const ownerId = session?.userId ? String(session.userId) : null;
  return ownerId === String(userId);
};

const buildPerformancePayload = (session) => ({
  recent_results: session.questions.filter((q) => q.userIndex !== null).slice(-8).map((q) => q.isCorrect),
});

const buildAiQuestionPayload = (session) => ({
  skill: session.skill,
  difficulty: normalizeDifficulty(session.currentDifficulty),
  already_asked: session.questions.map((q) => q.text),
  performance: buildPerformancePayload(session),
});

const isDuplicateQuestion = (text, existingQuestions) => {
  const normalizedText = normalizeQuestionText(text);
  return existingQuestions.some((q) => {
    const candidate = typeof q === 'string' ? q : (q?.text ?? '');
    return normalizeQuestionText(candidate) === normalizedText;
  });
};

async function generateUniqueAiQuestion(session, generateFn = generateQuestion) {
  const existingTexts = session.questions.map((q) => q.text);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const payload = buildAiQuestionPayload(session);
      const data = await generateFn(payload);
      const text = String(data.question || data.text || '').trim();
      const options = Array.isArray(data.options) ? data.options.map((item) => String(item).trim()) : [];
      const correctIndex = Number(data.correct_index ?? data.correctIndex ?? 0);
      const explanation = String(data.explanation || '').trim();
      const topic = String(data.topic || session.skill).trim();
      const difficulty = normalizeDifficulty(data.difficulty || session.currentDifficulty);

      if (!text || !options.length || options.length !== 4 || options.some((item) => !item)) {
        throw new Error('Question payload is invalid');
      }
      if (new Set(options.map((item) => item.toLowerCase())).size !== 4) {
        throw new Error('Question options must be unique');
      }
      if (correctIndex < 0 || correctIndex > 3) {
        throw new Error('Correct index is out of range');
      }
      if (isDuplicateQuestion(text, existingTexts)) {
        throw new Error('duplicate');
      }

      const savedQuestion = {
        _id: stringifyIdentifier(data.id || randomUUID()),
        text,
        options,
        correctIndex,
        explanation,
        topic,
        difficulty,
        userIndex: null,
        isCorrect: null,
        answeredAt: null,
      };

      session.questions.push(savedQuestion);
      return savedQuestion;
    } catch (error) {
      const message = String(error?.message || '');
      const isDuplicate = message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('already asked');
      const isInvalid = message.toLowerCase().includes('invalid') || message.toLowerCase().includes('correct index') || message.toLowerCase().includes('out of range');
      if (attempt === 3) {
        throw new Error(AI_ERROR_MESSAGE);
      }
      if (isDuplicate || isInvalid) {
        continue;
      }
      if (error && error.message === AI_ERROR_MESSAGE) {
        throw error;
      }
      if (attempt === 3) {
        throw new Error(AI_ERROR_MESSAGE);
      }
    }
  }

  throw new Error(AI_ERROR_MESSAGE);
}

async function finalizeSession(session) {
  session.status = 'complete';
  const answeredQuestions = session.questions.filter((q) => q.userIndex !== null);

  if (answeredQuestions.length) {
    try {
      const result = await evaluate({
        items: answeredQuestions.map((q) => ({
          question: q.text,
          options: q.options,
          correct_index: q.correctIndex,
          user_index: q.userIndex,
          topic: q.topic,
        })),
      });

      session.result = {
        scoreSummary: result?.score_summary || null,
        strengths: result?.strengths || [],
        weakTopics: result?.weak_topics || [],
        perWrongAnswer: result?.per_wrong_answer || [],
        improvementPlan: result?.improvement_plan || [],
      };
    } catch (error) {
      session.result = null;
    }
  }

  await session.save();
  return session;
}

exports.meta = (_, res) => res.json({ skills: SKILLS, levels: LEVELS });

exports.start = async (req, res, next) => {
  try {
    const rawBody = z.object({
      skill: z.string().min(1),
      difficulty: z.string().optional(),
      count: z.coerce.number().int().min(1).max(10).default(DEFAULT_SESSION_LENGTH),
    }).parse(req.body);

    if (!SKILLS.includes(rawBody.skill)) {
      return res.status(400).json({ message: 'Unsupported skill.' });
    }

    const difficulty = normalizeDifficulty(rawBody.difficulty || 'medium');
    const session = await AssessmentSession.create({
      userId: req.user._id,
      skill: rawBody.skill,
      status: 'active',
      currentDifficulty: difficulty,
      defaultLength: rawBody.count,
      questions: [],
    });

    const question = await exports.generateUniqueAiQuestion(session);
    await session.save();

    return res.status(201).json({
      id: stringifyIdentifier(session._id),
      question: toFrontendQuestion(question, 1, rawBody.count),
      index: 1,
      total: rawBody.count,
      difficulty: session.currentDifficulty,
    });
  } catch (error) {
    const message = error?.message || 'AI service error';
    if (error?.kind === 'service_unreachable') {
      return res.status(503).json({ message: AI_SERVICE_UNREACHABLE_MESSAGE, status: 'ai_service_unreachable' });
    }
    if (error?.kind === 'service_rejected' || /generate|AI service|OpenAI|configur|unavailable|try again/i.test(message)) {
      return res.status(502).json({ message: AI_SERVICE_REJECTED_MESSAGE, status: 'ai_service_rejected' });
    }
    next(error);
  }
};

exports.answer = async (req, res, next) => {
  try {
    const answerSchema = z.object({
      id: z.string(),
      choice: z.coerce.number().int().min(0).max(3).optional(),
      userIndex: z.coerce.number().int().min(0).max(3).optional(),
    });
    const payload = answerSchema.parse(req.body);
    const selectedIndex = payload.userIndex ?? payload.choice;

    const session = await AssessmentSession.findOne({ _id: payload.id, userId: req.user._id });
    if (!session) {
      return res.status(404).json({ message: 'Assessment session not found.' });
    }

    if (session.status === 'complete') {
      return res.status(409).json({ message: 'This assessment is already complete.' });
    }

    const pendingQuestion = [...session.questions].reverse().find((q) => q.userIndex === null);
    if (!pendingQuestion) {
      return res.status(400).json({ message: 'No pending question to answer.' });
    }

    const answeredIndex = Number(selectedIndex);
    pendingQuestion.userIndex = answeredIndex;
    pendingQuestion.isCorrect = answeredIndex === pendingQuestion.correctIndex;
    pendingQuestion.answeredAt = new Date();

    const answeredCount = session.questions.filter((q) => q.userIndex !== null).length;
    const recentResults = session.questions.filter((q) => q.userIndex !== null).slice(-2).map((q) => q.isCorrect);
    session.currentDifficulty = getNextDifficulty(session.currentDifficulty, recentResults);

    if (answeredCount >= session.defaultLength || session.questions.length >= session.defaultLength) {
      await finalizeSession(session);
      return res.json({
        done: true,
        correct: pendingQuestion.isCorrect,
        correctIndex: pendingQuestion.correctIndex,
        explanation: pendingQuestion.explanation,
        result: serializeResult(session),
      });
    }

    const nextQuestion = await exports.generateUniqueAiQuestion(session);
    await session.save();

    return res.json({
      done: false,
      correct: pendingQuestion.isCorrect,
      correctIndex: pendingQuestion.correctIndex,
      explanation: pendingQuestion.explanation,
      question: toFrontendQuestion(nextQuestion, answeredCount + 1, session.defaultLength),
      index: answeredCount + 1,
      total: session.defaultLength,
      nextDifficulty: session.currentDifficulty,
    });
  } catch (error) {
    const message = error?.message || 'AI service error';
    if (error?.kind === 'service_unreachable') {
      return res.status(503).json({ message: AI_SERVICE_UNREACHABLE_MESSAGE, status: 'ai_service_unreachable' });
    }
    if (error?.kind === 'service_rejected' || /generate|AI service|OpenAI|configur|unavailable|try again/i.test(message)) {
      return res.status(502).json({ message: AI_SERVICE_REJECTED_MESSAGE, status: 'ai_service_rejected' });
    }
    next(error);
  }
};

exports.evaluateRetry = async (req, res, next) => {
  try {
    const session = await AssessmentSession.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) {
      return res.status(404).json({ message: 'Assessment session not found.' });
    }

    const result = await finalizeSession(session);
    return res.json({
      status: result.status,
      result: serializeResult(result),
    });
  } catch (error) {
    next(error);
  }
};

exports.getSession = async (req, res, next) => {
  try {
    const session = await AssessmentSession.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ message: 'Assessment session not found.' });
    const answered = session.questions.filter((q) => q.userIndex !== null);
    const currentQuestion = session.questions.find((q) => q.userIndex === null);
    return res.json({
      id: stringifyIdentifier(session._id),
      skill: session.skill,
      status: session.status,
      currentDifficulty: session.currentDifficulty,
      total: session.defaultLength,
      answered: answered.length,
      currentQuestion: currentQuestion ? toFrontendQuestion(currentQuestion, answered.length + 1, session.defaultLength) : null,
      result: session.result ? serializeResult(session) : null,
    });
  } catch (error) {
    next(error);
  }
};

exports.result = async (req, res, next) => {
  try {
    const session = await AssessmentSession.findOne({ _id: req.params.id, userId: req.user._id, status: 'complete' });
    if (!session) return res.status(404).json({ message: 'Result not found.' });
    return res.json(serializeResult(session));
  } catch (error) { next(error); }
};

exports.saveCompletedAssessment = async (req, res, next) => {
  try {
    const rawBody = z.object({
      skill: z.string().min(1),
      score: z.coerce.number().min(0).max(100),
      correctCount: z.coerce.number().optional(),
      totalCount: z.coerce.number().optional(),
      weakTopics: z.array(z.string()).optional(),
      strongTopics: z.array(z.string()).optional(),
    }).parse(req.body);

    const safeScore = Math.max(0, Math.min(100, Math.round(rawBody.score)));
    const user = req.user;
    const existing = user.skills.find((s) => s.name.toLowerCase() === rawBody.skill.toLowerCase());

    let finalScore = safeScore;
    if (existing) {
      finalScore = existing.score > 0 ? Math.round((existing.score + safeScore) / 2) : safeScore;
      existing.score = finalScore;
      existing.verified = true;
      existing.lastAssessed = new Date();
    } else {
      user.skills.push({
        name: rawBody.skill,
        score: safeScore,
        verified: true,
        lastAssessed: new Date(),
      });
    }

    await user.save();

    await Activity.create({
      userId: user._id,
      type: 'assessment',
      title: `${rawBody.skill} Assessment`,
      score: finalScore,
    });

    return res.json({
      success: true,
      skill: rawBody.skill,
      score: finalScore,
      user: user.toSafe(),
    });
  } catch (error) {
    next(error);
  }
};

exports.generateUniqueAiQuestion = generateUniqueAiQuestion;
exports.normalizeQuestionText = normalizeQuestionText;
exports.ensureSessionOwner = ensureSessionOwner;
exports.serializeResult = serializeResult;
exports.toFrontendQuestion = toFrontendQuestion;
exports.pick = pick;
exports.LEVELS = LEVELS;

