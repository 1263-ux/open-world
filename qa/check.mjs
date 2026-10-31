import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('evidence',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
for(const [name,width,height,mobile] of [['desktop',1440,960,false],['mobile-landscape',844,390,true]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});const page=await context.newPage();page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()} ${r.url()}`)});
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await page.waitForTimeout(1800);assert.equal(await page.locator('canvas').count(),1);await page.screenshot({path:`evidence/${name}-overview.png`});
 await page.locator('#close').click();await page.waitForTimeout(1200);await page.screenshot({path:`evidence/${name}-close.png`});
 const before=await page.evaluate(()=>window.__sampleStats?.());
 if(mobile){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width*.6,y:height*.55,id:1}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width*(.6+.12*i/8),y:height*.55,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach()}
 else{await page.mouse.move(width*.6,height*.55);await page.mouse.down();await page.mouse.move(width*.72,height*.58,{steps:8});await page.mouse.up()}
 const after=await page.evaluate(()=>window.__sampleStats?.());if(before&&after)assert.notDeepEqual(before.camera,after.camera,'Gesture must change camera');await page.waitForTimeout(500);await page.screenshot({path:`evidence/${name}-orbit.png`});
 await page.locator('#reset').click();await page.waitForTimeout(900);await page.screenshot({path:`evidence/${name}-reset.png`});
 const diagnostics=await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2');return{width:c.width,height:c.height,webgl:!!gl,contextLost:gl?.isContextLost(),renderer:gl?.getParameter(gl.RENDERER)}});assert.equal(diagnostics.webgl,true);assert.equal(diagnostics.contextLost,false);results.push({name,url:page.url(),diagnostics,stats:await page.evaluate(()=>window.__sampleStats?.()),gesture:mobile?'CDP touch drag':'mouse drag',before,after,errors});await context.close();
}
await browser.close();await writeFile('evidence/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));assert(results.every(r=>!r.errors.length),'Browser errors');
