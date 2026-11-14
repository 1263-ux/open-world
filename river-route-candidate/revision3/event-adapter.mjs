import {clearance} from '../revision2/model.mjs';
// Replace the old proximity bridge, never run both. Shared validated gate owns opening.
export function createRiverClosureBridge(closure,{gate}){if(!gate?.snapshot)throw Error('Shared validated river gate required');let previous=null,channelEntered=false,delivered=closure.snapshot().facts.cloudQualified===true,foldObserved=closure.snapshot().facts.foldConnected===true;const reset=()=>{previous=null;channelEntered=false;};
return{letterCompleted(){return closure.record({type:'letter-read-completed'});},resetBaseline:reset,snapshot(){return{channelEntered,delivered,foldObserved};},sample(threshold,p,dt,{paused=false,hidden=false,blurred=false}={}){
 const s=threshold.snapshot(),q=threshold.toLocal(p),open=gate.snapshot().open===true;
 if(paused||hidden||blurred||!Number.isFinite(dt)||dt<=0||dt>.25||![q.x,q.z,q.heading,p.speed].every(Number.isFinite)||s.phase!=='boating'||p.boating!==true||!clearance(q,open).valid){reset();return;}
 const target=q.x>=4.9&&q.x<=6.3&&q.z>=-1.4&&q.z<=.5,channel=q.x>=4.95&&q.z>=-5.8&&q.z<-2;
 const now={x:q.x,z:q.z,target};if(previous&&Math.hypot(now.x-previous.x,now.z-previous.z)>dt*10){reset();return;}
 if(open&&!foldObserved){if(closure.record({type:'fold-connected-observed'}))foldObserved=true;}
 if(!previous){previous=now;return;}
 const distance=Math.hypot(now.x-previous.x,now.z-previous.z);if(distance>0)closure.record({type:'sailing-observed',distance});
 if(open&&channel&&distance>0)channelEntered=true;
 if(!delivered&&open&&channelEntered&&!previous.target&&target&&distance>0){if(closure.record({type:'cloud-entry-validated'}))delivered=true;}
 if(delivered&&target)closure.record({type:'cloud-sample',inside:true,dt,speed:Math.abs(p.speed)});
 previous=now;
}};}
