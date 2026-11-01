import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { campuses } from '../../src/campus-data/campuses';
import { PHOTO_POINTS } from '../../src/games/photography';
import { VIEWING_PLATFORM, PAPERPLANE_STATION, PLATFORM_GROUND_LINKS } from '../../src/scene/OriginalViewingPlatform';
import type { PaperplaneSnapshot, Point2 } from '../../src/shared/contracts';
import { position, walkTo, waypointKeys } from './campus-walk';
// Adapted from the existing quality-slice input policy. Never writes app state.
export async function ready(page:Page){
  await page.goto('/');const canvas=page.getByTestId('campus-canvas');
  await page.getByTestId('campus-yingxi').click();
  await expect(canvas).toHaveAttribute('data-campus-ready','yingxi',{timeout:30000});
  await expect(canvas).toHaveAttribute('data-model-yx-mechanical','ready',{timeout:30000});
  await expect(canvas).toHaveAttribute('data-model-yx-garden-setting','ready',{timeout:30000});
  return canvas;
}
export async function ascend(page:Page,canvas:Locator){
  const a=VIEWING_PLATFORM.approach;await walkTo(page,canvas,campuses.yingxi,[a[0],a[2]],.9);
  await walkTo(page,canvas,campuses.yingxi,VIEWING_PLATFORM.photo.position,.9);
  await expect.poll(async()=>(await position(canvas))[1]).toBeGreaterThan(1.1);
}
export async function descend(page:Page,canvas:Locator){
  const a=VIEWING_PLATFORM.approach;await walkTo(page,canvas,campuses.yingxi,[a[0],a[2]],.9);
  await expect.poll(async()=>(await position(canvas))[1]).toBeLessThan(.2);
}
/** The legacy campus A* knows source buildings, not the new platform/desk
 * props. Reach a north-clear staging point, then follow the visible authored
 * ground link using unsnapped local segments (no new navigation engine). */
export const STATION_ROUTE_STAGING:Point2=[VIEWING_PLATFORM.approach[0],Math.floor(VIEWING_PLATFORM.stairs.minZ)-3];
export function stationApproachRoute():Point2[]{
  const link=PLATFORM_GROUND_LINKS[2]!;
  return link.map(p=>[p[0],p[1]] as Point2);
}
/** Calibrated to observed CDP pulse travel up to3.953m at full tilt.
 * Analogue magnitude (not shorter wall waits) bounds near-corner overshoot. */
export function authoredTouchMagnitude(distance:number){return Math.min(1,Math.max(0,distance)/6);}
export async function walkAuthoredSegment(page:Page,canvas:Locator,target:Point2){
  let previous=await position(canvas),stagnant=0;
  for(let attempt=0;attempt<180;attempt++){
    const before=await position(canvas),dx=target[0]-before[0],dz=target[1]-before[2],distance=Math.hypot(dx,dz);
    if(distance<.25)return;
    const yaw=Number(await canvas.getAttribute('data-camera-yaw'));if(!Number.isFinite(yaw))throw Error('Missing read-only yaw');
    // Same established screen-relative transform; scaling lowers only the
    // input deadzone .6→.15, below .25/sqrt(2), not any collision tolerance.
    const keys=waypointKeys(dx*4,dz*4,yaw);
    await canvas.focus();for(const key of keys)await page.keyboard.down(key);
    try{await page.waitForTimeout(Math.max(20,Math.min(80,distance/3.4*450)));}
    finally{for(const key of keys)await page.keyboard.up(key);}
    const after=await position(canvas);
    if(Math.hypot(after[0]-previous[0],after[2]-previous[2])<.01)stagnant++;else stagnant=0;
    if(stagnant>=20)throw Error(`Authored walking segment blocked at ${after}; target ${target}`);
    previous=after;
  }
  throw Error(`Authored walking segment did not reach ${target}`);
}
export async function reachStation(page:Page,canvas:Locator){
  await walkTo(page,canvas,campuses.yingxi,STATION_ROUTE_STAGING,.9);
  for(const point of stationApproachRoute())await walkAuthoredSegment(page,canvas,point);
  await expect.poll(async()=>{const p=await position(canvas);return Math.hypot(p[0]-PAPERPLANE_STATION.standing[0],p[2]-PAPERPLANE_STATION.standing[2]);}).toBeLessThan(PAPERPLANE_STATION.interactionRadius);
  await expect(page.getByTestId('begin-paperplane')).toBeVisible({timeout:15000});
}
export async function planeState(canvas:Locator):Promise<PaperplaneSnapshot>{
  const raw=await canvas.getAttribute('data-paperplane');if(!raw)throw Error('Missing read-only flight snapshot');return JSON.parse(raw) as PaperplaneSnapshot;
}
/** Observe genuine fixed-step progress; wall-clock waits are not simulation time on SwiftShader. */
export async function waitForSimulatedAdvance(canvas:Locator,elapsed:number,seconds=.3){
  await expect.poll(async()=>{const state=await planeState(canvas);expect(state.phase).toBe('flying');expect(state.paused).toBe(false);return state.elapsed;},{timeout:10000,intervals:[100]}).toBeGreaterThanOrEqual(elapsed+seconds);
}
export async function launch(page:Page){await page.getByRole('button',{name:'开始放飞',exact:true}).click();await page.getByTestId('campus-canvas').focus();}
export async function dragLook(page: Page, canvas: Locator, dx: number, dy=0, touch=false) {
  const box = await canvas.boundingBox(); if (!box) throw new Error('No campus canvas bounds');
  const x = box.x + box.width * (touch ? .7 : .5), y = box.y + box.height * .5;
  if (touch) {
    const client=await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:11}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+dy,id:11}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();
  } else {
    await page.mouse.move(x,y); await page.mouse.down();
    await page.mouse.move(x+dx,y+dy,{steps:12}); await page.mouse.up();
  }
}
export async function rotateTo(page: Page, canvas: Locator, targetYaw: number, targetPitch: number) {
  const yaw=Number(await canvas.getAttribute('data-camera-yaw')),pitch=Number(await canvas.getAttribute('data-camera-pitch'));
  if (![yaw,pitch].every(Number.isFinite)) throw Error('Missing camera orientation');
  const turn=Math.atan2(Math.sin(targetYaw-yaw),Math.cos(targetYaw-yaw));
  await dragLook(page,canvas,-turn/.005,(targetPitch-pitch)/.004);
}
/** Bounded real-input search. Yaw points toward each published subject, while
 * each pitch is tried by a mouse/touch gesture and judged by live read-only
 * framing/occlusion feedback after the camera has rendered and settled. */
export async function waitForSettledCamera(page:Page,canvas:Locator){
  await expect(canvas).toHaveAttribute('data-camera-settled','true',{timeout:20000});
  const frame=Number(await canvas.getAttribute('data-frame'));
  await expect.poll(async()=>Number(await canvas.getAttribute('data-frame')),{timeout:10000,intervals:[100]}).toBeGreaterThan(frame);
  // Allow the existing 250ms guide refresh to observe the exact settled pose.
  await page.waitForTimeout(300);
  await expect(canvas).toHaveAttribute('data-camera-settled','true');
}
export async function aimAtSubject(page: Page, canvas: Locator, pointIndex: number, touch=false, info?: TestInfo) {
  const guide=page.getByTestId('photo-guide'),target=PHOTO_POINTS[pointIndex]!.target;
  await expect(guide).toHaveAttribute('data-photo-in-range','true',{timeout:15000});
  const attempts:Array<{pitchTarget:number;yaw:number;pitch:number;framed:string|null;obstructed:string|null}> = [];
  try {
    for(const pitchTarget of (pointIndex === 0 ? [-.15,-.20,-.25,-.30,-.35,-.40,-.45,-.50,-.55,-.60,-.65,-.70] : [-.15,0,.15,.30,.45,.60,.75,-.25,-.35,-.45,-.55,-.65,-.70])) {
      const [x,,z]=await position(canvas),yaw=Number(await canvas.getAttribute('data-camera-yaw')),pitch=Number(await canvas.getAttribute('data-camera-pitch'));
      if (![x,z,yaw,pitch,...target].every(Number.isFinite)) throw Error('Missing camera/player/subject coordinates');
      const desiredYaw=Math.atan2(target[0]-x,target[2]-z);
      const turn=Math.atan2(Math.sin(desiredYaw-yaw),Math.cos(desiredYaw-yaw));
      await dragLook(page,canvas,-turn/.005,(pitchTarget-pitch)/.004,touch);
      await waitForSettledCamera(page,canvas);
      const framed=await guide.getAttribute('data-photo-framed'),obstructed=await guide.getAttribute('data-photo-obstructed');
      attempts.push({pitchTarget,yaw:Number(await canvas.getAttribute('data-camera-yaw')),pitch:Number(await canvas.getAttribute('data-camera-pitch')),framed,obstructed});
      if(framed==='true' && obstructed==='false') return;
    }
    throw Error(`No unobstructed full subject composition found in bounded real input pitches for point ${pointIndex}`);
  } finally {
    if(info)await info.attach(`photo-aim-${pointIndex}-${touch?'touch':'mouse'}`,{body:JSON.stringify({target,attempts},null,2),contentType:'application/json'});
  }
}

export async function planePose(canvas:Locator):Promise<{position:[number,number,number];heading:number;pitch:number}>{
  const raw=await canvas.getAttribute('data-paperplane-pose');if(!raw)throw Error('Missing read-only flight pose');return JSON.parse(raw);
}
export function screenRightDisplacement(before:{position:[number,number,number];heading:number},after:{position:[number,number,number]}){
  return (after.position[0]-before.position[0])*Math.cos(before.heading)+(after.position[2]-before.position[2])*Math.sin(before.heading);
}

/** Prior SwiftShader evidence was ~2.84 FPS. With the six-substep cap, flight
 * simulated seconds need not track wall seconds. This bounded wait records both;
 * it does not accelerate physics or waive the separate performance gate. */
export async function waitForFlightSuccess(canvas:Locator,info:TestInfo,label:string,captureInFlight=false){
  const started=Date.now(),samples:Array<{wallSeconds:number;simulatedSeconds:number;gates:number;result:string|null}>=[];
  let previous=0,captured=false;
  try{
    await expect.poll(async()=>{
      const state=await planeState(canvas);
      expect(Number.isFinite(state.elapsed)).toBe(true);expect(state.elapsed).toBeGreaterThanOrEqual(previous);previous=state.elapsed;
      samples.push({wallSeconds:(Date.now()-started)/1000,simulatedSeconds:state.elapsed,gates:state.gatesPassed,result:state.result});
      if(captureInFlight&&!captured&&state.phase==='flying'&&state.gatesPassed>=1&&state.gatesPassed<3){
        const poseBefore=await planePose(canvas);
        // Actual ongoing flight, no pause/camera/state manipulation for the image.
        await canvas.page().screenshot({path:info.outputPath('paperplane-in-flight.png')});
        const after=await planeState(canvas);
        expect(after.phase,'Screenshot must precede landing, not substitute a result screen').toBe('flying');
        await info.attach('paperplane-in-flight-state',{body:JSON.stringify({before:state,poseBefore,after,poseAfter:await planePose(canvas)},null,2),contentType:'application/json'});
        captured=true;
      }
      if(state.phase==='result'&&state.result!=='success')throw Error(`Flight ended unsuccessfully: ${state.result}`);
      return state.result;
    },{timeout:180000,intervals:[200,500,1000],message:'Actual flight must reach successful terminal state within the calibrated software-renderer window'}).toBe('success');
    expect((await planeState(canvas)).gatesPassed).toBe(3);
    if(captureInFlight)expect(captured,'Required actual in-flight image was captured').toBe(true);
  }finally{await info.attach(label,{body:JSON.stringify({samples,wallSeconds:(Date.now()-started)/1000},null,2),contentType:'application/json'});}
}
