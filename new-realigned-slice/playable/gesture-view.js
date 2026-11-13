import * as T from '../../game/vendor/three.module.js';
// ReadLetter is an independent local-space character+paper scene, not a second moving player.
export function createGestureView(gltf,contract){
 const root=gltf.scene;root.position.fromArray(contract.standingThree);root.scale.setScalar(contract.actorScale);root.rotation.y=contract.yawThree;const mixer=new T.AnimationMixer(root),clip=gltf.animations.find(c=>c.name===contract.clipName);if(!clip)throw Error('ReadLetter clip missing');const action=mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const body=[],paper=[];root.traverse(o=>{if(!o.isMesh)return;let a=o,isPaper=false;while(a){if(a.name===contract.paperNode)isPaper=true;a=a.parent;} (isPaper?paper:body).push(o);o.castShadow=true;o.receiveShadow=true;});if(!paper.length||!body.length)throw Error('ReadLetter paper/body split invalid');
 function sample(time,active){action.enabled=true;action.paused=false;action.play();mixer.setTime(Math.max(0,Math.min(clip.duration,time)));body.forEach(o=>o.visible=active);paper.forEach(o=>o.visible=true);root.updateMatrixWorld(true);}
 sample(0,false);return{root,sample,body,paper,clip};
}
export function hideReplacedLetter(world){const hidden=[];world.traverse(o=>{const n=o.name.replaceAll('_',' ');if(n==='Warm unsent letter'||/^Original (small fish|fish bubble)/.test(n)){o.visible=false;hidden.push(o.name);}});return hidden;}
export function alignmentClear(player,standing,groundHeight){for(let i=0;i<=12;i++){const t=i/12,x=player.x+(standing[0]-player.x)*t,z=player.z+(standing[2]-player.z)*t;if(player.blockedAt(x,z)||groundHeight(x,z)===null)return false;}return true;}
