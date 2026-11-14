import * as T from '../../../game/vendor/three.module.js';
// Approved retained-scene composition; not a recording. Call once on entry to a retained-fish cue, then hold result.
// No pose changes, actor resurrection, or claim of recorded events.
export function captureFishSideView(bay){
 bay.root.updateMatrixWorld(true);
 const center=new T.Box3().setFromObject(bay.fish).getCenter(new T.Vector3());
 const q=bay.fish.getWorldQuaternion(new T.Quaternion());
 const forward=new T.Vector3(1,0,0).applyQuaternion(q),side=new T.Vector3(0,0,1).applyQuaternion(q);
 return {position:center.clone().addScaledVector(forward,.35*1.9).addScaledVector(side,.94*1.9).add(new T.Vector3(0,.08,0)).toArray(),target:center.clone().add(new T.Vector3(0,.03,0)).toArray(),fov:32,subject:'retained-fish',thresholdVisible:true,boardingVisible:false,recording:false};
}
export function presentationSubject(cue){
 if(['realization','letter-end','silence'].includes(cue?.id)||cue?.shot==='actual-boat')return {subject:'retained-fish',thresholdVisible:true,boardingVisible:false};
 if(cue?.shot==='actual-fold')return {subject:'retained-paper-flow',thresholdVisible:true,boardingVisible:false};
 return {subject:'letter',thresholdVisible:false,boardingVisible:false};
}

// One capture per uninterrupted subject group. Exit clears even when no camera is requested.
export function createFishShotCache(capture=captureFishSideView){
 let held=null;
 return {sync(owner,cue){if(owner!=='echo'||presentationSubject(cue).subject!=='retained-fish')held=null;},
 sample(owner,cue,bay){this.sync(owner,cue);if(owner!=='echo'||presentationSubject(cue).subject!=='retained-fish')return null;return held??(held=capture(bay));},
 clear(){held=null}};
}
