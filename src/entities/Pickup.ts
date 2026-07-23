import Phaser from 'phaser';

export class PickupSprite extends Phaser.Physics.Arcade.Sprite {
  value = 1;
  pickupType: 'xp' | 'chest' = 'xp';
  bossChest = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture = 'xp-gem') {
    super(scene, x, y, texture);
  }

  activate(x: number, y: number, type: 'xp' | 'chest', value = 1, bossChest = false): this {
    this.enableBody(true, x, y, true, true);
    this.pickupType = type;
    this.value = value;
    this.bossChest = bossChest;
    this.setTexture(type === 'xp' ? 'xp-gem' : 'chest');
    this.setDisplaySize(type === 'xp' ? 18 : 48, type === 'xp' ? 18 : 48);
    return this;
  }

  retire(): void { this.disableBody(true, true); }
}
