import Phaser from 'phaser';
import { getCharacter } from '../data/characters';
import { getRunMode } from '../data/runModes';
import type { RunResult } from '../platform/LocalPlatformGateway';
import { addKenneyButton, addKenneyPanel } from '../ui/KenneyUi';
import { SCHOOL_DISPLAY_FONT, SCHOOL_FONT, SCHOOL_PALETTE } from '../ui/SchoolArt';

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
    this.cameras.main.setBackgroundColor('#78c7e3');
    this.add.tileSprite(640, 515, 1_280, 410, 'school-ground-speckle')
      .setTileScale(3.5)
      .setTint(0xf1bd80)
      .setDepth(-2);
    const graphics = this.add.graphics();
    graphics.setDepth(-1);
    graphics.fillStyle(SCHOOL_PALETTE.cloud, 0.82)
      .fillCircle(120, 80, 30).fillCircle(158, 66, 44).fillCircle(198, 80, 28);
    graphics.lineStyle(5, SCHOOL_PALETTE.chalk, 0.65).strokeRoundedRect(34, 324, 1_212, 354, 20);

    addKenneyPanel(this, 640, 340, 660, 530, victory ? 'green' : 'orange');
    this.add.text(640, 92, victory ? 'ARENA CLEARED' : 'RUN ENDED', {
      fontFamily: SCHOOL_FONT, fontSize: '20px', fontStyle: 'bold',
      color: '#263849', letterSpacing: 5
    }).setOrigin(0.5);
    this.add.text(640, 138, victory ? '멋지게 살아남았어요!' : '다음 판은 더 강해져요!', {
      fontFamily: SCHOOL_DISPLAY_FONT, fontSize: '32px',
      color: '#263849'
    }).setOrigin(0.5);
    const portrait = this.add.sprite(640, 238, `player-${this.result.characterId}`, 0).setDisplaySize(112, 112);
    portrait.play(`player-${this.result.characterId}-walk-down`);

    const time = Math.floor(this.result.elapsedMs / 1_000);
    const mode = getRunMode(this.result.modeId);
    const lines = [
      getCharacter(this.result.characterId).name,
      `${mode.label} 완료`,
      `점수  ${this.result.score.toLocaleString()}`,
      `처치  ${this.result.kills.toLocaleString()}`,
      `레벨  ${this.result.level}`,
      `생존  ${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`
    ];
    this.add.text(640, 310, lines.join('\n'), {
      fontFamily: SCHOOL_FONT, fontSize: '21px', fontStyle: 'bold',
      color: '#34495e', align: 'center', lineSpacing: 12
    }).setOrigin(0.5, 0);

    addKenneyButton(this, 480, 622, 286, 64, '같은 모드로 재도전', 'green', () => {
      this.scene.start('GameScene', { characterId: this.result.characterId, modeId: this.result.modeId });
    }, 17);
    addKenneyButton(this, 800, 622, 286, 64, '메인 메뉴', 'blue', () => {
      this.scene.start('MainMenuScene');
    }, 18);
  }
}
