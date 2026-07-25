import Phaser from 'phaser';
import type { UpgradeChoice } from '../domain/progression/UpgradeDraft';
import { addKenneyPanel, type KenneyTone } from '../ui/KenneyUi';
import { presentUpgrade } from '../ui/UpgradePresentation';
import { playVisualEffect, VFX_COLORS } from '../ui/VisualEffects';
import { SCHOOL_DISPLAY_FONT, SCHOOL_FONT } from '../ui/SchoolArt';
import type { GameScene } from './GameScene';

interface LevelUpData { gameScene: GameScene }

export class LevelUpScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private chosen = false;

  constructor() { super('LevelUpScene'); }

  init(data: LevelUpData): void { this.gameScene = data.gameScene; this.chosen = false; }

  create(): void {
    this.add.rectangle(640, 360, 1_280, 720, 0x29384a, 0.78);
    addKenneyPanel(this, 640, 112, 520, 112, 'orange');
    this.add.text(640, 82, 'LEVEL UP', {
      fontFamily: SCHOOL_FONT, fontSize: '18px', fontStyle: 'bold', color: '#5a3b18', letterSpacing: 4
    }).setOrigin(0.5);
    this.add.text(640, 126, '새 능력을 골라요', {
      fontFamily: SCHOOL_DISPLAY_FONT, fontSize: '32px', color: '#4b3217'
    }).setOrigin(0.5);
    this.add.text(640, 158, `한 번에 ${this.gameScene.upgradeStepCount}단계 성장`, {
      fontFamily: SCHOOL_FONT, fontSize: '15px', fontStyle: 'bold', color: '#71552d'
    }).setOrigin(0.5);
    playVisualEffect(this, 'level-up', 640, 112, VFX_COLORS.orange);

    const choices = this.gameScene.getUpgradeChoices();
    choices.forEach((choice, index) => this.createCard(choice, 244 + index * 396, 390));
  }

  private createCard(choice: UpgradeChoice, x: number, y: number): void {
    const presentation = presentUpgrade(choice);
    const tone: KenneyTone = choice.kind === 'heal' ? 'orange' : choice.isNew ? 'green' : 'blue';
    const background = addKenneyPanel(this, 0, 0, 348, 350, tone);
    const slot = this.add.image(0, -72, `ui-slot-${tone}`).setDisplaySize(92, 92);
    const badge = this.add.text(0, -142, presentation.badge, {
      fontFamily: SCHOOL_FONT, fontSize: '14px', fontStyle: 'bold', color: '#263849'
    }).setOrigin(0.5);
    const icon = this.add.text(0, -74, presentation.icon, {
      fontFamily: SCHOOL_FONT, fontSize: '42px', color: '#29384a'
    }).setOrigin(0.5);
    const title = this.add.text(0, 22, presentation.title, {
      fontFamily: SCHOOL_FONT, fontSize: '26px', fontStyle: 'bold', color: '#263849',
      align: 'center', wordWrap: { width: 288 }
    }).setOrigin(0.5);
    const description = this.add.text(0, 82, presentation.description, {
      fontFamily: SCHOOL_FONT, fontSize: '20px', fontStyle: 'bold', color: '#3b5266',
      align: 'center', wordWrap: { width: 288 }
    }).setOrigin(0.5);
    const guide = this.add.text(0, 132, '눌러서 선택', {
      fontFamily: SCHOOL_FONT, fontSize: '14px', color: '#50687a'
    }).setOrigin(0.5);
    const card = this.add.container(x, y, [background, slot, badge, icon, title, description, guide]);
    card.setSize(348, 350).setInteractive({ useHandCursor: true })
      .on('pointerover', () => card.setScale(1.035))
      .on('pointerout', () => card.setScale(1))
      .on('pointerdown', () => {
        if (this.chosen) return;
        this.chosen = true;
        this.gameScene.selectUpgrade(choice);
        this.scene.resume('GameScene');
        this.scene.stop();
      });
  }
}
