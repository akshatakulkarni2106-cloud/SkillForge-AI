const { z } = require('zod');
const ProjectAnalysis = require('../models/ProjectAnalysis');
const Activity = require('../models/Activity');
const User = require('../models/User');

const analysisSchema = z.object({
  title: z.string().min(1),
  githubUrl: z.string().optional().default(''),
  healthScore: z.coerce.number().min(0).max(100),
  complexityLevel: z.string().optional().default('Substantial'),
  isTutorialClone: z.boolean().optional().default(false),
  detectedStack: z.array(z.string()).optional().default([]),
  stackCategorized: z.record(z.any()).optional().default({}),
  impressiveAspects: z.array(z.string()).optional().default([]),
  portfolioGaps: z.array(z.string()).optional().default([]),
  resumeBullets: z.array(z.string()).optional().default([]),
  actionableRoadmap: z.array(z.string()).optional().default([]),
  summary: z.string().optional().default(''),
  rawEvidence: z.string().optional().default(''),
});

exports.saveAnalysis = async (req, res, next) => {
  try {
    const data = analysisSchema.parse(req.body);
    const userId = req.user._id;

    const analysis = await ProjectAnalysis.create({
      userId,
      ...data,
    });

    // 1. Log Activity so dashboardController.summary picks up project health score
    await Activity.create({
      userId,
      type: 'project',
      title: data.title,
      score: data.healthScore,
    });

    // 2. Feed detected stack into req.user.skills to offset gaps if project is strong
    if (data.detectedStack && data.detectedStack.length > 0) {
      const user = await User.findById(userId);
      if (user) {
        let skillsChanged = false;
        const projectScoreFactor = Math.round(data.healthScore * 0.85); // project evidence contributes real baseline score

        for (const skillName of data.detectedStack) {
          const trimmed = String(skillName).trim();
          if (!trimmed) continue;
          const existing = user.skills.find(
            (s) => s.name.toLowerCase() === trimmed.toLowerCase()
          );

          if (existing) {
            // If existing skill was 0% (unverified from resume) or lower, bolster it with project proof
            if (existing.score < projectScoreFactor) {
              existing.score = Math.round((existing.score + projectScoreFactor) / 2);
              existing.lastAssessed = new Date();
              skillsChanged = true;
            }
          } else {
            user.skills.push({
              name: trimmed,
              score: Math.min(80, Math.max(45, projectScoreFactor)),
              verified: data.healthScore >= 75,
              lastAssessed: new Date(),
            });
            skillsChanged = true;
          }
        }

        if (skillsChanged) {
          await user.save();
        }
      }
    }

    res.status(201).json(analysis);
  } catch (error) {
    next(error);
  }
};

exports.getLatest = async (req, res, next) => {
  try {
    const latest = await ProjectAnalysis.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(latest || null);
  } catch (error) {
    next(error);
  }
};

exports.list = async (req, res, next) => {
  try {
    const list = await ProjectAnalysis.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(10);
    res.json(list);
  } catch (error) {
    next(error);
  }
};
