import { expect, test } from '@playwright/test';
import { position } from './campus-walk';
import { launch, planePose, planeState, reachStation, ready, screenRightDisplacement, waitForSimulatedAdvance, waitForFlightSuccess } from './complete-release-helpers';
test('flight failure, retry, resize pause, cancel, and campus/Hks mutual exclusion use real input',async({page},info)=>{
  test.setTimeout(360000);const canvas=await ready(page);await page.getByRole('button',{name:'先去漫游',exact:true}).click();await reachStation(page,canvas);
  const pose=await position(canvas);await page.getByTestId('begin-paperplane').click();await page.keyboard.press('Escape');
  await expect(page.getByTestId('paperplane-panel')).toHaveCount(0);expect(await position(canvas)).toEqual(pose);
  await page.getByTestId('begin-paperplane').click();await launch(page);
  const rightBefore=await planePose(canvas);await page.keyboard.down('KeyD');await waitForSimulatedAdvance(canvas,(await planeState(canvas)).elapsed);expect(screenRightDisplacement(rightBefore,await planePose(canvas))).toBeGreaterThan(.01);try{await expect.poll(async()=>(await planeState(canvas)).phase,{timeout:60000}).toBe('result');}finally{await page.keyboard.up('KeyD');}
  expect((await planeState(canvas)).result).not.toBe('success');await page.screenshot({path:info.outputPath('flight-deliberate-failure.png')});
  await page.getByRole('button',{name:'再飞一次',exact:true}).click();expect((await planeState(canvas)).gatesPassed).toBe(0);await launch(page);
  await waitForFlightSuccess(canvas,info,'flight-wall-and-simulated-time');await page.getByRole('button',{name:'返回手记',exact:true}).click();
  await page.getByTestId('begin-paperplane').click();await launch(page);const leftBefore=await planePose(canvas);await page.keyboard.down('KeyA');await waitForSimulatedAdvance(canvas,(await planeState(canvas)).elapsed);await page.getByRole('button',{name:'抬头',exact:true}).click();const heldKeyHeading=(await planePose(canvas)).heading;await waitForSimulatedAdvance(canvas,(await planeState(canvas)).elapsed);expect((await planePose(canvas)).heading).toBeLessThan(heldKeyHeading-.03);await page.keyboard.up('KeyA');expect(screenRightDisplacement(leftBefore,await planePose(canvas))).toBeLessThan(-.01);
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
  test('touch steering and cancellation do not move the retained walker',async({page},info)=>{
    test.setTimeout(180000);const canvas=await ready(page);await page.getByRole('button',{name:'先去漫游',exact:true}).tap();await reachStation(page,canvas);const pose=await position(canvas);
    await page.getByTestId('begin-paperplane').tap();await page.getByRole('button',{name:'开始放飞',exact:true}).tap();
    const right=page.getByRole('button',{name:'向右转',exact:true}),box=await right.boundingBox();if(!box)throw Error('Missing touch flight control');
    expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
    console.log(`[FLIGHT_BROWSER] ${page.context().browser()?.version()??'unknown'}`);
    // Passive DOM observations only; never dispatch synthetic DOM events or write app state.
    const pointerEvents:Array<{type:string;id:number;label:string;time:number}>=[];
    await page.exposeFunction('recordFlightPointer', (event:{type:string;id:number;label:string;time:number})=>{pointerEvents.push(event);});
    await page.evaluate(()=>{
      const observer=(event:Event)=>{
        const p=event as PointerEvent,button=(p.target as Element).closest('.touch-controls button');
        if(button)void (window as unknown as {recordFlightPointer:(e:unknown)=>Promise<void>}).recordFlightPointer({type:p.type,id:p.pointerId,label:button.getAttribute('aria-label')??'',time:performance.now()});
      };
      for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,observer,true);
    });
    const touch=await page.context().newCDPSession(page);const x=box.x+box.width/2,y=box.y+box.height/2;const before=await planePose(canvas);
    async function evidence(stage:string){const data={stage,wall:Date.now(),state:await planeState(canvas),pose:await planePose(canvas),frame:await canvas.getAttribute('data-frame'),pointerEvents:[...pointerEvents]};console.log(`[FLIGHT_TOUCH] ${JSON.stringify(data)}`);return data;}
    async function advanceFrom(elapsed:number){await expect.poll(async()=>{const state=await planeState(canvas);expect(state.phase).toBe('flying');expect(state.paused).toBe(false);return state.elapsed;},{timeout:10000,intervals:[100]}).toBeGreaterThanOrEqual(elapsed+.2);}
    try{
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
      await advanceFrom((await planeState(canvas)).elapsed);expect(screenRightDisplacement(before,await planePose(canvas))).toBeGreaterThan(.01);
      const pitchBox=await page.getByRole('button',{name:'抬头',exact:true}).boundingBox();if(!pitchBox)throw Error('Missing pitch touch control');
      const second={x:pitchBox.x+pitchBox.width/2,y:pitchBox.y+pitchBox.height/2,id:2};
      // Pinned Chromium156 default WebTouch branch adds provided missing IDs on move.
      // Unlike its disabled SyntheticPointerActions branch, partial end names RELEASED IDs.
      await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y,id:1},second]});
      await advanceFrom((await planeState(canvas)).elapsed);await evidence('two-held');
      const rightId=pointerEvents.find(e=>e.type==='pointerdown'&&e.label==='向右转')?.id;
      const pitchId=pointerEvents.find(e=>e.type==='pointerdown'&&e.label==='抬头')?.id;
      expect(rightId).toBeDefined();expect(pitchId).toBeDefined();expect(pitchId).not.toBe(rightId);
      const releaseStart=pointerEvents.length;
      await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[second]});
      await expect.poll(()=>pointerEvents.slice(releaseStart).some(e=>e.type==='pointerup'&&e.id===pitchId)).toBe(true);
      const stillHeld=await evidence('pitch-released');await advanceFrom(stillHeld.state.elapsed);
      const retained=await evidence('right-retained');
      expect(pointerEvents.slice(releaseStart).some(e=>e.id===rightId&&['pointerup','pointercancel','lostpointercapture'].includes(e.type))).toBe(false);
      expect(retained.pose.heading-stillHeld.pose.heading).toBeGreaterThan(.03);
      await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      await expect.poll(()=>pointerEvents.some(e=>e.type==='pointercancel'&&e.id===rightId)).toBe(true);
      // Flush pre-cancel pose telemetry before comparing two neutral simulated intervals.
      await advanceFrom((await planeState(canvas)).elapsed);
      const cancelled=await evidence('cancelled');await advanceFrom(cancelled.state.elapsed);
      expect((await planePose(canvas)).heading).toBeCloseTo(cancelled.pose.heading,2);
    }finally{
      console.log(`[FLIGHT_POINTER_EVENTS] ${JSON.stringify(pointerEvents)}`);
      await info.attach('flight-pointer-events',{body:JSON.stringify(pointerEvents),contentType:'application/json'}).catch(error=>console.log(`[FLIGHT_TOUCH_ATTACHMENT] ${String(error)}`));
      await touch.detach().catch(error=>console.log(`[FLIGHT_TOUCH_CLEANUP] ${String(error)}`));
    }
    await page.getByRole('button',{name:/退出放飞/}).tap();await expect(canvas).toHaveAttribute('data-view','player');expect(await position(canvas)).toEqual(pose);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  });
});
