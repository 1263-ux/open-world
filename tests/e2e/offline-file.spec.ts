// Set OFFLINE_HTML to the absolute extracted offline index.html. Run with scripts/offline/playwright.config.ts.
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { assertKnowledgeDismissHint, assertLandscapeCanvasAndHud, observeNaturalKnowledgeScroll } from './hks-landscape-layout';

const file = process.env.OFFLINE_HTML;
const target = file ? pathToFileURL(file).href : '';
test.skip(!file, 'Set OFFLINE_HTML to the absolute extracted offline index.html');
type MessageEvidence = { type: string; origin: string; parentLocationOrigin: string; parentWindowOrigin: string; sourceMatchesFrame: boolean };
declare global { interface Window { __recordOfflineMessage: (e: MessageEvidence) => Promise<void> } }
const messageEvidence = new WeakMap<Page, MessageEvidence[]>();
test.afterEach(async ({ page }, info) => {
  const parent = await page.evaluate(() => ({ locationOrigin: location.origin, windowOrigin: window.origin,
    protocol: location.protocol })).catch(() => null);
  const frame = page.frames().find(item => item.url() === 'about:srcdoc');
  const child = frame ? await frame.evaluate(() => ({ locationOrigin: location.origin, windowOrigin: window.origin,
    canvasState: document.querySelector('canvas')?.getAttribute('data-hks-state') ?? null })).catch(() => null) : null;
  await info.attach('offline-origin-evidence', { body: JSON.stringify({ parent, child, messages: messageEvidence.get(page) ?? [] }, null, 2), contentType: 'application/json' });
});
async function guard(page: Page) {
  // Read-only diagnostics retained across reloads and attached on success or failure.
  const evidence: MessageEvidence[] = []; messageEvidence.set(page, evidence);
  await page.exposeBinding('__recordOfflineMessage', (_source, item: MessageEvidence) => { evidence.push(item); });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    window.addEventListener('message', event => {
      const type = event.data?.type;
      if (!['hks:ready', 'hks:error', 'hks:return'].includes(type)) return;
      const iframe = document.querySelector<HTMLIFrameElement>('[data-testid="hks-frame"]');
      void window.__recordOfflineMessage({ type, origin: event.origin, parentLocationOrigin: location.origin,
        parentWindowOrigin: window.origin, sourceMatchesFrame: event.source === iframe?.contentWindow });
    });
  });
  const blocked = new Set<string>();
  const allowed = (url: string) => url === target || /^(data:|blob:|about:)/.test(url);
  page.on('request', request => { if (!allowed(request.url())) blocked.add(request.url()); });
  await page.route('**/*', async route => {
    if (allowed(route.request().url())) await route.continue();
    else { blocked.add(route.request().url()); await route.abort(); }
  });
  return blocked;
}
async function natureEvidence(page: Page, campus: Locator, id: 'huyu' | 'yingxi', info: TestInfo) {
  await expect(campus).toHaveAttribute('data-campus-ready',id,{timeout:30000});
  await expect(campus).toHaveAttribute('data-arrival-nature-status','ready',{timeout:30000});
  await expect(campus).toHaveAttribute('data-arrival-nature-instances',id==='huyu'?'28':'34');
  const evidence=await campus.evaluate(e=>{const d=(e as HTMLElement).dataset;return {campus:d.campusReady,status:d.arrivalNatureStatus,instances:Number(d.arrivalNatureInstances),generation:d.arrivalNatureGeneration,world:d.worldGeneration,stats:JSON.parse(d.arrivalNatureStats??'null'),ratio:d.renderRatio,shadow:d.shadowType,frame:d.frame,xyz:[d.playerX,d.playerY,d.playerZ]};});
  expect(evidence.generation).toBe(evidence.world);expect(evidence.stats.instances).toBe(evidence.instances);
  if(id==='yingxi'){await expect(campus).toHaveAttribute('data-near-hall-tree-replacement','4/6');await expect(campus).toHaveAttribute('data-near-hall-tree-replacement-ids','0,1,2,4');}
  console.log('[OFFLINE_NATURE]',JSON.stringify(evidence));await info.attach(`offline-${id}-nature`,{body:JSON.stringify(evidence,null,2),contentType:'application/json'});
  await page.screenshot({path:info.outputPath(`offline-${id}-campus.png`)});
}
async function snapshot(c: Locator) { return JSON.parse(await c.getAttribute('data-hks-state') ?? '{}'); }
async function clickGame(page: Page, c: Locator, x: number, y: number) {
  const box=await c.boundingBox(); if(!box) throw Error('No game canvas');
  const w=Number(await c.getAttribute('data-logical-width')),h=Number(await c.getAttribute('data-logical-height'));
  await page.mouse.click(box.x+box.width*x/w,box.y+box.height*y/h);
}
async function launch(page: Page) {
  const before = messageEvidence.get(page)?.length ?? 0;
  await page.getByTestId('open-hks').click();
  await expect(page.getByTestId('hks-loading')).toHaveCount(0,{timeout:30000});
  await expect(page.getByTestId('hks-error')).toHaveCount(0);
  await expect.poll(() => (messageEvidence.get(page) ?? []).slice(before).some(m =>
    m.type === 'hks:ready' && m.origin === 'null' && m.sourceMatchesFrame), { timeout: 5000 }).toBe(true);
  const canvas=page.frameLocator('[data-testid="hks-frame"]').locator('canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(async()=> (await snapshot(canvas)).scene).toContain('MenuScene');
  return canvas;
}
async function start(page: Page, canvas: Locator) {
  const w=Number(await canvas.getAttribute('data-logical-width'));
  await clickGame(page,canvas,w/2,395);
  // The menu fades out for 550 ms of Phaser game time; slow software-rendered CI can take longer than 5 s wall time.
  await expect.poll(async()=> (await snapshot(canvas)).scene,{timeout:15000}).toContain('TutorialScene');
  await clickGame(page,canvas,w-44,37);
  await expect.poll(async()=> (await snapshot(canvas)).scene,{timeout:15000}).toContain('GameScene');
}
test('file:// campus, embedded model, Hks movement and repeated return without asset requests', async ({ page }, info) => {
  test.setTimeout(150000); const blocked=await guard(page), errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(target); const campus=page.getByTestId('campus-canvas');
  await expect(campus).toBeVisible(); await expect(page.getByTestId('scene-error')).toHaveCount(0);
  await page.getByTestId('campus-yingxi').click(); await expect(campus).toHaveAttribute('data-hero-model','ready',{timeout:30000}); await natureEvidence(page,campus,'yingxi',info);
  await page.getByTestId('campus-huyu').click(); await expect(campus).toHaveAttribute('data-hero-model','ready',{timeout:30000}); await natureEvidence(page,campus,'huyu',info);
  if (!await page.getByTestId('quest-start').isVisible()) await page.getByTestId('open-quest').click();
  await page.getByTestId('quest-start').click();
  const status=await page.getByTestId('quest-status').textContent(); const canvas=await launch(page);
  await expect(campus).toHaveAttribute('data-paused','true'); await start(page,canvas);
  const before=await snapshot(canvas); await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(1300); await page.keyboard.up('ArrowLeft');
  await expect.poll(async()=> (await snapshot(canvas)).x).toBeLessThan(before.x-30);
  await page.screenshot({path:info.outputPath('offline-gameplay.png'),fullPage:true});
  await page.keyboard.press('Escape'); await expect(page.getByTestId('hks-overlay')).toHaveCount(0);
  await expect(campus).toHaveAttribute('data-paused','false'); await expect(page.getByTestId('quest-status')).toHaveText(status!);
  await launch(page); await page.getByTestId('hks-return').click(); await expect(page.getByTestId('hks-overlay')).toHaveCount(0);
  await page.reload(); await expect(page.getByTestId('quest-status')).toHaveText(status!);
  expect([...blocked],'Unexpected automatic requests').toEqual([]); expect(errors).toEqual([]);
});


test.describe('file:// touch-capable phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });
  test('models load and real touch moves Hks without external requests', async ({ page }, info) => {
    test.setTimeout(150000); const blocked=await guard(page), errors:string[]=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto(target); const campus=page.getByTestId('campus-canvas');
    await expect(campus).toBeVisible(); await page.getByTestId('campus-huyu').click();
    // Huyu reports ready only after both registered models are ready.
    await expect(campus).toHaveAttribute('data-hero-model','ready',{timeout:30000}); await natureEvidence(page,campus,'huyu',info);
    await page.getByTestId('campus-yingxi').click();
    await expect(campus).toHaveAttribute('data-hero-model','ready',{timeout:30000}); await natureEvidence(page,campus,'yingxi',info);
    const canvas=await launch(page); await start(page,canvas); const before=await snapshot(canvas);
    await assertLandscapeCanvasAndHud(page,canvas,info);
    // Wait for the real first-encounter knowledge card; capture it before dismissing it.
    await expect.poll(async()=> { const state=await snapshot(canvas); return state.paused && !state.levelUp; },{timeout:30000}).toBe(true);
    await assertKnowledgeDismissHint(page,info);
    await page.screenshot({path:info.outputPath('offline-mobile-knowledge.png'),fullPage:true});
    await observeNaturalKnowledgeScroll(page,info);
    // Observe the imported knowledge card before dismissing it with a real tap.
    const touch=await page.context().newCDPSession(page), box=await canvas.boundingBox();
    if(!box || typeof before.x !== 'number') throw Error('No game canvas or player position');
    const x=box.x+box.width*.2, y=box.y+box.height*.75, deadline=Date.now()+30000;
    const observations: { elapsedMs: number; x: number | null; paused: boolean; levelUp: boolean }[] = [];
    const started=Date.now(); let held=false, moved=false;
    try {
      while (Date.now()<deadline) {
        const state=await snapshot(canvas);
        observations.push({elapsedMs:Date.now()-started,x:state.x ?? null,paused:!!state.paused,levelUp:!!state.levelUp});
        if(typeof state.x === 'number' && state.x>before.x+20) { moved=true; break; }
        if(state.ended) throw Error('Game ended before touch movement could be verified');
        if(state.paused) {
          if(held) { await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); held=false; }
          if(state.levelUp) throw Error('Unexpected level-up interruption while checking early movement');
          // The imported game uses a DOM knowledge card above the canvas.
          const popup=page.frameLocator('[data-testid="hks-frame"]').locator('#monster-popup');
          await expect(popup).toBeVisible(); await popup.tap();
          await expect(popup).toBeHidden();
          await expect.poll(async()=> (await snapshot(canvas)).paused,{timeout:10000}).toBe(false);
        } else if(!held) {
          await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]}); held=true;
          await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+60,y,id:1}]});
        }
        // Keep the actual touch held across game frames until movement or an interruption is observed.
        await page.waitForTimeout(300);
      }
    } finally {
      if(held) await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await info.attach('offline-touch-observations',{body:JSON.stringify({baselineX:before.x,moved,observations},null,2),contentType:'application/json'});
    }
    expect(moved,'Real held touch should move the player after any first-encounter popup is dismissed').toBe(true);
    await page.screenshot({path:info.outputPath('offline-mobile-play.png'),fullPage:true});
    await page.getByTestId('hks-return').click(); await expect(campus).toHaveAttribute('data-paused','false');
    expect([...blocked],'Unexpected automatic requests').toEqual([]); expect(errors).toEqual([]);
  });
});
