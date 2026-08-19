import { expect, test, type Page } from '@playwright/test';

const GAME_WIDTH = 1_280;
const GAME_HEIGHT = 720;

async function canvasScreenPoint(page: Page, gameX: number, gameY: number): Promise<{ x: number; y: number }> {
  const bounds = await page.locator('canvas').boundingBox();
  if (!bounds) throw new Error('Game canvas is not visible');
  return {
    x: bounds.x + gameX / GAME_WIDTH * bounds.width,
    y: bounds.y + gameY / GAME_HEIGHT * bounds.height
  };
}

async function dispatchCanvasTouch(
  page: Page,
  type: 'touchstart' | 'touchmove' | 'touchend',
  point: { x: number; y: number }
): Promise<void> {
  await page.evaluate(({ type, point }) => {
    const canvas = document.querySelector('canvas')!;
    const touch = new Touch({
      identifier: 1,
      target: canvas,
      clientX: point.x,
      clientY: point.y,
      pageX: point.x,
      pageY: point.y,
      screenX: point.x,
      screenY: point.y,
      radiusX: 8,
      radiusY: 8,
      force: 1
    });
    canvas.dispatchEvent(new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      touches: type === 'touchend' ? [] : [touch],
      targetTouches: type === 'touchend' ? [] : [touch],
      changedTouches: [touch]
    }));
  }, { type, point });
}

async function startRun(page: Page, path = '/', touch = false): Promise<void> {
  await page.goto(path);
  await expect(page.locator('canvas')).toBeVisible();
  if (touch) {
    await page.evaluate(() => window.__OGU_GAME__?.scene.start('GameScene', { characterId: 'guardian' }));
    await page.waitForFunction(() => Boolean(window.__OGU_GAME__?.scene.isActive('GameScene')));
    return;
  }
  // 메뉴가 뜨기 전에 클릭이 나가면 시작을 놓친다(소프트웨어 렌더링 환경에서 간헐 실패).
  // 메뉴 준비를 기다린 뒤, 시작될 때까지 클릭을 재시도한다.
  await page.waitForFunction(() => Boolean(window.__OGU_GAME__?.scene.isActive('MainMenuScene')));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const start = await canvasScreenPoint(page, 1_056, 391);
    await page.mouse.click(start.x, start.y);
    const started = await page
      .waitForFunction(() => Boolean(window.__OGU_GAME__?.scene.isActive('GameScene')), undefined, { timeout: 8_000 })
      .catch(() => null);
    if (started) return;
  }
  throw new Error('run did not start after repeated start-button clicks');
}

test('selects the 10-minute mode and loads the self-hosted Korean fonts', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'The menu mode selector is covered once by the desktop project.');
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__OGU_GAME__?.scene.isActive('MainMenuScene')));
  const focusMode = await canvasScreenPoint(page, 1_135, 315);
  await page.mouse.click(focusMode.x, focusMode.y);
  const start = await canvasScreenPoint(page, 1_056, 391);
  await page.mouse.click(start.x, start.y);
  await page.waitForFunction(() => Boolean(window.__OGU_GAME__?.scene.isActive('GameScene')));

  const mode = await page.evaluate(() => {
    const scene = window.__OGU_GAME__?.scene.getScene('GameScene') as unknown as {
      state: { modeId: string };
      runDurationMs: number;
    };
    return { modeId: scene.state.modeId, durationMs: scene.runDurationMs };
  });
  expect(mode).toEqual({ modeId: 'focus', durationMs: 600_000 });
  expect(await page.evaluate(() => document.fonts.check('700 18px "Noto Sans KR Variable"', '오구서바이벌'))).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('400 32px "Jua"', '새 능력을 골라요'))).toBe(true);
});

test('completes the accelerated full 5-minute timeline without runtime errors', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'The full timeline is covered once by the desktop project.');
  test.setTimeout(100_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await startRun(page, '/?dev=1&timeScale=80');

  await page.evaluate(() => {
    window.__OGU_TEST__?.startRunAutomation();
  });

  // 무한 맵에서는 계속 달리면 적이 영원히 못 따라잡는다.
  // 잠깐만 움직이고 멈춰서 전투가 실제로 벌어지게 한다.
  await page.keyboard.down('d');
  await page.waitForTimeout(1_500);
  await page.keyboard.up('d');
  await page.waitForFunction(
    () => Boolean(window.__OGU_GAME__?.scene.isActive('ResultScene')),
    undefined,
    { timeout: 90_000, polling: 250 }
  );

  const result = await page.evaluate(() => window.__OGU_TEST__?.getRunResult());
  expect(result).toBeDefined();
  if (!result) return;
  expect(result.victory).toBe(true);
  expect(result.modeId).toBe('quick');
  expect(result.elapsedMs).toBe(300_000);
  expect(result.kills).toBeGreaterThan(0);
  expect(result.score).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
});

test('mobile touch joystick moves the player and stops on release', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch input is covered by the mobile project.');
  await page.setViewportSize({ width: 839, height: 412 });
  await startRun(page, '/', true);
  await page.evaluate(() => {
    const scene = window.__OGU_GAME__?.scene.getScene('GameScene') as unknown as {
      playerInvulnerableUntil: number;
    };
    scene.playerInvulnerableUntil = Number.POSITIVE_INFINITY;
  });

  const start = await canvasScreenPoint(page, 220, 540);
  const end = await canvasScreenPoint(page, 340, 540);
  const beforeX = await page.evaluate(() => {
    const scene = window.__OGU_GAME__?.scene.getScene('GameScene') as unknown as { player: { x: number } };
    return scene.player.x;
  });
  await dispatchCanvasTouch(page, 'touchstart', start);
  await page.waitForTimeout(80);
  const touchStarted = await page.evaluate(() => {
    const scene = window.__OGU_GAME__?.scene.getScene('GameScene') as unknown as {
      inputSystem: { joystick: { active: boolean; baseX: number; baseY: number } };
    };
    return scene.inputSystem.joystick;
  });
  await dispatchCanvasTouch(page, 'touchmove', end);
  await page.waitForTimeout(350);
  const movingX = await page.evaluate(() => {
    const scene = window.__OGU_GAME__?.scene.getScene('GameScene') as unknown as { player: { x: number } };
    return scene.player.x;
  });
  await dispatchCanvasTouch(page, 'touchend', end);
  await page.waitForTimeout(80);
  const releasedX = await page.evaluate(() => {
    const scene = window.__OGU_GAME__?.scene.getScene('GameScene') as unknown as { player: { x: number } };
    return scene.player.x;
  });
  await page.waitForTimeout(250);
  const stopped = await page.evaluate(() => {
    const scene = window.__OGU_GAME__?.scene.getScene('GameScene') as unknown as {
      player: { x: number };
      inputSystem: { movement: { x: number; y: number }; joystick: { active: boolean } };
    };
    return {
      x: scene.player.x,
      movement: scene.inputSystem.movement,
      joystickActive: scene.inputSystem.joystick.active
    };
  });

  expect(touchStarted.active).toBe(true);
  expect(movingX).toBeGreaterThan(beforeX + 10);
  expect(Math.abs(stopped.x - releasedX)).toBeLessThan(2);
  expect(stopped.movement).toEqual({ x: 0, y: 0 });
  expect(stopped.joystickActive).toBe(false);
});

test('installed PWA reloads from its service worker while offline', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Offline caching is covered once by the desktop project.');
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(
    async () => Boolean((await navigator.serviceWorker.getRegistration())?.active),
    undefined,
    { timeout: 15_000 }
  );
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 10_000 });

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page).toHaveTitle(/오구서바이벌/);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  } finally {
    await context.setOffline(false);
  }
});
