// Isolated CH01 interaction hypothesis. No save/reward/chapter authority.
export const DIRECTIONS=Object.freeze([{id:'left',yaw:1.1,label:'沿左侧折线'},{id:'center',yaw:0,label:'沿中间折线'},{id:'right',yaw:-1.1,label:'沿右侧折线'}]);
export const CONTRACT=Object.freeze({hinge:[0,.7,-3],length:2.6,raisedAngle:.7,foldedAngle:-.12,receiver:[0,.15,-5.8],receiverRadius:1.03,streamHalfWidth:.16});
// Continuous paper centreline: inlet tangent remains aligned with source.
// An authored fold approximation, not cloth/area-preserving origami physics.
export function channelPoint(t,yaw=0){const a=yaw*t;return Math.abs(yaw)<1e-8?[0,0,-CONTRACT.length*t]:[-CONTRACT.length*(1-Math.cos(a))/yaw,0,-CONTRACT.length*Math.sin(a)/yaw];}
export function outlet({yaw=0,angle=CONTRACT.foldedAngle}={}){const [x,,z]=channelPoint(1,yaw);return [x,CONTRACT.hinge[1]-z*Math.sin(angle),CONTRACT.hinge[2]+z*Math.cos(angle)];}
export function connectionGeometry({yaw,angle}){const tip=outlet({yaw,angle}),r=CONTRACT.receiver;const distance=Math.hypot(tip[0]-r[0],tip[2]-r[2]);return {tip,distance,margin:CONTRACT.receiverRadius-CONTRACT.streamHalfWidth-distance,downhill:tip[1]>r[1]+.03,aligned:Math.abs(angle-CONTRACT.foldedAngle)<.002};}
export function createPaperFold({initial='left'}={}){
 let selected=DIRECTIONS.find(x=>x.id===initial)??DIRECTIONS[0],phase='raised',angle=CONTRACT.raisedAngle,elapsed=0,attempts=0;
 const snapshot=()=>{const curveYaw=selected.yaw*(CONTRACT.raisedAngle-angle)/(CONTRACT.raisedAngle-CONTRACT.foldedAngle);const geometry=connectionGeometry({yaw:curveYaw,angle});return {phase,angle,yaw:selected.yaw,selection:selected.id,attempts,geometry,connected:phase==='flowing'&&geometry.aligned&&geometry.downhill&&geometry.margin>=0,waterOnPaper:phase==='spilling'||phase==='flowing',canChoose:phase==='raised',canReset:phase!=='raised'};};
 const rebound=()=>{if(phase==='raised')return false;phase='rebounding';elapsed=0;return true};
 return {snapshot,select(id){if(phase!=='raised')return false;const next=DIRECTIONS.find(x=>x.id===id);if(!next)return false;selected=next;return true;},begin(){if(phase!=='raised')return false;attempts++;phase='folding';elapsed=0;return true;},start(x,z){return Math.hypot(x-CONTRACT.hinge[0],z-CONTRACT.hinge[2])<=3?this.begin():false;},cancel:rebound,reset:rebound,
 update(dt,{paused=false}={}){if(paused||!Number.isFinite(dt)||dt<0)return snapshot();let left=dt;
  // Consume wall time at actual event boundaries, without dropping low-FPS delta.
  // At most folding -> spilling -> rebound -> raised, so even large dt is bounded.
  while(left>0){
   if(phase==='folding'){const used=Math.min(left,(angle-CONTRACT.foldedAngle)/.65);angle-=used*.65;left-=used;
    if(angle-CONTRACT.foldedAngle<1e-10){angle=CONTRACT.foldedAngle;const g=connectionGeometry({yaw:selected.yaw,angle});phase=g.margin>=0&&g.downhill?'flowing':'spilling';elapsed=0;}else break;}
   else if(phase==='spilling'){const used=Math.min(left,1.4-elapsed);elapsed+=used;left-=used;if(elapsed>=1.4-1e-10){phase='rebounding';elapsed=0;}else break;}
   else if(phase==='rebounding'){const used=Math.min(left,(CONTRACT.raisedAngle-angle)/.9);angle+=used*.9;left-=used;if(CONTRACT.raisedAngle-angle<1e-10){angle=CONTRACT.raisedAngle;phase='raised';elapsed=0;}else break;}
   else break;
  }
  return snapshot();}};
}
