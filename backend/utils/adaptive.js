const LEVELS = ['easy', 'medium', 'hard'];

function normalizeDifficulty(value) {
  const mapping = { beginner: 'easy', intermediate: 'medium', advanced: 'hard' };
  const normalized = String(value || 'medium').trim().toLowerCase();
  return mapping[normalized] || (LEVELS.includes(normalized) ? normalized : 'medium');
}

function getNextDifficulty(currentDifficulty, recentResults = []) {
  const safeCurrent = normalizeDifficulty(currentDifficulty);
  const idx = LEVELS.indexOf(safeCurrent);
  const lastTwo = Array.isArray(recentResults) ? recentResults.slice(-2) : [];

  if (lastTwo.length === 2) {
    if (lastTwo.every(Boolean)) {
      return LEVELS[Math.min(idx + 1, LEVELS.length - 1)];
    }
    if (lastTwo.every((value) => value === false)) {
      return LEVELS[Math.max(idx - 1, 0)];
    }
  }

  return safeCurrent;
}

module.exports = { LEVELS, normalizeDifficulty, getNextDifficulty };
