import { expect, test, type Locator, type Page } from '@playwright/test';
import { position } from './campus-walk';

// Read-only test instrumentation exposes the real Three camera basis; actual
// movement and orbit are always delivered as trusted keyboard/touch/mouse input.
type Basis={right:number[];forward:number[]};
async function installProjection(page:Page) {
  let hits=0;
  await page.route('**/src/scene/CampusScene.ts*',async route=>{
    hits++;const response=await route.fetch(),body=await response.text(),anchor='const ownerWorld = world;';
    if(body.split(anchor).length!==2)throw Error('Missing unique read-only camera hook anchor');
    const patch=`${anchor}\nwindow.__controlBasis = () => { player.camera.updateMatrixWorld(true); const e=player.camera.matrixWorld.elements; return {right:[e[0],e[1],e[2]],forward:[-e[8],-e[9],-e[10]]}; };`;
    const headers:Record<string,string>={...response.headers(),'content-type':'application/javascript; charset=utf-8'};delete headers['content-encoding'];delete headers['content-length'];
    await route.fulfill({response,headers,body:body.replace(anchor,patch)});
  });return ()=>hits;
}
async function basis(page:Page):Promise<Basis>{return page.evaluate(()=>{const fn=(window as unknown as {__controlBasis?:()=>Basis}).__controlBasis;if(!fn)throw Error('Missing camera basis');return fn();});}
async function moveProjected(page:Page,canvas:Locator,kind:'key'|'touch',value:string,axis:'right'|'forward',sign:1|-1) {
  const before=await position(canvas),b=(await basis(page))[axis], box=await canvas.boundingBox();if(!box)throw Error('No canvas');
  const projection=async()=>{const p=await position(canvas);return sign*((p[0]-before[0])*b[0]!+(p[2]-before[2])*b[2]!);};
  if(kind==='key') {
    await canvas.focus();await page.keyboard.down(value);
    try{await expect.poll(projection,{timeout:15000}).toBeGreaterThan(.35);}finally{await page.keyboard.up(value);}
  } else {
    const client=await page.context().newCDPSession(page),x=box.x+box.width*.2,y=box.y+box.height*.6,dx=value==='left'?-55:55;
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    try{await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y,id:1}]});await expect.poll(projection,{timeout:15000}).toBeGreaterThan(.35);}
    finally{await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();}
  }
}
async function orbit(page:Page,canvas:Locator,touch=false) {
  const old=Number(await canvas.getAttribute('data-camera-yaw')),box=await canvas.boundingBox();if(!box)throw Error('No canvas');
  const x=box.x+box.width*.7,y=box.y+box.height*.5;
  if(touch){const c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:2}]});try{await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+110,y,id:2}]});}finally{await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();}}
  else {await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+110,y,{steps:12});await page.mouse.up();}
  await expect.poll(async()=>Math.abs(Number(await canvas.getAttribute('data-camera-yaw'))-old),{timeout:15000}).toBeGreaterThan(.1);
}

test('keyboard and arrows follow real screen projection across camera headings',async({page},info)=>{
  test.setTimeout(180000);const intercepted=await installProjection(page);await page.goto('/');expect(intercepted()).toBe(1);
  const canvas=page.getByTestId('campus-canvas');await expect(canvas).toHaveAttribute('data-campus-ready','yingxi',{timeout:30000});
  for(let heading=0;heading<2;heading++){
    for(const [key,axis,sign] of [['d','right',1],['a','right',-1],['ArrowRight','right',1],['ArrowLeft','right',-1],['w','forward',1],['s','forward',-1]] as const) await moveProjected(page,canvas,'key',key,axis,sign);
    await page.screenshot({path:info.outputPath(`keyboard-heading-${heading}.png`)});if(heading===0)await orbit(page,canvas);
  }
});

test.describe('landscape touch projection',()=>{
  test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
  test('left stick follows screen left/right before and after orbit',async({page},info)=>{
    test.setTimeout(180000);const intercepted=await installProjection(page);await page.goto('/');expect(intercepted()).toBe(1);
    const canvas=page.getByTestId('campus-canvas');await expect(canvas).toHaveAttribute('data-campus-ready','yingxi',{timeout:30000});
    for(let heading=0;heading<2;heading++){
      await moveProjected(page,canvas,'touch','right','right',1);await moveProjected(page,canvas,'touch','left','right',-1);
      await page.screenshot({path:info.outputPath(`touch-heading-${heading}.png`)});if(heading===0)await orbit(page,canvas,true);
    }
  });
});
