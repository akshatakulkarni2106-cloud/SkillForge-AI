const mongoose = require('mongoose');
module.exports = mongoose.model('Resume', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  fileName: String,
  extractedSkills: [String],
  extractedProjects: [String],
  education: [String],
  certifications: [String],
  extractedText: String,
  targetRole: String,
  critique: { type: Object, default: null },
}, { timestamps: true }));
