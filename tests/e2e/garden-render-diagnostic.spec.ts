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

type Mode = 'read' | 'freeze' | 'receive-off' | 'paving-cast-off' | 'park-lower' | 'tiles-lift' | 'front-side' | 'top-only' | 'flat-paving';
type Snapshot = {
  mode: string; ratio: number; shadowType: number; shadowsEnabled: boolean;
  cameraPosition: number[]; cameraQuaternion: number[]; projection: number[];
  playerPosition: number[]; modelMatrix: number[]; buffer: number[]; css: number[];
  depthBits: number; logarithmicDepth: boolean; cameraNear: number; cameraFar: number;
  parkSurfaces: { y: number; visible: boolean }[];
  nodes: { name: string; cast: boolean; receive: boolean; localY: number; side: number; materialType: string; indexCount: number }[];
};
const hook = async (page: Page, mode: Mode): Promise<Snapshot> => page.evaluate((requested) => {
  const diagnostic = (window as unknown as { __gardenShadowDiagnostic?: (mode: string) => Snapshot }).__gardenShadowDiagnostic;
  if (!diagnostic) throw new Error('Test-only garden diagnostic hook was not installed');
  return diagnostic(requested);
}, mode);

const instancePatch = `
const diagnosticOriginalY = new WeakMap();
const diagnosticOriginalSurface = new WeakMap();
const diagnosticTopGeometry = new WeakMap();
const diagnosticFlatMaterial = new THREE.MeshStandardMaterial({ color: 0xc7bfa8, roughness: .88, metalness: 0, side: THREE.DoubleSide });
window.__gardenShadowDiagnostic = (mode) => {
  const model = ownerWorld.children.find(object => object.name === 'yx-garden-setting-detail');
  if (!model || disposed || ownerWorld !== world) throw new Error('Expected live garden GLB');
  const paving = new Set(['Garden_stone', 'Garden_tile1', 'Garden_tile2', 'Garden_tile3']);
  const tiles = new Set(['Garden_tile1', 'Garden_tile2', 'Garden_tile3']);
  const parks = ownerWorld.children.filter(object => object instanceof THREE.Mesh && object.material === parkMat);
  if (!parks.length) throw new Error('Expected park surfaces');
  const geometryVariant = ['park-lower', 'tiles-lift', 'front-side', 'top-only', 'flat-paving'].includes(mode);
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
      if (paving.has(object.name) && ['front-side', 'top-only', 'flat-paving'].includes(mode)) {
        if (!diagnosticOriginalSurface.has(object)) diagnosticOriginalSurface.set(object, { material: object.material, side: object.material.side, geometry: object.geometry });
        const original = diagnosticOriginalSurface.get(object);
        original.material.side = mode === 'front-side' ? THREE.FrontSide : original.side;
        original.material.needsUpdate = true;
        object.material = mode === 'flat-paving' ? diagnosticFlatMaterial : original.material;
        object.geometry = original.geometry;
        if (mode === 'top-only') {
          if (!diagnosticTopGeometry.has(object)) {
            const positions = original.geometry.getAttribute('position');
            const index = original.geometry.index;
            if (!index) throw new Error('Expected indexed pavement geometry');
            const kept = [];
            for (let i = 0; i < index.count; i += 3) {
              const a = index.getX(i), b = index.getX(i+1), c = index.getX(i+2);
              const ay = positions.getY(a), by = positions.getY(b), cy = positions.getY(c);
              const crossY = (positions.getZ(b)-positions.getZ(a))*(positions.getX(c)-positions.getX(a)) - (positions.getX(b)-positions.getX(a))*(positions.getZ(c)-positions.getZ(a));
              if (Math.max(ay,by,cy)-Math.min(ay,by,cy) < 1e-5 && crossY > 1e-10) kept.push(a,b,c);
            }
            if (!kept.length || kept.length >= index.count) throw new Error('Top-only filter did not reduce geometry');
            const top = original.geometry.clone(); top.setIndex(kept); diagnosticTopGeometry.set(object, top);
          }
          object.geometry = diagnosticTopGeometry.get(object);
        }
      }
    }
    nodes.push({ name: object.name, cast: object.castShadow, receive: object.receiveShadow, localY: object.position.y,
      side: object.material.side, materialType: object.material.type, indexCount: object.geometry.index ? object.geometry.index.count : 0 });
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

test('same-camera garden shadow and depth A/B/C/D/E/F/G/H experiment', async ({ page }, info) => {
  // Archived experiment for the original thin-wedge asset only.
  const originalBytes = await readFile('public/assets/campuses/yingxi/qingze-reading-garden.glb');
  test.skip(createHash('sha256').update(originalBytes).digest('hex') !== 'c052ab3c24ae259b875dbd91e05a4e202f544f83db1cc5ddba0e4855e7916e76', 'Original-asset diagnostic; use normal quality tests for replacement models');
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
  for (const [mode, name] of [['read','A-baseline'],['receive-off','B-garden-receive-off'],['paving-cast-off','C-paving-cast-off'],['park-lower','D-park-ground-lowered'],['tiles-lift','E-paving-courses-lifted'],['front-side','F-front-side'],['top-only','G-top-faces-only'],['flat-paving','H-uniform-flat-paving']] as const) {
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
  const front = snapshots[5]!, top = snapshots[6]!, flat = snapshots[7]!;
  for (const state of [front, top, flat]) {
    expect(state.parkSurfaces).toEqual(baseline.parkSurfaces);
    for (const original of baseline.nodes) {
      const actual = state.nodes.find(n=>n.name===original.name)!;
      expect(actual.localY).toBeCloseTo(original.localY, 8);
      if (!['Garden_stone','Garden_tile1','Garden_tile2','Garden_tile3'].includes(original.name)) {
        expect(actual.side).toBe(original.side); expect(actual.indexCount).toBe(original.indexCount); expect(actual.materialType).toBe(original.materialType);
      }
    }
  }
  for (const name of ['Garden_stone','Garden_tile1','Garden_tile2','Garden_tile3']) {
    const a = baseline.nodes.find(n=>n.name===name)!, f = front.nodes.find(n=>n.name===name)!, g = top.nodes.find(n=>n.name===name)!, h = flat.nodes.find(n=>n.name===name)!;
    expect(f.side).toBe(0); expect(f.indexCount).toBe(a.indexCount);
    expect(g.side).toBe(a.side); expect(g.indexCount).toBeGreaterThan(0); expect(g.indexCount).toBeLessThan(a.indexCount);
    expect(h.side).toBe(2); expect(h.indexCount).toBe(a.indexCount); expect(h.materialType).toBe('MeshStandardMaterial');
  }
  await info.attach('garden-render-diagnostic' , { body: JSON.stringify({ sha256, screenshots: ['A-baseline.png','B-garden-receive-off.png','C-paving-cast-off.png','D-park-ground-lowered.png','E-paving-courses-lifted.png','F-front-side.png','G-top-faces-only.png','H-uniform-flat-paving.png'], snapshots, scope: 'Test-only shadow, geometry and material changes; neither gameplay nor final art acceptance.' }, null, 2), contentType: 'application/json' });
});
