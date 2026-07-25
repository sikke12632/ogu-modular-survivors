export type PassiveId = 'vitality' | 'power' | 'haste' | 'focus' | 'duration' | 'stride' | 'magnet' | 'guard';

export interface PassiveDefinition {
  id: PassiveId;
  name: string;
  icon: string;
  description: string;
  maxLevel: number;
}

export const PASSIVES: readonly PassiveDefinition[] = [
  { id: 'vitality', name: '급식 우유', icon: '♥', description: '❤️ 체력 증가', maxLevel: 5 },
  { id: 'power', name: '응원 스티커', icon: '⚔', description: '⚔ 공격 강해짐', maxLevel: 5 },
  { id: 'haste', name: '새 연필심', icon: '🏹', description: '🏹 공격 빨라짐', maxLevel: 5 },
  { id: 'focus', name: '과학실 돋보기', icon: '◎', description: '◎ 공격 넓어짐', maxLevel: 5 },
  { id: 'duration', name: '수업 스톱워치', icon: '⌛', description: '⌛ 효과 오래감', maxLevel: 5 },
  { id: 'stride', name: '새 실내화', icon: '➤', description: '➤ 이동 빨라짐', maxLevel: 5 },
  { id: 'magnet', name: '자석 필통', icon: '🧲', description: '🧲 멀리서 획득', maxLevel: 5 },
  { id: 'guard', name: '안전 수칙', icon: '🛡', description: '🛡 덜 아프게', maxLevel: 5 }
] as const;

export function getPassive(id: PassiveId): PassiveDefinition {
  return PASSIVES.find((passive) => passive.id === id) ?? PASSIVES[0]!;
}
