import { describe, expect, it } from 'vitest';
import { createBaseRunStats } from '../../src/domain/run/RunStatsCalculator';
import { draftUpgrades, type UpgradeChoice } from '../../src/domain/progression/UpgradeDraft';
import type { RunState } from '../../src/domain/run/RunState';
import { presentUpgrade } from '../../src/ui/UpgradePresentation';

// 사용자 피드백으로 방향 변경: 카드에는 "뭐가 얼마나 오르는지" 실제 수치를 보여준다.
// (이전 스펙은 숫자 금지였으나 폐기됨.)

function makeState(): RunState {
  return {
    seed: 1,
    characterId: 'guardian',
    modeId: 'quick',
    elapsedMs: 0,
    score: 0,
    kills: 0,
    level: 1,
    xp: 0,
    pendingLevelUps: 0,
    ultimate: 0,
    ultimateMax: 220,
    weapons: [{ id: 'pierce_spear', level: 2, evolved: false, cooldownMs: 0 }],
    passives: { power: 1 },
    stats: createBaseRunStats('guardian'),
    bossesDefeated: []
  };
}

describe('upgrade card copy (numeric spec)', () => {
  it('weapon upgrade cards show the level jump and concrete gains', () => {
    const random = () => 0;
    // count를 크게 주면 셔플 순서와 무관하게 풀 전체를 받는다.
    const choices = draftUpgrades(makeState(), random, 50, 3);
    const weaponUpgrade = choices.find((choice) => choice.kind === 'weapon' && !choice.isNew)!;
    expect(weaponUpgrade.title).toContain('Lv.2→5');
    expect(weaponUpgrade.description).toMatch(/피해 \+\d+%/);
    expect(weaponUpgrade.description).toMatch(/공격 주기 -\d+%/);
  });

  it('passive cards show real percentages matching the stat formulas', () => {
    const random = () => 0;
    const choices = draftUpgrades(makeState(), random, 50, 1);
    const powerUpgrade = choices.find((choice) => choice.kind === 'passive' && choice.id === 'power' && !choice.isNew);
    expect(powerUpgrade?.description).toBe('공격력 +12%');
    const anyNewPassive = choices.find((choice) => choice.kind === 'passive' && choice.isNew);
    expect(anyNewPassive?.description).toMatch(/[+\-]\d+%/);
  });

  it('presentUpgrade passes the numeric description through', () => {
    const choice: UpgradeChoice = {
      kind: 'weapon',
      id: 'pierce_spear',
      title: '긴 자 Lv.2→5',
      description: '피해 +73% · 공격 주기 -18%',
      icon: '📏',
      isNew: false
    };
    const presentation = presentUpgrade(choice);
    expect(presentation.title).toBe('긴 자 Lv.2→5');
    expect(presentation.description).toBe('피해 +73% · 공격 주기 -18%');
    expect(presentation.badge).toBe('능력 강화');
  });
});
