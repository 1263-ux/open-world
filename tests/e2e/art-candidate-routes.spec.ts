import { expect, test, type Locator, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { campuses } from '../../src/campus-data/campuses';
import type { CampusId, Point2 } from '../../src/shared/contracts';
import { position, walkTo } from './campus-walk';

// Combined local candidate gate, not a replacement for visual review or the full
// photo/control/touch suites. All state changes use normal UI/keyboard/pointer
// input. Telemetry and save data are read only; no teleport or progress injection.
async function frames(canvas: Locator, count = 3) {
  const before = Number(await canvas.getAttribute('data-frame'));
  expect(Number.isFinite(before)).toBe(true);
  await expect.poll(async () => Number(await canvas.getAttribute('data-frame')), { timeout: 30000 }).toBeGreaterThanOrEqual(before + count);
}
async function aim(page: Page, canvas: Locator, target: Point2) {
  const [x,,z] = await position(canvas), box = await canvas.boundingBox();
  const yaw = Number(await canvas.getAttribute('data-camera-yaw')), pitch = Number(await canvas.getAttribute('data-camera-pitch'));
  if (!box || ![yaw, pitch].every(Number.isFinite)) throw Error('Missing camera telemetry');
  const desired = Math.atan2(target[0] - x, target[1] - z);
  const turn = Math.atan2(Math.sin(desired - yaw), Math.cos(desired - yaw));
  const px = box.x + box.width / 2, py = box.y + box.height / 2;
  await page.mouse.move(px, py); await page.mouse.down();
  try { await page.mouse.move(px - turn / .005, py + (-.2 - pitch) / .004, { steps: 12 }); }
  finally { await page.mouse.up(); }
  await frames(canvas, 6);
}
async function savedState(page: Page, canvas: Locator) {
  return { position: await position(canvas), yaw: await canvas.getAttribute('data-camera-yaw'),
    pitch: await canvas.getAttribute('data-camera-pitch'), quest: await page.getByTestId('quest-status').textContent(),
    photo: await page.evaluate(() => localStorage.getItem('campus-atlas:photo-stamps:v1')) };
}
async function unchanged(page: Page, canvas: Locator, before: Awaited<ReturnType<typeof savedState>>) {
  await frames(canvas);
  const after = await savedState(page, canvas);
  expect(Math.hypot(after.position[0] - before.position[0], after.position[2] - before.position[2])).toBeLessThan(.1);
  expect(after.yaw).toBe(before.yaw); expect(after.pitch).toBe(before.pitch);
  expect(after.quest).toBe(before.quest); expect(after.photo).toBe(before.photo);
}
async function minimapRoundTrip(page: Page, canvas: Locator, campus: CampusId) {
  const before = await savedState(page, canvas), marker = page.getByTestId('minimap-player');
  await expect(page.getByTestId('minimap-campus')).toHaveAttribute('data-campus', campus);
  await expect.poll(async () => Math.hypot(Number(await marker.getAttribute('data-x')) - before.position[0],
    Number(await marker.getAttribute('data-z')) - before.position[2]), { timeout: 15000 }).toBeLessThan(.5);
  await page.getByTestId('campus-minimap').click();
  await expect(canvas).toHaveAttribute('data-view', 'map');
  await page.getByRole('button', { name: '返回人物视角' }).click();
  await expect(canvas).toHaveAttribute('data-view', 'player');
  await unchanged(page, canvas, before);
}
async function hksRoundTrip(page: Page, canvas: Locator) {
  const before = await savedState(page, canvas);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByTestId('open-hks').click();
    await expect(canvas).toHaveAttribute('data-paused', 'true');
    await expect(page.getByTestId('hks-loading')).toHaveCount(0, { timeout: 30000 });
    await expect(page.getByTestId('hks-error')).toHaveCount(0);
    const game = page.frameLocator('[data-testid="hks-frame"]').locator('canvas');
    const state = async (): Promise<{ scene?: string; remaining?: number }> => JSON.parse(await game.getAttribute('data-hks-state') ?? '{}');
    await expect(game).toHaveAttribute('data-logical-width', '1280');
    await expect(game).toHaveAttribute('data-logical-height', '720');
    await expect.poll(async () => (await state()).scene).toContain('MenuScene');
    if (attempt === 0) {
      const click = async (x: number, y: number) => {
        const b = await game.boundingBox(); if (!b) throw Error('Missing Hks canvas');
        await game.click({ position: { x: x * b.width / 1280, y: y * b.height / 720 } });
      };
      await click(640, 395);
      await expect.poll(async () => (await state()).scene).toContain('TutorialScene');
      await click(1236, 37);
      await expect.poll(async () => (await state()).scene).toContain('GameScene');
      expect((await state()).remaining).toBeGreaterThan(410);
      // Enter a natural battle, then explicitly exit: no claim of a completed run.
    }
    await page.getByTestId('hks-return').click();
    await expect(page.getByTestId('hks-overlay')).toHaveCount(0);
    await expect(canvas).toHaveAttribute('data-paused', 'false');
    await unchanged(page, canvas, before);
  }
}

const journeys: Record<CampusId, string[]> = {
  huyu: ['hy-north-gate', 'hy-main', 'hy-meihua', 'hy-library', 'hy-training'],
  yingxi: ['yx-office', 'yx-mechanical', 'yx-garden', 'yx-library'],
};
for (const campusId of ['huyu', 'yingxi'] as const) {
  test(`combined candidate ${campusId}: entrance to landmarks, minimap and Hks continuity`, async ({ page }, info) => {
    test.setTimeout(1200000);
    const errors: string[] = [], observations: unknown[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const identity = await Promise.all(['src/scene/CampusScene.ts', 'src/scene/PlayerController.ts',
      'src/scene/HuyuCourtyards.ts', 'src/campus-data/spatial.json',
      'public/assets/campuses/huyu/meihua-classroom-group.glb'].map(async path =>
      ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })));
    await info.attach('candidate-source-identity', { body: JSON.stringify(identity, null, 2), contentType: 'application/json' });
    await page.goto('/'); await page.getByTestId(`campus-${campusId}`).click();
    const campus = campuses[campusId], canvas = page.getByTestId('campus-canvas');
    await expect(canvas).toHaveAttribute('data-campus-ready', campusId, { timeout: 30000 });
    await expect(canvas).toHaveAttribute('data-player-model', 'ready', { timeout: 30000 });
    if (campusId === 'huyu') {
      await expect(canvas).toHaveAttribute('data-model-hy-meihua', 'ready', { timeout: 30000 });
      await expect(canvas).toHaveAttribute('data-huyu-tree-texture', 'ready', { timeout: 30000 });
    }
    await frames(canvas);
    try {
      // Yingxi's default scenic spawn is not its entrance: walk there, never
      // inject the entrance coordinate, before beginning the connected route.
      await canvas.focus(); await walkTo(page, canvas, campus, campus.start);
      const entrance = await position(canvas);
      expect(Math.hypot(entrance[0] - campus.start[0], entrance[2] - campus.start[1])).toBeLessThan(4.5);
      observations.push({ id: 'entrance', position: entrance });
      await page.screenshot({ path: info.outputPath(`${campusId}-entrance.png`) });
      for (const id of journeys[campusId]) {
        const landmark = campus.landmarks.find(item => item.id === id);
        if (!landmark) throw Error(`Missing landmark ${id}`);
        await canvas.focus(); await walkTo(page, canvas, campus, landmark.arrival);
        await frames(canvas);
        const p = await position(canvas);
        expect(Math.hypot(p[0] - landmark.arrival[0], p[2] - landmark.arrival[1])).toBeLessThan(4.5);
        await aim(page, canvas, landmark.position);
        const stopped = await position(canvas); await frames(canvas, 6);
        const later = await position(canvas);
        expect(Math.hypot(stopped[0] - later[0], stopped[2] - later[2])).toBeLessThan(.1);
        await minimapRoundTrip(page, canvas, campusId);
        observations.push({ id, position: later, yaw: await canvas.getAttribute('data-camera-yaw'),
          drawCalls: await canvas.getAttribute('data-draw-calls'), triangles: await canvas.getAttribute('data-triangles') });
        await page.screenshot({ path: info.outputPath(`${campusId}-${id}.png`) });
        const wide: Record<string, Point2> = {
          'hy-north-gate': [12, -170], 'hy-library': [75, -47], 'hy-meihua': [-75, -8],
        };
        const pocket: Record<string, Point2> = {
          'hy-north-gate': [1, -177], 'hy-library': [79, -40], 'hy-meihua': [-90, -6],
        };
        if (wide[id]) {
          await canvas.focus(); await walkTo(page, canvas, campus, wide[id]);
          const viewpoint = await position(canvas);
          expect(Math.hypot(viewpoint[0] - wide[id][0], viewpoint[2] - wide[id][1])).toBeLessThan(4.5);
          await aim(page, canvas, landmark.position);
          await page.screenshot({ path: info.outputPath(`${campusId}-${id}-wide.png`) });
          await aim(page, canvas, pocket[id]!);
          await page.screenshot({ path: info.outputPath(`${campusId}-${id}-pocket.png`) });
          observations.push({ id, wideViewpoint: viewpoint, pocketTarget: pocket[id] });
        }
      }
      await hksRoundTrip(page, canvas);
      await expect(page.getByTestId('scene-error')).toHaveCount(0); expect(errors).toEqual([]);
    } finally {
      await info.attach('route-observations', { body: JSON.stringify({ observations, errors }, null, 2), contentType: 'application/json' });
    }
  });
}
