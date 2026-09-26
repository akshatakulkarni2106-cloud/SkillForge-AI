const multer = require('multer'); const mammoth = require('mammoth'); const pdf = require('pdf-parse/lib/pdf-parse.js');
const Resume = require('../models/Resume'); const { extractSkills } = require('../utils/skillDictionary');
const OK = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
exports.upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, f, cb) => (OK.includes(f.mimetype) ? cb(null, true) : cb(new Error('Upload a PDF or DOCX file.'))) }).single('resume');

// Heading-based section grabber: lines after `head` until the next known heading.
const HEADS = /^(projects?|education|experience|work experience|certifications?|skills|achievements|summary|internships?)\b/i;
const section = (lines, re) => { const i = lines.findIndex((l) => re.test(l) && l.length < 40); if (i < 0) return [];
  const out = []; for (const l of lines.slice(i + 1)) { if (HEADS.test(l) && l.length < 40) break; if (l.length > 3) out.push(l.replace(/^[-•*·\d.)\s]+/, '').slice(0, 140)); } return out.slice(0, 8); };

exports.analyze = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a PDF or DOCX resume to upload.' });
    const text = req.file.mimetype === 'application/pdf' ? (await pdf(req.file.buffer)).text : (await mammoth.extractRawText({ buffer: req.file.buffer })).value;
    if (text.trim().length < 50) return res.status(422).json({ message: 'We could not read text from this file. Try a text-based PDF or DOCX.' });
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const skills = extractSkills(text);
    const doc = await Resume.create({
      userId: req.user._id,
      fileName: req.file.originalname,
      extractedSkills: skills,
      extractedProjects: section(lines, /^projects?/i),
      education: section(lines, /^education/i),
      certifications: section(lines, /^certifications?/i),
      extractedText: text,
    });
    // New skills join the profile unverified at 0% until assessed; existing scores are untouched.
    const have = new Set(req.user.skills.map((s) => s.name));
    skills.filter((s) => !have.has(s)).forEach((name) => req.user.skills.push({ name, score: 0 }));
    await req.user.save();
    res.status(201).json(doc);
  } catch (e) { next(e); }
};
exports.latest = async (req, res, next) => {
  try {
    res.json(await Resume.findOne({ userId: req.user._id }).sort({ createdAt: -1 }));
  } catch (e) { next(e); }
};
exports.saveCritique = async (req, res, next) => {
  try {
    const { critique, targetRole } = req.body;
    const latest = await Resume.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
    if (!latest) return res.status(404).json({ message: 'No resume found.' });
    if (critique) latest.critique = critique;
    if (targetRole) latest.targetRole = targetRole;
    await latest.save();
    res.json(latest);
  } catch (e) { next(e); }
};
