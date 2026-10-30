import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { campuses } from '../../src/campus-data/campuses';
import { PHOTO_POINTS } from '../../src/games/photography';
import { position, walkTo } from './campus-walk';

// Read-only telemetry supplements actual input and screenshots; it never controls the game.
test.setTimeout(420000);
async function ready(page: Page) {
  await page.goto('/');
  const canvas = page.getByTestId('campus-canvas');
  await expect(canvas).toHaveAttribute('data-player-model', 'ready', { timeout: 30000 });
  await expect(canvas).toHaveAttribute('data-model-yx-mechanical', 'ready', { timeout: 30000 });
  return canvas;
}
async function dragLook(page: Page, canvas: Locator, dx: number) {
  const box = await canvas.boundingBox(); if (!box) throw new Error('No campus canvas bounds');
  const x = box.x + box.width * .5, y = box.y + box.height * .5;
  await page.mouse.move(x,y); await page.mouse.down();
  await page.mouse.move(x+dx,y,{steps:12}); await page.mouse.up();
}
async function stampIds(page: Page): Promise<string[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('campus-atlas:photo-stamps:v1') ?? '[]') as string[]);
}

test('scenic diary: genuine walk, framing, two captures, Hks round-trip and local postcard', async ({ page }, info) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const canvas=await ready(page), guide=page.getByTestId('photo-guide'), hint=page.getByTestId('photo-hint');
  await expect(guide).toContainText('0 / 2');
  await expect(hint).toContainText('构图就绪', {timeout:30000});
  await page.screenshot({path:info.outputPath('photo-hall-ready.png')});
  await page.getByRole('button',{name:'打开校园地图'}).click(); await expect(canvas).toHaveAttribute('data-view','map');
  await page.keyboard.press('e'); await expect(hint).toContainText('返回人物视角'); expect(await stampIds(page)).toEqual([]);
  await page.getByRole('button',{name:'返回人物视角'}).click(); await expect(canvas).toHaveAttribute('data-view','player');
  await page.getByTestId('open-directory').click(); await page.keyboard.press('e'); expect(await stampIds(page)).toEqual([]);
  await page.getByTestId('landmark-close').click(); await expect(hint).toContainText('构图就绪',{timeout:15000});
  // A source-derived tree-occluded candidate: move ~7m north within the
  // first 8m observation radius, then aim slightly back toward the tower.
  // This must be verified by actual input and visible feedback, not by
  // injecting a blocker or directly calling the scene inspection API.
  await canvas.focus();await page.keyboard.down('a');
  try { await expect.poll(async()=>(await position(canvas))[2],{timeout:15000}).toBeLessThan(168.9); }
  finally { await page.keyboard.up('a'); }
  const blockedAt=await position(canvas);
  expect(Math.hypot(blockedAt[0]-PHOTO_POINTS[0]!.position[0],blockedAt[2]-PHOTO_POINTS[0]!.position[1])).toBeLessThan(PHOTO_POINTS[0]!.radius);
  await dragLook(page,canvas,-19);await canvas.focus();await page.keyboard.press('e');
  await expect(hint).toContainText('被景物遮住',{timeout:10000});expect(await stampIds(page)).toEqual([]);
  await page.screenshot({path:info.outputPath('photo-real-tree-obstruction.png')});
  await dragLook(page,canvas,19);await canvas.focus();await page.keyboard.down('d');
  try { await expect.poll(async()=>(await position(canvas))[2],{timeout:15000}).toBeGreaterThan(175); }
  finally { await page.keyboard.up('d'); }
  await expect(hint).toContainText('构图就绪',{timeout:15000});
  // A real rightward camera drag puts the target outside the frame. The game
  // must reject E instead of granting progress. Restore the view by dragging back.
  await dragLook(page,canvas,300); await canvas.focus(); await page.keyboard.press('e');
  await expect(hint).toContainText('转动视角', {timeout:10000}); expect(await stampIds(page)).toEqual([]);
  await page.screenshot({path:info.outputPath('photo-wrong-framing.png')});
  await dragLook(page,canvas,-300); await expect(hint).toContainText('构图就绪',{timeout:15000});
  await canvas.focus(); await page.keyboard.press('e');
  await expect(guide).toContainText('1 / 2'); expect(await stampIds(page)).toEqual(['hall']);
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
  // Walk the ~53m connection using keys, not a position/state injection.
  await walkTo(page,canvas,campuses.yingxi,PHOTO_POINTS[1]!.position);
  const there=await position(canvas);expect(Math.hypot(there[0]-PHOTO_POINTS[1]!.position[0],there[2]-PHOTO_POINTS[1]!.position[1])).toBeLessThan(PHOTO_POINTS[1]!.radius);
  await expect(hint).toContainText('构图就绪',{timeout:30000}); await page.screenshot({path:info.outputPath('photo-garden-ready.png')});
  // Exercise the actual visible shutter as a pointer action for the second capture.
  await page.getByTestId('photo-record').click();
  const complete=page.getByTestId('photo-complete');await expect(complete).toBeVisible();expect(await stampIds(page)).toEqual(['hall','garden']);
  const photos=complete.locator('img');await expect(photos).toHaveCount(2);
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
  await complete.getByRole('button',{name:'继续漫游'}).click();await expect(complete).toHaveCount(0);
  await guide.getByRole('button',{name:/查看手记/}).click();await expect(complete).toBeVisible();
  await complete.getByRole('button',{name:/机械馆 · 初见/}).click();await expect(complete).toHaveCount(0);
  await walkTo(page,canvas,campuses.yingxi,PHOTO_POINTS[0]!.position);
  await expect(hint).toContainText('构图就绪',{timeout:30000});await canvas.focus();await page.keyboard.press('e');
  await expect(complete).toBeVisible();expect(await stampIds(page)).toEqual(['hall','garden']);
  await complete.getByRole('button',{name:'关闭手记'}).click();await expect(complete).toHaveCount(0);
  await guide.getByRole('button',{name:/查看手记/}).click();await expect(complete).toBeVisible();
  await page.reload();await expect(guide).toContainText('2 / 2');await guide.getByRole('button',{name:/查看手记/}).click();
  await expect(complete).toContainText('照片只留在本次游玩中');
  await expect(complete.getByRole('button',{name:/保存明信片到本机/})).toBeDisabled();
  await complete.getByRole('button',{name:'重新收集'}).click();await expect(guide).toContainText('0 / 2');expect(await stampIds(page)).toEqual([]);
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
  const ground=(await position(canvas))[1];await canvas.focus();await page.keyboard.press('Space');
  await expect(canvas).toHaveAttribute('data-player-motion','airborne',{timeout:15000});
  expect((await position(canvas))[1]).toBeGreaterThan(ground+.1);await page.screenshot({path:info.outputPath('student-airborne.png')});
  await expect(canvas).toHaveAttribute('data-player-motion','idle',{timeout:15000});
  await expect.poll(async()=>Math.abs((await position(canvas))[1]-ground),{timeout:15000}).toBeLessThan(.1);
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
  test('a real tap on the shutter records the first natural view',async({page},info)=>{
    await ready(page);await expect(page.getByTestId('photo-hint')).toContainText('构图就绪',{timeout:30000});
    await page.screenshot({path:info.outputPath('photo-touch-ready.png')});
    await page.getByTestId('photo-record').tap();
    await expect(page.getByTestId('photo-guide')).toContainText('1 / 2');expect(await stampIds(page)).toEqual(['hall']);
    await page.screenshot({path:info.outputPath('photo-touch-recorded.png')});
  });
});

test('student camera at a real wall fades the close avatar and restores it when looking away',async({page},info)=>{
  const canvas=await ready(page);await page.getByTestId('campus-huyu').click();
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
