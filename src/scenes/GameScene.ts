import Phaser from 'phaser';
import { sfx } from '../audio/ProceduralSfx';
import { eventBus, GameEvents, type HudSnapshot } from '../core/events/EventBus';
import { SpatialHashGrid } from '../core/math/SpatialHashGrid';
import { mulberry32, range, type RandomFn } from '../core/math/random';
import { getCharacter, type CharacterId } from '../data/characters';
import { getEnemy, type BossId, type EnemyDefinition } from '../data/enemies';
import { getWeapon } from '../data/weapons';
import { resolveDamage } from '../domain/combat/DamageResolver';
import { MissionService } from '../domain/missions/MissionService';
import { applyUpgradeChoice, draftUpgrades, findEvolutionCandidate, type UpgradeChoice } from '../domain/progression/UpgradeDraft';
import { applyExperience, xpRequiredForLevel } from '../domain/progression/Experience';
import { createRunSnapshot, type RunSnapshot } from '../domain/run/RunSerializer';
import type { RunState } from '../domain/run/RunState';
import { EnemySprite } from '../entities/Enemy';
import { PickupSprite } from '../entities/Pickup';
import { ProjectileSprite } from '../entities/Projectile';
import { saveAdapter } from '../persistence/IndexedDbSaveAdapter';
import { platformGateway, type RunResult } from '../platform/LocalPlatformGateway';
import { ComboSystem } from '../systems/ComboSystem';
import { InputSystem } from '../systems/InputSystem';
import { PerformanceSystem } from '../systems/PerformanceSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { WeaponSystem, type CombatHost, type ProjectileRequest } from '../systems/WeaponSystem';

interface GameSceneData { characterId: CharacterId; snapshot?: RunSnapshot }
interface DamageZone { x: number; y: number; radius: number; damage: number; remainingMs: number; tickMs: number; tickLeftMs: number; color: number }
interface MeteorEffect { x: number; y: number; radius: number; damage: number; remainingMs: number; totalMs: number; color: number }
interface BeamEffect { x1: number; y1: number; x2: number; y2: number; width: number; remainingMs: number; color: number }
interface PulseEffect { x: number; y: number; radius: number; remainingMs: number; totalMs: number; color: number }
interface EnemyHazard { x: number; y: number; radius: number; damage: number; remainingMs: number; totalMs: number }

const WORLD_WIDTH = 2_560;
const WORLD_HEIGHT = 1_600;

export class GameScene extends Phaser.Scene implements CombatHost {
  state!: RunState;
  nowMs = 0;
  runId = '';
  readonly runDurationMs = 900_000;

  private player!: Phaser.Physics.Arcade.Sprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private persistentGraphics!: Phaser.GameObjects.Graphics;
  private effectGraphics!: Phaser.GameObjects.Graphics;
  private inputSystem!: InputSystem;
  private readonly weaponSystem = new WeaponSystem();
  private readonly spawnSystem = new SpawnSystem();
  private readonly comboSystem = new ComboSystem();
  private readonly performanceSystem = new PerformanceSystem();
  private grid = new SpatialHashGrid<EnemySprite>(160);
  private missionSystem!: MissionService;
  private random!: RandomFn;
  private characterId!: CharacterId;
  private snapshot?: RunSnapshot;
  private enemyUid = 1;
  private gridTimerMs = 0;
  private hudTimerMs = 0;
  private autosaveTimerMs = 0;
  private chestTimerMs = 38_000;
  private assembleRemainingMs = 0;
  private assembleFireMs = 0;
  private playerInvulnerableUntil = 0;
  private ended = false;
  private pendingTreasureBoss = false;
  private zones: DamageZone[] = [];
  private meteors: MeteorEffect[] = [];
  private beams: BeamEffect[] = [];
  private pulses: PulseEffect[] = [];
  private enemyHazards: EnemyHazard[] = [];
  private readonly devMode = new URLSearchParams(location.search).has('dev');
  private readonly timeScale = this.devMode ? 20 : 1;

  constructor() { super('GameScene'); }

  init(data: GameSceneData): void {
    this.characterId = data.snapshot?.state.characterId ?? data.characterId;
    this.snapshot = data.snapshot;
  }

  create(): void {
    this.resetRuntimeCollections();
    this.createRunState();
    this.random = mulberry32(this.state.seed + Math.floor(this.state.elapsedMs));
    this.missionSystem = new MissionService(this.random);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.drawArena();
    this.createGroups();
    this.createPlayer();
    this.createCollisions();
    this.inputSystem = new InputSystem(this);
    this.inputSystem.create();
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT).startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
    this.scene.launch('UIScene', { gameScene: this });
    this.spawnSystem.director.restoreBosses(this.state.bossesDefeated);
    if (this.state.activeBoss) {
      const restored = this.state.activeBoss;
      this.spawnBoss(restored.id, 1, 1, restored);
    }
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.showMessage(this.devMode ? '개발 가속 모드 ×20' : '15분 생존을 시작합니다', this.devMode ? '#ffcf65' : '#7df8ff');
    sfx.unlock();
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    const safeDelta = Math.min(60, delta);
    const scaledDelta = Math.min(240, safeDelta * this.timeScale);
    this.nowMs += safeDelta;
    this.state.elapsedMs += scaledDelta;
    this.inputSystem.update();
    if (this.inputSystem.consumePause()) {
      this.openPause();
      return;
    }
    this.updateMovement();
    this.updateSpatialGrid(safeDelta);
    this.weaponSystem.update(this.state, scaledDelta, this);
    this.updateProjectiles(safeDelta);
    this.updateEnemies(safeDelta);
    this.updatePickups(safeDelta);
    this.updateEffects(scaledDelta);
    this.updateRunEvents(scaledDelta);
    this.weaponSystem.drawPersistent(this.persistentGraphics, this.state, this.player.x, this.player.y, this.nowMs);
    this.drawEffects();
    this.performanceSystem.update(safeDelta);
    this.checkLevelUpOverlay();
    this.updateHud(safeDelta);
    this.autosaveTimerMs += safeDelta;
    if (this.autosaveTimerMs >= 5_000) {
      this.autosaveTimerMs = 0;
      void this.saveRun();
    }
    if (this.state.stats.hp <= 0) void this.endRun(false);
  }

  get playerX(): number { return this.player.x; }
  get playerY(): number { return this.player.y; }

  queryEnemies(x: number, y: number, radius: number): EnemySprite[] {
    return this.grid.queryRadius(x, y, radius);
  }

  nearestEnemy(x: number, y: number, radius: number): EnemySprite | undefined {
    return this.queryEnemies(x, y, radius).sort((a, b) => Phaser.Math.Distance.Squared(x, y, a.x, a.y) - Phaser.Math.Distance.Squared(x, y, b.x, b.y))[0];
  }

  spawnProjectile(request: ProjectileRequest): void {
    const projectile = this.projectiles.get(request.x, request.y, 'projectile') as ProjectileSprite | null;
    if (!projectile) return;
    projectile.activate(request);
  }

  damageEnemy(enemy: EnemySprite, amount: number, color = 0xffffff): void {
    if (!enemy.active || !enemy.definition) return;
    const result = resolveDamage({
      amount,
      armor: enemy.definition.boss ? 0.06 : enemy.definition.role === 'tank' ? 0.12 : 0,
      criticalChance: 0.05,
      random: this.random
    });
    enemy.hp -= result.amount;
    this.state.ultimate = Math.min(this.state.ultimateMax, this.state.ultimate + result.amount * 0.11);
    if (this.performanceSystem.effectsScale > 0.5 && this.random() < 0.35) this.spawnDamageNumber(enemy.x, enemy.y, result.amount, result.critical ? 0xffe269 : color);
    if (enemy.definition.boss && this.state.activeBoss) {
      this.state.activeBoss.hp = Math.max(0, enemy.hp);
      this.state.activeBoss.phase = enemy.phase;
    }
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  slowEnemy(enemy: EnemySprite, durationMs: number): void {
    enemy.slowUntil = Math.max(enemy.slowUntil, this.nowMs + durationMs);
  }

  createZone(x: number, y: number, radius: number, damage: number, durationMs: number, tickMs: number, color: number): void {
    if (this.zones.length >= 18) this.zones.shift();
    this.zones.push({ x, y, radius, damage, remainingMs: durationMs, tickMs, tickLeftMs: 0, color });
  }

  createMeteor(x: number, y: number, radius: number, damage: number, delayMs: number, color: number): void {
    if (this.meteors.length >= 16) this.meteors.shift();
    this.meteors.push({ x, y, radius, damage, remainingMs: delayMs, totalMs: delayMs, color });
  }

  createBeam(x1: number, y1: number, x2: number, y2: number, width: number, damage: number, color: number): void {
    this.beams.push({ x1, y1, x2, y2, width, remainingMs: 180, color });
    if (damage <= 0) return;
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const radius = Phaser.Math.Distance.Between(x1, y1, x2, y2) / 2 + width;
    for (const enemy of this.queryEnemies(centerX, centerY, radius)) {
      if (distancePointToSegment(enemy.x, enemy.y, x1, y1, x2, y2) <= width + (enemy.definition?.radius ?? 12)) this.damageEnemy(enemy, damage, color);
    }
  }

  createPulse(x: number, y: number, radius: number, color: number): void {
    if (this.pulses.length > 28) this.pulses.shift();
    this.pulses.push({ x, y, radius, remainingMs: 280, totalMs: 280, color });
  }

  getUpgradeChoices(): UpgradeChoice[] {
    return draftUpgrades(this.state, this.random, 3);
  }

  selectUpgrade(choice: UpgradeChoice): void {
    applyUpgradeChoice(this.state, choice);
    this.state.pendingLevelUps = Math.max(0, this.state.pendingLevelUps - 1);
    this.syncPlayerStats();
    sfx.play('level', 0.09);
    void this.saveRun();
  }

  claimTreasure(): { title: string; description: string; evolved: boolean } {
    const evolution = findEvolutionCandidate(this.state.weapons, this.state.passives);
    let result: { title: string; description: string; evolved: boolean };
    if (evolution) {
      evolution.evolved = true;
      const definition = getWeapon(evolution.id);
      result = { title: `${definition.evolvedName} 진화!`, description: `${definition.name}의 공격 패턴이 크게 확장됩니다.`, evolved: true };
    } else {
      const upgradable = this.state.weapons.filter((weapon) => weapon.level < getWeapon(weapon.id).maxLevel);
      const weapon = upgradable[Math.floor(this.random() * upgradable.length)];
      if (weapon) {
        weapon.level += 1;
        result = { title: `${getWeapon(weapon.id).name} 강화`, description: `무기 레벨이 ${weapon.level}이 되었습니다.`, evolved: false };
      } else {
        const heal = this.state.stats.maxHp * 0.45;
        this.state.stats.hp = Math.min(this.state.stats.maxHp, this.state.stats.hp + heal);
        result = { title: '완전 수리', description: `체력을 ${Math.round(heal)} 회복했습니다.`, evolved: false };
      }
    }
    this.pendingTreasureBoss = false;
    this.state.score += 450;
    this.syncPlayerStats();
    sfx.play('treasure', 0.1);
    void this.saveRun();
    return result;
  }

  requestUltimate(): void {
    this.useUltimate();
  }

  openPause(): void {
    if (this.scene.isActive('PauseScene')) return;
    this.scene.pause();
    this.scene.launch('PauseScene', { gameScene: this });
  }

  async saveAndExit(): Promise<void> {
    await this.saveRun();
    this.scene.stop('UIScene');
    this.scene.stop();
    this.scene.start('MainMenuScene');
  }

  restartRun(): void {
    void saveAdapter.clearRun();
    this.scene.stop('UIScene');
    this.scene.restart({ characterId: this.characterId });
  }

  async abandonRun(): Promise<void> {
    await saveAdapter.clearRun();
    this.scene.stop('UIScene');
    this.scene.stop();
    this.scene.start('MainMenuScene');
  }

  private createRunState(): void {
    if (this.snapshot) {
      this.runId = this.snapshot.runId;
      this.state = structuredClone(this.snapshot.state);
      return;
    }
    const character = getCharacter(this.characterId);
    const seed = Math.floor(Date.now() % 2_147_483_647);
    this.runId = `${Date.now().toString(36)}-${seed.toString(36)}`;
    this.state = {
      seed,
      characterId: this.characterId,
      elapsedMs: 0,
      score: 0,
      kills: 0,
      level: 1,
      xp: 0,
      pendingLevelUps: 0,
      ultimate: 0,
      ultimateMax: 220,
      weapons: [{ id: character.startingWeapon, level: 1, evolved: false, cooldownMs: 300 }],
      passives: {},
      stats: {
        maxHp: character.maxHp, hp: character.maxHp, moveSpeed: character.moveSpeed,
        damage: character.damageBonus, cooldown: character.cooldownBonus, area: character.areaBonus,
        duration: 1, pickup: 1, armor: character.armor, evasion: 0
      },
      bossesDefeated: []
    };
    applyUpgradeChoice(this.state, { kind: 'passive', id: character.startingPassive, title: '', description: '', icon: '', isNew: true });
    if (this.devMode) {
      this.state.stats.damage *= 4;
      this.state.stats.maxHp *= 2;
      this.state.stats.hp = this.state.stats.maxHp;
    }
  }

  private resetRuntimeCollections(): void {
    this.ended = false;
    this.nowMs = 0;
    this.enemyUid = 1;
    this.gridTimerMs = 0;
    this.hudTimerMs = 0;
    this.autosaveTimerMs = 0;
    this.chestTimerMs = 38_000;
    this.assembleRemainingMs = 0;
    this.assembleFireMs = 0;
    this.zones = [];
    this.meteors = [];
    this.beams = [];
    this.pulses = [];
    this.enemyHazards = [];
    this.grid = new SpatialHashGrid<EnemySprite>(160);
  }

  private drawArena(): void {
    const background = this.add.graphics();
    background.fillStyle(0x07111f, 1).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    background.lineStyle(1, 0x244867, 0.28);
    for (let x = 0; x <= WORLD_WIDTH; x += 96) background.lineBetween(x, 0, x, WORLD_HEIGHT);
    for (let y = 0; y <= WORLD_HEIGHT; y += 96) background.lineBetween(0, y, WORLD_WIDTH, y);
    const landmarks = [
      { x: 330, y: 280, color: 0x24d8ff }, { x: WORLD_WIDTH - 330, y: 280, color: 0xff66c6 },
      { x: 330, y: WORLD_HEIGHT - 280, color: 0x76ff7e }, { x: WORLD_WIDTH - 330, y: WORLD_HEIGHT - 280, color: 0x9b72ff }
    ];
    for (const mark of landmarks) {
      background.fillStyle(mark.color, 0.05).fillCircle(mark.x, mark.y, 170);
      background.lineStyle(5, mark.color, 0.26).strokeCircle(mark.x, mark.y, 110).lineStyle(2, mark.color, 0.16).strokeCircle(mark.x, mark.y, 148);
    }
    background.lineStyle(10, 0x3c698b, 0.55).strokeRect(5, 5, WORLD_WIDTH - 10, WORLD_HEIGHT - 10);
    this.persistentGraphics = this.add.graphics().setDepth(4);
    this.effectGraphics = this.add.graphics().setDepth(20);
  }

  private createGroups(): void {
    this.enemies = this.physics.add.group({ classType: EnemySprite, maxSize: 260, runChildUpdate: false });
    this.projectiles = this.physics.add.group({ classType: ProjectileSprite, maxSize: 620, runChildUpdate: false });
    this.enemyProjectiles = this.physics.add.group({ classType: ProjectileSprite, maxSize: 180, runChildUpdate: false });
    this.pickups = this.physics.add.group({ classType: PickupSprite, maxSize: 190, runChildUpdate: false });
  }

  private createPlayer(): void {
    const character = getCharacter(this.characterId);
    this.player = this.physics.add.sprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, `player-${character.id}`).setDepth(10);
    this.player.setCircle(22, 10, 10).setCollideWorldBounds(true);
  }

  private createCollisions(): void {
    this.physics.add.overlap(this.projectiles, this.enemies, (projectile, enemy) => this.onProjectileHit(projectile as ProjectileSprite, enemy as EnemySprite));
    this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => this.onPlayerEnemyOverlap(enemy as EnemySprite));
    this.physics.add.overlap(this.player, this.enemyProjectiles, (_player, projectile) => this.onEnemyProjectileHit(projectile as ProjectileSprite));
    this.physics.add.overlap(this.player, this.pickups, (_player, pickup) => this.collectPickup(pickup as PickupSprite));
  }

  private updateMovement(): void {
    const movement = this.inputSystem.movement;
    this.player.setVelocity(movement.x * this.state.stats.moveSpeed, movement.y * this.state.stats.moveSpeed);
    if (movement.x !== 0) this.player.setFlipX(movement.x < 0);
    if (this.inputSystem.consumeUltimate()) this.useUltimate();
    this.player.setAlpha(this.nowMs < this.playerInvulnerableUntil && Math.floor(this.nowMs / 70) % 2 === 0 ? 0.35 : 1);
  }

  private updateSpatialGrid(deltaMs: number): void {
    this.gridTimerMs -= deltaMs;
    if (this.gridTimerMs > 0) return;
    this.gridTimerMs = 110;
    this.grid.rebuild(this.enemies.getChildren() as EnemySprite[]);
  }

  private updateProjectiles(deltaMs: number): void {
    for (const projectile of this.projectiles.getChildren() as ProjectileSprite[]) {
      if (!projectile.active) continue;
      projectile.lifeMs -= deltaMs;
      if (projectile.kind === 'homing') {
        const target = this.findEnemyByUid(projectile.targetUid) ?? this.nearestEnemy(projectile.x, projectile.y, 420);
        if (target && projectile.body) {
          const current = Math.atan2(projectile.body.velocity.y, projectile.body.velocity.x);
          const desired = Phaser.Math.Angle.Between(projectile.x, projectile.y, target.x, target.y);
          const angle = Phaser.Math.Angle.RotateTo(current, desired, 0.08);
          const speed = Math.max(250, projectile.body.velocity.length());
          projectile.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
          projectile.targetUid = target.uid;
        }
      } else if (projectile.kind === 'boomerang' && projectile.lifeMs <= projectile.returnAt) {
        const angle = Phaser.Math.Angle.Between(projectile.x, projectile.y, this.player.x, this.player.y);
        const speed = Math.max(360, projectile.body?.velocity.length() ?? 360);
        projectile.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        if (Phaser.Math.Distance.Between(projectile.x, projectile.y, this.player.x, this.player.y) < 35) projectile.retire();
      }
      if (projectile.lifeMs <= 0 || projectile.x < -50 || projectile.y < -50 || projectile.x > WORLD_WIDTH + 50 || projectile.y > WORLD_HEIGHT + 50) projectile.retire();
    }
    for (const projectile of this.enemyProjectiles.getChildren() as ProjectileSprite[]) {
      if (!projectile.active) continue;
      projectile.lifeMs -= deltaMs;
      projectile.setRotation(projectile.rotation + deltaMs * 0.008);
      if (projectile.lifeMs <= 0) projectile.retire();
    }
  }

  private updateEnemies(deltaMs: number): void {
    const children = this.enemies.getChildren() as EnemySprite[];
    const playerX = this.player.x;
    const playerY = this.player.y;
    for (const enemy of children) {
      if (!enemy.active || !enemy.definition) continue;
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, playerX, playerY);
      if (distance > 1_050 && (enemy.uid + Math.floor(this.nowMs / 100)) % 3 !== 0) continue;
      enemy.attackCooldownMs -= deltaMs;
      enemy.specialCooldownMs -= deltaMs;
      const slow = this.nowMs < enemy.slowUntil ? 0.52 : 1;
      const definition = enemy.definition;
      if (definition.boss) this.updateBoss(enemy, deltaMs, distance, slow);
      else if (definition.role === 'shooter') this.updateShooter(enemy, distance, slow);
      else if (definition.role === 'charger') this.updateCharger(enemy, deltaMs, slow);
      else if (definition.role === 'exploder') {
        if (distance < 72) {
          this.enemyHazards.push({ x: enemy.x, y: enemy.y, radius: 95, damage: definition.damage, remainingMs: 120, totalMs: 120 });
          enemy.retire();
        } else this.steerToward(enemy, playerX, playerY, definition.speed * slow);
      } else if (definition.role === 'support') {
        this.steerToward(enemy, playerX, playerY, definition.speed * 0.65 * slow);
        if (enemy.specialCooldownMs <= 0) {
          enemy.specialCooldownMs = definition.elite ? 4_200 : 5_500;
          const nearby = this.queryEnemies(enemy.x, enemy.y, 230).filter((other) => other.uid !== enemy.uid);
          for (const other of nearby.slice(0, 8)) other.hp = Math.min(other.maxHp, other.hp + other.maxHp * 0.06);
          this.createPulse(enemy.x, enemy.y, 230, definition.color);
          if (definition.id === 'elite_summon') for (let index = 0; index < 4; index += 1) this.spawnEnemy(getEnemy(index % 2 === 0 ? 'spark' : 'wisp'), 2, 1.2, enemy.x, enemy.y);
        }
      } else if (definition.role === 'blocker') {
        const intent = this.inputSystem.movement;
        this.steerToward(enemy, playerX + intent.x * 180, playerY + intent.y * 180, definition.speed * slow);
      } else {
        this.steerToward(enemy, playerX, playerY, definition.speed * slow);
      }
      if (definition.id === 'elite_barrage' && enemy.attackCooldownMs <= 0) {
        enemy.attackCooldownMs = 2_100;
        this.fireRadial(enemy.x, enemy.y, 10, definition.damage * 0.75, 165);
      }
      if (definition.id === 'elite_leech' && enemy.hp < enemy.maxHp && enemy.specialCooldownMs <= 0) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.08);
        enemy.specialCooldownMs = 3_000;
        this.createPulse(enemy.x, enemy.y, 90, definition.color);
      }
      enemy.setDepth(8 + enemy.y / WORLD_HEIGHT);
    }
  }

  private updateBoss(enemy: EnemySprite, deltaMs: number, distance: number, slow: number): void {
    const definition = enemy.definition!;
    enemy.phase = enemy.hp <= enemy.maxHp * 0.2 ? 3 : enemy.hp <= enemy.maxHp * 0.5 ? 2 : 1;
    if (this.state.activeBoss) this.state.activeBoss.phase = enemy.phase;
    if (definition.id === 'boss_guardian') {
      this.updateCharger(enemy, deltaMs, slow, enemy.phase >= 2 ? 0.75 : 1);
      if (enemy.attackCooldownMs <= 0) {
        enemy.attackCooldownMs = 3_200 - enemy.phase * 320;
        this.fireRadial(enemy.x, enemy.y, 6 + enemy.phase * 2, definition.damage * 0.55, 145);
      }
    } else if (definition.id === 'boss_caster') {
      this.updateShooter(enemy, distance, slow);
      if (enemy.attackCooldownMs <= 0) {
        enemy.attackCooldownMs = 2_300 - enemy.phase * 260;
        this.fireRadial(enemy.x, enemy.y, 10 + enemy.phase * 4, definition.damage * 0.75, 175 + enemy.phase * 20);
      }
      if (enemy.specialCooldownMs <= 0) {
        enemy.specialCooldownMs = 7_500 - enemy.phase * 700;
        for (let index = 0; index < 3 + enemy.phase; index += 1) this.spawnEnemy(getEnemy(index % 2 === 0 ? 'shooter_blue' : 'mote'), 2.2, 1.2, enemy.x, enemy.y);
      }
    } else {
      if (enemy.state !== 'chase') this.updateCharger(enemy, deltaMs, slow, enemy.phase === 3 ? 0.58 : 0.8);
      else this.steerToward(enemy, this.player.x, this.player.y, definition.speed * slow * (1 + enemy.phase * 0.08));
      if (enemy.attackCooldownMs <= 0) {
        enemy.attackCooldownMs = 2_600 - enemy.phase * 340;
        this.fireRadial(enemy.x, enemy.y, 10 + enemy.phase * 5, definition.damage * 0.66, 180 + enemy.phase * 24);
      }
      if (enemy.specialCooldownMs <= 0) {
        enemy.specialCooldownMs = 4_800 - enemy.phase * 450;
        if (enemy.phase >= 2 && this.random() < 0.5) {
          enemy.state = 'telegraph';
          enemy.stateTimerMs = 1_100;
          const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
          enemy.dashX = Math.cos(angle); enemy.dashY = Math.sin(angle);
        } else {
          for (let index = 0; index < 3 + enemy.phase; index += 1) {
            this.enemyHazards.push({ x: this.player.x + range(this.random, -220, 220), y: this.player.y + range(this.random, -160, 160), radius: 62, damage: definition.damage * 0.9, remainingMs: 1_400, totalMs: 1_400 });
          }
        }
      }
    }
  }

  private updateShooter(enemy: EnemySprite, distance: number, slow: number): void {
    const definition = enemy.definition!;
    if (distance < 215) this.steerToward(enemy, enemy.x + (enemy.x - this.player.x), enemy.y + (enemy.y - this.player.y), definition.speed * slow);
    else if (distance > 340) this.steerToward(enemy, this.player.x, this.player.y, definition.speed * slow);
    else enemy.setVelocity(0, 0);
    if (enemy.attackCooldownMs <= 0) {
      enemy.attackCooldownMs = definition.elite ? 1_500 : definition.boss ? 1_200 : 2_400;
      this.fireEnemyProjectile(enemy.x, enemy.y, this.player.x, this.player.y, definition.damage, definition.boss ? 210 : 150, definition.color);
    }
  }

  private updateCharger(enemy: EnemySprite, deltaMs: number, slow: number, cooldownScale = 1): void {
    const definition = enemy.definition!;
    enemy.stateTimerMs -= deltaMs;
    if (enemy.state === 'chase') {
      this.steerToward(enemy, this.player.x, this.player.y, definition.speed * slow);
      if (enemy.specialCooldownMs <= 0) {
        enemy.state = 'telegraph';
        enemy.stateTimerMs = (definition.boss ? 1_250 : 900) * cooldownScale;
        enemy.specialCooldownMs = (definition.boss ? 4_200 : definition.elite ? 3_200 : 4_600) * cooldownScale;
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        enemy.dashX = Math.cos(angle); enemy.dashY = Math.sin(angle);
        enemy.setVelocity(0, 0).setTint(0xfff0a6);
      }
    } else if (enemy.state === 'telegraph') {
      enemy.setVelocity(0, 0);
      if (enemy.stateTimerMs <= 0) {
        enemy.state = 'dash'; enemy.stateTimerMs = definition.boss ? 900 : 620;
        enemy.clearTint().setVelocity(enemy.dashX * definition.speed * (definition.boss ? 7 : 5.5), enemy.dashY * definition.speed * (definition.boss ? 7 : 5.5));
      }
    } else if (enemy.state === 'dash') {
      if (enemy.stateTimerMs <= 0) { enemy.state = 'recover'; enemy.stateTimerMs = definition.boss ? 1_200 : 700; enemy.setVelocity(0, 0).setAlpha(0.6); }
    } else if (enemy.stateTimerMs <= 0) {
      enemy.state = 'chase'; enemy.setAlpha(1).clearTint();
    }
  }

  private updatePickups(deltaMs: number): void {
    for (const pickup of this.pickups.getChildren() as PickupSprite[]) {
      if (!pickup.active) continue;
      if (pickup.pickupType === 'chest') {
        pickup.setRotation(Math.sin(this.nowMs / 260) * 0.04);
        continue;
      }
      const distance = Phaser.Math.Distance.Between(pickup.x, pickup.y, this.player.x, this.player.y);
      const pickupRange = 92 * this.state.stats.pickup;
      if (distance < pickupRange) {
        const angle = Phaser.Math.Angle.Between(pickup.x, pickup.y, this.player.x, this.player.y);
        const speed = 220 + (pickupRange - distance) * 3;
        pickup.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      } else pickup.setVelocity(0, 0);
      pickup.setRotation(pickup.rotation + deltaMs * 0.003);
    }
  }

  private updateEffects(deltaMs: number): void {
    for (let index = this.zones.length - 1; index >= 0; index -= 1) {
      const zone = this.zones[index]!;
      zone.remainingMs -= deltaMs; zone.tickLeftMs -= deltaMs;
      if (zone.tickLeftMs <= 0) {
        zone.tickLeftMs += zone.tickMs;
        for (const enemy of this.queryEnemies(zone.x, zone.y, zone.radius)) this.damageEnemy(enemy, zone.damage, zone.color);
      }
      if (zone.remainingMs <= 0) this.zones.splice(index, 1);
    }
    for (let index = this.meteors.length - 1; index >= 0; index -= 1) {
      const meteor = this.meteors[index]!;
      meteor.remainingMs -= deltaMs;
      if (meteor.remainingMs <= 0) {
        for (const enemy of this.queryEnemies(meteor.x, meteor.y, meteor.radius)) this.damageEnemy(enemy, meteor.damage, meteor.color);
        this.createPulse(meteor.x, meteor.y, meteor.radius, meteor.color);
        this.cameras.main.shake(100, 0.005 * this.performanceSystem.effectsScale);
        this.meteors.splice(index, 1);
      }
    }
    for (let index = this.enemyHazards.length - 1; index >= 0; index -= 1) {
      const hazard = this.enemyHazards[index]!;
      hazard.remainingMs -= deltaMs;
      if (hazard.remainingMs <= 0) {
        if (Phaser.Math.Distance.Between(hazard.x, hazard.y, this.player.x, this.player.y) <= hazard.radius + 18) this.hurtPlayer(hazard.damage);
        this.createPulse(hazard.x, hazard.y, hazard.radius, 0xff4d68);
        this.enemyHazards.splice(index, 1);
      }
    }
    this.beams.forEach((beam) => { beam.remainingMs -= deltaMs; });
    this.pulses.forEach((pulse) => { pulse.remainingMs -= deltaMs; });
    this.beams = this.beams.filter((beam) => beam.remainingMs > 0);
    this.pulses = this.pulses.filter((pulse) => pulse.remainingMs > 0);
  }

  private updateRunEvents(deltaMs: number): void {
    this.comboSystem.update(deltaMs);
    const bossAlive = this.getActiveBoss() !== undefined;
    const changedWave = this.spawnSystem.update({
      elapsedMs: this.state.elapsedMs, deltaMs, activeEnemies: this.enemies.countActive(true), bossAlive,
      maxEnemies: this.performanceSystem.maxEnemies, qualityScale: this.performanceSystem.qualityScale, random: this.random,
      spawnEnemy: (definition, hpScale, damageScale) => this.spawnEnemy(definition, hpScale, damageScale),
      spawnBoss: (id, hpScale, damageScale) => this.spawnBoss(id, hpScale, damageScale)
    });
    if (changedWave) this.showMessage(`WAVE ${changedWave.id} · ${changedWave.name}`, changedWave.recovery ? '#72f2a2' : '#9beeff');

    const missionResult = this.missionSystem.update(deltaMs, this.state.elapsedMs);
    if (missionResult === 'started') this.showMessage(`미션 · ${this.missionSystem.active?.description ?? ''}`, '#66eaff');
    else if (missionResult === 'completed') this.resolveMission(true);
    else if (missionResult === 'failed') this.resolveMission(false);

    this.chestTimerMs -= deltaMs;
    if (this.chestTimerMs <= 0) {
      this.spawnTreasure(false);
      this.chestTimerMs = range(this.random, 42_000, 58_000);
    }
    if (this.assembleRemainingMs > 0) {
      this.assembleRemainingMs -= deltaMs;
      this.assembleFireMs -= deltaMs;
      if (this.assembleFireMs <= 0) {
        this.assembleFireMs = 230;
        this.fireAssembleVolley();
      }
    }
  }

  private updateHud(deltaMs: number): void {
    this.hudTimerMs -= deltaMs;
    if (this.hudTimerMs > 0) return;
    this.hudTimerMs = 100;
    const mission = this.missionSystem.active;
    const boss = this.getActiveBoss();
    const hud: HudSnapshot = {
      hp: this.state.stats.hp, maxHp: this.state.stats.maxHp, xp: this.state.xp, xpNext: xpRequiredForLevel(this.state.level),
      level: this.state.level, elapsedMs: this.state.elapsedMs, score: Math.floor(this.state.score), combo: this.comboSystem.count,
      ultimate: this.state.ultimate, ultimateMax: this.state.ultimateMax,
      weapons: this.state.weapons.map((owned) => ({ name: getWeapon(owned.id).name, level: owned.level, evolved: owned.evolved })),
      mission: mission ? { title: mission.title, progress: mission.progress, goal: mission.goal, timeLeftMs: mission.timeLeftMs } : undefined,
      boss: boss ? { name: boss.definition!.name, hp: Math.max(0, boss.hp), maxHp: boss.maxHp, phase: boss.phase } : undefined,
      fps: Math.round(this.game.loop.actualFps), enemies: this.enemies.countActive(true), quality: this.performanceSystem.quality
    };
    eventBus.emit(GameEvents.hud, hud);
    eventBus.emit(GameEvents.joystick, this.inputSystem.joystick);
  }

  private drawEffects(): void {
    const graphics = this.effectGraphics;
    graphics.clear();
    for (const zone of this.zones) {
      graphics.fillStyle(zone.color, 0.11).fillCircle(zone.x, zone.y, zone.radius);
      graphics.lineStyle(2, zone.color, 0.34).strokeCircle(zone.x, zone.y, zone.radius);
    }
    for (const meteor of this.meteors) {
      const progress = 1 - meteor.remainingMs / meteor.totalMs;
      graphics.fillStyle(meteor.color, 0.08 + progress * 0.18).fillCircle(meteor.x, meteor.y, meteor.radius);
      graphics.lineStyle(3, meteor.color, 0.45 + progress * 0.5).strokeCircle(meteor.x, meteor.y, meteor.radius);
      graphics.lineBetween(meteor.x - 120 * (1 - progress), meteor.y - 180 * (1 - progress), meteor.x, meteor.y);
    }
    for (const hazard of this.enemyHazards) {
      const progress = 1 - hazard.remainingMs / hazard.totalMs;
      graphics.fillStyle(0xff274d, 0.05 + progress * 0.18).fillCircle(hazard.x, hazard.y, hazard.radius);
      graphics.lineStyle(3, 0xff5470, 0.45 + progress * 0.5).strokeCircle(hazard.x, hazard.y, hazard.radius);
    }
    for (const beam of this.beams) graphics.lineStyle(Math.max(2, beam.width), beam.color, Math.min(1, beam.remainingMs / 100)).lineBetween(beam.x1, beam.y1, beam.x2, beam.y2);
    for (const pulse of this.pulses) {
      const progress = 1 - pulse.remainingMs / pulse.totalMs;
      graphics.lineStyle(4 * (1 - progress), pulse.color, 1 - progress).strokeCircle(pulse.x, pulse.y, pulse.radius * progress);
    }
    const boss = this.getActiveBoss();
    if (boss?.state === 'telegraph') {
      graphics.lineStyle(8, 0xffd46b, 0.5).lineBetween(boss.x, boss.y, boss.x + boss.dashX * 900, boss.y + boss.dashY * 900);
    }
    if (this.assembleRemainingMs > 0) {
      const count = 4;
      for (let index = 0; index < count; index += 1) {
        const angle = this.nowMs / 500 + index / count * Math.PI * 2;
        const x = this.player.x + Math.cos(angle) * 74;
        const y = this.player.y + Math.sin(angle) * 74;
        graphics.fillStyle(index % 2 ? 0xffd66b : 0x6df5ff, 1).fillCircle(x, y, 8);
        graphics.lineStyle(2, 0xffffff, 0.7).strokeCircle(x, y, 12);
      }
    }
  }

  private spawnEnemy(definition: EnemyDefinition, hpScale: number, damageScale: number, nearX?: number, nearY?: number): EnemySprite | undefined {
    const angle = this.random() * Math.PI * 2;
    const distance = nearX === undefined ? range(this.random, 690, 860) : range(this.random, 45, 110);
    const originX = nearX ?? this.player.x;
    const originY = nearY ?? this.player.y;
    const x = Phaser.Math.Clamp(originX + Math.cos(angle) * distance, 40, WORLD_WIDTH - 40);
    const y = Phaser.Math.Clamp(originY + Math.sin(angle) * distance, 40, WORLD_HEIGHT - 40);
    const enemy = this.enemies.get(x, y, `enemy-${definition.id}`) as EnemySprite | null;
    if (!enemy) return undefined;
    enemy.activate(this.enemyUid++, definition, hpScale, damageScale);
    enemy.setPosition(x, y).setCircle(definition.radius).setDepth(8);
    enemy.setDisplaySize(definition.radius * 2.4, definition.radius * 2.4);
    enemy.setCollideWorldBounds(true);
    return enemy;
  }

  private spawnBoss(id: BossId, hpScale: number, damageScale: number, restore?: RunState['activeBoss']): void {
    const definition = getEnemy(id);
    const boss = this.spawnEnemy(definition, hpScale, damageScale);
    if (!boss) return;
    if (restore) {
      boss.hp = restore.hp;
      boss.maxHp = restore.maxHp;
      boss.phase = restore.phase;
    }
    this.state.activeBoss = { id, hp: boss.hp, maxHp: boss.maxHp, phase: boss.phase };
    this.showMessage(`보스 출현 · ${definition.name}`, '#ff738f');
    sfx.play('boss', 0.14);
    this.cameras.main.shake(350, 0.012);
  }

  private spawnTreasure(bossChest: boolean, x?: number, y?: number): void {
    if ((this.pickups.getChildren() as PickupSprite[]).some((pickup) => pickup.active && pickup.pickupType === 'chest')) return;
    const position = x === undefined ? this.findFarPosition() : { x, y: y! };
    const chest = this.pickups.get(position.x, position.y, 'chest') as PickupSprite | null;
    if (!chest) return;
    chest.activate(position.x, position.y, 'chest', 1, bossChest).setDepth(7);
    this.pendingTreasureBoss = bossChest;
    this.showMessage(bossChest ? '보스 보물상자!' : '멀리서 보물 신호가 감지됩니다', '#ffdc64');
  }

  private onProjectileHit(projectile: ProjectileSprite, enemy: EnemySprite): void {
    if (!projectile.active || !enemy.active || projectile.hitIds.has(enemy.uid)) return;
    projectile.hitIds.add(enemy.uid);
    this.damageEnemy(enemy, projectile.damage, projectile.tintTopLeft || 0xffffff);
    sfx.play('hit', 0.025);
    if (projectile.pierce <= 0 && projectile.kind !== 'boomerang') projectile.retire();
    else projectile.pierce -= 1;
  }

  private onPlayerEnemyOverlap(enemy: EnemySprite): void {
    if (!enemy.active || !enemy.definition) return;
    this.hurtPlayer(enemy.definition.damage);
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
    enemy.setVelocity(Math.cos(angle) * 260, Math.sin(angle) * 260);
    if (enemy.definition.id === 'elite_leech') enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.05);
  }

  private onEnemyProjectileHit(projectile: ProjectileSprite): void {
    if (!projectile.active) return;
    this.hurtPlayer(projectile.damage);
    projectile.retire();
  }

  private collectPickup(pickup: PickupSprite): void {
    if (!pickup.active) return;
    if (pickup.pickupType === 'chest') {
      pickup.retire();
      this.scene.pause();
      this.scene.launch('TreasureScene', { gameScene: this, bossChest: pickup.bossChest || this.pendingTreasureBoss });
      return;
    }
    const result = applyExperience(this.state.level, this.state.xp, pickup.value);
    this.state.level = result.level;
    this.state.xp = result.xp;
    this.state.pendingLevelUps += result.levelsGained;
    pickup.retire();
    const missionResult = this.missionSystem.record('collect');
    if (missionResult === 'completed') this.resolveMission(true);
  }

  private killEnemy(enemy: EnemySprite): void {
    if (!enemy.active || !enemy.definition) return;
    const definition = enemy.definition;
    const x = enemy.x;
    const y = enemy.y;
    const wasBoss = Boolean(definition.boss);
    const wasElite = Boolean(definition.elite);
    const combo = this.comboSystem.registerKill();
    this.state.kills += 1;
    this.state.score += (definition.xp * 9 + definition.hp * 0.35) * combo.multiplier;
    if (combo.assemble) this.triggerAssemble('30 COMBO · 오구 어셈블!');
    const missionResult = this.missionSystem.record(wasElite ? 'eliteKill' : 'kill');
    if (missionResult === 'completed') this.resolveMission(true);
    enemy.retire();
    this.spawnXp(x, y, definition.xp * (wasBoss ? 1.8 : 1));
    this.createPulse(x, y, definition.radius * 2, definition.color);
    if (wasBoss) {
      this.state.activeBoss = undefined;
      this.state.bossesDefeated.push(definition.id);
      this.spawnTreasure(true, x, y);
      void this.saveRun();
      if (definition.id === 'boss_overlord') this.time.delayedCall(800, () => void this.endRun(true));
    }
  }

  private spawnXp(x: number, y: number, value: number): void {
    const pickup = this.pickups.get(x, y, 'xp-gem') as PickupSprite | null;
    if (!pickup) {
      const existing = (this.pickups.getChildren() as PickupSprite[]).find((item) => item.active && item.pickupType === 'xp');
      if (existing) existing.value += value;
      return;
    }
    pickup.activate(x, y, 'xp', value).setDepth(6);
    const angle = this.random() * Math.PI * 2;
    pickup.setVelocity(Math.cos(angle) * 60, Math.sin(angle) * 60);
  }

  private hurtPlayer(rawDamage: number): void {
    if (this.nowMs < this.playerInvulnerableUntil || this.ended) return;
    if (this.random() < this.state.stats.evasion) {
      this.showMessage('회피!', '#b8ffef', 600);
      this.playerInvulnerableUntil = this.nowMs + 260;
      return;
    }
    const damage = resolveDamage({ amount: rawDamage, armor: this.state.stats.armor }).amount;
    this.state.stats.hp = Math.max(0, this.state.stats.hp - damage);
    this.playerInvulnerableUntil = this.nowMs + 680;
    this.cameras.main.shake(110, 0.008 * this.performanceSystem.effectsScale);
    this.createPulse(this.player.x, this.player.y, 55, 0xff4d68);
    sfx.play('hurt', 0.1);
    const missionResult = this.missionSystem.record('damaged');
    if (missionResult === 'failed') this.resolveMission(false);
  }

  private useUltimate(): void {
    if (this.state.ultimate < this.state.ultimateMax) {
      this.showMessage(`필살기 충전 ${Math.floor(this.state.ultimate / this.state.ultimateMax * 100)}%`, '#8ca7c9', 650);
      return;
    }
    this.state.ultimate = 0;
    const character = getCharacter(this.characterId);
    sfx.play('ultimate', 0.14);
    this.showMessage(character.ultimateName, '#fff072');
    this.cameras.main.shake(350, 0.015 * this.performanceSystem.effectsScale);
    this.playerInvulnerableUntil = this.nowMs + 2_000;
    if (this.characterId === 'guardian') {
      for (const enemy of this.queryEnemies(this.player.x, this.player.y, 390)) this.damageEnemy(enemy, 115 * this.state.stats.damage, 0x55f2ff);
      this.state.stats.hp = Math.min(this.state.stats.maxHp, this.state.stats.hp + this.state.stats.maxHp * 0.18);
      this.createPulse(this.player.x, this.player.y, 390, 0x55f2ff);
    } else if (this.characterId === 'ranger') {
      for (let index = 0; index < 18; index += 1) this.spawnProjectile({ x: this.player.x, y: this.player.y, angle: index / 18 * Math.PI * 2, speed: 760, damage: 72 * this.state.stats.damage, pierce: 8, lifeMs: 1_300, color: 0xb9ff70, radius: 8 });
    } else {
      this.createZone(this.player.x, this.player.y, 450, 28 * this.state.stats.damage, 4_200, 260, 0xb46cff);
      this.createPulse(this.player.x, this.player.y, 450, 0xb46cff);
    }
  }

  private fireEnemyProjectile(x: number, y: number, targetX: number, targetY: number, damage: number, speed: number, color: number): void {
    const projectile = this.enemyProjectiles.get(x, y, 'enemy-projectile') as ProjectileSprite | null;
    if (!projectile) return;
    const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);
    projectile.activate({ x, y, angle, speed, damage, pierce: 0, lifeMs: 4_500, color, radius: 8 }).setTexture('enemy-projectile').setDepth(9);
  }

  private fireRadial(x: number, y: number, count: number, damage: number, speed: number): void {
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2 + this.nowMs / 1700;
      this.fireEnemyProjectile(x, y, x + Math.cos(angle) * 100, y + Math.sin(angle) * 100, damage, speed, 0xff68ac);
    }
  }

  private fireAssembleVolley(): void {
    const target = this.nearestEnemy(this.player.x, this.player.y, 850);
    if (!target) return;
    for (let index = 0; index < 4; index += 1) {
      const orbitAngle = this.nowMs / 500 + index / 4 * Math.PI * 2;
      const x = this.player.x + Math.cos(orbitAngle) * 74;
      const y = this.player.y + Math.sin(orbitAngle) * 74;
      const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
      this.spawnProjectile({ x, y, angle, speed: 640, damage: 12 * this.state.stats.damage, pierce: 1, lifeMs: 1_200, color: index % 2 ? 0xffd66b : 0x6df5ff, radius: 5 });
    }
  }

  private triggerAssemble(message: string): void {
    this.assembleRemainingMs = 5_000;
    this.assembleFireMs = 0;
    this.showMessage(message, '#ffe06d');
  }

  private resolveMission(success: boolean): void {
    if (success) {
      this.state.score += 650;
      this.state.stats.hp = Math.min(this.state.stats.maxHp, this.state.stats.hp + this.state.stats.maxHp * 0.16);
      if (this.random() < 0.28) this.triggerAssemble('미션 보상 · 오구 어셈블!');
      else this.showMessage('미션 성공 · 회복 + 점수', '#72f2a2');
    } else this.showMessage('미션 실패 · 다음 기회에', '#ff8a9b');
    this.missionSystem.resolve();
  }

  private checkLevelUpOverlay(): void {
    if (this.state.pendingLevelUps <= 0 || this.scene.isActive('LevelUpScene') || this.scene.isActive('TreasureScene') || this.scene.isActive('PauseScene')) return;
    this.scene.pause();
    this.scene.launch('LevelUpScene', { gameScene: this });
  }

  private syncPlayerStats(): void {
    this.state.stats.hp = Math.min(this.state.stats.maxHp, this.state.stats.hp);
    this.player.setScale(1 + Math.min(0.18, (this.state.stats.maxHp - 100) / 900));
  }

  private steerToward(enemy: EnemySprite, targetX: number, targetY: number, speed: number): void {
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, targetX, targetY);
    enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  private findEnemyByUid(uid?: number): EnemySprite | undefined {
    if (uid === undefined) return undefined;
    return (this.enemies.getChildren() as EnemySprite[]).find((enemy) => enemy.active && enemy.uid === uid);
  }

  private getActiveBoss(): EnemySprite | undefined {
    return (this.enemies.getChildren() as EnemySprite[]).find((enemy) => enemy.active && enemy.definition?.boss);
  }

  private findFarPosition(): { x: number; y: number } {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const x = range(this.random, 100, WORLD_WIDTH - 100);
      const y = range(this.random, 100, WORLD_HEIGHT - 100);
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) > 420) return { x, y };
    }
    return { x: Phaser.Math.Clamp(this.player.x + 520, 80, WORLD_WIDTH - 80), y: this.player.y };
  }

  private spawnDamageNumber(x: number, y: number, amount: number, color: number): void {
    const text = this.add.text(x, y, `${Math.round(amount)}`, { fontFamily: 'system-ui', fontSize: '15px', fontStyle: 'bold', color: `#${color.toString(16).padStart(6, '0')}`, stroke: '#07111f', strokeThickness: 3 }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: text, y: y - 28, alpha: 0, duration: 420, onComplete: () => text.destroy() });
  }

  private showMessage(message: string, color: string, durationMs = 1_800): void {
    eventBus.emit(GameEvents.message, { message, color, durationMs });
  }

  private async saveRun(): Promise<void> {
    if (this.ended) return;
    await saveAdapter.saveRun(createRunSnapshot(this.runId, this.state));
  }

  private async endRun(victory: boolean): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    const result: RunResult = {
      runId: this.runId, characterId: this.characterId, victory, score: Math.floor(this.state.score),
      kills: this.state.kills, level: this.state.level, elapsedMs: Math.min(this.state.elapsedMs, this.runDurationMs), endedAt: Date.now()
    };
    await saveAdapter.clearRun();
    await platformGateway.submit(result);
    this.scene.stop('UIScene');
    this.scene.start('ResultScene', { result });
  }

  private onResume(): void {
    this.inputSystem.ultimateRequested = false;
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) void this.saveRun();
  };

  private onShutdown(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
    eventBus.removeAllListeners(GameEvents.hud);
  }
}

function distancePointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
