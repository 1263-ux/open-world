export const START=Object.freeze({x:2.4,y:.06,z:-12.12,heading:Math.PI});
export const ARRIVAL=Object.freeze({x:2,y:.12415672093629837,z:-13.1,heading:Math.PI/2,boating:true});
export function createBoardingState({duration=2.3,alignDuration=.45}={}){
 if(!(duration>0&&alignDuration>0))throw Error('Invalid durations');
 let phase='idle',time=0,alignTime=0,from=null,alignment=null,arrival=null,suspended=false;
 const snapshot=()=>({phase,time,alignTime,suspended,alignment:alignment?{...alignment}:null,ownsActor:phase==='playing'||phase==='seated',controlsLocked:phase==='aligning'||phase==='playing'});
 return {snapshot,setSuspended(v){suspended=!!v;return snapshot()},
 start(p,{pathClear=false}={}){
  if(phase!=='idle'||suspended||!pathClear)return false;
  if(!p||![p.x,p.actorRootY,p.z,p.heading].every(Number.isFinite)||Math.hypot(p.x-START.x,p.z-START.z)>.35)return false;
  from={x:p.x,y:p.actorRootY,z:p.z,heading:p.heading};alignment={...from};phase='aligning';time=0;alignTime=0;return true;
 },
 cancelAlignment(){if(phase!=='aligning')return false;phase='idle';return true},
 update(dt,{paused=false,hidden=false,blurred=false}={}){
  if(suspended||paused||hidden||blurred||!Number.isFinite(dt)||dt<0)return snapshot();
  let remaining=dt;
  if(phase==='aligning'){
   const used=Math.min(remaining,alignDuration-alignTime);alignTime+=used;remaining-=used;const t=Math.min(1,alignTime/alignDuration),k=t*t*(3-2*t);
   alignment={x:from.x+(START.x-from.x)*k,y:from.y+(START.y-from.y)*k,z:from.z+(START.z-from.z)*k,heading:from.heading+Math.atan2(Math.sin(START.heading-from.heading),Math.cos(START.heading-from.heading))*k};
   if(t===1){alignment={...START};phase='playing'}
  }
  if(phase==='playing'){
   time=Math.min(duration,time+remaining);
   if(time===duration){phase='seated';arrival={...ARRIVAL}}
  }
  return snapshot();
 },takeArrival(){const event=arrival;arrival=null;return event?{...event}:null}};
}
