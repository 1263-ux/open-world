// Only post-physics observations. Host still owns letter lifecycle and safe return.
export function createClosureBridge(closure){let previous=null,outsideSeen=false;
 const invalidate=()=>{previous=null;outsideSeen=false;};
 return{letterCompleted(){return closure.record({type:'letter-read-completed'});},resetBaseline:invalidate,sample(threshold,p,dt,{paused=false,hidden=false,blurred=false}={}){
  const s=threshold.snapshot(),inside=['watch-cloud','notice-cloud'].includes(s.companion.mode);
  if(paused||hidden||blurred||!Number.isFinite(dt)||dt<=0||dt>.25||![p.x,p.z,p.speed].every(Number.isFinite)){invalidate();return;}
  const now={x:p.x,z:p.z,boating:p.boating===true,inside,connected:!!s.fold.connected};
  if(previous&&Math.hypot(now.x-previous.x,now.z-previous.z)>dt*10){invalidate();return;}
  if(!previous){previous=now;outsideSeen=!inside;return;}
  if(!inside)outsideSeen=true;
  if(s.fold.connected&&!previous.connected)closure.record({type:'fold-connected-observed'});
  const sailing=now.boating&&previous.boating&&s.phase==='boating',distance=Math.hypot(now.x-previous.x,now.z-previous.z);
  if(sailing&&distance>0)closure.record({type:'sailing-observed',distance});
  if(sailing&&outsideSeen&&!previous.inside&&inside){closure.record({type:'cloud-entry-validated'});outsideSeen=false;}
  if(sailing&&inside&&closure.snapshot().facts.cloudQualified)closure.record({type:'cloud-sample',inside:true,dt,speed:Math.abs(p.speed)});
  previous=now;
 }};
}
