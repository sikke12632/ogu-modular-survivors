import Phaser from 'phaser';
import { sfx } from '../audio/ProceduralSfx';
import { addKenneyButton, addKenneyPanel, type KenneyTone } from '../ui/KenneyUi';
import { SCHOOL_FONT } from '../ui/SchoolArt';
import type { GameScene } from './GameScene';

interface PauseData { gameScene: GameScene }

export class PauseScene extends Phaser.Scene {
  private gameScene!: GameScene;

  constructor() { super('PauseScene'); }

  init(data: PauseData): void { this.gameScene = data.gameScene; }

  create(): void {
    this.add.rectangle(640, 360, 1_280, 720, 0x29384a, 0.76);
    addKenneyPanel(this, 640, 360, 540, 584, 'blue');
    this.add.text(640, 112, '잠시 쉬어요', {
      fontFamily: SCHOOL_FONT, fontSize: '40px', fontStyle: 'bold', color: '#263849'
    }).setOrigin(0.5);
    this.add.text(640, 154, 'ESC를 누르면 바로 돌아가요', {
      fontFamily: SCHOOL_FONT, fontSize: '16px', fontStyle: 'bold', color: '#435b70'
    }).setOrigin(0.5);

    this.button(640, 226, '계속하기', 'green', () => this.resume());
    this.button(640, 306, `소리 ${sfx.enabled ? '켜짐' : '꺼짐'}`, 'blue', (label) => {
      sfx.enabled = !sfx.enabled;
      localStorage.setItem('ogu-sound', sfx.enabled ? 'on' : 'off');
      label.setText(`소리 ${sfx.enabled ? '켜짐' : '꺼짐'}`);
    });
    this.button(640, 386, '저장하고 메인으로', 'blue', () => {
      this.scene.stop();
      void this.gameScene.saveAndExit();
    });
    this.button(640, 466, '처음부터 다시', 'orange', () => {
      this.scene.stop();
      this.gameScene.restartRun();
    });
    this.button(640, 546, '현재 판 끝내기', 'orange', () => {
      this.scene.stop();
      void this.gameScene.abandonRun();
    });
    this.input.keyboard?.once('keydown-ESC', () => this.resume());
  }

  private resume(): void {
    this.scene.resume('GameScene');
    this.scene.stop();
  }

  private button(
    x: number,
    y: number,
    labelText: string,
    tone: KenneyTone,
    action: (label: Phaser.GameObjects.Text) => void
  ): void {
    addKenneyButton(this, x, y, 390, 60, labelText, tone, action, 20);
  }
}
