// Transient spatial interaction controller; saved narrative schema stays unchanged.
export function createDirectFold({story,position,location,emit=()=>{},duration=.3}) {
 let pending=null,feedback=null;const failures=[0,0,0];
 const context=i=>{const p=position(),q=location(i);return{distance:Math.hypot(p.x-q.x,p.z-q.z),maxDistance:2.3};};
 function cancel(){pending=null;feedback=null;}
 function start(i){
  if(pending||!Number.isInteger(i)||i<0||i>2)return false;
  const before=story.snapshot().folds[i];
  const result=story.interact(`fold:${i}:rotate`,context(i));if(!result.ok)return false;
  feedback=null;pending={index:i,from:-before*Math.PI/2,elapsed:0};emit(result);return true;
 }
 function update(dt,{paused=false}={}){
  if(paused){cancel();return;}
  if(!Number.isFinite(dt)||dt<0)return;
  if(feedback){feedback.remaining-=dt;if(feedback.remaining<=0)feedback=null;}
  if(!pending)return;
  const i=pending.index,c=context(i);
  if(!story.canInteract(`fold:${i}:pour`,c)){cancel();return;}
  pending.elapsed+=dt;
  if(pending.elapsed+1e-9<duration)return;
  pending=null;
  const result=story.interact(`fold:${i}:pour`,c);
  if(result.ok){
   if(result.events.some(e=>e.type==='water-connected'))failures[i]=0;
   else {failures[i]++;feedback={index:i,remaining:.7};result.events=result.events.map(e=>e.type==='fold-hint'?{...e,text:failures[i]>=2?e.text:'水停在出口了。看看接水口在哪一侧，再转一下。'}:e);}
   emit(result);
  }
 }
 function visual(i){
  if(pending?.index===i){const t=Math.min(1,pending.elapsed/duration),smooth=t*t*(3-2*t);return{angle:pending.from-Math.PI/2*smooth,trying:true,progress:t};}
  return{angle:-story.snapshot().folds[i]*Math.PI/2,trying:feedback?.index===i,progress:1};
 }
 return{start,update,visual,cancel,get busy(){return !!pending;}};
}
