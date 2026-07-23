import Phaser from 'phaser';
import type { UpgradeChoice } from '../domain/progression/UpgradeDraft';
import type { GameScene } from './GameScene';

interface LevelUpData { gameScene: GameScene }

export class LevelUpScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private chosen = false;

  constructor() { super('LevelUpScene'); }

  init(data: LevelUpData): void { this.gameScene = data.gameScene; this.chosen = false; }

  create(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x020812, 0.9);
    this.add.text(640, 92, 'LEVEL UP', { fontFamily: 'system-ui', fontSize: '22px', fontStyle: 'bold', color: '#6ef5ff', letterSpacing: 5 }).setOrigin(0.5);
    this.add.text(640, 136, '새 모듈을 선택하세요', { fontFamily: 'system-ui', fontSize: '38px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    const choices = this.gameScene.getUpgradeChoices();
    choices.forEach((choice, index) => this.createCard(choice, 244 + index * 396, 246));
  }

  private createCard(choice: UpgradeChoice, x: number, y: number): void {
    const background = this.add.rectangle(0, 0, 348, 330, 0x102038, 0.98).setStrokeStyle(3, choice.isNew ? 0x68f3a4 : 0x51ddff);
    const badge = this.add.text(0, -125, choice.isNew ? 'NEW' : 'UPGRADE', { fontFamily: 'system-ui', fontSize: '13px', fontStyle: 'bold', color: choice.isNew ? '#68f3a4' : '#7feeff', backgroundColor: '#07111f', padding: { x: 10, y: 5 } }).setOrigin(0.5);
    const icon = this.add.text(0, -60, choice.icon, { fontFamily: 'system-ui', fontSize: '58px', color: '#ffffff' }).setOrigin(0.5);
    const title = this.add.text(0, 20, choice.title, { fontFamily: 'system-ui', fontSize: '24px', fontStyle: 'bold', color: '#ffffff', align: 'center', wordWrap: { width: 300 } }).setOrigin(0.5);
    const description = this.add.text(0, 86, choice.description, { fontFamily: 'system-ui', fontSize: '16px', color: '#b8c9df', align: 'center', wordWrap: { width: 292 } }).setOrigin(0.5);
    const card = this.add.container(x + 174, y + 165, [background, badge, icon, title, description]);
    card.setSize(348, 330).setInteractive({ useHandCursor: true }).on('pointerover', () => { background.setFillStyle(0x18314f); card.setScale(1.025); }).on('pointerout', () => { background.setFillStyle(0x102038); card.setScale(1); }).on('pointerdown', () => {
      if (this.chosen) return;
      this.chosen = true;
      this.gameScene.selectUpgrade(choice);
      this.scene.resume('GameScene');
      this.scene.stop();
    });
  }
}
