import { describe, expect, it } from 'vitest';
import { Box3, Mesh } from 'three';
import { campuses } from '../../src/campus-data/campuses';
import { PHOTO_POINTS } from '../../src/games/photography';
import { createOriginalViewingPlatform, PLATFORM_BOXES, VIEWING_PLATFORM, PAPERPLANE_STATION, PLATFORM_GROUND_LINKS } from '../../src/scene/OriginalViewingPlatform';
import { walkRoute } from '../e2e/campus-walk';
import type { Point2 } from '../../src/shared/contracts';
const edges=(p:Point2[])=>p.map((a,i)=>[a,p[(i+1)%p.length]!] as const);
const pointDistance=(p:Point2,a:Point2,b:Point2)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);};
const cross=(a:Point2,b:Point2,c:Point2)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function segmentDistance(a:Point2,b:Point2,c:Point2,d:Point2){if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;return Math.min(pointDistance(a,c,d),pointDistance(b,c,d),pointDistance(c,a,b),pointDistance(d,a,b));}
function inside(p:Point2,poly:Point2[]){let result=false;for(const [a,b] of edges(poly))if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result;return result;}
function polygonDistance(a:Point2[],b:Point2[]){if(a.some(p=>inside(p,b))||b.some(p=>inside(p,a)))return 0;return Math.min(...edges(a).flatMap(e=>edges(b).map(f=>segmentDistance(...e,...f))));}
const footprints=()=>PLATFORM_BOXES.map(b=>({name:b.name,p:[[b.min[0],b.min[2]],[b.max[0],b.min[2]],[b.max[0],b.max[2]],[b.min[0],b.max[2]]] as Point2[]}));
describe('whole-footprint original platform layout',()=>{
  it('keeps every proxy footprint inside boundary and clear of all source buildings/model obstacles',()=>{
    const campus=campuses.yingxi;
    for(const {name,p} of footprints()){
      expect(p.every(v=>inside(v,campus.boundary)),name).toBe(true);
      expect(Math.min(...edges(p).flatMap(e=>edges(campus.boundary).map(f=>segmentDistance(...e,...f)))),name).toBeGreaterThan(.5);
      for(const obstacle of [...campus.features.filter(f=>f.kind==='building'),...(campus.modelObstacles??[])])expect(polygonDistance(p,obstacle.polygon),`${name}/${obstacle.id}`).toBeGreaterThan(.5);
    }
  });
  it('clears mapped roads with verge, every route segment, and both old photo sightlines',()=>{
    const campus=campuses.yingxi;
    for(const {name,p} of footprints()){
      for(const road of campus.roads)for(let i=1;i<road.points.length;i++)expect(Math.min(...edges(p).map(e=>segmentDistance(...e,road.points[i-1]!,road.points[i]!)))-road.width/2-1.15,`${name}/${road.id}`).toBeGreaterThan(0);
      for(const [route,points] of Object.entries(campus.routes))for(let i=1;i<points.length;i++)expect(Math.min(...edges(p).map(e=>segmentDistance(...e,points[i-1]!,points[i]!))),`${name}/${route}`).toBeGreaterThan(.5);
      for(const photo of PHOTO_POINTS.filter(p=>p.id==='hall'||p.id==='garden'))expect(Math.min(...edges(p).map(e=>segmentDistance(...e,photo.position,[photo.target[0],photo.target[2]]))),`${name}/${photo.id}`).toBeGreaterThan(.5);
    }
  });
  it('uses six visible closed stair solids and matching independent collision geometry within budget',()=>{
    const platform=createOriginalViewingPlatform();try{
      expect(PLATFORM_BOXES.length).toBeLessThanOrEqual(40);const steps=PLATFORM_BOXES.filter(b=>b.kind==='step');expect(steps).toHaveLength(6);
      for(const [i,step] of steps.entries()){expect(step.max[1]).toBeCloseTo(.12+.18*(i+1));expect(step.max[0]-step.min[0]).toBeGreaterThanOrEqual(2.4-1e-8);expect(step.max[2]-step.min[2]).toBeGreaterThanOrEqual(.4);}
      for(const collider of platform.colliders.children){const visual=platform.visual.getObjectByName(collider.name);expect(visual).toBeDefined();expect(new Box3().setFromObject(visual!).equals(new Box3().setFromObject(collider))).toBe(true);expect((collider as Mesh).geometry.index?.count).toBe(36);expect((collider as Mesh).geometry).not.toBe((visual as Mesh).geometry);}
      expect(VIEWING_PLATFORM.deckTop-VIEWING_PLATFORM.groundFoot).toBeCloseTo(1.08);
    }finally{platform.dispose();platform.dispose();}
  });
  it('distinguishes safe ground folding stance from elevated photo and outward launch',()=>{
    expect(VIEWING_PLATFORM.photo.heightRange[0]).toBeGreaterThan(1);expect(PAPERPLANE_STATION.heightRange[1]).toBeLessThan(1);
    expect(PAPERPLANE_STATION.foldingDirection[2]).toBe(-1);expect(PAPERPLANE_STATION.launchDirection[2]).toBe(1);
    expect(PAPERPLANE_STATION.release[1]).toBeGreaterThan(1);
  });
  it('keeps exact station-link segments clear of props including capsule and strict corner tolerance',()=>{
    const radiusAndCorner=.34+.25;
    const link=PLATFORM_GROUND_LINKS[2]!;
    for(let i=1;i<link.length;i++)for(const {name,p} of footprints()){
      const a=link[i-1]!,b=link[i]!;
      expect(inside(a,p)||inside(b,p),`${name}: authored segment endpoint inside solid`).toBe(false);
      expect(Math.min(...edges(p).map(e=>segmentDistance(a,b,...e))),`${name}: segment ${a}→${b}`).toBeGreaterThan(radiusAndCorner);
    }
    const end=link.at(-1)!;expect(Math.hypot(end[0]-PAPERPLANE_STATION.standing[0],end[1]-PAPERPLANE_STATION.standing[2])+.25).toBeLessThan(PAPERPLANE_STATION.interactionRadius);
    expect(end[1]).toBeGreaterThan(PAPERPLANE_STATION.position[2]); // south/front, folding faces north
  });
  it('checks actual legacy A* staging paths before unsnapped local station routing',()=>{
    const stage:Point2=[VIEWING_PLATFORM.approach[0],Math.floor(VIEWING_PLATFORM.stairs.minZ)-3];
    for(const from of [[-20,175.5],[35,193],[60,173.4],[60.859,173.4],[59.2,173.4]] as Point2[]){
      const route=[from,...walkRoute(campuses.yingxi,from,stage)];
      for(let i=1;i<route.length;i++)for(const {name,p} of footprints()){
        expect(inside(route[i-1]!,p)||inside(route[i]!,p),name).toBe(false);
        expect(Math.min(...edges(p).map(e=>segmentDistance(route[i-1]!,route[i]!,...e))),`${name}: staging from ${from}`).toBeGreaterThan(.34);
      }
    }
  });

});
