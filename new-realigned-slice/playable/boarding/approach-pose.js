import * as T from '../../../game/vendor/three.module.js';
import{clone}from'../../../game/vendor/SkeletonUtils.js';
// Blend the visible original skeleton after its normal mixer update. Never apply
// world-root tracks here: the validated approach owns translation/heading.
export function createApproachPose(gltf,original){
 const target=clone(gltf.scene),mixer=new T.AnimationMixer(target),clip=gltf.animations.find(c=>c.name==='FullBoarding');
 if(!clip)throw Error('FullBoarding required');mixer.clipAction(clip).play();mixer.setTime(0);target.updateMatrixWorld(true);
 const bindings=[];original.traverse(o=>{if(!o.isBone)return;const b=target.getObjectByName(o.name);if(!b?.isBone)throw Error('Missing approach bone '+o.name);bindings.push({o,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()})});
 mixer.stopAllAction();mixer.uncacheRoot(target);
 return{count:bindings.length,apply(snapshot){if(snapshot.phase!=='aligning')return;const t=Math.min(1,snapshot.alignTime/.45),k=t*t*(3-2*t);for(const{ o,p,q,s }of bindings){o.position.lerp(p,k);o.quaternion.slerp(q,k);o.scale.lerp(s,k)}original.updateMatrixWorld(true)}};
}
