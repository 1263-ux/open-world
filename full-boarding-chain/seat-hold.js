import * as T from '../game/vendor/three.module.js';
// Isolated adapter contract. Not connected to production main.js.
export function holdRepairedSeat(model,mixer,action,boatPose){
 if(action.getClip().name!=='FullBoarding')throw Error('Wrong clip for repaired hold');
 action.reset().play();mixer.setTime(action.getClip().duration);action.paused=true;
 const carrier=new T.Group();carrier.name='RepairedSeat_BoatCarrier';
 carrier.add(model);model.position.set(-2,0,13.1);model.rotation.set(0,0,0);model.scale.set(1,1,1);
 const update=(p)=>{carrier.position.set(p.x,(p.y??.06)-.06,p.z);carrier.rotation.y=p.heading-Math.PI/2;carrier.updateMatrixWorld(true)};update(boatPose);
 return{carrier,update};
}
