import { expect, type Page, type Locator, type TestInfo } from '@playwright/test';
import { campuses } from '../../src/campus-data/campuses';
import { walkRoute } from './campus-walk';
import { authoredTouchMagnitude } from './complete-release-helpers';

/** Remove only strictly same-direction collinear interior grid points. The
 * original line segments and every turn remain; this is not a LOS shortcut.
 * Keep the first point because the actual starting pose is not grid-snapped. */
export function compactTouchRoute(route: [number, number][]): [number, number][] {
  return route.filter((point, index) => {
    const before = route[index - 1], after = route[index + 1];
    if (!before || !after) return true;
    const dx = point[0] - before[0], dz = point[1] - before[1];
    const nx = after[0] - point[0], nz = after[1] - point[1];
    return dx * nz !== dz * nx || dx * nx + dz * nz <= 0;
  });
}

// One read avoids four independent CDP round trips and gives a coherent pose.
async function touchPose(canvas: Locator) {
  const result = await canvas.evaluate(element => {
    const d = (element as HTMLElement).dataset;
    return [d.playerX, d.playerY, d.playerZ, d.cameraYaw, d.frame];
  });
  if (result.some(value => value === undefined || !Number.isFinite(Number(value)))) throw Error('Missing finite touch pose/frame');
  const values = result.map(Number);
  return { xyz: values.slice(0,3) as [number,number,number], yaw: values[3]!, frame: values[4]! };
}

// Established landscape touch policy with near-point proportional input.
// CI showed full-strength pulses travelling up to 4.54m past 2m grid targets.
// Preserve bends/clearance and apply the existing d/6 gain, rather than changing
// collision, arrival tolerances, or the test's hard time budget.
// Real CDP touch input only; no game pose/mode/progress mutation.
export async function touchWalkTo(page: Page, canvas: Locator, target: [number,number], info: TestInfo, tolerance=4.5, authoredSegment=false) {
  const initial=await touchPose(canvas),[startX,,startZ]=initial.xyz,route=authoredSegment?[target]:compactTouchRoute(walkRoute(campuses.yingxi,[startX,startZ],target));
  const box=await canvas.boundingBox();if(!box)throw Error('Missing campus canvas bounds');
  // The visible fixed stick is left:38px, bottom:70px, diameter:90px.
  const center={x:box.x+83,y:box.y+box.height-115};
  const touch=await page.context().newCDPSession(page);
  const observations:Array<{waypoint:[number,number];before:[number,number,number];after:[number,number,number];holdMs:number;pulseMs:number;magnitude:number;continuous:boolean;stick:{x:number;y:number}}>=[];
  const started=Date.now(),startFrame=initial.frame;
  console.log(`[TOUCH_ROUTE_START] ${JSON.stringify({target,start:[startX,startZ],authoredSegment,wall:started,frame:startFrame})}`);
  let stagnant=0, previous:[number,number]=[startX,startZ];
  try {
    for(const waypoint of route) for(let attempt=0;attempt<(authoredSegment?180:30);attempt++) {
      const sample=await touchPose(canvas),before=sample.xyz,dx=waypoint[0]-before[0],dz=waypoint[1]-before[2];
      if(Math.hypot(dx,dz)<(authoredSegment?tolerance:.9)||Math.hypot(target[0]-before[0],target[1]-before[2])<tolerance)break;
      const yaw=sample.yaw;
      const distance=Math.hypot(dx,dz),stick={x:(-dx*Math.cos(yaw)+dz*Math.sin(yaw))/distance,y:-(dx*Math.sin(yaw)+dz*Math.cos(yaw))/distance};
      const holdMs=authoredSegment?Math.max(20,Math.min(80,distance/3.4*450)):Math.max(80,Math.min(300,distance/3.4*500));
      const continuous=!authoredSegment && distance>16;
      const magnitude=continuous?1:authoredTouchMagnitude(distance),pulseStart=Date.now();
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...center,id:12}]});
      try {
        await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x+stick.x*50*magnitude,y:center.y+stick.y*50*magnitude,id:12}]});
        if (continuous) {
          // Cruise only along the unchanged straight segment. Release well before
          // its endpoint; all corner/near-point control uses discrete d/6 pulses.
          // 16m exceeds a 1.5s observation interval plus 1.5s stale read
          // and 1.5s release delivery (15.3m at walk speed). This is a
          // tested latency envelope, not a guarantee for arbitrary stalls.
          let brakingZone = false;
          for (let observation=0;observation<80;observation++) {
            await page.waitForTimeout(100);
            const current=await touchPose(canvas);
            if (Date.now()-pulseStart>30000) throw Error('Continuous touch cruise exceeded 30s watchdog');
            const remaining=Math.hypot(waypoint[0]-current.xyz[0],waypoint[1]-current.xyz[2]);
            const forward=(waypoint[0]-current.xyz[0])*dx+(waypoint[1]-current.xyz[2])*dz;
            if (forward<=0 || remaining>distance+.1) throw Error('Continuous touch cruise exceeded its straight segment');
            if (remaining<=16) { brakingZone=true;break; }
          }
          if (!brakingZone) throw Error('Continuous touch cruise exhausted observations');
        } else await page.waitForTimeout(holdMs);
      } finally { await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); }
      let released=await touchPose(canvas);
      const releaseFrame=released.frame;
      await expect.poll(async()=>{released=await touchPose(canvas);return released.frame;},{timeout:10000,message:'rendered pose after touch release'}).toBeGreaterThan(releaseFrame);
      const after=released.xyz;
      if(continuous && (waypoint[0]-after[0])*dx+(waypoint[1]-after[2])*dz<=0) throw Error('Touch release overran its straight segment');
      observations.push({waypoint,before,after,holdMs,pulseMs:Date.now()-pulseStart,magnitude,continuous,stick});
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
