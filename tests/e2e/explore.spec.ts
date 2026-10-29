import { expect, test, type Page } from '@playwright/test';
import { campuses } from '../../src/campus-data/campuses';
import { OrthographicCamera,Vector3 } from 'three';
test.setTimeout(120000);
async function start(page:Page){if(!await page.getByTestId('quest-start').isVisible())await page.getByTestId('open-quest').click();await page.getByTestId('quest-start').click();}
async function record(page:Page){
 await page.getByTestId('quest-travel').click();
 await expect(page.getByTestId('arrival-status')).toContainText(/已到达|已打开观察题/,{timeout:30000});
 await page.getByTestId('answer-1').click();await expect(page.getByTestId('quest-check-in')).toBeDisabled();
 await page.getByTestId('answer-0').click();await page.getByTestId('quest-check-in').click();
}
test('desktop: continuous travel, observation, progress restore, complete and replay',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.getByTestId('campus-canvas')).toBeVisible();await expect(page.getByTestId('scene-error')).toHaveCount(0);
 await page.screenshot({path:'test-results/desktop-baseline.png',fullPage:true});await start(page);await record(page);await page.reload();
 await expect(page.getByTestId('quest-status')).toContainText('1 / 3');
 await record(page);await record(page);await expect(page.getByTestId('completion')).toBeVisible();
 await page.screenshot({path:'test-results/completed-journey.png',fullPage:true});
 await page.getByTestId('quest-replay').click();await page.getByTestId('quest-travel').click();await page.getByTestId('open-quest').click();await page.getByTestId('quest-exit').click();await expect(page.getByTestId('quest-status')).toContainText('准备出发');
 expect(errors).toEqual([]);
});
test('real canvas picking, drag suppression and repeated campus switching',async({page})=>{
 await page.goto('/');const canvas=page.getByTestId('campus-canvas');await expect(canvas).toBeVisible();await page.getByTestId('landmark-close').click();
 const r=await canvas.boundingBox();if(!r)throw new Error('No canvas bounds');
 const campus=campuses.huyu,pts=campus.landmarks.flatMap(l=>[l.position,l.arrival]);const xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]);const x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
 const span=Math.max(300,(x1-x0)*1.35,(z1-z0)*1.35),aspect=r.width/r.height,h=span/Math.min(1,aspect);const camera=new OrthographicCamera(-h*aspect/2,h*aspect/2,h/2,-h/2,.1,6000);const target=new Vector3((x0+x1)/2,0,(z0+z1)/2);camera.position.copy(target).addScaledVector(new Vector3(.7,1,1.1).normalize(),Math.max(span*1.5,200));camera.lookAt(target);camera.updateMatrixWorld();
 const l=campus.landmarks.find(l=>l.id==='hy-training')!;const feature=campus.features.find(f=>f.id===l.featureId)!;const p=new Vector3(l.position[0],feature.height+4,l.position[1]).project(camera);const x=r.x+(p.x+1)*r.width/2,y=r.y+(1-p.y)*r.height/2;
 await page.mouse.click(x,y);await expect(page.locator('.panel-scroll')).toContainText('训练馆');await page.getByTestId('landmark-close').click();await page.mouse.move(r.x+r.width*.48,r.y+r.height*.6);await page.mouse.down();await page.mouse.move(r.x+r.width*.52,r.y+r.height*.65,{steps:8});await page.mouse.up();await expect(page.getByTestId('landmark-close')).toHaveCount(0);
 for(let i=0;i<3;i++){await page.getByTestId('campus-yingxi').click();await page.getByTestId('campus-huyu').click();}await expect(page.getByTestId('scene-error')).toHaveCount(0);
});
test('mobile: scene-first viewport and complete second campus chapter',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByTestId('campus-canvas')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const box=await page.getByTestId('campus-canvas').boundingBox();expect(box!.height).toBeGreaterThan(844*.65);await page.screenshot({path:'test-results/mobile-baseline.png',fullPage:true});
 await page.getByTestId('campus-yingxi').click();await start(page);for(let i=0;i<4;i++)await record(page);await expect(page.getByTestId('completion')).toBeVisible();
});
test('WebGL denied: explicit accessible route can complete, corrupt saves ignored',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('campus-atlas:quests','{broken');const original=HTMLCanvasElement.prototype.getContext;Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{value:function(this:HTMLCanvasElement,type:string,...args:unknown[]){if(type.startsWith('webgl'))return null;return Reflect.apply(original,this,[type,...args]);}});});
 await page.goto('/');await expect(page.getByTestId('scene-error')).toBeVisible();await start(page);for(let i=0;i<3;i++)await record(page);await expect(page.getByTestId('completion')).toBeVisible();
});
test('runtime context loss and keyboard close preserve usable UI',async({page})=>{
 await page.goto('/');await expect(page.getByTestId('campus-canvas')).toBeVisible();const lost=await page.evaluate(()=>{const ext=document.querySelector('canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context');if(!ext)return false;ext.loseContext();return true;});expect(lost).toBe(true);await expect(page.getByTestId('scene-error')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByTestId('landmark-close')).toHaveCount(0);await page.getByTestId('open-directory').click();await expect(page.getByTestId('landmark-hy-main')).toBeVisible();
});
