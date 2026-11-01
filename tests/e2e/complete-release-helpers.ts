import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { campuses } from '../../src/campus-data/campuses';
import { PHOTO_POINTS } from '../../src/games/photography';
import { VIEWING_PLATFORM, PAPERPLANE_STATION } from '../../src/scene/OriginalViewingPlatform';
import type { PaperplaneSnapshot } from '../../src/shared/contracts';
import { position, walkTo } from './campus-walk';
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
export async function reachStation(page:Page,canvas:Locator){
  const s=PAPERPLANE_STATION.standing;await walkTo(page,canvas,campuses.yingxi,[s[0],s[2]],.9);
  await expect(page.getByTestId('begin-paperplane')).toBeVisible({timeout:15000});
}
export async function planeState(canvas:Locator):Promise<PaperplaneSnapshot>{
  const raw=await canvas.getAttribute('data-paperplane');if(!raw)throw Error('Missing read-only flight snapshot');return JSON.parse(raw) as PaperplaneSnapshot;
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
      const frame=Number(await canvas.getAttribute('data-frame'));
      await dragLook(page,canvas,-turn/.005,(pitchTarget-pitch)/.004,touch);
      // Inspect after genuine rendered frames, not stale pre-drag state; this
      // also allows camera damping and the UI's 250ms status update to settle.
      await expect.poll(async()=>Number(await canvas.getAttribute('data-frame')),{timeout:15000,intervals:[100]}).toBeGreaterThanOrEqual(frame+6);
      await page.waitForTimeout(300);
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
export async function waitForFlightSuccess(canvas:Locator,info:TestInfo,label:string){
  const started=Date.now(),samples:Array<{wallSeconds:number;simulatedSeconds:number;gates:number;result:string|null}>=[];
  let previous=0;
  try{
    await expect.poll(async()=>{
      const state=await planeState(canvas);
      expect(Number.isFinite(state.elapsed)).toBe(true);expect(state.elapsed).toBeGreaterThanOrEqual(previous);previous=state.elapsed;
      samples.push({wallSeconds:(Date.now()-started)/1000,simulatedSeconds:state.elapsed,gates:state.gatesPassed,result:state.result});
      if(state.phase==='result'&&state.result!=='success')throw Error(`Flight ended unsuccessfully: ${state.result}`);
      return state.result;
    },{timeout:180000,intervals:[200,500,1000],message:'Actual flight must reach successful terminal state within the calibrated software-renderer window'}).toBe('success');
    expect((await planeState(canvas)).gatesPassed).toBe(3);
  }finally{await info.attach(label,{body:JSON.stringify({samples,wallSeconds:(Date.now()-started)/1000},null,2),contentType:'application/json'});}
}
