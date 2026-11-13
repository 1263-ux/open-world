// Deterministic animation-time coordinator. No DOM, teleport, rig or story mutations.
export function createLetterAction({holdTime,duration,gripTime,releaseTime}){
 if(![holdTime,duration,gripTime,releaseTime].every(Number.isFinite)||!(0<=gripTime&&gripTime<=holdTime&&holdTime<releaseTime&&releaseTime<=duration))throw Error('Invalid letter animation timing');
 let phase='idle',time=0,closeRequested=false;
 const snapshot=()=>({phase,time,active:phase!=='idle',reading:phase==='holding',paperInHands:phase!=='idle'&&time>=gripTime&&time<releaseTime});
 return{snapshot,start(){if(phase!=='idle')return false;phase='pickup';time=0;closeRequested=false;return true;},close(){if(phase==='idle')return false;closeRequested=true;if(phase==='holding')phase='returning';return true;},update(dt,{paused=false}={}){if(paused||!Number.isFinite(dt)||dt<0)return snapshot();if(phase==='pickup'){time=Math.min(holdTime,time+dt);if(time===holdTime)phase=closeRequested?'returning':'holding';}else if(phase==='returning'){time=Math.min(duration,time+dt);if(time===duration){phase='idle';time=0;closeRequested=false;}}return snapshot();}};
}
