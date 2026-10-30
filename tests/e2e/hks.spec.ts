import { expect, test, type Locator, type Page } from '@playwright/test';

type State = { scene?: string; remaining?: number; paused?: boolean; ended?: boolean; levelUp?: boolean; kills?: number; x?: number; y?: number; level?: number; monsters?: number };
async function snapshot(canvas: Locator): Promise<State> {
  return JSON.parse(await canvas.getAttribute('data-hks-state') ?? '{}');
}
async function clickGame(page: Page, canvas: Locator, x: number, y: number) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Game canvas is not visible');
  await page.mouse.click(box.x + box.width * x / Number(await canvas.getAttribute('data-logical-width') ?? 1024), box.y + box.height * y / Number(await canvas.getAttribute('data-logical-height') ?? 768));
}
async function launch(page: Page) {
  await page.getByTestId('open-hks').click();
  await expect(page.getByTestId('hks-overlay')).toBeVisible();
  await expect(page.getByTestId('hks-loading')).toHaveCount(0, { timeout: 30000 });
  await expect(page.getByTestId('hks-error')).toHaveCount(0);
  const canvas = page.frameLocator('[data-testid="hks-frame"]').locator('canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await snapshot(canvas)).scene).toContain('MenuScene');
  return canvas;
}
async function startGame(page: Page, canvas: Locator) {
  const width = Number(await canvas.getAttribute('data-logical-width') ?? 1024);
  await clickGame(page, canvas, width / 2, 395);
  await expect.poll(async () => (await snapshot(canvas)).scene, { timeout: 10000 }).toContain('TutorialScene');
  await clickGame(page, canvas, width - 44, 37);
  await expect.poll(async () => (await snapshot(canvas)).scene, { timeout: 15000 }).toContain('GameScene');
  await expect.poll(async () => (await snapshot(canvas)).ended).toBe(false);
}

test('Hks real play: movement, natural defeat, menu replay, exit and campus restoration', async ({ page }, testInfo) => {
  test.setTimeout(360000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByTestId('quest-start').click();
  const originalStatus = await page.getByTestId('quest-status').textContent() ?? '';
  const campusCanvas = page.getByTestId('campus-canvas');
  const canvas = await launch(page);
  await expect(campusCanvas).toHaveAttribute('data-paused', 'true');
  const frozenFrame = await campusCanvas.getAttribute('data-frame');
  await page.screenshot({ path: 'test-results/hks-menu.png', fullPage: true });
  await startGame(page, canvas);
  const before = await snapshot(canvas);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(1300); await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => (await snapshot(canvas)).x, { timeout: 10000 }).toBeLessThan((before.x ?? 960) - 30);
  expect(await campusCanvas.getAttribute('data-frame')).toBe(frozenFrame);
  await page.screenshot({ path: 'test-results/hks-gameplay.png', fullPage: true });

  // Natural loss trial: leave the base unprotected using real keys, not state injection.
  const deadline = Date.now() + 180000;
  let state = await snapshot(canvas);
  while (!state.ended && Date.now() < deadline) {
    if (state.levelUp) await clickGame(page, canvas, 512, 364);
    else if (state.paused) await clickGame(page, canvas, 900, 700);
    else {
      await page.keyboard.down('ArrowLeft');
      await page.waitForTimeout(1800);
      await page.keyboard.up('ArrowLeft');
    }
    await page.waitForTimeout(400);
    state = await snapshot(canvas);
  }
  await testInfo.attach('hks-natural-trial-state', { body: JSON.stringify(state, null, 2), contentType: 'application/json' });
  expect(state.ended, 'Real combat should reach its natural defeat state when the base is abandoned').toBe(true);
  expect(state.remaining).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/hks-defeat.png', fullPage: true });
  await clickGame(page, canvas, 512, 529);
  await expect.poll(async () => (await snapshot(canvas)).scene, { timeout: 10000 }).toContain('MenuScene');
  await startGame(page, canvas);
  expect((await snapshot(canvas)).remaining).toBeGreaterThan(290);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('hks-overlay')).toHaveCount(0);
  await expect(campusCanvas).toHaveAttribute('data-paused', 'false');
  await expect(page.getByTestId('quest-status')).toHaveText(originalStatus);
  await expect(page.getByTestId('open-hks')).toBeFocused();
  await launch(page); await page.getByTestId('hks-return').click();
  await expect(page.getByTestId('hks-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe('touch-capable phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
test('Hks mobile launch and failed-load return always leave campus usable', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); const canvas = await launch(page);
  await expect(page.getByTestId('hks-return')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: 'test-results/hks-mobile-menu.png', fullPage: true });
  const box = await canvas.boundingBox();
  expect(box!.height).toBeGreaterThan(500);
  await startGame(page, canvas);
  const before = await snapshot(canvas);
  const touch = await page.context().newCDPSession(page);
  const r = await canvas.boundingBox();
  const x = r!.x + r!.width * .2, y = r!.y + r!.height * .75;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 60, y, id: 1 }] });
  await page.waitForTimeout(900);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await snapshot(canvas)).x).toBeGreaterThan((before.x ?? 960) + 20);
  await page.screenshot({ path: 'test-results/hks-mobile-play.png', fullPage: true });
  await page.getByTestId('hks-return').click();
  await page.route('**/games/hks/index.html', route => route.abort());
  await page.getByTestId('open-hks').click();
  await expect(page.getByTestId('hks-error')).toBeVisible({ timeout: 25000 });
  await page.getByTestId('hks-return').click();
  await expect(page.getByTestId('hks-overlay')).toHaveCount(0);
  await expect(page.getByTestId('campus-canvas')).toHaveAttribute('data-paused', 'false');
});

});
