import Phaser from 'phaser';
import type { CharacterId } from '../data/characters';
import type { EnemyDefinition } from '../data/enemies';
import type { WeaponId } from '../data/weapons';

export const SCHOOL_FONT = '"Noto Sans KR Variable", "Noto Sans KR", system-ui, sans-serif';
export const SCHOOL_DISPLAY_FONT = '"Black Han Sans", "Noto Sans KR Variable", system-ui, sans-serif';

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

const ENEMY_ART: Record<EnemyDefinition['id'], string> = {
  spark: 'scribble-slime',
  mote: 'ink-ghost',
  wisp: 'paper-bat',
  dart: 'scribble-slime',
  shell: 'test-skeleton',
  bulwark: 'ink-mummy',
  shooter_blue: 'marker-archer',
  shooter_pink: 'pencil-knight',
  charger: 'doodle-demon',
  exploder: 'scribble-slime',
  support: 'teacher',
  blocker: 'ink-mummy',
  elite_charge: 'hall-monitor',
  elite_barrage: 'hall-monitor-2',
  elite_leech: 'hall-monitor-3',
  elite_summon: 'teacher',
  boss_guardian: 'hall-monitor',
  boss_caster: 'hall-monitor-2',
  boss_overlord: 'doodle-demon'
};

export const SCHOOL_ENEMY_ART = [...new Set(Object.values(ENEMY_ART))];

export function schoolEnemyArtFor(definition: EnemyDefinition): string {
  return ENEMY_ART[definition.id];
}

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
  const directions = [
    { name: 'down', start: 0 },
    { name: 'left', start: 6 },
    { name: 'up', start: 12 },
    { name: 'right', start: 18 }
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
  const idleFrame = direction === 'left' ? 6 : direction === 'up' ? 12 : direction === 'right' ? 18 : 0;
  sprite.anims.stop();
  sprite.setFrame(idleFrame);
}

export function createSchoolSupplyTextures(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  const save = (key: string): void => {
    graphics.generateTexture(`school-${key}`, 32, 32);
    graphics.clear();
  };

  graphics.fillStyle(0x5b3828).fillTriangle(27, 13, 30, 16, 27, 19);
  graphics.fillStyle(0xf4c44e).fillRect(6, 13, 22, 7);
  graphics.fillStyle(0xf18a91).fillRect(3, 13, 5, 7);
  graphics.fillStyle(0xfff0b5).fillRect(8, 14, 18, 2);
  save('pencil');

  graphics.fillStyle(0x5b3828).fillTriangle(27, 13, 30, 16, 27, 19);
  graphics.fillStyle(0xef5a5a).fillRect(5, 13, 23, 7);
  graphics.fillStyle(0x5a93cf).fillRect(2, 13, 5, 7);
  graphics.fillStyle(0xffb5a9).fillRect(8, 14, 18, 2);
  save('colored-pencil');

  graphics.fillStyle(0x6f8fa2).fillRoundedRect(5, 11, 23, 11, 4);
  graphics.fillStyle(0xfff8db).fillRoundedRect(4, 9, 23, 11, 4);
  graphics.fillStyle(0xffffff).fillRect(8, 11, 15, 3);
  save('chalk');

  graphics.fillStyle(0x5b3828).fillRect(2, 11, 28, 11);
  graphics.fillStyle(0xf4cc5f).fillRect(3, 9, 27, 11);
  for (let x = 7; x < 29; x += 5) graphics.fillStyle(0x9a6a36).fillRect(x, 9, 2, 5);
  save('ruler');

  graphics.fillStyle(0x5b3828).fillTriangle(3, 9, 29, 16, 4, 23);
  graphics.fillStyle(0xf7f0dc).fillTriangle(4, 10, 28, 16, 5, 15);
  graphics.fillStyle(0xb7d8e8).fillTriangle(5, 17, 28, 16, 5, 22);
  graphics.lineStyle(2, 0x4d91c8).lineBetween(7, 16, 22, 16);
  save('paper-plane');

  graphics.fillStyle(0x5b3828).fillRoundedRect(4, 9, 24, 16, 4);
  graphics.fillStyle(0xf07e8b).fillRoundedRect(4, 7, 24, 15, 4);
  graphics.fillStyle(0x6fb4d4).fillRect(4, 16, 24, 6);
  graphics.fillStyle(0xffc5cb).fillRect(8, 10, 15, 3);
  save('eraser');

  graphics.fillStyle(0x29384a).fillRoundedRect(3, 11, 26, 12, 4);
  graphics.fillStyle(0xe76555).fillRoundedRect(5, 10, 20, 11, 3);
  graphics.fillStyle(0xffc9a8).fillRect(7, 12, 12, 3);
  graphics.fillStyle(0x29384a).fillTriangle(25, 10, 31, 16, 25, 22);
  save('marker');

  graphics.fillStyle(0x29384a).fillRoundedRect(6, 8, 20, 20, 4);
  graphics.fillStyle(0x4d91c8).fillRoundedRect(7, 13, 18, 14, 3);
  graphics.fillStyle(0xdbeef6).fillRect(10, 4, 12, 8);
  graphics.fillStyle(0x81c9e8).fillRect(10, 16, 12, 4);
  save('ink');

  graphics.fillStyle(0x29384a).fillRect(3, 11, 26, 12);
  graphics.fillStyle(0xf4e45f).fillRect(5, 9, 20, 12);
  graphics.fillStyle(0xc7b83f).fillRect(8, 15, 14, 4);
  graphics.fillStyle(0x29384a).fillTriangle(25, 9, 31, 15, 25, 21);
  save('highlighter');

  graphics.fillStyle(0x5b3828).fillCircle(16, 16, 13);
  graphics.fillStyle(0xffedc2).fillCircle(15, 14, 12);
  graphics.fillStyle(0xe76555).fillCircle(9, 10, 3);
  graphics.fillStyle(0x4d91c8).fillCircle(17, 8, 3);
  graphics.fillStyle(0x73b65b).fillCircle(23, 13, 3);
  graphics.fillStyle(0xf4cc5f).fillCircle(11, 21, 3);
  graphics.fillStyle(0x29384a).fillCircle(19, 18, 4);
  save('paint');

  graphics.fillStyle(0x29384a).fillRoundedRect(5, 4, 23, 25, 3);
  graphics.fillStyle(0x4d91c8).fillRoundedRect(3, 3, 23, 25, 3);
  graphics.fillStyle(0xf7f0dc).fillRect(8, 7, 14, 16);
  graphics.fillStyle(0xe76555).fillRect(9, 9, 12, 3);
  graphics.fillStyle(0x95b3c3).fillRect(9, 15, 10, 2);
  graphics.fillStyle(0x95b3c3).fillRect(9, 19, 10, 2);
  save('notebook');

  graphics.fillStyle(0x29384a).fillRoundedRect(3, 11, 26, 11, 4);
  graphics.fillStyle(0xe76555).fillRoundedRect(5, 10, 18, 10, 3);
  graphics.fillStyle(0xffedc2).fillRect(7, 12, 9, 3);
  graphics.fillStyle(0xf94c4c).fillCircle(29, 15, 3);
  save('pointer');

  graphics.destroy();
}
