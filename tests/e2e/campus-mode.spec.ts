import { campuses } from '../../src/campus-data/campuses';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import type { CampusId, Point2 } from '../../src/shared/contracts';
import { IDEAL_FACILITIES } from '../../src/scene/IdealCampusLayer';
import { position, walkTo } from './campus-walk';
import { ascend, descend, dragLook, launch, reachStation, walkAuthoredSegment, waitForSettledCamera, waitForSimulatedAdvance, planeState } from './complete-release-helpers';

test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
// New recovery candidate; all state changes go through visible controls.
async function snapshot(canvas: Locator) {
  return canvas.evaluate(e => { const d = (e as HTMLElement).dataset; return { xyz: [Number(d.playerX), Number(d.playerY), Number(d.playerZ)], yaw: d.cameraYaw, pitch: d.cameraPitch, mode: d.campusMode, world: d.worldGeneration, collision: Number(d.collisionGeneration), geometries: Number(d.geometries), textures: Number(d.textures), quality: d.renderQuality, ratio: d.renderRatio, shadow: d.shadowType, camera: [d.cameraX, d.cameraY, d.cameraZ], frame: Number(d.frame) }; });
}
async function progress(page: Page) { return page.evaluate(() => ({ journey: localStorage.getItem('campus-atlas:journey:v1'), photos: localStorage.getItem('campus-atlas:photo-stamps:v1'), quests: localStorage.getItem('campus-atlas:quests') })); }
async function ready(page: Page, reference = true) {
  await page.goto(reference ? '/?render-quality=reference' : '/'); const canvas = page.getByTestId('campus-canvas');
  await expect(canvas).toHaveAttribute('data-campus-ready', 'yingxi', { timeout: 30000 });
  await page.getByRole('button', { name: '开始手记', exact: true }).click();
  for (const name of ['player-model', 'hero-model', 'model-yx-garden-setting']) await expect(canvas).toHaveAttribute(`data-${name}`, 'ready', { timeout: 30000 });
  await expect(canvas).toHaveAttribute('data-render-quality', reference ? 'reference' : 'adaptive');
  if (reference) await expect(canvas).toHaveAttribute('data-render-ratio', '1.00');
  return canvas;
}
async function toggle(page: Page, canvas: Locator, expected: 'base' | 'ideal', touch = false) {
  const before = await snapshot(canvas), saved = await progress(page);
  if (touch) await page.getByTestId('campus-mode-toggle').tap(); else await page.getByTestId('campus-mode-toggle').click();
  await expect(canvas).toHaveAttribute('data-campus-mode', expected); await waitForSettledCamera(page, canvas, 45000);
  const after = await snapshot(canvas);
  expect(after.xyz).toEqual(before.xyz); expect(after.yaw).toBe(before.yaw); expect(after.pitch).toBe(before.pitch); expect(after.world).toBe(before.world); expect(after.collision).toBe(before.collision + 1); expect(await progress(page)).toEqual(saved);
  if (touch) await page.getByRole('button', { name: '关闭模式提示', exact: true }).tap(); else await page.getByRole('button', { name: '关闭模式提示', exact: true }).click();
  return after;
}
async function denied(page: Page, canvas: Locator, reason: RegExp, onDeck = false) {
  const before = await snapshot(canvas), saved = await progress(page);
  await page.getByTestId('campus-mode-toggle').click(); await expect(page.getByTestId('campus-mode-feedback')).toContainText(reason);
  const after = await snapshot(canvas);
  expect(after.mode).toBe(before.mode); expect(after.collision).toBe(before.collision);
  // The existing contact solver uses a 1mm pushout; short input-event dt can
  // sample between contact frames. This exception applies only on the same deck.
  if (onDeck) {
    expect([after.xyz[0], after.xyz[2]]).toEqual([before.xyz[0], before.xyz[2]]);
    expect(Math.abs(after.xyz[1]! - before.xyz[1]!)).toBeLessThanOrEqual(.002);
    for (const state of [before, after]) expect(Math.abs(state.xyz[1]! - 1.2)).toBeLessThanOrEqual(.002);
    console.log('[MODE_DECK_DENIED]', JSON.stringify({ before, after, supportTolerance: .002 }));
  } else expect(after.xyz).toEqual(before.xyz);
  expect(after.yaw).toBe(before.yaw); expect(after.pitch).toBe(before.pitch); expect(await progress(page)).toEqual(saved);
  await page.getByRole('button', { name: '关闭模式提示', exact: true }).click();
}
async function localRoute(page: Page, canvas: Locator, points: Point2[]) { for (const point of points) await walkAuthoredSegment(page, canvas, point); }
async function evidence(page: Page, canvas: Locator, info: TestInfo, label: string) {
  const state = { ...await snapshot(canvas), progress: await progress(page), viewport: page.viewportSize(), dpr: await page.evaluate(() => devicePixelRatio) };
  console.log('[CAMPUS_MODE]', JSON.stringify({ label, ...state })); await info.attach(label, { body: JSON.stringify(state, null, 2), contentType: 'application/json' });
}

test('both campuses: same-pose mode swaps, stable resources, two real entrances and retained preference', async ({ page }, info) => {
  test.setTimeout(600000); const canvas = await ready(page); await expect(canvas).toHaveAttribute('data-campus-mode', 'base');
  for (const id of ['yingxi', 'huyu'] as CampusId[]) {
    if (id === 'huyu') {
      await page.getByTestId('campus-huyu').click(); await expect(canvas).toHaveAttribute('data-campus-ready', 'huyu', { timeout: 30000 });
      await expect(canvas).toHaveAttribute('data-campus-mode', 'ideal');
      await expect(canvas).toHaveAttribute('data-hero-model', 'ready', { timeout: 30000 });
      await expect(canvas).toHaveAttribute('data-huyu-tree-texture', 'ready', { timeout: 30000 });
      await toggle(page, canvas, 'base');
    }
    const point = IDEAL_FACILITIES[id].sharedGroundZones[0]!.center;
    // Campus A* knows source buildings, not the platform/stair guards. Stage west
    // then follow open north ground at z172, never snap a route through the stairs.
    if (id === 'yingxi') { await walkTo(page, canvas, campuses[id], [54, 172], .9); await localRoute(page, canvas, [[54, 172], [69, 172], point]); }
    else { await walkTo(page, canvas, campuses[id], point, .9); await walkAuthoredSegment(page, canvas, point); }
    const pose = await snapshot(canvas), yaw = id === 'huyu' ? -Math.PI / 2 : Math.PI / 2;
    await dragLook(page, canvas, -(yaw - Number(pose.yaw)) / .005, (-.15 - Number(pose.pitch)) / .004); await waitForSettledCamera(page, canvas, 45000);
    const base = await snapshot(canvas);
    // Three r186 removed PCFSoft(2); fixed reference uses supported PCF(1), never Basic(0).
    expect(base.shadow).toBe('1');
    await evidence(page, canvas, info, `${id}-reference-base`); await page.screenshot({ path: info.outputPath(`${id}-reference-base.png`) });
    const ideal = await toggle(page, canvas, 'ideal'); expect(ideal.camera).toEqual(base.camera); expect(ideal.ratio).toBe(base.ratio); expect(ideal.shadow).toBe(base.shadow);
    await evidence(page, canvas, info, `${id}-reference-ideal`); await page.screenshot({ path: info.outputPath(`${id}-reference-ideal.png`) });
    const warm = await toggle(page, canvas, 'base');
    for (let i = 0; i < 3; i++) { await toggle(page, canvas, 'ideal'); const back = await toggle(page, canvas, 'base'); expect(back.geometries).toBe(warm.geometries); expect(back.textures).toBe(warm.textures); }
    await toggle(page, canvas, 'ideal');
    if (id === 'yingxi') {
      await localRoute(page, canvas, [[69, 173], [73.5, 173], [73.5, 176]]); await denied(page, canvas, /走出原创设施/);
      await localRoute(page, canvas, [[73.5, 182], [73.5, 185], [69, 185], [69, 173]]);
    } else {
      await localRoute(page, canvas, [[-49, -98], [-54, -98], [-60, -98]]); await denied(page, canvas, /走出原创设施/);
      await localRoute(page, canvas, [[-60, -90], [-54, -90], [-49, -90], [-49, -98]]);
    }
    await expect.poll(async () => (await position(canvas))[1]).toBeLessThan(.2); await evidence(page, canvas, info, `${id}-ideal-loop`);
    await toggle(page, canvas, 'base'); await toggle(page, canvas, 'ideal');
  }
  expect(await page.evaluate(() => localStorage.getItem('campus-atlas:campus-mode:v1'))).toBe('ideal');
  const saved = await progress(page); await page.reload(); await expect(canvas).toHaveAttribute('data-campus-ready', 'huyu', { timeout: 30000 }); await expect(canvas).toHaveAttribute('data-campus-mode', 'ideal'); expect(await progress(page)).toEqual(saved);
});

test('activity and elevated gates reject mode changes without teleporting or modifying the journey', async ({ page }, info) => {
  test.setTimeout(360000); const canvas = await ready(page);
  await page.getByRole('button', { name: '打开校园地图' }).click(); await denied(page, canvas, /退出当前活动或地图/); await page.getByRole('button', { name: '返回人物视角' }).click();
  await page.getByTestId('open-photo-album').click(); await expect(page.getByTestId('photo-complete')).toBeVisible();
  await expect(page.getByTestId('campus-mode-toggle').locator('xpath=ancestor::*[@inert]')).toHaveCount(1); await expect(canvas).toHaveAttribute('data-campus-mode', 'base'); await page.keyboard.press('Escape');
  await page.getByTestId('open-hks').click(); await expect(page.getByTestId('campus-mode-toggle').locator('xpath=ancestor::*[@inert]')).toHaveCount(1); await expect(canvas).toHaveAttribute('data-campus-mode', 'base'); await page.getByTestId('hks-return').click();
  await ascend(page, canvas); await denied(page, canvas, /走下台阶.*站稳/, true); await descend(page, canvas);
  await reachStation(page, canvas); await page.getByTestId('begin-paperplane').click(); await launch(page); await waitForSimulatedAdvance(canvas, (await planeState(canvas)).elapsed);
  await denied(page, canvas, /退出飞行|当前活动/); await page.keyboard.press('Escape'); await expect(canvas).toHaveAttribute('data-view', 'player');
  await evidence(page, canvas, info, 'base-activity-gates');
});

test.describe('natural adaptive landscape touch mode', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  test('actual joystick and touch mode swaps preserve pose and report natural adaptive quality', async ({ page }, info) => {
    test.setTimeout(240000); const canvas = await ready(page, false), cdp = await page.context().newCDPSession(page);
    const before = await snapshot(canvas);
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: 70, y: 280 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: 70, y: 260 }] });
      await page.waitForTimeout(300); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(async () => Math.hypot(...(await snapshot(canvas)).xyz.map((v, i) => v - before.xyz[i]!))).toBeGreaterThan(.05);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 2, x: 620, y: 160 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 2, x: 650, y: 165 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await waitForSettledCamera(page, canvas, 45000); expect((await snapshot(canvas)).yaw).not.toBe(before.yaw);
      for (let i = 0; i < 3; i++) { await toggle(page, canvas, 'ideal', true); await toggle(page, canvas, 'base', true); }
      const start = await snapshot(canvas), wall = Date.now(); await page.waitForTimeout(10000); const end = await snapshot(canvas);
      console.log('[MODE_NATURAL_ADAPTIVE]', JSON.stringify({ start, end, wallSeconds: (Date.now() - wall) / 1000, frames: end.frame - start.frame, simulatedTouchNotPhysicalDevice: true }));
      await evidence(page, canvas, info, 'natural-adaptive-touch');
    } finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {}); await cdp.detach().catch(() => {}); }
  });
});
