import { expect, test } from '@playwright/test';
import { campuses } from '../../src/campus-data/campuses';
import { PHOTO_POINTS } from '../../src/games/photography';
import { JOURNEY_STORAGE_KEY } from '../../src/games/journey-storage';
import { position, walkTo } from './campus-walk';
import { aimAtSubject, ascend, descend, launch, planeState, reachStation, ready, waitForFlightSuccess } from './complete-release-helpers';
// One continuous real-input release journey; no teleport, stamps or score injection.
test('complete fresh journal: three photographs, genuine ascent/descent, flight, saved result and restart',async({page},info)=>{
  test.setTimeout(600000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const canvas=await ready(page);await page.getByRole('button',{name:'开始手记',exact:true}).click();
  for(const id of ['hall','garden']){
    const index=PHOTO_POINTS.findIndex(p=>p.id===id),point=PHOTO_POINTS[index]!;
    await walkTo(page,canvas,campuses.yingxi,point.position,Math.min(point.radius-1,3));
    await aimAtSubject(page,canvas,index,false,info);await expect(page.getByTestId('photo-record')).toBeEnabled();await page.getByTestId('photo-record').click();
  }
  await ascend(page,canvas);const elevated=await position(canvas);
  await page.getByRole('button',{name:'打开校园地图'}).click();await page.getByRole('button',{name:'返回人物视角'}).click();
  const restored=await position(canvas);expect(Math.hypot(...restored.map((v,i)=>v-elevated[i]!))).toBeLessThan(.25);
  await aimAtSubject(page,canvas,PHOTO_POINTS.findIndex(p=>p.id==='platform'),false,info);
  await page.getByTestId('photo-record').click();await page.getByTestId('open-photo-album').click();await expect(page.getByTestId('photo-complete')).toBeVisible();
  await page.screenshot({path:info.outputPath('three-photo-journal.png')});await page.keyboard.press('Escape');
  await descend(page,canvas);await reachStation(page,canvas);const before=await position(canvas);
  await page.getByTestId('begin-paperplane').click();await launch(page);
  // Genuine controls, a small right-left correction, not just a passive animation.
  await page.keyboard.down('KeyD');await page.waitForTimeout(100);await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyA');await page.waitForTimeout(100);await page.keyboard.up('KeyA');
  await waitForFlightSuccess(canvas,info,'flight-wall-and-simulated-time');
  expect((await planeState(canvas)).gatesPassed).toBe(3);await page.getByRole('button',{name:'返回手记',exact:true}).click();
  await expect(page.getByTestId('journey-panel')).toContainText('晴日手记 · 完成');
  const after=await position(canvas);expect(Math.hypot(...after.map((v,i)=>v-before[i]!))).toBeLessThan(.1);
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'null'),JOURNEY_STORAGE_KEY);expect(saved).toMatchObject({photos:['hall','garden','platform'],flightCompleted:true});
  await page.reload();await expect(page.getByTestId('journey-panel')).toContainText('晴日手记 · 完成');
  await expect(page.getByTestId('journey-panel')).toContainText('照片仅本次会话可用');
  await page.getByRole('button',{name:'另开一轮',exact:true}).click();await page.getByRole('button',{name:'确认重新开始',exact:true}).click();
  const restarted=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'null'),JOURNEY_STORAGE_KEY);
  expect(restarted).toMatchObject({photos:[],flightCompleted:false,bestFlight:null});
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('campus-atlas:photo-stamps:v1')??'[]'))).toEqual(['hall','garden','platform']);
  await info.attach('journey-summary',{body:JSON.stringify({elevated,before,after,saved,restarted},null,2),contentType:'application/json'});expect(errors).toEqual([]);
});
