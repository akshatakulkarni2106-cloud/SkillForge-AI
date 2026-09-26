const test = require('node:test');
const assert = require('node:assert/strict');
const { pick, generateUniqueAiQuestion, normalizeQuestionText, toFrontendQuestion, ensureSessionOwner } = require('../controllers/assessmentController');
const { shouldUseInMemoryFallback } = require('../config/db');
const { getNextDifficulty } = require('../utils/adaptive');
const { generateQuestion } = require('../services/aiClient');

test('pick does not reuse already asked questions when ids are mixed numbers and strings', () => {
  const next = pick('JavaScript', 'beginner', [0, '1']);
  assert.equal(next, 2);
});

test('AI question generation avoids duplicates', async () => {
  const session = {
    skill: 'JavaScript',
    currentDifficulty: 'medium',
    questions: [{ text: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correctIndex: 1, explanation: 'Because 2 + 2 is 4.', topic: 'JavaScript', difficulty: 'easy', userIndex: null, isCorrect: null, answeredAt: null }],
  };
  let calls = 0;
  const fakeGenerate = async () => {
    calls += 1;
    const payloadMap = [
      { question: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correct_index: 1, explanation: 'Because 2 + 2 is 4.', topic: 'JavaScript', difficulty: 'easy' },
      { question: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correct_index: 1, explanation: 'Because 2 + 2 is 4.', topic: 'JavaScript', difficulty: 'easy' },
      { question: 'What is 2 + 3?', options: ['4', '5', '6', '7'], correct_index: 1, explanation: 'Because 2 + 3 is 5.', topic: 'JavaScript', difficulty: 'easy' },
    ];
    return payloadMap[Math.min(calls - 1, payloadMap.length - 1)];
  };

  const next = await generateUniqueAiQuestion(session, fakeGenerate);
  assert.equal(next.text, 'What is 2 + 3?');
  assert.ok(session.questions.some((q) => q.text === 'What is 2 + 3?'));
  assert.equal(calls, 3);
});

test('difficulty adapts based on recent answers', () => {
  assert.equal(getNextDifficulty('medium', [true, true]), 'hard');
  assert.equal(getNextDifficulty('medium', [false, false]), 'easy');
  assert.equal(getNextDifficulty('easy', [true, true]), 'medium');
  assert.equal(getNextDifficulty('hard', [false, false]), 'medium');
  assert.equal(getNextDifficulty('hard', [true, false]), 'hard');
});

test('frontend payload hides correct answer before user responds', () => {
  const q = {
    _id: 'q-1',
    text: 'What is 2 + 2?',
    options: ['3', '4', '5', '6'],
    correctIndex: 1,
    explanation: 'Because 2 + 2 equals 4.',
    topic: 'Math',
    difficulty: 'easy',
  };

  const payload = toFrontendQuestion(q, 1, 10);
  assert.equal(payload.text, 'What is 2 + 2?');
  assert.equal(payload.options.length, 4);
  assert.equal(payload.correctIndex, undefined);
  assert.equal(payload.explanation, undefined);
});

test('user ownership check prevents cross-account access', () => {
  const session = { userId: 'user-1' };
  assert.equal(ensureSessionOwner(session, 'user-1'), true);
  assert.equal(ensureSessionOwner(session, 'user-2'), false);
});

test('question normalization strips punctuation and whitespace', () => {
  assert.equal(normalizeQuestionText('  What is JavaScript?  '), 'what is javascript');
  assert.equal(normalizeQuestionText('What is JavaScript!!!?'), 'what is javascript');
});

test('memory fallback is only used for local development without a real MONGO_URI', () => {
  assert.equal(shouldUseInMemoryFallback({ MONGO_URI: '', NODE_ENV: 'development' }), true);
  assert.equal(shouldUseInMemoryFallback({ MONGO_URI: 'mongodb://127.0.0.1:27017/skillforge', NODE_ENV: 'development' }), false);
  assert.equal(shouldUseInMemoryFallback({ MONGO_URI: '', NODE_ENV: 'production' }), false);
});

test('AI service errors distinguish unreachable services from rejected requests', async () => {
  const originalFetch = global.fetch;

  global.fetch = async () => {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:8000');
    error.cause = { code: 'ECONNREFUSED' };
    throw error;
  };
  await assert.rejects(() => generateQuestion({ skill: 'JavaScript', difficulty: 'easy', already_asked: [], performance: {} }), (error) => {
    assert.equal(error.kind, 'service_unreachable');
    assert.match(error.message, /AI service is not running|unreachable/i);
    return true;
  });

  global.fetch = async () => ({
    ok: false,
    status: 502,
    async text() { return JSON.stringify({ detail: 'OpenAI rejected the request' }); },
  });
  await assert.rejects(() => generateQuestion({ skill: 'JavaScript', difficulty: 'easy', already_asked: [], performance: {} }), (error) => {
    assert.equal(error.kind, 'service_rejected');
    assert.match(error.message, /rejected the request|quota|key/i);
    return true;
  });

  global.fetch = originalFetch;
});

test('assessment start returns a controlled 503 when the AI service is unavailable', async () => {
  const AssessmentSession = require('../models/AssessmentSession');
  const originalCreate = AssessmentSession.create;
  const originalGenerate = require('../controllers/assessmentController').generateUniqueAiQuestion;

  AssessmentSession.create = async () => ({
    _id: 'session-1',
    userId: 'user-1',
    skill: 'JavaScript',
    status: 'active',
    currentDifficulty: 'medium',
    defaultLength: 2,
    questions: [],
    save: async () => undefined,
  });

  const controller = require('../controllers/assessmentController');
  controller.generateUniqueAiQuestion = async () => {
    const error = new Error("Couldn't generate a question, try again");
    error.kind = 'service_unreachable';
    throw error;
  };

  const req = { body: { skill: 'JavaScript', difficulty: 'medium', count: 2 }, user: { _id: 'user-1' } };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  let nextCalled = false;
  await controller.start(req, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 503);
  assert.equal(nextCalled, false);
  assert.match(res.payload.message, /AI service is not running|unreachable/i);

  AssessmentSession.create = originalCreate;
  controller.generateUniqueAiQuestion = originalGenerate;
});
