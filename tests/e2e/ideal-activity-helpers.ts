import { type Page, type Locator, type TestInfo } from '@playwright/test';
import { campuses } from '../../src/campus-data/campuses';
import { position, walkRoute } from './campus-walk';
import { authoredTouchMagnitude } from './complete-release-helpers';

// Adapted unchanged steering policy from the existing landscape journey.
// Real CDP touch input only; no game pose/mode/progress mutation.
export async function touchWalkTo(page: Page, canvas: Locator, target: [number,number], info: TestInfo, tolerance=4.5, authoredSegment=false) {
  const [startX,,startZ]=await position(canvas),route=authoredSegment?[target]:walkRoute(campuses.yingxi,[startX,startZ],target);
  const box=await canvas.boundingBox();if(!box)throw Error('Missing campus canvas bounds');
  // The visible fixed stick is left:38px, bottom:70px, diameter:90px.
  const center={x:box.x+83,y:box.y+box.height-115};
  const touch=await page.context().newCDPSession(page);
  const observations:Array<{waypoint:[number,number];before:[number,number,number];after:[number,number,number];holdMs:number;pulseMs:number;magnitude:number;stick:{x:number;y:number}}>=[];
  const started=Date.now(),startFrame=Number(await canvas.getAttribute('data-frame'));
  console.log(`[TOUCH_ROUTE_START] ${JSON.stringify({target,start:[startX,startZ],authoredSegment,wall:started,frame:startFrame})}`);
  let stagnant=0, previous:[number,number]=[startX,startZ];
  try {
    for(const waypoint of route) for(let attempt=0;attempt<(authoredSegment?180:30);attempt++) {
      const before=await position(canvas),dx=waypoint[0]-before[0],dz=waypoint[1]-before[2];
      if(Math.hypot(dx,dz)<(authoredSegment?tolerance:.9)||Math.hypot(target[0]-before[0],target[1]-before[2])<tolerance)break;
      const yaw=Number(await canvas.getAttribute('data-camera-yaw'));if(!Number.isFinite(yaw))throw Error('Missing camera yaw');
      const distance=Math.hypot(dx,dz),stick={x:(-dx*Math.cos(yaw)+dz*Math.sin(yaw))/distance,y:-(dx*Math.sin(yaw)+dz*Math.cos(yaw))/distance};
      const holdMs=authoredSegment?Math.max(20,Math.min(80,distance/3.4*450)):Math.max(80,Math.min(300,distance/3.4*500));
      const magnitude=authoredSegment?authoredTouchMagnitude(distance):1,pulseStart=Date.now();
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...center,id:12}]});
      try {
        await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x+stick.x*50*magnitude,y:center.y+stick.y*50*magnitude,id:12}]});
        await page.waitForTimeout(holdMs);
      } finally { await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); }
      const after=await position(canvas);observations.push({waypoint,before,after,holdMs,pulseMs:Date.now()-pulseStart,magnitude,stick});
      if(Math.hypot(after[0]-previous[0],after[2]-previous[1])<.05)stagnant++;else stagnant=0;
      if(stagnant>=12)throw Error(`Touch movement stuck at ${after[0]},${after[2]} near ${waypoint}`);
      previous=[after[0],after[2]];
      if(attempt===(authoredSegment?179:29))throw Error(`Touch policy could not reach ${waypoint}`);
    }
  } finally {
    // Preserve progress even when the test deadline has already closed the page.
    const endFrame=await canvas.getAttribute('data-frame').catch(()=>null);
    console.log(`[TOUCH_ROUTE_END] ${JSON.stringify({target,start:[startX,startZ],authoredSegment,wall:Date.now(),durationMs:Date.now()-started,startFrame,endFrame,attempts:observations.length,last:observations.slice(-12)})}`);
    await info.attach('ideal-touch-route-inputs',{body:JSON.stringify({start:[startX,startZ],target,observations},null,2),contentType:'application/json'}).catch(error=>console.log(`[TOUCH_ROUTE_ATTACHMENT] ${String(error)}`));
    await touch.detach().catch(error=>console.log(`[TOUCH_ROUTE_CLEANUP] ${String(error)}`));
  }
}

export async function activityPose(canvas: Locator) {
  return canvas.evaluate(e => { const d = (e as HTMLElement).dataset; return { xyz: [d.playerX, d.playerY, d.playerZ], yaw: d.cameraYaw, pitch: d.cameraPitch, campus: d.campusReady, mode: d.campusMode, world: d.worldGeneration, collision: d.collisionGeneration }; });
}
export async function activityProgress(page: Page) {
  return page.evaluate(() => ({ journey: localStorage.getItem('campus-atlas:journey:v1'), photos: localStorage.getItem('campus-atlas:photo-stamps:v1'), quests: localStorage.getItem('campus-atlas:quests') }));
}
