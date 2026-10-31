import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { campuses } from '../../src/campus-data/campuses';
import { position, walkTo } from './campus-walk';

// Diagnostic only: instrument served Vite module; no production code or source state changes.
test.skip(process.env.RUN_GATE_SHADOW_DIAGNOSTIC !== '1', 'Explicit diagnostic run only');
test.setTimeout(600000);
type NodeState = { name:string; material:string; cast:boolean; receive:boolean; matrix:number[] };
type Snapshot = { ratio:number; shadowType:number; shadowsEnabled:boolean; cameraPosition:number[]; cameraQuaternion:number[]; projection:number[]; playerPosition:number[]; modelMatrix:number[]; buffer:number[]; css:number[]; sunPosition:number[]; sunTarget:number[]; sunIntensity:number; nodes:NodeState[] };
const hook = (page:Page, mode:string):Promise<Snapshot> => page.evaluate(m => {
  const fn = (window as unknown as {__gateDiagnostic?:(mode:string)=>Snapshot}).__gateDiagnostic;
  if (!fn) throw Error('Missing test-only gate diagnostic'); return fn(m);
},mode);
const patch = `
window.__gateDiagnostic = (mode) => {
  const model = ownerWorld.children.find(object => object.name === 'hy-north-gate-detail');
  if (!model || disposed || ownerWorld !== world) throw new Error('Expected live gate');
  if (mode === 'freeze') {
    if (renderRatio !== .5 || renderer.shadowMap.type !== THREE.BasicShadowMap) throw new Error('Natural .5 BasicShadowMap not reached');
    gateDiagnosticFreezeRatio = true;
  }
  model.updateMatrixWorld(true); const nodes = [];
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const target = object.name === 'Suspended rectangular plaque' || object.name.startsWith('Vertical structural rib');
    if (mode === 'receive-off' && target) object.receiveShadow = false;
    const material = Array.isArray(object.material) ? object.material.map(m=>m.name).join(',') : object.material.name;
    nodes.push({name:object.name,material,cast:object.castShadow,receive:object.receiveShadow,matrix:object.matrixWorld.toArray()});
  });
  if (mode === 'receive-off') renderer.shadowMap.needsUpdate = true;
  player.camera.updateMatrixWorld(true);
  return {ratio:renderRatio,shadowType:renderer.shadowMap.type,shadowsEnabled:renderer.shadowMap.enabled,
    cameraPosition:player.camera.position.toArray(),cameraQuaternion:player.camera.quaternion.toArray(),projection:player.camera.projectionMatrix.toArray(),
    playerPosition:pawn.position.toArray(),modelMatrix:model.matrixWorld.toArray(),buffer:[canvas.width,canvas.height],css:[canvas.clientWidth,canvas.clientHeight],
    sunPosition:sun.position.toArray(),sunTarget:sun.target.position.toArray(),sunIntensity:sun.intensity,nodes};
};`;
async function install(page:Page) {
  let count=0;
  await page.route('**/src/scene/CampusScene.ts*',async route=>{
    count++;const response=await route.fetch(),body=await response.text();
    const anchors=['let slowFrames = 0, fastFrames = 0;','const ownerWorld = world;','const nextRatio = slowFrames >= 3 ? Math.max(.5, renderRatio * .75) : fastFrames >= 180 ? Math.min(maxRatio, renderRatio / .75) : renderRatio;'];
    for(const anchor of anchors) if(body.split(anchor).length!==2) throw Error(`Missing unique diagnostic anchor ${anchor}`);
    const code=body.replace(anchors[0]!,`${anchors[0]} let gateDiagnosticFreezeRatio = false;`).replace(anchors[1]!,`${anchors[1]}${patch}`).replace(anchors[2]!,anchors[2]!.replace('= slowFrames >= 3','= gateDiagnosticFreezeRatio ? renderRatio : slowFrames >= 3'));
    const headers:Record<string,string>={...response.headers(),'content-type':'application/javascript; charset=utf-8'};delete headers['content-encoding'];delete headers['content-length'];
    await route.fulfill({response,headers,body:code});
  });
  return ()=>count;
}
async function frames(canvas:Locator,n:number) {const first=Number(await canvas.getAttribute('data-frame'));await expect.poll(async()=>Number(await canvas.getAttribute('data-frame')),{timeout:60000}).toBeGreaterThanOrEqual(first+n);}

test('gate plaque and ribs receive-shadow same-camera A/B',async({page},info)=>{
  const sha256=createHash('sha256').update(await readFile('public/assets/campuses/huyu/north-gate.glb')).digest('hex');
  const intercepted=await install(page);await page.goto('/');expect(intercepted()).toBe(1);
  const canvas=page.getByTestId('campus-canvas');await page.getByTestId('campus-huyu').click();
  await expect.poll(async()=>{try{const p=await position(canvas);return Math.hypot(p[0]-campuses.huyu.start[0],p[2]-campuses.huyu.start[1]);}catch{return Infinity;}},{timeout:30000}).toBeLessThan(1);
  await expect(canvas).toHaveAttribute('data-model-hy-north-gate','ready',{timeout:30000});
  await walkTo(page,canvas,campuses.huyu,[12,-170]);const [x,,z]=await position(canvas);
  const yaw=Number(await canvas.getAttribute('data-camera-yaw')),pitch=Number(await canvas.getAttribute('data-camera-pitch'));
  const turn=Math.atan2(Math.sin(Math.atan2(14-x,-200-z)-yaw),Math.cos(Math.atan2(14-x,-200-z)-yaw));
  const box=await canvas.boundingBox();if(!box)throw Error('Missing canvas');const sx=box.x+box.width*.5,sy=box.y+box.height*.5;
  await page.mouse.move(sx,sy);await page.mouse.down();await page.mouse.move(sx-turn/.005,sy+(-.2-pitch)/.004,{steps:12});await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-render-ratio','0.50',{timeout:90000});await hook(page,'freeze');await frames(canvas,40);
  const baseline=await hook(page,'read');await canvas.screenshot({path:info.outputPath('gate-A-baseline.png')});
  await hook(page,'receive-off');await frames(canvas,3);const changed=await hook(page,'read');await canvas.screenshot({path:info.outputPath('gate-B-plaque-ribs-receive-off.png')});
  const targets=changed.nodes.filter(n=>n.name==='Suspended rectangular plaque'||n.name.startsWith('Vertical structural rib'));
  expect(targets.length).toBeGreaterThanOrEqual(2);expect(targets.every(n=>!n.receive&&n.cast)).toBe(true);
  expect(baseline.nodes.every(n=>n.cast&&n.receive)).toBe(true);
  for(const n of changed.nodes.filter(n=>!targets.includes(n)))expect(n.receive).toBe(true);
  expect(changed.ratio).toBe(baseline.ratio);expect(changed.shadowType).toBe(baseline.shadowType);expect(changed.playerPosition).toEqual(baseline.playerPosition);
  expect(changed.projection).toEqual(baseline.projection);expect(changed.modelMatrix).toEqual(baseline.modelMatrix);expect(changed.buffer).toEqual(baseline.buffer);expect(changed.css).toEqual(baseline.css);
  expect(changed.sunPosition).toEqual(baseline.sunPosition);expect(changed.sunTarget).toEqual(baseline.sunTarget);expect(changed.sunIntensity).toBe(baseline.sunIntensity);
  for(let i=0;i<3;i++)expect(Math.abs(changed.cameraPosition[i]!-baseline.cameraPosition[i]!)).toBeLessThan(.002);
  for(let i=0;i<4;i++)expect(Math.abs(changed.cameraQuaternion[i]!-baseline.cameraQuaternion[i]!)).toBeLessThan(.00001);
  await info.attach('gate-shadow-diagnostic',{body:JSON.stringify({sha256,baseline,changed,scope:'Test-only served module A/B. Geometry and cast unchanged; no gameplay claim.'},null,2),contentType:'application/json'});
});
