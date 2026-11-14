import {presentationSubject} from './fish-shot.js';
import{createChapterClosure}from'./closure.js';
import{createClosureBridge}from'./runtime-bridge.js';
export function createReturnHost({player,stationWalkable,stationColliders,groundAt,boarding,threshold,clearInput,restoreCamera,anchor={x:-2.4,z:-3.1,heading:Math.PI},saved}){
 const closure=createChapterClosure(saved),bridge=createClosureBridge(closure);let owner='office',returned=closure.snapshot().collected,transition=0,token=null,relocated=false,veil=0;
 const stop=()=>{player.vx=player.vz=player.speed=player.accumulator=0;clearInput()};
 const snapshot=()=>({owner,returned,veil,locked:owner==='return'||owner==='echo',closure:closure.snapshot()});
 function restore(){owner='office';threshold.root.visible=false;boarding.setVisible(false);stop();restoreCamera();bridge.resetBaseline()}
 function relocate(){const y=groundAt(anchor.x,anchor.z);if(y===null||!Number.isFinite(y)||!stationWalkable(anchor.x,anchor.z))throw Error('Return anchor has no actual station ground');player.walkable=stationWalkable;player.colliders=stationColliders;if(player.blockedAt(anchor.x,anchor.z))throw Error('Return anchor blocked');player.safeReset(anchor.x,anchor.z);Object.assign(player,{y,heading:anchor.heading,boating:false});boarding.setVisible(false);threshold.root.visible=false;stop();restoreCamera();bridge.resetBaseline();returned=true;relocated=true;if(!closure.arrive(token))throw Error('Return completion token rejected')}
 return{closure,bridge,snapshot,
 enterDream(){if(owner!=='office'||returned)return false;owner='dream';bridge.resetBaseline();return true},
 letterCompleted(){bridge.letterCompleted()},
 requestReturn(){if(owner!=='dream'||!player.boating)return false;token=closure.requestReturn();if(token===null)return false;owner='return';transition=0;relocated=false;stop();bridge.resetBaseline();return true},
 replay(){if(owner!=='office'||!closure.replay())return false;owner='echo';stop();return true},
 skip(){if(owner!=='echo'||!closure.skip())return false;restore();return true},
 update(dt,flags={}){
  if(flags.hidden||flags.blurred||flags.paused||!Number.isFinite(dt)||dt<0){bridge.sample(threshold,player,dt,flags);return snapshot()}
  if(owner==='dream')bridge.sample(threshold,player,dt,flags);
  if(owner==='return'){
   transition+=Math.min(dt,.25);veil=Math.min(1,transition/.65);
   if(transition>=.65&&!relocated)relocate();
   if(transition>1.05)veil=Math.max(0,1-(transition-1.05)/.65);
   if(transition>=1.7){veil=0;if(closure.startEcho())owner='echo';else restore()}
  }else if(owner==='echo'){
   closure.tick(Math.min(dt,.25),flags);if(closure.snapshot().phase==='free')restore();
  }
  return snapshot();
 },
 getCue(){const s=closure.snapshot();return owner==='echo'?s.cues[s.cueIndex]??null:null},
 syncVisibility(original,gestureActive=false){boarding.setVisible(owner==='dream'||(owner==='return'&&!relocated));original.visible=!gestureActive&&(owner==='office'||(owner==='dream'&&!boarding.snapshot().ownsActor)||(owner==='return'&&(relocated||!boarding.snapshot().ownsActor))||owner==='echo');if(owner==='echo'){const cue=this.getCue();threshold.root.visible=presentationSubject(cue).thresholdVisible}else if(owner==='office'&&returned)threshold.root.visible=false;},
 audioPhase(){return owner==='dream'?threshold.snapshot().phase:'hidden'},
 canRead(){return owner==='office'},canMove(){return owner==='office'||owner==='dream'}
 };
}
