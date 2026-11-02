import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import type { CampusId, Point2 } from '../../src/shared/contracts';
import { touchWalkTo, activityPose, activityProgress } from './ideal-activity-helpers';
import { dragLook, waitForSettledCamera } from './complete-release-helpers';

// Default natural quality, not the separate fixed-quality art comparison.
// Real visible joystick uses normal walking speed, never Shift or state injection.
test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, hasTouch: true, isMobile: false });
async function snapshot(canvas:Locator) {
  return canvas.evaluate(e=>{const d=(e as HTMLElement).dataset;return {xyz:[Number(d.playerX),Number(d.playerY),Number(d.playerZ)],camera:[Number(d.cameraX),Number(d.cameraY),Number(d.cameraZ)],yaw:Number(d.cameraYaw),pitch:Number(d.cameraPitch),frame:Number(d.frame),quality:d.renderQuality,mode:d.qualityMode,ratio:Number(d.renderRatio),shadow:Number(d.shadowType),shadowSize:Number(d.shadowSize),shadowActual:[Number(d.shadowActualSize),Number(d.shadowActualHeight)],buffer:[Number(d.renderBufferWidth),Number(d.renderBufferHeight)],reason:d.qualityReason,nature:d.arrivalNatureStatus,instances:Number(d.arrivalNatureInstances),generation:d.arrivalNatureGeneration,world:d.worldGeneration,geometryMetrics:JSON.parse(d.arrivalGeometryMetrics ?? 'null'),natureStats:JSON.parse(d.arrivalNatureStats ?? 'null'),replacement:d.nearHallTreeReplacement,replacementIds:d.nearHallTreeReplacementIds};});
}
async function look(page:Page,canvas:Locator,target:Point2) {
  const p=await snapshot(canvas),desired=Math.atan2(target[0]-p.xyz[0]!,target[1]-p.xyz[2]!),delta=Math.atan2(Math.sin(desired-p.yaw),Math.cos(desired-p.yaw));
  await dragLook(page,canvas,-delta/.005,(-.15-p.pitch)/.004,true);await waitForSettledCamera(page,canvas,45000);
}
async function capture(page:Page,canvas:Locator,info:TestInfo,campus:CampusId,stage:string,started:number) {
  const state=await snapshot(canvas),objective=page.getByTestId('current-objective');
  const evidence={campus,stage,wallSeconds:(Date.now()-started)/1000,state,objective:{visible:await objective.isVisible(),target:await objective.getAttribute('data-target-id'),distance:await objective.getAttribute('data-distance'),arrived:await objective.getAttribute('data-arrived')},viewport:page.viewportSize(),dpr:await page.evaluate(()=>devicePixelRatio),url:page.url(),note:'Natural adaptive image; not a fixed-quality before/after pair or physical-device performance proof'};
  console.log('[DEFAULT_ARRIVAL]',JSON.stringify(evidence));await info.attach(`${campus}-${stage}-conditions`,{body:JSON.stringify(evidence,null,2),contentType:'application/json'});
  await page.screenshot({path:info.outputPath(`${campus}-default-${stage}.png`)});
  expect(state.mode).toBe('auto');expect(state.quality).not.toBe('reference');expect(Number.isFinite(state.ratio)).toBe(true);expect(state.ratio).toBeGreaterThanOrEqual(.5);
  expect(state.nature).toBe('ready');expect(state.instances).toBe(campus==='huyu'?28:35);expect(state.geometryMetrics.placementCount).toBe(campus==='huyu'?28:30);expect(state.geometryMetrics.kinds).toEqual(campus==='huyu'?{'tree-round':1,'tree-tall':2,'tree-spreading':1,shrub:6,grass:18}:{'tree-round':1,'tree-tall':2,'tree-spreading':2,shrub:7,grass:18});if(campus==='yingxi'){expect(state.replacement).toBe('5/6');expect(state.replacementIds).toBe('0,1,2,4,5');}expect(state.generation).toBe(state.world);
}
for(const campus of ['huyu','yingxi'] as const) test(`${campus}: ordinary spawn arrival and visible quality choices preserve gameplay`,async({page},info)=>{
  test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const started=Date.now();
  await page.goto('/');expect(new URL(page.url()).searchParams.has('render-quality')).toBe(false);
  if(campus==='huyu')await page.getByTestId('campus-huyu').click();
  const canvas=page.getByTestId('campus-canvas');await expect(canvas).toHaveAttribute('data-campus-ready',campus,{timeout:30000});
  await expect(canvas).toHaveAttribute('data-quality-mode','auto');await expect(page.getByTestId('render-quality-select')).toHaveValue('auto');
  // Ninety wall seconds of readonly samples, including asset arrival and normal
  // walking. Rendering can be slow; no simulated-time or30FPS claim is made.
  const natural=canvas.evaluate(e=>new Promise(resolve=>{
    const started=performance.now(),samples:Array<{wallMs:number;frame:number;xyz:number[];ratio:number;shadow:number;nature:string|undefined}>=[];
    const read=()=>{const d=(e as HTMLElement).dataset;samples.push({wallMs:performance.now()-started,frame:Number(d.frame),xyz:[Number(d.playerX),Number(d.playerY),Number(d.playerZ)],ratio:Number(d.renderRatio),shadow:Number(d.shadowType),nature:d.arrivalNatureStatus});};read();
    const timer=setInterval(read,500);setTimeout(()=>{clearInterval(timer);read();let observedPathLength=0;for(let i=1;i<samples.length;i++){const a=samples[i-1]!.xyz,b=samples[i]!.xyz;if([...a,...b].every(Number.isFinite))observedPathLength+=Math.hypot(b[0]!-a[0]!,b[2]!-a[2]!);}resolve({wallSeconds:(performance.now()-started)/1000,samples,observedPathLength,note:'Sampled path length, not exact trajectory; software-rendered timing is not a user90second completion promise'});},90000);
  })).catch(error=>({error:String(error)}));
  await expect(canvas).toHaveAttribute('data-arrival-nature-status','ready',{timeout:30000});await expect(canvas).toHaveAttribute('data-player-model','ready',{timeout:30000});await waitForSettledCamera(page,canvas,45000);
  expect((await snapshot(canvas)).yaw).toBeCloseTo(campus==='huyu'?Math.PI:-Math.PI/2,3);
  await expect(page.getByTestId('current-objective')).toBeVisible();await expect(page.getByTestId('photo-guide')).toHaveCount(0);
  await capture(page,canvas,info,campus,'entry',started); // No test rotation before true production first view.
  const walk=async(target:Point2)=>touchWalkTo(page,canvas,[...target],info,.9,false,campus);
  if(campus==='huyu'){
    await walk([14,-195]);await look(page,canvas,[15.79,-132.35]);await capture(page,canvas,info,campus,'turn',started);
    await walk([18.26,-177.03]);await walk([18.26,-147.03]);await look(page,canvas,[15.79,-132.35]);
  }else{
    await walk([-48,175.5]);await walk([-38.56,172.76]);await look(page,canvas,[7,172.76]);await capture(page,canvas,info,campus,'turn',started);
    await walk([7,172.76]);await look(page,canvas,[35,192.8]);
  }
  await capture(page,canvas,info,campus,'target-direction',started);
  const sampled = await natural; expect(sampled).not.toHaveProperty('error');
  await info.attach(`${campus}-natural-90s`,{body:JSON.stringify(sampled),contentType:'application/json'});
  const saved=await activityProgress(page),pose=await activityPose(canvas),control=page.getByTestId('render-quality-select');
  if(campus==='huyu'){
    await page.getByTestId('objective-story').click(); await expect(page.getByRole('heading',{name:'北门（示意）',exact:true})).toBeVisible();await expect(page.locator('.model-evidence')).toBeVisible();
    expect(await activityPose(canvas)).toEqual(pose);expect(await activityProgress(page)).toEqual(saved);
    await page.getByTestId('landmark-close').click();await expect(page.getByTestId('objective-story')).toBeFocused();
    expect(await activityPose(canvas)).toEqual(pose);expect(await activityProgress(page)).toEqual(saved);
  }
  for(const mode of ['clear','smooth','auto'] as const){await control.selectOption(mode);await expect(canvas).toHaveAttribute('data-quality-mode',mode);expect(await activityPose(canvas)).toEqual(pose);expect(await activityProgress(page)).toEqual(saved);const state=await snapshot(canvas);if(mode!=='auto'){expect(state.shadow).toBe(1);expect(state.ratio).toBe(mode==='clear'?1:.75);expect(state.shadowSize).toBe(mode==='clear'?2048:1024);await expect.poll(async()=>(await snapshot(canvas)).shadowActual,{timeout:15000}).toEqual([state.shadowSize,state.shadowSize]);const css=await canvas.evaluate(e=>({width:e.parentElement!.clientWidth,height:e.parentElement!.clientHeight}));await expect.poll(async()=>(await snapshot(canvas)).buffer,{timeout:15000}).toEqual([Math.floor(css.width*state.ratio),Math.floor(css.height*state.ratio)]);}}
  await control.selectOption('smooth');expect(await activityProgress(page)).toEqual(saved);await page.reload();await expect(page.getByTestId('render-quality-select')).toHaveValue('smooth');await expect(page.getByTestId('campus-canvas')).toHaveAttribute('data-quality-mode','smooth');expect(await activityProgress(page)).toEqual(saved);
  expect(errors).toEqual([]);
});
