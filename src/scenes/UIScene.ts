import Phaser from 'phaser';
import { eventBus, GameEvents, type HudSnapshot } from '../core/events/EventBus';
import type { JoystickState } from '../systems/InputSystem';
import type { GameScene } from './GameScene';

interface UISceneData { gameScene: GameScene }

export class UIScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private graphics!: Phaser.GameObjects.Graphics;
  private joystickGraphics!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private missionText!: Phaser.GameObjects.Text;
  private weaponsText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private performanceText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private ultimateText!: Phaser.GameObjects.Text;
  private hud?: HudSnapshot;
  private joystick?: JoystickState;

  constructor() { super('UIScene'); }

  init(data: UISceneData): void { this.gameScene = data.gameScene; }

  create(): void {
    this.graphics = this.add.graphics();
    this.joystickGraphics = this.add.graphics();
    this.hpText = this.text(34, 38, '', 15, '#ffffff');
    this.levelText = this.text(34, 89, '', 17, '#7df8ff', true);
    this.timerText = this.text(640, 28, '', 30, '#ffffff', true).setOrigin(0.5, 0);
    this.scoreText = this.text(640, 66, '', 15, '#b8cae7').setOrigin(0.5, 0);
    this.comboText = this.text(640, 116, '', 30, '#ffe271', true).setOrigin(0.5).setAlpha(0);
    this.missionText = this.text(34, 128, '', 15, '#b7f8ff').setDepth(3);
    this.weaponsText = this.text(1_010, 100, '', 14, '#dce8ff').setDepth(3);
    this.bossText = this.text(640, 616, '', 16, '#ffffff', true).setOrigin(0.5).setDepth(3);
    this.performanceText = this.text(1_010, 44, '', 12, '#7790b3');
    this.messageText = this.text(640, 190, '', 24, '#ffffff', true).setOrigin(0.5).setAlpha(0).setDepth(5);
    this.ultimateText = this.text(1_173, 621, 'Q\n필살기', 15, '#ffffff', true).setOrigin(0.5).setDepth(4);

    const pause = this.add.rectangle(1_222, 42, 72, 42, 0x172a44, 0.92).setStrokeStyle(1, 0x7ceeff).setInteractive({ useHandCursor: true });
    this.add.text(1_222, 42, 'Ⅱ', { fontFamily: 'system-ui', fontSize: '21px', color: '#ffffff' }).setOrigin(0.5);
    pause.on('pointerdown', () => this.gameScene.openPause());
    const ultimateZone = this.add.circle(1_173, 621, 64, 0x233d66, 0.18).setStrokeStyle(3, 0x6f85ad).setInteractive({ useHandCursor: true });
    ultimateZone.on('pointerdown', () => this.gameScene.requestUltimate());

    eventBus.on(GameEvents.hud, this.onHud, this);
    eventBus.on(GameEvents.joystick, this.onJoystick, this);
    eventBus.on(GameEvents.message, this.onMessage, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  update(): void {
    if (!this.hud) return;
    const hud = this.hud;
    this.graphics.clear();
    this.panel(22, 22, 338, 92);
    this.bar(34, 58, 310, 20, hud.hp / hud.maxHp, 0x42f59e, 0xff5470);
    this.hpText.setText(`HP ${Math.ceil(hud.hp)} / ${Math.ceil(hud.maxHp)}`);
    this.levelText.setText(`LV.${hud.level}`);
    const remaining = Math.max(0, 900_000 - hud.elapsedMs);
    const totalSeconds = Math.ceil(remaining / 1000);
    this.timerText.setText(`${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`);
    this.scoreText.setText(`SCORE ${hud.score.toLocaleString()}`);
    this.comboText.setText(hud.combo >= 2 ? `${hud.combo} COMBO` : '').setAlpha(hud.combo >= 2 ? 1 : 0);
    this.panel(22, 120, 390, 72, hud.mission ? 0.9 : 0.42);
    if (hud.mission) {
      const isTimed = hud.mission.goal > 1000;
      const progress = isTimed ? `${Math.floor(hud.mission.progress / 1000)} / ${Math.floor(hud.mission.goal / 1000)}초` : `${Math.floor(hud.mission.progress)} / ${hud.mission.goal}`;
      this.missionText.setText(`${hud.mission.title}\n${progress} · ${Math.ceil(hud.mission.timeLeftMs / 1000)}초 남음`);
      this.bar(36, 172, 360, 6, hud.mission.progress / hud.mission.goal, 0x6ef5ff, 0x6ef5ff);
    } else this.missionText.setText('다음 미션 신호를 기다리는 중…');

    this.panel(995, 88, 255, 190, 0.78);
    this.weaponsText.setText(['무기 모듈', ...hud.weapons.map((weapon) => `${weapon.evolved ? '★' : '•'} ${weapon.name}  Lv.${weapon.level}`)].join('\n'));
    this.performanceText.setText(`FPS ${hud.fps} · 적 ${hud.enemies} · ${hud.quality.toUpperCase()}`);
    this.bar(1_109, 670, 128, 9, hud.ultimate / hud.ultimateMax, 0xffe36b, 0x8e5cff);
    const ultimateReady = hud.ultimate >= hud.ultimateMax;
    this.graphics.lineStyle(ultimateReady ? 6 : 3, ultimateReady ? 0xffe36b : 0x657b9e, ultimateReady ? 0.95 : 0.55).strokeCircle(1_173, 621, 64);
    this.graphics.fillStyle(ultimateReady ? 0xffdd63 : 0x14243d, ultimateReady ? 0.18 : 0.1).fillCircle(1_173, 621, 60);
    this.ultimateText.setColor(ultimateReady ? '#ffe36b' : '#ffffff').setText(ultimateReady ? 'Q\nREADY' : `Q\n${Math.floor(hud.ultimate / hud.ultimateMax * 100)}%`);

    this.bar(0, 705, 1_280, 15, hud.xp / hud.xpNext, 0x29d6ff, 0x935eff);
    if (hud.boss) {
      this.panel(330, 592, 620, 56, 0.9);
      this.bossText.setText(`${hud.boss.name} · PHASE ${hud.boss.phase}`);
      this.bar(354, 632, 572, 10, hud.boss.hp / hud.boss.maxHp, 0xff456e, 0xffbb58);
    } else this.bossText.setText('');

    this.joystickGraphics.clear();
    if (this.joystick?.active) {
      this.joystickGraphics.fillStyle(0x07111f, 0.35).fillCircle(this.joystick.baseX, this.joystick.baseY, 66);
      this.joystickGraphics.lineStyle(3, 0x6ef5ff, 0.45).strokeCircle(this.joystick.baseX, this.joystick.baseY, 66);
      this.joystickGraphics.fillStyle(0x6ef5ff, 0.35).fillCircle(this.joystick.knobX, this.joystick.knobY, 27);
    }
  }

  private onHud(hud: HudSnapshot): void { this.hud = hud; }
  private onJoystick(joystick: JoystickState): void { this.joystick = { ...joystick }; }
  private onMessage(payload: { message: string; color: string; durationMs: number }): void {
    this.messageText.setText(payload.message).setColor(payload.color).setAlpha(1).setScale(0.85);
    this.tweens.killTweensOf(this.messageText);
    this.tweens.add({ targets: this.messageText, scale: 1, duration: 140, yoyo: false });
    this.tweens.add({ targets: this.messageText, alpha: 0, y: 174, delay: payload.durationMs, duration: 320, onComplete: () => this.messageText.setY(190) });
  }

  private panel(x: number, y: number, width: number, height: number, alpha = 0.82): void {
    this.graphics.fillStyle(0x07111f, alpha).fillRoundedRect(x, y, width, height, 12);
    this.graphics.lineStyle(1, 0x3fcfea, 0.42).strokeRoundedRect(x, y, width, height, 12);
  }

  private bar(x: number, y: number, width: number, height: number, ratio: number, colorA: number, colorB: number): void {
    this.graphics.fillStyle(0x111d31, 0.94).fillRoundedRect(x, y, width, height, height / 2);
    const safe = Phaser.Math.Clamp(ratio, 0, 1);
    if (safe > 0) this.graphics.fillGradientStyle(colorA, colorB, colorA, colorB, 1).fillRoundedRect(x, y, Math.max(height, width * safe), height, height / 2);
  }

  private text(x: number, y: number, value: string, size: number, color: string, bold = false): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, { fontFamily: 'system-ui', fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color, lineSpacing: 6 });
  }

  private onShutdown(): void {
    eventBus.off(GameEvents.hud, this.onHud, this);
    eventBus.off(GameEvents.joystick, this.onJoystick, this);
    eventBus.off(GameEvents.message, this.onMessage, this);
  }
}
