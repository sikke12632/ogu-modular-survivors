import { expect, test } from '@playwright/test';

test('loads the main menu and starts a playable run', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Canvas coordinate flow is covered by the desktop project.');
  await page.goto('/');
  await expect(page).toHaveTitle(/오구서바이벌/);
  await expect(page.locator('canvas')).toBeVisible();
  await page.mouse.click(1_056, 348);
  await page.waitForTimeout(1_500);
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

test('fits a touch viewport without page overflow', async ({ page }) => {
  await page.goto('/');
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: innerWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
});
