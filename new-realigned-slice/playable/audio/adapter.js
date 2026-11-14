import {createAudio} from '../../../game/audio.js';

// One adapter per mounted game. No document/game writes; no automatic resume.
export function createSliceAudio({doc=globalThis.document, win=globalThis.window}={}) {
  const engine=createAudio();
  let status='off', pending=null, generation=0, disposed=false, paused=false;
  let focused=doc?.hasFocus?.() ?? true;
  const blocked=()=>disposed||paused||!focused||!!doc?.hidden;
  function stop(reason='off') {
    ++generation;engine.mute();status=disposed?'disposed':reason;
  }
  function enableFromGesture() {
    // Do not defer enable until a previous promise settles: user activation
    // would be lost and older engine resume completions can silence a new one.
    if(blocked()||pending)return Promise.resolve(false);
    if(status==='on')return Promise.resolve(true);
    const token=++generation;status='enabling';
    const result=engine.enable(); // synchronous call within the trusted handler
    pending=result;
    return result.then(ok=>{
      if(token!==generation||blocked())return false;
      status=ok?'on':'off';return ok;
    },()=>{if(token===generation)stop();return false;})
      .finally(()=>{if(pending===result)pending=null;});
  }
  function toggleFromGesture() {
    if(status==='on'||status==='enabling'){stop();return Promise.resolve(false);}
    return enableFromGesture();
  }
  const blur=()=>{focused=false;stop('suspended');};
  const focus=()=>{focused=true;};
  const visibility=()=>{if(doc?.hidden)stop('suspended');};
  win?.addEventListener('blur',blur);win?.addEventListener('focus',focus);
  doc?.addEventListener('visibilitychange',visibility);
  function update({phase='hidden',speed=0,paused:nextPaused=false}={}) {
    paused=!!nextPaused;
    if(blocked()){if(status==='on'||status==='enabling')stop('suspended');return;}
    // Accepted enable is intent, not proof of audio device output. Engine can
    // independently mute after an OS interruption; clicking off/on retries.
    if(status==='on')engine.update({zone:phase==='boating'?'river':'office',speed:Number.isFinite(speed)?Math.abs(speed):0});
  }
  function dispose() {
    if(disposed)return;disposed=true;stop();engine.dispose();
    win?.removeEventListener('blur',blur);win?.removeEventListener('focus',focus);
    doc?.removeEventListener('visibilitychange',visibility);
  }
  return {enableFromGesture,toggleFromGesture,disable:()=>stop(),update,dispose,
    snapshot:()=>({status,busy:!!pending,paused,focused}),
    cue:type=>status==='on'&&!blocked()?engine.cue(type):false};
}
