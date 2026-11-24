const r = require('express').Router();
const { protect } = require('../middleware/auth');
const auth = require('../controllers/authController');
const user = require('../controllers/userController');
const dash = require('../controllers/dashboardController');
const resume = require('../controllers/resumeController');
const asmt = require('../controllers/assessmentController');
const gap = require('../controllers/skillGapController');
const project = require('../controllers/projectController');
const interview = require('../controllers/interviewController');

r.post('/auth/register', auth.register);
r.post('/auth/login', auth.login);
r.get('/user/profile', protect, user.getProfile);
r.put('/user/profile', protect, user.updateProfile);
r.get('/dashboard/summary', protect, dash.summary);
r.post('/resume/upload', protect, (q, s, n) => resume.upload(q, s, (e) => (e ? s.status(400).json({ message: e.message }) : n())), resume.analyze);
r.get('/resume/latest', protect, resume.latest);
r.put('/resume/critique', protect, resume.saveCritique);
r.get('/assessment/meta', protect, asmt.meta);
r.post('/assessment/start', protect, asmt.start);
r.post('/assessment/answer', protect, asmt.answer);
r.post('/assessment/complete', protect, asmt.saveCompletedAssessment);
r.get('/assessment/:id/result', protect, asmt.result);
r.get('/assessments/:id', protect, asmt.getSession);
r.post('/assessments/:id/evaluate', protect, asmt.evaluateRetry);
r.get('/interview/summary', protect, interview.getSummary);
r.post('/interview/start', protect, interview.startSession);
r.post('/interview/:id/progress', protect, interview.updateProgress);
r.post('/interview/:id/complete', protect, interview.completeSession);
r.get('/interview/:id', protect, interview.getSession);
r.delete('/interview/:id', protect, interview.abandonSession);
r.get('/skill-gap/analyze', protect, gap.analyze);
r.post('/project/save-analysis', protect, project.saveAnalysis);
r.get('/project/latest', protect, project.getLatest);
r.get('/project/list', protect, project.list);

module.exports = r;

