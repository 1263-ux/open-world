// Proposed hold-to-observe focus only. No main-game integration or input mutation.
// The caller supplies the current exploration camera every frame. Releasing (0)
// returns that camera exactly; never stores or locks the player's orbit.
export function paperWaterFocus(explore,weight=0){
 const k=Math.min(1,Math.max(0,Number.isFinite(weight)?weight:0));
 const lerp=(a,b)=>a.map((x,i)=>x+(b[i]-x)*k);
 return {position:lerp(explore.position,[9,2.5,-25.5]),target:lerp(explore.target,[3.1,.7,-22.5]),fov:explore.fov+(48-explore.fov)*k};
}
