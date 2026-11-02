import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { campuses } from '../../src/campus-data/campuses';
import { ARRIVAL_DESIGN_STATUS, ARRIVAL_ROUTES, arrivalSiteIsClear, createCampusArrivalLandscape } from '../../src/scene/CampusArrivalLandscape';
import { PlayerController } from '../../src/scene/PlayerController';
import { StudentModel } from '../../src/scene/StudentModel';
import { ElementDouble } from './controller-harness';
import { getNaturePlacementBounds } from '../../src/scene/CampusNatureAssets';

describe('continuous arrival design: real data admission and resource ownership',()=>{
  for(const id of ['huyu','yingxi'] as const) it(`${id}: genuine route/footprint admission and measured bounded geometry`,()=>{
    const data=campuses[id],before=JSON.stringify(data),landscape=createCampusArrivalLandscape(data);
    expect(ARRIVAL_DESIGN_STATUS).toBe('designApproximation');
    expect(landscape.visual.userData.designApproximation).toBe(true);
    expect(landscape.placements.filter(p=>p.kind.startsWith('tree')) .length).toBeGreaterThanOrEqual(3);
    expect(landscape.metrics.groundDrawBatches).toBeLessThanOrEqual(3);
    expect(landscape.metrics.groundTriangles).toBeLessThan(6000);
    expect(landscape.metrics.groundTriangles+landscape.metrics.natureTriangles).toBeLessThan(20000);
    expect(landscape.metrics.groundDrawBatches+landscape.metrics.natureDrawBatches).toBeLessThanOrEqual(12);
    for(const p of landscape.placements){
      const b=getNaturePlacementBounds(p),[x,,z]=p.position;
      const r=Math.max(...[b.min.x,b.max.x].flatMap(xx=>[b.min.z,b.max.z].map(zz=>Math.hypot(xx-x,zz-z))));
      expect(arrivalSiteIsClear(data,x,z,r)).toBe(true);
      expect(p.position[1]).toBe(0);
    }
    const faces=new Set<string>();
    landscape.visual.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
      expect(o.userData.photoIgnore).not.toBe(true);
      const p=o.geometry.getAttribute('position');
      for(let i=0;i<p.count;i+=3){
        const v=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j)]);
        expect(v.every(a=>a[1]<.075)).toBe(true);
        const center=v.reduce((a,b)=>[a[0]+b[0]/3,a[1]+b[2]/3],[0,0]);
        expect(arrivalSiteIsClear(data,center[0],center[1],0,false)).toBe(true);
        const key=v.map(a=>a.map(c=>c.toFixed(5)).join(',')).sort().join('|');
        expect(faces.has(key)).toBe(false);faces.add(key);
      }
    });
    expect(JSON.stringify(data)).toBe(before);
    const geo:ReturnType<typeof vi.spyOn>[]=[];const mats=new Set<THREE.Material>();
    landscape.visual.traverse(o=>{if(o instanceof THREE.Mesh){geo.push(vi.spyOn(o.geometry,'dispose'));(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));}});
    const materialSpies=[...mats].map(m=>vi.spyOn(m,'dispose'));
    const world=new THREE.Group();world.add(landscape.visual);landscape.dispose();landscape.dispose();
    expect(world.children).toHaveLength(0);for(const spy of [...geo,...materialSpies])expect(spy).toHaveBeenCalledOnce();
  });
  it('honors caller-owned existing prop exclusion, and has no asynchronous side effects',()=>{
    const result=createCampusArrivalLandscape(campuses.yingxi,()=>false);
    expect(result.placements).toHaveLength(0);expect(result.metrics.groundDrawBatches).toBe(2);result.dispose();
  });
  it('rejects real walls, source roads, photographed entrance axis, and flight/garden area',()=>{
    expect(arrivalSiteIsClear(campuses.huyu,15,-132,1)).toBe(false);
    expect(arrivalSiteIsClear(campuses.yingxi,-73,173,1)).toBe(false);
    expect(arrivalSiteIsClear(campuses.yingxi,-35,175.5,1)).toBe(false);
    expect(arrivalSiteIsClear(campuses.yingxi,60,179,1)).toBe(false);
    expect(arrivalSiteIsClear(campuses.yingxi,35,205,1)).toBe(false);
    for(const id of ['huyu','yingxi'] as const) for(const [x,z] of ARRIVAL_ROUTES[id]) expect(arrivalSiteIsClear(campuses[id],x,z,.5)).toBe(false);
  });
});

// CPU-only route regression, not rendered full-world proof. Plant AABBs here are
// deliberately conservative supersets; Scene's old props remain an E2E check.
it('Huyu gate continuation uses existing Meihua route and clears source walls plus new plant envelopes',()=>{
  const data=campuses.huyu, route=ARRIVAL_ROUTES.huyu;
  expect(route.slice(1)).toEqual(data.routes['hy-north-gate>hy-meihua'].slice(0,3));
  expect(data.questOrder).toEqual(['hy-main','hy-library','hy-training']);
  const length=route.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-route[i][0],p[1]-route[i][1]),0);
  expect(length).toBeLessThan(130);expect(length/3.4).toBeLessThan(39);
  vi.stubGlobal('Element',ElementDouble);
  vi.stubGlobal('document',Object.assign(new EventTarget(),{createElement:()=>new ElementDouble()}));
  vi.stubGlobal('window',new EventTarget());
  vi.spyOn(performance,'now').mockReturnValue(0);
  vi.spyOn(StudentModel,'load').mockReturnValue(new Promise(()=>{}));
  const landscape=createCampusArrivalLandscape(data),props=new THREE.Group(),mat=new THREE.MeshBasicMaterial();
  for(const p of landscape.placements){
    if(p.kind==='grass')continue;
    const box=getNaturePlacementBounds(p),size=box.getSize(new THREE.Vector3());
    const m=new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z),mat);m.position.copy(box.getCenter(new THREE.Vector3()));props.add(m);
  }
  const player=new PlayerController(new ElementDouble() as unknown as HTMLElement,new ElementDouble() as unknown as HTMLCanvasElement);
  try {
    player.setCampus(data,props);
    const input=player as unknown as {yaw:number;joystick:THREE.Vector2};input.yaw=0;
    for(const target of route){
      let reached=false;
      for(let i=0;i<1500;i++){
        const dx=target[0]-player.avatar.position.x,dz=target[1]-player.avatar.position.z,d=Math.hypot(dx,dz);
        if(d<.25){reached=true;break;}
        input.joystick.set(-dx/d,-dz/d);player.update(1/60);
      }
      expect(reached,`source-wall/new-envelope route target ${target}`).toBe(true);
      if(target[0]===-35.74&&target[1]===-147.03){
        input.joystick.set(0,0);input.yaw=0;player.updateCamera(true);
        // Ordinary +Z view down the existing Meihua leg, not a selected beauty pose.
        // The 6m chase camera must not get squeezed against the main block.
        expect(player.camera.position.z).toBeLessThan(player.avatar.position.z-5.5);
        expect(Math.abs(player.camera.position.x-player.avatar.position.x)).toBeLessThan(.01);
        for(let z=-146;z<=-105;z+=1) expect(arrivalSiteIsClear(data,-35.74,z,.6,false)).toBe(true);
      }
    }
    expect(player.avatar.position.z).toBeGreaterThan(-106);
  } finally {
    player.dispose();landscape.dispose();props.children.forEach(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});mat.dispose();vi.restoreAllMocks();vi.unstubAllGlobals();
  }
});
