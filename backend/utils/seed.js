require('dotenv').config();
const bcrypt = require('bcryptjs'); const mongoose = require('mongoose');
const User = require('../models/User');
const Activity = require('../models/Activity');
const InterviewSession = require('../models/InterviewSession');
const AssessmentSession = require('../models/AssessmentSession');

async function seedDatabase() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/skillforge');
  await User.deleteMany({ email: { $in: ['demo@skillforge.ai', 'admin@skillforge.ai'] } });
  const d = new Date();
  const demo = await User.create({
    name: 'Demo Student',
    email: 'demo@skillforge.ai',
    passwordHash: await bcrypt.hash('Demo@1234', 12),
    college: 'Sample Institute of Technology',
    degree: 'B.Tech',
    branch: 'Computer Science',
    year: 3,
    targetRole: 'Full Stack Developer',
    githubUsername: 'demo-student',
    skills: [
      { name: 'JavaScript', score: 74, verified: true, lastAssessed: d },
      { name: 'React', score: 72, verified: true, lastAssessed: d },
      { name: 'Node.js', score: 42 },
      { name: 'MongoDB', score: 68, verified: true, lastAssessed: d },
      { name: 'Python', score: 70, verified: true, lastAssessed: d },
      { name: 'SQL', score: 61 },
      { name: 'Docker', score: 25 },
    ],
  });
  await User.create({ name: 'Admin', email: 'admin@skillforge.ai', role: 'admin', passwordHash: await bcrypt.hash('Admin@1234', 12) });
  await Activity.deleteMany({ userId: demo._id });
  await Activity.insertMany([
    { userId: demo._id, type: 'assessment', title: 'JavaScript · Intermediate', score: 74 },
    { userId: demo._id, type: 'interview', title: 'Full Stack Developer · Technical', score: 78 },
    { userId: demo._id, type: 'project', title: 'Hospital Management System', score: 72 },
    { userId: demo._id, type: 'topic', title: 'Completed: REST API basics' },
  ]);

  // Clean and seed InterviewSessions
  await InterviewSession.deleteMany({ userId: demo._id });
  await InterviewSession.create([
    {
      userId: demo._id,
      role: 'Full Stack Developer',
      experienceLevel: 'mid',
      status: 'completed',
      overallScore: 78,
      currentDifficulty: 'medium',
      sessionSeconds: 920,
      timeLimitMinutes: 30,
      categoryScores: {
        technicalDepth: 80,
        communication: 82,
        problemSolving: 75,
        practicalExperience: 76,
      },
      verdict: 'Candidate demonstrated strong architectural competence and clear explanation of asynchronous flow.',
      strengths: ['Clear articulation of component state', 'Good understanding of MongoDB schema indexing'],
      weaknesses: ['Could elaborate more on caching layers (Redis)'],
      suggestions: ['Practice system design for distributed microservices'],
      transcript: [
        {
          question: 'How do you design a scalable JWT authentication flow with refresh tokens?',
          answer: 'We store access tokens in memory or short-lived cookies and refresh tokens in secure HttpOnly cookies, rotating them on each refresh call.',
          responseTimeSeconds: 42,
          score: 82,
          verdict: 'strong',
          spokenFeedback: 'Excellent architecture pattern separating storage mechanisms for security.',
          detailedFeedback: 'Covered token rotation and secure cookie flags accurately.',
          difficulty: 'medium',
        },
        {
          question: 'Explain how Node.js event loop handles I/O operations and microtasks.',
          answer: 'Node uses libuv with phases: timers, pending callbacks, poll, check (setImmediate), and close. Promise callbacks run in process.nextTick / microtask queue between each phase.',
          responseTimeSeconds: 55,
          score: 75,
          verdict: 'satisfactory',
          spokenFeedback: 'Solid understanding of libuv phases and microtask queue priorities.',
          detailedFeedback: 'Accurately described the event loop phases and microtask queue execution order.',
          difficulty: 'hard',
        },
      ],
    },
    {
      userId: demo._id,
      role: 'Frontend Developer',
      experienceLevel: 'mid',
      status: 'in_progress',
      currentDifficulty: 'medium',
      sessionSeconds: 380,
      timeLimitMinutes: 30,
      currentQuestion: 'How does React 18 Concurrent Mode improve user experience during heavy re-renders?',
      transcript: [
        {
          question: 'What are the main differences between useMemo and useCallback in React?',
          answer: 'useMemo caches the calculated result of a function call, while useCallback caches the function definition itself between renders.',
          responseTimeSeconds: 30,
          score: 85,
          verdict: 'strong',
          spokenFeedback: 'Precise and concise distinction between caching values vs function references.',
          detailedFeedback: 'Correctly identified when to apply each hook to prevent unnecessary child re-renders.',
          difficulty: 'medium',
        },
      ],
    },
  ]);

  // Clean and seed AssessmentSessions
  await AssessmentSession.deleteMany({ userId: demo._id });
  await AssessmentSession.create({
    userId: demo._id,
    skill: 'Node.js',
    status: 'active',
    currentDifficulty: 'medium',
    defaultLength: 10,
    questions: [
      {
        _id: 'seed-q1',
        text: 'Which core module in Node.js provides an asynchronous event-driven architecture?',
        options: ['events', 'http', 'stream', 'cluster'],
        correctIndex: 0,
        explanation: 'The events module provides the EventEmitter class.',
        topic: 'Architecture',
        difficulty: 'easy',
        userIndex: 0,
        isCorrect: true,
        answeredAt: new Date(),
      },
      {
        _id: 'seed-q2',
        text: 'What is the purpose of process.nextTick() in Node.js?',
        options: ['Schedule a callback before the next event loop phase', 'Run a timer', 'Create a worker thread', 'Exit process'],
        correctIndex: 0,
        explanation: 'process.nextTick schedules callbacks to be invoked at the end of the current operation.',
        topic: 'Event Loop',
        difficulty: 'medium',
        userIndex: 0,
        isCorrect: true,
        answeredAt: new Date(),
      },
      {
        _id: 'seed-q3',
        text: 'Which stream mode reads data only when requested?',
        options: ['Paused mode', 'Flowing mode', 'Sync mode', 'Buffering mode'],
        correctIndex: 0,
        explanation: 'Streams operate in paused mode by default until a data handler is attached.',
        topic: 'Streams',
        difficulty: 'medium',
        userIndex: null,
        isCorrect: null,
        answeredAt: null,
      },
    ],
  });

  console.log('Seeded database with demo user, completed interview, in-progress interview, and in-progress assessment.');
}

if (require.main === module) {
  seedDatabase().then(() => process.exit(0)).catch((error) => {
    console.error('Seeding failed:', error.message);
    process.exit(1);
  });
}

module.exports = { seedDatabase };

