import { expect, test, type Locator, type Page } from '@playwright/test';
import { position } from './campus-walk';
import { assertKnowledgeDismissHint, assertLandscapeCanvasAndHud, observeNaturalKnowledgeScroll } from './hks-landscape-layout';
import { campuses } from '../../src/campus-data/campuses';
import { chooseMovement, validateOutcome, validateSurvivalState } from './hks-survival-policy';

type Point={x:number;y:number};
type State={tutorialPage?:number|null;scene?:string;remaining?:number;paused?:boolean;ended?:boolean;levelUp?:boolean;kills?:number;x?:number;y?:number;level?:number;upgradeCards?:Point[];settlementButton?:Point|null;outcome?:string|null};
async function snapshot(canvas:Locator):Promise<State>{return JSON.parse(await canvas.getAttribute('data-hks-state')??'{}');}
async function clickGame(page:Page,canvas:Locator,p:Point){const box=await canvas.boundingBox();const w=Number(await canvas.getAttribute('data-logical-width')),h=Number(await canvas.getAttribute('data-logical-height'));if(!box||!w||!h)throw Error('No game canvas/logical dimensions');await page.mouse.click(box.x+box.width*p.x/w,box.y+box.height*p.y/h);}
async function launch(page:Page){await page.getByTestId('open-hks').click();await expect(page.getByTestId('hks-overlay')).toBeVisible();await expect(page.getByTestId('hks-loading')).toHaveCount(0,{timeout:30000});await expect(page.getByTestId('hks-error')).toHaveCount(0);const canvas=page.frameLocator('[data-testid="hks-frame"]').locator('canvas');await expect(canvas).toBeVisible();await expect.poll(async()=>(await snapshot(canvas)).scene).toContain('MenuScene');await expect(canvas).toHaveAttribute('data-logical-width','1280');await expect(canvas).toHaveAttribute('data-logical-height','720');return canvas;}
async function startGame(page:Page,canvas:Locator,walkTutorial=false){
  await clickGame(page,canvas,{x:640,y:395});await expect.poll(async()=>(await snapshot(canvas)).scene,{timeout:15000}).toContain('TutorialScene');
  if(walkTutorial){
    await expect.poll(async()=>(await snapshot(canvas)).tutorialPage,{timeout:10000}).toBe(0);
    for(let n=1;n<=3;n++){await clickGame(page,canvas,{x:640,y:650});await expect.poll(async()=>(await snapshot(canvas)).tutorialPage,{timeout:15000}).toBe(n);}
    await clickGame(page,canvas,{x:640,y:650});
  } else await clickGame(page,canvas,{x:1236,y:37});
  await expect.poll(async()=>(await snapshot(canvas)).scene,{timeout:15000}).toContain('GameScene');
}
async function closeKnowledge(page:Page){const popup=page.frameLocator('[data-testid="hks-frame"]').locator('#monster-popup');await expect(popup).toBeVisible();await popup.click();await expect(popup).toBeHidden();}

test('Hks real play: knowledge, natural combat and settlement replay preserve campus',async({page},info)=>{
  test.setTimeout(1200000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/'); await page.getByTestId('campus-huyu').click();
  const campus=page.getByTestId('campus-canvas');await expect.poll(async()=>{const x=await campus.getAttribute('data-player-x'),z=await campus.getAttribute('data-player-z');return x===null||z===null?Infinity:Math.hypot(Number(x)-campuses.huyu.start[0],Number(z)-campuses.huyu.start[1]);},{timeout:15000}).toBeLessThan(1);
  await page.keyboard.down('w');await page.waitForTimeout(1000);await page.keyboard.up('w');
  const xyz=await position(campus),yaw=await campus.getAttribute('data-camera-yaw');
  if(!await page.getByTestId('quest-start').isVisible())await page.getByTestId('open-quest').click();await page.getByTestId('quest-start').click();
  const quest=await page.getByTestId('quest-status').textContent();
  // Starting an optional quest must preserve the explored position.
  const saved=await position(campus); expect(Math.hypot(saved[0]-xyz[0],saved[2]-xyz[2])).toBeLessThan(.1);
  const canvas=await launch(page);await expect(campus).toHaveAttribute('data-paused','true');const frame=await campus.getAttribute('data-frame');
  await page.screenshot({path:info.outputPath('hks-menu.png')});await startGame(page,canvas,true);
  const before=await snapshot(canvas);expect(before.remaining).toBeGreaterThan(410);await page.keyboard.down('ArrowLeft');
  try { await expect.poll(async()=>(await snapshot(canvas)).x,{timeout:10000,intervals:[100]}).toBeLessThan(before.x!-20); }
  finally { await page.keyboard.up('ArrowLeft'); }
  expect(await campus.getAttribute('data-frame')).toBe(frame);
  await expect(page.frameLocator('[data-testid="hks-frame"]').locator('#monster-popup')).toBeVisible({timeout:30000});
  await page.screenshot({path:info.outputPath('hks-knowledge.png')});await closeKnowledge(page);
  // Each retry is a real natural loss followed by the visible return/replay path.
  // A running game is never reset just because an upgrade takes time.
  const attempts: Array<{ number: number; samples: unknown[]; actions: unknown[]; result: string; final: unknown }> = [];
  let observedUpgrade=false;
  try {
    for(let number=1;number<=3 && !observedUpgrade;number++) {
      const attempt = { number, samples: [] as unknown[], actions: [] as unknown[], result: 'playing', final: null as unknown };
      attempts.push(attempt); const started=Date.now(), deadline=started+120000; let lastSample=0;
      while(Date.now()<deadline) {
        const popup=page.frameLocator('[data-testid="hks-frame"]').locator('#monster-popup');
        if(await popup.isVisible()){await closeKnowledge(page);attempt.actions.push({wallMs:Date.now()-started,kind:'dismiss-real-knowledge'});continue;}
        const raw=await snapshot(canvas); const valid:unknown=raw; validateSurvivalState(valid); attempt.final=raw;
        if(Date.now()-lastSample>=1000 || raw.ended || raw.levelUp) { attempt.samples.push({wallMs:Date.now()-started,state:raw});lastSample=Date.now(); }
        if(raw.ended) {
          validateOutcome(valid); attempt.result=`natural-${raw.outcome}`;
          await page.screenshot({path:info.outputPath(`hks-attempt-${number}-${raw.outcome}.png`)});
          if (!raw.settlementButton) throw Error('Natural settlement has no visible return control');
          if(number<3) {
            await clickGame(page,canvas,raw.settlementButton);
            await expect.poll(async()=>(await snapshot(canvas)).scene,{timeout:15000}).toContain('MenuScene');
            await startGame(page,canvas);
            expect((await snapshot(canvas)).remaining).toBeGreaterThan(410);
          }
          break;
        }
        if(raw.levelUp) {
          if(!valid.upgradeCards.length)throw Error('Upgrade active without offered cards');
          await page.screenshot({path:info.outputPath(`hks-attempt-${number}-upgrade.png`)});
          await clickGame(page,canvas,valid.upgradeCards[0]!);
          await expect.poll(async()=>(await snapshot(canvas)).levelUp,{timeout:10000}).toBe(false);
          attempt.actions.push({wallMs:Date.now()-started,kind:'choose-real-upgrade',point:valid.upgradeCards[0]});
          attempt.result='upgrade-selected';observedUpgrade=true;break;
        }
        if(raw.paused){await page.waitForTimeout(200);continue;}
        const movement=chooseMovement(valid);attempt.actions.push({wallMs:Date.now()-started,kind:movement.kind,keys:movement.keys,holdMs:movement.holdMs,target:movement.target});
        for(const key of movement.keys)await page.keyboard.down(key);
        try { await page.waitForTimeout(movement.holdMs); } finally { for(const key of movement.keys)await page.keyboard.up(key); }
      }
      if(attempt.result==='playing') { attempt.result='upgrade-window-expired-while-running'; throw Error('No natural upgrade or terminal outcome within the trial window; game was not reset'); }
    }
  } finally { await info.attach('natural-upgrade-attempts',{body:JSON.stringify(attempts,null,2),contentType:'application/json'}); }
  expect(observedUpgrade,'At least one of at most three natural lives must offer a selectable upgrade').toBe(true);
  // Leave the base unprotected. Respond to actual popups and offered upgrades; do not alter game state.
  const deadline=Date.now()+600000;let state=await snapshot(canvas);let upgrades=1;
  while(!state.ended&&Date.now()<deadline){
    const popup=page.frameLocator('[data-testid="hks-frame"]').locator('#monster-popup');
    if(await popup.isVisible())await closeKnowledge(page);
    else if(state.levelUp){if(!state.upgradeCards?.length)throw Error('Upgrade active without offered cards');await clickGame(page,canvas,state.upgradeCards[0]!);upgrades++;}
    else {await page.keyboard.down('ArrowLeft');await page.waitForTimeout(1200);await page.keyboard.up('ArrowLeft');}
    await page.waitForTimeout(300);state=await snapshot(canvas);
  }
  await info.attach('natural-result',{body:JSON.stringify({state,upgrades},null,2),contentType:'application/json'});
  expect(state.ended,'Real play must reach a natural settlement within the trial window').toBe(true);
  const validated: unknown = state; validateSurvivalState(validated); validateOutcome(validated); expect(state.settlementButton).toBeTruthy();
  await page.screenshot({path:info.outputPath('hks-settlement.png')});await clickGame(page,canvas,state.settlementButton!);
  await expect.poll(async()=>(await snapshot(canvas)).scene,{timeout:15000}).toContain('MenuScene');await startGame(page,canvas);
  expect((await snapshot(canvas)).remaining).toBeGreaterThan(410);
  await page.keyboard.press('Escape');await expect(page.getByTestId('hks-overlay')).toHaveCount(0);await expect(campus).toHaveAttribute('data-paused','false');
  const restored=await position(campus);expect(Math.hypot(restored[0]-saved[0],restored[2]-saved[2])).toBeLessThan(.1);expect(await campus.getAttribute('data-camera-yaw')).toBe(yaw);
  await expect(page.getByTestId('quest-status')).toHaveText(quest!);await expect(campus).toBeFocused();await page.keyboard.down('w');await page.waitForTimeout(900);await page.keyboard.up('w');const continued=await position(campus);expect(Math.hypot(continued[0]-saved[0],continued[2]-saved[2])).toBeGreaterThan(.5);
  await launch(page);await page.getByTestId('hks-return').click();await expect(page.getByTestId('hks-overlay')).toHaveCount(0);expect(errors).toEqual([]);
});

test.describe('landscape touch-capable phone',()=>{
  test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
  test('touch movement and failed-load return leave campus usable',async({page},info)=>{
    test.setTimeout(90000);await page.goto('/');const canvas=await launch(page);await startGame(page,canvas);
    await assertLandscapeCanvasAndHud(page,canvas,info);
    const popup=page.frameLocator('[data-testid="hks-frame"]').locator('#monster-popup');await expect(popup).toBeVisible({timeout:30000});await assertKnowledgeDismissHint(page,info);await page.screenshot({path:info.outputPath('hks-landscape-knowledge.png')});await observeNaturalKnowledgeScroll(page,info);await closeKnowledge(page);
    const before=await snapshot(canvas),r=await canvas.boundingBox();if(!r||typeof before.x!=='number')throw Error('Missing player or canvas');const touch=await page.context().newCDPSession(page),x=r.x+r.width*.2,y=r.y+r.height*.75;
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+60,y,id:1}]});await page.waitForTimeout(1500);await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(async()=>(await snapshot(canvas)).x,{timeout:10000}).toBeGreaterThan(before.x+20);await page.screenshot({path:info.outputPath('hks-landscape-play.png')});
    await page.getByTestId('hks-return').click();await page.route('**/games/hks/index.html',route=>route.abort());await page.getByTestId('open-hks').click();await expect(page.getByTestId('hks-error')).toBeVisible({timeout:25000});await page.getByTestId('hks-return').click();await expect(page.getByTestId('campus-canvas')).toHaveAttribute('data-paused','false');
  });
});
