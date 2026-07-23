import Phaser from 'phaser';
import type { EnemyDefinition } from '../data/enemies';

export class EnemySprite extends Phaser.Physics.Arcade.Sprite {
  uid = 0;
  definition?: EnemyDefinition;
  hp = 1;
  maxHp = 1;
  attackCooldownMs = 0;
  specialCooldownMs = 0;
  state: 'chase' | 'telegraph' | 'dash' | 'recover' = 'chase';
  stateTimerMs = 0;
  phase = 1;
  slowUntil = 0;
  dashX = 0;
  dashY = 0;
  spawnedAdds = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture = 'pixel') {
    super(scene, x, y, texture);
  }

  activate(uid: number, definition: EnemyDefinition, hpScale: number, damageScale: number): this {
    this.enableBody(true, this.x, this.y, true, true);
    this.uid = uid;
    this.definition = { ...definition, damage: definition.damage * damageScale };
    this.hp = definition.hp * hpScale;
    this.maxHp = this.hp;
    this.attackCooldownMs = 600 + Math.random() * 700;
    this.specialCooldownMs = 1_800 + Math.random() * 1_200;
    this.state = 'chase';
    this.stateTimerMs = 0;
    this.phase = 1;
    this.slowUntil = 0;
    this.spawnedAdds = 0;
    this.setTexture(`enemy-${definition.id}`).setActive(true).setVisible(true).setAlpha(1).setScale(1);
    this.setDataEnabled();
    return this;
  }

  retire(): void {
    this.disableBody(true, true);
    this.definition = undefined;
  }
}
