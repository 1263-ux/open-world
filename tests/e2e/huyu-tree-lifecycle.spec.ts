import { expect, test } from '@playwright/test';

// Actual HTTP failure/delay and campus switching; no state mutation or fake trees.
test.setTimeout(120000);
const texture = '**/assets/environment/Leaves_NormalTree_C.png';
test('Huyu texture ready and failed load retains visible fallback', async ({page},info) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(texture,route=>route.abort());
  await page.goto('/');await page.getByTestId('campus-huyu').click();
  const canvas=page.getByTestId('campus-canvas');
  await expect(canvas).toHaveAttribute('data-campus-ready','huyu',{timeout:30000});
  await expect(canvas).toHaveAttribute('data-huyu-tree-count','3');
  await expect(canvas).toHaveAttribute('data-huyu-tree-texture','fallback',{timeout:30000});
  await page.screenshot({path:info.outputPath('huyu-tree-texture-fallback.png')});
  await page.unroute(texture);await page.getByTestId('campus-yingxi').click();
  await expect(canvas).toHaveAttribute('data-campus-ready','yingxi',{timeout:30000});
  await expect(canvas).not.toHaveAttribute('data-huyu-tree-texture',/.+/);
  await page.getByTestId('campus-huyu').click();
  await expect(canvas).toHaveAttribute('data-campus-ready','huyu',{timeout:30000});
  await expect(canvas).toHaveAttribute('data-huyu-tree-texture','ready',{timeout:30000});
  await page.screenshot({path:info.outputPath('huyu-tree-texture-ready.png')});
  expect(errors).toEqual([]);
});

test('late tree texture from old campus cannot replace active scene', async ({page},info) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  let release!:()=>void, seen!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;}),requested=new Promise<void>(resolve=>{seen=resolve;});
  await page.route(texture,async route=>{seen();await gate;try{await route.continue();}catch{/* A canceled request is a valid teardown outcome. */}});
  try {
    await page.goto('/');await page.getByTestId('campus-huyu').click();await requested;
    const canvas=page.getByTestId('campus-canvas');
    await expect(canvas).toHaveAttribute('data-huyu-tree-texture','loading',{timeout:30000});
    await page.getByTestId('campus-yingxi').click();
    await expect(canvas).toHaveAttribute('data-campus-ready','yingxi',{timeout:30000});
    release();await page.unroute(texture);await page.waitForTimeout(2000);
    await expect(canvas).toHaveAttribute('data-campus-ready','yingxi');
    await expect(canvas).not.toHaveAttribute('data-huyu-tree-texture',/.+/);
    await expect(page.getByTestId('scene-error')).toHaveCount(0);
    await page.screenshot({path:info.outputPath('yingxi-after-late-huyu-texture.png')});
    await page.getByTestId('campus-huyu').click();
    await expect(canvas).toHaveAttribute('data-campus-ready','huyu',{timeout:30000});
    await expect(canvas).toHaveAttribute('data-huyu-tree-texture','ready',{timeout:30000});
    expect(errors).toEqual([]);
  } finally { release(); await page.unroute(texture); }
});
