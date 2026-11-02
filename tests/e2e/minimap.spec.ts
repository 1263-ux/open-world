import { expect, test, type Locator, type Page } from '@playwright/test';
import { position } from './campus-walk';

// Only genuine input changes state. The minimap exposes its marker's raw world
// coordinates as read-only attributes to compare with the real player.
async function checkMarker(canvas: Locator, marker: Locator) {
  await expect.poll(async () => {
    const p = await position(canvas), x = Number(await marker.getAttribute('data-x')), z = Number(await marker.getAttribute('data-z'));
    return Math.hypot(p[0] - x, p[2] - z);
  }, { timeout: 15000 }).toBeLessThan(.5);
}
async function returnFromMap(page: Page, canvas: Locator, before: [number, number, number]) {
  await expect(canvas).toHaveAttribute('data-view', 'map');
  await page.getByRole('button', { name: '返回人物视角' }).click();
  await expect(canvas).toHaveAttribute('data-view', 'player');
  const after = await position(canvas);
  expect(Math.hypot(after[0] - before[0], after[2] - before[2])).toBeLessThan(.25);
}

for (const mode of ['desktop', 'landscape touch'] as const) {
  test.describe(`minimap ${mode}`, () => {
    if (mode === 'landscape touch') test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });
    test('tracks movement, switches campus and opens full-campus view without losing position', async ({ page }, info) => {
      test.setTimeout(120000);
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto('/');
      const canvas = page.getByTestId('campus-canvas'), button = page.getByTestId('campus-minimap');
      const marker = page.getByTestId('minimap-player'), campusLabel = page.getByTestId('minimap-campus');
      for (const id of ['yingxi', 'huyu', 'yingxi'] as const) {
        await page.getByTestId(`campus-${id}`).click();
        await expect(canvas).toHaveAttribute('data-campus-ready', id, {timeout:30000});
        const frame = Number(await canvas.getAttribute('data-frame'));
        await expect.poll(async () => Number(await canvas.getAttribute('data-frame')), {timeout:30000}).toBeGreaterThanOrEqual(frame + 2);
        await expect(campusLabel).toHaveAttribute('data-campus', id);
        await expect(button).toBeVisible(); await checkMarker(canvas, marker);
        const minimapBox = await button.boundingBox(), viewport = page.viewportSize();
        if (!minimapBox || !viewport) throw Error('Missing minimap bounds');
        expect(minimapBox.x).toBeGreaterThanOrEqual(0); expect(minimapBox.y).toBeGreaterThanOrEqual(0);
        expect(minimapBox.x + minimapBox.width).toBeLessThanOrEqual(viewport.width);
        expect(minimapBox.y + minimapBox.height).toBeLessThanOrEqual(viewport.height);
        for (const control of [page.getByTestId('open-hks'), page.getByTestId('campus-yingxi'), page.getByTestId('campus-huyu')]) {
          const b = await control.boundingBox(); if (!b) throw Error('Missing primary control bounds');
          const overlap = Math.max(0, Math.min(minimapBox.x + minimapBox.width, b.x + b.width) - Math.max(minimapBox.x, b.x)) *
            Math.max(0, Math.min(minimapBox.y + minimapBox.height, b.y + b.height) - Math.max(minimapBox.y, b.y));
          expect(overlap, 'Minimap must not obstruct primary controls').toBe(0);
        }
        const objective = page.getByTestId('current-objective');
        await expect(objective).toBeVisible();
        const objectiveBox = await objective.boundingBox(); if (!objectiveBox) throw Error('Missing current-objective bounds');
        const objectiveOverlap = Math.max(0, Math.min(minimapBox.x + minimapBox.width, objectiveBox.x + objectiveBox.width) - Math.max(minimapBox.x, objectiveBox.x)) *
          Math.max(0, Math.min(minimapBox.y + minimapBox.height, objectiveBox.y + objectiveBox.height) - Math.max(minimapBox.y, objectiveBox.y));
        expect(objectiveOverlap, 'Current objective must leave the actual minimap visible and clickable').toBe(0);
        if (mode === 'landscape touch') {
          const stick = await page.locator('.virtual-stick').boundingBox(); if (!stick) throw Error('Missing visible stick bounds');
          const stickOverlap = Math.max(0, Math.min(stick.x + stick.width, objectiveBox.x + objectiveBox.width) - Math.max(stick.x, objectiveBox.x)) *
            Math.max(0, Math.min(stick.y + stick.height, objectiveBox.y + objectiveBox.height) - Math.max(stick.y, objectiveBox.y));
          expect(stickOverlap, 'Current objective must also leave the visible joystick unobstructed').toBe(0);
        }

        const before = await position(canvas);
        if (mode === 'desktop') {
          await canvas.focus(); await page.keyboard.down('w');
          try { await expect.poll(async () => { const p = await position(canvas); return Math.hypot(p[0]-before[0],p[2]-before[2]); }, {timeout:15000}).toBeGreaterThan(.5); }
          finally { await page.keyboard.up('w'); }
        } else {
          const box = await canvas.boundingBox(); if (!box) throw Error('Missing canvas bounds');
          const touch = await page.context().newCDPSession(page), x = box.x + box.width * .2, y = box.y + box.height * .6;
          await touch.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x,y,id:1}]});
          try {
            await touch.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x,y:y-65,id:1}]});
            await expect.poll(async () => { const p = await position(canvas); return Math.hypot(p[0]-before[0],p[2]-before[2]); }, {timeout:15000}).toBeGreaterThan(.5);
          } finally { await touch.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]}); await touch.detach(); }
        }
        await checkMarker(canvas, marker);
        const mapPosition = await position(canvas);
        if (mode === 'landscape touch') await button.tap(); else await button.click();
        await returnFromMap(page, canvas, mapPosition);
        await page.screenshot({path:info.outputPath(`${mode.replace(' ', '-')}-${id}-minimap.png`)});
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await expect(page.getByTestId('scene-error')).toHaveCount(0); expect(errors).toEqual([]);
    });
  });
}
