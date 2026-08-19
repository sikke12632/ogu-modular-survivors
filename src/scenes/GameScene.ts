import Phaser from 'phaser';
import { runLifecycleService } from '../app/RunLifecycleService';
import { sfx } from '../audio/ProceduralSfx';
import { eventBus, GameEvents, type HudSnapshot } from '../core/events/EventBus';
import { SpatialHashGrid } from '../core/math/SpatialHashGrid';
import { mulberry32, range, type StatefulRandomFn } from '../core/math/random';
import { getCharacter, type CharacterId } from '../data/characters';
import { pickFriends } from '../data/friends';
import { getEnemy, type BossId, type EnemyDefinition } from '../data/enemies';
import {
  DEFAULT_RUN_MODE_ID,
  getRunMode,
  ORIGINAL_TIMELINE_MS,
  type RunModeDefinition,
  type RunModeId
} from '../data/runModes';
import { getWeapon } from '../data/weapons';
import { resolveDamage } from '../domain/combat/DamageResolver';
import { tickEnemyCooldowns, tryConsumeEnemyCooldown } from '../domain/combat/EnemyCooldowns';
import { MissionService } from '../domain/missions/MissionService';
import { applyTreasureReward, decideChestSpawn } from '../domain/progression/TreasureReward';
import { applyUpgradeChoice, draftUpgrades, type UpgradeChoice } from '../domain/progression/UpgradeDraft';
import { applyExperience, xpRequiredForLevel } from '../domain/progression/Experience';
import { type RunCheckpoint, type RunSnapshot } from '../domain/run/RunSerializer';
import type { RunState } from '../domain/run/RunState';
import { createBaseRunStats } from '../domain/run/RunStatsCalculator';
import { EnemySprite } from '../entities/Enemy';
import { PickupSprite } from '../entities/Pickup';
import { ProjectileSprite } from '../entities/Projectile';
import type { RunResult } from '../platform/LocalPlatformGateway';
import { ComboSystem } from '../systems/ComboSystem';
import { InputSystem } from '../systems/InputSystem';
import { PerformanceSystem } from '../systems/PerformanceSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { WeaponSystem, type CombatHost, type ProjectileRequest } from '../systems/WeaponSystem';
import { playVisualEffect, VFX_COLORS } from '../ui/VisualEffects';
import { SCHOOL_FONT, SCHOOL_PALETTE, updateStudentAnimation } from '../ui/SchoolArt';

interface GameSceneData { characterId: CharacterId; modeId?: RunModeId; snapshot?: RunSnapshot }
interface DamageZone { x: number; y: number; radius: number; damage: number; remainingMs: number; tickMs: number; tickLeftMs: number; color: number }
interface MeteorEffect { x: number; y: number; radius: number; damage: number; remainingMs: number; totalMs: number; color: number }
interface BeamEffect { x1: number; y1: number; x2: number; y2: number; width: number; remainingMs: number; color: number }
interface PulseEffect { x: number; y: number; radius: number; remainingMs: number; totalMs: number; color: number }
interface EnemyHazard { x: number; y: number; radius: number; damage: number; remainingMs: number; totalMs: number }

// The world is infinite: the ground is a camera-locked tile layer and decor
// spawns per-chunk around the camera. These constants only anchor the spawn
// plaza (the schoolyard) in world coordinates.
const SPAWN_X = 1_280;
const SPAWN_Y = 940;
const YARD = { x: SPAWN_X, y: SPAWN_Y - 40, width: 1_680, height: 1_120 } as const;
const PROJECTILE_CULL_DISTANCE = 1_500;
const DECOR_CHUNK = 640;

function chunkSeed(chunkX: number, chunkY: number): number {
  let seed = (chunkX * 73_856_093) ^ (chunkY * 19_349_663) ^ 0x5f356495;
  seed = Math.abs(seed) % 2_147_483_647;
  return seed === 0 ? 1 : seed;
}

export class GameScene extends Phaser.Scene implements CombatHost {
  state!: RunState;
  nowMs = 0;
  runId = '';
  mode!: RunModeDefinition;

  private player!: Phaser.Physics.Arcade.Sprite;
  private nameLabel!: Phaser.GameObjects.Text;
  private assembleFriends: {
    sprite: Phaser.GameObjects.Sprite;
    label: Phaser.GameObjects.Text;
    offsetX: number;
    offsetY: number;
  }[] = [];
  private groundTile!: Phaser.GameObjects.TileSprite;
  private decorChunks = new Map<string, Phaser.GameObjects.GameObject[]>();
  private decorTimerMs = 0;
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
  private random!: StatefulRandomFn;
  private characterId!: CharacterId;
  private modeId: RunModeId = DEFAULT_RUN_MODE_ID;
  private snapshot?: RunSnapshot;
  private enemyUid = 1;
  private gridTimerMs = 0;
  private hudTimerMs = 0;
  private autosaveTimerMs = 0;
  private chestTimerMs = 38_000;
  private assembleRemainingMs = 0;
  private assembleFireMs = 0;
  private playerInvulnerableUntil = 0;
  private saveErrorVisible = false;
  private ended = false;
  private qaLastUltimateAt = 0;
  private qaFixedStepMs = 0;
  private zones: DamageZone[] = [];
  private meteors: MeteorEffect[] = [];
  private beams: BeamEffect[] = [];
  private pulses: PulseEffect[] = [];
  private enemyHazards: EnemyHazard[] = [];
  private readonly devParams = new URLSearchParams(location.search);
  private readonly devMode = this.devParams.has('dev');
  private readonly timeScale = this.devMode
    ? Phaser.Math.Clamp(Number(this.devParams.get('timeScale')) || 20, 1, 100)
    : 1;
  private readonly maxScaledDelta = this.devMode && this.timeScale > 20 ? 1_000 : 240;

  constructor() { super('GameScene'); }

  init(data: GameSceneData): void {
    this.characterId = data.snapshot?.state.characterId ?? data.characterId;
    this.modeId = data.snapshot?.state.modeId ?? data.modeId ?? DEFAULT_RUN_MODE_ID;
    this.mode = getRunMode(this.modeId);
    this.snapshot = data.snapshot;
  }

  create(): void {
    this.resetRuntimeCollections();
    this.createRunState();
    const checkpoint = this.snapshot?.checkpoint;
    this.random = mulberry32(this.state.seed + Math.floor(this.state.elapsedMs), checkpoint?.randomState);
    this.missionSystem = new MissionService(this.random);
    if (checkpoint) {
      this.spawnSystem.restore(checkpoint.spawn);
      this.comboSystem.restore(checkpoint.combo);
      this.missionSystem.restore(checkpoint.mission);
      this.chestTimerMs = checkpoint.timers.chestMs;
      this.assembleRemainingMs = checkpoint.timers.assembleMs;
      this.assembleFireMs = checkpoint.timers.assembleFireMs;
    }
    this.drawWorld();
    this.createGroups();
    this.createPlayer();
    this.restoreImportantPickups();
    this.createCollisions();
    this.inputSystem = new InputSystem(this);
    this.inputSystem.create();
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
    this.scene.launch('UIScene', { gameScene: this });
    if (!checkpoint) this.spawnSystem.restoreBossProgress(this.state.bossesDefeated, this.state.activeBoss?.id);
    if (this.state.activeBoss) {
      const restored = this.state.activeBoss;
      this.spawnBoss(restored.id, 1, 1, restored);
    }
    if (checkpoint) this.random.setState(checkpoint.randomState);
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.showMessage(
      this.devMode ? `개발 가속 모드 ×${this.timeScale}` : `${this.mode.shortLabel} 생존을 시작합니다`,
      this.devMode ? '#ffcf65' : '#7df8ff'
    );
    sfx.unlock();
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    const safeDelta = Math.min(60, delta);
    const scaledDelta = this.qaFixedStepMs > 0
      ? this.qaFixedStepMs
      : Math.min(this.maxScaledDelta, safeDelta * this.timeScale);
    this.nowMs += safeDelta;
    this.state.elapsedMs += scaledDelta;
    if (this.state.elapsedMs >= this.runDurationMs) {
      this.state.elapsedMs = this.runDurationMs;
      void this.endRun(true);
      return;
    }
    this.inputSystem.update();
    if (this.inputSystem.consumePause()) {
      this.openPause();
      return;
    }
    this.updateMovement();
    this.updateGround();
    this.updateDecor(safeDelta);
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
  get runDurationMs(): number { return this.mode.durationMs; }
  get upgradeStepCount(): number { return this.mode.upgradeSteps; }

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
    playVisualEffect(this, 'hit', enemy.x, enemy.y, this.combatEffectColor(color));
    if (result.critical) playVisualEffect(this, 'critical', enemy.x, enemy.y, VFX_COLORS.lightning);
    const scaleX = enemy.scaleX;
    const scaleY = enemy.scaleY;
    enemy.setTintFill(0xffffff);
    this.tweens.killTweensOf(enemy);
    this.tweens.add({
      targets: enemy,
      scaleX: scaleX * 1.12,
      scaleY: scaleY * 0.86,
      duration: 55,
      yoyo: true,
      onComplete: () => {
        if (enemy.active) {
          enemy.setScale(scaleX, scaleY);
          enemy.clearTint();
        }
      }
    });
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
    return draftUpgrades(this.state, this.random, 3, this.mode.upgradeSteps);
  }

  selectUpgrade(choice: UpgradeChoice): void {
    applyUpgradeChoice(this.state, choice, this.mode.upgradeSteps);
    this.state.pendingLevelUps = Math.max(0, this.state.pendingLevelUps - 1);
    this.syncPlayerStats();
    sfx.play('level', 0.09);
    void this.saveRun();
  }

  claimTreasure(bossChest: boolean): { title: string; description: string; evolved: boolean } {
    const result = applyTreasureReward(this.state, bossChest, this.random);
    this.state.score += bossChest ? 900 : 450;
    this.syncPlayerStats();
    sfx.play('treasure', 0.1);
    void this.saveRun();
    return result;
  }

  requestUltimate(): void {
    this.useUltimate();
  }

  runQaAutomationStep(): void {
    if (!this.devMode || this.ended) return;
    this.qaFixedStepMs = 5_000;
    this.playerInvulnerableUntil = Number.POSITIVE_INFINITY;
    this.state.stats.maxHp = 1_000_000;
    this.state.stats.hp = this.state.stats.maxHp;
    this.state.stats.damage = 2_500;
    this.state.stats.moveSpeed = 420;

    if (this.scene.isActive('LevelUpScene')) {
      const choice = this.getUpgradeChoices()[0];
      if (choice) this.selectUpgrade(choice);
      this.scene.resume();
      this.scene.stop('LevelUpScene');
    }
    if (this.scene.isActive('TreasureScene')) {
      this.scene.resume();
      this.scene.stop('TreasureScene');
    }
    if (this.nowMs - this.qaLastUltimateAt >= 1_000) {
      this.qaLastUltimateAt = this.nowMs;
      this.state.ultimate = this.state.ultimateMax;
      this.requestUltimate();
    }
  }

  openPause(): void {
    if (this.scene.isActive('PauseScene')) return;
    this.scene.pause();
    this.scene.launch('PauseScene', { gameScene: this });
  }

  async saveAndExit(): Promise<void> {
    if (!await this.saveRun()) {
      this.scene.resume();
      return;
    }
    this.scene.stop('UIScene');
    this.scene.stop();
    this.scene.start('MainMenuScene');
  }

  restartRun(): void {
    void this.restartRunSafely();
  }

  async abandonRun(): Promise<void> {
    try {
      await runLifecycleService.clearCheckpoint();
    } catch {
      this.showMessage('저장 데이터 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.', '#ff718d', 2_800);
      this.scene.resume();
      return;
    }
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
      modeId: this.modeId,
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
      stats: createBaseRunStats(this.characterId),
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
    this.weaponSystem.reset();
    this.spawnSystem.reset();
    this.comboSystem.reset();
    this.performanceSystem.reset();
    this.ended = false;
    this.qaLastUltimateAt = 0;
    this.qaFixedStepMs = 0;
    this.nowMs = 0;
    this.enemyUid = 1;
    this.gridTimerMs = 0;
    this.hudTimerMs = 0;
    this.autosaveTimerMs = 0;
    this.chestTimerMs = 38_000;
    this.assembleRemainingMs = 0;
    this.assembleFireMs = 0;
    this.playerInvulnerableUntil = 0;
    this.saveErrorVisible = false;
    this.zones = [];
    this.meteors = [];
    this.beams = [];
    this.pulses = [];
    this.enemyHazards = [];
    this.grid = new SpatialHashGrid<EnemySprite>(160);
    this.decorChunks = new Map();
    this.decorTimerMs = 0;
    this.assembleFriends = [];
  }

  private drawWorld(): void {
    const camera = this.cameras.main;
    // Infinite grass: camera-locked tile layer, scrolled by hand in updateGround.
    this.groundTile = this.add.tileSprite(0, 0, camera.width + 64, camera.height + 64, 'school-ground-grass')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setTileScale(2)
      .setDepth(-6);

    // 모래 운동장 (spawn plaza)
    this.add.tileSprite(YARD.x, YARD.y, YARD.width / 2, YARD.height / 2, 'school-ground-yard')
      .setTileScale(1)
      .setScale(2)
      .setDepth(-5);
    const lines = this.add.graphics().setDepth(-4);
    const left = YARD.x - YARD.width / 2;
    const top = YARD.y - YARD.height / 2;
    lines.lineStyle(6, SCHOOL_PALETTE.chalk, 0.85).strokeRoundedRect(left + 46, top + 46, YARD.width - 92, YARD.height - 92, 26);
    lines.lineStyle(5, SCHOOL_PALETTE.chalk, 0.7)
      .lineBetween(YARD.x, top + 46, YARD.x, top + YARD.height - 46)
      .strokeCircle(YARD.x, YARD.y, 132);
    lines.lineStyle(5, SCHOOL_PALETTE.chalk, 0.6)
      .strokeRect(left + 46, YARD.y - 190, 132, 380)
      .strokeRect(left + YARD.width - 178, YARD.y - 190, 132, 380);

    // 학교 건물 + 화단
    const buildingY = top - 128;
    this.add.image(SPAWN_X, buildingY, 'school-building')
      .setDisplaySize(430, 330)
      .setDepth(-2);
    this.add.rectangle(SPAWN_X, buildingY - 30, 230, 48, SCHOOL_PALETTE.cream, 0.98)
      .setStrokeStyle(5, 0x7b3e35)
      .setDepth(-1.5);
    this.add.text(SPAWN_X, buildingY - 30, '오 구 초 등 학 교', {
      fontFamily: SCHOOL_FONT,
      fontSize: '20px',
      color: '#7b3e35'
    }).setOrigin(0.5).setDepth(-1.4);
    for (let index = 0; index < 5; index += 1) {
      this.add.image(SPAWN_X - 340 - index * 66, buildingY + 130, 'school-hedge').setScale(3.6).setDepth(-1.6);
      this.add.image(SPAWN_X + 340 + index * 66, buildingY + 130, 'school-hedge').setScale(3.6).setDepth(-1.6);
    }
    for (const decoration of [
      { key: 'school-bench', x: SPAWN_X - 560, y: buildingY + 70, scale: 4 },
      { key: 'school-bench', x: SPAWN_X + 560, y: buildingY + 70, scale: 4 },
      { key: 'school-notice-board', x: SPAWN_X - 700, y: buildingY + 40, scale: 4 },
      { key: 'school-notice-board', x: SPAWN_X + 700, y: buildingY + 40, scale: 4 },
      { key: 'school-tree-round', x: left - 90, y: top + 130, scale: 3 },
      { key: 'school-tree-round-2', x: left + YARD.width + 90, y: top + 130, scale: 3 },
      { key: 'school-tree-pine', x: left - 110, y: YARD.y + 240, scale: 3 },
      { key: 'school-tree-pine-2', x: left + YARD.width + 110, y: YARD.y + 240, scale: 3 }
    ]) {
      this.add.image(decoration.x, decoration.y, decoration.key).setScale(decoration.scale).setDepth(-1);
    }
    this.persistentGraphics = this.add.graphics().setDepth(4);
    this.effectGraphics = this.add.graphics().setDepth(20);
  }

  private updateGround(): void {
    const camera = this.cameras.main;
    if (this.groundTile.width !== camera.width + 64 || this.groundTile.height !== camera.height + 64) {
      this.groundTile.setSize(camera.width + 64, camera.height + 64);
    }
    this.groundTile.setTilePosition(camera.scrollX / 2, camera.scrollY / 2);
  }

  private updateDecor(deltaMs: number): void {
    this.decorTimerMs -= deltaMs;
    if (this.decorTimerMs > 0) return;
    this.decorTimerMs = 260;
    const camera = this.cameras.main;
    const firstX = Math.floor(camera.scrollX / DECOR_CHUNK) - 1;
    const firstY = Math.floor(camera.scrollY / DECOR_CHUNK) - 1;
    const lastX = firstX + Math.ceil(camera.width / DECOR_CHUNK) + 2;
    const lastY = firstY + Math.ceil(camera.height / DECOR_CHUNK) + 2;
    const needed = new Set<string>();
    for (let chunkY = firstY; chunkY <= lastY; chunkY += 1) {
      for (let chunkX = firstX; chunkX <= lastX; chunkX += 1) {
        const key = `${chunkX}:${chunkY}`;
        needed.add(key);
        if (!this.decorChunks.has(key)) this.decorChunks.set(key, this.spawnDecorChunk(chunkX, chunkY));
      }
    }
    for (const [key, objects] of this.decorChunks) {
      if (needed.has(key)) continue;
      for (const object of objects) object.destroy();
      this.decorChunks.delete(key);
    }
  }

  private spawnDecorChunk(chunkX: number, chunkY: number): Phaser.GameObjects.GameObject[] {
    const random = mulberry32(chunkSeed(chunkX, chunkY));
    const objects: Phaser.GameObjects.GameObject[] = [];
    const props: readonly { key: string; weight: number; scale: number }[] = [
      { key: 'school-flower-white', weight: 6, scale: 2 },
      { key: 'school-tuft-red', weight: 3, scale: 2 },
      { key: 'school-bush-orange', weight: 2, scale: 2.4 },
      { key: 'school-palm-mini', weight: 2, scale: 2.2 },
      { key: 'school-tree-round', weight: 3, scale: 2.8 },
      { key: 'school-tree-round-2', weight: 2, scale: 2.8 },
      { key: 'school-tree-pine', weight: 3, scale: 2.8 },
      { key: 'school-tree-pine-2', weight: 2, scale: 2.8 },
      { key: 'school-rock-big', weight: 1, scale: 2.4 },
      { key: 'school-rock-2', weight: 1, scale: 2.4 }
    ];
    const totalWeight = props.reduce((sum, prop) => sum + prop.weight, 0);
    const count = 3 + Math.floor(random() * 4);
    for (let index = 0; index < count; index += 1) {
      const x = chunkX * DECOR_CHUNK + random() * DECOR_CHUNK;
      const y = chunkY * DECOR_CHUNK + random() * DECOR_CHUNK;
      if (Math.abs(x - YARD.x) < YARD.width / 2 + 170 && Math.abs(y - (YARD.y - 130)) < YARD.height / 2 + 420) continue;
      let roll = random() * totalWeight;
      let chosen = props[0]!;
      for (const prop of props) {
        roll -= prop.weight;
        if (roll <= 0) { chosen = prop; break; }
      }
      const isGroundPatch = chosen.key === 'school-grass-worn' || chosen.key === 'school-grass-leaf';
      objects.push(
        this.add.image(x, y, chosen.key)
          .setScale(chosen.scale)
          .setDepth(isGroundPatch ? -5.5 : -1)
      );
    }
    return objects;
  }

  private createGroups(): void {
    this.enemies = this.physics.add.group({ classType: EnemySprite, maxSize: 260, runChildUpdate: false });
    this.projectiles = this.physics.add.group({ classType: ProjectileSprite, maxSize: 620, runChildUpdate: false });
    this.enemyProjectiles = this.physics.add.group({ classType: ProjectileSprite, maxSize: 180, runChildUpdate: false });
    this.pickups = this.physics.add.group({ classType: PickupSprite, maxSize: 190, runChildUpdate: false });
  }

  private createPlayer(): void {
    const character = getCharacter(this.characterId);
    const restored = this.snapshot?.checkpoint.player;
    const x = restored?.x ?? SPAWN_X;
    const y = restored?.y ?? SPAWN_Y;
    this.player = this.physics.add.sprite(x, y, `player-${character.id}`, 0).setDepth(10).setDisplaySize(72, 72);
    this.player.setData('student-direction', 'down');
    this.setCircleWorldRadius(this.player, 22);
    this.nameLabel = this.add.text(x, y - 46, character.name, {
      fontFamily: SCHOOL_FONT,
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#2b2117',
      strokeThickness: 4
    }).setOrigin(0.5, 1).setDepth(11);
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
    updateStudentAnimation(this.player, movement.x, movement.y);
    this.player.setAngle(
      Math.abs(movement.x) + Math.abs(movement.y) > 0.01
        ? 0
        : Math.sin(this.nowMs / 320) * 0.8
    );
    if (this.inputSystem.consumeUltimate()) this.useUltimate();
    this.player.setAlpha(this.nowMs < this.playerInvulnerableUntil && Math.floor(this.nowMs / 70) % 2 === 0 ? 0.35 : 1);
    this.nameLabel.setPosition(this.player.x, this.player.y - 46).setAlpha(this.player.alpha);
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
      if (projectile.body) projectile.setRotation(Math.atan2(projectile.body.velocity.y, projectile.body.velocity.x));
      if (projectile.lifeMs <= 0 || Phaser.Math.Distance.Between(projectile.x, projectile.y, this.player.x, this.player.y) > PROJECTILE_CULL_DISTANCE) projectile.retire();
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
      tickEnemyCooldowns(enemy, deltaMs);
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
      if (definition.id === 'elite_barrage' && tryConsumeEnemyCooldown(enemy, 'specialCooldownMs', 2_100)) {
        this.fireRadial(enemy.x, enemy.y, 10, definition.damage * 0.75, 165);
      }
      if (definition.id === 'elite_leech' && enemy.hp < enemy.maxHp && enemy.specialCooldownMs <= 0) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.08);
        enemy.specialCooldownMs = 3_000;
        this.createPulse(enemy.x, enemy.y, 90, definition.color);
      }
      if (enemy.state !== 'dash') {
        enemy.setAngle(Math.sin(this.nowMs / 190 + enemy.visualPhase) * (definition.boss ? 1.4 : 3));
      }
      enemy.setDepth(8 + Phaser.Math.Clamp((enemy.y - playerY) / 2_400, -0.9, 0.9));
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
      if (tryConsumeEnemyCooldown(enemy, 'radialCooldownMs', 2_300 - enemy.phase * 260)) {
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
    if (tryConsumeEnemyCooldown(enemy, 'attackCooldownMs', definition.elite ? 1_500 : definition.boss ? 1_200 : 2_400)) {
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
    const timelineMs = Math.min(ORIGINAL_TIMELINE_MS, this.state.elapsedMs * this.mode.timelineScale);
    const changedWave = this.spawnSystem.update({
      elapsedMs: this.state.elapsedMs,
      timelineMs,
      deltaMs,
      densityScale: this.mode.spawnDensity,
      activeEnemies: this.enemies.countActive(true), bossAlive,
      maxEnemies: this.performanceSystem.maxEnemies, qualityScale: this.performanceSystem.qualityScale, random: this.random,
      spawnEnemy: (definition, hpScale, damageScale) => this.spawnEnemy(definition, hpScale, damageScale),
      spawnBoss: (id, hpScale, damageScale) => this.spawnBoss(id, hpScale, damageScale)
    });
    if (changedWave) this.showMessage(`WAVE ${changedWave.id} · ${changedWave.name}`, changedWave.recovery ? '#72f2a2' : '#9beeff');

    const missionResult = this.missionSystem.update(deltaMs, timelineMs);
    if (missionResult === 'started') this.showMessage(`미션 · ${this.missionSystem.active?.description ?? ''}`, '#66eaff');
    else if (missionResult === 'completed') this.resolveMission(true);
    else if (missionResult === 'failed') this.resolveMission(false);

    this.chestTimerMs -= deltaMs;
    if (this.chestTimerMs <= 0) {
      this.spawnTreasure(false);
      this.chestTimerMs = range(this.random, 42_000, 58_000);
    }
    if (this.assembleRemainingMs > 0) {
      // Covers checkpoint restores that land mid-assemble as well.
      if (this.assembleFriends.length === 0) this.spawnAssembleFriends();
      this.assembleRemainingMs -= deltaMs;
      this.assembleFireMs -= deltaMs;
      if (this.assembleFireMs <= 0) {
        this.assembleFireMs = 230;
        this.fireAssembleVolley();
      }
      this.updateAssembleFriends();
      if (this.assembleRemainingMs <= 0) this.dismissAssembleFriends();
    }
  }

  private spawnAssembleFriends(): void {
    // 연출 전용 난수: 게임 판정용 this.random을 소모하면 체크포인트 복원의
    // 결정성이 깨지므로 반드시 Math.random을 쓴다.
    const count = 3 + Math.floor(Math.random() * 2);
    for (const pick of pickFriends(Math.random, count)) {
      const angle = Math.random() * Math.PI * 2;
      const startX = this.player.x + Math.cos(angle) * 620;
      const startY = this.player.y + Math.sin(angle) * 620;
      const offsetAngle = Math.random() * Math.PI * 2;
      const offsetRadius = 92 + Math.random() * 36;
      const sprite = this.add.sprite(startX, startY, pick.texture, 0)
        .setDisplaySize(64, 64)
        .setDepth(9.5);
      const label = this.add.text(startX, startY - 40, pick.name, {
        fontFamily: SCHOOL_FONT,
        fontSize: '14px',
        color: '#fff7df',
        stroke: '#2b2117',
        strokeThickness: 4
      }).setOrigin(0.5, 1).setDepth(11);
      this.assembleFriends.push({
        sprite,
        label,
        offsetX: Math.cos(offsetAngle) * offsetRadius,
        offsetY: Math.sin(offsetAngle) * offsetRadius
      });
    }
  }

  private updateAssembleFriends(): void {
    for (const friend of this.assembleFriends) {
      const targetX = this.player.x + friend.offsetX;
      const targetY = this.player.y + friend.offsetY;
      const moveX = targetX - friend.sprite.x;
      const moveY = targetY - friend.sprite.y;
      friend.sprite.x += moveX * 0.14;
      friend.sprite.y += moveY * 0.14;
      updateStudentAnimation(friend.sprite, moveX, moveY);
      friend.label.setPosition(friend.sprite.x, friend.sprite.y - 40);
    }
  }

  private dismissAssembleFriends(): void {
    for (const friend of this.assembleFriends) {
      const angle = Math.atan2(friend.sprite.y - this.player.y, friend.sprite.x - this.player.x);
      const exitX = friend.sprite.x + Math.cos(angle) * 700;
      const exitY = friend.sprite.y + Math.sin(angle) * 700;
      // 잠깐 폴짝 인사하고 밖으로 달려 나간다.
      this.tweens.add({
        targets: friend.sprite,
        y: friend.sprite.y - 16,
        duration: 140,
        yoyo: true,
        onComplete: () => {
          updateStudentAnimation(friend.sprite, exitX - friend.sprite.x, exitY - friend.sprite.y);
          this.tweens.add({
            targets: [friend.sprite, friend.label],
            x: exitX,
            y: exitY,
            alpha: 0,
            duration: 700,
            ease: 'Quad.In',
            onComplete: () => {
              friend.sprite.destroy();
              friend.label.destroy();
            }
          });
        }
      });
      this.tweens.add({ targets: friend.label, y: friend.label.y - 16, duration: 140, yoyo: true });
    }
    this.assembleFriends = [];
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
      // 친구들 발밑에 응원 링 — 어셈블 중임을 표시
      for (const friend of this.assembleFriends) {
        graphics.lineStyle(2, 0xffe06d, 0.55 + Math.sin(this.nowMs / 140) * 0.2)
          .strokeCircle(friend.sprite.x, friend.sprite.y + 22, 20);
      }
    }
  }

  private spawnEnemy(definition: EnemyDefinition, hpScale: number, damageScale: number, nearX?: number, nearY?: number): EnemySprite | undefined {
    const angle = this.random() * Math.PI * 2;
    const distance = nearX === undefined ? range(this.random, 690, 860) : range(this.random, 45, 110);
    const originX = nearX ?? this.player.x;
    const originY = nearY ?? this.player.y;
    const x = originX + Math.cos(angle) * distance;
    const y = originY + Math.sin(angle) * distance;
    const enemy = this.enemies.get(x, y, `enemy-${definition.id}`) as EnemySprite | null;
    if (!enemy) return undefined;
    enemy.activate(this.enemyUid++, definition, hpScale, damageScale, this.random);
    enemy.setPosition(x, y).setDisplaySize(definition.radius * 2.4, definition.radius * 2.4).setDepth(8);
    // Preserve the world-space hit radius from the former procedural texture sizes.
    const previousTextureSize = definition.boss ? 144 : definition.elite ? 80 : 56;
    const previousScale = definition.radius * 2.4 / previousTextureSize;
    this.setCircleWorldRadius(enemy, definition.radius * previousScale);
    return enemy;
  }

  private spawnBoss(id: BossId, hpScale: number, damageScale: number, restore?: RunState['activeBoss']): void {
    const definition = getEnemy(id);
    const boss = this.spawnEnemy(definition, hpScale, damageScale);
    if (!boss) return;
    if (restore) {
      boss.setPosition(restore.x, restore.y);
      boss.hp = restore.hp;
      boss.maxHp = restore.maxHp;
      boss.phase = restore.phase;
      boss.definition = { ...boss.definition!, damage: restore.damage };
      boss.attackCooldownMs = restore.attackCooldownMs;
      boss.specialCooldownMs = restore.specialCooldownMs;
      boss.radialCooldownMs = restore.radialCooldownMs;
      boss.state = restore.behavior;
      boss.stateTimerMs = restore.behaviorTimerMs;
      boss.dashX = restore.dashX;
      boss.dashY = restore.dashY;
      boss.slowUntil = this.nowMs + restore.slowRemainingMs;
      boss.spawnedAdds = restore.spawnedAdds;
      if (boss.state === 'telegraph') boss.setTint(0xfff0a6);
      else if (boss.state === 'recover') boss.setAlpha(0.6);
      else if (boss.state === 'dash') boss.setVelocity(boss.dashX * definition.speed * 7, boss.dashY * definition.speed * 7);
    }
    this.state.activeBoss = this.captureBossState(boss);
    playVisualEffect(this, 'boss', boss.x, boss.y, VFX_COLORS.fire);
    this.showMessage(`보스 출현 · ${definition.name}`, '#ff738f');
    sfx.play('boss', 0.14);
    this.cameras.main.shake(350, 0.012);
  }

  private spawnTreasure(bossChest: boolean, x?: number, y?: number): void {
    const activeChests = (this.pickups.getChildren() as PickupSprite[])
      .filter((pickup) => pickup.active && pickup.pickupType === 'chest');
    const decision = decideChestSpawn(activeChests.map((pickup) => pickup.bossChest), bossChest);
    if (decision === 'skip') return;
    if (decision === 'replace-normal') {
      for (const chest of activeChests) chest.retire();
    }
    const position = x === undefined ? this.findFarPosition() : { x, y: y! };
    let chest = this.pickups.get(position.x, position.y, 'chest') as PickupSprite | null;
    if (!chest && bossChest) {
      const expendableXp = (this.pickups.getChildren() as PickupSprite[])
        .find((pickup) => pickup.active && pickup.pickupType === 'xp');
      expendableXp?.retire();
      chest = this.pickups.get(position.x, position.y, 'chest') as PickupSprite | null;
    }
    if (!chest) return;
    chest.activate(position.x, position.y, 'chest', 1, bossChest).setDepth(7);
    this.showMessage(bossChest ? '보스 보물상자!' : '멀리서 보물 신호가 감지됩니다', '#ffdc64');
  }

  private onProjectileHit(projectile: ProjectileSprite, enemy: EnemySprite): void {
    if (!projectile.active || !enemy.active || projectile.hitIds.has(enemy.uid)) return;
    projectile.hitIds.add(enemy.uid);
    this.damageEnemy(enemy, projectile.damage, projectile.effectColor);
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
      const bossChest = pickup.bossChest;
      playVisualEffect(this, 'pickup', pickup.x, pickup.y, VFX_COLORS.orange);
      pickup.retire();
      this.scene.pause();
      this.scene.launch('TreasureScene', { gameScene: this, bossChest });
      return;
    }
    const result = applyExperience(this.state.level, this.state.xp, pickup.value * this.mode.xpGainScale);
    playVisualEffect(this, 'pickup', pickup.x, pickup.y, VFX_COLORS.heal);
    this.state.level = result.level;
    this.state.xp = result.xp;
    if (result.levelsGained > 0) this.state.pendingLevelUps = 1;
    if (result.levelsGained > 0) playVisualEffect(this, 'level-up', this.player.x, this.player.y, VFX_COLORS.orange);
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
    playVisualEffect(this, 'death', x, y, wasBoss ? VFX_COLORS.fire : VFX_COLORS.orange);
    this.playEnemyDeathAnimation(enemy);
    enemy.retire();
    this.spawnXp(x, y, definition.xp * (wasBoss ? 1.8 : 1));
    this.createPulse(x, y, definition.radius * 2, definition.color);
    if (wasBoss) {
      this.state.activeBoss = undefined;
      this.state.bossesDefeated.push(definition.id);
      this.spawnTreasure(true, x, y);
      void this.saveRun();
    }
  }

  private playEnemyDeathAnimation(enemy: EnemySprite): void {
    const echo = this.add.image(enemy.x, enemy.y, enemy.texture.key, enemy.frame.name)
      .setDisplaySize(enemy.displayWidth, enemy.displayHeight)
      .setAngle(enemy.angle)
      .setDepth(enemy.depth + 0.5);
    this.tweens.add({
      targets: echo,
      y: echo.y - 18,
      angle: echo.angle + (enemy.uid % 2 === 0 ? 18 : -18),
      scaleX: echo.scaleX * 1.18,
      scaleY: echo.scaleY * 0.72,
      alpha: 0,
      duration: 210,
      ease: 'Quad.Out',
      onComplete: () => echo.destroy()
    });
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
    this.player.setTintFill(0xffffff);
    this.time.delayedCall(70, () => {
      if (this.player.active) this.player.clearTint();
    });
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
    const ultimateColor = this.characterId === 'guardian'
      ? VFX_COLORS.heal
      : this.characterId === 'ranger'
        ? VFX_COLORS.lightning
        : VFX_COLORS.ice;
    playVisualEffect(this, 'ultimate', this.player.x, this.player.y, ultimateColor);
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
    // 발사 위치만 친구들 위치로 옮긴 것 — 발수·피해·탄속은 기존과 동일하다.
    for (let index = 0; index < 4; index += 1) {
      const friend = this.assembleFriends[index % Math.max(1, this.assembleFriends.length)];
      const orbitAngle = this.nowMs / 500 + index / 4 * Math.PI * 2;
      const x = friend ? friend.sprite.x : this.player.x + Math.cos(orbitAngle) * 74;
      const y = friend ? friend.sprite.y - 10 : this.player.y + Math.sin(orbitAngle) * 74;
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
      playVisualEffect(this, 'mission', this.player.x, this.player.y, VFX_COLORS.heal);
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
    const growth = 1 + Math.min(0.18, (this.state.stats.maxHp - 100) / 900);
    this.player.setDisplaySize(72 * growth, 72 * growth);
    this.setCircleWorldRadius(this.player, 22 * growth);
  }

  private setCircleWorldRadius(sprite: Phaser.Physics.Arcade.Sprite, radius: number): void {
    const scale = Math.max(0.001, Math.abs(sprite.scaleX));
    const sourceRadius = radius / scale;
    const offsetX = Math.max(0, (sprite.width - sourceRadius * 2) / 2);
    const offsetY = Math.max(0, (sprite.height - sourceRadius * 2) / 2);
    sprite.setCircle(sourceRadius, offsetX, offsetY);
  }

  private combatEffectColor(color: number): number {
    const red = color >> 16 & 0xff;
    const green = color >> 8 & 0xff;
    const blue = color & 0xff;
    if (red > 205 && green > 190 && blue > 170) return VFX_COLORS.lightning;
    if (red > green * 1.15 && red > blue * 1.15) return VFX_COLORS.fire;
    if (blue >= red || green > red) return VFX_COLORS.ice;
    return VFX_COLORS.blue;
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
    const angle = this.random() * Math.PI * 2;
    const distance = range(this.random, 460, 720);
    return {
      x: this.player.x + Math.cos(angle) * distance,
      y: this.player.y + Math.sin(angle) * distance
    };
  }

  private spawnDamageNumber(x: number, y: number, amount: number, color: number): void {
    const text = this.add.text(x, y, `${Math.round(amount)}`, { fontFamily: SCHOOL_FONT, fontSize: '15px', fontStyle: 'bold', color: `#${color.toString(16).padStart(6, '0')}`, stroke: '#29384a', strokeThickness: 3 }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: text, y: y - 28, alpha: 0, duration: 420, onComplete: () => text.destroy() });
  }

  private showMessage(message: string, color: string, durationMs = 1_800): void {
    eventBus.emit(GameEvents.message, { message, color, durationMs });
  }

  private async saveRun(): Promise<boolean> {
    if (this.ended) return true;
    this.syncActiveBossState();
    try {
      await runLifecycleService.saveCheckpoint(this.runId, this.state, this.captureCheckpoint());
      this.saveErrorVisible = false;
      return true;
    } catch {
      if (!this.saveErrorVisible) {
        this.saveErrorVisible = true;
        this.showMessage('체크포인트 저장에 실패했습니다. 저장 공간과 브라우저 설정을 확인해 주세요.', '#ff718d', 3_200);
      }
      return false;
    }
  }

  private async endRun(victory: boolean): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    const result: RunResult = {
      runId: this.runId, characterId: this.characterId, victory, score: Math.floor(this.state.score),
      modeId: this.modeId,
      kills: this.state.kills, level: this.state.level, elapsedMs: Math.min(this.state.elapsedMs, this.runDurationMs), endedAt: Date.now()
    };
    const completion = await runLifecycleService.completeRun(result);
    if (!completion.checkpointCleared) {
      this.showMessage('완료된 체크포인트를 지우지 못했습니다.', '#ffb35c', 2_200);
    }
    if (!completion.resultSubmitted) {
      this.showMessage('로컬 최고 기록을 저장하지 못했습니다.', '#ffb35c', 2_200);
    }
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
  }

  private async restartRunSafely(): Promise<void> {
    try {
      await runLifecycleService.clearCheckpoint();
    } catch {
      this.showMessage('저장 데이터 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.', '#ff718d', 2_800);
      this.scene.resume();
      return;
    }
    this.scene.stop('UIScene');
    this.scene.restart({ characterId: this.characterId, modeId: this.modeId });
  }

  private captureCheckpoint(): RunCheckpoint {
    const importantPickups = (this.pickups.getChildren() as PickupSprite[])
      .filter((pickup) => pickup.active && pickup.pickupType === 'chest')
      .map((pickup) => ({
        x: pickup.x,
        y: pickup.y,
        value: pickup.value,
        bossChest: pickup.bossChest
      }));
    return {
      player: { x: this.player.x, y: this.player.y },
      spawn: this.spawnSystem.snapshot(),
      mission: this.missionSystem.snapshot(),
      combo: this.comboSystem.snapshot(),
      importantPickups,
      randomState: this.random.getState(),
      timers: {
        chestMs: Math.max(0, this.chestTimerMs),
        assembleMs: Math.max(0, this.assembleRemainingMs),
        assembleFireMs: Math.max(0, this.assembleFireMs)
      }
    };
  }

  private restoreImportantPickups(): void {
    for (const saved of this.snapshot?.checkpoint.importantPickups ?? []) {
      const pickup = this.pickups.get(saved.x, saved.y, 'chest') as PickupSprite | null;
      pickup?.activate(saved.x, saved.y, 'chest', saved.value, saved.bossChest).setDepth(7);
    }
  }

  private syncActiveBossState(): void {
    const boss = this.getActiveBoss();
    if (boss) this.state.activeBoss = this.captureBossState(boss);
  }

  private captureBossState(boss: EnemySprite): NonNullable<RunState['activeBoss']> {
    return {
      id: boss.definition!.id as BossId,
      hp: Math.max(0, boss.hp),
      maxHp: boss.maxHp,
      phase: boss.phase,
      x: boss.x,
      y: boss.y,
      damage: boss.definition!.damage,
      attackCooldownMs: Math.max(0, boss.attackCooldownMs),
      specialCooldownMs: Math.max(0, boss.specialCooldownMs),
      radialCooldownMs: Math.max(0, boss.radialCooldownMs),
      behavior: boss.state,
      behaviorTimerMs: Math.max(0, boss.stateTimerMs),
      dashX: boss.dashX,
      dashY: boss.dashY,
      slowRemainingMs: Math.max(0, boss.slowUntil - this.nowMs),
      spawnedAdds: boss.spawnedAdds
    };
  }
}

function distancePointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
