import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { BOSSES, ELITES, ENEMIES } from '../data/enemies';
import { FRIEND_SPRITE_IDS } from '../data/friends';
import {
  createEnemyAnimations,
  createStudentAnimations,
  SCHOOL_SUPPLY_VISUALS
} from '../ui/SchoolArt';

const WORLD_IMAGES = [
  'ground-grass', 'ground-yard',
  'tree-round', 'tree-round-2', 'tree-pine', 'tree-pine-2',
  'rock-big', 'rock-2', 'hedge', 'bush-orange', 'palm-mini',
  'flower-white', 'tuft-red',
  'bench', 'stool', 'locker', 'notice-board', 'ground-speckle'
] as const;

export class BootScene extends Phaser.Scene {
  private failedFiles: Phaser.Loader.File[] = [];
  private retriedOnce = false;

  constructor() { super('BootScene'); }

  preload(): void {
    // 불안정한 네트워크(학교 와이파이)에서 그림이 한 장이라도 빠지면
    // Phaser가 초록 격자(missing texture)를 그린다. 실패 파일을 모아
    // create()에서 한 번 재시도한다.
    this.failedFiles = [];
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      this.failedFiles.push(file);
    });
    for (const tone of ['blue', 'green', 'orange', 'grey'] as const) {
      this.load.image(`ui-button-${tone}`, `assets/school/ui/button-${tone}.png`);
      this.load.image(`ui-panel-${tone}`, `assets/school/ui/panel-${tone}.png`);
      if (tone !== 'grey') {
        this.load.image(`ui-slot-${tone}`, `assets/school/ui/slot-${tone}.png`);
        this.load.image(`ui-bar-${tone}`, `assets/school/ui/bar-${tone}.png`);
      }
    }
    this.load.image('ui-bar-track', 'assets/school/ui/bar-track.png');

    for (const character of CHARACTERS) {
      this.load.spritesheet(`player-${character.id}`, `assets/school/players/player-${character.id}.png`, {
        frameWidth: 32,
        frameHeight: 32
      });
    }
    for (const friend of FRIEND_SPRITE_IDS) {
      this.load.spritesheet(friend, `assets/school/players/${friend}.png`, {
        frameWidth: 32,
        frameHeight: 32
      });
    }
    // Cute animated monsters: 4x4 grid of 16px frames (col = facing, row = frame).
    for (const enemy of [...ENEMIES, ...ELITES, ...BOSSES]) {
      this.load.spritesheet(`enemy-${enemy.id}`, `assets/school/enemies/${enemy.id}.png`, {
        frameWidth: 16,
        frameHeight: 16
      });
    }
    for (const supply of SCHOOL_SUPPLY_VISUALS) {
      this.load.image(`school-${supply}`, `assets/school/supplies/${supply}.png`);
    }
    this.load.image('xp-gem', 'assets/kenney/sprites/xp-gem.png');
    this.load.image('chest', 'assets/kenney/sprites/chest.png');
    this.load.image('chest-boss', 'assets/kenney/sprites/chest-boss.png');

    this.load.image('school-building', 'assets/school/world/school-building.png');
    this.load.image('school-annex', 'assets/school/world/annex-building.png');
    for (const key of WORLD_IMAGES) {
      this.load.image(`school-${key}`, `assets/school/world/${key}.png`);
    }

    this.load.image('vfx-burst', 'assets/kenney/effects/burst.png');
    this.load.image('vfx-glint', 'assets/kenney/effects/glint.png');
    this.load.image('vfx-critical', 'assets/kenney/effects/critical.png');
    this.load.image('vfx-ring', 'assets/kenney/effects/ring.png');
  }

  create(): void {
    if (this.failedFiles.length > 0 && !this.retriedOnce) {
      this.retriedOnce = true;
      const files = [...this.failedFiles];
      this.failedFiles = [];
      for (const file of files) {
        const config = (file as unknown as { config?: object }).config;
        if (file.type === 'spritesheet') {
          this.load.spritesheet(file.key, file.src, config as Phaser.Types.Loader.FileTypes.ImageFrameConfig);
        } else {
          this.load.image(file.key, file.src);
        }
      }
      this.load.once(Phaser.Loader.Events.COMPLETE, () => this.create());
      this.load.start();
      return;
    }
    this.createUtilityTextures();
    createStudentAnimations(this);
    createStudentAnimations(this, FRIEND_SPRITE_IDS);
    createEnemyAnimations(this, [...ENEMIES, ...ELITES, ...BOSSES].map((enemy) => enemy.id));
    for (const key of [
      ...CHARACTERS.map((character) => `player-${character.id}`),
      ...FRIEND_SPRITE_IDS,
      ...[...ENEMIES, ...ELITES, ...BOSSES].map((enemy) => `enemy-${enemy.id}`),
      ...SCHOOL_SUPPLY_VISUALS.map((supply) => `school-${supply}`),
      ...WORLD_IMAGES.map((key) => `school-${key}`),
      'xp-gem',
      'chest',
      'chest-boss',
      'school-building',
      'school-annex'
    ]) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.scene.start('MainMenuScene');
  }

  private createUtilityTextures(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1).fillCircle(8, 8, 7).generateTexture('projectile', 16, 16).clear();
    graphics.fillStyle(0x65efff, 0.22).fillCircle(12, 12, 11).lineStyle(2, 0xb7f8ff, 1).strokeCircle(12, 12, 7).generateTexture('enemy-projectile', 24, 24).clear();
    graphics.fillStyle(0xffffff, 1).fillRect(0, 0, 4, 4).generateTexture('pixel', 4, 4).destroy();
  }
}
