import * as T from '../game/vendor/three.module.js';
import {captureFishSideView} from '../new-realigned-slice/playable/chapter-return/fish-shot.js';
const center=o=>{o.updateWorldMatrix(true,true);return new T.Box3().setFromObject(o).getCenter(new T.Vector3());};
export function createChildBinding(gltf){
 const clip=gltf.animations.find(x=>x.name==='Xiaoman_PlaceDrawing');if(!clip)throw Error('Missing Xiaoman_PlaceDrawing');
 const root=gltf.scene,mixer=new T.AnimationMixer(root),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();root.visible=false;
 return {root,mixer,action,duration:clip.duration};
}
export function createShotAdapter({bay,letter,drawing,child}){
 function sample(cue,seconds=0){
  if(child)child.root.visible=false;
  if(!cue||!Number.isFinite(seconds)||seconds<0)return{ok:false,reason:'invalid cue/time'};
  const shot=cue.shot;
  if(shot==='child-attaches-sky-drawing'){
   if(!child)return{ok:false,reason:'missing licensed child scene'};
   child.root.visible=true;child.action.enabled=true;child.action.paused=false;child.mixer.setTime(Math.min(seconds,child.duration-.0001));child.root.updateMatrixWorld(true);
   const p=child.root.localToWorld(new T.Vector3(1.6,1.65,2.2)),t=child.root.localToWorld(new T.Vector3(.05,1,-.12));
   return{ok:true,position:p.toArray(),target:t.toArray(),fov:48,subject:'authored-child-placing-original-drawing',clip:'Xiaoman_PlaceDrawing',clipTime:Math.min(seconds,child.duration-.0001),renderDomain:'isolated-reality',isolateWorldLightsAndFog:true};
  }
  if(['letter','office-keeps-drawing'].includes(shot)){
   const object=shot==='letter'?letter:drawing;if(!object)return{ok:false,reason:'missing actual '+shot+' entity'};
   const t=center(object),normal=new T.Vector3(0,shot==='letter'?1:0,shot==='letter'?0:1).applyQuaternion(object.getWorldQuaternion(new T.Quaternion()));return{ok:true,position:t.clone().addScaledVector(normal,1.15).add(new T.Vector3(.2,.08,.15)).toArray(),target:t.toArray(),fov:38,subject:shot,renderDomain:'office'};
  }
  if(shot==='actual-fold'){
   if(!bay?.flap)return{ok:false,reason:'missing real paper'};const t=center(bay.flap);
   return{ok:true,position:t.clone().add(new T.Vector3(4,2,2)).toArray(),target:t.toArray(),fov:48,subject:shot,renderDomain:'retained-dream'};
  }
  if(['cloud-transit','fish-attention','fish-quiet-observed'].includes(shot)){
   if(!bay?.fish||!bay?.boat)return{ok:false,reason:'missing retained fish/boat'};
   if(shot==='fish-quiet-observed')return{ok:true,...captureFishSideView(bay),renderDomain:'retained-dream',recording:false};
   const a=center(bay.fish),b=center(bay.boat),t=a.clone().lerp(b,.5);return{ok:true,position:t.clone().add(new T.Vector3(3,1.8,3)).toArray(),target:t.toArray(),fov:48,subject:shot,renderDomain:'retained-dream',recording:false,posesUnchanged:true};
  }
  return{ok:false,reason:'unbound shot '+shot};
 }
 return{sample,dispose(){if(child)child.root.visible=false;}};
}
