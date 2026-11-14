import {Controller} from '../game/controller.js';
// Isolated integration fork. Production host remains unchanged.
const presentationSubject=cue=>({thresholdVisible:['actual-fold','cloud-transit','fish-attention','fish-quiet-observed'].includes(cue?.shot)});
import{createLetterStudy}from'../chapter-letter-study/player.js';
import{createRiverClosureBridge}from'../river-route-candidate/revision3/event-adapter.mjs';
export function createChapterSession({gate,player,stationWalkable,stationColliders,groundAt,boarding,threshold,clearInput,restoreCamera,anchor={x:-2.4,z:-3.1,heading:Math.PI},saved}){
 const closure=createLetterStudy(saved),bridge=createRiverClosureBridge(closure,{gate});let owner='office',returned=closure.snapshot().collected,transition=0,token=null,relocated=false,veil=0,lastError=null;
 const stop=()=>{player.vx=player.vz=player.speed=player.accumulator=0;clearInput()};
 const snapshot=()=>({owner,returned,veil,lastError,locked:owner==='return'||owner==='echo',closure:closure.snapshot()});
 function restore(){owner='office';threshold.root.visible=false;boarding.setVisible(false);stop();restoreCamera();bridge.resetBaseline()}
 function checkAnchor(){try{const y=groundAt(anchor.x,anchor.z);if(!Number.isFinite(y)||!stationWalkable(anchor.x,anchor.z,false))return{ok:false,reason:'Return anchor has no actual station ground'};const probe=new Controller({walkable:stationWalkable,colliders:stationColliders});if(probe.blockedAt(anchor.x,anchor.z))return{ok:false,reason:'Return anchor blocked'};return{ok:true,y};}catch(e){return{ok:false,reason:'Return anchor validation failed: '+String(e?.message||e)};}}
 function cancelUnsafeReturn(reason){lastError=reason;closure.cancelReturn();token=null;owner='dream';transition=0;veil=0;relocated=false;stop();bridge.resetBaseline();return false;}
 function relocate(){const check=checkAnchor();if(!check.ok)return cancelUnsafeReturn(check.reason);player.walkable=stationWalkable;player.colliders=stationColliders;player.safeReset(anchor.x,anchor.z);Object.assign(player,{y:check.y,heading:anchor.heading,boating:false});boarding.setVisible(false);threshold.root.visible=false;stop();restoreCamera();bridge.resetBaseline();returned=true;relocated=true;if(!closure.arrive(token))throw Error('Return completion token rejected');return true;}

 return{closure,bridge,snapshot,
 enterDream(){if(owner!=='office'||returned)return false;owner='dream';bridge.resetBaseline();return true},
 letterCompleted(){bridge.letterCompleted()},
 requestReturn(){if(owner!=='dream'||!player.boating)return false;const check=checkAnchor();if(!check.ok){lastError=check.reason;return false;}lastError=null;token=closure.requestReturn();if(token===null)return false;owner='return';transition=0;relocated=false;stop();bridge.resetBaseline();return true},
 replay(){if(owner!=='office'||!closure.replay())return false;owner='echo';stop();return true},
 skip(){if(owner!=='echo'||!closure.skip())return false;restore();return true},
 update(dt,flags={}){
  closure.setSuspended(!!(flags.hidden||flags.blurred||flags.paused));
  if(flags.hidden||flags.blurred||flags.paused||!Number.isFinite(dt)||dt<0){bridge.sample(threshold,player,dt,flags);return snapshot()}
  if(owner==='dream')bridge.sample(threshold,player,dt,flags);
  if(owner==='return'){
   transition+=dt;veil=Math.min(1,transition/.65);
   if(transition>=.65&&!relocated&&!relocate())return snapshot();
   if(transition>1.05)veil=Math.max(0,1-(transition-1.05)/.65);
   if(transition>=1.7){veil=0;if(closure.startEcho())owner='echo';else restore()}
  }else if(owner==='echo'){
   closure.tick(dt,flags);if(closure.snapshot().phase==='free')restore();
  }
  return snapshot();
 },
 getCue(){const s=closure.snapshot();return owner==='echo'?s.cues[s.cueIndex]??null:null},
 syncVisibility(original,gestureActive=false){boarding.setVisible(owner==='dream'||(owner==='return'&&!relocated));original.visible=!gestureActive&&(owner==='office'||(owner==='dream'&&!boarding.snapshot().ownsActor)||(owner==='return'&&(relocated||!boarding.snapshot().ownsActor))||(owner==='echo'&&this.getCue()?.shot!=='child-attaches-sky-drawing'));if(owner==='echo'){const cue=this.getCue();threshold.root.visible=presentationSubject(cue).thresholdVisible}else if(owner==='office'&&returned)threshold.root.visible=false;},
 audioPhase(){return owner==='dream'?threshold.snapshot().phase:'hidden'},
 canRead(){return owner==='office'},canMove(){return owner==='office'||owner==='dream'}
 };
}
