import{nextStep}from'./next-step.js';
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
// Per game mount, not save/reward state. Feed only accepted pointer orbit changes.
export function createFoldOrbitGuidance({angleThreshold=.45}={}){
 let learned=false,finished=false,anchor=null,last=null;
 function interrupt(){anchor=null;last=null;}
 function orbit(before,after,{blurred=false,hidden=false,paused=false,observing=false}={}){
  if(blurred||hidden||paused||observing||!Number.isFinite(before)||!Number.isFinite(after)){interrupt();return false;}
  if(learned||finished)return false;
  if(last===null||Math.abs(angle(before-last))>1e-6){anchor=before;}
  last=after;if(Math.abs(angle(after-anchor))>=angleThreshold){learned=true;return true;}return false;
 }
 function update(state,player,{canFold=false,touch=false,reading=false,aligning=false,blurred=false,hidden=false,paused=false}={}){
  if(state.fold?.connected||state.fold?.phase==='folding')finished=true;
  const base=nextStep(state,player,{reading,aligning});
  if(blurred||hidden||paused){interrupt();return{objective:base,override:false,hint:null};}
  const offer=!learned&&!finished&&canFold&&state.phase==='boating'&&state.fold?.phase==='raised'&&base?.id==='fold';
  if(!offer)return{objective:base,override:false,hint:null};
  return{objective:{...base,detail:touch?'拖动画面看上游，再点下方按钮折纸引水。':'拖动画面看上游，再按 E 折纸引水。'},override:true,hint:touch?'折纸引水':'折纸引水 · E'};
 }
 return{update,orbit,interrupt,snapshot:()=>({learned,finished})};
}
