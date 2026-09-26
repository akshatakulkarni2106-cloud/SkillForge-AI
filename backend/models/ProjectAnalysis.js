const mongoose = require('mongoose');

const projectAnalysisSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    title: { type: String, required: true },
    githubUrl: { type: String, default: '' },
    healthScore: { type: Number, min: 0, max: 100, required: true },
    complexityLevel: { type: String, default: 'Substantial' },
    isTutorialClone: { type: Boolean, default: false },
    detectedStack: [String],
    stackCategorized: { type: Object, default: {} },
    impressiveAspects: [String],
    portfolioGaps: [String],
    resumeBullets: [String],
    actionableRoadmap: [String],
    summary: String,
    rawEvidence: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProjectAnalysis', projectAnalysisSchema);
