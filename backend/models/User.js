const mongoose = require('mongoose');
const skillSchema = new mongoose.Schema({
  name: { type: String, required: true }, score: { type: Number, min: 0, max: 100, default: 0 },
  verified: { type: Boolean, default: false }, lastAssessed: Date,
}, { _id: false });
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  college: String, degree: String, branch: String, year: Number,
  targetRole: { type: String, default: 'Full Stack Developer' },
  skills: [skillSchema], githubUsername: String, photoUrl: String,
}, { timestamps: true });
userSchema.methods.toSafe = function () { const o = this.toObject(); delete o.passwordHash; return o; };
module.exports = mongoose.model('User', userSchema);
