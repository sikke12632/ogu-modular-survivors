// 오구 어셈블 카메오로 등장하는 우리 반 친구들.
// 이름은 외형과 무관하게 매번 랜덤으로 뽑히며, 성별에 맞는 스프라이트만 사용된다.
export const FRIEND_NAMES_MALE: readonly string[] = [
  '민동하', '박서준', '서윤수', '성시안', '오예성', '윤준', '이유준',
  '이지안', '이휘원', '임수호', '천지훈', '최원재', '강라온', '안지후'
];

export const FRIEND_NAMES_FEMALE: readonly string[] = [
  '김리하', '김하윤', '박서희', '배소은', '백승아', '오수아',
  '이송희', '임수빈', '정유안', '하윤서', '홍재이', '황서율'
];

export const FRIEND_SPRITES_MALE = ['friend-m1', 'friend-m2', 'friend-m3', 'friend-m4'] as const;
export const FRIEND_SPRITES_FEMALE = ['friend-f1', 'friend-f2', 'friend-f3', 'friend-f4'] as const;

export const FRIEND_SPRITE_IDS = [...FRIEND_SPRITES_MALE, ...FRIEND_SPRITES_FEMALE];

export interface FriendPick { name: string; texture: string }

/** 성별이 맞는 (이름, 외형) 조합을 중복 이름 없이 count명 뽑는다. */
export function pickFriends(random: () => number, count: number): FriendPick[] {
  const pool: { name: string; male: boolean }[] = [
    ...FRIEND_NAMES_MALE.map((name) => ({ name, male: true })),
    ...FRIEND_NAMES_FEMALE.map((name) => ({ name, male: false }))
  ];
  const picks: FriendPick[] = [];
  for (let index = 0; index < count && pool.length > 0; index += 1) {
    const at = Math.floor(random() * pool.length);
    const entry = pool.splice(at, 1)[0]!;
    const sprites = entry.male ? FRIEND_SPRITES_MALE : FRIEND_SPRITES_FEMALE;
    picks.push({ name: entry.name, texture: sprites[Math.floor(random() * sprites.length)]! });
  }
  return picks;
}
