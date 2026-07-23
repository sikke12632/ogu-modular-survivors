export function xpRequiredForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.floor(10 + safeLevel * 4.5 + Math.pow(safeLevel, 1.42) * 2.2);
}

export function applyExperience(level: number, xp: number, gain: number): { level: number; xp: number; levelsGained: number } {
  let nextLevel = Math.max(1, Math.floor(level));
  let nextXp = Math.max(0, xp) + Math.max(0, gain);
  let levelsGained = 0;
  while (nextXp >= xpRequiredForLevel(nextLevel) && levelsGained < 20) {
    nextXp -= xpRequiredForLevel(nextLevel);
    nextLevel += 1;
    levelsGained += 1;
  }
  return { level: nextLevel, xp: nextXp, levelsGained };
}
