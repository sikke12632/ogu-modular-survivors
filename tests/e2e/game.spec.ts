import { expect, test } from '@playwright/test';

async function startDesktopRun(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.mouse.click(1_056, 348);
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
