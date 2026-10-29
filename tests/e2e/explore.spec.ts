import { expect, test, type Page } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';
const stops=['hy-north-gate','hy-library','hy-meihua'];
async function visit(page:Page,id:string){await page.getByTestId(`landmark-${id}`).click();await page.getByTestId('quest-check-in').click();}
test('desktop: campus switch, quest order, refresh, replay and exit',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'虎峪校区'})).toBeVisible();
 await expect(page.getByTestId('campus-canvas')).toBeVisible();
 await expect(page.getByTestId('scene-error')).toHaveCount(0);
 await page.screenshot({path:'test-results/desktop-baseline.png',fullPage:true});
 await page.getByTestId('quest-start').click();
 await visit(page,'hy-library');
 await expect(page.getByTestId('quest-status')).toHaveText('探索进行中');
 await expect(page.locator('.quest-steps li.done')).toHaveCount(0);
 await visit(page,stops[0]);
 await page.reload();
 await expect(page.locator('.quest-steps li.done')).toHaveCount(1);
 await visit(page,stops[1]);await visit(page,stops[2]);
 await expect(page.getByTestId('quest-status')).toHaveText('探索完成');
 await page.getByTestId('landmark-close').click();
 await expect(page.getByTestId('landmark-hy-meihua')).toBeFocused();
 await page.getByTestId('quest-replay').click();
 await expect(page.locator('.quest-steps li.done')).toHaveCount(0);
 await page.getByTestId('quest-exit').click();
 await expect(page.getByTestId('quest-start')).toBeVisible();
 for(let i=0;i<3;i++){await page.getByTestId('campus-yingxi').click();await expect(page.getByTestId('landmark-yx-garden')).toBeVisible();await page.getByTestId('campus-huyu').click();}
 await page.getByTestId('quest-start').click();await visit(page,stops[0]);await page.getByTestId('campus-yingxi').click();await page.getByTestId('campus-huyu').click();
 await expect(page.getByTestId('quest-status')).toHaveText('尚未开始');
 expect(errors).toEqual([]);
});
test('real canvas picking and dragging does not select',async({page})=>{
 await page.goto('/');const canvas=page.getByTestId('campus-canvas');await expect(canvas).toBeVisible();
 const rect=await canvas.boundingBox();if(!rect)throw new Error('missing canvas');
 const aspect=rect.width/rect.height;const hw=86*Math.max(1,aspect)/2,hh=86*Math.max(1,1/aspect)/2;
 const camera=new OrthographicCamera(-hw,hw,hh,-hh,0.1,500);camera.position.set(48,52,58);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const point=new Vector3(3,8,0).project(camera);const x=rect.x+(point.x+1)*rect.width/2,y=rect.y+(1-point.y)*rect.height/2;
 await page.mouse.click(x,y);await expect(page.locator('#card-title')).toHaveText('图书馆');
 await page.getByTestId('landmark-close').click();
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+80,y+25,{steps:10});await page.mouse.up();
 await expect(page.getByTestId('landmark-close')).toHaveCount(0);
 await page.getByTestId('reset-view').click();
});
test('mobile layout and complete Yingxi quest',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await expect(page.getByTestId('campus-canvas')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:'test-results/mobile-baseline.png',fullPage:true});
 await page.getByTestId('campus-yingxi').click();await page.getByTestId('quest-start').click();
 for(const id of ['yx-south-gate','yx-office','yx-garden'])await visit(page,id);
 await expect(page.getByTestId('quest-status')).toHaveText('探索完成');
});
test('WebGL failure and corrupt progress still allow keyboard exploration',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('campus-atlas:quests','{broken');
  const original=HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{value:function(this:HTMLCanvasElement,type:string,...args:unknown[]){if(type.startsWith('webgl'))return null;return Reflect.apply(original,this,[type,...args]);}});
 });
 await page.goto('/');await expect(page.getByTestId('scene-error')).toBeVisible();
 const button=page.getByTestId('landmark-hy-library');await button.focus();await page.keyboard.press('Enter');
 await expect(page.locator('#card-title')).toHaveText('图书馆');await page.getByTestId('landmark-close').click();await expect(button).toBeFocused();
 await page.getByTestId('quest-start').click();for(const id of stops)await visit(page,id);
 await expect(page.getByTestId('quest-status')).toHaveText('探索完成');
});
