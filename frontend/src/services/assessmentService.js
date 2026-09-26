import { callGroqModel, extractJsonObject } from './interviewService.js';
import {
  normalizeDifficulty,
  parseDifficultyDirection,
  moveDifficulty,
  getDifficultyMultiplier,
  computeXpForAnswer,
} from '../utils/difficultyUtils.js';

export const ASSESSMENT_HISTORY_KEY = 'sf_assessment_history';
export const USER_REWARDS_KEY = 'sf_user_rewards';
export const PRACTICE_HISTORY_KEY = 'sf_practice_history';

export const VALID_QUESTION_TYPES = ['mcq', 'short_answer', 'code', 'scenario'];

export const BADGES_CATALOG = [
  {
    id: 'sharp_shooter',
    name: 'Sharp Shooter',
    icon: '🎯',
    description: 'Achieved 80%+ overall accuracy in an assessment session (min 3 questions).',
    triggerHint: '80%+ score on 3+ questions',
  },
  {
    id: 'deep_thinker',
    name: 'Deep Thinker',
    icon: '💡',
    description: 'Demonstrated exceptional reasoning with 80%+ scores on 2 or more written or scenario questions.',
    triggerHint: '80%+ on 2+ written/scenario answers',
  },
  {
    id: 'code_sleuth',
    name: 'Code Sleuth',
    icon: '⚡',
    description: 'Diagnosed and resolved a technical code challenge at Medium or Hard difficulty.',
    triggerHint: '75%+ on a Medium/Hard code question',
  },
  {
    id: 'comeback_kid',
    name: 'Comeback Kid',
    icon: '🔄',
    description: 'Turned the assessment around by scoring a streak of 2+ after an early missed question.',
    triggerHint: 'Recover from early miss with 2+ streak',
  },
  {
    id: 'high_climber',
    name: 'High Climber',
    icon: '🚀',
    description: 'Successfully conquered a Hard-difficulty question with a score of 75% or higher.',
    triggerHint: '75%+ on a Hard question',
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    icon: '👑',
    description: 'Achieved mastery level with an overall score of 90%+ across 4 or more questions.',
    triggerHint: '90%+ overall score (min 4 questions)',
  },
  {
    id: 'tenacious',
    name: 'Tenacious',
    icon: '🛡️',
    description: 'Pushed through and completed all rigorous assessment questions without abandoning the session.',
    triggerHint: 'Complete full assessment',
  },
];

export const readStoredLanguagePreference = () => {
  if (typeof window === 'undefined') return '';
  const keys = ['preferredLanguage', 'primaryLanguage', 'programmingLanguage', 'languagePreference', 'userLanguage', 'language'];
  const sources = [window.localStorage, window.sessionStorage];

  for (const storage of sources) {
    if (!storage) continue;
    for (const key of keys) {
      const value = storage.getItem(key);
      if (value && value.trim()) return value.trim();
    }
  }

  try {
    const profile = JSON.parse(window.localStorage.getItem('sf_profile') || 'null');
    const lang = profile?.language || profile?.preferredLanguage || profile?.primaryLanguage;
    if (lang && String(lang).trim()) return String(lang).trim();
  } catch {
    // Ignore parse errors
  }
  return '';
};

export const inferLanguageFromTopic = (topic = '', preferredLanguage = '') => {
  const explicit = String(preferredLanguage || '').trim().toLowerCase();
  const map = {
    js: 'javascript', javascript: 'javascript', typescript: 'typescript', ts: 'typescript',
    python: 'python', py: 'python', sql: 'sql', postgresql: 'sql', mysql: 'sql',
    java: 'java', kotlin: 'kotlin', 'c#': 'c#', csharp: 'c#', go: 'go', rust: 'rust',
    ruby: 'ruby', bash: 'bash', shell: 'bash', php: 'php', 'c++': 'cpp', cpp: 'cpp'
  };
  if (map[explicit]) return map[explicit];

  const t = String(topic || '').trim().toLowerCase();
  if (/(react|javascript|node|typescript|frontend|ui|dom|web)/.test(t)) return 'javascript';
  if (/(python|pandas|numpy|fastapi|django|flask|data science|ml|ai)/.test(t)) return 'python';
  if (/(sql|database|postgres|mysql|query|schema)/.test(t)) return 'sql';
  if (/(java|spring|android)/.test(t)) return 'java';
  if (/(c#|dotnet|aspnet)/.test(t)) return 'c#';
  if (/(go|goroutine|gin)/.test(t)) return 'go';
  if (/(rust|ownership)/.test(t)) return 'rust';
  if (/(c\+\+|cpp)/.test(t)) return 'cpp';
  return 'javascript';
};

export const readUserRewards = () => {
  if (typeof window === 'undefined') {
    return { totalXp: 0, currentStreak: 0, maxStreak: 0, unlockedBadges: [] };
  }
  try {
    const raw = window.localStorage.getItem(USER_REWARDS_KEY);
    if (!raw) {
      return { totalXp: 0, currentStreak: 0, maxStreak: 0, unlockedBadges: [] };
    }
    const data = JSON.parse(raw);
    return {
      totalXp: Number(data.totalXp) || 0,
      currentStreak: Number(data.currentStreak) || 0,
      maxStreak: Number(data.maxStreak) || 0,
      unlockedBadges: Array.isArray(data.unlockedBadges) ? data.unlockedBadges : [],
    };
  } catch {
    return { totalXp: 0, currentStreak: 0, maxStreak: 0, unlockedBadges: [] };
  }
};

export const saveUserRewards = (rewards) => {
  if (typeof window === 'undefined' || !rewards) return;
  try {
    window.localStorage.setItem(USER_REWARDS_KEY, JSON.stringify(rewards));
  } catch (err) {
    console.error('Failed to save user rewards:', err);
  }
};

export const readAssessmentHistory = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ASSESSMENT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveAssessmentSession = (sessionRecord) => {
  if (typeof window === 'undefined' || !sessionRecord) return;
  try {
    const history = readAssessmentHistory();
    const updated = [sessionRecord, ...history].slice(0, 50);
    window.localStorage.setItem(ASSESSMENT_HISTORY_KEY, JSON.stringify(updated));

    // Also push answered questions into sf_practice_history so Roadmap and Practice sync
    if (Array.isArray(sessionRecord.questions)) {
      const existingPractice = JSON.parse(window.localStorage.getItem(PRACTICE_HISTORY_KEY) || '[]');
      const newItems = sessionRecord.questions.map((q) => ({
        question: q.question,
        skill: sessionRecord.skill || q.topic || 'General',
        difficulty: q.difficulty || 'medium',
        isCorrect: Boolean(q.isCorrect),
        explanation: q.evaluation?.explanation || '',
        suggestedNextDifficulty: q.evaluation?.suggestedNextDifficulty || 'same',
        timestamp: Date.now(),
      }));
      window.localStorage.setItem(PRACTICE_HISTORY_KEY, JSON.stringify([...existingPractice, ...newItems].slice(-100)));
    }
  } catch (err) {
    console.error('Failed to save assessment session:', err);
  }
};

export const evaluateSessionBadges = (sessionData, currentUnlockedBadgeIds = new Set()) => {
  const { questions = [], overallScore = 0, maxStreak = 0, isComplete = false } = sessionData;
  const newlyUnlocked = [];
  const existingIds = new Set(currentUnlockedBadgeIds);

  const totalQuestions = questions.length;
  const correctCount = questions.filter((q) => q.isCorrect).length;
  const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

  // 1. Sharp Shooter: 80%+ accuracy with min 3 questions
  if (!existingIds.has('sharp_shooter') && totalQuestions >= 3 && accuracy >= 80) {
    newlyUnlocked.push(BADGES_CATALOG.find((b) => b.id === 'sharp_shooter'));
  }

  // 2. Deep Thinker: 80%+ on 2+ written/scenario questions
  const deepQuestions = questions.filter(
    (q) => (q.questionType === 'short_answer' || q.questionType === 'scenario') && (q.score >= 80)
  );
  if (!existingIds.has('deep_thinker') && deepQuestions.length >= 2) {
    newlyUnlocked.push(BADGES_CATALOG.find((b) => b.id === 'deep_thinker'));
  }

  // 3. Code Sleuth: Solved code question at medium/hard with 75%+ score
  const codeQuestions = questions.filter(
    (q) => q.questionType === 'code' && (q.difficulty === 'medium' || q.difficulty === 'hard') && (q.score >= 75)
  );
  if (!existingIds.has('code_sleuth') && codeQuestions.length >= 1) {
    newlyUnlocked.push(BADGES_CATALOG.find((b) => b.id === 'code_sleuth'));
  }

  // 4. Comeback Kid: Early miss (Q1 or Q2 is incorrect) followed by a streak of 2+
  const earlyMiss = questions.slice(0, 2).some((q) => !q.isCorrect);
  if (!existingIds.has('comeback_kid') && earlyMiss && maxStreak >= 2) {
    newlyUnlocked.push(BADGES_CATALOG.find((b) => b.id === 'comeback_kid'));
  }

  // 5. High Climber: Solved a Hard question with 75%+
  const hardQuestionSolved = questions.some(
    (q) => normalizeDifficulty(q.difficulty) === 'hard' && q.score >= 75
  );
  if (!existingIds.has('high_climber') && hardQuestionSolved) {
    newlyUnlocked.push(BADGES_CATALOG.find((b) => b.id === 'high_climber'));
  }

  // 6. Perfectionist: 90%+ overall across >= 4 questions
  if (!existingIds.has('perfectionist') && totalQuestions >= 4 && overallScore >= 90) {
    newlyUnlocked.push(BADGES_CATALOG.find((b) => b.id === 'perfectionist'));
  }

  // 7. Tenacious: Completed full session
  if (!existingIds.has('tenacious') && isComplete && totalQuestions >= 3) {
    newlyUnlocked.push(BADGES_CATALOG.find((b) => b.id === 'tenacious'));
  }

  return newlyUnlocked.filter(Boolean);
};

const formatAssessmentHistory = (history = []) => {
  if (!Array.isArray(history) || history.length === 0) return 'No prior questions in this session.';
  return history
    .map((item, idx) => {
      const type = item.questionType || 'unknown';
      const diff = item.difficulty || 'medium';
      const q = item.question || 'No question text';
      const ans = item.userAnswer || 'No answer recorded';
      const score = item.score !== undefined ? `${item.score}%` : (item.isCorrect ? 'Correct' : 'Incorrect');
      return `Q${idx + 1} [${type.toUpperCase()}, ${diff}]: "${q}"\nUser Answer: "${ans}"\nResult: ${score}`;
    })
    .join('\n\n');
};

const validateGeneratedQuestion = (raw, skill) => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid question response format from AI.');
  }

  const rawType = String(raw.questionType || '').trim().toLowerCase();
  const questionType = VALID_QUESTION_TYPES.includes(rawType) ? rawType : 'short_answer';
  const questionText = String(raw.question || '').trim();

  if (!questionText) {
    throw new Error('AI returned a question with empty text.');
  }

  const difficulty = normalizeDifficulty(raw.difficulty);
  const topic = String(raw.topic || skill || 'General').trim();

  if (questionType === 'mcq') {
    const options = Array.isArray(raw.options) ? raw.options.map((o) => String(o).trim()).filter(Boolean) : [];
    if (options.length !== 4) {
      throw new Error('MCQ questions must contain exactly 4 unique options.');
    }
    const correctIndex = Number(raw.correctIndex ?? raw.correct_index ?? 0);
    const safeCorrectIndex = Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex <= 3 ? correctIndex : 0;
    return {
      questionType: 'mcq',
      question: questionText,
      options,
      correctIndex: safeCorrectIndex,
      difficulty,
      topic,
      skill,
    };
  }

  if (questionType === 'code') {
    const language = String(raw.language || inferLanguageFromTopic(skill, readStoredLanguagePreference())).trim().toLowerCase();
    const codeSnippet = typeof raw.codeSnippet === 'string' ? raw.codeSnippet.trim() : (typeof raw.snippet === 'string' ? raw.snippet.trim() : '');
    if (!codeSnippet) {
      throw new Error('Code questions must include a relevant code snippet.');
    }
    return {
      questionType: 'code',
      question: questionText,
      codeSnippet,
      language,
      difficulty,
      topic,
      skill,
    };
  }

  if (questionType === 'scenario') {
    const scenarioContext = typeof raw.scenarioContext === 'string' ? raw.scenarioContext.trim() : '';
    return {
      questionType: 'scenario',
      question: questionText,
      scenarioContext,
      difficulty,
      topic,
      skill,
    };
  }

  return {
    questionType: 'short_answer',
    question: questionText,
    difficulty,
    topic,
    skill,
  };
};

export async function generateAssessmentQuestion({
  skill,
  difficulty = 'medium',
  questionNumber = 1,
  totalQuestions = 5,
  history = [],
}) {
  const safeSkill = String(skill || 'Software Engineering').trim();
  const safeDifficulty = normalizeDifficulty(difficulty);
  const historyText = formatAssessmentHistory(history);
  const preferredLang = readStoredLanguagePreference();
  const targetLanguage = inferLanguageFromTopic(safeSkill, preferredLang);

  // Analyze previous question types to enforce healthy variety
  const previousTypes = history.map((h) => h.questionType);
  const mcqCount = previousTypes.filter((t) => t === 'mcq').length;
  const nonMcqCount = previousTypes.length - mcqCount;

  let varietyGuidance = '';
  if (previousTypes.length >= 1 && mcqCount >= 1 && nonMcqCount === 0) {
    varietyGuidance = 'IMPORTANT: You previously generated an MCQ. For this question, choose short_answer, code, or scenario to maintain a balanced, mixed-format assessment.';
  } else if (previousTypes.length >= 2 && !previousTypes.includes('code') && /(javascript|python|sql|java|react|c#|go|rust|backend|frontend)/i.test(safeSkill)) {
    varietyGuidance = 'If appropriate for this technical skill, consider a code debugging question.';
  }

  const prompt = [
    {
      role: 'system',
      content:
        `You are the Chief Assessment Officer at SkillForge AI, conducting an adaptive, high-rigor skill assessment.
Your objective is to generate ONE targeted question at a time.
CRITICAL FORMAT RULES:
1. You must dynamically select the most effective question format for the topic:
   - "mcq": Exactly 4 options testing recall/discrimination of fundamental concepts.
   - "short_answer": Clear prompt testing conceptual depth, trade-offs, and verbal reasoning (1-3 paragraphs answer).
   - "code": A 5-15 line snippet with a subtle bug, logical flaw, or edge case. Ask the candidate to identify the root bug and explain the fix. Specify the programming language explicitly.
   - "scenario": A real-world situational dilemma ("What would you do if...", production incident, design conflict, resource constraint) testing applied judgment.
2. VARY FORMATS RIGOROUSLY across the assessment session. Never generate an all-MCQ assessment. Mix MCQ, short_answer, code, and scenario meaningfully.
3. Keep the difficulty matched to the requested level: "${safeDifficulty}".
4. Respond ONLY with a single valid JSON object. No markdown wrappers, no code fences, no commentary outside the JSON.`,
    },
    {
      role: 'user',
      content:
        `Skill being assessed: ${safeSkill}
Target difficulty for this question: ${safeDifficulty}
Question index: Question ${questionNumber} of ${totalQuestions}
Programming language context (if code question): ${targetLanguage}
${varietyGuidance}

Session history so far:
${historyText}

Return a single JSON object in this exact shape:
{
  "questionType": "mcq" | "short_answer" | "code" | "scenario",
  "difficulty": "${safeDifficulty}",
  "topic": "Core sub-topic name (e.g. Memory Leak, Concurrency, Virtual DOM, SQL Indexing)",
  "question": "The question text. Be precise and realistic.",
  "options": ["Option A", "Option B", "Option C", "Option D"], // ONLY include if questionType is "mcq"
  "correctIndex": 0, // 0, 1, 2, or 3. ONLY include if questionType is "mcq"
  "codeSnippet": "5-15 line code snippet with a real bug. ONLY include if questionType is 'code'",
  "language": "${targetLanguage}", // ONLY include if questionType is 'code'
  "scenarioContext": "Situational context or constraints. Optional, for scenario questions"
}`,
    },
  ];

  const reply = await callGroqModel(prompt, {
    temperature: 0.75,
    maxTokens: 850,
  });

  const parsed = extractJsonObject(reply);
  return validateGeneratedQuestion(parsed, safeSkill);
}

export async function evaluateAssessmentAnswer({
  question,
  userAnswer,
  history = [],
  currentStreak = 0,
}) {
  if (!question || typeof question !== 'object') {
    throw new Error('A valid question object is required for evaluation.');
  }

  const rawAnswer = String(userAnswer ?? '').trim();
  if (!rawAnswer) {
    throw new Error('Please enter your answer before submitting.');
  }

  const questionType = String(question.questionType || 'short_answer').toLowerCase();
  const currentDifficulty = normalizeDifficulty(question.difficulty);
  const historyText = formatAssessmentHistory(history);

  // For MCQ, we can do direct instant checking but also let Groq provide pedagogical feedback
  let mcqPrecheck = null;
  if (questionType === 'mcq') {
    const correctIdx = Number(question.correctIndex ?? 0);
    const correctOptionText = Array.isArray(question.options) ? question.options[correctIdx] : '';
    const isExactMatch = rawAnswer === correctOptionText || rawAnswer === String(correctIdx);
    mcqPrecheck = {
      isCorrect: isExactMatch,
      score: isExactMatch ? 100 : 0,
      correctOptionText,
    };
  }

  const codeSnippetText = questionType === 'code' && question.codeSnippet
    ? `Code Snippet [${question.language || 'code'}]:\n${question.codeSnippet}\n`
    : '';

  const scenarioText = questionType === 'scenario' && question.scenarioContext
    ? `Scenario Context:\n${question.scenarioContext}\n`
    : '';

  const prompt = [
    {
      role: 'system',
      content:
        `You are an expert technical assessor at SkillForge AI. You grade candidate answers with genuine intellectual rigor and zero bias.
GRADING STANDARDS:
- NO KEYWORD MATCHING. Evaluate actual conceptual comprehension, reasoning validity, and technical correctness.
- Score from 0 to 100:
  * 90-100 (Exceptional): Flawless or near-flawless reasoning, addresses root causes, mentions critical nuances.
  * 70-89 (Good): Correct core understanding, minor omissions or slight imprecisions.
  * 40-69 (Partial): Some valid elements, but misses key mechanics, flawed fix, or vague explanation.
  * 0-39 (Poor/Incorrect): Fundamental misconception, incorrect diagnosis, or completely wrong.
- For Code questions: verify if candidate correctly pinpointed the root cause of the bug and proposed a sound fix.
- For Scenario questions: verify if candidate demonstrated pragmatic decision-making, handled trade-offs, and adhered to engineering best practices.
- For MCQ: if selected option is correct, score=100 and isCorrect=true; otherwise score=0 and isCorrect=false.
- suggestedNextDifficulty must be "easier", "same", or "harder" based on performance.
- Provide a helpful, constructive explanation that teaches the candidate the optimal answer.
Respond ONLY with valid JSON. No markdown wrappers, no commentary outside JSON.`,
    },
    {
      role: 'user',
      content:
        `Question Type: ${questionType.toUpperCase()}
Skill: ${question.skill || 'Technical Skill'}
Difficulty: ${currentDifficulty}
Question: ${question.question}
${scenarioText}${codeSnippetText}
Candidate's Submitted Answer:
"${rawAnswer}"

${mcqPrecheck ? `Note for MCQ: The correct option was "${mcqPrecheck.correctOptionText}". Candidate answered "${rawAnswer}". Correct: ${mcqPrecheck.isCorrect}.` : ''}

Session history:
${historyText}

Return valid JSON in this exact shape:
{
  "score": ${mcqPrecheck ? mcqPrecheck.score : '0 to 100'},
  "isCorrect": ${mcqPrecheck ? mcqPrecheck.isCorrect : 'true if score >= 70, false otherwise'},
  "quality": "exceptional" | "good" | "partial" | "poor",
  "explanation": "Clear, detailed breakdown of why the answer scored what it did and key technical insights.",
  "idealAnswer": "Concise statement of the optimal answer or fix.",
  "suggestedNextDifficulty": "easier" | "same" | "harder"
}`,
    },
  ];

  const reply = await callGroqModel(prompt, {
    temperature: 0.35,
    maxTokens: 550,
  });

  const parsed = extractJsonObject(reply);
  let score = Number(parsed.score);
  if (!Number.isFinite(score)) {
    score = parsed.isCorrect ? 100 : 0;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  const isCorrect = typeof parsed.isCorrect === 'boolean' ? parsed.isCorrect : score >= 70;
  const quality = ['exceptional', 'good', 'partial', 'poor'].includes(parsed.quality)
    ? parsed.quality
    : score >= 90 ? 'exceptional' : score >= 70 ? 'good' : score >= 40 ? 'partial' : 'poor';

  const explanation = String(parsed.explanation || '').trim() || (isCorrect ? 'Correct answer.' : 'Incorrect response.');
  const idealAnswer = String(parsed.idealAnswer || '').trim();
  const suggestedNextDifficulty = parseDifficultyDirection(parsed.suggestedNextDifficulty);

  // Calculate genuine XP based on score, difficulty, and running streak
  const xpAwarded = computeXpForAnswer(score, currentDifficulty, isCorrect ? currentStreak + 1 : 0);

  return {
    score,
    isCorrect,
    quality,
    explanation,
    idealAnswer,
    suggestedNextDifficulty,
    xpAwarded,
  };
}

export async function generateAssessmentReport({ skill, questions = [], overallScore = 0 }) {
  const historyText = formatAssessmentHistory(questions);

  const prompt = [
    {
      role: 'system',
      content:
        `You are a Senior Technical Talent Assessor. Generate a rigorous, constructive assessment report for a candidate who just completed an adaptive skill assessment.
Respond ONLY with a single JSON object. No markdown wrappers, no commentary outside JSON.`,
    },
    {
      role: 'user',
      content:
        `Skill Assessed: ${skill}
Calculated Weighted Score: ${overallScore}%
Questions & Answers Transcript:
${historyText}

Return valid JSON in this exact structure:
{
  "overallSummary": "2-3 sentence executive assessment of candidate's technical level and demonstrated capabilities in this skill.",
  "strengths": ["Specific strong concept 1", "Specific strong concept 2"],
  "weaknesses": ["Specific weak concept 1", "Specific weak concept 2"],
  "improvementSuggestions": [
    "Concrete actionable recommendation 1",
    "Concrete actionable recommendation 2",
    "Concrete actionable recommendation 3"
  ],
  "formatBreakdown": {
    "mcq": { "summary": "brief note on conceptual recall" },
    "written": { "summary": "brief note on explanation & reasoning" },
    "code": { "summary": "brief note on debugging & syntax understanding" },
    "scenario": { "summary": "brief note on practical judgment" }
  }
}`,
    },
  ];

  try {
    const reply = await callGroqModel(prompt, {
      temperature: 0.5,
      maxTokens: 750,
    });
    const parsed = extractJsonObject(reply);
    return {
      overallSummary: String(parsed.overallSummary || `Assessment completed with ${overallScore}% score.`).trim(),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter(Boolean) : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter(Boolean) : [],
      improvementSuggestions: Array.isArray(parsed.improvementSuggestions) ? parsed.improvementSuggestions.filter(Boolean) : [],
      formatBreakdown: parsed.formatBreakdown || {},
    };
  } catch (error) {
    // If report generation model call encounters an issue, generate from session questions data
    const strong = questions.filter((q) => q.isCorrect).map((q) => q.topic);
    const weak = questions.filter((q) => !q.isCorrect).map((q) => q.topic);
    return {
      overallSummary: `Assessment completed for ${skill} with an overall score of ${overallScore}%.`,
      strengths: [...new Set(strong)].slice(0, 3),
      weaknesses: [...new Set(weak)].slice(0, 3),
      improvementSuggestions: [
        `Focus targeted drills on ${weak[0] || 'advanced core mechanics'}.`,
        `Practice writing clear root-cause explanations for technical bugs.`,
        `Review best practices and trade-offs for production systems in ${skill}.`,
      ],
      formatBreakdown: {},
    };
  }
}
