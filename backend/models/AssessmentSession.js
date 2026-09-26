const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  text: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctIndex: { type: Number, required: true, min: 0, max: 3 },
  explanation: { type: String, required: true },
  topic: { type: String, required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  userIndex: { type: Number, default: null, min: 0, max: 3 },
  isCorrect: { type: Boolean, default: null },
  answeredAt: { type: Date, default: null },
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  skill: { type: String, required: true, trim: true },
  status: { type: String, enum: ['active', 'complete'], default: 'active' },
  currentDifficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  defaultLength: { type: Number, default: 10 },
  questions: [questionSchema],
  result: {
    scoreSummary: { type: Object, default: null },
    strengths: { type: [String], default: [] },
    weakTopics: { type: [String], default: [] },
    perWrongAnswer: { type: [Object], default: [] },
    improvementPlan: { type: [String], default: [] },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('AssessmentSession', sessionSchema);
