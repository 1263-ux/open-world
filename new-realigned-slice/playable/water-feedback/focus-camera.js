// Hold-to-observe camera: never changes navigation, free orbit or the supplied pose.
// Mirrored about the actual water-channel center x=2; validated as a local study.
export function paperWaterFocus(explore,weight=0,side='right'){
 const k=Math.min(1,Math.max(0,Number.isFinite(weight)?weight:0));
 if(k===0)return{position:[...explore.position],target:[...explore.target],fov:explore.fov};
 const position=side==='left'?[-4,2.7,-26.7]:[8,2.7,-26.7],target=side==='left'?[.9,.7,-22.5]:[3.1,.7,-22.5];
 const lerp=(a,b)=>a.map((x,i)=>x+(b[i]-x)*k);
 return {position:lerp(explore.position,position),target:lerp(explore.target,target),fov:explore.fov+(48-explore.fov)*k};
}
// Select once on entry. Crossing x=2 during one hold never flips the camera.
// Release, unavailable focus or explicit blur/reset ends this observation session.
export function createPaperWaterObservation(){
 let side=null;
 return{get side(){return side;},reset(){side=null;},sample(explore,held,playerX){
  if(!held){side=null;return paperWaterFocus(explore,0);}
  if(side===null)side=Number.isFinite(playerX)&&playerX<2?'left':'right';
  return paperWaterFocus(explore,1,side);
 }};
}
export function waterFocusAvailable(player,state){return !!player.boating && state.phase==='boating' && Math.hypot(player.x-2,player.z+22.45)<5;}
