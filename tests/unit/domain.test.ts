import { describe, expect, it } from 'vitest';
import { SpatialHashGrid } from '../../src/core/math/SpatialHashGrid';
import { mulberry32 } from '../../src/core/math/random';
import { resolveDamage } from '../../src/domain/combat/DamageResolver';
import { applyExperience, xpRequiredForLevel } from '../../src/domain/progression/Experience';
import { applyUpgradeChoice, draftUpgrades, findEvolutionCandidate } from '../../src/domain/progression/UpgradeDraft';
import { migrateRunSnapshot } from '../../src/domain/run/RunSerializer';
import type { RunState } from '../../src/domain/run/RunState';
import { SpawnBudget } from '../../src/domain/waves/SpawnBudget';
import { WaveDirector } from '../../src/domain/waves/WaveDirector';

function makeState(): RunState {
  return {
    seed: 7, characterId: 'ranger', elapsedMs: 0, score: 0, kills: 0, level: 1, xp: 0,
    pendingLevelUps: 0, ultimate: 0, ultimateMax: 200,
    weapons: [{ id: 'straight_arrow', level: 1, evolved: false, cooldownMs: 0 }],
    passives: {}, bossesDefeated: [],
    stats: { maxHp: 100, hp: 50, moveSpeed: 200, damage: 1, cooldown: 1, area: 1, duration: 1, pickup: 1, armor: 0, evasion: 0 }
  };
}

describe('core combat and progression', () => {
  it('reduces damage by armor and clamps to a useful minimum', () => {
    expect(resolveDamage({ amount: 100, armor: 0.25, criticalChance: 0, random: () => 1 }).amount).toBe(75);
    expect(resolveDamage({ amount: 0, armor: 0.8, criticalChance: 0, random: () => 1 }).amount).toBe(1);
  });

  it('carries overflow XP across multiple levels', () => {
    const gain = xpRequiredForLevel(1) + xpRequiredForLevel(2) + 5;
    expect(applyExperience(1, 0, gain)).toEqual({ level: 3, xp: 5, levelsGained: 2 });
  });

  it('drafts three legal, deterministic upgrade choices', () => {
    const choices = draftUpgrades(makeState(), mulberry32(123), 3);
    expect(choices).toHaveLength(3);
    expect(new Set(choices.map((choice) => `${choice.kind}:${choice.id}`)).size).toBe(3);
  });

  it('applies passives and recognizes an evolution recipe', () => {
    const state = makeState();
    applyUpgradeChoice(state, { kind: 'passive', id: 'haste', title: '', description: '', icon: '', isNew: true });
    expect(state.stats.cooldown).toBeCloseTo(0.92);
    state.weapons[0]!.level = 5;
    expect(findEvolutionCandidate(state.weapons, state.passives)?.id).toBe('straight_arrow');
  });
});

describe('waves, budgets, saves, and spatial lookup', () => {
  it('has a stable 20-wave timeline and one-shot boss events', () => {
    const director = new WaveDirector();
    expect(director.getWave(0).id).toBe(1);
    expect(director.getWave(899_000).id).toBe(20);
    expect(director.takeBossEvent(299_000)).toBeUndefined();
    expect(director.takeBossEvent(300_000)?.id).toBe('boss_guardian');
    expect(director.takeBossEvent(301_000)).toBeUndefined();
  });

  it('does not overspend spawn credit', () => {
    const budget = new SpawnBudget();
    for (let index = 0; index < 4; index += 1) budget.update(250, 8, { maxActive: 100, qualityScale: 1 });
    expect(budget.spend(5)).toBe(true);
    expect(budget.spend(5)).toBe(false);
    expect(budget.canSpend(2, 100, 100)).toBe(false);
  });

  it('rejects unknown save schema versions', () => {
    expect(migrateRunSnapshot({ schemaVersion: 999, state: makeState(), runId: 'x' })).toBeUndefined();
  });

  it('queries only nearby active objects without duplicates', () => {
    const grid = new SpatialHashGrid<{ uid: number; x: number; y: number; active: boolean }>(100);
    grid.rebuild([{ uid: 1, x: 30, y: 30, active: true }, { uid: 2, x: 350, y: 30, active: true }, { uid: 3, x: 40, y: 40, active: false }]);
    expect(grid.queryRadius(0, 0, 80).map((item) => item.uid)).toEqual([1]);
  });
});
