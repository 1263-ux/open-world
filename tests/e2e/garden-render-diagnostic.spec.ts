import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { campuses } from '../../src/campus-data/campuses';
import { position, walkTo } from './campus-walk';

// A controlled rendering experiment, not a game-play or aesthetic PASS.
// The production module and GLB stay unchanged: only this page's Vite module
// response is instrumented, and the camera is reached with real input.
test.skip(process.env.RUN_GARDEN_RENDER_DIAGNOSTIC !== '1', 'Explicit diagnostic CI only');
test.setTimeout(600_000);

type Mode = 'read' | 'freeze' | 'receive-off' | 'paving-cast-off';
type Snapshot = {
  mode: string; ratio: number; shadowType: number; shadowsEnabled: boolean;
  cameraPosition: number[]; cameraQuaternion: number[]; projection: number[];
  playerPosition: number[]; modelMatrix: number[]; buffer: number[]; css: number[];
  nodes: { name: string; cast: boolean; receive: boolean }[];
};
const hook = async (page: Page, mode: Mode): Promise<Snapshot> => page.evaluate((requested) => {
  const diagnostic = (window as unknown as { __gardenShadowDiagnostic?: (mode: string) => Snapshot }).__gardenShadowDiagnostic;
  if (!diagnostic) throw new Error('Test-only garden diagnostic hook was not installed');
  return diagnostic(requested);
}, mode);

const instancePatch = `
window.__gardenShadowDiagnostic = (mode) => {
  const model = ownerWorld.children.find(object => object.name === 'yx-garden-setting-detail');
  if (!model || disposed || ownerWorld !== world) throw new Error('Expected live garden GLB');
  const paving = new Set(['Garden_stone', 'Garden_tile1', 'Garden_tile2', 'Garden_tile3']);
  const nodes = [];
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (mode === 'receive-off') { object.castShadow = true; object.receiveShadow = false; }
    else if (mode === 'paving-cast-off') { object.castShadow = !paving.has(object.name); object.receiveShadow = true; }
    nodes.push({ name: object.name, cast: object.castShadow, receive: object.receiveShadow });
  });
  if (mode === 'freeze') {
    if (renderRatio !== .5 || renderer.shadowMap.type !== THREE.BasicShadowMap) throw new Error('Natural .5 BasicShadowMap warmup not reached');
    diagnosticFreezeRatio = true;
  }
  if (mode === 'receive-off' || mode === 'paving-cast-off') renderer.shadowMap.needsUpdate = true;
  player.camera.updateMatrixWorld(true); model.updateMatrixWorld(true);
  return { mode, ratio: renderRatio, shadowType: renderer.shadowMap.type, shadowsEnabled: renderer.shadowMap.enabled,
    cameraPosition: player.camera.position.toArray(), cameraQuaternion: player.camera.quaternion.toArray(),
    projection: player.camera.projectionMatrix.toArray(), playerPosition: pawn.position.toArray(),
    modelMatrix: model.matrixWorld.toArray(), buffer: [canvas.width, canvas.height], css: [canvas.clientWidth, canvas.clientHeight], nodes };
};`;

async function installDiagnostic(page: Page): Promise<() => number> {
  let matches = 0;
  await page.route('**/src/scene/CampusScene.ts*', async route => {
    matches++;
    const response = await route.fetch();
    const body = await response.text();
    const anchors = [
      'let slowFrames = 0, fastFrames = 0;',
      'const ownerWorld = world;',
      'const nextRatio = slowFrames >= 3 ? Math.max(.5, renderRatio * .75) : fastFrames >= 180 ? Math.min(maxRatio, renderRatio / .75) : renderRatio;',
    ];
    for (const anchor of anchors) if (body.split(anchor).length !== 2) throw new Error(`Expected exactly one diagnostic anchor: ${anchor}`);
    const patched = body
      .replace(anchors[0]!, `${anchors[0]} let diagnosticFreezeRatio = false;`)
      .replace(anchors[1]!, `${anchors[1]}${instancePatch}`)
      .replace(anchors[2]!, anchors[2]!.replace('= slowFrames >= 3', '= diagnosticFreezeRatio ? renderRatio : slowFrames >= 3'));
    const headers: Record<string, string> = { ...response.headers(), 'content-type': 'application/javascript; charset=utf-8' };
    delete headers['content-encoding']; delete headers['content-length'];
    await route.fulfill({ response, headers, body: patched });
  });
  return () => matches;
}

async function waitFrames(canvas: Locator, count: number): Promise<void> {
  const start = Number(await canvas.getAttribute('data-frame'));
  await expect.poll(async () => Number(await canvas.getAttribute('data-frame')), { timeout: 60_000, intervals: [100] }).toBeGreaterThanOrEqual(start + count);
}
async function aimAtGarden(page: Page, canvas: Locator): Promise<void> {
  const [x,,z] = await position(canvas);
  const yaw = Number(await canvas.getAttribute('data-camera-yaw'));
  const pitch = Number(await canvas.getAttribute('data-camera-pitch'));
  const desiredYaw = Math.atan2(32.947655 - x, 211.902723 - z);
  const turn = Math.atan2(Math.sin(desiredYaw - yaw), Math.cos(desiredYaw - yaw));
  const box = await canvas.boundingBox(); if (!box) throw new Error('Missing campus canvas bounds');
  const sx = box.x + box.width * .55, sy = box.y + box.height * .5;
  await page.mouse.move(sx, sy); await page.mouse.down();
  await page.mouse.move(sx - turn / .005, sy + (-.15 - pitch) / .004, { steps: 12 });
  await page.mouse.up();
}

test('same-camera garden shadow A/B/C experiment', async ({ page }, info) => {
  const moduleCount = await installDiagnostic(page);
  await page.goto('/');
  expect(moduleCount(), 'exactly one intercepted Vite module').toBe(1);
  const canvas = page.getByTestId('campus-canvas');
  await expect(canvas).toHaveAttribute('data-model-yx-garden-setting', 'ready', { timeout: 30_000 });
  await expect(canvas).toHaveAttribute('data-player-model', 'ready', { timeout: 30_000 });
  await canvas.focus();
  await walkTo(page, canvas, campuses.yingxi, [35,193], .75);
  const [x,,z] = await position(canvas);
  expect(Math.hypot(x-35,z-193)).toBeLessThan(1.5);
  await aimAtGarden(page, canvas);
  await expect(canvas).toHaveAttribute('data-render-ratio', '0.50', { timeout: 90_000 });
  await hook(page, 'freeze');
  // Let normal camera damping settle before any variant; no camera state is set.
  await waitFrames(canvas, 40);
  const asset = await readFile('public/assets/campuses/yingxi/qingze-reading-garden.glb');
  const sha256 = createHash('sha256').update(asset).digest('hex');
  expect(sha256).toBe('c052ab3c24ae259b875dbd91e05a4e202f544f83db1cc5ddba0e4855e7916e76');
  const snapshots: Snapshot[] = [];
  for (const [mode, name] of [['read','A-baseline'],['receive-off','B-garden-receive-off'],['paving-cast-off','C-paving-cast-off']] as const) {
    await hook(page, mode); await waitFrames(canvas, 3);
    const state = await hook(page, 'read'); state.mode = mode; snapshots.push(state);
    await canvas.screenshot({ path: info.outputPath(`${name}.png`) });
  }
  for (const state of snapshots) {
    expect(state.ratio).toBe(.5); expect(state.shadowType).toBe(0); expect(state.shadowsEnabled).toBe(true);
    expect(state.nodes).toHaveLength(15);
    for (const name of ['Garden_stone','Garden_tile1','Garden_tile2','Garden_tile3']) expect(state.nodes.some(n=>n.name===name)).toBe(true);
    for (let i=0; i<3; i++) expect(Math.abs(state.cameraPosition[i]! - snapshots[0]!.cameraPosition[i]!)).toBeLessThan(.002);
    for (let i=0; i<4; i++) expect(Math.abs(state.cameraQuaternion[i]! - snapshots[0]!.cameraQuaternion[i]!)).toBeLessThan(.00001);
    expect(state.projection).toEqual(snapshots[0]!.projection);
    expect(state.playerPosition).toEqual(snapshots[0]!.playerPosition);
    expect(state.modelMatrix).toEqual(snapshots[0]!.modelMatrix);
    expect(state.buffer).toEqual(snapshots[0]!.buffer);
  }
  expect(snapshots[0]!.nodes.every(n=>n.cast && n.receive)).toBe(true);
  expect(snapshots[1]!.nodes.every(n=>n.cast && !n.receive)).toBe(true);
  expect(snapshots[2]!.nodes.filter(n=>!n.cast).map(n=>n.name).sort()).toEqual(['Garden_stone','Garden_tile1','Garden_tile2','Garden_tile3'].sort());
  expect(snapshots[2]!.nodes.every(n=>n.receive)).toBe(true);
  await info.attach('garden-render-diagnostic', { body: JSON.stringify({ sha256, screenshots: ['A-baseline.png','B-garden-receive-off.png','C-paving-cast-off.png'], snapshots, scope: 'Test-only shadow switches; no gameplay or final art acceptance.' }, null, 2), contentType: 'application/json' });
});
