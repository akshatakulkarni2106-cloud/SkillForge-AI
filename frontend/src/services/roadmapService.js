import { callGroqModel, extractJsonObject } from './interviewService.js';

export const ROADMAP_STORAGE_KEY = 'sf_roadmap';
export const ROADMAP_CHECKLIST_KEY = 'sf_roadmap_checklist';
export const ROADMAP_SELECTED_SKILLS_KEY = 'sf_roadmap_selected_skills';
export const PRACTICE_HISTORY_KEY = 'sf_practice_history';

const normalizeText = (value) => String(value ?? '').trim();

const stableHash = (value) => {
  const source = String(value ?? '');
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
};

const normalizeSkillName = (value) => normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const buildPracticeSnapshot = (practiceHistory = []) => {
  if (!Array.isArray(practiceHistory)) return [];

  return practiceHistory
    .map((entry) => ({
      question: normalizeText(entry?.question),
      skill: normalizeText(entry?.skill || 'general'),
      difficulty: normalizeText(entry?.difficulty || 'medium'),
      isCorrect: Boolean(entry?.isCorrect),
      explanation: normalizeText(entry?.explanation),
      suggestedNextDifficulty: normalizeText(entry?.suggestedNextDifficulty || 'same'),
    }))
    .filter((entry) => entry.question || entry.skill || entry.explanation)
    .sort((a, b) => a.skill.localeCompare(b.skill) || a.question.localeCompare(b.question));
};

export const buildSkillGapSnapshot = (skillGapData = {}) => {
  const rows = Array.isArray(skillGapData?.rows) ? skillGapData.rows : [];

  return rows
    .map((row) => ({
      skill: normalizeText(row?.skill),
      current: Number(row?.current ?? 0),
      required: Number(row?.required ?? 0),
      status: normalizeText(row?.status || 'improve'),
    }))
    .filter((row) => row.skill)
    .sort((a, b) => a.skill.localeCompare(b.skill));
};

export const extractWeakSkills = (skillGapData = {}) => {
  const rows = buildSkillGapSnapshot(skillGapData);
  return rows.filter(
    (row) => row.status === 'improve' || row.status === 'learn' || row.current < row.required
  );
};

export const buildResumeSnapshot = (resumeData = {}) => {
  if (!resumeData || typeof resumeData !== 'object') return {
    fileName: '',
    extractedSkills: [],
    extractedProjects: [],
    education: [],
    certifications: [],
  };

  const extractedSkills = Array.isArray(resumeData.extractedSkills)
    ? resumeData.extractedSkills.map((value) => normalizeText(value)).filter(Boolean)
    : [];

  return {
    fileName: normalizeText(resumeData.fileName),
    extractedSkills,
    extractedProjects: Array.isArray(resumeData.extractedProjects)
      ? resumeData.extractedProjects.map((value) => normalizeText(value)).filter(Boolean)
      : [],
    education: Array.isArray(resumeData.education)
      ? resumeData.education.map((value) => normalizeText(value)).filter(Boolean)
      : [],
    certifications: Array.isArray(resumeData.certifications)
      ? resumeData.certifications.map((value) => normalizeText(value)).filter(Boolean)
      : [],
  };
};

export const computeDataHash = (currentData = {}, selectedSkills = [], checklist = {}) => {
  const normalizedSkills = Array.isArray(selectedSkills)
    ? [...selectedSkills].map((s) => normalizeText(s).toLowerCase()).sort()
    : [];
  const normalizedChecklist = typeof checklist === 'object' && checklist !== null
    ? Object.keys(checklist).sort().reduce((acc, key) => {
        acc[key] = Boolean(checklist[key]);
        return acc;
      }, {})
    : {};

  const snapshot = {
    skillGap: buildSkillGapSnapshot(currentData?.skillGap),
    practice: buildPracticeSnapshot(currentData?.practice),
    resume: buildResumeSnapshot(currentData?.resume),
    selectedSkills: normalizedSkills,
    checklist: normalizedChecklist,
  };

  const hash = stableHash(JSON.stringify(snapshot));
  return hash;
};

export const hasUnderlyingDataChanged = (currentData = {}, storedHash, selectedSkills = [], checklist = {}) => {
  if (!storedHash) {
    return true;
  }

  const currentHash = computeDataHash(currentData, selectedSkills, checklist);
  console.log('[Roadmap] Checking data hash. Stored:', storedHash, 'Current:', currentHash, 'Changed:', currentHash !== storedHash);
  return currentHash !== storedHash;
};

export const milestoneIdFor = (skill, title) => {
  const skillPart = normalizeSkillName(skill || 'general');
  const titlePart = normalizeSkillName(title || 'milestone');
  return `${skillPart}-${titlePart}`.replace(/\s+/g, '-').slice(0, 80) || 'milestone';
};

export const mergeChecklistState = (previousRoadmap, nextRoadmap, previousChecklist = {}) => {
  const previousMap = {};

  for (const milestone of Array.isArray(previousRoadmap?.milestones) ? previousRoadmap.milestones : []) {
    if (!milestone?.skill) continue;
    previousMap[normalizeSkillName(milestone.skill)] = milestone.id || milestoneIdFor(milestone.skill, milestone.title);
  }

  const nextChecklist = {};

  for (const milestone of Array.isArray(nextRoadmap?.milestones) ? nextRoadmap.milestones : []) {
    const id = milestone.id || milestoneIdFor(milestone.skill, milestone.title);
    const skillKey = normalizeSkillName(milestone.skill);
    const preserved = previousChecklist[id] ?? previousChecklist[previousMap[skillKey]] ?? false;
    nextChecklist[id] = Boolean(preserved);
  }

  return nextChecklist;
};

const parseRoadmapMilestones = (payload) => {
  const rawMilestones = Array.isArray(payload?.milestones) ? payload.milestones : [];

  return rawMilestones
    .filter((milestone) => milestone && normalizeText(milestone.title))
    .map((milestone, index) => {
      const skill = normalizeText(milestone.skill || 'general');
      const title = normalizeText(milestone.title);
      const reason = normalizeText(milestone.reason || 'Build confidence in the skill with targeted practice.');
      const estimatedTime = normalizeText(milestone.estimatedTime || '3-5 days');
      const resources = Array.isArray(milestone.resources)
        ? milestone.resources.map((entry) => normalizeText(entry)).filter(Boolean)
        : [];

      return {
        id: normalizeText(milestone.id) || milestoneIdFor(skill || `skill-${index + 1}`, title),
        title,
        skill: skill || 'general',
        reason,
        estimatedTime,
        resources,
        status: ['not_started', 'in_progress', 'done'].includes(normalizeText(milestone.status).toLowerCase())
          ? normalizeText(milestone.status).toLowerCase()
          : 'not_started',
      };
    });
};

export const getRoadmapFocusOptions = (currentData = {}) => {
  const resumeSkills = buildResumeSnapshot(currentData?.resume).extractedSkills;
  const gapSkills = buildSkillGapSnapshot(currentData?.skillGap).map((row) => row.skill);
  const values = [...resumeSkills, ...gapSkills].map((value) => normalizeText(value)).filter(Boolean);
  return [...new Set(values)];
};

const fallbackRoadmap = (currentData = {}, selectedSkillsInput = [], checklist = {}) => {
  const skillGapRows = buildSkillGapSnapshot(currentData?.skillGap);
  const practiceRows = buildPracticeSnapshot(currentData?.practice);
  const resumeSkills = buildResumeSnapshot(currentData?.resume).extractedSkills;
  const focusOptions = getRoadmapFocusOptions(currentData);

  const selectedSkills = Array.isArray(selectedSkillsInput)
    ? selectedSkillsInput.map(normalizeText).filter(Boolean)
    : (typeof selectedSkillsInput === 'string' && selectedSkillsInput.trim() ? [selectedSkillsInput.trim()] : []);

  const effectiveSkills = selectedSkills.length
    ? selectedSkills
    : (focusOptions.length ? focusOptions.slice(0, 3) : (resumeSkills.length ? resumeSkills.slice(0, 3) : (skillGapRows.length ? skillGapRows.slice(0, 3).map((r) => r.skill) : [])));

  if (!effectiveSkills.length) {
    return {
      summary: 'Upload your resume or select skills you want to learn before generating a roadmap.',
      milestones: [],
      selectedSkills: [],
      generatedAt: Date.now(),
      basedOnDataHash: computeDataHash(currentData, [], checklist),
    };
  }

  const milestones = effectiveSkills.map((skill, index) => {
    const gapEntry = skillGapRows.find((row) => normalizeText(row.skill).toLowerCase() === skill.toLowerCase());
    const current = Number(gapEntry?.current ?? 0);
    const required = Number(gapEntry?.required ?? 70);
    const reason = gapEntry
      ? `Your current score in ${skill} is ${current}% (required: ${required}%). Focus here to bridge this gap.`
      : `Build core competency and hands-on experience in ${skill}.`;

    return {
      id: milestoneIdFor(skill, `milestone-${index + 1}`),
      title: `Master ${skill} fundamentals & practical application`,
      skill,
      reason,
      estimatedTime: '1-2 weeks',
      resources: [
        `Review official documentation for ${skill}`,
        `Complete guided exercises and hands-on coding challenges for ${skill}`,
        `Build a mini-project showcasing your ${skill} skills`,
      ],
      status: 'not_started',
    };
  });

  const recentPracticeSummary = practiceRows.length
    ? `Recent practice activity includes ${practiceRows.slice(-3).map((entry) => entry.skill || 'general').join(', ')}.`
    : 'Build upon your foundation with targeted practice.';

  return {
    summary: `${recentPracticeSummary} Roadmap focused on ${effectiveSkills.join(', ')}.`,
    milestones,
    selectedSkills: effectiveSkills,
    generatedAt: Date.now(),
    basedOnDataHash: computeDataHash(currentData, effectiveSkills, checklist),
  };
};

export async function generateRoadmap(currentData = {}, selectedSkillsInput = [], options = {}) {
  const skillGapRows = buildSkillGapSnapshot(currentData?.skillGap);
  const practiceRows = buildPracticeSnapshot(currentData?.practice);
  const resumeSnapshot = buildResumeSnapshot(currentData?.resume);
  const focusOptions = getRoadmapFocusOptions(currentData);

  const selectedSkills = Array.isArray(selectedSkillsInput)
    ? selectedSkillsInput.map(normalizeText).filter(Boolean)
    : (typeof selectedSkillsInput === 'string' && selectedSkillsInput.trim() ? [selectedSkillsInput.trim()] : []);

  const effectiveSkills = selectedSkills.length
    ? selectedSkills
    : (focusOptions.length ? [focusOptions[0]] : (resumeSnapshot.extractedSkills.length ? [resumeSnapshot.extractedSkills[0]] : (skillGapRows.length ? [skillGapRows[0].skill] : [])));

  const checklist = options?.checklist || {};
  const completedMilestones = Array.isArray(options?.completedMilestones)
    ? options.completedMilestones
    : [];

  if (!effectiveSkills.length) {
    return fallbackRoadmap(currentData, selectedSkills, checklist);
  }

  // Filter skill gap data to ONLY user-selected skills. For custom skills not in gap analysis, add synthetic rows.
  const targetSkillGaps = effectiveSkills.map((skillName) => {
    const matched = skillGapRows.find(
      (row) => normalizeText(row.skill).toLowerCase() === skillName.toLowerCase()
    );
    if (matched) {
      return matched;
    }
    return {
      skill: skillName,
      current: 0,
      required: 70,
      status: 'learn',
    };
  });

  const recentPractice = practiceRows.slice(-6);

  const completedListStr = completedMilestones.length
    ? completedMilestones.map((m) => `- [DONE] ${m.title} (${m.skill}): ${m.reason || ''}`).join('\n')
    : 'None completed yet.';

  const userPrompt = `Selected skills to focus on:\n${effectiveSkills.join(', ')}\n\n` +
    `Target skill gap details (ONLY user-selected skills):\n${JSON.stringify(targetSkillGaps, null, 2)}\n\n` +
    `Resume signals:\n${JSON.stringify(resumeSnapshot, null, 2)}\n\n` +
    `Recent practice history:\n${JSON.stringify(recentPractice, null, 2)}\n\n` +
    `Previously completed milestones by user:\n${completedListStr}\n\n` +
    `Rules:\n` +
    `- Prioritize ONLY the selected skills: ${effectiveSkills.join(', ')}.\n` +
    `- Do NOT repeat already completed milestones. Build progressive, next-level milestones that advance the user's mastery beyond what they have already completed.\n` +
    `- Create 2 to 5 actionable milestones directly tied to the selected skills and their real gaps.\n` +
    `- For each milestone, provide: id, title, skill (must be one of the selected skills), reason, estimatedTime, resources (array of specific actionable tasks or references), and status ("not_started").\n` +
    `- Use a concise, motivating summary explaining how this plan addresses the selected skills.\n` +
    `- Respond with valid JSON only, no markdown wrappers, no extra commentary.`;

  let roadmapResponse;
  try {
    roadmapResponse = await callGroqModel([
      {
        role: 'system',
        content:
          'You are an expert technical career and learning coach. Build an individualized, progressive learning roadmap focused strictly on the user-selected skills, addressing their skill gaps and building upon their completed milestones. Return JSON only, with the shape { summary, milestones: [{ id, title, skill, reason, estimatedTime, resources, status }] }.',
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ], {
      temperature: 0.75,
      maxTokens: 1200,
    });
  } catch (error) {
    console.error('[Roadmap] Groq API call failed, using fallback:', error);
    return fallbackRoadmap(currentData, effectiveSkills, checklist);
  }

  try {
    const parsed = extractJsonObject(roadmapResponse);
    const summary = normalizeText(parsed?.summary || `Roadmap tailored for ${effectiveSkills.join(', ')}.`);
    const milestones = parseRoadmapMilestones(parsed);
    const basedOnDataHash = computeDataHash(currentData, effectiveSkills, checklist);
    const generatedAt = Date.now();

    if (!milestones.length) {
      return fallbackRoadmap(currentData, effectiveSkills, checklist);
    }

    return {
      summary,
      milestones: milestones.map((milestone) => ({
        ...milestone,
        id: milestone.id || milestoneIdFor(milestone.skill || effectiveSkills[0], milestone.title),
      })),
      selectedSkills: effectiveSkills,
      generatedAt,
      basedOnDataHash,
    };
  } catch (error) {
    console.error('[Roadmap] Failed parsing response, using fallback:', error);
    return fallbackRoadmap(currentData, effectiveSkills, checklist);
  }
}

export const readStoredRoadmap = () => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(ROADMAP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

export const readStoredChecklist = () => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(ROADMAP_CHECKLIST_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
};

export const writeStoredChecklist = (checklist) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ROADMAP_CHECKLIST_KEY, JSON.stringify(checklist || {}));
};

export const writeStoredRoadmap = (roadmap) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(roadmap || null));
};

export const readPracticeSessionData = () => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(PRACTICE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
};

export const readStoredSelectedSkills = () => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(ROADMAP_SELECTED_SKILLS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
};

export const writeStoredSelectedSkills = (skills) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ROADMAP_SELECTED_SKILLS_KEY, JSON.stringify(skills || []));
};
