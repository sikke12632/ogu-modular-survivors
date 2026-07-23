import Phaser from 'phaser';
import type { GameScene } from './GameScene';

interface TreasureData { gameScene: GameScene; bossChest: boolean }

export class TreasureScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private bossChest = false;

  constructor() { super('TreasureScene'); }

  init(data: TreasureData): void { this.gameScene = data.gameScene; this.bossChest = data.bossChest; }

  create(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x020812, 0.9);
    const rays = this.add.graphics();
    for (let index = 0; index < 24; index += 1) {
      rays.lineStyle(index % 2 ? 2 : 5, index % 2 ? 0xffdc62 : 0x6ef5ff, 0.22);
      const angle = index / 24 * Math.PI * 2;
      rays.lineBetween(640 + Math.cos(angle) * 70, 300 + Math.sin(angle) * 70, 640 + Math.cos(angle) * 330, 300 + Math.sin(angle) * 330);
    }
    this.add.image(640, 280, 'chest').setScale(2.5);
    const reward = this.gameScene.claimTreasure();
    this.add.text(640, 96, this.bossChest ? 'BOSS TREASURE' : 'TREASURE SIGNAL', { fontFamily: 'system-ui', fontSize: '20px', fontStyle: 'bold', color: '#ffe06d', letterSpacing: 4 }).setOrigin(0.5);
    this.add.text(640, 420, reward.title, { fontFamily: 'system-ui', fontSize: '40px', fontStyle: 'bold', color: reward.evolved ? '#ffe06d' : '#ffffff' }).setOrigin(0.5);
    this.add.text(640, 474, reward.description, { fontFamily: 'system-ui', fontSize: '18px', color: '#bed0e9', align: 'center', wordWrap: { width: 700 } }).setOrigin(0.5);
    const button = this.add.rectangle(640, 574, 300, 64, 0x176f7e, 1).setStrokeStyle(2, 0x8df7ff).setInteractive({ useHandCursor: true });
    this.add.text(640, 574, '전투로 복귀', { fontFamily: 'system-ui', fontSize: '22px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    button.on('pointerdown', () => { this.scene.resume('GameScene'); this.scene.stop(); });
  }
}
