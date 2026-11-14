import {INTRO} from '../../../game/narrative.js';
// Isolated chapter closure. Events must come from completed runtime actions,
// never buttons merely requesting them. No world, renderer, audio or storage writes.
export const SCHEMA='dpo-ch01-closure-3',MEMORY_ID='memory_ch01_sky_drawing';
const TEXT={hello:'你好，邮差。',cloud:'谢谢你带它去看了云。',talk:'我以前总觉得，小鱼一定很无聊。\n每次放学回来，我都会给它讲今天发生的事情。',rain:'今天下雨了，我想，如果它也能出去看看就好了。',listen:'后来我发现，其实它一直都在认真听。',afternoon:'谢谢你陪它度过了一个下午。',tomorrow:'明天放学，我还会给它讲故事的。'};
const fresh=()=>({schema:SCHEMA,facts:{letterRead:false,sailed:false,foldConnected:false,cloudEntered:false,cloudQualified:false,cloudStationarySeconds:0,cloudTransitSeconds:0},collected:false,memoryFacts:null,phase:'free',cueIndex:0,cueTime:0,paused:false});
const validFacts=f=>f&&['letterRead','sailed','foldConnected','cloudEntered','cloudQualified'].every(k=>typeof f[k]==='boolean')&&['cloudStationarySeconds','cloudTransitSeconds'].every(k=>Number.isFinite(f[k])&&f[k]>=0&&f[k]<=86400)&&(!f.sailed||f.letterRead)&&(!f.cloudEntered||f.sailed)&&(!f.cloudQualified||f.cloudEntered)&&(!f.cloudStationarySeconds&&!f.cloudTransitSeconds||f.cloudEntered)&&(!f.foldConnected||f.letterRead);
export function conservativeCues(f){
 // Transit is not evidence of looking, and elapsed seconds are never moral credit.
 // No "thanks for clouds/afternoon" until a separately reviewed semantic contract exists.
 if(!validFacts(f)||!f.letterRead)return[];
 if(!(f.sailed&&f.foldConnected&&f.cloudQualified))return[{id:'original-letter',text:INTRO,shot:'letter',seconds:20,voice:null,captionMode:'original-incoming-letter'}];
 const cues=[{id:'letter',text:TEXT.hello,shot:'letter',seconds:4}];
 if(f.foldConnected)cues.push({id:'fold',text:TEXT.talk,shot:'actual-fold',seconds:9});
 else cues.push({id:'letter-talk',text:TEXT.talk,shot:'letter',seconds:9});
 if(f.sailed)cues.push({id:'boat',text:TEXT.rain,shot:'actual-boat',seconds:7});
 // A factual stop sample can support a quiet fish shot, not proof of sufficient companionship.
 // No short-stop reenactment: durations are not recorded motion samples.
 cues.push({id:'realization',text:TEXT.listen,shot:'letter',seconds:6},{id:'letter-end',text:TEXT.tomorrow,shot:'letter',seconds:6},{id:'silence',text:'',shot:'letter',seconds:3});
 return cues.map(x=>({...x,voice:null,captionMode:'unvoiced-original-excerpts'}));
}
export function createChapterClosure(saved){
 let s=fresh(),restoreRejected=false;
 if(saved!==undefined){if(saved?.schema===SCHEMA&&validFacts(saved.facts)&&typeof saved.collected==='boolean'&&(!saved.collected||(validFacts(saved.memoryFacts)&&saved.memoryFacts.letterRead&&saved.memoryFacts.sailed&&saved.memoryFacts.foldConnected&&saved.memoryFacts.cloudQualified))&&['free','returning','echo-ready','echo'].includes(saved.phase)){
  s.facts={...saved.facts};s.collected=saved.collected;s.memoryFacts=saved.collected?{...saved.memoryFacts}:null;
  // Reload never resumes a transient movement or grabs camera. Host chooses a safe anchor.
 }else restoreRejected=true;}
 let cues=[],events=[],returnToken=null,serial=0,returned=false;
 const emit=e=>events.push(e),snap=()=>JSON.parse(JSON.stringify({...s,cues,restoreRejected,controlsLocked:s.phase==='returning'||s.phase==='echo'}));
 function finish(skipped){if(s.phase!=='echo')return false;s.phase='free';s.paused=false;s.cueIndex=s.cueTime=0;if(!s.collected&&s.facts.letterRead&&s.facts.sailed&&s.facts.foldConnected&&s.facts.cloudQualified&&returned){s.collected=true;s.memoryFacts={...s.facts};emit({type:'collected',id:MEMORY_ID,basis:'continuous-cloud-entry-and-active-return-no-dwell-score'});}emit({type:'release-presentation',skipped});return true;}
 return{snapshot:snap,drainEvents(){const x=events;events=[];return x;},
 record(event){if(s.phase!=='free'||!event||typeof event.type!=='string')return false;const f=s.facts;
  if(event.type==='letter-read-completed'){f.letterRead=true;return true;}
  if(event.type==='sailing-observed'&&f.letterRead&&Number.isFinite(event.distance)&&event.distance>0){f.sailed=true;return true;}
  if(event.type==='fold-connected-observed'&&f.letterRead){f.foldConnected=true;return true;}
  if(event.type==='cloud-route-invalidated'){return false;} // Historical verified arrival is monotonic.
  if(event.type==='cloud-entry-validated'&&f.sailed){f.cloudEntered=true;f.cloudQualified=true;return true;}
  if(event.type==='cloud-sample'&&f.sailed&&event.inside===true&&Number.isFinite(event.dt)&&event.dt>0&&event.dt<=.25&&Number.isFinite(event.speed)&&event.speed>=0&&!event.paused&&!event.hidden&&!event.blurred){f.cloudEntered=true;const key=event.speed<.15?'cloudStationarySeconds':'cloudTransitSeconds';f[key]=Math.min(86400,f[key]+event.dt);return true;}
  return false;
 },
 requestReturn(){if(s.phase!=='free')return null;returned=false;s.phase='returning';returnToken=++serial;emit({type:'request-return-transition',token:returnToken,skipAllowed:true});return returnToken;},
 arrive(token){if(s.phase!=='returning'||token!==returnToken)return false;returnToken=null;returned=true;s.phase=s.facts.letterRead?'echo-ready':'free';emit({type:'restore-safe-office',controlsLocked:false});return true;},
 cancelReturn(){if(s.phase!=='returning')return false;returnToken=null;s.phase='free';emit({type:'cancel-return-restore-free'});return true;},
 startEcho(){if(s.phase!=='echo-ready')return false;cues=conservativeCues(s.facts);if(!cues.length){s.phase='free';return false;}s.phase='echo';s.cueIndex=s.cueTime=0;s.paused=false;emit({type:'cue',...cues[0]});return true;},
 dismiss(){if(s.phase!=='echo-ready')return false;s.phase='free';return true;},
 replay(){if(s.phase!=='free'||!s.collected||!s.memoryFacts)return false;cues=conservativeCues(s.memoryFacts);s.phase='echo';s.cueIndex=s.cueTime=0;s.paused=false;emit({type:'cue',...cues[0]});return true;},
 setPaused(v){s.paused=!!v;},
 tick(dt,{hidden=false,blurred=false}={}){if(s.phase!=='echo'||s.paused||hidden||blurred||!Number.isFinite(dt)||dt<0||dt>1)return;let left=dt;while(left>0&&s.phase==='echo'){const used=Math.min(left,cues[s.cueIndex].seconds-s.cueTime);left-=used;s.cueTime+=used;if(s.cueTime>=cues[s.cueIndex].seconds){s.cueIndex++;s.cueTime=0;if(s.cueIndex===cues.length)finish(false);else emit({type:'cue',...cues[s.cueIndex]});}}},
 skip(){return finish(true);},
 save(){return JSON.parse(JSON.stringify(s));}
 };
}
export function saveClosure(storage,key,state){if(key!=='dream-post-office-ch01-closure-study-v3')return{ok:false,reason:'isolated-key-required'};try{storage.setItem(key,JSON.stringify(state.save()));return{ok:true};}catch{return{ok:false,reason:'storage-unavailable'};}}
