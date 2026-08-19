import { PASSIVES, getPassive, type PassiveId } from '../../data/passives';
import { WEAPONS, getWeapon, type WeaponId } from '../../data/weapons';
import type { OwnedWeapon, RunState } from '../run/RunState';
import { shuffle, type RandomFn } from '../../core/math/random';
import { applyPassiveStatBonus } from '../run/RunStatsCalculator';

export type UpgradeChoice =
  | { kind: 'weapon'; id: WeaponId; title: string; description: string; icon: string; isNew: boolean }
  | { kind: 'passive'; id: PassiveId; title: string; description: string; icon: string; isNew: boolean }
  | { kind: 'heal'; id: 'heal'; title: string; description: string; icon: string; isNew: false };

// 카드에 보여줄 실제 수치. WeaponSystem/RunStatsCalculator의 공식과 같은 값을 쓴다:
// 무기 피해 배율 1+(level-1)*0.32, 레벨당 쿨타임 감소 0.055.
function weaponUpgradeDetail(currentLevel: number, nextLevel: number): string {
  const damageGain = (1 + (nextLevel - 1) * 0.32) / (1 + (currentLevel - 1) * 0.32) - 1;
  const hasteGain = 1 - (1 - (nextLevel - 1) * 0.055) / (1 - (currentLevel - 1) * 0.055);
  return `피해 +${Math.round(damageGain * 100)}% · 공격 주기 -${Math.round(hasteGain * 100)}%`;
}

function newWeaponDetail(weaponId: WeaponId): string {
  const weapon = getWeapon(weaponId);
  return `${weapon.description}\n피해 ${weapon.baseDamage} · ${(weapon.cooldownMs / 1_000).toFixed(1)}초마다 발동`;
}

// RunStatsCalculator.applyPassiveStatBonus의 레벨당 배율과 동일해야 한다.
function passiveDetail(passiveId: PassiveId, steps: number): string {
  const pct = (ratio: number): number => Math.round((Math.pow(ratio, steps) - 1) * 100);
  switch (passiveId) {
    case 'vitality': return `최대 체력 +${pct(1.15)}%`;
    case 'power': return `공격력 +${pct(1.12)}%`;
    case 'haste': return `공격 주기 -${Math.round((1 - Math.pow(0.92, steps)) * 100)}%`;
    case 'focus': return `공격 범위 +${pct(1.12)}%`;
    case 'duration': return `효과 지속 +${pct(1.12)}%`;
    case 'stride': return `이동 속도 +${pct(1.08)}%`;
    case 'magnet': return `줍는 범위 +${pct(1.22)}%`;
    case 'guard': return `받는 피해 -${5 * steps}%p · 회피 +${2 * steps}%p`;
  }
}

export function draftUpgrades(state: RunState, random: RandomFn, count = 3, steps = 1): UpgradeChoice[] {
  const safeSteps = Math.max(1, Math.floor(steps));
  const pool: UpgradeChoice[] = [];
  const ownedIds = new Set(state.weapons.map((weapon) => weapon.id));
  for (const owned of state.weapons) {
    const definition = getWeapon(owned.id);
    if (owned.level < definition.maxLevel) {
      const nextLevel = Math.min(definition.maxLevel, owned.level + safeSteps);
      pool.push({
        kind: 'weapon',
        id: owned.id,
        title: `${definition.name} Lv.${owned.level}→${nextLevel}`,
        description: weaponUpgradeDetail(owned.level, nextLevel),
        icon: definition.icon,
        isNew: false
      });
    }
  }
  if (state.weapons.length < 6) {
    for (const weapon of WEAPONS) {
      if (!ownedIds.has(weapon.id)) pool.push({ kind: 'weapon', id: weapon.id, title: weapon.name, description: newWeaponDetail(weapon.id), icon: weapon.icon, isNew: true });
    }
  }
  const passiveCount = Object.keys(state.passives).length;
  for (const passive of PASSIVES) {
    const level = state.passives[passive.id] ?? 0;
    if (level > 0 && level < passive.maxLevel) {
      const nextLevel = Math.min(passive.maxLevel, level + safeSteps);
      pool.push({ kind: 'passive', id: passive.id, title: `${passive.name} Lv.${level}→${nextLevel}`, description: passiveDetail(passive.id, nextLevel - level), icon: passive.icon, isNew: false });
    } else if (level === 0 && passiveCount < 6) {
      pool.push({ kind: 'passive', id: passive.id, title: passive.name, description: passiveDetail(passive.id, Math.min(passive.maxLevel, safeSteps)), icon: passive.icon, isNew: true });
    }
  }
  const choices = shuffle(pool, random).slice(0, count);
  while (choices.length < count) {
    choices.push({ kind: 'heal', id: 'heal', title: '응급 수리', description: `최대 체력의 ${Math.min(100, 35 * safeSteps)}% 회복`, icon: '✚', isNew: false });
  }
  return choices;
}

export function applyUpgradeChoice(state: RunState, choice: UpgradeChoice, steps = 1): void {
  const safeSteps = Math.max(1, Math.floor(steps));
  if (choice.kind === 'weapon') {
    const owned = state.weapons.find((weapon) => weapon.id === choice.id);
    if (owned) owned.level = Math.min(getWeapon(choice.id).maxLevel, owned.level + safeSteps);
    else state.weapons.push({
      id: choice.id,
      level: Math.min(getWeapon(choice.id).maxLevel, safeSteps),
      evolved: false,
      cooldownMs: 0
    });
    return;
  }
  if (choice.kind === 'heal') {
    state.stats.hp = Math.min(state.stats.maxHp, state.stats.hp + state.stats.maxHp * 0.35 * safeSteps);
    return;
  }
  const currentLevel = state.passives[choice.id] ?? 0;
  const nextLevel = Math.min(getPassive(choice.id).maxLevel, currentLevel + safeSteps);
  if (nextLevel === currentLevel) return;
  state.passives[choice.id] = nextLevel;
  for (let level = currentLevel; level < nextLevel; level += 1) {
    applyPassiveStatBonus(state.stats, choice.id);
  }
}

export function findEvolutionCandidate(weapons: readonly OwnedWeapon[], passives: Partial<Record<PassiveId, number>>): OwnedWeapon | undefined {
  return weapons.find((owned) => {
    const weapon = getWeapon(owned.id);
    return !owned.evolved && owned.level >= weapon.maxLevel && (passives[weapon.passive] ?? 0) > 0;
  });
}
