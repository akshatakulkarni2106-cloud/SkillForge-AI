const mongoose = require('mongoose');
module.exports = mongoose.model('Assessment', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, skill: String, difficulty: String, count: Number,
  asked: [{ qid: Number, level: String, topic: String, choice: Number, correct: Boolean, _id: false }],
  currentQid: Number, currentLevel: String, done: { type: Boolean, default: false },
  score: Number, weakTopics: [String], strongTopics: [String],
}, { timestamps: true }));
