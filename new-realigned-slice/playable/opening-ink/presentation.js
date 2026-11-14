import{paperAnchor,createInkTransition}from'./transition.js';
// Initialization only, before live action exists. Restore the zero pose in finally.
export function releasePointAtInitialization(gesture,contract,timing){
 if(Math.abs(gesture.clip.duration-timing.duration)>1e-5||!(timing.holdTime<timing.releaseTime&&timing.releaseTime<=timing.duration))throw Error('Ink timing differs from actual letter clip');
 if(contract.holdTimeSeconds&&!(timing.holdTime>=contract.holdTimeSeconds[0]&&timing.holdTime<=contract.holdTimeSeconds[1]))throw Error('Ink hold interval mismatch');
 try{gesture.sample(timing.releaseTime,true);return paperAnchor(gesture.paper.find(o=>o.name===contract.paperNode));}finally{gesture.sample(0,false)}
}
export function createOpeningInk({scene,releasePoint,threshold,timing,doc=document,reducedMotion=()=>false}){
 const ink=createInkTransition({scene,releasePoint,water:threshold.bay.root.getObjectByName('Shallow_water_fading_edge_not_plinth'),legacyGuide:threshold.guide,releaseTime:timing.releaseTime});
 const button=doc.createElement('button');button.id='skip-ink';button.textContent='略过墨滴';button.hidden=true;button.style.cssText='position:fixed;left:16px;top:100px;z-index:3;padding:6px 10px;border-radius:16px;color:#e4edef;background:#253a48cc;border:1px solid #a8bec588;font-size:12px';doc.body.append(button);
 let attempted=false,disposed=false,dialog=false,skipRequested=false;
 const flags=x=>({paused:!!x.dialogOpen,hidden:!!x.hidden,blurred:!!x.blurred});
 function update(x){dialog=!!x.dialogOpen;if(skipRequested||reducedMotion())ink.skip();button.hidden=disposed||dialog||!!x.hidden||!!x.blurred||!ink.snapshot().active||ink.snapshot().skipRequested;}
 button.onclick=()=>{if(disposed||dialog||button.hidden)return;skipRequested=true;ink.skip();button.hidden=true;};
 return{ink,button,arm({returned=false}={}){if(disposed||attempted||returned)return false;attempted=true;return ink.arm({returned})},
 advance(dt,x={}){if(disposed)return;ink.advance(dt,flags(x));update(x)},observe(before,after,dt,x={}){if(disposed)return;ink.observe(before,after,dt,flags(x));update(x)},
 dispose(){if(disposed)return;disposed=true;button.onclick=null;button.remove();ink.dispose()}};
}
