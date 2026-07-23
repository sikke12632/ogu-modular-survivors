import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { BOSSES, ELITES, ENEMIES } from '../data/enemies';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create(): void {
    this.createPlayerTextures();
    this.createEnemyTextures();
    this.createUtilityTextures();
    this.scene.start('MainMenuScene');
  }

  private createPlayerTextures(): void {
    for (const character of CHARACTERS) {
      const graphics = this.add.graphics();
      graphics.fillStyle(character.color, 0.18).fillCircle(32, 32, 30);
      graphics.lineStyle(4, character.color, 1).strokeCircle(32, 32, 23);
      graphics.fillStyle(character.accent, 1).fillCircle(32, 32, 18);
      graphics.fillStyle(0xffffff, 1).fillCircle(25, 28, 3).fillCircle(39, 28, 3);
      graphics.lineStyle(3, 0xffffff, 1).beginPath().arc(32, 34, 9, 0.2, Math.PI - 0.2).strokePath();
      if (character.id === 'guardian') graphics.lineStyle(4, 0xffffff, 0.9).strokeRoundedRect(19, 13, 26, 35, 10);
      if (character.id === 'ranger') graphics.fillStyle(0xffffff, 0.9).fillTriangle(32, 8, 25, 20, 39, 20);
      if (character.id === 'mystic') graphics.lineStyle(3, 0xffffff, 0.9).strokeCircle(32, 32, 28);
      graphics.generateTexture(`player-${character.id}`, 64, 64).destroy();
    }
  }

  private createEnemyTextures(): void {
    for (const enemy of [...ENEMIES, ...ELITES, ...BOSSES]) {
      const size = enemy.boss ? 144 : enemy.elite ? 80 : 56;
      const center = size / 2;
      const graphics = this.add.graphics();
      graphics.fillStyle(enemy.color, 0.22).fillCircle(center, center, center - 2);
      graphics.lineStyle(enemy.boss ? 7 : enemy.elite ? 5 : 3, enemy.accent, 1).strokeCircle(center, center, center - 6);
      if (enemy.role === 'runner' || enemy.role === 'charger') {
        graphics.fillStyle(enemy.color, 1).fillTriangle(center, 7, size - 8, size - 9, 8, size - 9);
      } else if (enemy.role === 'tank' || enemy.role === 'blocker') {
        graphics.fillStyle(enemy.color, 1).fillRoundedRect(9, 9, size - 18, size - 18, 8);
      } else {
        graphics.fillStyle(enemy.color, 1).fillCircle(center, center, center - 13);
      }
      if (enemy.ranged) graphics.lineStyle(3, enemy.accent, 1).strokeCircle(center, center, center - 18);
      graphics.fillStyle(0xffffff, 0.9).fillCircle(center - size * 0.12, center - 4, Math.max(2, size * 0.04)).fillCircle(center + size * 0.12, center - 4, Math.max(2, size * 0.04));
      graphics.generateTexture(`enemy-${enemy.id}`, size, size).destroy();
    }
  }

  private createUtilityTextures(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1).fillCircle(8, 8, 7).generateTexture('projectile', 16, 16).clear();
    graphics.fillStyle(0x65efff, 0.22).fillCircle(12, 12, 11).lineStyle(2, 0xb7f8ff, 1).strokeCircle(12, 12, 7).generateTexture('enemy-projectile', 24, 24).clear();
    graphics.fillStyle(0x5ef5ff, 1).fillTriangle(10, 0, 20, 10, 10, 20).fillTriangle(10, 20, 0, 10, 10, 0).generateTexture('xp-gem', 20, 20).clear();
    graphics.fillStyle(0x9b6b24, 1).fillRoundedRect(2, 8, 44, 34, 5).fillStyle(0xffd85a, 1).fillRect(2, 18, 44, 5).fillRect(20, 8, 8, 34).lineStyle(3, 0xffef9d, 1).strokeRoundedRect(2, 8, 44, 34, 5).generateTexture('chest', 48, 48).clear();
    graphics.fillStyle(0xffffff, 1).fillRect(0, 0, 4, 4).generateTexture('pixel', 4, 4).destroy();
  }
}
