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
  vitality: '체력 증가',
  power: '공격력 증가',
  haste: '연사속도 증가',
  focus: '공격범위 증가',
  duration: '효과시간 증가',
  stride: '이동속도 증가',
  magnet: '획득범위 증가',
  guard: '방어력 증가'
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
