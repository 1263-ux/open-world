import {CONTRACT,outlet} from '../fold-causality-prototype/model.js';
import {mouthConnection,inside,boundaryDistance,rect,polygonGap} from '../river-connection-study/geometry.mjs';
import {hullPoints,hullClear,stepWholeBoat,reachablePullTab} from '../new-realigned-slice/playable/bay-art-v2/navigation.js';
import {navigable} from '../companion-bay-lookdev/model.js';
export {reachablePullTab};
export const extra=[{x:-1.25,z:6.9,w:.34,d:.38},{x:0,z:8.45,w:2.6,d:2.9},{x:0,z:7.05,w:.8,d:.7}];
// Convex clipped east basin, never a circular receiver. All coordinates bay-local.
let poly=Array.from({length:256},(_,i)=>[9.94*Math.cos(i*Math.PI/128),7.952*Math.sin(i*Math.PI/128)]);
for(const [axis,bound,sign] of [[0,2.55,1],[0,7.2,-1],[1,-6.95,1],[1,1.5,-1]]){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=sign*(a[axis]-bound),db=sign*(b[axis]-bound);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}poly=out;}
export const basin=poly;
export const feeder=[[0,-5.58],[0,-6.2],[1.7,-6.25],[3.8,-5.15]];
export const feederWidth=.36;
export function createGate(){let previous=false,open=false,edges=0;return{observe(s){const valid=s.phase==='flowing'&&Math.abs(s.angle-CONTRACT.foldedAngle)<.002&&mouthConnection(outlet({yaw:s.yaw,angle:s.angle})).connected;const rising=valid&&!previous;previous=valid;if(rising){open=true;edges++;}return{open,rising,edges,valid};},snapshot(){return{open,edges}}};}
const obstacles=[rect(0,0,4.5,5.7),rect(0,-4.3,2.3,2.6),...extra.map(o=>rect(o.x,o.z,o.w,o.d))];
export function clearance(p,open){const h=hullPoints(p.x,p.z,p.heading);let m=Math.min(...h.map(v=>inside(v,basin)?boundaryDistance(v,basin):-boundaryDistance(v,basin)),...obstacles.map(o=>polygonGap(h,o)),...h.map(([x,z])=>8*(Math.sqrt(.99)-Math.hypot(x/10,z/8))),8*(Math.sqrt(.91)-Math.hypot(p.x/10,p.z/8)),p.x-2.5);
if(!open)m=Math.min(m,-2.3-Math.max(...h.map(v=>v[1])));return {margin:m,valid:m>0&&navigable(p.x,p.z)&&hullClear(p.x,p.z,p.heading,extra)};}
// Candidate navigation is intersection, never replaces/removes original solids.
export function stepCandidate(c,dt,input,yaw,open){const a={x:c.x,z:c.z,heading:c.heading};stepWholeBoat(c,dt,input,yaw,{x:0,z:0},extra);const b={x:c.x,z:c.z,heading:c.heading};const turn=Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading));const bound=Math.hypot(b.x-a.x,b.z-a.z)+1.65*Math.abs(turn);const ca=clearance(a,open);if(!ca.valid||ca.margin<=bound||!clearance(b,open).valid){Object.assign(c,a);c.vx=c.vz=c.speed=0;c.blocked=true;return{accepted:false,bound,margin:ca.margin};}return{accepted:true,bound,margin:ca.margin};}
export function meshData(open){const polygon=open?basin:clipClosed(basin);return{positions:polygon.map(([x,z])=>[x,.15,z]),indices:polygon.slice(2).flatMap((_,i)=>[0,i+1,i+2]),feeder:open?feeder:[],feederMesh:open?feederMesh():{positions:[],indices:[]},feederWidth,open};}
function clipClosed(p){const out=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],da=-2.3-a[1],db=-2.3-b[1];if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+t*(b[0]-a[0]),-2.3]);}}return out;}

export function feederMesh(){const positions=[],indices=[];const tri=(a,b,c)=>{const n=positions.length;positions.push([a[0],.151,a[1]],[b[0],.151,b[1]],[c[0],.151,c[1]]);indices.push(n,n+1,n+2)};for(let i=0;i<feeder.length-1;i++){const a=feeder[i],b=feeder[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/l*feederWidth/2,nz=(b[0]-a[0])/l*feederWidth/2;const q=[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]];tri(q[0],q[1],q[2]);tri(q[0],q[2],q[3]);}for(const p of feeder)for(let j=0;j<32;j++)tri(p,[p[0]+.18*Math.cos(j*Math.PI/16),p[1]+.18*Math.sin(j*Math.PI/16)],[p[0]+.18*Math.cos((j+1)*Math.PI/16),p[1]+.18*Math.sin((j+1)*Math.PI/16)]);return{positions,indices};}
