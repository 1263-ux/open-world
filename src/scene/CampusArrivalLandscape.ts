import * as THREE from 'three';
import type { CampusData, CampusId, Point2 } from '../shared/contracts';
import { getNaturePlacementBounds, NATURE_MODEL_BOUNDS, type NaturePlacement } from './CampusNatureAssets';

/** Original landscape design, NOT surveyed campus paving or vegetation.
 * The authored shoulders sit below existing hardscape (.05); tree beds (.065) remain below roads (.09) and
 * quest paths (.11). Nothing in this module changes source geometry or physics.
 */
export const ARRIVAL_DESIGN_STATUS = 'designApproximation' as const;
type Rect = readonly [number, number, number, number];
export const ARRIVAL_ROUTES: Record<CampusId, readonly Point2[]> = {
  // After the gate stop, these are the existing gate-to-Meihua route nodes.
  // Meihua is an optional explicit next destination, never a rewritten first quest.
  huyu: [[18.26, -177.03], [12.26, -195.03], [-35.74, -147.03], [-35.74, -105.03]],
  yingxi: [[-20, 175.5], [-48, 175.5], [-38.56, 172.76], [33.44, 172.76], [35, 188.4], [35, 192.8]],
};
/** Designed walk surface along the already-authored optional route. The scene's
 * questOrder-only gamePaths do NOT render this link; this is explicit ground
 * completion, never a new surveyed road, obstacle, or navigation destination. */
export const HUYU_ARRIVAL_WALK_CONNECTION = {
  points: [[12.26,-195.03],[-35.74,-147.03],[-35.74,-105.03]] as readonly Point2[],
  width: 2.4,
  elevation: .03,
};

// Paired broad shoulders establish continuity without inventing a mapped road.
export const ARRIVAL_GROUND: Record<CampusId, readonly Rect[]> = {
  huyu: [[-10,-203,-8,-164],[36,-203,38,-164],[-10,-204,38,-202],[-10,-165,38,-163],
    [12.8,-164,15.8,-145],[20.7,-164,23.7,-145],[-38,-150,23.7,-148.5],[-38,-145,-37.2,-136],[-34.2,-145,-33.4,-136]],
  yingxi: [[-51.5,171,-28.8,172.5],[-51.5,178.7,-28.8,180.2],[-38.5,169.5,34,171.5],
    [-38.5,174.1,34,176.1],[31.4,176.1,33.3,188.4],[36.7,176.1,38.6,188.4]],
};
const TREE_SITES: Record<CampusId, readonly Point2[]> = {
  huyu: [[-4,-198],[32,-198],[-4,-169],[32,-169],[5,-154],[33,-154]],
  yingxi: [[-36,182],[-8,181],[7,179],[21,202],[45,178],[-35,199]],
};
const BED_SITES: Record<CampusId, readonly Point2[]> = {
  huyu: [[-6,-195],[-6,-181],[-6,-171],[34,-195],[34,-179],[34,-168],[10,-155],[27,-155],[-10,-199],[-11,-185],[-11,-169],[38,-199],[39,-166],[5,-160]],
  yingxi: [[-45,182],[-35,181],[-12,178],[0,178],[11,177],[21,175],[29,185],[41,184],[-40,184],[-35,187],[-8,187],[1,181],[9,182],[43,183]],
};
function inside(p: Point2, polygon: Point2[]): boolean {
  let yes = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if ((a[1]>p[1]) !== (b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) yes=!yes;
  }
  return yes;
}
function segmentDistance(p: Point2,a: Point2,b: Point2): number {
  const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;
  const t=l?THREE.MathUtils.clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l,0,1):0;
  return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);
}
function edgeDistance(p: Point2, polygon: Point2[]): number {
  return Math.min(...polygon.map((a,i)=>segmentDistance(p,a,polygon[(i+1)%polygon.length])));
}
/** Conservative whole-envelope admission, including road edges rather than only centerlines. */
export function arrivalSiteIsClear(data: CampusData, x:number,z:number,radius:number, vegetation=true): boolean {
  const p:Point2=[x,z];
  if (!inside(p,data.boundary)||edgeDistance(p,data.boundary)<radius) return false;
  if (data.features.some(f=>f.kind==='building'&&(inside(p,f.polygon)||edgeDistance(p,f.polygon)<radius+.3))) return false;
  if (!vegetation) return true;
  const lines=[...data.roads.map(r=>({points:r.points,margin:r.width/2+.65})),
    ...Object.values(data.routes).map(points=>({points,margin:2})),
    {points:[...ARRIVAL_ROUTES[data.id]],margin:2.1}];
  if (lines.some(l=>l.points.slice(1).some((b,i)=>segmentDistance(p,l.points[i],b)<radius+l.margin))) return false;
  // Whole canopy/solid envelope excludes existing garden, platform/flight approach,
  // main entrance photo axis, and old courtyard trees. These are design safeguards.
  const zones:Rect[]=data.id==='yingxi'
    ? [[23,185,46.5,219],[49,168,78,242],[-53,172.5,-16,178.5]]
    : [[-8.5,-192,-1.5,-184.5],[25,-184,33,-175]];
  return !zones.some(([a,b,c,d])=>x+radius>a&&x-radius<c&&z+radius>b&&z-radius<d);
}
export function createCampusArrivalLandscape(data:CampusData, isClear?:(x:number,z:number,radius:number)=>boolean) {
  const visual=new THREE.Group(); visual.name=`${data.id}-arrival-designApproximation`;
  visual.userData.designApproximation=true;
  const positions:number[][]=[[],[],[]];
  const patches:{box:Rect;layer:number;y:number}[]=[];
  function rect(box:Rect,layer:number,y:number) { patches.push({box,layer,y}); }
  // Union each elevation/material before tessellation: crossing shoulders do not
  // produce coplanar duplicate faces. A clipped cell's full radius clears walls.
  function tessellate() {
    for(let layer=0;layer<3;layer++) {
      const list=patches.filter(p=>p.layer===layer); if(!list.length)continue;
      const xs=[...new Set(list.flatMap(p=>[p.box[0],p.box[2]]))].sort((a,b)=>a-b);
      const zs=[...new Set(list.flatMap(p=>[p.box[1],p.box[3]]))].sort((a,b)=>a-b);
      for(let i=1;i<xs.length;i++) for(let j=1;j<zs.length;j++) {
        const ax=xs[i-1],bx=xs[i],az=zs[j-1],bz=zs[j];
        if(!list.some(p=>(ax+bx)/2>=p.box[0]&&(ax+bx)/2<=p.box[2]&&(az+bz)/2>=p.box[1]&&(az+bz)/2<=p.box[3]))continue;
        for(let x=ax;x<bx-.001;x+=1)for(let z=az;z<bz-.001;z+=1){
          const xx=Math.min(x+1,bx),zz=Math.min(z+1,bz),y=list[0].y;
          if(!arrivalSiteIsClear(data,(x+xx)/2,(z+zz)/2,Math.hypot(xx-x,zz-z)/2,false))continue;
          positions[layer].push(x,y,z,x,y,zz,xx,y,z,xx,y,z,x,y,zz,xx,y,zz);
        }
      }
    }
  }
  for(const box of ARRIVAL_GROUND[data.id]) {
    rect(box,0,.035);
    // Narrow aggregate inlay, not a raised curb or a new movement obstacle.
    if(box[3]-box[1]>box[2]-box[0]) rect([box[0],box[1],box[0]+.18,box[3]],1,.042);
    else rect([box[0],box[1],box[2],box[1]+.18],1,.042);
  }
  const placements:NaturePlacement[]=[];
  function place(p:NaturePlacement):boolean {
    const box=getNaturePlacementBounds(p),[x,,z]=p.position;
    const radius=Math.max(Math.hypot(box.min.x-x,box.min.z-z),Math.hypot(box.max.x-x,box.max.z-z),Math.hypot(box.min.x-x,box.max.z-z),Math.hypot(box.max.x-x,box.min.z-z));
    if(!arrivalSiteIsClear(data,x,z,radius)||isClear&&!isClear(x,z,radius)) return false;
    // Keep new solid plant envelopes separate. Soft grass may sit beneath a
    // canopy, but still clears all circulation and protected photo envelopes.
    if(p.kind!=='grass'&&placements.some(q=>q.kind!=='grass'&&getNaturePlacementBounds(q).intersectsBox(box))) return false;
    placements.push(p);return true;
  }
  TREE_SITES[data.id].forEach(([x,z],i)=>{
    const kind=i%3===1?'tree-tall':i%3===2?'tree-spreading':'tree-round';
    if(place({kind,position:[x,0,z],scale:kind==='tree-tall'?.62:1,rotationY:i*.72})) rect([x-1.6,z-1.6,x+1.6,z+1.6],2,.065);
  });
  BED_SITES[data.id].forEach(([x,z],i)=>{
    if(place({kind:'shrub',position:[x,0,z],scale:.68,rotationY:i*.47})) rect([x-1.1,z-1.1,x+1.1,z+1.1],2,.065);
    for(const dz of [-1.7,1.7]) place({kind:'grass',position:[x+.5,0,z+dz],scale:1.1,rotationY:i});
  });
  tessellate();
  if(data.id==='huyu') {
    const {points,width,elevation:y}=HUYU_ARRIVAL_WALK_CONNECTION;
    // A shared miter cross-section joins each adjacent pair exactly. Two separate
    // segment rectangles would leave a triangular hole or coplanar corner overlap.
    const normals=points.slice(1).map((b,i)=>{
      const a=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      return new THREE.Vector2(-(b[1]-a[1])/length,(b[0]-a[0])/length);
    });
    const edges=points.map((p,i)=>{
      const n=i===0?normals[0].clone():i===points.length-1?normals[i-1].clone():normals[i-1].clone().add(normals[i]).normalize();
      const offset=n.multiplyScalar(width/2/(i>0&&i<points.length-1?n.dot(normals[i]):1));
      return [[p[0]+offset.x,p[1]+offset.y],[p[0]-offset.x,p[1]-offset.y]] as [Point2,Point2];
    });
    for(let i=1;i<edges.length;i++) {
      const [al,ar]=edges[i-1],[bl,br]=edges[i];
      for(const p of [al,bl,ar,bl,br,ar]) positions[0].push(p[0],y,p[1]);
    }
    // Lower than all prior patches/hardscape: overlap hides the junction without
    // z-fighting or introducing a physical step. Same existing material/draw batch.
  }
  const materials=[0xbab7a5,0x7d8978,0x747958].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
  positions.forEach((p,i)=>{if(!p.length)return;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,materials[i]);mesh.receiveShadow=true;mesh.name=['arrival-mineral-shoulders','arrival-flush-edge','arrival-tree-beds'][i];visual.add(mesh);});
  const natureTriangles=placements.reduce((n,p)=>n+NATURE_MODEL_BOUNDS[p.kind].triangles,0);
  const metrics={natureTriangles,natureDrawBatches:new Set(placements.map(p=>p.kind)).size,groundTriangles:positions.reduce((n,p)=>n+p.length/9,0),groundDrawBatches:visual.children.length,placementCount:placements.length};
  let disposed=false;
  return {visual,placements,route:ARRIVAL_ROUTES[data.id],metrics,dispose(){
    if(disposed)return;disposed=true;visual.removeFromParent();
    visual.children.forEach(child=>{if(child instanceof THREE.Mesh)child.geometry.dispose();});
    materials.forEach(m=>m.dispose());visual.clear();
  }};
}
