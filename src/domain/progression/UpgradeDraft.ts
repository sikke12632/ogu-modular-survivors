import { PASSIVES, getPassive, type PassiveId } from '../../data/passives';
import { WEAPONS, getWeapon, type WeaponId } from '../../data/weapons';
import type { OwnedWeapon, RunState } from '../run/RunState';
import { shuffle, type RandomFn } from '../../core/math/random';

export type UpgradeChoice =
  | { kind: 'weapon'; id: WeaponId; title: string; description: string; icon: string; isNew: boolean }
  | { kind: 'passive'; id: PassiveId; title: string; description: string; icon: string; isNew: boolean }
  | { kind: 'heal'; id: 'heal'; title: string; description: string; icon: string; isNew: false };

export function draftUpgrades(state: RunState, random: RandomFn, count = 3): UpgradeChoice[] {
  const pool: UpgradeChoice[] = [];
  const ownedIds = new Set(state.weapons.map((weapon) => weapon.id));
  for (const owned of state.weapons) {
    const definition = getWeapon(owned.id);
    if (owned.level < definition.maxLevel) {
      pool.push({ kind: 'weapon', id: owned.id, title: `${definition.name} Lv.${owned.level + 1}`, description: '피해·범위·발사 패턴 강화', icon: definition.icon, isNew: false });
    }
  }
  if (state.weapons.length < 6) {
    for (const weapon of WEAPONS) {
      if (!ownedIds.has(weapon.id)) pool.push({ kind: 'weapon', id: weapon.id, title: weapon.name, description: weapon.description, icon: weapon.icon, isNew: true });
    }
  }
  const passiveCount = Object.keys(state.passives).length;
  for (const passive of PASSIVES) {
    const level = state.passives[passive.id] ?? 0;
    if (level > 0 && level < passive.maxLevel) {
      pool.push({ kind: 'passive', id: passive.id, title: `${passive.name} Lv.${level + 1}`, description: passive.description, icon: passive.icon, isNew: false });
    } else if (level === 0 && passiveCount < 6) {
      pool.push({ kind: 'passive', id: passive.id, title: passive.name, description: passive.description, icon: passive.icon, isNew: true });
    }
  }
  const choices = shuffle(pool, random).slice(0, count);
  while (choices.length < count) {
    choices.push({ kind: 'heal', id: 'heal', title: '응급 수리', description: '최대 체력의 35% 회복', icon: '✚', isNew: false });
  }
  return choices;
}

export function applyUpgradeChoice(state: RunState, choice: UpgradeChoice): void {
  if (choice.kind === 'weapon') {
    const owned = state.weapons.find((weapon) => weapon.id === choice.id);
    if (owned) owned.level = Math.min(getWeapon(choice.id).maxLevel, owned.level + 1);
    else state.weapons.push({ id: choice.id, level: 1, evolved: false, cooldownMs: 0 });
    return;
  }
  if (choice.kind === 'heal') {
    state.stats.hp = Math.min(state.stats.maxHp, state.stats.hp + state.stats.maxHp * 0.35);
    return;
  }
  const currentLevel = state.passives[choice.id] ?? 0;
  const nextLevel = Math.min(getPassive(choice.id).maxLevel, currentLevel + 1);
  state.passives[choice.id] = nextLevel;
  if (choice.id === 'vitality') {
    const gain = state.stats.maxHp * 0.15;
    state.stats.maxHp += gain;
    state.stats.hp = Math.min(state.stats.maxHp, state.stats.hp + gain);
  } else if (choice.id === 'power') state.stats.damage *= 1.12;
  else if (choice.id === 'haste') state.stats.cooldown *= 0.92;
  else if (choice.id === 'focus') state.stats.area *= 1.12;
  else if (choice.id === 'duration') state.stats.duration *= 1.12;
  else if (choice.id === 'stride') state.stats.moveSpeed *= 1.08;
  else if (choice.id === 'magnet') state.stats.pickup *= 1.22;
  else if (choice.id === 'guard') {
    state.stats.armor = Math.min(0.55, state.stats.armor + 0.05);
    state.stats.evasion = Math.min(0.35, state.stats.evasion + 0.02);
  }
}

export function findEvolutionCandidate(weapons: readonly OwnedWeapon[], passives: Partial<Record<PassiveId, number>>): OwnedWeapon | undefined {
  return weapons.find((owned) => {
    const weapon = getWeapon(owned.id);
    return !owned.evolved && owned.level >= weapon.maxLevel && (passives[weapon.passive] ?? 0) > 0;
  });
}
