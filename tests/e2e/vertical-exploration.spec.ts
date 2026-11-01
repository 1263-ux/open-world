import { expect, test } from '@playwright/test';
import { campuses } from '../../src/campus-data/campuses';
import { VIEWING_PLATFORM } from '../../src/scene/OriginalViewingPlatform';
import { position, walkTo } from './campus-walk';
import { ascend, descend, ready } from './complete-release-helpers';
test('walk the real low deck, preserve elevated pose through map, descend and take ground bypass',async({page},info)=>{
  test.setTimeout(180000);const canvas=await ready(page);await page.getByRole('button',{name:'先去漫游',exact:true}).click();
  await ascend(page,canvas);const top=await position(canvas);expect(top[1]).toBeGreaterThan(1.1);expect(top[1]).toBeLessThan(1.35);
  await page.getByRole('button',{name:'打开校园地图'}).click();await page.getByRole('button',{name:'返回人物视角'}).click();
  const restored=await position(canvas);expect(Math.hypot(...restored.map((v,i)=>v-top[i]!))).toBeLessThan(.25);
  await page.screenshot({path:info.outputPath('actual-deck-standing.png')});await descend(page,canvas);
  const bypass=[];for(const p of VIEWING_PLATFORM.bypass){await walkTo(page,canvas,campuses.yingxi,[p[0],p[1]],1);const at=await position(canvas);expect(at[1]).toBeLessThan(.2);bypass.push(at);}
  await info.attach('vertical-input-route',{body:JSON.stringify({top,restored,bypass},null,2),contentType:'application/json'});
});
