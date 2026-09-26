import { normalizeDifficulty, parseDifficultyDirection, experienceLevelToDifficulty } from '../utils/difficultyUtils.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

export const extractJsonObject = (rawText) => {
  if (rawText === null || rawText === undefined) {
    throw new Error('The model returned an empty response.');
  }

  if (typeof rawText === 'object' && !Array.isArray(rawText)) {
    return rawText;
  }

  const flattenCandidate = (candidate) => {
    if (!candidate || typeof candidate !== 'string') {
      return candidate;
    }

    return candidate
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```(?:json)?\s*/gi, '')
      .replace(/```/g, '')
      .replace(/\r/g, '\n')
      .trim();
  };

  const sanitizeCandidate = (candidate) => {
    let normalized = flattenCandidate(candidate);

    if (!normalized) return normalized;

    normalized = normalized
      .replace(/([{,]\s*)([A-Za-z0-9_]+)(\s*:)/g, '$1"$2"$3')
      .replace(/([\[{,]\s*)([A-Za-z0-9_]+)(\s*:)/g, '$1"$2"$3')
      .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ': "$1"')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null')
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/(\"(?:\\.|[^"\\])*\")|('(?:\\.|[^'\\])*')/g, (match) => match.replace(/[\r\n]+/g, '\\n'));

    return normalized;
  };

  const getBalancedJsonCandidates = (text) => {
    const trimmed = flattenCandidate(text);
    if (!trimmed) return [];

    const candidates = new Set();

    for (let index = 0; index < trimmed.length; index += 1) {
      if (trimmed[index] !== '{') continue;

      let depth = 0;
      let quote = null;
      let escaped = false;

      for (let cursor = index; cursor < trimmed.length; cursor += 1) {
        const char = trimmed[cursor];

        if (quote) {
          if (escaped) {
            escaped = false;
            continue;
          }

          if (char === '\\') {
            escaped = true;
            continue;
          }

          if (char === quote) {
            quote = null;
          }
          continue;
        }

        if (char === '"' || char === "'") {
          quote = char;
          continue;
        }

        if (char === '{') {
          depth += 1;
          continue;
        }

        if (char === '}') {
          depth -= 1;
          if (depth === 0) {
            const candidate = trimmed.slice(index, cursor + 1);
            if (candidate.trim()) {
              candidates.add(candidate);
            }
            break;
          }
        }
      }
    }

    const firstOpening = trimmed.indexOf('{');
    const lastClosing = trimmed.lastIndexOf('}');
    if (firstOpening >= 0 && lastClosing > firstOpening) {
      candidates.add(trimmed.slice(firstOpening, lastClosing + 1));
    }

    const objectMatch = trimmed.match(/\{[\s\S]*?\}/);
    if (objectMatch) {
      candidates.add(objectMatch[0]);
    }

    candidates.add(trimmed);

    return Array.from(candidates).filter(Boolean);
  };

  const parseAttempts = Array.from(new Set(getBalancedJsonCandidates(rawText)))
    .sort((a, b) => b.length - a.length);

  for (const candidate of parseAttempts) {
    try {
      return JSON.parse(sanitizeCandidate(candidate));
    } catch (error) {
      // Keep probing the next balanced candidate before failing.
    }
  }

  throw new Error('The model response was not valid JSON.');
};

export const getGroqApiKey = () => {
  const metaKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_GROQ_API_KEY : undefined;
  const procKey = typeof process !== 'undefined' && process.env ? process.env.VITE_GROQ_API_KEY : undefined;
  const key = metaKey || procKey;

  if (!key || !key.trim()) {
    throw new Error('Missing VITE_GROQ_API_KEY. Add your Groq key to the frontend .env file.');
  }

  return key.trim();
};

export const callGroqModel = async (messages, options = {}) => {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getGroqApiKey()}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.75,
      max_tokens: options.maxTokens ?? 1000,
    }),
  });

  if (!response.ok) {
    let message = 'The Groq request failed.';

    try {
      const errorBody = await response.json();
      message = errorBody?.error?.message || message;
    } catch (error) {
      // Ignore JSON parsing errors and preserve the default message.
    }

    throw new Error(message);
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message || {};
  const content = typeof message.content === 'string' && message.content.trim()
    ? message.content
    : typeof message.reasoning === 'string' && message.reasoning.trim()
      ? message.reasoning
      : '';

  if (!content) {
    throw new Error('The interview service returned no content.');
  }

  return content;
};

const normalizeTranscript = (transcript = []) =>
  Array.isArray(transcript)
    ? transcript.filter((entry) => entry && typeof entry?.question === 'string')
    : [];

/**
 * Start interview: Generates the first live, tailored question via Groq.
 */
export async function startInterview(role, experienceLevel, options = {}) {
  const roleLabel = String(role || 'Full Stack Developer').trim();
  const levelLabel = String(experienceLevel || 'mid').trim();
  const initialDifficulty = experienceLevelToDifficulty(levelLabel);

  const focusSkills = Array.isArray(options?.focusSkills) && options.focusSkills.length
    ? `\nFocus technology signals: ${options.focusSkills.join(', ')}`
    : '';

  const result = await callGroqModel([
    {
      role: 'system',
      content:
        'You are an elite principal engineering interviewer. Conduct a live, realistic technical interview. Ask ONE focused, thoughtful opening question that tests real architectural or coding competence for the given role and seniority. Avoid generic trivia like "what is a closure". Ask practical scenario, design, or implementation questions. Return valid JSON only with the schema: {"question": "...", "topic": "..."}.',
    },
    {
      role: 'user',
      content: `Target Role: ${roleLabel}\nSeniority: ${levelLabel} (Difficulty: ${initialDifficulty})${focusSkills}\n\nGenerate the first interview question. Return valid JSON only.`,
    },
  ], { temperature: 0.75, maxTokens: 400 });

  const parsed = extractJsonObject(result);

  if (typeof parsed?.question !== 'string' || !parsed.question.trim()) {
    throw new Error('The interview service did not return a valid first question.');
  }

  return {
    question: parsed.question.trim(),
    topic: parsed.topic || roleLabel,
    difficulty: initialDifficulty,
  };
}

/**
 * Evaluate a single answer immediately via Groq:
 * Returns strict feedback, spoken feedback (for avatar SpeechSynthesis), and adaptive difficulty suggestion.
 */
export async function evaluateQuestionAnswer({
  role,
  experienceLevel,
  currentDifficulty,
  question,
  answer,
  history = [],
  responseTimeSeconds = null,
}) {
  const roleLabel = String(role || 'Software Engineer').trim();
  const levelLabel = String(experienceLevel || 'mid').trim();
  const difficulty = normalizeDifficulty(currentDifficulty);
  const answerText = String(answer || '').trim();
  const questionText = String(question || '').trim();

  if (!answerText) {
    throw new Error('Candidate answer cannot be empty for evaluation.');
  }

  const timingNote = typeof responseTimeSeconds === 'number'
    ? `\nCandidate took ${responseTimeSeconds} seconds to answer.`
    : '';

  const result = await callGroqModel([
    {
      role: 'system',
      content:
        'You are a rigorous technical hiring committee interviewer. Evaluate the candidate\'s specific answer directly and truthfully. Never be vague or falsely encouraging. Assess technical accuracy, depth, architectural awareness, edge cases, and clarity.\n\nReturn JSON only in this exact shape:\n{\n  "verdict": "strong" | "satisfactory" | "needs_improvement",\n  "score": 0-100,\n  "spokenFeedback": "2 to 3 concise, punchy sentences to be spoken aloud by the interviewer avatar acknowledging their answer and highlighting key takeaway.",\n  "detailedFeedback": "In-depth, direct written evaluation explaining what was accurate, what was missing or incorrect, and a concrete suggestion for improvement.",\n  "suggestedNextDifficulty": "easier" | "same" | "harder"\n}\n\nRules:\n- spokenFeedback must sound natural when read aloud and be strictly 2-3 sentences.\n- suggestedNextDifficulty: if the answer is strong, recommend "harder"; if satisfactory, "same"; if weak or missing core concepts, "easier".\n- Output valid JSON only, no markdown wrappers, no extra commentary.',
    },
    {
      role: 'user',
      content: `Role: ${roleLabel} (${levelLabel})\nCurrent Difficulty: ${difficulty}\nQuestion: ${questionText}\nCandidate Answer: ${answerText}${timingNote}\n\nEvaluate this response now. Return JSON only.`,
    },
  ], { temperature: 0.5, maxTokens: 600 });

  const parsed = extractJsonObject(result);

  const verdict = ['strong', 'satisfactory', 'needs_improvement'].includes(parsed?.verdict)
    ? parsed.verdict
    : (parsed?.score >= 75 ? 'strong' : parsed?.score >= 50 ? 'satisfactory' : 'needs_improvement');

  const score = typeof parsed?.score === 'number'
    ? Math.min(100, Math.max(0, Math.round(parsed.score)))
    : (verdict === 'strong' ? 85 : verdict === 'satisfactory' ? 65 : 40);

  const spokenFeedback = String(parsed?.spokenFeedback || '').trim() ||
    (verdict === 'strong'
      ? 'Great technical depth and clarity in your response.'
      : verdict === 'satisfactory'
        ? 'Solid foundation, but consider elaborating more on the practical tradeoffs.'
        : 'That covers the high level, but missed several critical implementation details.');

  const detailedFeedback = String(parsed?.detailedFeedback || '').trim() || spokenFeedback;
  const suggestedNextDifficulty = parseDifficultyDirection(parsed?.suggestedNextDifficulty);

  return {
    verdict,
    score,
    spokenFeedback,
    detailedFeedback,
    suggestedNextDifficulty,
  };
}

/**
 * Generate next adaptive question using live Groq call:
 * Adapts to candidate's previous performance and response pacing.
 */
export async function getNextAdaptiveQuestion({
  role,
  experienceLevel,
  currentDifficulty,
  transcript = [],
  lastEvaluation = null,
}) {
  const roleLabel = String(role || 'Software Engineer').trim();
  const levelLabel = String(experienceLevel || 'mid').trim();
  const difficulty = normalizeDifficulty(currentDifficulty);
  const cleaned = normalizeTranscript(transcript);

  const historySummary = cleaned.map((entry, index) => {
    const timing = entry.responseTimeSeconds ? ` [answered in ${entry.responseTimeSeconds}s]` : '';
    const verdict = entry.verdict ? ` (${entry.verdict})` : '';
    return `Q${index + 1}: ${entry.question}\nA${index + 1}${timing}: ${entry.answer}${verdict}`;
  }).join('\n\n');

  const lastEvalContext = lastEvaluation
    ? `\nLast answer verdict: ${lastEvaluation.verdict} (score: ${lastEvaluation.score}). Next recommended difficulty: ${difficulty}.`
    : '';

  const result = await callGroqModel([
    {
      role: 'system',
      content:
        'You are an adaptive principal engineering interviewer. Based on the interview conversation so far and the candidate\'s demonstrated competence, generate the next logical interview question. If the candidate excelled, probe deeper into complex edge cases, distributed systems, or performance tradeoffs. If they struggled, pivot to evaluate practical core knowledge or practical debugging. Do not repeat previous questions. Respond with valid JSON only in the format: {"question": "...", "topic": "..."}.',
    },
    {
      role: 'user',
      content: `Role: ${roleLabel} (${levelLabel})\nCurrent Difficulty Level: ${difficulty}${lastEvalContext}\n\nInterview Transcript so far:\n${historySummary}\n\nGenerate the next interview question now. Return valid JSON only.`,
    },
  ], { temperature: 0.75, maxTokens: 400 });

  const parsed = extractJsonObject(result);

  if (typeof parsed?.question !== 'string' || !parsed.question.trim()) {
    throw new Error('The interview service did not return a valid follow-up question.');
  }

  return {
    question: parsed.question.trim(),
    topic: parsed.topic || roleLabel,
    difficulty,
  };
}

/**
 * Legacy getNextQuestion wrapper for compatibility.
 */
export async function getNextQuestion(transcript) {
  return getNextAdaptiveQuestion({ transcript });
}

/**
 * Final interview evaluation:
 * Sends the FULL transcript with per-question response times to Groq.
 * The model computes a reasoned score out of 100 based on whole-session quality (no fixed formula).
 */
export async function evaluateInterviewSession({
  role,
  experienceLevel,
  transcript = [],
  totalDurationSeconds = 0,
}) {
  const roleLabel = String(role || 'Software Engineer').trim();
  const levelLabel = String(experienceLevel || 'mid').trim();
  const cleaned = normalizeTranscript(transcript);

  if (!cleaned.length) {
    throw new Error('A transcript is required to evaluate the interview session.');
  }

  const sessionTranscriptText = cleaned.map((entry, index) => {
    const timing = typeof entry.responseTimeSeconds === 'number'
      ? ` [Response time: ${entry.responseTimeSeconds}s]`
      : '';
    const score = typeof entry.score === 'number' ? ` [Score: ${entry.score}/100]` : '';
    const evalSummary = entry.detailedFeedback ? `\nPer-question notes: ${entry.detailedFeedback}` : '';
    return `### Question ${index + 1}: ${entry.question}\n**Candidate Answer**${timing}${score}:\n${entry.answer || '(No answer provided)'}${evalSummary}`;
  }).join('\n\n');

  const durationMinutes = Math.round(totalDurationSeconds / 60);

  const result = await callGroqModel([
    {
      role: 'system',
      content:
        `You are a Chief Technology Officer and Hiring Committee Chair conducting an executive-level candidate debrief. You have received the full interview transcript with per-question response timing and individual evaluations.\n\nEvaluate the session comprehensively. Compute an overallScore out of 100 based strictly on your holistic reasoning about the candidate's actual answer quality, technical depth, problem-solving, real-world experience, and communication clarity. DO NOT use an arbitrary client-side formula like "correct answers / total * 100". Weigh the nuance, complexity of questions answered, and technical maturity.\n\nReturn JSON only with this schema:\n{\n  "overallScore": 0-100,\n  "verdict": "2 to 3 sentence definitive executive summary of candidate readiness for the role.",\n  "categoryScores": {\n    "technicalDepth": 0-100,\n    "communication": 0-100,\n    "problemSolving": 0-100,\n    "practicalExperience": 0-100\n  },\n  "strengths": ["3 to 5 specific, concrete strengths observed in the answers"],\n  "weaknesses": ["2 to 4 concrete gaps or areas needing improvement"],\n  "suggestions": ["3 to 5 actionable recommendations for candidate growth"],\n  "pacingFeedback": "Assessment of candidate pacing and response timing based on recorded seconds per answer.",\n  "perQuestionFeedback": [\n    {"question": "...", "score": 0-100, "feedback": "brief takeaway"}\n  ]\n}\n\nRules:\n- overallScore must be a single integer between 0 and 100 derived from your qualitative reasoning.\n- Every field must be realistic, substantive, and directly derived from the transcript.\n- Output valid JSON only, no prose outside JSON.`,
    },
    {
      role: 'user',
      content: `Target Role: ${roleLabel}\nSeniority Level: ${levelLabel}\nTotal Session Duration: ${durationMinutes} minutes (${totalDurationSeconds}s)\nTotal Questions Answered: ${cleaned.length}\n\nFull Interview Transcript:\n\n${sessionTranscriptText}\n\nDeliver the final evaluation now. Return valid JSON only.`,
    },
  ], { temperature: 0.6, maxTokens: 1400 });

  const parsed = extractJsonObject(result);

  const overallScoreValue = Number(parsed?.overallScore ?? parsed?.overall_score ?? 0);
  const overallScore = Number.isFinite(overallScoreValue)
    ? Math.min(100, Math.max(0, Math.round(overallScoreValue)))
    : 70;

  const rawCats = parsed?.categoryScores || parsed?.categories || {};
  const categoryScores = {
    technicalDepth: Number(rawCats?.technicalDepth ?? rawCats?.technical_depth ?? overallScore),
    communication: Number(rawCats?.communication ?? overallScore),
    problemSolving: Number(rawCats?.problemSolving ?? rawCats?.problem_solving ?? overallScore),
    practicalExperience: Number(rawCats?.practicalExperience ?? rawCats?.practical_experience ?? overallScore),
  };

  return {
    overallScore,
    verdict: String(parsed?.verdict || '').trim() || `Candidate demonstrated solid foundational knowledge for the ${roleLabel} position.`,
    categoryScores,
    strengths: Array.isArray(parsed?.strengths) && parsed.strengths.length
      ? parsed.strengths.filter(Boolean)
      : ['Clear communication during technical explanations'],
    weaknesses: Array.isArray(parsed?.weaknesses) && parsed.weaknesses.length
      ? parsed.weaknesses.filter(Boolean)
      : ['Could elaborate more on architectural tradeoffs'],
    suggestions: Array.isArray(parsed?.suggestions) && parsed.suggestions.length
      ? parsed.suggestions.filter(Boolean)
      : ['Practice explaining distributed systems tradeoffs in detail'],
    pacingFeedback: String(parsed?.pacingFeedback || '').trim() ||
      (totalDurationSeconds > 0 ? `Completed ${cleaned.length} questions in ${durationMinutes} minutes with steady pacing.` : ''),
    perQuestionFeedback: Array.isArray(parsed?.perQuestionFeedback)
      ? parsed.perQuestionFeedback.filter((item) => item && typeof item.question === 'string')
      : [],
  };
}

/**
 * Legacy evaluateInterview wrapper for backward compatibility.
 */
export async function evaluateInterview(transcript) {
  return evaluateInterviewSession({ transcript });
}
