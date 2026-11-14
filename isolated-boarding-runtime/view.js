import * as T from '../game/vendor/three.module.js';
import{clone}from'../game/vendor/SkeletonUtils.js';
import{holdRepairedSeat}from'../full-boarding-chain/seat-hold.js';
import{createBoardingState}from'./state.js';
export function createBoardingView(gltf,{originalCourier=null}={}){
 const clip=gltf.animations.find(c=>c.name==='FullBoarding');if(!clip||Math.abs(clip.duration-2.3)>.00001)throw Error('Validated FullBoarding clip required');
 const root=new T.Group();root.name='IsolatedBoardingView';const model=clone(gltf.scene);root.add(model);const mixer=new T.AnimationMixer(model),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;
 const state=createBoardingState({duration:clip.duration});let presentation=true,hold=null,disposed=false,lastBoat={x:2,y:.06,z:-13.1,heading:Math.PI/2};
 const sync=()=>{const s=state.snapshot();root.visible=presentation&&s.ownsActor;if(originalCourier)originalCourier.visible=presentation&&!s.ownsActor;return s};sync();
 function sample(time){action.reset().play();mixer.setTime(time);model.updateMatrixWorld(true)}
 return {root,model,
 snapshot:state.snapshot,
 start(p,options){if(disposed)return false;const ok=state.start(p,options);sync();return ok},
 cancelAlignment(){const ok=state.cancelAlignment();sync();return ok},
 setSuspended(v){state.setSuspended(v)},
 setVisible(v){presentation=!!v;sync()},
 update(dt,flags={},boatPose=null){
  if(disposed)throw Error('Boarding view disposed');const s=state.update(dt,flags);const frozen=s.suspended||flags.paused||flags.hidden||flags.blurred||!Number.isFinite(dt)||dt<0;
  if(!frozen){
   if(boatPose)lastBoat={...boatPose};
   if(s.phase==='playing')sample(s.time);
   if(s.phase==='seated'){
    if(!hold){sample(clip.duration);hold=holdRepairedSeat(model,mixer,action,lastBoat);root.add(hold.carrier)}else hold.update(lastBoat);
   }
  }
  sync();root.updateMatrixWorld(true);return {...s,actorPose:s.ownsActor?(()=>{const o=model.getObjectByName('Hop_root_kinematic'),v=o.getWorldPosition(new T.Vector3());return{x:v.x,y:v.y,z:v.z}})():s.alignment};
 },
 takeArrival:state.takeArrival,
 dispose(){if(['aligning','playing'].includes(state.snapshot().phase))return false;if(disposed)return true;mixer.stopAllAction();mixer.uncacheRoot(model);root.removeFromParent();if(originalCourier)originalCourier.visible=presentation&&state.snapshot().phase==='idle';disposed=true;return true}
 };
}
