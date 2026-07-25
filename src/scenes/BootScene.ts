import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { BOSSES, ELITES, ENEMIES } from '../data/enemies';
import {
  createSchoolSupplyTextures,
  createStudentAnimations,
  schoolEnemyArtFor
} from '../ui/SchoolArt';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload(): void {
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
    for (const enemy of [...ENEMIES, ...ELITES, ...BOSSES]) {
      this.load.image(`enemy-${enemy.id}`, `assets/school/enemies/${schoolEnemyArtFor(enemy)}.png`);
    }
    this.load.image('xp-gem', 'assets/kenney/sprites/xp-gem.png');
    this.load.image('chest', 'assets/kenney/sprites/chest.png');
    this.load.image('chest-boss', 'assets/kenney/sprites/chest-boss.png');

    this.load.image('school-building', 'assets/school/world/school-building.png');
    this.load.image('school-annex', 'assets/school/world/annex-building.png');
    for (const key of ['ground-clean', 'ground-speckle', 'yard-line', 'bench', 'stool', 'locker', 'notice-board']) {
      this.load.image(`school-${key}`, `assets/school/world/${key}.png`);
    }

    this.load.image('vfx-burst', 'assets/kenney/effects/burst.png');
    this.load.image('vfx-glint', 'assets/kenney/effects/glint.png');
    this.load.image('vfx-critical', 'assets/kenney/effects/critical.png');
    this.load.image('vfx-ring', 'assets/kenney/effects/ring.png');
  }

  create(): void {
    this.createUtilityTextures();
    createSchoolSupplyTextures(this);
    createStudentAnimations(this);
    for (const key of [
      ...CHARACTERS.map((character) => `player-${character.id}`),
      ...[...ENEMIES, ...ELITES, ...BOSSES].map((enemy) => `enemy-${enemy.id}`),
      'xp-gem',
      'chest',
      'chest-boss',
      'school-building',
      'school-annex',
      'school-ground-clean',
      'school-ground-speckle',
      'school-yard-line',
      'school-bench',
      'school-stool',
      'school-locker',
      'school-notice-board'
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
