import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { campuses } from '../../src/campus-data/campuses';
import { position, walkTo } from './campus-walk';

// Test-only A/B/C rendering experiment, not gameplay or aesthetic acceptance.
// Only the served module is instrumented; walking and looking use real input.
test.skip(process.env.RUN_HALL_RENDER_DIAGNOSTIC !== '1', 'Explicit diagnostic CI only');
test.setTimeout(600_000);

type Mode = 'read' | 'freeze' | 'clock-receive-off' | 'stone-cast-off';
type Snapshot = {
  ratio:number; shadowType:number; shadowsEnabled:boolean; depthBits:number;
  cameraPosition:number[]; cameraQuaternion:number[]; projection:number[]; viewMatrix:number[];
  playerPosition:number[]; modelMatrix:number[]; buffer:number[]; css:number[];
  sunPosition:number[]; sunTarget:number[]; sunIntensity:number;
  nodes:{name:string; material:string; cast:boolean; receive:boolean; matrix:number[]}[];
};
const hook = async (page:Page, mode:Mode):Promise<Snapshot> => page.evaluate(requested => {
  const diagnostic = (window as unknown as {__hallDiagnostic?:(mode:string)=>Snapshot}).__hallDiagnostic;
  if (!diagnostic) throw new Error('Test-only hall diagnostic hook was not installed');
  return diagnostic(requested);
}, mode);

const instancePatch = `
window.__hallDiagnostic = (mode) => {
  const model = ownerWorld.children.find(object => object.name === 'yx-mechanical-detail');
  if (!model || disposed || ownerWorld !== world) throw new Error('Expected live mechanical hall GLB');
  if (mode === 'freeze') {
    if (renderRatio !== .5 || renderer.shadowMap.type !== THREE.BasicShadowMap) throw new Error('Natural .5 BasicShadowMap warmup not reached');
    hallDiagnosticFreezeRatio = true;
  }
  const nodes = [];
  model.updateMatrixWorld(true);
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (mode === 'clock-receive-off' && object.name === 'clock') object.receiveShadow = false;
    if (mode === 'stone-cast-off') {
      if (object.name === 'clock') object.receiveShadow = true;
      if (object.name === 'stone') object.castShadow = false;
    }
    nodes.push({name: object.name, material: object.material.name, cast: object.castShadow, receive: object.receiveShadow, matrix: object.matrixWorld.toArray()});
  });
  if (mode === 'clock-receive-off' || mode === 'stone-cast-off') renderer.shadowMap.needsUpdate = true;
  player.camera.updateMatrixWorld(true);
  return {ratio: renderRatio, shadowType: renderer.shadowMap.type, shadowsEnabled: renderer.shadowMap.enabled,
    depthBits: renderer.getContext().getParameter(renderer.getContext().DEPTH_BITS),
    cameraPosition: player.camera.position.toArray(), cameraQuaternion: player.camera.quaternion.toArray(),
    projection: player.camera.projectionMatrix.toArray(), viewMatrix: player.camera.matrixWorldInverse.toArray(),
    playerPosition: pawn.position.toArray(), modelMatrix: model.matrixWorld.toArray(),
    buffer: [canvas.width,canvas.height], css: [canvas.clientWidth,canvas.clientHeight],
    sunPosition: sun.position.toArray(), sunTarget: sun.target.position.toArray(), sunIntensity: sun.intensity, nodes};
};`;

async function installDiagnostic(page:Page):Promise<()=>number> {
  let matches = 0;
  await page.route('**/src/scene/CampusScene.ts*', async route => {
    matches++;
    const response = await route.fetch(), body = await response.text();
    const anchors = [
      'let slowFrames = 0, fastFrames = 0;',
      'const ownerWorld = world;',
      'const nextRatio = slowFrames >= 3 ? Math.max(.5, renderRatio * .75) : fastFrames >= 180 ? Math.min(maxRatio, renderRatio / .75) : renderRatio;',
    ];
    for (const anchor of anchors) if (body.split(anchor).length !== 2) throw new Error(`Expected exactly one diagnostic anchor: ${anchor}`);
    const patched = body
      .replace(anchors[0]!, `${anchors[0]} let hallDiagnosticFreezeRatio = false;`)
      .replace(anchors[1]!, `${anchors[1]}${instancePatch}`)
      .replace(anchors[2]!, anchors[2]!.replace('= slowFrames >= 3', '= hallDiagnosticFreezeRatio ? renderRatio : slowFrames >= 3'));
    const headers:Record<string,string> = {...response.headers(), 'content-type':'application/javascript; charset=utf-8'};
    delete headers['content-encoding']; delete headers['content-length'];
    await route.fulfill({response, headers, body:patched});
  });
  return () => matches;
}
async function waitFrames(canvas:Locator, count:number):Promise<void> {
  const start = Number(await canvas.getAttribute('data-frame'));
  await expect.poll(async () => Number(await canvas.getAttribute('data-frame')), {timeout:60000, intervals:[100]}).toBeGreaterThanOrEqual(start + count);
}
async function aimAtDoor(page:Page, canvas:Locator):Promise<void> {
  const [x,,z] = await position(canvas);
  const yaw = Number(await canvas.getAttribute('data-camera-yaw'));
  const pitch = Number(await canvas.getAttribute('data-camera-pitch'));
  const desired = Math.atan2(-53.045-x, 175.65-z);
  const turn = Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw));
  const box = await canvas.boundingBox(); if (!box) throw new Error('Missing campus canvas bounds');
  const sx=box.x+box.width*.55, sy=box.y+box.height*.5;
  await page.mouse.move(sx,sy); await page.mouse.down();
  await page.mouse.move(sx-turn/.005,sy+(-.15-pitch)/.004,{steps:12}); await page.mouse.up();
}

test('same-camera mechanical hall doorway shadow A/B/C experiment', async ({page}, info) => {
  const sha256 = createHash('sha256').update(await readFile('public/assets/campuses/yingxi/mechanical-hall.glb')).digest('hex');
  expect(sha256).toBe('2db71a1046b775e826e8504f4be93fbcc2f5578837d3e73078955b2b6dcb17ec');
  const moduleCount = await installDiagnostic(page);
  await page.goto('/');
  expect(moduleCount(), 'exactly one intercepted Vite module').toBe(1);
  const canvas = page.getByTestId('campus-canvas');
  await expect(canvas).toHaveAttribute('data-model-yx-mechanical','ready',{timeout:30000});
  await expect(canvas).toHaveAttribute('data-player-model','ready',{timeout:30000});
  await canvas.focus();
  await walkTo(page, canvas, campuses.yingxi, [-48,175.5], 1);
  const [x,,z] = await position(canvas);
  expect(Math.hypot(x+48,z-175.5)).toBeLessThan(1.5);
  await aimAtDoor(page, canvas);
  await expect(canvas).toHaveAttribute('data-render-ratio','0.50',{timeout:90000});
  await hook(page,'freeze');
  await waitFrames(canvas,40); // Normal camera damping settles before comparisons.
  const screenshots = ['A-baseline.png','B-clock-receive-off.png','C-stone-cast-off.png'];
  const snapshots:Snapshot[] = [];
  for (const [i,mode] of (['read','clock-receive-off','stone-cast-off'] as const).entries()) {
    await hook(page,mode); await waitFrames(canvas,3);
    snapshots.push(await hook(page,'read'));
    await canvas.screenshot({path:info.outputPath(screenshots[i]!)});
  }
  const baseline = snapshots[0]!;
  for (const state of snapshots) {
    expect(state.ratio).toBe(.5); expect(state.shadowType).toBe(0); expect(state.shadowsEnabled).toBe(true);
    expect(state.depthBits).toBeGreaterThan(0); expect(state.depthBits).toBe(baseline.depthBits);
    expect(state.nodes).toHaveLength(7);
    expect(state.nodes.map(n=>[n.name,n.material]).sort()).toEqual(baseline.nodes.map(n=>[n.name,n.material]).sort());
    for (let i=0; i<3; i++) expect(Math.abs(state.cameraPosition[i]!-baseline.cameraPosition[i]!)).toBeLessThan(.002);
    for (let i=0; i<4; i++) expect(Math.abs(state.cameraQuaternion[i]!-baseline.cameraQuaternion[i]!)).toBeLessThan(.00001);
    expect(state.projection).toEqual(baseline.projection); expect(state.playerPosition).toEqual(baseline.playerPosition);
    expect(state.modelMatrix).toEqual(baseline.modelMatrix); expect(state.buffer).toEqual(baseline.buffer); expect(state.css).toEqual(baseline.css);
    expect(state.sunPosition).toEqual(baseline.sunPosition); expect(state.sunTarget).toEqual(baseline.sunTarget); expect(state.sunIntensity).toBe(baseline.sunIntensity);
    for (const node of state.nodes) expect(node.matrix).toEqual(baseline.nodes.find(n=>n.name===node.name)!.matrix);
  }
  expect(baseline.nodes.every(n=>n.cast && n.receive)).toBe(true);
  expect(baseline.nodes.find(n=>n.name==='clock')?.material).toBe('clock');
  expect(baseline.nodes.find(n=>n.name==='stone')?.material).toBe('stone');
  expect(snapshots[1]!.nodes.filter(n=>!n.receive).map(n=>n.name)).toEqual(['clock']);
  expect(snapshots[1]!.nodes.every(n=>n.cast)).toBe(true);
  expect(snapshots[2]!.nodes.filter(n=>!n.cast).map(n=>n.name)).toEqual(['stone']);
  expect(snapshots[2]!.nodes.every(n=>n.receive)).toBe(true);
  await info.attach('hall-render-diagnostic',{body:JSON.stringify({sha256,screenshots,snapshots,scope:'Test-only hall shadow flag changes; no gameplay or aesthetic acceptance.'},null,2),contentType:'application/json'});
});
