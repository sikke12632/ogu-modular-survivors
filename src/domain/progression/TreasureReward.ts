import type { RandomFn } from '../../core/math/random';
import { getWeapon } from '../../data/weapons';
import type { RunState } from '../run/RunState';
import { findEvolutionCandidate } from './UpgradeDraft';

export interface TreasureReward {
  title: string;
  description: string;
  evolved: boolean;
}

export type ChestSpawnDecision = 'spawn' | 'replace-normal' | 'skip';

export function decideChestSpawn(
  existingBossFlags: readonly boolean[],
  requestedBossChest: boolean
): ChestSpawnDecision {
  if (existingBossFlags.length === 0) return 'spawn';
  if (!requestedBossChest || existingBossFlags.some(Boolean)) return 'skip';
  return 'replace-normal';
}

export function applyTreasureReward(
  state: RunState,
  bossChest: boolean,
  random: RandomFn
): TreasureReward {
  const evolution = bossChest ? findEvolutionCandidate(state.weapons, state.passives) : undefined;
  if (evolution) {
    evolution.evolved = true;
    const definition = getWeapon(evolution.id);
    return {
      title: `${definition.evolvedName} 진화!`,
      description: `${definition.name}의 공격 패턴이 크게 확장됩니다.`,
      evolved: true
    };
  }

  const upgradable = state.weapons.filter((weapon) => weapon.level < getWeapon(weapon.id).maxLevel);
  const weapon = upgradable[Math.floor(random() * upgradable.length)];
  if (weapon) {
    weapon.level += 1;
    return {
      title: `${getWeapon(weapon.id).name} 강화`,
      description: `무기 레벨이 ${weapon.level}이 되었습니다.`,
      evolved: false
    };
  }

  const heal = state.stats.maxHp * 0.45;
  state.stats.hp = Math.min(state.stats.maxHp, state.stats.hp + heal);
  return {
    title: '완전 수리',
    description: `체력을 ${Math.round(heal)} 회복했습니다.`,
    evolved: false
  };
}
