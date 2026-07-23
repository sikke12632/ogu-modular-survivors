import Phaser from 'phaser';

export interface MovementIntent { x: number; y: number }
export interface JoystickState { active: boolean; baseX: number; baseY: number; knobX: number; knobY: number }

export class InputSystem {
  readonly movement: MovementIntent = { x: 0, y: 0 };
  readonly joystick: JoystickState = { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0 };
  ultimateRequested = false;
  pauseRequested = false;

  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'ultimate' | 'pause', Phaser.Input.Keyboard.Key>;
  private pointerId?: number;
  private readonly deadZone = 12;
  private readonly maxRadius = 64;

  constructor(private readonly scene: Phaser.Scene) {}

  create(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is unavailable');
    this.keys = keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP, down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT, right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W, a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S, d: Phaser.Input.Keyboard.KeyCodes.D,
      ultimate: Phaser.Input.Keyboard.KeyCodes.Q, pause: Phaser.Input.Keyboard.KeyCodes.ESC
    }) as typeof this.keys;
    this.scene.input.addPointer(2);
    this.scene.input.on('pointerdown', this.onPointerDown, this);
    this.scene.input.on('pointermove', this.onPointerMove, this);
    this.scene.input.on('pointerup', this.onPointerUp, this);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update(): void {
    let x = 0;
    let y = 0;
    if (this.keys.left.isDown || this.keys.a.isDown) x -= 1;
    if (this.keys.right.isDown || this.keys.d.isDown) x += 1;
    if (this.keys.up.isDown || this.keys.w.isDown) y -= 1;
    if (this.keys.down.isDown || this.keys.s.isDown) y += 1;
    if (x !== 0 || y !== 0) {
      const length = Math.hypot(x, y);
      this.movement.x = x / length;
      this.movement.y = y / length;
    } else if (!this.joystick.active) {
      this.movement.x = 0;
      this.movement.y = 0;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.ultimate)) this.ultimateRequested = true;
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) this.pauseRequested = true;
  }

  consumeUltimate(): boolean {
    const requested = this.ultimateRequested;
    this.ultimateRequested = false;
    return requested;
  }

  consumePause(): boolean {
    const requested = this.pauseRequested;
    this.pauseRequested = false;
    return requested;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    if (pointer.x > width * 0.72 && pointer.y > height * 0.62) {
      this.ultimateRequested = true;
      return;
    }
    if (pointer.x > width * 0.55 || this.joystick.active) return;
    this.pointerId = pointer.id;
    Object.assign(this.joystick, { active: true, baseX: pointer.x, baseY: pointer.y, knobX: pointer.x, knobY: pointer.y });
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.joystick.active || pointer.id !== this.pointerId) return;
    const dx = pointer.x - this.joystick.baseX;
    const dy = pointer.y - this.joystick.baseY;
    const distance = Math.hypot(dx, dy);
    const capped = Math.min(this.maxRadius, distance);
    const angle = Math.atan2(dy, dx);
    this.joystick.knobX = this.joystick.baseX + Math.cos(angle) * capped;
    this.joystick.knobY = this.joystick.baseY + Math.sin(angle) * capped;
    if (distance > this.deadZone) {
      this.movement.x = Math.cos(angle) * Math.min(1, distance / this.maxRadius);
      this.movement.y = Math.sin(angle) * Math.min(1, distance / this.maxRadius);
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.pointerId = undefined;
    this.joystick.active = false;
    this.movement.x = 0;
    this.movement.y = 0;
  }

  private destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
  }
}
