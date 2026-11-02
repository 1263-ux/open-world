import { expect, test } from '@playwright/test';
import { REFERENCE_SHOTS, REFERENCE_VIEWPORT, captureReference, type ReferencePose } from './campus-visual-reference-helpers';

const baseline=process.env.BASELINE_REFERENCE_URL,candidate=process.env.CANDIDATE_REFERENCE_URL;
test('four true before/after groups share reference quality and real-input camera poses',async({browser},info)=>{
  test.skip(!baseline||!candidate,'Needs the explicitly patched e7c2 baseline and candidate static servers in the same authorized job; current base is NOT old art.');
  test.setTimeout(720000);
  for(const url of [baseline!,candidate!])expect(['127.0.0.1','localhost']).toContain(new URL(url).hostname);
  const before=new Map<string,ReferencePose>();
  for(const [label,url] of [['before',baseline!],['after',candidate!]] as const){
    const context=await browser.newContext({viewport:REFERENCE_VIEWPORT,deviceScaleFactor:1,hasTouch:true,isMobile:false});const page=await context.newPage();
    try{
      await page.goto(`${url.replace(/\/$/,'')}/?render-quality=reference`);const canvas=page.getByTestId('campus-canvas');
      await expect(canvas).toHaveAttribute('data-campus-ready','yingxi',{timeout:30000});await page.getByRole('button',{name:'先去漫游',exact:true}).click();
      for(const shot of REFERENCE_SHOTS){const pose=await captureReference(page,canvas,shot,label,info,before.get(shot.id));if(label==='before')before.set(shot.id,pose);}
    }finally{await context.close();}
  }
  expect(before.size).toBe(4);
});
