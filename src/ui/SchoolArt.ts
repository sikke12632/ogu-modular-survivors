import Phaser from 'phaser';
import type { CharacterId } from '../data/characters';
import type { EnemyDefinition } from '../data/enemies';
import type { WeaponId } from '../data/weapons';

export const SCHOOL_FONT = '"Jua", "Noto Sans KR Variable", "Noto Sans KR", system-ui, sans-serif';
export const SCHOOL_DISPLAY_FONT = '"Jua", "Noto Sans KR Variable", system-ui, sans-serif';
export const SCHOOL_BODY_FONT = '"Noto Sans KR Variable", "Noto Sans KR", system-ui, sans-serif';

export const SCHOOL_PALETTE = {
  ink: 0x29384a,
  sky: 0x78c7e3,
  cloud: 0xf7f0dc,
  cream: 0xffedc2,
  yard: 0xe6a96b,
  yardShade: 0xc98252,
  blue: 0x4d91c8,
  green: 0x73b65b,
  orange: 0xe76555,
  yellow: 0xf4cc5f,
  chalk: 0xfff8db
} as const;

// Enemy spritesheets are 16px frames in a 4x4 grid: column = facing
// (0 down, 1 up, 2 right, 3 left), row = animation frame.
export function createEnemyAnimations(scene: Phaser.Scene, enemyIds: readonly EnemyDefinition['id'][]): void {
  for (const id of enemyIds) {
    const key = `enemy-${id}-walk`;
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: [0, 4, 8, 12].map((frame) => ({ key: `enemy-${id}`, frame })),
      frameRate: 6,
      repeat: -1
    });
  }
}

export const SCHOOL_SUPPLY_VISUALS = [
  'pencil', 'colored-pencil', 'chalk', 'ruler', 'paper-plane', 'eraser',
  'marker', 'ink', 'highlighter', 'paint', 'notebook', 'pointer'
] as const;

export type SchoolSupplyVisual =
  | 'pencil'
  | 'colored-pencil'
  | 'chalk'
  | 'ruler'
  | 'paper-plane'
  | 'eraser'
  | 'marker'
  | 'ink'
  | 'highlighter'
  | 'paint'
  | 'notebook'
  | 'pointer';

const WEAPON_ART: Record<WeaponId, SchoolSupplyVisual> = {
  straight_arrow: 'pencil',
  fan_blade: 'colored-pencil',
  homing_orb: 'chalk',
  pierce_spear: 'ruler',
  boomerang: 'paper-plane',
  orbit_blade: 'eraser',
  fire_aura: 'marker',
  poison_pool: 'ink',
  chain_lightning: 'highlighter',
  frost_nova: 'paint',
  meteor: 'notebook',
  laser: 'pointer'
};

export function schoolWeaponTextureFor(id: WeaponId): string {
  return `school-${WEAPON_ART[id]}`;
}

export function createStudentAnimations(scene: Phaser.Scene): void {
  // Sheet layout: 0-5 down, 6-11 RIGHT, 12-17 up, 18-23 LEFT.
  // (The side rows face the opposite way from what the old code assumed —
  //  swapping them here is what stops the moonwalk.)
  const directions = [
    { name: 'down', start: 0 },
    { name: 'left', start: 18 },
    { name: 'up', start: 12 },
    { name: 'right', start: 6 }
  ] as const;
  for (const id of ['guardian', 'ranger', 'mystic'] as CharacterId[]) {
    for (const direction of directions) {
      const key = `player-${id}-walk-${direction.name}`;
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(`player-${id}`, {
          start: direction.start,
          end: direction.start + 5
        }),
        frameRate: 10,
        repeat: -1
      });
    }
  }
}

export function updateStudentAnimation(
  sprite: Phaser.Physics.Arcade.Sprite,
  movementX: number,
  movementY: number
): void {
  const moving = Math.abs(movementX) + Math.abs(movementY) > 0.01;
  const previous = (sprite.getData('student-direction') as string | undefined) ?? 'down';
  const direction = Math.abs(movementX) > Math.abs(movementY)
    ? (movementX < 0 ? 'left' : 'right')
    : Math.abs(movementY) > 0.01
      ? (movementY < 0 ? 'up' : 'down')
      : previous;
  sprite.setData('student-direction', direction);

  if (moving) {
    sprite.play(`${sprite.texture.key}-walk-${direction}`, true);
    return;
  }
  const idleFrame = direction === 'left' ? 18 : direction === 'up' ? 12 : direction === 'right' ? 6 : 0;
  sprite.anims.stop();
  sprite.setFrame(idleFrame);
}
