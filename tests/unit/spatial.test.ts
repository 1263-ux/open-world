import { describe, expect, it } from 'vitest';
import { campuses } from '../../src/campus-data/campuses';
import type { Point2 } from '../../src/shared/contracts';
function inside([x,z]:Point2,ring:Point2[]):boolean{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
describe('source-backed meter data',()=>{
 it('never overwrites known main-building floor evidence with the conflicting 9m prediction',()=>{const f=campuses.huyu.features.find(f=>f.id==='689323083')!;expect(f.levels).toBe(13);expect(f.height).toBe(45.5);expect(f.heightStatus).toBe('level-estimate');});
 it('preserves different measured campus extents rather than equal toy islands',()=>{
  expect(campuses.huyu.extentMeters[0]).toBeCloseTo(671.5,0);
  expect(campuses.huyu.extentMeters[1]).toBeCloseTo(426.0,0);
  expect(campuses.yingxi.extentMeters[0]).toBeCloseTo(665.1,0);
  expect(campuses.yingxi.extentMeters[1]).toBeCloseTo(806.5,0);
 });
 for(const campus of Object.values(campuses)){
  it(`${campus.id}: retains source polygon shapes, metadata and complete travel routes`,()=>{
   expect(campus.features.filter(f=>f.kind==='building').length).toBe(campus.id==='huyu'?94:129);
   expect(new Set(campus.features.map(f=>f.id)).size).toBe(campus.features.length);
   for(const feature of campus.features){expect(feature.polygon.length).toBeGreaterThanOrEqual(4);expect(feature.source).toMatch(/^https:\/\/(www.openstreetmap.org\/way\/|docs.overturemaps.org\/guides\/buildings\/)/);expect(feature.height).toBeGreaterThan(0);expect(['osm-tag','level-estimate','ml-estimate','unverified']).toContain(feature.heightStatus);}
   for(const f of campus.features.filter(f=>f.heightStatus==='ml-estimate')){expect(f.heightSource?.year).toBe(2020);expect(f.heightSource?.matchIoU).toBeGreaterThanOrEqual(.65);expect(f.height).toBeGreaterThanOrEqual(3);expect(f.height).toBeLessThanOrEqual(60);expect(f.levels).toBeNull();}
   for(const target of campus.landmarks){
    const beginnings={start:campus.start,...Object.fromEntries(campus.landmarks.filter(p=>p.id!==target.id).map(p=>[p.id,p.arrival]))};
    for(const [from,point] of Object.entries(beginnings)){
      const route=campus.routes[`${from}>${target.id}`];expect(route.length).toBeGreaterThanOrEqual(2);expect(route[0]).toEqual(point);expect(route.at(-1)).toEqual(target.arrival);
      for(let i=1;i<route.length;i++)for(let t=0;t<=1;t+=.25){const p:Point2=[route[i-1][0]*(1-t)+route[i][0]*t,route[i-1][1]*(1-t)+route[i][1]*t];expect(inside(p,campus.boundary)).toBe(true);expect(campus.features.some(f=>f.kind==='building'&&inside(p,f.polygon))).toBe(false);}
    }
   }
  });
 }
});
