import * as T from '../../../game/vendor/three.module.js';
// A voluntary camera only. Original scene/character/controls remain untouched.
export function companionView(bay,lockedSide=null){
 bay.root.updateMatrixWorld(true);
 const bowl=bay.bowl.getWorldPosition(new T.Vector3());
 const water=new T.Box3().setFromObject(bay.readableFold.fall).getCenter(new T.Vector3());
 const direction=water.clone().sub(bowl);direction.y=0;direction.normalize();
 const side=new T.Vector3(-direction.z,0,direction.x);
 // Put the lateral eye on the side away from the actual character center.
 const body=bay.boat.getWorldPosition(new T.Vector3()).sub(bowl);
 const sign=lockedSide ?? (body.dot(side)>0?-1:1);
 const position=bowl.clone().addScaledVector(direction,-1.3).addScaledVector(side,.45*sign);position.y=bowl.y+.32;
 const target=bowl.clone().lerp(water,.32);target.y=bowl.y+.18;
 return{position:position.toArray(),target:target.toArray(),fov:52,side:sign};
}
export function transitionView(from,to,t){
 const u=T.MathUtils.clamp(t,0,1),k=u*u*(3-2*u),lerp=(a,b)=>a.map((v,i)=>v+(b[i]-v)*k);
 const position=lerp(from.position,to.position);position[1]+=Math.sin(Math.PI*k)*1.2;
 return{position,target:lerp(from.target,to.target),fov:from.fov+(to.fov-from.fov)*k};
}
export function createCompanionObservation(){
 let heldLast=false,lockedSide=null,origin=null,last=null,time=.8;
 return{snapshot:()=>({heldLast,lockedSide,time}),reset(){lockedSide=null;},sample(explore,bay,held,dt,current=null){
  let near;try{near=companionView(bay,lockedSide);}catch{return null;}if(held&&lockedSide===null)lockedSide=near.side;
  if(held!==heldLast){origin=current??last??explore;time=0;heldLast=held;if(!held)lockedSide=null;}
  if(Number.isFinite(dt)&&dt>=0)time=Math.min(.8,time+Math.min(dt,.1));
  const goal=held?near:explore;
  last=time<.8&&origin?transitionView(origin,goal,time/.8):goal;
  return{...last,active:held||time<.8,transitioning:time<.8};
 }};
}
