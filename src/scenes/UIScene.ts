import Phaser from 'phaser';
import { eventBus, GameEvents, type HudSnapshot } from '../core/events/EventBus';
import type { JoystickState } from '../systems/InputSystem';
import { addKenneyButton, addKenneyPanel, KenneyBar } from '../ui/KenneyUi';
import type { GameScene } from './GameScene';

interface UISceneData { gameScene: GameScene }

export class UIScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private joystickGraphics!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private ultimateText!: Phaser.GameObjects.Text;
  private hpBar!: KenneyBar;
  private xpBar!: KenneyBar;
  private ultimateBar!: KenneyBar;
  private hud?: HudSnapshot;
  private joystick?: JoystickState;

  constructor() { super('UIScene'); }

  init(data: UISceneData): void { this.gameScene = data.gameScene; }

  create(): void {
    this.joystickGraphics = this.add.graphics();

    addKenneyPanel(this, 190, 62, 340, 100, 'green').setDepth(2);
    this.hpText = this.text(40, 35, '체력', 16, '#263849', true).setDepth(3);
    this.levelText = this.text(40, 76, '레벨', 18, '#263849', true).setDepth(3);
    this.hpBar = new KenneyBar(this, 40, 64, 300, 18, 'green').setDepth(3);

    addKenneyPanel(this, 640, 57, 264, 90, 'blue').setDepth(2);
    this.timerText = this.text(640, 33, '', 28, '#263849', true).setOrigin(0.5).setDepth(3);
    this.scoreText = this.text(640, 69, '', 15, '#3d5368', true).setOrigin(0.5).setDepth(3);

    addKenneyButton(this, 1_222, 40, 76, 48, 'Ⅱ', 'blue', () => this.gameScene.openPause(), 20).setDepth(4);

    const ultimateSlot = this.add.image(1_177, 620, 'ui-slot-orange')
      .setDisplaySize(112, 112)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    ultimateSlot.on('pointerdown', () => this.gameScene.requestUltimate());
    this.ultimateText = this.text(1_177, 610, 'Q\n필살기', 16, '#543918', true).setOrigin(0.5).setDepth(4);
    this.ultimateBar = new KenneyBar(this, 1_121, 680, 112, 12, 'orange').setDepth(4);

    addKenneyPanel(this, 640, 694, 1_264, 44, 'blue').setDepth(2);
    this.xpBar = new KenneyBar(this, 28, 704, 1_224, 12, 'blue').setDepth(3);
    this.text(640, 681, '경험치', 13, '#263849', true).setOrigin(0.5).setDepth(4);

    this.messageText = this.text(640, 170, '', 26, '#ffffff', true)
      .setOrigin(0.5).setAlpha(0).setDepth(50);

    eventBus.on(GameEvents.hud, this.onHud, this);
    eventBus.on(GameEvents.joystick, this.onJoystick, this);
    eventBus.on(GameEvents.message, this.onMessage, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  update(): void {
    if (!this.hud) return;
    const hud = this.hud;
    this.hpText.setText(`체력  ${Math.ceil(hud.hp)} / ${Math.ceil(hud.maxHp)}`);
    this.levelText.setText(`레벨  ${hud.level}`);
    this.hpBar.setValue(hud.hp / hud.maxHp);

    const remaining = Math.max(0, 900_000 - hud.elapsedMs);
    const totalSeconds = Math.ceil(remaining / 1_000);
    this.timerText.setText(`${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`);
    this.scoreText.setText(`점수  ${hud.score.toLocaleString()}`);
    this.xpBar.setValue(hud.xp / hud.xpNext);

    const ready = hud.ultimate >= hud.ultimateMax;
    this.ultimateBar.setValue(hud.ultimate / hud.ultimateMax);
    this.ultimateText
      .setText(ready ? 'Q\n준비 완료!' : 'Q\n필살기')
      .setColor(ready ? '#3c2a12' : '#5b421f')
      .setScale(ready ? 1.08 : 1);

    this.joystickGraphics.clear();
    if (this.joystick?.active) {
      this.joystickGraphics.fillStyle(0x153c65, 0.32).fillCircle(this.joystick.baseX, this.joystick.baseY, 66);
      this.joystickGraphics.lineStyle(4, 0x55cfff, 0.6).strokeCircle(this.joystick.baseX, this.joystick.baseY, 66);
      this.joystickGraphics.fillStyle(0x55cfff, 0.5).fillCircle(this.joystick.knobX, this.joystick.knobY, 27);
    }
  }

  private onHud(hud: HudSnapshot): void { this.hud = hud; }
  private onJoystick(joystick: JoystickState): void { this.joystick = { ...joystick }; }

  private onMessage(payload: { message: string; color: string; durationMs: number }): void {
    this.messageText.setText(payload.message).setColor(payload.color).setAlpha(1).setScale(0.85).setY(170);
    this.tweens.killTweensOf(this.messageText);
    this.tweens.add({ targets: this.messageText, scale: 1, duration: 140 });
    this.tweens.add({
      targets: this.messageText,
      alpha: 0,
      y: 154,
      delay: payload.durationMs,
      duration: 320
    });
  }

  private text(x: number, y: number, value: string, size: number, color: string, bold = false): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, {
      fontFamily: 'system-ui',
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      lineSpacing: 5
    });
  }

  private onShutdown(): void {
    eventBus.off(GameEvents.hud, this.onHud, this);
    eventBus.off(GameEvents.joystick, this.onJoystick, this);
    eventBus.off(GameEvents.message, this.onMessage, this);
  }
}
