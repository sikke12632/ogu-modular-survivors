import Phaser from 'phaser';
import type { RunState, OwnedWeapon } from '../domain/run/RunState';
import { getWeapon } from '../data/weapons';
import type { EnemySprite } from '../entities/Enemy';
import type { ProjectileKind } from '../entities/Projectile';

export interface ProjectileRequest {
  x: number; y: number; angle: number; speed: number; damage: number; pierce: number;
  lifeMs: number; color: number; radius: number; kind?: ProjectileKind; targetUid?: number;
}

export interface CombatHost {
  readonly nowMs: number;
  readonly playerX: number;
  readonly playerY: number;
  queryEnemies(x: number, y: number, radius: number): EnemySprite[];
  nearestEnemy(x: number, y: number, radius: number): EnemySprite | undefined;
  spawnProjectile(request: ProjectileRequest): void;
  damageEnemy(enemy: EnemySprite, amount: number, color?: number): void;
  slowEnemy(enemy: EnemySprite, durationMs: number): void;
  createZone(x: number, y: number, radius: number, damage: number, durationMs: number, tickMs: number, color: number): void;
  createMeteor(x: number, y: number, radius: number, damage: number, delayMs: number, color: number): void;
  createBeam(x1: number, y1: number, x2: number, y2: number, width: number, damage: number, color: number): void;
  createPulse(x: number, y: number, radius: number, color: number): void;
}

export class WeaponSystem {
  update(state: RunState, deltaMs: number, host: CombatHost): void {
    for (const owned of state.weapons) {
      owned.cooldownMs -= deltaMs;
      if (owned.cooldownMs > 0) continue;
      this.fire(owned, state, host);
      const definition = getWeapon(owned.id);
      const levelHaste = 1 - (owned.level - 1) * 0.055;
      owned.cooldownMs = Math.max(100, definition.cooldownMs * state.stats.cooldown * levelHaste * (owned.evolved ? 0.68 : 1));
    }
  }

  drawPersistent(graphics: Phaser.GameObjects.Graphics, state: RunState, x: number, y: number, timeMs: number): void {
    graphics.clear();
    const orbit = state.weapons.find((weapon) => weapon.id === 'orbit_blade');
    if (orbit) {
      const count = 1 + Math.floor(orbit.level / 2) + (orbit.evolved ? 3 : 0);
      const radius = (86 + orbit.level * 10) * state.stats.area;
      graphics.lineStyle(1, 0x57efff, 0.2).strokeCircle(x, y, radius);
      for (let index = 0; index < count; index += 1) {
        const angle = timeMs / 650 + (index / count) * Math.PI * 2;
        const bx = x + Math.cos(angle) * radius;
        const by = y + Math.sin(angle) * radius;
        graphics.fillStyle(orbit.evolved ? 0xffe478 : 0x5ef5ff, 1).fillTriangle(bx + 12, by, bx - 8, by - 6, bx - 8, by + 6);
      }
    }
    const aura = state.weapons.find((weapon) => weapon.id === 'fire_aura');
    if (aura) {
      const radius = (120 + aura.level * 16) * state.stats.area * (aura.evolved ? 1.35 : 1);
      graphics.fillStyle(0xff633f, 0.05 + Math.sin(timeMs / 180) * 0.015).fillCircle(x, y, radius);
      graphics.lineStyle(2, 0xff8a4d, 0.2).strokeCircle(x, y, radius);
    }
  }

  private fire(owned: OwnedWeapon, state: RunState, host: CombatHost): void {
    const definition = getWeapon(owned.id);
    const level = owned.level;
    const evolved = owned.evolved;
    const damage = definition.baseDamage * (1 + (level - 1) * 0.32) * state.stats.damage * (evolved ? 1.75 : 1);
    const area = state.stats.area * (evolved ? 1.24 : 1);
    const duration = state.stats.duration * (evolved ? 1.3 : 1);
    const target = host.nearestEnemy(host.playerX, host.playerY, definition.range * area);
    const targetAngle = target ? Phaser.Math.Angle.Between(host.playerX, host.playerY, target.x, target.y) : -Math.PI / 2;
    const base = { x: host.playerX, y: host.playerY, damage, color: definition.color };

    if (definition.pattern === 'projectile') {
      const count = evolved ? 3 : 1 + Math.floor((level - 1) / 3);
      for (let index = 0; index < count; index += 1) {
        const offset = (index - (count - 1) / 2) * 0.12;
        host.spawnProjectile({ ...base, angle: targetAngle + offset, speed: definition.projectileSpeed!, pierce: Math.floor(level / 3) + (evolved ? 2 : 0), lifeMs: 1_500 * duration, radius: 6 * area });
      }
    } else if (definition.pattern === 'fan') {
      const count = 2 + level + (evolved ? 5 : 0);
      const spread = evolved ? 1.75 : 1.05;
      for (let index = 0; index < count; index += 1) {
        const angle = targetAngle - spread / 2 + (index / Math.max(1, count - 1)) * spread;
        host.spawnProjectile({ ...base, angle, speed: definition.projectileSpeed!, pierce: evolved ? 2 : 0, lifeMs: 1_300 * duration, radius: 5.5 * area });
      }
    } else if (definition.pattern === 'homing') {
      const count = Math.ceil(level / 2) + (evolved ? 2 : 0);
      for (let index = 0; index < count; index += 1) {
        host.spawnProjectile({ ...base, angle: targetAngle + (index - count / 2) * 0.5, speed: definition.projectileSpeed!, pierce: evolved ? 3 : 1, lifeMs: 2_500 * duration, radius: 9 * area, kind: 'homing', targetUid: target?.uid });
      }
    } else if (definition.pattern === 'pierce') {
      host.spawnProjectile({ ...base, angle: targetAngle, speed: definition.projectileSpeed!, pierce: 3 + level * 2 + (evolved ? 99 : 0), lifeMs: 1_400 * duration, radius: (7 + level) * area });
    } else if (definition.pattern === 'boomerang') {
      const count = evolved ? 3 : 1 + Math.floor(level / 3);
      for (let index = 0; index < count; index += 1) {
        host.spawnProjectile({ ...base, angle: targetAngle + (index - (count - 1) / 2) * 0.35, speed: definition.projectileSpeed!, pierce: 99, lifeMs: (1_300 + level * 120) * duration, radius: 11 * area, kind: 'boomerang' });
      }
    } else if (definition.pattern === 'orbit') {
      const radius = (95 + level * 12) * area;
      for (const enemy of host.queryEnemies(host.playerX, host.playerY, radius + 30)) host.damageEnemy(enemy, damage, definition.color);
      host.createPulse(host.playerX, host.playerY, radius, definition.color);
    } else if (definition.pattern === 'aura') {
      const radius = (120 + level * 16) * area;
      for (const enemy of host.queryEnemies(host.playerX, host.playerY, radius)) host.damageEnemy(enemy, damage, definition.color);
    } else if (definition.pattern === 'pool' && target) {
      const radius = (52 + level * 7) * area;
      host.createZone(target.x, target.y, radius, damage * 0.55, 2_400 * duration, 420, definition.color);
      if (evolved) host.createZone(target.x + 80, target.y - 50, radius, damage * 0.55, 2_400 * duration, 420, definition.color);
    } else if (definition.pattern === 'chain' && target) {
      const maxTargets = 2 + level + (evolved ? 4 : 0);
      const visited = new Set<number>();
      let current: EnemySprite | undefined = target;
      let fromX = host.playerX;
      let fromY = host.playerY;
      for (let index = 0; index < maxTargets && current; index += 1) {
        host.damageEnemy(current, damage * Math.pow(0.88, index), definition.color);
        host.createBeam(fromX, fromY, current.x, current.y, evolved ? 7 : 4, 0, definition.color);
        visited.add(current.uid);
        fromX = current.x; fromY = current.y;
        current = host.queryEnemies(fromX, fromY, 180 * area).filter((enemy) => !visited.has(enemy.uid)).sort((a, b) => Phaser.Math.Distance.Squared(fromX, fromY, a.x, a.y) - Phaser.Math.Distance.Squared(fromX, fromY, b.x, b.y))[0];
      }
    } else if (definition.pattern === 'nova') {
      const radius = (180 + level * 18) * area;
      for (const enemy of host.queryEnemies(host.playerX, host.playerY, radius)) {
        host.damageEnemy(enemy, damage, definition.color);
        host.slowEnemy(enemy, (1_200 + level * 240) * duration * (evolved ? 1.8 : 1));
      }
      host.createPulse(host.playerX, host.playerY, radius, definition.color);
    } else if (definition.pattern === 'meteor' && target) {
      const count = evolved ? 4 : 1 + Math.floor((level - 1) / 3);
      for (let index = 0; index < count; index += 1) host.createMeteor(target.x + (index - count / 2) * 55, target.y + Math.sin(index) * 45, (75 + level * 8) * area, damage, 720 - level * 50, definition.color);
    } else if (definition.pattern === 'beam') {
      const length = definition.range * area;
      const width = (18 + level * 5) * area * (evolved ? 1.45 : 1);
      const beams = evolved ? 3 : 1;
      for (let index = 0; index < beams; index += 1) {
        const angle = targetAngle + (index - (beams - 1) / 2) * 0.25;
        host.createBeam(host.playerX, host.playerY, host.playerX + Math.cos(angle) * length, host.playerY + Math.sin(angle) * length, width, damage, definition.color);
      }
    }
  }
}
