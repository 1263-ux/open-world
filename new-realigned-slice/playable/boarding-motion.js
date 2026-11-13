// External root motion for the independently authored boarding clip.
// Not enabled until the exported animation and physical contacts are accepted.
export function createBoardingMotion(contract){
 const {duration,scale,yawThree,finalRootThree,rootLocalBlenderKeys:keys}=contract;
 if(!(duration>0&&scale>0&&Number.isFinite(yawThree))||!Array.isArray(finalRootThree)||finalRootThree.length!==3||!finalRootThree.every(Number.isFinite)||!Array.isArray(keys)||keys.length<2)throw Error('Invalid boarding motion contract');
 keys.forEach((k,i)=>{if(k.length!==3||!k.every(Number.isFinite)||(i&&k[0]<=keys[i-1][0]))throw Error('Invalid boarding key');});
 if(keys[0][0]!==0||Math.abs(keys.at(-1)[0]-duration)>1e-6)throw Error('Incomplete boarding timeline');
 function sample(time){
  const t=Math.max(0,Math.min(duration,Number.isFinite(time)?time:0));
  let a=keys[0],b=keys[1];for(let i=1;i<keys.length;i++){a=keys[i-1];b=keys[i];if(t<=b[0])break;}
  let k=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));k=k*k*(3-2*k);
  const x=a[1]+(b[1]-a[1])*k,z=a[2]+(b[2]-a[2])*k;
  return{time:t,x:finalRootThree[0]+Math.cos(yawThree)*x*scale,y:finalRootThree[1]+z*scale,z:finalRootThree[2]-Math.sin(yawThree)*x*scale,heading:yawThree};
 }
 return{duration,sample};
}
