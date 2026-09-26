require('dotenv').config();
const bcrypt = require('bcryptjs'); const mongoose = require('mongoose');
const User = require('../models/User'); const Activity = require('../models/Activity');

async function seedDatabase() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/skillforge');
  await User.deleteMany({ email: { $in: ['demo@skillforge.ai', 'admin@skillforge.ai'] } });
  const d = new Date();
  const demo = await User.create({
    name: 'Demo Student',
    email: 'demo@skillforge.ai',
    passwordHash: await bcrypt.hash('Demo@1234', 12),
    college: 'Sample Institute of Technology',
    degree: 'B.Tech',
    branch: 'Computer Science',
    year: 3,
    targetRole: 'Full Stack Developer',
    githubUsername: 'demo-student',
    skills: [
      { name: 'JavaScript', score: 74, verified: true, lastAssessed: d },
      { name: 'React', score: 72, verified: true, lastAssessed: d },
      { name: 'Node.js', score: 42 },
      { name: 'MongoDB', score: 68, verified: true, lastAssessed: d },
      { name: 'Python', score: 70, verified: true, lastAssessed: d },
      { name: 'SQL', score: 61 },
      { name: 'Docker', score: 25 },
    ],
  });
  await User.create({ name: 'Admin', email: 'admin@skillforge.ai', role: 'admin', passwordHash: await bcrypt.hash('Admin@1234', 12) });
  await Activity.deleteMany({ userId: demo._id });
  await Activity.insertMany([
    { userId: demo._id, type: 'assessment', title: 'JavaScript · Intermediate', score: 74 },
    { userId: demo._id, type: 'interview', title: 'Full Stack Developer · Technical', score: 78 },
    { userId: demo._id, type: 'project', title: 'Hospital Management System', score: 72 },
    { userId: demo._id, type: 'topic', title: 'Completed: REST API basics' },
  ]);
  console.log('Seeded. Login: demo@skillforge.ai / Demo@1234');
}

if (require.main === module) {
  seedDatabase().then(() => process.exit(0)).catch((error) => {
    console.error('Seeding failed:', error.message);
    process.exit(1);
  });
}

module.exports = { seedDatabase };
