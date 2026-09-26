export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];

export const normalizeDifficulty = (value) => {
  const nextValue = String(value || 'medium').trim().toLowerCase();

  if (DIFFICULTY_LEVELS.includes(nextValue)) {
    return nextValue;
  }

  if (['beginner', 'junior', 'fresher', 'entry'].includes(nextValue)) return 'easy';
  if (['intermediate', 'mid', 'mid-level', 'associate'].includes(nextValue)) return 'medium';
  if (['advanced', 'senior', 'lead', 'principal', 'staff'].includes(nextValue)) return 'hard';

  return 'medium';
};

export const parseDifficultyDirection = (value) => {
  const direction = String(value || 'same').trim().toLowerCase();

  if (direction === 'easier' || direction === 'decrease' || direction === 'down') return 'easier';
  if (direction === 'harder' || direction === 'increase' || direction === 'up') return 'harder';

  return 'same';
};

export const moveDifficulty = (currentDifficulty, direction) => {
  const normalized = normalizeDifficulty(currentDifficulty);
  const currentIndex = DIFFICULTY_LEVELS.indexOf(normalized);
  const parsedDirection = parseDifficultyDirection(direction);

  if (parsedDirection === 'easier') {
    return DIFFICULTY_LEVELS[Math.max(0, currentIndex - 1)];
  }

  if (parsedDirection === 'harder') {
    return DIFFICULTY_LEVELS[Math.min(DIFFICULTY_LEVELS.length - 1, currentIndex + 1)];
  }

  return normalized;
};

export const experienceLevelToDifficulty = (level) => {
  const normalized = String(level || 'mid').trim().toLowerCase();
  if (['fresher', 'junior', 'entry', 'intern'].includes(normalized)) return 'easy';
  if (['senior', 'lead', 'principal', 'architect'].includes(normalized)) return 'hard';
  return 'medium';
};

export const DIFFICULTY_MULTIPLIERS = {
  easy: 1.0,
  medium: 1.3,
  hard: 1.6,
};

export const DIFFICULTY_BASE_XP = {
  easy: 50,
  medium: 75,
  hard: 100,
};

export const getDifficultyMultiplier = (difficulty) => {
  const normalized = normalizeDifficulty(difficulty);
  return DIFFICULTY_MULTIPLIERS[normalized] || 1.0;
};

export const computeXpForAnswer = (score = 0, difficulty = 'medium', streak = 0) => {
  const normalizedDiff = normalizeDifficulty(difficulty);
  const base = DIFFICULTY_BASE_XP[normalizedDiff] || 75;
  const qualityFactor = Math.max(0, Math.min(100, Number(score) || 0)) / 100;
  let rawXp = Math.round(base * qualityFactor);

  // Streak bonus: +10% for 2-streak, +20% for 3-streak, +30% for 4+ streak
  if (streak >= 4) {
    rawXp = Math.round(rawXp * 1.3);
  } else if (streak === 3) {
    rawXp = Math.round(rawXp * 1.2);
  } else if (streak === 2) {
    rawXp = Math.round(rawXp * 1.1);
  }

  return rawXp;
};
