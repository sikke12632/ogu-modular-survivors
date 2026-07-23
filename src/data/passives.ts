export type PassiveId = 'vitality' | 'power' | 'haste' | 'focus' | 'duration' | 'stride' | 'magnet' | 'guard';

export interface PassiveDefinition {
  id: PassiveId;
  name: string;
  icon: string;
  description: string;
  maxLevel: number;
}

export const PASSIVES: readonly PassiveDefinition[] = [
  { id: 'vitality', name: '생명 코어', icon: '♥', description: '최대 체력 +15%, 즉시 회복', maxLevel: 5 },
  { id: 'power', name: '동력 증폭기', icon: '◆', description: '피해 +12%', maxLevel: 5 },
  { id: 'haste', name: '시간 톱니', icon: '»', description: '공격 대기시간 -8%', maxLevel: 5 },
  { id: 'focus', name: '공간 렌즈', icon: '◎', description: '공격 범위 +12%', maxLevel: 5 },
  { id: 'duration', name: '잔향 결정', icon: '⌛', description: '효과 지속시간 +12%', maxLevel: 5 },
  { id: 'stride', name: '추진 장화', icon: '➤', description: '이동속도 +8%', maxLevel: 5 },
  { id: 'magnet', name: '회수 자석', icon: '∩', description: '획득 범위 +22%', maxLevel: 5 },
  { id: 'guard', name: '위상 장갑', icon: '⬡', description: '방어 +5%, 회피 +2%', maxLevel: 5 }
] as const;

export function getPassive(id: PassiveId): PassiveDefinition {
  return PASSIVES.find((passive) => passive.id === id) ?? PASSIVES[0]!;
}
