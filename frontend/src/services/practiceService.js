import { callGroqModel, extractJsonObject } from './interviewService.js';
import { normalizeDifficulty, parseDifficultyDirection } from '../utils/difficultyUtils.js';

const VALID_QUESTION_TYPES = ['mcq', 'short_answer', 'code', 'diagram'];
const VALID_DIAGRAM_TYPES = ['flowchart', 'sequence', 'er', 'class', 'none'];

const readStoredLanguagePreference = () => {
  if (typeof window === 'undefined') return '';

  const keys = ['preferredLanguage', 'primaryLanguage', 'programmingLanguage', 'languagePreference', 'preferred_language', 'userLanguage', 'language'];
  const sources = [window.localStorage, window.sessionStorage];

  for (const storage of sources) {
    if (!storage) continue;

    for (const key of keys) {
      const value = storage.getItem(key);
      if (value && value.trim()) {
        return value.trim();
      }
    }
  }

  try {
    const profile = JSON.parse(window.localStorage.getItem('sf_profile') || 'null');
    const profileLanguage = profile?.language || profile?.preferredLanguage || profile?.primaryLanguage || profile?.programmingLanguage;
    if (profileLanguage && String(profileLanguage).trim()) {
      return String(profileLanguage).trim();
    }
  } catch (error) {
    // Ignore storage parsing errors and fall back to inferred language.
  }

  return '';
};

const inferLanguageFromTopic = (topic, preferredLanguage = '') => {
  const explicitLanguage = String(preferredLanguage || '').trim().toLowerCase();
  const languageMap = {
    js: 'javascript', javascript: 'javascript', typescript: 'typescript', ts: 'typescript', python: 'python', py: 'python', sql: 'sql', postgresql: 'sql', mysql: 'sql', java: 'java', kotlin: 'kotlin', 'c#': 'c#', csharp: 'c#', go: 'go', rust: 'rust', ruby: 'ruby', bash: 'bash', shell: 'bash', php: 'php'
  };

  if (languageMap[explicitLanguage]) {
    return languageMap[explicitLanguage];
  }

  const normalizedTopic = String(topic || '').trim().toLowerCase();

  if (/(react|javascript|node|typescript|frontend|ui|dom)/.test(normalizedTopic)) return 'javascript';
  if (/(python|pandas|numpy|fastapi|django|flask|data science)/.test(normalizedTopic)) return 'python';
  if (/(sql|database|postgres|mysql|query|join|schema)/.test(normalizedTopic)) return 'sql';
  if (/(java|spring|kotlin|android)/.test(normalizedTopic)) return 'java';
  if (/(c#|dotnet|aspnet|unity)/.test(normalizedTopic)) return 'c#';
  if (/(go|goroutine|gin|microservice)/.test(normalizedTopic)) return 'go';
  if (/(rust|ownership|tokio)/.test(normalizedTopic)) return 'rust';

  return 'javascript';
};

const formatHistory = (history = []) => {
  if (!Array.isArray(history)) return 'No prior practice history.';

  return history
    .map((entry, index) => {
      const question = entry?.question || 'Untitled question';
      const answer = entry?.userAnswer || entry?.answer || 'No answer recorded';
      const result = typeof entry?.isCorrect === 'boolean' ? (entry.isCorrect ? 'Correct' : 'Incorrect') : 'Unscored';
      const difficulty = entry?.difficulty || 'medium';
      return `Question ${index + 1} [${difficulty}]: ${question}\nUser answer: ${answer}\nOutcome: ${result}`;
    })
    .join('\n\n');
};

const validateQuestionObject = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('The model returned an invalid question object.');
  }

  const questionType = String(payload.questionType || '').trim().toLowerCase();

  if (!VALID_QUESTION_TYPES.includes(questionType)) {
    throw new Error('The model returned an unsupported question type.');
  }

  const questionText = String(payload.question || '').trim();
  if (!questionText) {
    throw new Error('The model returned an empty question.');
  }

  const difficulty = normalizeDifficulty(payload.difficulty);
  const diagramType = String(payload.diagramType || 'none').trim().toLowerCase();
  const diagramText = typeof payload.diagram === 'string' ? payload.diagram.trim() : null;
  const diagram = diagramText && diagramText.length > 0 ? diagramText : null;
  const normalizedDiagramType = VALID_DIAGRAM_TYPES.includes(diagramType) ? diagramType : 'none';

  if (questionType === 'mcq') {
    const options = Array.isArray(payload.options) ? payload.options.map((item) => String(item).trim()).filter(Boolean) : [];

    if (options.length !== 4) {
      throw new Error('MCQ questions must include exactly four options.');
    }

    return {
      questionType,
      question: questionText,
      difficulty,
      options,
      skill: String(payload.skill || '').trim() || 'general technical skill',
      diagram,
      diagramType: normalizedDiagramType,
    };
  }

  if (questionType === 'code') {
    const language = inferLanguageFromTopic(String(payload.skill || '').trim() || 'general software engineering', payload.language || readStoredLanguagePreference());
    const codeSnippet = typeof payload.codeSnippet === 'string' ? payload.codeSnippet.trim() : '';

    if (!codeSnippet) {
      throw new Error('Code questions must include a buggy code snippet.');
    }

    return {
      questionType,
      question: questionText,
      difficulty,
      skill: String(payload.skill || '').trim() || 'general technical skill',
      language,
      codeSnippet,
      diagram,
      diagramType: normalizedDiagramType,
    };
  }

  return {
    questionType,
    question: questionText,
    difficulty,
    skill: String(payload.skill || '').trim() || 'general technical skill',
    diagram,
    diagramType: normalizedDiagramType,
  };
};

export async function generateQuestion(topic, difficulty, history = []) {
  const safeTopic = String(topic || 'general software engineering').trim() || 'general software engineering';
  const safeDifficulty = normalizeDifficulty(difficulty);
  const reminderText = formatHistory(history);
  const preferredLanguage = readStoredLanguagePreference();
  const language = inferLanguageFromTopic(safeTopic, preferredLanguage);

  const reply = await callGroqModel([
    {
      role: 'system',
      content:
        'You are a senior technical coach. Generate one adaptive practice question at a time. Keep it relevant to the topic and match the requested difficulty. Decide the question type dynamically and use the most appropriate format for the skill: mcq, short_answer, code, or diagram. For diagram-rich problems, include a diagram field when the question naturally benefits from a visual explanation, such as a broken architecture, ER schema, flowchart, sequence diagram, or component tree. If the question is purely text-based, leave the diagram field null or omit it. Important: the diagram value must be a single-line Mermaid string using escaped newlines like "graph TD\\nA-->B", not raw multiline text. If you choose a code question, it must be a short debugging question with a deliberate bug, not a blank-slate coding challenge. Use a language that matches the topic or the user\'s saved preference, and vary between identify-the-bug and fix-and-explain prompts so it does not become repetitive. Also ensure the entire response is valid JSON only, with no markdown wrappers and no extra commentary.',
    },
    {
      role: 'user',
      content: `Skill/topic: ${safeTopic}\nDifficulty: ${safeDifficulty}\nPreferred language: ${language}\nSession history:\n${reminderText}\n\nReturn JSON in this exact shape:\n{ "questionType": "mcq" | "short_answer" | "code" | "diagram", "difficulty": "easy" | "medium" | "hard", "question": "...", "skill": "${safeTopic}", "language": "javascript" | "python" | "sql" | "java" | "c#" | "go" | "rust" | "typescript" | "bash", "codeSnippet": "The actual buggy code as an escaped multiline string for code questions", "diagram": "Mermaid syntax string using escaped newlines like \\n or null", "diagramType": "flowchart" | "sequence" | "er" | "class" | "none", "options": ["...", "...", "...", "..."] }\nRules:\n- Use a diagram only when the question genuinely benefits from a visual; do not force visuals into every question.\n- If the question is a diagram-based question, include a valid Mermaid diagram string in the diagram field and set diagramType to a realistic type such as flowchart, sequence, er, or class.\n- For diagram questions, the prompt should sometimes intentionally show a flawed design or architecture and ask the user to identify what is wrong.\n- The diagram field must be a single-line string; do not paste raw multiline Mermaid blocks. Replace line breaks with \\n escapes.\n- For mcq, include exactly four options, one of which is clearly correct.\n- For short_answer, keep the question focused and answerable in a few sentences.\n- For code, the codeSnippet must be a 5-15 line snippet with a real bug (logic error, off-by-one, wrong API usage, race condition, security issue, etc.). Do not ask the user to write code from scratch. Ask them to find the bug and explain why it happens, or ask for a fix and explanation. Vary between those styles so it does not feel repetitive.\n- For code questions, set the language field explicitly and choose a snippet in that language, matching the skill or user preference.\n- If the question type is not mcq, omit the options field entirely.\n- Respond with ONLY valid JSON, no markdown, no explanation outside the JSON.`,
    },
  ], {
    temperature: 0.8,
    maxTokens: 700,
  });

  const parsed = extractJsonObject(reply);
  return validateQuestionObject(parsed);
}

export async function evaluateAnswer(question, userAnswer, history = []) {
  if (!question || typeof question !== 'object') {
    throw new Error('A valid question is required for evaluation.');
  }

  const answerText = String(userAnswer ?? '').trim();
  if (!answerText) {
    throw new Error('Please provide an answer before submitting it.');
  }

  const historyText = formatHistory(history);
  const questionText = String(question.question || '').trim();
  const questionType = String(question.questionType || 'short_answer').trim().toLowerCase();
  const currentDifficulty = normalizeDifficulty(question.difficulty);

  const codeContext = questionType === 'code'
    ? `Language: ${question.language || 'unknown'}\nBuggy code snippet:\n${question.codeSnippet || ''}\n`
    : '';

  const reply = await callGroqModel([
    {
      role: 'system',
      content:
        'You are a strict technical evaluator. Grade the user answer using real accuracy and reasoning. For code questions, verify the actual root bug and ensure any fix addresses the real cause. Return only one valid JSON object with exactly these keys: isCorrect, explanation, and suggestedNextDifficulty. No markdown, no extra text, no code fences, no commentary.',
    },
    {
      role: 'user',
      content: `Question type: ${questionType}\nCurrent difficulty: ${currentDifficulty}\nQuestion: ${questionText}\n${codeContext}User answer: ${answerText}\n\nSession history:\n${historyText}\n\nReturn only this exact JSON format:\n{"isCorrect":true,"explanation":"short reason","suggestedNextDifficulty":"same"}\nRules:\n- Use boolean true or false for isCorrect.\n- explanation must be a short, useful reason in plain text.\n- suggestedNextDifficulty must be one of: easier, same, harder.\n- If the question involved a diagram, judge the diagram answer based on the actual diagram content.\n- If this is a code question, reject plausible but wrong bugs. A correct answer must identify the real root cause and a correct fix if one is proposed.\n- Output only valid JSON, with no markdown, no commentary, and no extra keys.`,
    },
  ], {
    temperature: 0.5,
    maxTokens: 450,
  });

  const parsed = extractJsonObject(reply);

  if (typeof parsed?.isCorrect !== 'boolean') {
    throw new Error('The evaluation response was missing a valid correctness flag.');
  }

  const explanation = String(parsed?.explanation || '').trim();
  const nextDifficulty = parseDifficultyDirection(parsed?.suggestedNextDifficulty);

  if (!explanation) {
    throw new Error('The evaluation response was missing an explanation.');
  }

  return {
    isCorrect: parsed.isCorrect,
    explanation,
    suggestedNextDifficulty: nextDifficulty,
  };
}

export async function generateSessionSummary(history = []) {
  const summaryText = formatHistory(history);

  const reply = await callGroqModel([
    {
      role: 'system',
      content:
        'You are a learning coach. Review the entire practice session and provide a concise mastery summary. Identify the strongest and weakest topic areas based on the user\'s actual answers. Recommend the next best topics or drills to practice. Respond with ONLY valid JSON, no markdown, no explanation outside the JSON.',
    },
    {
      role: 'user',
      content: `Practice session transcript:\n${summaryText}\n\nReturn JSON in this exact shape:\n{ "masteryScore": 0-100, "strongAreas": ["..."], "weakAreas": ["..."], "recommendations": ["..."] }\nRules:\n- masteryScore must be a number between 0 and 100.\n- strongAreas, weakAreas, and recommendations must be arrays of strings.\n- If a section is not clearly present, return an empty array.\n- Respond with ONLY valid JSON, no markdown, no explanation outside the JSON.`,
    },
  ], {
    temperature: 0.6,
    maxTokens: 600,
  });

  const parsed = extractJsonObject(reply);
  const masteryScore = Number(parsed?.masteryScore ?? parsed?.mastery_score ?? 0);

  const summary = {
    masteryScore: Number.isFinite(masteryScore) ? Math.min(100, Math.max(0, masteryScore)) : 0,
    strongAreas: Array.isArray(parsed?.strongAreas) ? parsed.strongAreas.filter(Boolean).map(String) : [],
    weakAreas: Array.isArray(parsed?.weakAreas) ? parsed.weakAreas.filter(Boolean).map(String) : [],
    recommendations: Array.isArray(parsed?.recommendations) ? parsed.recommendations.filter(Boolean).map(String) : [],
  };

  if (!Number.isFinite(masteryScore)) {
    throw new Error('The session summary response was missing a valid mastery score.');
  }

  return summary;
}
