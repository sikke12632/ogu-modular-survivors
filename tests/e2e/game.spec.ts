import { expect, test } from '@playwright/test';

async function startDesktopRun(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__OGU_GAME__?.scene.isActive('MainMenuScene')));
  const bounds = await page.locator('canvas').boundingBox();
  if (!bounds) throw new Error('Game canvas is not visible');
  await page.mouse.click(bounds.x + 1_056 / 1_280 * bounds.width, bounds.y + 391 / 720 * bounds.height);
  await page.waitForFunction(() => Boolean(window.__OGU_GAME__?.scene.isActive('GameScene')));
}

test('loads the main menu and starts a playable run', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Canvas coordinate flow is covered by the desktop project.');
  await startDesktopRun(page);
  await expect(page).toHaveTitle(/오구서바이벌/);
  await expect(page.locator('canvas')).toBeVisible();
  const gameReady = await page.evaluate(() => Boolean(window.__OGU_GAME__?.scene.isActive('GameScene')));
  expect(gameReady).toBe(true);
  const beforeX = await page.evaluate(() => {
    const scene = window.__OGU_GAME__?.scene.getScene('GameScene') as unknown as { player?: { x: number } };
    return scene.player?.x ?? 0;
  });
  await page.keyboard.down('d');
  await page.waitForTimeout(240);
  await page.keyboard.up('d');
  const afterX = await page.evaluate(() => {
    const scene = window.__OGU_GAME__?.scene.getScene('GameScene') as unknown as { player?: { x: number } };
    return scene.player?.x ?? 0;
  });
  expect(afterX).toBeGreaterThan(beforeX);
  await page.keyboard.down('Escape');
  await page.waitForTimeout(100);
  await page.keyboard.up('Escape');
  expect(await page.evaluate(() => Boolean(window.__OGU_GAME__?.scene.isActive('PauseScene')))).toBe(true);
});

test('fully resets stateful run systems on retry', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Runtime lifecycle is covered by the desktop project.');
  await startDesktopRun(page);
  await page.evaluate(() => {
    const scene = window.__OGU_GAME__?.scene.getScene('GameScene') as unknown as {
      comboSystem: { registerKill(): unknown };
      spawnSystem: { director: { restoreBosses(ids: string[]): void } };
      performanceSystem: { quality: string; maxEnemies: number; effectsScale: number };
      restartRun(): void;
    };
    scene.comboSystem.registerKill();
    scene.spawnSystem.director.restoreBosses(['boss_guardian']);
    scene.performanceSystem.quality = 'low';
    scene.performanceSystem.maxEnemies = 135;
    scene.performanceSystem.effectsScale = 0.4;
    scene.restartRun();
  });
  await page.waitForFunction(() => {
    const scene = window.__OGU_GAME__?.scene.getScene('GameScene') as unknown as {
      comboSystem?: { count: number };
      spawnSystem?: { director: { progress: number } };
      performanceSystem?: { quality: string; maxEnemies: number; effectsScale: number };
    };
    return scene.comboSystem?.count === 0
      && scene.spawnSystem?.director.progress === 0
      && scene.performanceSystem?.quality === 'high'
      && scene.performanceSystem.maxEnemies === 230
      && scene.performanceSystem.effectsScale === 1;
  });
});

test('restores a complete v2 checkpoint when continuing a run', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Checkpoint restoration is covered by the desktop project.');
  await startDesktopRun(page);
  await page.evaluate(async () => {
    const scene = window.__OGU_GAME__?.scene.getScene('GameScene') as unknown as {
      player: { setPosition(x: number, y: number): void };
      comboSystem: { restore(state: { count: number; remainingMs: number; awardedAssemble: boolean }): void };
      missionSystem: { restore(state: unknown): void };
      spawnSystem: { restore(state: unknown): void };
      random: { setState(state: number): void };
      chestTimerMs: number;
      assembleRemainingMs: number;
      assembleFireMs: number;
      spawnTreasure(boss: boolean, x: number, y: number): void;
      spawnBoss(id: string, hpScale: number, damageScale: number, restore: unknown): void;
      saveAndExit(): Promise<void>;
    };
    scene.player.setPosition(444, 555);
    scene.comboSystem.restore({ count: 17, remainingMs: 3_200, awardedAssemble: false });
    scene.missionSystem.restore({
      active: {
        type: 'collect',
        title: 'checkpoint mission',
        description: 'collect twelve',
        progress: 4,
        goal: 12,
        timeLeftMs: 21_000,
        complete: false,
        failed: false
      },
      cooldownMs: 0
    });
    scene.spawnSystem.restore({
      spawnAccumulator: 0,
      lastWaveId: 1,
      budgetCredit: 0,
      spawnedBosses: ['boss_guardian', 'boss_caster']
    });
    scene.random.setState(123_456);
    scene.chestTimerMs = 12_345;
    scene.assembleRemainingMs = 4_000;
    scene.assembleFireMs = 180;
    scene.spawnTreasure(true, 600, 700);
    scene.spawnBoss('boss_caster', 1, 1, {
      id: 'boss_caster',
      hp: 4_200,
      maxHp: 11_500,
      phase: 2,
      x: 1_900,
      y: 620,
      damage: 37,
      attackCooldownMs: 700,
      specialCooldownMs: 2_400,
      radialCooldownMs: 1_100,
      behavior: 'telegraph',
      behaviorTimerMs: 900,
      dashX: -1,
      dashY: 0,
      slowRemainingMs: 600,
      spawnedAdds: 3
    });
    scene.random.setState(123_456);
    await scene.saveAndExit();
  });
  await page.waitForFunction(() => Boolean(window.__OGU_GAME__?.scene.isActive('MainMenuScene')));
  await page.waitForFunction(() => {
    const scene = window.__OGU_GAME__?.scene.getScene('MainMenuScene') as unknown as { snapshot?: unknown };
    return Boolean(scene.snapshot);
  });
  const bounds = await page.locator('canvas').boundingBox();
  if (!bounds) throw new Error('Game canvas is not visible');
  await page.mouse.click(bounds.x + 1_056 / 1_280 * bounds.width, bounds.y + 468 / 720 * bounds.height);
  await page.waitForFunction(() => Boolean(window.__OGU_GAME__?.scene.isActive('GameScene')));
  const restored = await page.evaluate(() => {
    const scene = window.__OGU_GAME__?.scene.getScene('GameScene') as unknown as {
      player: { x: number; y: number };
      comboSystem: { snapshot(): { count: number } };
      missionSystem: { snapshot(): { active?: { type: string; progress: number } } };
      spawnSystem: { snapshot(): { lastWaveId: number; spawnedBosses: string[] } };
      random: { getState(): number };
      pickups: { getChildren(): Array<{ active: boolean; pickupType: string; bossChest: boolean }> };
      state: { activeBoss?: { id: string; damage: number; spawnedAdds: number } };
    };
    window.__OGU_GAME__?.scene.pause('GameScene');
    return {
      player: { x: Math.round(scene.player.x), y: Math.round(scene.player.y) },
      combo: scene.comboSystem.snapshot().count,
      mission: scene.missionSystem.snapshot().active,
      wave: scene.spawnSystem.snapshot(),
      randomState: scene.random.getState(),
      bossChests: scene.pickups.getChildren().filter((pickup) => pickup.active && pickup.pickupType === 'chest' && pickup.bossChest).length,
      boss: scene.state.activeBoss
    };
  });
  expect(restored.player).toEqual({ x: 444, y: 555 });
  expect(restored.combo).toBe(17);
  expect(restored.mission).toMatchObject({ type: 'collect', progress: 4 });
  expect(restored.wave.lastWaveId).toBe(1);
  expect(restored.wave.spawnedBosses).toEqual(expect.arrayContaining(['boss_guardian', 'boss_caster']));
  expect(restored.randomState).toBe(123_456);
  expect(restored.bossChests).toBe(1);
  expect(restored.boss).toMatchObject({ id: 'boss_caster', damage: 37, spawnedAdds: 3 });
});

test('recreates the main menu twenty times without retaining cards', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Scene lifecycle is covered by the desktop project.');
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  const cardCount = await page.evaluate(async () => {
    const game = window.__OGU_GAME__!;
    const wait = () => new Promise((resolve) => window.setTimeout(resolve, 35));
    for (let index = 0; index < 20; index += 1) {
      game.scene.stop('MainMenuScene');
      game.scene.start('MainMenuScene');
      await wait();
    }
    const scene = game.scene.getScene('MainMenuScene') as unknown as { cards: unknown[] };
    return scene.cards.length;
  });
  expect(cardCount).toBe(3);
  expect(pageErrors).toEqual([]);
});

test('fits a touch viewport without page overflow', async ({ page }) => {
  await page.goto('/');
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: innerWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
});
