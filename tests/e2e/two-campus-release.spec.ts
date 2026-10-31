import { expect, test, type Locator, type Page } from '@playwright/test';
import { position, walkTo } from './campus-walk';
import { campuses } from '../../src/campus-data/campuses';

async function waitForCampus(canvas: Locator, id: 'yingxi' | 'huyu') {
  await expect(canvas).toHaveAttribute('data-campus-ready', id, { timeout: 30000 });
}

async function aimAt(page: Page, canvas: Locator, target: [number, number]) {
  const [x,,z] = await position(canvas), yaw = Number(await canvas.getAttribute('data-camera-yaw'));
  const pitch = Number(await canvas.getAttribute('data-camera-pitch'));
  const box = await canvas.boundingBox();
  if (!box || ![x,z,yaw,pitch].every(Number.isFinite)) throw Error('Missing view telemetry');
  const desired = Math.atan2(target[0] - x, target[1] - z);
  const turn = Math.atan2(Math.sin(desired - yaw), Math.cos(desired - yaw));
  const px = box.x + box.width * .5, py = box.y + box.height * .5;
  const frame = Number(await canvas.getAttribute('data-frame'));
  await page.mouse.move(px, py); await page.mouse.down();
  try { await page.mouse.move(px - turn / .005, py + (-.2 - pitch) / .004, { steps: 12 }); }
  finally { await page.mouse.up(); }
  await expect.poll(async () => Number(await canvas.getAttribute('data-frame')), { timeout: 15000 }).toBeGreaterThanOrEqual(frame + 6);
}

// Release evidence: no game-state mutation or teleportation. Position is read-only;
// movement and view changes are delivered through ordinary keyboard/touch/UI input.
test.describe('two-campus release journeys', () => {
  test('desktop movement and map return in both campuses after repeated switches', async ({ page }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    const canvas = page.getByTestId('campus-canvas');
    for (const campus of ['yingxi', 'huyu', 'yingxi', 'huyu'] as const) {
      await page.getByTestId(`campus-${campus}`).click();
      await expect(page.getByTestId(`campus-${campus}`)).toHaveAttribute('aria-pressed', 'true');
      await waitForCampus(canvas, campus);
      await expect(canvas).toBeVisible();
      await expect.poll(() => canvas.getAttribute('data-player-x'), { timeout: 15000 }).not.toBeNull();
      const before = await position(canvas);
      await canvas.focus();
      await page.keyboard.down('w');
      try {
        await expect.poll(async () => {
          const p = await position(canvas); return Math.hypot(p[0] - before[0], p[2] - before[2]);
        }, { timeout: 15000 }).toBeGreaterThan(.5);
      } finally { await page.keyboard.up('w'); }
      const atMap = await position(canvas);
      await page.getByRole('button', { name: '打开校园地图' }).click();
      await expect(canvas).toHaveAttribute('data-view', 'map');
      await page.getByRole('button', { name: '返回人物视角' }).click();
      await expect(canvas).toHaveAttribute('data-view', 'player');
      const returned = await position(canvas);
      expect(Math.hypot(returned[0] - atMap[0], returned[2] - atMap[2])).toBeLessThan(.25);
      await page.screenshot({ path: info.outputPath(`desktop-${campus}-${Date.now()}.png`) });
    }
    await expect(page.getByTestId('scene-error')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Huyu connected landmark journey by real keyboard input', async ({ page }, info) => {
    test.setTimeout(600000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.getByTestId('campus-huyu').click();
    const canvas = page.getByTestId('campus-canvas');
    await waitForCampus(canvas, 'huyu');
    await expect(canvas).toBeVisible();
    await expect.poll(() => canvas.getAttribute('data-player-x'), { timeout: 15000 }).not.toBeNull();
    const observations: unknown[] = [];
    for (const id of ['hy-north-gate', 'hy-main', 'hy-library', 'hy-meihua', 'hy-training']) {
      const landmark = campuses.huyu.landmarks.find(item => item.id === id);
      if (!landmark) throw Error(`Missing landmark ${id}`);
      const before = await position(canvas);
      await walkTo(page, canvas, campuses.huyu, landmark.arrival);
      const after = await position(canvas);
      expect(Math.hypot(after[0] - landmark.arrival[0], after[2] - landmark.arrival[1])).toBeLessThan(4.5);
      observations.push({ id, before, after, target: landmark.arrival });
      await aimAt(page, canvas, landmark.position);
      await page.screenshot({ path: info.outputPath(`huyu-route-${id}.png`) });
      // Arrival positions demonstrate gameplay. Additional genuinely walked,
      // more distant viewpoints provide context rather than cropped facades.
      const wide: Record<string, [number, number]> = {
        'hy-north-gate': [12, -170], 'hy-library': [75, -47], 'hy-meihua': [-75, -8],
      };
      if (wide[id]) {
        await walkTo(page, canvas, campuses.huyu, wide[id]);
        const viewpoint = await position(canvas);
        expect(Math.hypot(viewpoint[0] - wide[id][0], viewpoint[2] - wide[id][1])).toBeLessThan(4.5);
        await aimAt(page, canvas, landmark.position);
        observations.push({ id, wideViewpoint: viewpoint, target: wide[id] });
        await page.screenshot({ path: info.outputPath(`huyu-wide-${id}.png`) });
      }
    }
    expect(errors).toEqual([]);
    await info.attach('huyu-route-positions', { body: JSON.stringify(observations, null, 2), contentType: 'application/json' });
    await expect(page.getByTestId('scene-error')).toHaveCount(0);
  });

  test('Yingxi garden to library axis by real keyboard input', async ({ page }, info) => {
    test.setTimeout(600000);
    await page.goto('/');
    await page.getByTestId('campus-yingxi').click();
    const canvas = page.getByTestId('campus-canvas');
    await waitForCampus(canvas, 'yingxi');
    await expect(canvas).toBeVisible();
    await expect.poll(() => canvas.getAttribute('data-player-x'), { timeout: 15000 }).not.toBeNull();
    for (const id of ['yx-mechanical', 'yx-garden', 'yx-library']) {
      const landmark = campuses.yingxi.landmarks.find(item => item.id === id);
      if (!landmark) throw Error(`Missing landmark ${id}`);
      await walkTo(page, canvas, campuses.yingxi, landmark.arrival);
      const p = await position(canvas);
      expect(Math.hypot(p[0] - landmark.arrival[0], p[2] - landmark.arrival[1])).toBeLessThan(4.5);
      await aimAt(page, canvas, landmark.position);
      await page.screenshot({ path: info.outputPath(`yingxi-route-${id}.png`) });
    }
    await expect(page.getByTestId('scene-error')).toHaveCount(0);
  });

  test.describe('landscape touch', () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });
    test('movement and map return in each campus', async ({ page }, info) => {
      test.setTimeout(120000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/');
      const canvas = page.getByTestId('campus-canvas');
      const touch = await page.context().newCDPSession(page);
        for (const campus of ['yingxi', 'huyu', 'yingxi', 'huyu'] as const) {
        await page.getByTestId(`campus-${campus}`).tap();
        await expect(page.getByTestId(`campus-${campus}`)).toHaveAttribute('aria-pressed', 'true');
        await waitForCampus(canvas, campus);
        await expect(canvas).toBeVisible();
        await expect.poll(() => canvas.getAttribute('data-player-x'), { timeout: 15000 }).not.toBeNull();
        const before = await position(canvas), box = await canvas.boundingBox();
        if (!box) throw Error('Missing canvas bounds');
        const x = box.x + box.width * .2, y = box.y + box.height * .6;
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 65, id: 1 }] });
        const rightX = box.x + box.width * .7, yaw = Number(await canvas.getAttribute('data-camera-yaw'));
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y - 65, id: 1 }, { x: rightX, y, id: 2 }] });
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 65, id: 1 }, { x: rightX + 80, y, id: 2 }] });
        try {
          await expect.poll(async () => {
            const p = await position(canvas); return Math.hypot(p[0] - before[0], p[2] - before[2]);
          }, { timeout: 15000 }).toBeGreaterThan(.5);
        } finally { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
        const moved = await position(canvas);
        expect(Math.hypot(moved[0] - before[0], moved[2] - before[2])).toBeGreaterThan(.5);
        expect(Number(await canvas.getAttribute('data-camera-yaw'))).not.toBe(yaw);
        await page.waitForTimeout(600);
        const stopped = await position(canvas);
        expect(Math.hypot(stopped[0] - moved[0], stopped[2] - moved[2])).toBeLessThan(.5);
        await page.getByRole('button', { name: '打开校园地图' }).tap();
        await expect(canvas).toHaveAttribute('data-view', 'map');
        await page.getByRole('button', { name: '返回人物视角' }).tap();
        await expect(canvas).toHaveAttribute('data-view', 'player');
        const returned = await position(canvas);
        expect(Math.hypot(returned[0] - stopped[0], returned[2] - stopped[2])).toBeLessThan(.25);
        await page.screenshot({ path: info.outputPath(`touch-${campus}-${Date.now()}.png`) });
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await expect(page.getByTestId('scene-error')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  });
});
