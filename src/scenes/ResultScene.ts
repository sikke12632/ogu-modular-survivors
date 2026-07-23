import Phaser from 'phaser';
import { getCharacter } from '../data/characters';
import type { RunResult } from '../platform/LocalPlatformGateway';

interface ResultData { result: RunResult }

export class ResultScene extends Phaser.Scene {
  private result!: RunResult;

  constructor() { super('ResultScene'); }

  init(data: ResultData): void { this.result = data.result; }

  create(): void {
    const victory = this.result.victory;
    this.cameras.main.setBackgroundColor(victory ? '#061a22' : '#170a16');
    const graphics = this.add.graphics();
    graphics.lineStyle(1, victory ? 0x34dfea : 0xff5d88, 0.22);
    for (let x = 0; x < 1280; x += 64) graphics.lineBetween(x, 0, x, 720);
    for (let y = 0; y < 720; y += 64) graphics.lineBetween(0, y, 1280, y);
    this.add.text(640, 92, victory ? 'ARENA CLEARED' : 'RUN ENDED', { fontFamily: 'system-ui', fontSize: '22px', fontStyle: 'bold', color: victory ? '#6ef5ff' : '#ff7196', letterSpacing: 5 }).setOrigin(0.5);
    this.add.text(640, 145, victory ? '15분의 군주를 쓰러뜨렸습니다' : '다시 조립하면 더 멀리 갈 수 있어요', { fontFamily: 'system-ui', fontSize: '34px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.add.image(640, 252, `player-${this.result.characterId}`).setScale(2);
    const time = Math.floor(this.result.elapsedMs / 1000);
    const lines = [
      getCharacter(this.result.characterId).name,
      `점수  ${this.result.score.toLocaleString()}`,
      `처치  ${this.result.kills.toLocaleString()}`,
      `레벨  ${this.result.level}`,
      `생존  ${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`
    ];
    this.add.text(640, 346, lines.join('\n'), { fontFamily: 'system-ui', fontSize: '22px', color: '#c9d8ed', align: 'center', lineSpacing: 13 }).setOrigin(0.5, 0);
    this.button(480, 610, '같은 캐릭터로 재도전', 0x176f7e, () => this.scene.start('GameScene', { characterId: this.result.characterId }));
    this.button(800, 610, '메인 메뉴', 0x44367c, () => this.scene.start('MainMenuScene'));
  }

  private button(x: number, y: number, label: string, color: number, action: () => void): void {
    const background = this.add.rectangle(x, y, 286, 64, color, 1).setStrokeStyle(2, 0x8df7ff, 0.75).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontFamily: 'system-ui', fontSize: '18px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    background.on('pointerdown', action);
  }
}
