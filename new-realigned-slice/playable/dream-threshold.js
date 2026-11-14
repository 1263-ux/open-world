import {addPairedEye} from './companion-observation/paired-eyes.js';
import {applyOffsetDock} from '../../full-boarding-chain/layout.js';
import {createFishResponse} from './companion-observation/response.js';
import {addBoatWaterline} from './boat-waterline.js';
import {applyPaperHull} from '../../paper-boat-silhouette/shape.js';
import {hullClear,stepWholeBoat,reachablePullTab} from './bay-art-v2/navigation.js';
import {applyReadableFold} from './water-feedback/readable-fold.js';
import {createCompanionPlacement} from './environment-ab/companion-composition/placement.js';
import {applyBayArt} from './bay-art-v2/art.js';
import * as T from '../../game/vendor/three.module.js';
import {makeBay} from '../../companion-bay-lookdev/scene.js';
import {createCompanion,createPaperFold,navigable,HINGE} from '../../companion-bay-lookdev/model.js';

// Agent-designed opening continuation, not a rewrite of CH01 or a final chapter ending.
export const BAY_OFFSET=Object.freeze({x:2,z:-19});
export const BOARD_STAND=Object.freeze({x:2.4,y:.08,z:-12.12});
export const DOCK_LOCAL=Object.freeze({x:0,z:5.9,heading:Math.PI/2,speed:0});
const DOCK_OBSTACLES=[{x:-1.25,z:6.9,w:.34,d:.38},{x:0,z:8.45,w:2.6,d:2.9},{x:0,z:7.05,w:.8,d:.7}];
export const BOARD_DURATION=2.3;
export const REVEAL_DURATION=3.2;
export const toBay=(p)=>({...p,x:p.x-BAY_OFFSET.x,z:p.z-BAY_OFFSET.z});
export const fromBay=(p)=>({...p,x:p.x+BAY_OFFSET.x,z:p.z+BAY_OFFSET.z});
export const bayNavigableWorld=(x,z)=>navigable(x-BAY_OFFSET.x,z-BAY_OFFSET.z);

export function createDreamThreshold(scene,{companionForward=true,boardingView=null}={}){
 const root=new T.Group();root.name='DreamThreshold_after_letter';scene.add(root);
 const bay=makeBay(root,{showCourier:false});addPairedEye(bay.fish);bay.root.position.set(BAY_OFFSET.x,0,BAY_OFFSET.z);bay.root.visible=false;
 // Opening-specific shore treatment: retain tested playable footprint, remove exhibition plinth styling.
 for(const o of bay.root.children){const g=o.geometry;if(!g)continue;if(g.type==='CylinderGeometry'&&g.parameters.radiusTop===10)o.visible=false;if(g.type==='SphereGeometry'&&g.parameters.radius===.48)o.visible=false;if(g.type==='BoxGeometry'&&g.parameters.width===4.5&&g.parameters.depth===5.7){o.material=o.material.clone();o.material.color.setHex(0x9eafb2);o.scale.y=.45;o.position.y=-.05;}}
 const positions=[],colors=[],indices=[],rings=16,segments=80;
 const waterColor=new T.Color(0x9dafb4);
 for(let r=0;r<=rings;r++)for(let i=0;i<=segments;i++){const k=r/rings,a=i/segments*Math.PI*2;positions.push(Math.cos(a)*10*k,-.054,Math.sin(a)*8*k);const alpha=k<.78?.78:.78*(1-(k-.78)/.22);colors.push(waterColor.r,waterColor.g,waterColor.b,Math.max(0,alpha));if(r<rings&&i<segments){const n=r*(segments+1)+i;indices.push(n,n+1,n+segments+1,n+1,n+segments+2,n+segments+1);}}
 const waterGeometry=new T.BufferGeometry();waterGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));waterGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,4));waterGeometry.setIndex(indices);waterGeometry.computeVertexNormals();
 const quietWater=new T.Mesh(waterGeometry,new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,transparent:true,opacity:1,depthWrite:false,roughness:.67,side:T.DoubleSide}));quietWater.name='Shallow_water_fading_edge_not_plinth';bay.root.add(quietWater);
 const art=applyBayArt(bay);
 // Same tested navigation envelope; actual folded skin replaces the box prow.
 const paperHull=applyPaperHull(bay.boat);addBoatWaterline(bay.boat);
 // The fish belongs in the traveller's field of view, with the complete support.
 const companionPlacement=createCompanionPlacement(bay);companionPlacement.setEnabled(companionForward);
 const readableWater=applyReadableFold(bay);
 const landingMesh=new T.Mesh(new T.BoxGeometry(.8,.08,.7),new T.MeshStandardMaterial({color:0xb4b6ae,roughness:.9}));landingMesh.name='Actual_boarding_step';landingMesh.position.set(2,-.12,-11.95);root.add(landingMesh);
 const dock=applyOffsetDock({root,landingMesh});
 const companion=createCompanion(),paper=createPaperFold(),fishResponse=createFishResponse(bay);fishResponse.update(0,false);
 const guide=new T.Group();guide.name='One_quiet_ink_trail';root.add(guide);guide.visible=false;
 const guideMat=new T.MeshStandardMaterial({color:0x9fc4c8,roughness:.75,transparent:true,opacity:0});
 const drops=[];for(let i=0;i<3;i++){const d=new T.Mesh(new T.SphereGeometry(.025,8,6),guideMat.clone());guide.add(d);drops.push(d);}
 const curve=new T.CubicBezierCurve3(new T.Vector3(-2.78,.987,-3.64),new T.Vector3(-2,1.6,-6),new T.Vector3(1.4,.65,-9.4),new T.Vector3(2,.2,-11.25));
 const fadeMaterials=new Map();bay.root.traverse(o=>{if(!o.isMesh)return;for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(!fadeMaterials.has(m))fadeMaterials.set(m,{opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite});});
 let phase='hidden',elapsed=0,boardPose=null,arrivalPending=null;
 function opacity(f){for(const[m,orig]of fadeMaterials){m.opacity=orig.opacity*f;m.transparent=f<1||orig.transparent;m.depthWrite=f<1?false:orig.depthWrite;}}
 function snapshot(){return{phase,revealed:phase!=='hidden',canSail:phase==='boating',revealProgress:phase==='hidden'?0:phase==='revealing'?Math.min(1,elapsed/REVEAL_DURATION):1,boardProgress:phase==='boarding'?Math.min(1,(boardingView?.snapshot().time??0)/BOARD_DURATION):phase==='boating'?1:0,fold:paper.snapshot(),companion:companion.snapshot()};}
 function canBoard(p){return phase==='ready'&&Math.hypot(p.x-BOARD_STAND.x,p.z-BOARD_STAND.z)<.75;}
 function canFold(p){const local=toBay(p);return phase==='boating'&&paper.snapshot().phase==='raised'&&!!reachablePullTab(local);}
 function reveal(){if(phase!=='hidden')return false;phase='revealing';elapsed=0;bay.root.visible=true;guide.visible=true;opacity(0);return true;}
 function startBoard(p,options){if(!canBoard(p)||!boardingView?.start(p,options))return false;phase='boarding';return true;}
 function takeArrival(){const a=arrivalPending;arrivalPending=null;return a;}
 function update(t,dt,player,{paused=false}={}){
  if(paused||!Number.isFinite(dt)||dt<0)return snapshot();
  if(phase==='revealing'){elapsed=Math.min(REVEAL_DURATION,elapsed+dt);const f=elapsed/REVEAL_DURATION;opacity(Math.min(1,f*1.6));drops.forEach((d,i)=>{const a=T.MathUtils.clamp(f*1.15-i*.08,0,1);d.position.copy(curve.getPoint(a));d.material.opacity=Math.sin(Math.PI*a)*.65;});if(f===1){phase='ready';elapsed=0;guide.visible=false;opacity(1);}}
  if(boardingView&&['boarding','boating'].includes(phase)){
   const bp=phase==='boating'&&player?{x:player.x,y:.06,z:player.z,heading:player.heading}:{...fromBay(DOCK_LOCAL),y:.06};
   const bs=boardingView.update(dt,{paused},bp);boardPose=bs.actorPose;
   const a=boardingView.takeArrival();if(a){phase='boating';arrivalPending=a;}
  }
  const local=phase==='boating'&&!arrivalPending&&player?toBay(player):DOCK_LOCAL;
  const state=companion.update(dt,local),fold=paper.update(dt);bay.update(t,local,state,fold);readableWater.update(t,fold.connected);fishResponse.update(dt,fold.connected);return snapshot();
 }
 // The preview contains only the reused paper boat/fish, never a duplicate proxy courier.
 bay.update(0,DOCK_LOCAL,companion.snapshot(),paper.snapshot());readableWater.update(0,false);
 return{root,bay,fishResponse,guide,readableWater,paperHull,occluders:art.environment,landingMesh,ground:dock.ground,boardingView,boardingStand:BOARD_STAND,approachWalkable:dock.walkable,wholeHullClear:(p)=>hullClear(p.x-BAY_OFFSET.x,p.z-BAY_OFFSET.z,p.heading,DOCK_OBSTACLES),stepBoat:(p,dt,input,yaw)=>stepWholeBoat(p,dt,input,yaw,BAY_OFFSET,DOCK_OBSTACLES),reveal,canBoard,canFold,startBoard,takeArrival,update,snapshot,getBoardPose:()=>boardPose&&({...boardPose}),foldAt(p){if(!canFold(p))return false;return paper.begin();},navigable:bayNavigableWorld,toLocal:toBay,toWorld:fromBay};
}
