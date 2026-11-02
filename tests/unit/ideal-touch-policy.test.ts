import { expect, it, vi } from 'vitest';
import type { Page, Locator, TestInfo } from '@playwright/test';
import { compactTouchRoute, touchWalkTo } from '../e2e/ideal-activity-helpers';
import * as navigation from '../e2e/campus-walk';
import { walkRoute } from '../e2e/campus-walk';
import { campuses } from '../../src/campus-data/campuses';

it('preserves every turn, reversal, duplicate and endpoints without mutating the route', () => {
  const route: [number,number][] = [[0,0],[2,0],[4,0],[4,2],[4,4],[4,2],[4,2],[6,4],[8,6]];
  const saved = structuredClone(route);
  expect(compactTouchRoute(route)).toEqual([[0,0],[4,0],[4,4],[4,2],[4,2],[8,6]]);
  expect(route).toEqual(saved);
  expect(compactTouchRoute([])).toEqual([]);
});
it('retains the exact failed A* polyline geometry and first off-grid approach', () => {
  const route = walkRoute(campuses.yingxi, [-23.001,175.5], [54,172]);
  const compact = compactTouchRoute(route);
  expect(compact).toEqual([[-22,176],[46,176],[48,174],[52,174],[54,172],[54,172]]);
  const length = (points:[number,number][]) => points.slice(1).reduce((sum,p,i) => sum + Math.hypot(p[0]-points[i]![0],p[1]-points[i]![1]),0);
  expect(length(compact)).toBeCloseTo(length(route),12);
});

it.each([false,true])('repeated rendered frames do not spend progress budget; wall deadline still releases (%s)', async progresses => {
  let wall=0, reads=0;
  const commands: string[]=[];
  const route=vi.spyOn(navigation,'walkRoute').mockReturnValue([[46,176]]);
  const now=vi.spyOn(Date,'now').mockImplementation(()=>wall);
  const logging=vi.spyOn(console,'log').mockImplementation(()=>{});
  const frame=()=>145+(progresses?Math.min(18,Math.floor(reads/5)):0);
  const canvas={evaluate:async()=>['-20.592','0.120','175.797','0',String(frame())],boundingBox:async()=>({x:0,y:0,width:844,height:390}),getAttribute:async()=>String(frame())} as unknown as Locator;
  const page={context:()=>({newCDPSession:async()=>({send:async(_method:string,p:{type:string})=>{commands.push(p.type);},detach:async()=>{}})}),waitForTimeout:async(ms:number)=>{wall+=ms;reads++;}} as unknown as Page;
  try {
    await expect(touchWalkTo(page,canvas,[54,172],{attach:async()=>{}} as unknown as TestInfo,.9)).rejects.toThrow('30s watchdog');
    expect(reads).toBeGreaterThan(80);
    expect(wall).toBeLessThanOrEqual(30100);
    expect(commands.at(-1)).toBe('touchEnd');
  } finally { now.mockRestore();logging.mockRestore();route.mockRestore(); }
});
