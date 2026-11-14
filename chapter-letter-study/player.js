import {createChapterClosure} from '../new-realigned-slice/playable/chapter-return/closure.js';
import {fullLetterCues} from './cues.js';
// Completion/fact authority remains the existing closure. This wrapper never
// writes storage; host must retain its existing idempotent persistence boundary.
export function createLetterStudy(saved) {
 const base=createChapterClosure(saved);let cues=[],index=0,time=0,paused=false,suspended=false,active=false,events=[],serial=0,token=null,audio=null;
 function drainBase(overrides={}) { for(const e of base.drainEvents()) if(e.type!=='cue') events.push(e.type==='release-presentation'?{...e,...overrides}:e); }
 const current=()=>cues[index];
 const isPaused=()=>paused||suspended;
 function syncPause(before){const after=isPaused();base.setPaused(after);if(active&&audio&&before!==after)events.push({type:after?'audio-pause':'audio-resume',token});}
 function enterCue(){token=++serial;events.push({type:'cue',token,...current()});if(audio&&current().text)events.push({type:'audio-play',token,asset:audio[current().id].asset});}
 function stopAudio(){if(audio)events.push({type:'audio-stop',token});}
 function finish(skipped){if(!active)return false;stopAudio();active=false;paused=false;base.skip();drainBase({skipped});return true;}
 function start(replay,trackMap){
  if(active||suspended)return false;
  const s=base.snapshot(),f=replay?s.memoryFacts:s.facts;
  const full=!!(f?.letterRead&&f.sailed&&f.foldConnected&&f.cloudQualified);
  const proposed=full?fullLetterCues(f):null;
  if(trackMap&&(!full||proposed.some(c=>c.text&&(!trackMap[c.id]?.asset||!Number.isFinite(trackMap[c.id].seconds)||trackMap[c.id].seconds<=0))))return false;
  if(!(replay?base.replay():base.startEcho()))return false;
  const actual=base.snapshot();cues=proposed??actual.cues.map(c=>({...c}));audio=trackMap?JSON.parse(JSON.stringify(trackMap)):null;
  if(audio)cues=cues.map(c=>({...c,seconds:c.text?audio[c.id].seconds:c.seconds,voice:c.text?audio[c.id].asset:null,captionMode:'host-audio-position-required'}));
  index=0;time=0;paused=false;active=true;drainBase();enterCue();return true;
 }
 function advance(){stopAudio();index++;time=0;if(index===cues.length){index=Math.max(0,cues.length-1);finish(false);}else enterCue();}
 return {
  snapshot(){return {...base.snapshot(),cues:structuredClone(cues),cueIndex:index,cueTime:time,paused:isPaused(),manualPaused:paused,suspended,active,token,playbackMode:audio?'host-audio-position-required':'temporary-subtitles-no-voice'};},
  record(e){return base.record(e);},requestReturn(){const t=base.requestReturn();drainBase();return t;},arrive(t){const r=base.arrive(t);drainBase();return r;},cancelReturn(){const r=base.cancelReturn();drainBase();return r;},dismiss(){return base.dismiss();},
  startEcho({tracks=null}={}){return start(false,tracks);},replay({tracks=null}={}){return start(true,tracks);},
  setPaused(v){if(!active)return;const before=isPaused();paused=!!v;syncPause(before);},
  setSuspended(v){const before=isPaused();suspended=!!v;syncPause(before);},
  tick(dt,{hidden=false,blurred=false}={}){
   if(!active||isPaused()||hidden||blurred||!Number.isFinite(dt)||dt<0)return;
   // Voice-driven cue never advances from wall-clock estimates. Silent tail can.
   if(audio&&current().text)return;
   let left=dt;while(left>0&&active){const used=Math.min(left,current().seconds-time);time+=used;left-=used;if(time>=current().seconds)advance();if(audio&&active&&current().text)break;}
  },
  audioPosition({cueToken,seconds,ended=false},{hidden=false,blurred=false}={}){
   if(!audio||!active||isPaused()||hidden||blurred||cueToken!==token||!current().text||!Number.isFinite(seconds)||seconds<time||seconds<0||seconds>current().seconds+.25)return false;
   const tolerance=Math.min(.08,current().seconds*.02);
   if(ended&&seconds<current().seconds-tolerance)return false;
   time=Math.min(seconds,current().seconds);if(ended)advance();return true;
  },skip(){return finish(true);},drainEvents(){drainBase();const e=events;events=[];return e;},save(){return base.save();}
 };
}
