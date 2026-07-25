export type PassiveId = 'vitality' | 'power' | 'haste' | 'focus' | 'duration' | 'stride' | 'magnet' | 'guard';

export interface PassiveDefinition {
  id: PassiveId;
  name: string;
  icon: string;
  description: string;
  maxLevel: number;
}

export const PASSIVES: readonly PassiveDefinition[] = [
  { id: 'vitality', name: '생명 코어', icon: '♥', description: '체력과 회복 증가', maxLevel: 5 },
  { id: 'power', name: '동력 증폭기', icon: '⚔', description: '공격력 증가', maxLevel: 5 },
  { id: 'haste', name: '시간 톱니', icon: '🏹', description: '연사속도 증가', maxLevel: 5 },
  { id: 'focus', name: '공간 렌즈', icon: '◎', description: '공격범위 증가', maxLevel: 5 },
  { id: 'duration', name: '잔향 결정', icon: '⌛', description: '효과시간 증가', maxLevel: 5 },
  { id: 'stride', name: '추진 장화', icon: '➤', description: '이동속도 증가', maxLevel: 5 },
  { id: 'magnet', name: '회수 자석', icon: '🧲', description: '획득범위 증가', maxLevel: 5 },
  { id: 'guard', name: '위상 장갑', icon: '🛡', description: '방어와 회피 증가', maxLevel: 5 }
] as const;

export function getPassive(id: PassiveId): PassiveDefinition {
  return PASSIVES.find((passive) => passive.id === id) ?? PASSIVES[0]!;
}
