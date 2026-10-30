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

type Mode = 'read' | 'freeze' | 'receive-off' | 'paving-cast-off' | 'park-lower' | 'tiles-lift';
type Snapshot = {
  mode: string; ratio: number; shadowType: number; shadowsEnabled: boolean;
  cameraPosition: number[]; cameraQuaternion: number[]; projection: number[];
  playerPosition: number[]; modelMatrix: number[]; buffer: number[]; css: number[];
  depthBits: number; logarithmicDepth: boolean; cameraNear: number; cameraFar: number;
  parkSurfaces: { y: number; visible: boolean }[];
  nodes: { name: string; cast: boolean; receive: boolean; localY: number }[];
};
const hook = async (page: Page, mode: Mode): Promise<Snapshot> => page.evaluate((requested) => {
  const diagnostic = (window as unknown as { __gardenShadowDiagnostic?: (mode: string) => Snapshot }).__gardenShadowDiagnostic;
  if (!diagnostic) throw new Error('Test-only garden diagnostic hook was not installed');
  return diagnostic(requested);
}, mode);

const instancePatch = `
const diagnosticOriginalY = new WeakMap();
window.__gardenShadowDiagnostic = (mode) => {
  const model = ownerWorld.children.find(object => object.name === 'yx-garden-setting-detail');
  if (!model || disposed || ownerWorld !== world) throw new Error('Expected live garden GLB');
  const paving = new Set(['Garden_stone', 'Garden_tile1', 'Garden_tile2', 'Garden_tile3']);
  const tiles = new Set(['Garden_tile1', 'Garden_tile2', 'Garden_tile3']);
  const parks = ownerWorld.children.filter(object => object instanceof THREE.Mesh && object.material === parkMat);
  if (!parks.length) throw new Error('Expected park surfaces');
  const geometryVariant = mode === 'park-lower' || mode === 'tiles-lift';
  if (geometryVariant) for (const park of parks) {
    if (!diagnosticOriginalY.has(park)) diagnosticOriginalY.set(park, park.position.y);
    park.position.y = diagnosticOriginalY.get(park) - (mode === 'park-lower' ? .15 : 0);
  }
  const nodes = [];
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (mode === 'receive-off') { object.castShadow = true; object.receiveShadow = false; }
    else if (mode === 'paving-cast-off') { object.castShadow = !paving.has(object.name); object.receiveShadow = true; }
    else if (geometryVariant) {
      if (!diagnosticOriginalY.has(object)) diagnosticOriginalY.set(object, object.position.y);
      object.position.y = diagnosticOriginalY.get(object) + (mode === 'tiles-lift' && tiles.has(object.name) ? .10 : 0);
      object.castShadow = true; object.receiveShadow = false;
    }
    nodes.push({ name: object.name, cast: object.castShadow, receive: object.receiveShadow, localY: object.position.y });
  });
  if (mode === 'freeze') {
    if (renderRatio !== .5 || renderer.shadowMap.type !== THREE.BasicShadowMap) throw new Error('Natural .5 BasicShadowMap warmup not reached');
    diagnosticFreezeRatio = true;
  }
  if (mode === 'receive-off' || mode === 'paving-cast-off' || geometryVariant) renderer.shadowMap.needsUpdate = true;
  player.camera.updateMatrixWorld(true); model.updateMatrixWorld(true);
  return { mode, ratio: renderRatio, shadowType: renderer.shadowMap.type, shadowsEnabled: renderer.shadowMap.enabled,
    cameraPosition: player.camera.position.toArray(), cameraQuaternion: player.camera.quaternion.toArray(),
    projection: player.camera.projectionMatrix.toArray(), playerPosition: pawn.position.toArray(),
    modelMatrix: model.matrixWorld.toArray(), buffer: [canvas.width, canvas.height], css: [canvas.clientWidth, canvas.clientHeight],
    depthBits: renderer.getContext().getParameter(renderer.getContext().DEPTH_BITS), logarithmicDepth: renderer.capabilities.logarithmicDepthBuffer,
    cameraNear: player.camera.near, cameraFar: player.camera.far,
    parkSurfaces: parks.map(park => ({ y: park.position.y, visible: park.visible })), nodes };
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

test('same-camera garden shadow and depth A/B/C/D/E experiment', async ({ page }, info) => {
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
  for (const [mode, name] of [['read','A-baseline'],['receive-off','B-garden-receive-off'],['paving-cast-off','C-paving-cast-off'],['park-lower','D-park-ground-lowered'],['tiles-lift','E-paving-courses-lifted']] as const) {
    await hook(page, mode); await waitFrames(canvas, 3);
    const state = await hook(page, 'read'); state.mode = mode; snapshots.push(state);
    await canvas.screenshot({ path: info.outputPath(`${name}.png`) });
  }
  for (const state of snapshots) {
    expect(state.ratio).toBe(.5); expect(state.shadowType).toBe(0); expect(state.shadowsEnabled).toBe(true);
    expect(state.nodes).toHaveLength(15);
    expect(state.depthBits).toBeGreaterThan(0); expect(state.depthBits).toBe(snapshots[0]!.depthBits);
    expect(state.logarithmicDepth).toBe(snapshots[0]!.logarithmicDepth);
    expect(state.cameraNear).toBe(snapshots[0]!.cameraNear); expect(state.cameraFar).toBe(snapshots[0]!.cameraFar);
    expect(state.parkSurfaces.length).toBeGreaterThan(0);
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
  for (const state of snapshots.slice(3)) expect(state.nodes.every(n=>n.cast && !n.receive)).toBe(true);
  const baseline = snapshots[0]!, lowered = snapshots[3]!, lifted = snapshots[4]!;
  expect(lowered.parkSurfaces).toHaveLength(baseline.parkSurfaces.length);
  expect(lifted.parkSurfaces).toHaveLength(baseline.parkSurfaces.length);
  for (let i=0; i<baseline.parkSurfaces.length; i++) {
    expect(lowered.parkSurfaces[i]!.y).toBeCloseTo(baseline.parkSurfaces[i]!.y - .15, 8);
    expect(lifted.parkSurfaces[i]!.y).toBeCloseTo(baseline.parkSurfaces[i]!.y, 8);
    expect(lowered.parkSurfaces[i]!.visible).toBe(baseline.parkSurfaces[i]!.visible);
    expect(lifted.parkSurfaces[i]!.visible).toBe(baseline.parkSurfaces[i]!.visible);
  }
  for (const node of baseline.nodes) {
    const d = lowered.nodes.find(n=>n.name===node.name), e = lifted.nodes.find(n=>n.name===node.name);
    expect(d).toBeDefined(); expect(e).toBeDefined();
    expect(d!.localY).toBeCloseTo(node.localY, 8);
    expect(e!.localY).toBeCloseTo(node.localY + (['Garden_tile1','Garden_tile2','Garden_tile3'].includes(node.name) ? .10 : 0), 8);
  }
  await info.attach('garden-render-diagnostic', { body: JSON.stringify({ sha256, screenshots: ['A-baseline.png','B-garden-receive-off.png','C-paving-cast-off.png','D-park-ground-lowered.png','E-paving-courses-lifted.png'], snapshots, scope: 'Test-only shadow switches and geometry shifts; neither gameplay nor final art acceptance.' }, null, 2), contentType: 'application/json' });
});
