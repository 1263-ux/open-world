import * as T from '../../../game/vendor/three.module.js';
// Post-bay.update pose layer only. No progression, navigation or companion writes.
export function createFishResponse(bay){
 let previous=null,consumed=false,elapsed=0,active=false;
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 function update(dt,connected,{paused=false}={}){
  if(paused||!Number.isFinite(dt)||dt<0)return snapshot();
  if(previous===false&&connected&&!consumed){consumed=true;active=true;elapsed=0;}
  previous=!!connected;
  if(!active)return snapshot();
  elapsed=Math.min(2.2,elapsed+dt);if(elapsed>=2.2-1e-9){elapsed=2.2;active=false;return snapshot();}
  // Read actual current geometry and transform it into the fish bowl frame.
  bay.root.updateMatrixWorld(true);const fall=bay.readableFold.fall;
  const target=new T.Box3().setFromObject(fall).getCenter(new T.Vector3());
  bay.bowl.worldToLocal(target);target.y=0;if(target.lengthSq()<1e-8)return snapshot();target.normalize();
  const smooth=t=>{t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t)};
  const weight=elapsed<.5?smooth(elapsed/.5):elapsed<1.4?1:1-smooth((elapsed-1.4)/.8);
  // +X is the original model's face; rotation Y maps +X to (cos,0,-sin).
  const yaw=Math.atan2(-target.z,target.x);
  bay.fish.position.lerp(target.multiplyScalar(.07),weight);
  bay.fish.rotation.y+=wrap(yaw-bay.fish.rotation.y)*weight;
  return {...snapshot(),weight};
 }
 function snapshot(){return{previous,consumed,elapsed,active};}
 return{update,snapshot};
}
