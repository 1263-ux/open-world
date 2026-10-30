// Set OFFLINE_HTML to the absolute extracted offline index.html. Run with scripts/offline/playwright.config.ts.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';

const file = process.env.OFFLINE_HTML;
const target = file ? pathToFileURL(file).href : '';
test.skip(!file, 'Set OFFLINE_HTML to the absolute extracted offline index.html');
async function guard(page: Page) {
  const blocked = new Set<string>();
  const allowed = (url: string) => url === target || /^(data:|blob:|about:)/.test(url);
  page.on('request', request => { if (!allowed(request.url())) blocked.add(request.url()); });
  await page.route('**/*', async route => {
    if (allowed(route.request().url())) await route.continue();
    else { blocked.add(route.request().url()); await route.abort(); }
  });
  return blocked;
}
async function snapshot(c: Locator) { return JSON.parse(await c.getAttribute('data-hks-state') ?? '{}'); }
async function clickGame(page: Page, c: Locator, x: number, y: number) {
  const box=await c.boundingBox(); if(!box) throw Error('No game canvas');
  const w=Number(await c.getAttribute('data-logical-width')),h=Number(await c.getAttribute('data-logical-height'));
  await page.mouse.click(box.x+box.width*x/w,box.y+box.height*y/h);
}
async function launch(page: Page) {
  await page.getByTestId('open-hks').click();
  await expect(page.getByTestId('hks-loading')).toHaveCount(0,{timeout:30000});
  await expect(page.getByTestId('hks-error')).toHaveCount(0);
  const canvas=page.frameLocator('[data-testid="hks-frame"]').locator('canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(async()=> (await snapshot(canvas)).scene).toContain('MenuScene');
  return canvas;
}
async function start(page: Page, canvas: Locator) {
  const w=Number(await canvas.getAttribute('data-logical-width'));
  await clickGame(page,canvas,w/2,395);
  await expect.poll(async()=> (await snapshot(canvas)).scene).toContain('TutorialScene');
  await clickGame(page,canvas,w-44,37);
  await expect.poll(async()=> (await snapshot(canvas)).scene,{timeout:15000}).toContain('GameScene');
}
test('file:// campus, embedded model, Hks movement and repeated return without asset requests', async ({ page }, info) => {
  test.setTimeout(120000); const blocked=await guard(page), errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(target); const campus=page.getByTestId('campus-canvas');
  await expect(campus).toBeVisible(); await expect(page.getByTestId('scene-error')).toHaveCount(0);
  await page.getByTestId('campus-yingxi').click(); await expect(campus).toHaveAttribute('data-hero-model','ready',{timeout:30000});
  await page.getByTestId('campus-huyu').click(); await expect(campus).toHaveAttribute('data-hero-model','ready',{timeout:30000});
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
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('models load and real touch moves Hks without external requests', async ({ page }, info) => {
    test.setTimeout(120000); const blocked=await guard(page), errors:string[]=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto(target); const campus=page.getByTestId('campus-canvas');
    await expect(campus).toBeVisible();
    // Huyu reports ready only after both registered models are ready.
    await expect(campus).toHaveAttribute('data-hero-model','ready',{timeout:30000});
    await page.getByTestId('campus-yingxi').click();
    await expect(campus).toHaveAttribute('data-hero-model','ready',{timeout:30000});
    const canvas=await launch(page); await start(page,canvas); const before=await snapshot(canvas);
    const touch=await page.context().newCDPSession(page), box=await canvas.boundingBox();
    if(!box) throw Error('No game canvas');
    const x=box.x+box.width*.2, y=box.y+box.height*.75;
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+60,y,id:1}]});
    await page.waitForTimeout(900);
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(async()=> (await snapshot(canvas)).x).toBeGreaterThan(before.x+20);
    await page.screenshot({path:info.outputPath('offline-mobile-play.png'),fullPage:true});
    await page.getByTestId('hks-return').click(); await expect(campus).toHaveAttribute('data-paused','false');
    expect([...blocked],'Unexpected automatic requests').toEqual([]); expect(errors).toEqual([]);
  });
});
