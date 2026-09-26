const mongoose = require('mongoose');
// One row per completed action; later stages write here so the dashboard stays a single query.
module.exports = mongoose.model('Activity', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  type: { type: String, enum: ['assessment', 'interview', 'project', 'topic'], required: true },
  title: String, score: Number,
}, { timestamps: true }));
