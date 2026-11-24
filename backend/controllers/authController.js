const bcrypt = require('bcryptjs'); const jwt = require('jsonwebtoken'); const { z } = require('zod');
const User = require('../models/User');
const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name (at least 2 characters).'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  college: z.string().optional().default(''),
  branch: z.string().optional().default(''),
  year: z.coerce.number().min(1).max(5).optional().default(3),
  targetRole: z.string().optional().default('Full Stack Developer'),
});
exports.register = async (req, res, next) => {
  try {
    const { password, ...data } = registerSchema.parse(req.body);
    const existing = await User.findOne({ email: data.email });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists. Please log in instead.' });
    }
    const user = await User.create({ ...data, passwordHash: await bcrypt.hash(password, 12) });
    res.status(201).json({ token: sign(user), user: user.toSafe() });
  } catch (e) { next(e); }
};
exports.login = async (req, res, next) => {
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ message: 'Incorrect email or password.' });
    res.json({ token: sign(user), user: user.toSafe() });
  } catch (e) { next(e); }
};
