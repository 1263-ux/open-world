import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { campuses } from '../../src/campus-data/campuses';
import { ARRIVAL_DESIGN_STATUS, ARRIVAL_ROUTES, ARRIVAL_SURFACE_REFINEMENT, HUYU_ARRIVAL_WALK_CONNECTION, arrivalSiteIsClear, arrivalSurfaceIsClear, createCampusArrivalLandscape } from '../../src/scene/CampusArrivalLandscape';
import type { CampusData, Point2 } from '../../src/shared/contracts';
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
    // Open ground now uses the third existing material even when every plant
    // is excluded. Its draw remains bounded to the ordinary three batches.
    expect(result.placements).toHaveLength(0);expect(result.metrics.groundDrawBatches).toBe(3);result.dispose();
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

it('fills the optional gate-to-west-corner walk continuously with four shared-edge ground triangles',()=>{
  const result=createCampusArrivalLandscape(campuses.huyu),config=HUYU_ARRIVAL_WALK_CONNECTION;
  try {
    expect(config.points).toEqual(campuses.huyu.routes['hy-north-gate>hy-meihua'].slice(0,3));
    expect(config.width).toBe(2.4);expect(config.elevation).toBeLessThan(.035);
    const mesh=result.visual.getObjectByName('arrival-mineral-shoulders') as THREE.Mesh;
    const p=mesh.geometry.getAttribute('position'),triangles:THREE.Triangle[]=[];
    for(let i=0;i<p.count;i+=3)if(Math.abs(p.getY(i)-config.elevation)<1e-6)triangles.push(new THREE.Triangle(...[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j)) as [THREE.Vector3,THREE.Vector3,THREE.Vector3]));
    expect(triangles).toHaveLength(4);
    const coords=(v:THREE.Vector3)=>v.toArray().map(n=>n.toFixed(5)).join(',');
    // The first ribbon's terminal edge is exactly the next ribbon's start edge.
    expect(coords(triangles[1].a)).toBe(coords(triangles[2].a));
    expect(coords(triangles[1].b)).toBe(coords(triangles[2].c));
    const normal=new THREE.Vector3();for(const t of triangles)expect(t.getNormal(normal).y).toBeGreaterThan(.99);
    const ray=new THREE.Ray(),hit=new THREE.Vector3();
    for(let i=1;i<config.points.length;i++){
      const a=config.points[i-1],b=config.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      for(let d=.01;d<length;d+=.25)for(const offset of [-1.15,0,1.15]){
        const x=a[0]+dx*d/length-dz*offset/length,z=a[1]+dz*d/length+dx*offset/length;
        ray.set(new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0));
        expect(triangles.some(t=>ray.intersectTriangle(t.a,t.b,t.c,false,hit)!==null),`uncovered walkway ${x},${z}`).toBe(true);
        expect(arrivalSiteIsClear(campuses.huyu,x,z,.01,false),`walk surface touches source footprint ${x},${z}`).toBe(true);
      }
    }
    // Analytic area: miter joins add no duplicate area or holes between segments.
    const routeLength=config.points.slice(1).reduce((n,b,i)=>n+Math.hypot(b[0]-config.points[i][0],b[1]-config.points[i][1]),0);
    expect(triangles.reduce((n,t)=>n+t.getArea(),0)).toBeCloseTo(routeLength*config.width,3);
    expect(result.metrics.groundDrawBatches).toBe(3);
    expect(result.metrics.groundTriangles+result.metrics.natureTriangles).toBeLessThan(20000);
    const other=createCampusArrivalLandscape(campuses.yingxi);
    expect(other.route).toEqual(ARRIVAL_ROUTES.yingxi);
    expect(other.placements.some(p=>p.position[0]===7&&p.position[2]===179)).toBe(true);other.dispose();
  } finally {result.dispose();}
});

const polygonArea=(points:readonly Point2[])=>Math.abs(points.reduce((sum,a,i)=>{
  const b=points[(i+1)%points.length];return sum+a[0]*b[1]-a[1]*b[0];
},0))/2;
function triangleIntersectionArea(subject:Point2[],clip:Point2[]):number {
  const cross=(a:Point2,b:Point2,p:Point2)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const direction=Math.sign(cross(clip[0],clip[1],clip[2]));
  let result=subject;
  for(let i=0;i<clip.length;i++) {
    const a=clip[i],b=clip[(i+1)%clip.length],input=result;result=[];
    for(let j=0;j<input.length;j++) {
      const start=input[j],end=input[(j+1)%input.length];
      const ds=direction*cross(a,b,start),de=direction*cross(a,b,end);
      if((ds>=0)!==(de>=0)) {
        const t=ds/(ds-de);result.push([start[0]+(end[0]-start[0])*t,start[1]+(end[1]-start[1])*t]);
      }
      if(de>=0)result.push(end);
    }
  }
  return polygonArea(result);
}

describe('bounded route surface refinement',()=>{
  const baseline={
    huyu:{ground:1846,added:28,area:598.423567420853,nature:28,triangles:8360,hash:'a34e7621f36741c55bee8eb3a86e5bea9d4020f00c2eafbd5c5d3310c415731d'},
    yingxi:{ground:1918,added:37,area:543.1435,nature:32,triangles:10024,hash:'278ede8d95b7e3d399172f2b9115f4a2ae7a2ab53d69353a905234d7e4e98cd1'},
  };
  for(const id of ['huyu','yingxi'] as const)it(`${id}: complete polygons clear source boundaries, keep nature exact, and reuse only three owned batches`,()=>{
    const expected=baseline[id],data=campuses[id],before=JSON.stringify(data),patches=ARRIVAL_SURFACE_REFINEMENT[id];
    const a=createCampusArrivalLandscape(data),b=createCampusArrivalLandscape(data);
    try {
      expect(new Set(patches.map(p=>p.id)).size).toBe(patches.length);
      expect(patches.every(p=>arrivalSurfaceIsClear(data,p.polygon))).toBe(true);
      expect(patches.reduce((n,p)=>n+p.polygon.length-2,0)).toBe(expected.added);
      // Gross authored surface area includes intentional lower-layer coverage;
      // this is geometry accounting, not a claim that all of it is visible.
      expect(patches.reduce((n,p)=>n+polygonArea(p.polygon),0)).toBeCloseTo(expected.area,6);
      expect(a.metrics.groundTriangles).toBe(expected.ground+expected.added);
      expect(expected.added).toBeLessThan(100);
      expect(a.metrics.groundDrawBatches).toBe(3);
      expect(a.metrics.placementCount).toBe(expected.nature);
      expect(a.metrics.natureTriangles).toBe(expected.triangles);
      expect(createHash('sha256').update(JSON.stringify(a.placements)).digest('hex')).toBe(expected.hash);
      expect(a.placements).toEqual(b.placements);
      expect('colliders' in a).toBe(false);
      expect(a.visual.children).toHaveLength(3);
      const elevations=new Set(patches.map(p=>p.elevation));
      let refinementTriangles=0,refinementArea=0;
      a.visual.children.forEach((child,index)=>{
        expect(child).toBeInstanceOf(THREE.Mesh);
        const mesh=child as THREE.Mesh,other=b.visual.children[index] as THREE.Mesh;
        expect(mesh.castShadow).toBe(false);
        expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
        expect((mesh.material as THREE.MeshStandardMaterial).map).toBeNull();
        const positions=mesh.geometry.getAttribute('position');
        expect(Array.from(positions.array)).toEqual(Array.from(other.geometry.getAttribute('position').array));
        for(let i=0;i<positions.count;i+=3) {
          if(![...elevations].some(y=>Math.abs(positions.getY(i)-y)<1e-6))continue;
          refinementTriangles++;
          const triangle=new THREE.Triangle(...[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(positions,i+j)) as [THREE.Vector3,THREE.Vector3,THREE.Vector3]);
          expect(triangle.getNormal(new THREE.Vector3()).y).toBeGreaterThan(.999);
          refinementArea+=triangle.getArea();
          // Whole rendered triangles, including their interiors and all edges,
          // must be admitted after Float32 conversion too.
          expect(arrivalSurfaceIsClear(data,[triangle.a,triangle.b,triangle.c].map(p=>[p.x,p.z]))).toBe(true);
        }
      });
      expect(refinementTriangles).toBe(expected.added);
      expect(refinementArea).toBeCloseTo(expected.area,2);
      expect(JSON.stringify(data)).toBe(before);
      if(id==='yingxi') {
        expect(a.placements.some(p=>p.kind==='tree-spreading'&&p.position[0]===7&&p.position[2]===179)).toBe(true);
        expect(a.placements.some(p=>p.kind==='shrub'&&p.position[0]===0&&p.position[2]===178)).toBe(true);
        expect(patches.every(p=>p.elevation>.025&&p.elevation<.035)).toBe(true);
        // Stay east of the mechanical steps and west of the flight/platform;
        // terminate before the old Qingze path/pavilion footprint.
        expect(patches.every(p=>p.polygon.every(([x,z])=>x>=-50.8&&x<=40.5&&z<=188.4))).toBe(true);
      } else {
        expect(patches.every(p=>p.elevation<HUYU_ARRIVAL_WALK_CONNECTION.elevation)).toBe(true);
        expect(patches.every(p=>p.polygon.every(([x,z])=>x>=-47&&z<=-105.03))).toBe(true);
      }
    } finally {a.dispose();b.dispose();}
  });

  it('rejects full-edge crossings, enclosing a building, insufficient clearance, and a concave campus notch',()=>{
    const building=campuses.huyu.features.find(f=>f.kind==='building')!;
    const data:CampusData={...campuses.huyu,boundary:[[-10,-10],[10,-10],[10,10],[-10,10]],
      features:[{...building,polygon:[[-1,-2],[1,-2],[1,2],[-1,2]]}]};
    const crossing:Point2[]=[[-4,-.5],[4,-.5],[4,.5],[-4,.5]];
    expect(crossing.every(([x,z])=>arrivalSiteIsClear(data,x,z,.3,false))).toBe(true);
    expect(arrivalSurfaceIsClear(data,crossing)).toBe(false);
    expect(arrivalSurfaceIsClear(data,[[-4,-4],[4,-4],[4,4],[-4,4]])).toBe(false);
    expect(arrivalSurfaceIsClear(data,[[1.2,-3],[4,-3],[4,3],[1.2,3]])).toBe(false);
    expect(arrivalSurfaceIsClear(data,[[1.4,-3],[4,-3],[4,3],[1.4,3]])).toBe(true);
    const notch:CampusData={...data,features:[],boundary:[[-10,-10],[10,-10],[10,10],[2,10],[2,0],[-2,0],[-2,10],[-10,10]]};
    const acrossNotch:Point2[]=[[-4,-4],[4,-4],[4,4],[-4,4]];
    expect(acrossNotch.every(([x,z])=>arrivalSiteIsClear(notch,x,z,.3,false))).toBe(true);
    expect(arrivalSurfaceIsClear(notch,acrossNotch)).toBe(false);
    expect(arrivalSurfaceIsClear(data,[[9.8,-1],[9.9,-1],[9.9,1],[9.8,1]])).toBe(false);
  });

  it('has no coplanar polygon overlap, including the shared corner and fan seams',()=>{
    for(const id of ['huyu','yingxi'] as const) {
      const patches=ARRIVAL_SURFACE_REFINEMENT[id].map(p=>({...p,triangles:THREE.ShapeUtils.triangulateShape(p.polygon.map(([x,z])=>new THREE.Vector2(x,z)),[]).map(face=>face.map(index=>p.polygon[index]))}));
      for(let i=0;i<patches.length;i++)for(let j=i+1;j<patches.length;j++) {
        const a=patches[i],b=patches[j];if(a.elevation!==b.elevation)continue;
        const overlap=a.triangles.reduce((sum,t)=>sum+b.triangles.reduce((n,u)=>n+triangleIntersectionArea(t,u),0),0);
        expect(overlap,`${id}: ${a.id} overlaps ${b.id}`).toBeLessThan(1e-7);
      }
    }
  });

  it('joins the Huyu stop directly to the old walk, and exposes Yingxi framing above the park',()=>{
    for(const id of ['huyu','yingxi'] as const) {
      const result=createCampusArrivalLandscape(campuses[id]);
      try {
        const ray=new THREE.Raycaster();result.visual.updateMatrixWorld(true);
        const height=(x:number,z:number)=>{
          ray.set(new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0));
          return ray.intersectObject(result.visual,true)[0]?.point.y;
        };
        if(id==='huyu') {
          for(let x=-42;x<=-35.74;x+=.2)expect(height(x,-142)).toBeGreaterThanOrEqual(.024-1e-6);
          expect(height(-35.74,-142)).toBeCloseTo(.03,6);
          expect(height(-37.15,-130)).toBeCloseTo(.027,6);
          expect(height(-38.5,-130)).toBeCloseTo(.022,6);
          expect(height(-44,-147)).toBeCloseTo(.022,6);
        } else {
          expect(height(8,168)).toBeCloseTo(.028,6);
          expect(height(39,177)).toBeCloseTo(.030,6);
          expect(height(40.3,177)).toBeCloseTo(.032,6);
          expect(height(39.3,185.4)).toBeCloseTo(.032,6);
        }
      } finally {result.dispose();}
    }
  });
});
