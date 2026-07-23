import Phaser from 'phaser';

export type ProjectileKind = 'normal' | 'homing' | 'boomerang';

export class ProjectileSprite extends Phaser.Physics.Arcade.Sprite {
  damage = 1;
  pierce = 0;
  lifeMs = 0;
  maxLifeMs = 0;
  kind: ProjectileKind = 'normal';
  sourceX = 0;
  sourceY = 0;
  targetUid?: number;
  returnAt = 0;
  hitIds = new Set<number>();

  constructor(scene: Phaser.Scene, x: number, y: number, texture = 'projectile') {
    super(scene, x, y, texture);
  }

  activate(config: {
    x: number; y: number; angle: number; speed: number; damage: number; pierce: number;
    lifeMs: number; color: number; radius: number; kind?: ProjectileKind; targetUid?: number;
  }): this {
    this.enableBody(true, config.x, config.y, true, true);
    this.setTexture('projectile').setTint(config.color).setDisplaySize(config.radius * 2, config.radius * 2);
    this.setCircle(7).setVelocity(Math.cos(config.angle) * config.speed, Math.sin(config.angle) * config.speed);
    this.damage = config.damage;
    this.pierce = config.pierce;
    this.lifeMs = config.lifeMs;
    this.maxLifeMs = config.lifeMs;
    this.kind = config.kind ?? 'normal';
    this.sourceX = config.x;
    this.sourceY = config.y;
    this.targetUid = config.targetUid;
    this.returnAt = config.lifeMs * 0.5;
    this.hitIds.clear();
    return this;
  }

  retire(): void {
    this.disableBody(true, true);
    this.hitIds.clear();
  }
}
