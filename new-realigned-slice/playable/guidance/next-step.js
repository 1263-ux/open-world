import * as T from '../../../game/vendor/three.module.js';
import {BAY_OFFSET,BOARD_STAND} from '../dream-threshold.js';
import {PULL_TABS} from '../bay-art-v2/navigation.js';
import {CLOUD} from '../../../companion-bay-lookdev/model.js';
export function nextStep(state,player,{reading=false,aligning=false}={}){
 if(reading||aligning)return null;
 if(state.phase==='hidden')return{id:'letter',title:'去灯下看看那封信',detail:'走近信件右侧，按 E 拿起。',target:{x:-2.78,y:1,z:-3.64}};
 if(state.phase==='boarding')return{id:'boarding',title:'坐进纸船',detail:'接下来可以自由划行，陪小鱼看看周围。',target:null};
 if(state.phase==='revealing'||state.phase==='ready')return{id:'boat',title:'去看看那艘纸船',detail:'沿岸边走到踏板前端，按 E 登船。信件仍可重读。',target:{x:BOARD_STAND.x,y:.5,z:BOARD_STAND.z}};
 if(state.phase==='boating'){
  // Reuse the companion's existing arrival/slow-down decision. No new radius,
  // timer, completion flag or forced stop: leaving naturally restores guidance.
  if(state.fold?.connected&&state.companion?.mode==='watch-cloud')return null;
  if(state.fold?.connected)return{id:'cloud',title:'水路通了，带小鱼去看看云',detail:'可以继续自由划行；靠近云的倒影，停一会儿。',target:{x:CLOUD.x+BAY_OFFSET.x,y:.2,z:CLOUD.z+BAY_OFFSET.z}};
  if(state.fold?.phase==='folding')return{id:'flow',title:'看看水流的变化',detail:'仍可自由划行；靠近水路时可按住 F 观察。',target:{x:BAY_OFFSET.x,y:.5,z:BAY_OFFSET.z-4.3}};
  const tabs=PULL_TABS.map(p=>({x:p.x+BAY_OFFSET.x,y:.7,z:p.z+BAY_OFFSET.z}));tabs.sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));return{id:'fold',title:'绕到纸岸侧面，帮水流接上',detail:'停稳在纸岸拉片旁，按 E 拉平；不必撞向中间高台。',target:tabs[0]};
 }
 return null;
}
export function projectObjective(camera,target,player){
 if(!target)return null;camera.updateMatrixWorld(true);const world=new T.Vector3(target.x,target.y,target.z),local=world.clone().applyMatrix4(camera.matrixWorldInverse),ndc=world.clone().project(camera),behind=local.z>=0,onScreen=!behind&&Math.abs(ndc.x)<=.85&&Math.abs(ndc.y)<=.85;let direction;
 if(behind)direction=local.x>=0?'在身后，向右转动视角':'在身后，向左转动视角';
 else if(ndc.x<-.85)direction='在画面左侧';else if(ndc.x>.85)direction='在画面右侧';else if(ndc.y>.85)direction='在画面上方';else if(ndc.y<-.85)direction='在画面下方';else direction='就在前方';
 return{direction,behind,onScreen,ndc:[ndc.x,ndc.y],distance:Math.round(Math.hypot(target.x-player.x,target.z-player.z)),marker:{x:T.MathUtils.clamp(ndc.x*.5+.5,.07,.93)*100,y:T.MathUtils.clamp(-ndc.y*.5+.5,.18,.8)*100}};
}
export function letterHint(hasRead,needsApproach){return needsApproach?'走近信件右侧 · E':hasRead?'再读这封信 · E':'拿起信件 · E';}
