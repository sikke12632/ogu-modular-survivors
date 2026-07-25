import { getPassive } from '../data/passives';
import { getWeapon } from '../data/weapons';
import type { UpgradeChoice } from '../domain/progression/UpgradeDraft';

export interface UpgradePresentation {
  icon: string;
  title: string;
  description: string;
  badge: '새 능력' | '능력 강화' | '회복';
}

const PASSIVE_LABELS: Record<string, string> = {
  vitality: '❤️ 체력 증가',
  power: '⚔ 공격 강해짐',
  haste: '🏹 공격 빨라짐',
  focus: '◎ 공격 넓어짐',
  duration: '⌛ 효과 오래감',
  stride: '➤ 이동 빨라짐',
  magnet: '🧲 멀리서 획득',
  guard: '🛡 덜 아프게'
};

export function presentUpgrade(choice: UpgradeChoice): UpgradePresentation {
  if (choice.kind === 'heal') {
    return { icon: '♥', title: '체력 회복', description: '체력을 크게 채움', badge: '회복' };
  }
  if (choice.kind === 'passive') {
    const passive = getPassive(choice.id);
    return {
      icon: passive.icon,
      title: PASSIVE_LABELS[choice.id] ?? passive.name,
      description: choice.isNew ? '새 보조 능력' : '효과가 더 강해짐',
      badge: choice.isNew ? '새 능력' : '능력 강화'
    };
  }
  const weapon = getWeapon(choice.id);
  return {
    icon: weapon.icon,
    title: weapon.name,
    description: choice.isNew ? weapon.description : '무기가 더 강해짐',
    badge: choice.isNew ? '새 능력' : '능력 강화'
  };
}
