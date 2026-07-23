import Phaser from 'phaser';
import { sfx } from '../audio/ProceduralSfx';
import type { GameScene } from './GameScene';

interface PauseData { gameScene: GameScene }

export class PauseScene extends Phaser.Scene {
  private gameScene!: GameScene;

  constructor() { super('PauseScene'); }

  init(data: PauseData): void { this.gameScene = data.gameScene; }

  create(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x020812, 0.86);
    this.add.rectangle(640, 360, 520, 550, 0x0b1729, 0.98).setStrokeStyle(2, 0x5eeeff);
    this.add.text(640, 130, '일시정지', { fontFamily: 'system-ui', fontSize: '42px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.button(640, 236, '계속하기', 0x176f7e, () => this.resume());
    this.button(640, 316, `소리 ${sfx.enabled ? '켜짐' : '꺼짐'}`, 0x293f62, (label) => {
      sfx.enabled = !sfx.enabled;
      localStorage.setItem('ogu-sound', sfx.enabled ? 'on' : 'off');
      label.setText(`소리 ${sfx.enabled ? '켜짐' : '꺼짐'}`);
    });
    this.button(640, 396, '저장하고 메인으로', 0x44367c, () => { this.scene.stop(); void this.gameScene.saveAndExit(); });
    this.button(640, 476, '처음부터 다시', 0x6f4d24, () => { this.scene.stop(); this.gameScene.restartRun(); });
    this.button(640, 556, '현재 판 포기', 0x6f2536, () => { this.scene.stop(); void this.gameScene.abandonRun(); });
    this.input.keyboard?.once('keydown-ESC', () => this.resume());
  }

  private resume(): void { this.scene.resume('GameScene'); this.scene.stop(); }

  private button(x: number, y: number, labelText: string, color: number, action: (label: Phaser.GameObjects.Text) => void): void {
    const background = this.add.rectangle(x, y, 390, 58, color, 1).setStrokeStyle(1, 0x7ceeff, 0.7).setInteractive({ useHandCursor: true });
    const label = this.add.text(x, y, labelText, { fontFamily: 'system-ui', fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    background.on('pointerdown', () => action(label));
  }
}
