// Render-domain boundary for the full-letter study. No renderer, storage or audio
// side effects. Host must render the returned scene/camera, not the old main scene.
export function createPresenter({camera, adapter, domains, subjects, transientRoots=[]}) {
 let saved=null, cueToken=null, cached=null;
 const release=()=>{if(saved){camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);camera.up.copy(saved.up);camera.fov=saved.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);}saved=null;cueToken=null;cached=null;for(const root of transientRoots)root.visible=false;try{adapter.dispose();}catch{/* Cleanup cannot suppress restoration or the original failure. */}};
 const fail=reason=>{release();return{ok:false,reason,render:false};};
 return {
  present(state){
   if(!state?.active){release();return{ok:true,active:false,render:false};}
   const cue=state.cues?.[state.cueIndex];if(!cue)return fail('active presentation has no cue');
   if(!saved)saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),up:camera.up.clone(),fov:camera.fov};
   // Sample every invocation even while paused: animation/time and domain must
   // agree with current cue. Retained dream cameras remain stable within a cue.
   let shot;try{shot=adapter.sample(cue,state.cueTime);}catch(error){return fail("shot binding threw: "+String(error?.message||error));}if(!shot?.ok)return fail(shot?.reason||"empty shot binding");
   const scene=domains[shot.renderDomain];if(!scene?.isScene)return fail('missing render scene: '+shot.renderDomain);
   const roots=subjects?.[cue.shot];
   if(!Array.isArray(roots)||!roots.length)return fail('missing shot subject ownership: '+cue.shot);
   for(const root of roots){let p=root;while(p&&p!==scene)p=p.parent;if(p!==scene)return fail('shot subject outside selected scene: '+cue.shot);}
   if(shot.isolateWorldLightsAndFog){
    if(roots.some(root=>!transientRoots.includes(root)))return fail('reality subject requires explicit transient cleanup ownership');
    const main=domains.office;
    if(scene===main||scene===domains['retained-dream'])return fail('reality requires a separate scene');
    if(scene.fog)return fail('reality scene must have its own no-fog presentation');
   }
   const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
   if(!vector(shot.position)||!vector(shot.target)||!Number.isFinite(shot.fov)||shot.fov<=0||shot.fov>=180)return fail('invalid shot transform');
   const dynamic=shot.renderDomain==='isolated-reality';
   if(state.token!==cueToken||!cached||dynamic){cueToken=state.token;cached={...shot,position:[...shot.position],target:[...shot.target]};}
   if(![...cached.position,...cached.target,cached.fov].every(Number.isFinite))return fail('invalid shot transform');
   camera.position.fromArray(cached.position);camera.fov=cached.fov;camera.lookAt(...cached.target);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
   return{ok:true,active:true,render:true,scene,camera,domain:shot.renderDomain,subject:shot.subject,caption:cue.text,token:state.token,paused:state.paused};
  },release,
  get active(){return saved!==null;}
 };
}
