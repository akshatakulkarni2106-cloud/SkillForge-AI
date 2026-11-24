const mongoose = require('mongoose');

const transcriptItemSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, default: '' },
  responseTimeSeconds: { type: Number, default: 0 },
  verdict: { type: String, default: null },
  score: { type: Number, default: null },
  spokenFeedback: { type: String, default: '' },
  detailedFeedback: { type: String, default: '' },
  difficulty: { type: String, default: 'medium' },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const interviewSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, required: true, trim: true },
  experienceLevel: { type: String, default: 'mid' },
  status: { type: String, enum: ['in_progress', 'completed', 'abandoned'], default: 'in_progress', index: true },
  currentDifficulty: { type: String, default: 'medium' },
  timeLimitMinutes: { type: Number, default: 0 },
  sessionSeconds: { type: Number, default: 0 },
  currentQuestion: { type: String, default: '' },
  transcript: [transcriptItemSchema],
  overallScore: { type: Number, default: null },
  categoryScores: {
    technicalDepth: { type: Number, default: null },
    communication: { type: Number, default: null },
    problemSolving: { type: Number, default: null },
    practicalExperience: { type: Number, default: null }
  },
  verdict: { type: String, default: '' },
  strengths: [{ type: String }],
  weaknesses: [{ type: String }],
  suggestions: [{ type: String }],
  pacingFeedback: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);
