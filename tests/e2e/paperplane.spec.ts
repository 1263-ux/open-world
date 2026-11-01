import { expect, test } from '@playwright/test';
import { position } from './campus-walk';
import { launch, planePose, planeState, reachStation, ready, screenRightDisplacement, waitForFlightSuccess } from './complete-release-helpers';
test('flight failure, retry, resize pause, cancel, and campus/Hks mutual exclusion use real input',async({page},info)=>{
  test.setTimeout(360000);const canvas=await ready(page);await page.getByRole('button',{name:'先去漫游',exact:true}).click();await reachStation(page,canvas);
  const pose=await position(canvas);await page.getByTestId('begin-paperplane').click();await page.keyboard.press('Escape');
  await expect(page.getByTestId('paperplane-panel')).toHaveCount(0);expect(await position(canvas)).toEqual(pose);
  await page.getByTestId('begin-paperplane').click();await launch(page);
  const rightBefore=await planePose(canvas);await page.keyboard.down('KeyD');await page.waitForTimeout(700);expect(screenRightDisplacement(rightBefore,await planePose(canvas))).toBeGreaterThan(.01);try{await expect.poll(async()=>(await planeState(canvas)).phase,{timeout:60000}).toBe('result');}finally{await page.keyboard.up('KeyD');}
  expect((await planeState(canvas)).result).not.toBe('success');await page.screenshot({path:info.outputPath('flight-deliberate-failure.png')});
  await page.getByRole('button',{name:'再飞一次',exact:true}).click();expect((await planeState(canvas)).gatesPassed).toBe(0);await launch(page);
  await waitForFlightSuccess(canvas,info,'flight-wall-and-simulated-time');await page.getByRole('button',{name:'返回手记',exact:true}).click();
  await page.getByTestId('begin-paperplane').click();await launch(page);const leftBefore=await planePose(canvas);await page.keyboard.down('KeyA');await page.waitForTimeout(300);await page.getByRole('button',{name:'抬头',exact:true}).click();const heldKeyHeading=(await planePose(canvas)).heading;await page.waitForTimeout(400);expect((await planePose(canvas)).heading).toBeLessThan(heldKeyHeading-.03);await page.keyboard.up('KeyA');expect(screenRightDisplacement(leftBefore,await planePose(canvas))).toBeLessThan(-.01);
  await page.setViewportSize({width:1430,height:950});await expect.poll(async()=>(await planeState(canvas)).paused).toBe(true);
  const paused=await planeState(canvas);await page.waitForTimeout(1200);expect((await planeState(canvas)).elapsed).toBe(paused.elapsed);
  await page.getByRole('button',{name:'继续飞行',exact:true}).click();await canvas.focus();
  await expect.poll(async()=>(await planeState(canvas)).elapsed).toBeGreaterThan(paused.elapsed);
  // App overlays/campus controls are hidden/inert/disabled instead of letting flight steal the world.
  await expect(page.getByTestId('campus-yingxi')).toBeDisabled();await expect(page.getByTestId('campus-huyu')).toBeDisabled();
  await page.keyboard.press('Escape');await expect(canvas).toHaveAttribute('data-view','player');expect(await position(canvas)).toEqual(pose);
  await page.getByRole('button',{name:'打开校园地图'}).click();await expect(canvas).toHaveAttribute('data-view','map');await page.getByRole('button',{name:'返回人物视角'}).click();
  await page.getByTestId('open-hks').click();await expect(page.frameLocator('[data-testid="hks-frame"]').locator('canvas')).toBeVisible({timeout:30000});
  await page.getByTestId('hks-return').click();await expect(canvas).toHaveAttribute('data-view','player');expect(await position(canvas)).toEqual(pose);
});
test.describe('landscape touch flight',()=>{
  test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
  test('touch steering and cancellation do not move the retained walker',async({page})=>{
    test.setTimeout(180000);const canvas=await ready(page);await page.getByRole('button',{name:'先去漫游',exact:true}).tap();await reachStation(page,canvas);const pose=await position(canvas);
    await page.getByTestId('begin-paperplane').tap();await page.getByRole('button',{name:'开始放飞',exact:true}).tap();
    const right=page.getByRole('button',{name:'向右转',exact:true}),box=await right.boundingBox();if(!box)throw Error('Missing touch flight control');
    expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
    const touch=await page.context().newCDPSession(page);const x=box.x+box.width/2,y=box.y+box.height/2;const before=await planePose(canvas);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await page.waitForTimeout(800);expect(screenRightDisplacement(before,await planePose(canvas))).toBeGreaterThan(.01);
    // Releasing a second finger must not cancel the still-held right control.
    const pitchBox=await page.getByRole('button',{name:'抬头',exact:true}).boundingBox();if(!pitchBox)throw Error('Missing pitch touch control');
    const second={x:pitchBox.x+pitchBox.width/2,y:pitchBox.y+pitchBox.height/2,id:2};
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1},second]});await page.waitForTimeout(200);
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{x,y,id:1}]});const stillHeld=await planePose(canvas);
    await page.waitForTimeout(400);expect((await planePose(canvas)).heading-stillHeld.heading).toBeGreaterThan(.03);
    await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await touch.detach();
    await page.waitForTimeout(200);const cancelledHeading=(await planePose(canvas)).heading;await page.waitForTimeout(400);expect((await planePose(canvas)).heading).toBeCloseTo(cancelledHeading,2);
    await page.getByRole('button',{name:/退出放飞/}).tap();await expect(canvas).toHaveAttribute('data-view','player');expect(await position(canvas)).toEqual(pose);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  });
});
