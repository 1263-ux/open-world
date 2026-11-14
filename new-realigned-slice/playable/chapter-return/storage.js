const KEY='dream-post-office-ch01-memory-v1';
// Persist only an earned drawing and its immutable factual basis, never actor,
// camera or transient boarding/return position. Failure leaves this session usable.
export function createMemoryStorage(win=globalThis){let attempted=false;return{
 load(){try{const text=win.localStorage.getItem(KEY);if(!text)return undefined;const x=JSON.parse(text);return x?.collected===true?x:undefined}catch{return undefined}},
 saveIfCollected(closure){if(attempted||!closure.snapshot().collected)return false;attempted=true;try{const s=closure.save();s.phase='free';s.cueIndex=s.cueTime=0;s.paused=false;win.localStorage.setItem(KEY,JSON.stringify(s));return true}catch{return false}}
};}
