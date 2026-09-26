const { z } = require('zod');
const editable = z.object({
  name: z.string().min(2), college: z.string(), degree: z.string(), branch: z.string(), year: z.coerce.number().min(1).max(5),
  targetRole: z.string(), githubUsername: z.string(), photoUrl: z.string().url(),
}).partial();
exports.getProfile = (req, res) => res.json(req.user.toSafe());
exports.updateProfile = async (req, res, next) => {
  try { Object.assign(req.user, editable.parse(req.body)); await req.user.save(); res.json(req.user.toSafe()); }
  catch (e) { next(e); }
};
