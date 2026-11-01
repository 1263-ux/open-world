import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { campuses } from '../../src/campus-data/campuses';
import { PHOTO_POINTS } from '../../src/games/photography';
import { position, walkRoute, walkTo } from './campus-walk';
import { ascend, descend, planePose, planeState, screenRightDisplacement, waitForFlightSuccess } from './complete-release-helpers';
import { PAPERPLANE_STATION, VIEWING_PLATFORM } from '../../src/scene/OriginalViewingPlatform';

// Read-only telemetry supplements actual input and screenshots; it never controls the game.
test.setTimeout(420000);
async function ready(page: Page, touch=false) {
  await page.goto('/');
  const canvas = page.getByTestId('campus-canvas');
  await expect(canvas).toHaveAttribute('data-player-model', 'ready', { timeout: 30000 });
  await expect(canvas).toHaveAttribute('data-model-yx-mechanical', 'ready', { timeout: 30000 });
  await expect(canvas).toHaveAttribute('data-model-yx-garden-setting', 'ready', { timeout: 30000 });
  const start=page.getByRole('button',{name:'开始手记',exact:true});if(touch)await start.tap();else await start.click();
  return canvas;
}
async function dragLook(page: Page, canvas: Locator, dx: number, dy=0, touch=false) {
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
async function rotateTo(page: Page, canvas: Locator, targetYaw: number, targetPitch: number) {
  const yaw=Number(await canvas.getAttribute('data-camera-yaw')),pitch=Number(await canvas.getAttribute('data-camera-pitch'));
  if (![yaw,pitch].every(Number.isFinite)) throw Error('Missing camera orientation');
  const turn=Math.atan2(Math.sin(targetYaw-yaw),Math.cos(targetYaw-yaw));
  await dragLook(page,canvas,-turn/.005,(targetPitch-pitch)/.004);
}
/** Bounded real-input search. Yaw points toward each published subject, while
 * each pitch is tried by a mouse/touch gesture and judged by live read-only
 * framing/occlusion feedback after the camera has rendered and settled. */
async function aimAtSubject(page: Page, canvas: Locator, pointIndex: number, touch=false, info?: TestInfo) {
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
/** Feedback-controlled real key pulses on the first photo site's north/south axis. */
async function steerPhotoZ(page: Page, canvas: Locator, target: number, info: TestInfo, label: string) {
  const observations: Array<{ attempt: number; x: number; z: number; key?: string }> = [];
  try {
    for (let attempt=0;attempt<36;attempt++) {
      const [x,,z]=await position(canvas), yaw=Number(await canvas.getAttribute('data-camera-yaw'));
      if (!Number.isFinite(yaw) || Math.abs(yaw+Math.PI/2)>.02) throw Error(`Unexpected camera yaw ${yaw} during Z steering`);
      const error=target-z; const entry:{attempt:number;x:number;z:number;key?:string}={attempt,x,z}; observations.push(entry);
      if (Math.abs(error)<.3) return;
      const key=error<0?'d':'a';entry.key=key;
      await page.keyboard.down(key);
      try { await page.waitForTimeout(70); } finally { await page.keyboard.up(key); }
    }
    throw Error(`Could not reach photo observation z=${target} via bounded real key pulses`);
  } finally {
    await info.attach(label,{body:JSON.stringify({target,observations},null,2),contentType:'application/json'});
  }
}
/** Real left-joystick gestures; source geometry chooses a route, only touch moves the player. */
async function touchWalkTo(page: Page, canvas: Locator, target: [number,number], info: TestInfo, tolerance=4.5) {
  const [startX,,startZ]=await position(canvas),route=walkRoute(campuses.yingxi,[startX,startZ],target);
  const box=await canvas.boundingBox();if(!box)throw Error('Missing campus canvas bounds');
  // The visible fixed stick is left:38px, bottom:70px, diameter:90px.
  const center={x:box.x+83,y:box.y+box.height-115};
  const touch=await page.context().newCDPSession(page);
  const observations:Array<{waypoint:[number,number];before:[number,number,number];after:[number,number,number];holdMs:number;stick:{x:number;y:number}}>=[];
  let stagnant=0, previous:[number,number]=[startX,startZ];
  try {
    for(const waypoint of route) for(let attempt=0;attempt<30;attempt++) {
      const before=await position(canvas),dx=waypoint[0]-before[0],dz=waypoint[1]-before[2];
      if(Math.hypot(dx,dz)<.9||Math.hypot(target[0]-before[0],target[1]-before[2])<tolerance)break;
      const yaw=Number(await canvas.getAttribute('data-camera-yaw'));if(!Number.isFinite(yaw))throw Error('Missing camera yaw');
      const distance=Math.hypot(dx,dz),stick={x:(-dx*Math.cos(yaw)+dz*Math.sin(yaw))/distance,y:-(dx*Math.sin(yaw)+dz*Math.cos(yaw))/distance};
      const holdMs=Math.max(80,Math.min(300,distance/3.4*500));
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...center,id:12}]});
      try {
        await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x+stick.x*50,y:center.y+stick.y*50,id:12}]});
        await page.waitForTimeout(holdMs);
      } finally { await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); }
      const after=await position(canvas);observations.push({waypoint,before,after,holdMs,stick});
      if(Math.hypot(after[0]-previous[0],after[2]-previous[1])<.05)stagnant++;else stagnant=0;
      if(stagnant>=12)throw Error(`Touch movement stuck at ${after[0]},${after[2]} near ${waypoint}`);
      previous=[after[0],after[2]];
      if(attempt===29)throw Error(`Touch policy could not reach ${waypoint}`);
    }
  } finally {
    await touch.detach();
    await info.attach('photo-touch-route-inputs',{body:JSON.stringify({start:[startX,startZ],target,observations},null,2),contentType:'application/json'});
  }
}
async function stampIds(page: Page): Promise<string[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('campus-atlas:photo-stamps:v1') ?? '[]') as string[]);
}

test('scenic diary: genuine walk, framing, three captures, Hks round-trip and local postcard', async ({ page }, info) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const canvas=await ready(page), guide=page.getByTestId('photo-guide'), hint=page.getByTestId('photo-hint');
  await expect(guide).toContainText('0 / 3');
  await aimAtSubject(page,canvas,0,false,info);await expect(hint).toContainText('构图就绪', {timeout:30000});
  await page.screenshot({path:info.outputPath('photo-hall-ready.png')});
  await page.getByRole('button',{name:'打开校园地图'}).click(); await expect(canvas).toHaveAttribute('data-view','map');
  await page.keyboard.press('e'); await expect(hint).toContainText('返回人物视角'); expect(await stampIds(page)).toEqual([]);
  await page.getByRole('button',{name:'返回人物视角'}).click(); await expect(canvas).toHaveAttribute('data-view','player');
  await page.getByTestId('open-directory').click(); await page.keyboard.press('e'); expect(await stampIds(page)).toEqual([]);
  await page.getByTestId('landmark-close').click(); await expect(hint).toContainText('构图就绪',{timeout:15000});
  // Search a bounded set of genuine positions and camera pitches for a real
  // tree-obstructed composition. Foliage geometry can change between visual
  // versions, so a single hard-coded pose is not an invariant. No scene state
  // is injected; the visible status and screenshot are the evidence.
  const obstructionAttempts: unknown[] = []; let foundObstruction = false;
  for (const z of [170.5, 169, 172, 174]) {
    await rotateTo(page,canvas,-Math.PI/2,-.15); await canvas.focus();
    await steerPhotoZ(page,canvas,z,info,`photo-obstruction-approach-${z}`);
    const p = await position(canvas);
    expect(Math.hypot(p[0]-PHOTO_POINTS[0]!.position[0],p[2]-PHOTO_POINTS[0]!.position[1])).toBeLessThan(PHOTO_POINTS[0]!.radius);
    const target = PHOTO_POINTS[0]!.target, desiredYaw = Math.atan2(target[0]-p[0],target[2]-p[2]);
    for (const pitch of [-.15,-.2,-.25,-.3,-.35,-.4,-.45,-.5,-.55,-.6]) {
      const frame = Number(await canvas.getAttribute('data-frame'));
      await rotateTo(page,canvas,desiredYaw,pitch);
      await expect.poll(async()=>Number(await canvas.getAttribute('data-frame')),{timeout:15000}).toBeGreaterThanOrEqual(frame+6);
      await page.waitForTimeout(300);
      const framed = await guide.getAttribute('data-photo-framed'), obstructed = await guide.getAttribute('data-photo-obstructed');
      obstructionAttempts.push({position:p,pitch,framed,obstructed});
      if (framed === 'true' && obstructed === 'true') { foundObstruction = true; break; }
    }
    if (foundObstruction) break;
  }
  await info.attach('photo-real-obstruction-search',{body:JSON.stringify(obstructionAttempts,null,2),contentType:'application/json'});
  expect(foundObstruction,'A natural tree obstruction must be demonstrated, not injected').toBe(true);
  await canvas.focus();await page.keyboard.press('e');
  await expect(hint).toContainText('被景物遮住',{timeout:10000});expect(await stampIds(page)).toEqual([]);
  await page.screenshot({path:info.outputPath('photo-real-tree-obstruction.png')});
  await rotateTo(page,canvas,-Math.PI/2,-.15);await canvas.focus();await steerPhotoZ(page,canvas,175.5,info,'photo-obstruction-return');
  await aimAtSubject(page,canvas,0,false,info);await expect(hint).toContainText('构图就绪',{timeout:15000});
  // A shallow pitch leaves the clock near the top of the viewport while the
  // tower's upper edge is cut off in the source geometry. The UI must reject;
  // preserve a screenshot so the visible clipping is independently reviewed.
  const towardClock=Number(await canvas.getAttribute('data-camera-yaw'));
  await rotateTo(page,canvas,towardClock,0);await canvas.focus();await page.keyboard.press('e');
  await expect(hint).toContainText('调整视角',{timeout:10000});expect(await stampIds(page)).toEqual([]);
  await page.screenshot({path:info.outputPath('photo-clipped-tower-rejected.png')});
  await aimAtSubject(page,canvas,0,false,info);await expect(hint).toContainText('构图就绪',{timeout:15000});
  // A real rightward camera drag puts the target outside the frame. The game
  // must reject E instead of granting progress. Restore the view by dragging back.
  await dragLook(page,canvas,300); await canvas.focus(); await page.keyboard.press('e');
  await expect(hint).toContainText('调整视角', {timeout:10000}); expect(await stampIds(page)).toEqual([]);
  await page.screenshot({path:info.outputPath('photo-wrong-framing.png')});
  await dragLook(page,canvas,-300); await expect(hint).toContainText('构图就绪',{timeout:15000});
  await canvas.focus(); await page.keyboard.press('e');
  await expect(guide).toContainText('1 / 3'); expect(await stampIds(page)).toEqual(['hall']);
  // E at the first site cannot record the distant second point.
  await page.keyboard.press('e'); await expect(hint).toContainText('还未到观察处'); expect(await stampIds(page)).toEqual(['hall']);
  const saved=await position(canvas), yaw=await canvas.getAttribute('data-camera-yaw');
  await page.getByTestId('open-hks').click();
  await expect(page.getByTestId('hks-loading')).toHaveCount(0,{timeout:30000});
  await expect(page.getByTestId('hks-error')).toHaveCount(0);
  await expect(page.frameLocator('[data-testid="hks-frame"]').locator('canvas')).toBeVisible();
  await page.getByTestId('hks-return').click(); await expect(canvas).toHaveAttribute('data-paused','false');
  const restored=await position(canvas);expect(Math.hypot(restored[0]-saved[0],restored[2]-saved[2])).toBeLessThan(.1);
  expect(await canvas.getAttribute('data-camera-yaw')).toBe(yaw);expect(await stampIds(page)).toEqual(['hall']);
  // Walk the continuous connection using keys, not a position/state injection.
  await walkTo(page,canvas,campuses.yingxi,PHOTO_POINTS[1]!.position);
  const there=await position(canvas);expect(Math.hypot(there[0]-PHOTO_POINTS[1]!.position[0],there[2]-PHOTO_POINTS[1]!.position[1])).toBeLessThan(PHOTO_POINTS[1]!.radius);
  // At the new station, a view toward the *old* clock subject must not award
  // a garden stamp. The real garden subject is a different authored landmark.
  const clock = PHOTO_POINTS[0]!.target;
  const clockYaw = Math.atan2(clock[0]-there[0],clock[2]-there[2]);
  await rotateTo(page,canvas,clockYaw,-.2);await expect(guide).toHaveAttribute('data-photo-framed','false',{timeout:15000});
  await canvas.focus();await page.keyboard.press('e');
  await expect(hint).toContainText('调整视角',{timeout:10000});expect(await stampIds(page)).toEqual(['hall']);
  await page.screenshot({path:info.outputPath('photo-garden-wrong-subject.png')});
  await aimAtSubject(page,canvas,1,false,info);await expect(hint).toContainText('构图就绪',{timeout:30000}); await page.screenshot({path:info.outputPath('photo-garden-ready.png')});
  // Exercise the actual visible shutter as a pointer action for the second capture.
  await page.getByTestId('photo-record').click();
  await ascend(page,canvas);await aimAtSubject(page,canvas,2,false,info);await page.getByTestId('photo-record').click();
  await page.getByTestId('open-photo-album').click();
  const complete=page.getByTestId('photo-complete');await expect(complete).toBeVisible();expect(await stampIds(page)).toEqual(['hall','garden','platform']);
  await expect(complete).toHaveAttribute('role','dialog');await expect(complete).toHaveAttribute('aria-modal','true');
  await expect(canvas).toHaveAttribute('data-paused','true');await expect(page.locator('.app-shell')).toHaveAttribute('inert','');
  const modalPosition=await position(canvas), modalFrame=await canvas.getAttribute('data-frame');
  const backgroundButton=await page.getByTestId('open-hks').boundingBox();if(!backgroundButton)throw Error('Missing Hks launcher');
  await page.mouse.click(backgroundButton.x+backgroundButton.width/2,backgroundButton.y+backgroundButton.height/2);
  await expect(page.getByTestId('hks-overlay')).toHaveCount(0);await expect(complete).toBeVisible();
  await page.keyboard.down('w');await page.waitForTimeout(1200);await page.keyboard.up('w');
  const still=await position(canvas);expect(Math.hypot(still[0]-modalPosition[0],still[2]-modalPosition[2])).toBeLessThan(.1);
  expect(await canvas.getAttribute('data-frame')).toBe(modalFrame);
  // Both forward and backward tabbing must remain inside the actual dialog.
  for(let i=0;i<10;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('[data-testid="photo-complete"]'))).toBe(true);}
  for(let i=0;i<10;i++){await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('[data-testid="photo-complete"]'))).toBe(true);}
  await page.keyboard.press('Escape');await expect(complete).toHaveCount(0);await expect(canvas).toHaveAttribute('data-paused','false');
  const afterEscape=await position(canvas);expect(Math.hypot(afterEscape[0]-modalPosition[0],afterEscape[2]-modalPosition[2])).toBeLessThan(.1);
  await expect(page.getByTestId('open-photo-album')).toBeFocused();
  await page.getByTestId('open-photo-album').click();await expect(complete).toBeVisible();await expect(canvas).toHaveAttribute('data-paused','true');
  const photos=complete.locator('img');await expect(photos).toHaveCount(3);
  const sources=await photos.evaluateAll(images=>images.map(image=>(image as HTMLImageElement).src));
  expect(sources.every(src=>src.startsWith('data:image/png;base64,')&&src.length>10000)).toBe(true);
  expect(sources[0]).not.toBe(sources[1]);
  await page.screenshot({path:info.outputPath('photo-completion.png')});
  const downloadPromise=page.waitForEvent('download');await complete.getByRole('button',{name:/保存明信片到本机/}).click();
  const download=await downloadPromise; expect(download.suggestedFilename()).toBe('晴日-太理手记.png');
  const path=await download.path();if(!path)throw Error('Postcard download unavailable');const bytes=await readFile(path);
  expect(bytes.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
  expect(bytes.readUInt32BE(16)).toBe(1600);expect(bytes.readUInt32BE(20)).toBe(1080);expect(bytes.length).toBeGreaterThan(20000);expect(bytes.length).toBeLessThanOrEqual(10*1024*1024);
  await info.attach('postcard-from-real-game-captures',{body:bytes,contentType:'image/png'});
  await complete.getByRole('button',{name:'继续漫游'}).click();await expect(complete).toHaveCount(0);await expect(canvas).toHaveAttribute('data-paused','false');
  await expect(page.getByTestId('open-photo-album')).toBeFocused();
  await page.getByTestId('open-photo-album').click();await expect(complete).toBeVisible();
  await complete.getByRole('button',{name:/机械馆 · 初见/}).click();await expect(complete).toHaveCount(0);
  await descend(page,canvas);await walkTo(page,canvas,campuses.yingxi,PHOTO_POINTS[0]!.position);
  await aimAtSubject(page,canvas,0,false,info);await expect(hint).toContainText('构图就绪',{timeout:30000});await canvas.focus();await page.keyboard.press('e');
  await page.getByTestId('open-photo-album').click();await expect(complete).toBeVisible();expect(await stampIds(page)).toEqual(['hall','garden','platform']);
  await complete.getByRole('button',{name:'关闭手记'}).click();await expect(complete).toHaveCount(0);
  await page.getByTestId('open-photo-album').click();await expect(complete).toBeVisible();
  await page.reload();await expect(page.getByTestId('journey-panel')).toContainText('3 / 3');await page.getByTestId('open-photo-album').click();
  await expect(complete).toContainText('照片只留在本次游玩中');
  await expect(complete.getByRole('button',{name:/保存明信片到本机/})).toBeDisabled();
  await complete.getByRole('button',{name:'关闭手记'}).click();await page.getByRole('button',{name:'另开一轮',exact:true}).click();await page.getByRole('button',{name:'确认重新开始',exact:true}).click();await expect(guide).toContainText('0 / 3');expect(await stampIds(page)).toEqual(['hall','garden','platform']);
  expect(errors).toEqual([]);
});

test('student: real idle, walk, run and airborne input, plus campus and Hks round-trips', async ({page},info) => {
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const canvas=await ready(page); await expect(canvas).toHaveAttribute('data-player-motion','idle',{timeout:15000});
  await page.screenshot({path:info.outputPath('student-idle.png')});
  await canvas.focus();const start=await position(canvas);await page.keyboard.down('w');
  try {
    await expect(canvas).toHaveAttribute('data-player-motion','walk',{timeout:15000});
    await page.screenshot({path:info.outputPath('student-walk-a.png')});await page.waitForTimeout(500);
    await page.screenshot({path:info.outputPath('student-walk-b.png')});
    const timing=await canvas.evaluate(async element=>{
      const start=performance.now(), first=Number(element.dataset.frame), intervals:number[]=[];let prior=start;
      await new Promise<void>(resolve=>{const tick=(now:number)=>{intervals.push(now-prior);prior=now;if(now-start>=3000)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});
      const elapsedMs=performance.now()-start,frames=Number(element.dataset.frame)-first,sorted=intervals.slice().sort((a,b)=>a-b);
      return {elapsedMs,frames,fps:frames*1000/elapsedMs,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],
        motion:element.dataset.playerMotion,model:element.dataset.playerModel,renderRatio:element.dataset.renderRatio,drawCalls:element.dataset.drawCalls,triangles:element.dataset.triangles,
        viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},userAgent:navigator.userAgent};
    });
    await info.attach('student-walk-frame-timing',{body:JSON.stringify(timing,null,2),contentType:'application/json'});
    expect(timing.frames).toBeGreaterThan(0);
    const walked=await position(canvas);expect(Math.hypot(walked[0]-start[0],walked[2]-start[2])).toBeGreaterThan(.5);
    await page.keyboard.down('Shift');
    try { await expect(canvas).toHaveAttribute('data-player-motion','run',{timeout:15000});await page.screenshot({path:info.outputPath('student-run.png')}); }
    finally { await page.keyboard.up('Shift'); }
  } finally { await page.keyboard.up('w'); }
  await expect(canvas).toHaveAttribute('data-player-motion','idle',{timeout:15000});
  // The long walk/run capture can end on the hall's raised entrance steps.
  // Back away first (the route planner cannot start inside a wall-clearance
  // margin), then genuinely walk to the known open courtyard before testing
  // a same-surface jump. No player or camera state is injected.
  await canvas.focus();await page.keyboard.down('s');
  try { await expect.poll(async()=>(await position(canvas))[0],{timeout:30000,intervals:[250]}).toBeGreaterThan(-46); }
  finally { await page.keyboard.up('s'); }
  await walkTo(page,canvas,campuses.yingxi,[-20,175.5]);
  await expect(canvas).toHaveAttribute('data-player-motion','idle',{timeout:15000});
  const flatStart=await position(canvas);
  expect(Math.hypot(flatStart[0]+20,flatStart[2]-175.5)).toBeLessThan(5);
  expect(flatStart[1]).toBeGreaterThan(.08);expect(flatStart[1]).toBeLessThan(.2);
  await page.waitForTimeout(1000);const flatStable=await position(canvas);
  expect(Math.abs(flatStable[1]-flatStart[1])).toBeLessThan(.02);
  const ground=flatStable[1];await page.screenshot({path:info.outputPath('student-flat-before-jump.png')});
  await canvas.focus();await page.keyboard.press('Space');
  await expect(canvas).toHaveAttribute('data-player-motion','airborne',{timeout:15000});
  await expect.poll(async()=>(await position(canvas))[1],{timeout:15000,intervals:[50]}).toBeGreaterThan(ground+.1);
  await page.screenshot({path:info.outputPath('student-airborne.png')});
  await expect(canvas).toHaveAttribute('data-player-motion','idle',{timeout:15000});
  await expect.poll(async()=>Math.abs((await position(canvas))[1]-ground),{timeout:15000}).toBeLessThan(.1);
  const landed=await position(canvas);
  await info.attach('student-flat-jump-position',{body:JSON.stringify({flatStart,flatStable,landed},null,2),contentType:'application/json'});
  for(let i=0;i<2;i++){await page.getByTestId('campus-huyu').click();await page.getByTestId('campus-yingxi').click();}
  await expect(canvas).toHaveAttribute('data-player-model','ready');
  await page.getByTestId('open-hks').click();await expect(page.frameLocator('[data-testid="hks-frame"]').locator('canvas')).toBeVisible({timeout:30000});
  await page.getByTestId('hks-return').click();await expect(canvas).toHaveAttribute('data-player-model','ready');await expect(canvas).toHaveAttribute('data-paused','false');
  await page.screenshot({path:info.outputPath('student-after-hks.png')});expect(errors).toEqual([]);
});

test('student model load failure leaves a usable fallback', async ({page},info) => {
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/assets/characters/casual-hoodie.glb',route=>route.abort());
  await page.goto('/');const canvas=page.getByTestId('campus-canvas');
  await expect(canvas).toHaveAttribute('data-player-model','fallback',{timeout:30000});await expect(page.getByTestId('scene-error')).toHaveCount(0);
  await canvas.focus();const before=await position(canvas);await page.keyboard.down('w');
  try { await expect.poll(async()=>{const p=await position(canvas);return Math.hypot(p[0]-before[0],p[2]-before[2]);},{timeout:15000}).toBeGreaterThan(.5); }
  finally { await page.keyboard.up('w'); }
  await page.screenshot({path:info.outputPath('student-fallback.png')});expect(errors).toEqual([]);
});

test('delayed student load survives real campus switches without replacing the active scene', async ({page},info) => {
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  let release!:()=>void,seen!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}), requested=new Promise<void>(resolve=>{seen=resolve;});
  await page.route('**/assets/characters/casual-hoodie.glb',async route=>{seen();await gate;await route.continue();});
  try {
    await page.goto('/',{waitUntil:'domcontentloaded'});await requested;const canvas=page.getByTestId('campus-canvas');
    await expect(canvas).toHaveAttribute('data-player-model','loading');
    await page.getByTestId('campus-huyu').click();await page.getByTestId('campus-yingxi').click();
    release();await expect(canvas).toHaveAttribute('data-player-model','ready',{timeout:30000});
    await expect(page.getByTestId('campus-yingxi')).toHaveAttribute('aria-pressed','true');
    await expect(page.getByTestId('scene-error')).toHaveCount(0);await page.screenshot({path:info.outputPath('student-late-load.png')});
    expect(errors).toEqual([]);
  } finally { release(); }
});

test.describe('landscape touch diary',()=>{
  test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
  test('real touch complete journal: three photos, stairs, Hks return, both flight directions and success',async({page},info)=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    const canvas=await ready(page,true);await aimAtSubject(page,canvas,0,true,info);
    await expect(page.getByTestId('photo-hint')).toContainText('构图就绪',{timeout:30000});
    await page.screenshot({path:info.outputPath('photo-touch-first-ready.png')});
    await page.getByTestId('photo-record').tap();
    const guide=page.getByTestId('photo-guide');await expect(guide).toContainText('1 / 3');expect(await stampIds(page)).toEqual(['hall']);
    await touchWalkTo(page,canvas,PHOTO_POINTS[1]!.position,info);
    const atGarden=await position(canvas);expect(Math.hypot(atGarden[0]-PHOTO_POINTS[1]!.position[0],atGarden[2]-PHOTO_POINTS[1]!.position[1])).toBeLessThan(PHOTO_POINTS[1]!.radius);
    await aimAtSubject(page,canvas,1,true,info);await expect(page.getByTestId('photo-hint')).toContainText('构图就绪',{timeout:30000});
    await page.screenshot({path:info.outputPath('photo-touch-second-ready.png')});await page.getByTestId('photo-record').tap();
    await touchWalkTo(page,canvas,[VIEWING_PLATFORM.approach[0],VIEWING_PLATFORM.approach[2]],info,.9);
    await touchWalkTo(page,canvas,VIEWING_PLATFORM.photo.position,info,.9);expect((await position(canvas))[1]).toBeGreaterThan(1.1);
    await aimAtSubject(page,canvas,2,true,info);
    // Diagnostic only: one atomic read of existing DOM telemetry and known save
    // keys. Keep the shutter action single-shot; do not mask a rejection by retry.
    async function elevatedCaptureEvidence(phase:'before-tap'|'after-tap') {
      const state=await page.evaluate(()=>{
        const canvas=document.querySelector<HTMLCanvasElement>('[data-testid="campus-canvas"]');
        const guide=document.querySelector<HTMLElement>('[data-testid="photo-guide"]');
        const shutter=document.querySelector<HTMLButtonElement>('[data-testid="photo-record"]');
        const readSave=(key:string)=>{try{return localStorage.getItem(key);}catch(error){return `unavailable: ${String(error)}`;}};
        return {
          frame:canvas?.dataset.frame??null,
          playerXYZ:['playerX','playerY','playerZ'].map(key=>canvas?.dataset[key]??null),
          camera:{yaw:canvas?.dataset.cameraYaw??null,pitch:canvas?.dataset.cameraPitch??null},
          view:canvas?.dataset.view??null,paused:canvas?.dataset.paused??null,
          inRange:guide?.getAttribute('data-photo-in-range')??null,
          framed:guide?.getAttribute('data-photo-framed')??null,
          obstructed:guide?.getAttribute('data-photo-obstructed')??null,
          guideText:guide?.textContent??null,
          hint:document.querySelector('[data-testid="photo-hint"]')?.textContent??null,
          shutterDisabled:shutter?.disabled??null,
          journey:readSave('campus-atlas:journey:v1'),
          photoStamps:readSave('campus-atlas:photo-stamps:v1'),
        };
      });
      console.log(`[ELEVATED_PHOTO_CAPTURE] ${JSON.stringify({phase,...state})}`);
      return {phase,...state};
    }
    const beforeCapture=await elevatedCaptureEvidence('before-tap');
    await page.getByTestId('photo-record').tap();
    const afterCapture=await elevatedCaptureEvidence('after-tap');
    await info.attach('elevated-photo-single-tap',{body:JSON.stringify({beforeCapture,afterCapture},null,2),contentType:'application/json'});
    await page.screenshot({path:info.outputPath('elevated-photo-after-single-tap.png')});
    await page.getByTestId('open-photo-album').tap();
    const complete=page.getByTestId('photo-complete');await expect(complete).toBeVisible();expect(await stampIds(page)).toEqual(['hall','garden','platform']);
    await expect(canvas).toHaveAttribute('data-paused','true');await page.screenshot({path:info.outputPath('photo-touch-completion.png')});
    await complete.getByRole('button',{name:'继续漫游'}).tap();await expect(complete).toHaveCount(0);await expect(canvas).toHaveAttribute('data-paused','false');
    await page.getByTestId('open-photo-album').tap();await expect(complete).toBeVisible();await complete.getByRole('button',{name:'关闭手记'}).tap();
    await touchWalkTo(page,canvas,[VIEWING_PLATFORM.approach[0],VIEWING_PLATFORM.approach[2]],info,.9);expect((await position(canvas))[1]).toBeLessThan(.2);
    const saved=await position(canvas),yaw=await canvas.getAttribute('data-camera-yaw');await page.getByTestId('open-hks').tap();
    await expect(page.frameLocator('[data-testid="hks-frame"]').locator('canvas')).toBeVisible({timeout:30000});
    await page.getByTestId('hks-return').tap();await expect(canvas).toHaveAttribute('data-paused','false');
    const restored=await position(canvas);expect(Math.hypot(restored[0]-saved[0],restored[2]-saved[2])).toBeLessThan(.1);
    expect(await canvas.getAttribute('data-camera-yaw')).toBe(yaw);expect(await stampIds(page)).toEqual(['hall','garden','platform']);
    // Simulated landscape touch, not a physical phone. Every route move above
    // and below is a left-stick gesture; no keyboard or position injection.
    await touchWalkTo(page,canvas,[PAPERPLANE_STATION.standing[0],PAPERPLANE_STATION.standing[2]],info,.9);
    const stationPose=await position(canvas);
    for(const [label,sign] of [['向右转',1],['向左转',-1]] as const){
      await page.getByTestId('begin-paperplane').tap();await page.getByRole('button',{name:'开始放飞',exact:true}).tap();
      const before=await planePose(canvas),button=page.getByRole('button',{name:label,exact:true}),box=await button.boundingBox();if(!box)throw Error('Missing flight touch control');
      const client=await page.context().newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2;
      await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:22}]});await page.waitForTimeout(700);
      await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();
      expect(screenRightDisplacement(before,await planePose(canvas))*sign).toBeGreaterThan(.01);
      await page.getByRole('button',{name:/退出放飞/}).tap();expect(await position(canvas)).toEqual(stationPose);
    }
    await page.getByTestId('begin-paperplane').tap();await page.getByRole('button',{name:'开始放飞',exact:true}).tap();
    await waitForFlightSuccess(canvas,info,'flight-wall-and-simulated-time');expect((await planeState(canvas)).gatesPassed).toBe(3);
    await page.getByRole('button',{name:'返回手记',exact:true}).tap();await expect(page.getByTestId('journey-panel')).toContainText('晴日手记 · 完成');
    expect(await position(canvas)).toEqual(stationPose);await page.screenshot({path:info.outputPath('touch-complete-journal.png')});expect(errors).toEqual([]);
  });
});

test('student camera at a real wall fades the close avatar and restores it when looking away',async({page},info)=>{
  const canvas=await ready(page);await page.getByTestId('campus-huyu').click();
  // Campus rebuild deliberately removes XYZ until its first rendered frame.
  // Wait for that explicit read-only readiness before position() can be read.
  await expect(canvas).toHaveAttribute('data-campus-ready','huyu',{timeout:30000});
  await expect.poll(async()=>{const [x,,z]=await position(canvas);return Math.hypot(x-campuses.huyu.start[0],z-campuses.huyu.start[1]);},{timeout:15000}).toBeLessThan(1);
  await canvas.focus();await page.keyboard.down('Shift');await page.keyboard.down('w');
  try { await expect.poll(async()=>(await position(canvas))[2],{timeout:60000,intervals:[500]}).toBeGreaterThan(-144); }
  finally { await page.keyboard.up('w');await page.keyboard.up('Shift'); }
  // The real wall stays solid; turning puts it between the camera and avatar.
  expect((await position(canvas))[2]).toBeLessThan(-142.78);
  await dragLook(page,canvas,-628);
  await expect.poll(async()=>Number(await canvas.getAttribute('data-player-opacity')),{timeout:15000}).toBeLessThan(.25);
  await page.screenshot({path:info.outputPath('student-near-wall-fade.png')});
  await dragLook(page,canvas,628);
  await expect.poll(async()=>Number(await canvas.getAttribute('data-player-opacity')),{timeout:15000}).toBeGreaterThan(.9);
  await page.screenshot({path:info.outputPath('student-near-wall-restored.png')});
});

test.describe('portrait orientation recovery',()=>{
  test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
  test('denied fullscreen still offers a usable portrait continuation',async({page},info)=>{
    // Failure injection is restricted to this browser capability; no game state is modified.
    await page.addInitScript(()=>{Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:()=>Promise.reject(new DOMException('Denied in test','NotAllowedError'))});});
    await page.goto('/');const prompt=page.getByTestId('orientation-prompt');await expect(prompt).toBeVisible();
    await page.getByTestId('orientation-fullscreen').tap();await expect(prompt).toContainText('设备未允许自动横屏');
    await page.screenshot({path:info.outputPath('portrait-orientation-denied.png')});
    await page.getByTestId('orientation-dismiss').tap();await expect(prompt).toHaveCount(0);
    const canvas=page.getByTestId('campus-canvas');await expect(canvas).toBeVisible();
    await page.getByRole('button',{name:'打开校园地图'}).tap();await expect(canvas).toHaveAttribute('data-view','map');
    await page.getByRole('button',{name:'返回人物视角'}).tap();await expect(canvas).toHaveAttribute('data-view','player');
    await page.screenshot({path:info.outputPath('portrait-continued.png')});
  });
});

test('a failed mechanical model cannot produce a false clock photo',async({page},info)=>{
  await page.route('**/assets/campuses/yingxi/mechanical-hall.glb',route=>route.abort());
  await page.goto('/');await page.getByRole('button',{name:'开始手记',exact:true}).click();const canvas=page.getByTestId('campus-canvas');
  await expect(canvas).toHaveAttribute('data-model-yx-mechanical','fallback',{timeout:30000});
  await expect(page.getByTestId('scene-error')).toHaveCount(0);
  await expect(page.getByTestId('photo-hint')).toContainText('细节未能加载');
  await expect(page.getByTestId('photo-record')).toBeDisabled();await canvas.focus();await page.keyboard.press('e');
  expect(await stampIds(page)).toEqual([]);await page.screenshot({path:info.outputPath('photo-model-fallback.png')});
});

test('landmark markers remain map-only across campus rebuilds',async({page},info)=>{
  const canvas=await ready(page),labels=page.locator('.landmark-label-layer');
  await expect(canvas).toHaveAttribute('data-view','player');await expect(canvas).toHaveAttribute('data-visible-markers','0');await expect(labels).toBeHidden();
  await page.getByRole('button',{name:'打开校园地图'}).click();await expect(canvas).toHaveAttribute('data-view','map');
  await expect(canvas).toHaveAttribute('data-visible-markers',String(campuses.yingxi.landmarks.length));
  await expect(labels).toBeVisible();await expect(labels.locator('.landmark-label').filter({hasText:'清泽园'})).toHaveCount(1);
  await page.screenshot({path:info.outputPath('map-yingxi-markers.png')});
  // Projection is read-only targeting assistance, not evidence of picking:
  // the actual mouse click must open the correct landmark detail.
  async function pickGarden() {
    await expect.poll(async () => {
      const markers = JSON.parse(await canvas.getAttribute('data-map-markers') || '[]') as {id:string;x:number;y:number}[];
      return markers.some(marker => marker.id === 'yx-garden');
    }, {timeout:15000}).toBe(true);
    const markers = JSON.parse((await canvas.getAttribute('data-map-markers'))!) as {id:string;x:number;y:number}[];
    const garden = markers.find(marker => marker.id === 'yx-garden')!;
    const box = await canvas.boundingBox(); if (!box) throw Error('Missing canvas bounds');
    await page.mouse.click(box.x+garden.x, box.y+garden.y);
    const detail = page.getByRole('complementary',{name:'地点详情'});
    await expect(detail.getByRole('heading',{name:'清泽园'})).toBeVisible();
    await page.getByTestId('landmark-close').click();
  }
  await pickGarden();
  // A rebuild while the map is open must not leak markers into player view.
  await page.getByTestId('campus-huyu').click();await expect(canvas).toHaveAttribute('data-view','player');
  await expect(canvas).toHaveAttribute('data-visible-markers','0');await expect(labels).toBeHidden();
  await page.getByRole('button',{name:'打开校园地图'}).click();await expect(canvas).toHaveAttribute('data-visible-markers',String(campuses.huyu.landmarks.length));
  await expect(labels).toBeVisible();await page.getByTestId('campus-yingxi').click();
  await expect(canvas).toHaveAttribute('data-view','player');await expect(canvas).toHaveAttribute('data-visible-markers','0');await expect(labels).toBeHidden();
  await page.getByRole('button',{name:'打开校园地图'}).click();await expect(canvas).toHaveAttribute('data-visible-markers',String(campuses.yingxi.landmarks.length));
  await pickGarden();
  await page.getByRole('button',{name:'返回人物视角'}).click();await expect(canvas).toHaveAttribute('data-visible-markers','0');await expect(labels).toBeHidden();
  await expect(canvas).not.toHaveAttribute('data-map-markers',/.+/);
  await page.screenshot({path:info.outputPath('map-marker-return-player.png')});
});

test('late garden loading cannot replace another campus and recovers after return', async ({page},info) => {
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  let release!:()=>void,seen!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;}), requested=new Promise<void>(resolve=>{seen=resolve;});
  await page.route('**/assets/campuses/yingxi/qingze-reading-garden.glb',async route=>{seen();await gate;await route.continue();});
  try {
    await page.goto('/',{waitUntil:'domcontentloaded'});await requested;
    const canvas=page.getByTestId('campus-canvas');
    await expect(canvas).toHaveAttribute('data-model-yx-garden-setting','loading');
    await page.getByTestId('campus-huyu').click();
    await expect(page.getByTestId('campus-huyu')).toHaveAttribute('aria-pressed','true');
    const finished=page.waitForEvent('requestfinished',{predicate:request=>request.url().includes('/qingze-reading-garden.glb'),timeout:30000});
    release();await finished;
    // Let the original asynchronous GLTF parse settle while Huyu remains active.
    const frame=Number(await canvas.getAttribute('data-frame'));
    await expect.poll(async()=>Number(await canvas.getAttribute('data-frame')),{timeout:15000}).toBeGreaterThanOrEqual(frame+4);
    await expect(canvas).not.toHaveAttribute('data-model-yx-garden-setting',/.+/);
    await expect(page.getByTestId('campus-huyu')).toHaveAttribute('aria-pressed','true');
    await page.getByTestId('campus-yingxi').click();
    await expect(canvas).toHaveAttribute('data-model-yx-garden-setting','ready',{timeout:30000});
    await page.getByTestId('open-hks').click();await expect(page.frameLocator('[data-testid="hks-frame"]').locator('canvas')).toBeVisible({timeout:30000});
    await page.getByTestId('hks-return').click();await expect(canvas).toHaveAttribute('data-model-yx-garden-setting','ready');
    await expect(canvas).toHaveAttribute('data-paused','false');await expect(page.getByTestId('scene-error')).toHaveCount(0);
    await page.screenshot({path:info.outputPath('garden-late-load-return.png')});expect(errors).toEqual([]);
  } finally { release(); }
});

for (const gardenMode of ['ready','fallback'] as const) {
  test(`garden ${gardenMode}: reachable open approach and visible island stops real movement`, async ({page},info)=>{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    if (gardenMode==='fallback') await page.route('**/assets/campuses/yingxi/qingze-reading-garden.glb',route=>route.abort());
    await page.goto('/');await page.getByRole('button',{name:'开始手记',exact:true}).click();const canvas=page.getByTestId('campus-canvas');
    await expect(canvas).toHaveAttribute('data-model-yx-garden-setting',gardenMode,{timeout:30000});
    await expect(canvas).toHaveAttribute('data-model-yx-mechanical','ready',{timeout:30000});
    await canvas.focus();await walkTo(page,canvas,campuses.yingxi,PHOTO_POINTS[1]!.position,1);
    const approach=await position(canvas);
    expect(Math.hypot(approach[0]-PHOTO_POINTS[1]!.position[0],approach[2]-PHOTO_POINTS[1]!.position[1])).toBeLessThan(1.5);
    await rotateTo(page,canvas,0,-.15);await expect(page.getByTestId('photo-guide')).toContainText('清泽园 · 花间',{timeout:15000});
    await page.screenshot({path:info.outputPath(`garden-${gardenMode}-approach.png`)});
    if(gardenMode==='fallback') {
      await canvas.focus();await page.keyboard.press('e');
      await expect(page.getByTestId('photo-hint')).toContainText('原创花园未能加载，暂无法记录垂枝树');
      expect(await stampIds(page)).toEqual([]);await expect(page.getByTestId('photo-record')).toBeDisabled();
    }
    // The c052 design opens from the north, with an actual 0.40m visible
    // flower island around (35.85,205.4). Reach its rim by keyboard, hold
    // forward against it, then genuinely walk around its side. Coordinates
    // are design geometry, not measured geography or a state-setting API.
    await walkTo(page,canvas,campuses.yingxi,[35.85,200],.9);
    await rotateTo(page,canvas,0,-.15);await canvas.focus();await page.keyboard.down('w');
    try {
      await expect.poll(async()=>(await position(canvas))[2],{timeout:30000,intervals:[300]}).toBeGreaterThan(202.5);
      await page.waitForTimeout(2000);const wall=await position(canvas);
      await page.screenshot({path:info.outputPath(`garden-${gardenMode}-island.png`)});
      await page.waitForTimeout(3000);const still=await position(canvas);
      expect(wall[2], 'Player must reach the island rather than an invisible blocker in the open approach').toBeGreaterThan(203);
      expect(still[2], 'Player must not walk through the visible island').toBeLessThan(204.18);
      expect(Math.hypot(still[0]-wall[0],still[2]-wall[2])).toBeLessThan(1.5);
      expect(still[1]).toBeLessThan(.35);
      await info.attach(`garden-${gardenMode}-collision`,{body:JSON.stringify({approach,wall,still},null,2),contentType:'application/json'});
    } finally { await page.keyboard.up('w'); }
    await walkTo(page,canvas,campuses.yingxi,[30.5,203],.9);
    await walkTo(page,canvas,campuses.yingxi,[30.5,208],.9);
    const around=await position(canvas);expect(around[2]).toBeGreaterThan(207);
    await page.screenshot({path:info.outputPath(`garden-${gardenMode}-around.png`)});
    expect(errors).toEqual([]);await expect(page.getByTestId('scene-error')).toHaveCount(0);
  });
}
