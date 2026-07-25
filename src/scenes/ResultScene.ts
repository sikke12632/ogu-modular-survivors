import Phaser from 'phaser';
import { getCharacter } from '../data/characters';
import type { RunResult } from '../platform/LocalPlatformGateway';
import { addKenneyButton, addKenneyPanel } from '../ui/KenneyUi';

interface ResultData { result: RunResult }

export class ResultScene extends Phaser.Scene {
  private result!: RunResult;

  constructor() { super('ResultScene'); }

  init(data: ResultData): void { this.result = data.result; }

  getRunResult(): Readonly<RunResult> {
    return this.result;
  }

  create(): void {
    const victory = this.result.victory;
    this.cameras.main.setBackgroundColor('#07162c');
    const graphics = this.add.graphics();
    graphics.lineStyle(1, victory ? 0x55cfff : 0xffa13d, 0.2);
    for (let x = 0; x < 1_280; x += 64) graphics.lineBetween(x, 0, x, 720);
    for (let y = 0; y < 720; y += 64) graphics.lineBetween(0, y, 1_280, y);

    addKenneyPanel(this, 640, 340, 660, 530, victory ? 'green' : 'orange');
    this.add.text(640, 92, victory ? 'ARENA CLEARED' : 'RUN ENDED', {
      fontFamily: 'system-ui', fontSize: '20px', fontStyle: 'bold',
      color: '#263849', letterSpacing: 5
    }).setOrigin(0.5);
    this.add.text(640, 138, victory ? '멋지게 살아남았어요!' : '다음 판은 더 강해져요!', {
      fontFamily: 'system-ui', fontSize: '32px', fontStyle: 'bold',
      color: '#263849'
    }).setOrigin(0.5);
    this.add.image(640, 238, `player-${this.result.characterId}`).setDisplaySize(104, 104);

    const time = Math.floor(this.result.elapsedMs / 1_000);
    const lines = [
      getCharacter(this.result.characterId).name,
      `점수  ${this.result.score.toLocaleString()}`,
      `처치  ${this.result.kills.toLocaleString()}`,
      `레벨  ${this.result.level}`,
      `생존  ${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`
    ];
    this.add.text(640, 310, lines.join('\n'), {
      fontFamily: 'system-ui', fontSize: '21px', fontStyle: 'bold',
      color: '#34495e', align: 'center', lineSpacing: 12
    }).setOrigin(0.5, 0);

    addKenneyButton(this, 480, 622, 286, 64, '같은 캐릭터로 재도전', 'green', () => {
      this.scene.start('GameScene', { characterId: this.result.characterId });
    }, 17);
    addKenneyButton(this, 800, 622, 286, 64, '메인 메뉴', 'blue', () => {
      this.scene.start('MainMenuScene');
    }, 18);
  }
}
