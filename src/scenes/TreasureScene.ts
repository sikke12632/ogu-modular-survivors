import Phaser from 'phaser';
import { addKenneyButton, addKenneyPanel } from '../ui/KenneyUi';
import { playVisualEffect, VFX_COLORS } from '../ui/VisualEffects';
import type { GameScene } from './GameScene';

interface TreasureData { gameScene: GameScene; bossChest: boolean }

export class TreasureScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private bossChest = false;

  constructor() { super('TreasureScene'); }

  init(data: TreasureData): void {
    this.gameScene = data.gameScene;
    this.bossChest = data.bossChest;
  }

  create(): void {
    this.add.rectangle(640, 360, 1_280, 720, 0x061326, 0.9);
    addKenneyPanel(this, 640, 360, 680, 560, 'orange');
    playVisualEffect(this, 'pickup', 640, 260, VFX_COLORS.orange);
    this.add.image(640, 258, this.bossChest ? 'chest-boss' : 'chest').setDisplaySize(128, 128).setDepth(36);

    const reward = this.gameScene.claimTreasure(this.bossChest);
    this.add.text(640, 105, this.bossChest ? '보스 보물' : '아이템 획득', {
      fontFamily: 'system-ui', fontSize: '24px', fontStyle: 'bold', color: '#523719', letterSpacing: 3
    }).setOrigin(0.5);
    this.add.text(640, 390, reward.title, {
      fontFamily: 'system-ui', fontSize: '38px', fontStyle: 'bold', color: '#4b3217'
    }).setOrigin(0.5);
    this.add.text(640, 452, this.shortDescription(reward), {
      fontFamily: 'system-ui', fontSize: '22px', fontStyle: 'bold', color: '#654820',
      align: 'center', wordWrap: { width: 560 }
    }).setOrigin(0.5);
    addKenneyButton(this, 640, 566, 300, 66, '전투로 돌아가기', 'green', () => {
      this.scene.resume('GameScene');
      this.scene.stop();
    }, 21);
  }

  private shortDescription(reward: { title: string; evolved: boolean }): string {
    if (reward.evolved) return '최종 형태로 진화';
    if (reward.title.includes('보급')) return '체력을 크게 채움';
    return '무기가 더 강해짐';
  }
}
