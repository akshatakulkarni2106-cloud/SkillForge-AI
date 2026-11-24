const { z } = require('zod');
const editable = z.object({
  name: z.string().min(1),
  college: z.string().optional().or(z.literal('')),
  degree: z.string().optional().or(z.literal('')),
  branch: z.string().optional().or(z.literal('')),
  year: z.coerce.number().min(1).max(10).optional().nullable(),
  targetRole: z.string().optional().or(z.literal('')),
  githubUsername: z.string().optional().or(z.literal('')),
  photoUrl: z.string().optional().or(z.literal('')),
}).partial();

exports.getProfile = (req, res) => res.json(req.user.toSafe());

exports.updateProfile = async (req, res, next) => {
  try {
    const validated = editable.parse(req.body);
    Object.assign(req.user, validated);
    await req.user.save();
    res.json(req.user.toSafe());
  } catch (e) {
    next(e);
  }
};

