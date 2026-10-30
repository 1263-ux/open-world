import { expect, test, type Page, type Locator } from '@playwright/test';
import { campuses } from '../../src/campus-data/campuses';
import { position, walkTo } from './campus-walk';

test.setTimeout(600000);
async function start(page: Page) {
  if (!await page.getByTestId('quest-start').isVisible()) await page.getByTestId('open-quest').click();
  await page.getByTestId('quest-start').click();
}
async function selectHuyu(page: Page) {
  await page.getByTestId('campus-huyu').click();
  const canvas = page.getByTestId('campus-canvas');
  await expect.poll(async () => {
    const x = await canvas.getAttribute('data-player-x'), z = await canvas.getAttribute('data-player-z');
    return x === null || z === null ? Infinity : Math.hypot(Number(x)-campuses.huyu.start[0], Number(z)-campuses.huyu.start[1]);
  }, { timeout: 15000 }).toBeLessThan(1);
}
async function record(page: Page, canvas: Locator, campus: typeof campuses.huyu, index: number) {
  const landmark = campus.landmarks.find(item => item.id === campus.questOrder[index])!;
  await page.getByTestId('quest-travel').click();
  await walkTo(page, canvas, campus, landmark.arrival);
  await expect(page.getByTestId('arrival-status')).toContainText('已到达', { timeout: 15000 });
  await page.getByTestId('answer-1').click(); await expect(page.getByTestId('quest-check-in')).toBeDisabled();
  await page.getByTestId('answer-0').click(); await page.getByTestId('quest-check-in').click();
}

test('default Yingxi hall: optional quest preserves location and runtime frame evidence', async ({ page }, info) => {
  await page.goto('/');
  const canvas = page.getByTestId('campus-canvas');
  await expect(page.getByTestId('campus-yingxi')).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas).toHaveAttribute('data-model-yx-mechanical', 'ready', { timeout: 30000 });
  await expect.poll(async () => { const [x,,z] = await position(canvas); return Math.hypot(x + 32,z - 175.5); }).toBeLessThan(1);
  const before = await position(canvas);
  await start(page);
  const after = await position(canvas);
  expect(Math.hypot(after[0]-before[0], after[2]-before[2]), 'Starting an optional quest must not teleport').toBeLessThan(.1);
  await page.getByTestId('landmark-close').click();
  await page.screenshot({ path: info.outputPath('yingxi-default-hall.png') });
  const measurement = await page.evaluate(async () => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="campus-canvas"]');
    if (!canvas) throw new Error('Missing canvas');
    const start = performance.now(), firstFrame = Number(canvas.dataset.frame);
    const intervals: number[] = []; let previous = start;
    const samples: { calls: number; triangles: number }[] = [];
    await new Promise<void>(resolve => {
      const tick = (now: number) => {
        intervals.push(now - previous); previous = now;
        samples.push({ calls: Number(canvas.dataset.drawCalls), triangles: Number(canvas.dataset.triangles) });
        if (now - start >= 5000) resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const elapsedMs = performance.now() - start, frames = Number(canvas.dataset.frame) - firstFrame;
    const sorted = intervals.slice().sort((a,b) => a-b);
    return { elapsedMs, frames, fps: frames * 1000 / elapsedMs,
      frameIntervalMedianMs: sorted[Math.floor(sorted.length * .5)], frameIntervalP95Ms: sorted[Math.floor(sorted.length * .95)],
      drawCallsMin: Math.min(...samples.map(s => s.calls)), drawCallsMax: Math.max(...samples.map(s => s.calls)),
      trianglesMin: Math.min(...samples.map(s => s.triangles)), trianglesMax: Math.max(...samples.map(s => s.triangles)),
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio }, userAgent: navigator.userAgent,
      scene: 'Yingxi default mechanical hall spawn; model loaded; optional quest panel closed; 5 seconds',
    };
  });
  await info.attach('yingxi-runtime-performance', { body: JSON.stringify(measurement, null, 2), contentType: 'application/json' });
  expect(measurement.frames).toBeGreaterThan(0);
  expect(measurement.drawCallsMin).toBeGreaterThan(0); expect(measurement.trianglesMin).toBeGreaterThan(0);
  // This is a runner-specific measurement, not a universal FPS guarantee.
});

test('desktop: player-directed walk, observations, chapter completion and replay', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await selectHuyu(page); const canvas = page.getByTestId('campus-canvas');
  await expect(canvas).toBeVisible(); await expect(page.getByTestId('scene-error')).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-view', 'player');
  await expect.poll(() => canvas.getAttribute('data-player-x')).not.toBeNull();
  await page.screenshot({ path: info.outputPath('campus-desktop.png') });
  await start(page);
  await page.getByTestId('quest-travel').click();
  const before = await position(canvas); await page.waitForTimeout(1200); const after = await position(canvas);
  expect(Math.hypot(after[0]-before[0], after[2]-before[2]), 'A direction guide must not auto-walk the player').toBeLessThan(.25);
  await walkTo(page, canvas, campuses.huyu, campuses.huyu.landmarks.find(item => item.id === campuses.huyu.questOrder[0])!.arrival);
  await expect(page.getByTestId('arrival-status')).toContainText('已到达', { timeout: 15000 });
  await page.getByTestId('answer-1').click(); await expect(page.getByTestId('quest-check-in')).toBeDisabled();
  await page.getByTestId('answer-0').click(); await page.getByTestId('quest-check-in').click();
  await expect(page.getByTestId('quest-status')).toContainText('1 / 3');
  const nextTarget = campuses.huyu.landmarks.find(item => item.id === campuses.huyu.questOrder[1])!.name;
  await expect(page.getByRole('complementary', { name: '漫游旅程' })).toContainText(nextTarget);
  const savedBeforeHks = await position(canvas), yawBeforeHks = await canvas.getAttribute('data-camera-yaw');
  await page.getByTestId('open-hks').click();
  await expect(page.getByTestId('hks-loading')).toHaveCount(0, { timeout: 30000 });
  await expect(page.getByTestId('hks-error')).toHaveCount(0);
  await expect(page.frameLocator('[data-testid="hks-frame"]').locator('canvas')).toBeVisible();
  await page.getByTestId('hks-return').click(); await expect(canvas).toHaveAttribute('data-paused', 'false');
  const restoredAfterHks = await position(canvas);
  expect(Math.hypot(restoredAfterHks[0]-savedBeforeHks[0], restoredAfterHks[2]-savedBeforeHks[2])).toBeLessThan(.1);
  expect(await canvas.getAttribute('data-camera-yaw')).toBe(yawBeforeHks);
  await expect(page.getByTestId('campus-huyu')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('quest-status')).toContainText('1 / 3');
  await expect(page.getByRole('complementary', { name: '漫游旅程' })).toContainText(nextTarget);
  // Chapter progress persists through a campus switch and a reload. Player position is intentionally reset by these actions.
  await page.getByTestId('campus-yingxi').click(); await page.getByTestId('campus-huyu').click();
  await expect(page.getByTestId('quest-status')).toContainText('1 / 3'); await page.reload();
  await expect(page.getByTestId('quest-status')).toContainText('1 / 3');
  if (!await page.getByTestId('quest-travel').isVisible()) await page.getByTestId('open-quest').click();
  await record(page, canvas, campuses.huyu, 1); await record(page, canvas, campuses.huyu, 2);
  await expect(page.getByTestId('completion')).toBeVisible(); await page.screenshot({ path: info.outputPath('campus-complete.png') });
  await page.getByTestId('quest-replay').click(); await expect(page.getByTestId('quest-status')).toContainText('0 / 3');
  await page.getByTestId('quest-exit').click(); await expect(page.getByTestId('quest-status')).toContainText('准备出发');
  expect(errors).toEqual([]);
});

test('Yingxi chapter: real walking through every arrival and replay', async ({ page }, info) => {
  await page.goto('/'); const canvas=page.getByTestId('campus-canvas'); await page.getByTestId('campus-yingxi').click();
  await expect.poll(() => canvas.getAttribute('data-player-x')).not.toBeNull();
  await expect.poll(async()=>{const [x,,z]=await position(canvas);return Math.hypot(x-(-32),z-175.5);},{timeout:15000}).toBeLessThan(1); await start(page);
  for(let i=0;i<campuses.yingxi.questOrder.length;i++) await record(page,canvas,campuses.yingxi,i);
  await expect(page.getByTestId('completion')).toBeVisible(); await page.screenshot({path:info.outputPath('yingxi-complete.png')});
  await page.getByTestId('quest-replay').click(); await expect(page.getByTestId('quest-status')).toContainText('0 / 4');
  await page.getByTestId('quest-exit').click(); await expect(page.getByTestId('quest-status')).toContainText('准备出发');
});

test('desktop: real controls, map toggling, jump, focus and repeated switches', async ({ page }) => {
  await page.goto('/'); await selectHuyu(page); const canvas = page.getByTestId('campus-canvas'); await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.getAttribute('data-player-x')).not.toBeNull();
  // Switching campus leaves the real button focused; WASD must work without
  // an extra canvas click while Space still activates focused controls.
  const initial = await position(canvas);
  await page.keyboard.down('w'); await page.waitForTimeout(1300); await page.keyboard.up('w');
  const walked = await position(canvas); expect(Math.hypot(walked[0]-initial[0],walked[2]-initial[2])).toBeGreaterThan(1);
  await page.keyboard.down('Shift'); await page.keyboard.down('w'); await page.waitForTimeout(1300); await page.keyboard.up('w'); await page.keyboard.up('Shift');
  const ran = await position(canvas); expect(Math.hypot(ran[0]-walked[0],ran[2]-walked[2])).toBeGreaterThan(Math.hypot(walked[0]-initial[0],walked[2]-initial[2])*1.3);
  await page.keyboard.press('Space'); await expect.poll(async () => (await position(canvas))[1], { timeout: 2000, intervals: [50] }).toBeGreaterThan(initial[1] + .1);
  const yaw = Number(await canvas.getAttribute('data-camera-yaw')); const box = await canvas.boundingBox(); if (!box) throw Error('Missing canvas bounds');
  await page.mouse.move(box.x + box.width*.55,box.y + box.height*.45); await page.mouse.down(); await page.mouse.move(box.x + box.width*.65,box.y + box.height*.45,{steps:8}); await page.mouse.up();
  await expect.poll(async () => Number(await canvas.getAttribute('data-camera-yaw'))).not.toBe(yaw);
  const pos = await position(canvas); await page.getByRole('button',{name:'打开校园地图'}).click(); await expect(canvas).toHaveAttribute('data-view','map');
  await page.getByRole('button',{name:'返回人物视角'}).click(); await expect(canvas).toHaveAttribute('data-view','player');
  const returned = await position(canvas); expect(Math.hypot(returned[0]-pos[0],returned[2]-pos[2])).toBeLessThan(.25);
  for (let i=0;i<3;i++) { await page.getByTestId('campus-yingxi').click(); await page.getByTestId('campus-huyu').click(); }
  await expect(page.getByTestId('scene-error')).toHaveCount(0);
  // Space on a focused launcher must activate the control, not be swallowed as a jump.
  await page.getByTestId('open-directory').focus(); await page.keyboard.press('Space'); await expect(page.getByRole('complementary',{name:'校园地点目录'})).toBeVisible();
});

test('desktop: releasing keys and losing window focus stop movement', async ({ page }) => {
  await page.goto('/'); await selectHuyu(page);
  const canvas = page.getByTestId('campus-canvas');
  await expect.poll(() => canvas.getAttribute('data-player-x')).not.toBeNull();
  await canvas.focus();
  await page.keyboard.down('w'); await page.waitForTimeout(800); await page.keyboard.up('w');
  const stopped = await position(canvas); await page.waitForTimeout(600);
  let after = await position(canvas);
  expect(Math.hypot(after[0]-stopped[0], after[2]-stopped[2]), 'Releasing W stops the player').toBeLessThan(.25);
  await page.keyboard.down('w'); await page.waitForTimeout(500);
  const other = await page.context().newPage();
  try {
    await other.goto('about:blank'); await other.bringToFront();
    await page.bringToFront();
    const restored = await position(canvas); await page.waitForTimeout(700); after = await position(canvas);
    expect(Math.hypot(after[0]-restored[0], after[2]-restored[2]), 'W must be cleared on window blur, even if its keyup was missed').toBeLessThan(.25);
  } finally { await page.keyboard.up('w'); await other.close(); }
});

test.describe('landscape touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });
  test('real left-stick and right-look gestures; phone can return from map', async ({ page }, info) => {
    await page.goto('/'); await selectHuyu(page); const canvas=page.getByTestId('campus-canvas'); await expect(canvas).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
    await expect.poll(() => canvas.getAttribute('data-player-x')).not.toBeNull();
    const before=await position(canvas), box=await canvas.boundingBox(); if(!box) throw Error('Missing canvas bounds');
    const touch=await page.context().newCDPSession(page), x=box.x+box.width*.2, y=box.y+box.height*.6;
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-65,id:1}]});
    await page.waitForTimeout(1500); await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const after=await position(canvas); const walked=Math.hypot(after[0]-before[0],after[2]-before[2]); expect(walked).toBeGreaterThan(1);
    const run=page.getByRole('button',{name:'按住跑步'}), runBox=await run.boundingBox(); if(!runBox)throw Error('Missing run control');
    const rxRun=runBox.x+runBox.width/2, ryRun=runBox.y+runBox.height/2;
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-65,id:1}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y-65,id:1},{x:rxRun,y:ryRun,id:2}]});
    await page.waitForTimeout(1500);await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const ran=await position(canvas);expect(Math.hypot(ran[0]-after[0],ran[2]-after[2])).toBeGreaterThan(walked*1.3);
    const jump=page.getByRole('button',{name:'跳跃'});await jump.tap();await expect.poll(async()=>(await position(canvas))[1],{timeout:2000,intervals:[50]}).toBeGreaterThan(ran[1]+.1);
    const yaw=Number(await canvas.getAttribute('data-camera-yaw')), rx=box.x+box.width*.7;
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rx,y,id:2}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rx+80,y,id:2}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(async()=>Number(await canvas.getAttribute('data-camera-yaw'))).not.toBe(yaw);
    await expect(page.getByRole('button',{name:'按住跑步'})).toBeVisible(); await expect(page.getByRole('button',{name:'跳跃'})).toBeVisible();
    await page.getByRole('button',{name:'打开校园地图'}).click(); await expect(canvas).toHaveAttribute('data-view','map');
    await page.getByRole('button',{name:'返回人物视角'}).click(); await expect(canvas).toHaveAttribute('data-view','player');
    await page.screenshot({path:info.outputPath('campus-landscape-touch.png')});
  });
});

test('WebGL denied: accessible list journey and corrupt save recovery', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('campus-atlas:quests','{broken'); const original=HTMLCanvasElement.prototype.getContext; Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{value:function(this:HTMLCanvasElement,type:string,...args:unknown[]){if(type.startsWith('webgl')) return null; return Reflect.apply(original,this,[type,...args]);}}); });
  await page.goto('/'); await page.getByTestId('campus-huyu').click(); await expect(page.getByTestId('scene-error')).toBeVisible(); await start(page);
  for(let i=0;i<3;i++){await page.getByTestId('quest-travel').click(); await expect(page.getByTestId('arrival-status')).toContainText('已打开观察题'); await page.getByTestId('answer-0').click(); await page.getByTestId('quest-check-in').click();}
  await expect(page.getByTestId('completion')).toBeVisible();
});

test('model loading failures retain the campus; repeated switches isolate late loads', async ({ page }) => {
  await page.route('**/assets/campuses/huyu/*.glb',async route=>{await new Promise(resolve=>setTimeout(resolve,900));await route.continue();});
  await page.goto('/'); const canvas=page.getByTestId('campus-canvas'); await selectHuyu(page); await page.getByTestId('campus-yingxi').click();
  await expect(canvas).toHaveAttribute('data-model-yx-mechanical','ready',{timeout:30000}); await page.waitForTimeout(1800);
  await expect(canvas).not.toHaveAttribute('data-model-hy-meihua','ready'); await page.unroute('**/assets/campuses/huyu/*.glb');
  await page.route('**/assets/campuses/huyu/north-gate.glb',route=>route.abort()); await page.getByTestId('campus-huyu').click();
  await expect(canvas).toHaveAttribute('data-model-hy-north-gate','fallback',{timeout:30000}); await expect(canvas).toHaveAttribute('data-model-hy-meihua','ready',{timeout:30000});
  await expect(page.getByTestId('model-notice')).toContainText('北门'); await expect(page.getByTestId('scene-error')).toHaveCount(0);
});

test('building collision stops a player at the sourced main-building footprint', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/'); await selectHuyu(page); const canvas=page.getByTestId('campus-canvas');
  await expect.poll(()=>canvas.getAttribute('data-player-z')).not.toBeNull();
  const start=await position(canvas);
  // At the initial Huyu heading, +Z intersects the main-building footprint near z=-142.78.
  // The player must reach the wall through input and then remain outside it while held.
  await page.keyboard.down('Shift'); await page.keyboard.down('w');
  try {
    await expect.poll(async()=>(await position(canvas))[2],{timeout:50000,intervals:[500]}).toBeGreaterThan(-144);
    const atWall=await position(canvas); await page.waitForTimeout(3000); const still=await position(canvas);
    expect(atWall[2]-start[2]).toBeGreaterThan(30);
    expect(still[2], 'The capsule must not tunnel through the building footprint').toBeLessThan(-142.78);
    expect(Math.abs(still[2]-atWall[2])).toBeLessThan(1.5);
  } finally { await page.keyboard.up('w'); await page.keyboard.up('Shift'); }
});
