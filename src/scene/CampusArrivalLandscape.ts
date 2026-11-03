import * as THREE from 'three';
import type { CampusData, CampusId, Point2 } from '../shared/contracts';
import { getNaturePlacementBounds, NATURE_MODEL_BOUNDS, type NaturePlacement } from './CampusNatureAssets';

/** Original landscape design, NOT surveyed campus paving or vegetation.
 * The authored shoulders sit below existing hardscape (.05); tree beds (.065) remain below roads (.09) and
 * quest paths (.11). Nothing in this module changes source geometry or physics.
 */
export const ARRIVAL_DESIGN_STATUS = 'designApproximation' as const;
type Rect = readonly [number, number, number, number];
type SurfacePatch = { id:string; polygon:readonly Point2[]; layer:0|1|2; elevation:number };
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

/** Shared miter sections keep the walk and its adjoining bands exactly aligned. */
function routeEdges(points:readonly Point2[],halfWidth:number):[Point2,Point2][] {
  const normals=points.slice(1).map((b,i)=>{
    const a=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    return new THREE.Vector2(-(b[1]-a[1])/length,(b[0]-a[0])/length);
  });
  return points.map((p,i)=>{
    const n=i===0?normals[0].clone():i===points.length-1?normals[i-1].clone():normals[i-1].clone().add(normals[i]).normalize();
    const offset=n.multiplyScalar(halfWidth/(i>0&&i<points.length-1?n.dot(normals[i]):1));
    return [[p[0]+offset.x,p[1]+offset.y],[p[0]-offset.x,p[1]-offset.y]];
  });
}
function rectangle([a,b,c,d]:Rect):Point2[] { return [[a,b],[c,b],[c,d],[a,d]]; }
function surface(id:string,layer:0|1|2,polygon:readonly Point2[],campus:CampusId):SurfacePatch {
  // Yingxi's existing park top is .025; Huyu's optional walk top is .03.
  // These distinct, flush levels avoid both hiding beneath the park and
  // coplanar overlays on any existing shoulder, apron, road or garden path.
  return {id,polygon,layer,elevation:(campus==='huyu'?[.024,.027,.022]:[.030,.032,.028])[layer]};
}
function huyuSurfaceRefinement():SurfacePatch[] {
  const spine:Point2[]=[[-9,-173.77],[-35.74,-147.03],[-35.74,-105.03]];
  const inner=routeEdges(spine,1.2),edge=routeEdges(spine,1.65),outer=routeEdges(spine,3.8);
  const patches:SurfacePatch[]=[];
  const add=(id:string,layer:0|1|2,polygon:readonly Point2[])=>patches.push(surface(id,layer,polygon,'huyu'));
  for(const side of [0,1] as const) {
    add(`diagonal-edge-${side}`,1,[inner[0][side],inner[1][side],edge[1][side],edge[0][side]]);
    add(`diagonal-open-ground-${side}`,2,[edge[0][side],edge[1][side],outer[1][side],outer[0][side]]);
  }
  add('west-edge-before-stop',1,[inner[1][0],[-36.94,-145],[-37.39,-145],edge[1][0]]);
  add('west-edge-after-stop',1,rectangle([-37.39,-139,-36.94,-105.03]));
  add('east-edge',1,[inner[1][1],inner[2][1],edge[2][1],edge[1][1]]);
  add('west-ground-before-stop',2,[edge[1][0],[-37.39,-145],[-39.54,-145],outer[1][0]]);
  add('west-ground-after-stop',2,rectangle([-39.54,-139,-37.39,-105.03]));
  add('east-open-ground',2,[edge[1][1],edge[2][1],outer[2][1],outer[1][1]]);
  // A six-metre opening in the west edge invites a stop beside, not on, the
  // through route. The ground field continues beyond it without new props.
  add('west-corner-open-ground',2,[[-47,-149],[-43,-153],[-39.54,-153],[-39.54,-131],[-44,-131],[-47,-134]]);
  add('west-corner-stop',0,[[-36.94,-145],[-43.5,-145],[-45.5,-143],[-45.5,-141],[-43.5,-139],[-36.94,-139]]);
  return patches;
}
/** Bounded original surface composition, never additional mapped roads.
 * Three existing material batches; no props, navigation or collision objects.
 * Existing upper hardscape wins at the small connecting overlaps. */
export const ARRIVAL_SURFACE_REFINEMENT:Record<CampusId,readonly SurfacePatch[]>={
  huyu:huyuSurfaceRefinement(),
  yingxi:[
    surface('mechanical-apron-north-ground',2,[[-50.8,168.6],[-38.5,168.6],[-38.5,171],[-43.1,171],[-47.1,172.2],[-50.8,172.2]],'yingxi'),
    surface('mechanical-apron-south-ground',2,rectangle([-50.8,180.2,-38.5,182.3]),'yingxi'),
    // Leave the mapped north/south road and its verge as the crossing material.
    ...([[-38.5,166.8,-29,169.5],[-21.5,166.8,29.5,169.5],[-38.5,176.1,-29,178.3],[-21.5,176.1,29.5,178.3]] as Rect[])
      .map((box,i)=>surface(`corridor-open-ground-${i}`,2,rectangle(box),'yingxi')),
    surface('garden-turn-forecourt',0,[[29.5,170],[38.5,170],[40.5,172],[40.5,179],[38.5,181],[31.4,181],[29.5,179]],'yingxi'),
    surface('garden-threshold-fan',0,[[31.4,181],[38.5,181],[39.5,185.4],[38.6,188.4],[31.4,188.4],[30.5,185.4]],'yingxi'),
    surface('garden-turn-outer-edge',1,[[38.5,170],[40.5,172],[40.5,179],[38.5,181],[38.25,180.75],[40.15,178.85],[40.15,172.15],[38.25,170.35]],'yingxi'),
    surface('garden-threshold-west-edge',1,[[31.4,181],[30.5,185.4],[31.4,188.4],[31.75,188.4],[30.86,185.39],[31.75,181]],'yingxi'),
    surface('garden-threshold-east-edge',1,[[38.5,181],[39.5,185.4],[38.6,188.4],[38.25,188.4],[39.14,185.39],[38.15,181]],'yingxi'),
  ],
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
function inside(p: Point2, polygon: readonly Point2[]): boolean {
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
function edgeDistance(p: Point2, polygon: readonly Point2[]): number {
  return Math.min(...polygon.map((a,i)=>segmentDistance(p,a,polygon[(i+1)%polygon.length])));
}
function segmentGap(a:Point2,b:Point2,c:Point2,d:Point2):number {
  const cross=(p:Point2,q:Point2,r:Point2)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  if(Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&
    Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]))&&
    cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0)return 0;
  return Math.min(segmentDistance(a,c,d),segmentDistance(b,c,d),segmentDistance(c,a,b),segmentDistance(d,a,b));
}
/** Exact whole-polygon admission, not merely vertex or centroid sampling.
 * Also rejects a building entirely enclosed by a proposed open-ground patch. */
export function arrivalSurfaceIsClear(data:CampusData,polygon:readonly Point2[]):boolean {
  if(polygon.length<3||polygon.some(p=>!p.every(Number.isFinite)||!inside(p,data.boundary)))return false;
  const gap=(other:readonly Point2[])=>Math.min(...polygon.map((a,i)=>Math.min(...other.map((b,j)=>segmentGap(a,polygon[(i+1)%polygon.length],b,other[(j+1)%other.length])))));
  if(gap(data.boundary)<.3)return false;
  return !data.features.some(f=>f.kind==='building'&&(polygon.some(p=>inside(p,f.polygon))||inside(f.polygon[0],polygon)||gap(f.polygon)<.3));
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
  for(const patch of ARRIVAL_SURFACE_REFINEMENT[data.id]) {
    if(!arrivalSurfaceIsClear(data,patch.polygon))continue;
    // One triangulation per complete authored patch, rather than a campus-wide
    // grid subdivision. Disjoint same-level patches share only their borders.
    const contour=patch.polygon.map(([x,z])=>new THREE.Vector2(x,-z));
    for(const face of THREE.ShapeUtils.triangulateShape(contour,[])) {
      const [a,b,c]=face.map(i=>patch.polygon[i]);
      const vertices=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1])>0?[a,b,c]:[a,c,b];
      for(const [x,z] of vertices)positions[patch.layer].push(x,patch.elevation,z);
    }
  }
  if(data.id==='huyu') {
    const {points,width,elevation:y}=HUYU_ARRIVAL_WALK_CONNECTION;
    // A shared miter cross-section joins each adjacent pair exactly. Two separate
    // segment rectangles would leave a triangular hole or coplanar corner overlap.
    const edges=routeEdges(points,width/2);
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
