import {createSliceAudio} from './adapter.js';
export function mountSoundControl(button,{doc=globalThis.document,win=globalThis.window}={}){
 const adapter=createSliceAudio({doc,win});let disposed=false;
 function render(){const s=adapter.snapshot();const label=s.busy&&s.status!=='enabling'?'正在取消':s.status==='on'||s.status==='enabling'?'关闭声音':'开启声音';if(button.textContent!==label)button.textContent=label;button.setAttribute('aria-pressed',String(s.status==='on'||s.status==='enabling'));button.disabled=disposed;}
 // No await before engine activation. Repeated keyboard activation is handled
 // as a toggle/cancellation; it never mounts another engine.
 function click(){const result=adapter.toggleFromGesture();render();result.finally(render);}
 function refresh(){render();}
 function pagehide(e){if(e.persisted){adapter.disable();render();}else dispose();}
 function dispose(){if(disposed)return;disposed=true;adapter.dispose();button.removeEventListener('click',click);win?.removeEventListener('blur',refresh);win?.removeEventListener('focus',refresh);win?.removeEventListener('pagehide',pagehide);doc?.removeEventListener('visibilitychange',refresh);render();}
 button.addEventListener('click',click);win?.addEventListener('blur',refresh);win?.addEventListener('focus',refresh);win?.addEventListener('pagehide',pagehide);doc?.addEventListener('visibilitychange',refresh);button.hidden=false;render();
 return{update:state=>{adapter.update({...state,speed:0});render();},dispose};
}
