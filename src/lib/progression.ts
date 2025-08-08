// src/lib/progression.ts

// Base req for L2 is 100; L3 costs 100*1.25; L4 costs 100*1.25^2; etc.
export const PROGRESSION = {
  base: 100,
  growth: 1.25,
};

/** XP required to advance from `level` → `level+1`. Level is 1-indexed. */
export function xpRequiredForLevel(level: number, base = PROGRESSION.base, growth = PROGRESSION.growth) {
  const lvl = Math.max(1, Math.floor(level || 1));
  return Math.round(base * Math.pow(growth, lvl - 1));
}

/** Apply as many level-ups as XP allows; return {level, xp, leveledBy}. */
export function applyLevelUps(level: number, xp: number, base = PROGRESSION.base, growth = PROGRESSION.growth) {
  let lvl = Math.max(1, Math.floor(level || 1));
  let pool = Math.max(0, Math.floor(xp || 0));
  let ups = 0;

  while (pool >= xpRequiredForLevel(lvl, base, growth)) {
    const need = xpRequiredForLevel(lvl, base, growth);
    pool -= need;
    lvl += 1;
    ups += 1;
    // safety cap to avoid infinite loops on absurd XP
    if (ups > 1000) break;
  }
  return { level: lvl, xp: pool, leveledBy: ups };
}
