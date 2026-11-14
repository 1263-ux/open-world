// Independent sources: releasing a finger must not cancel a held keyboard key.
export function createObservationInput(){
 let keyboard=false;const pointers=new Set();
 return{key(down){keyboard=!!down;},pointer(id,down){if(down)pointers.add(id);else pointers.delete(id);},reset(){keyboard=false;pointers.clear();},get held(){return keyboard||pointers.size>0;},orbitYaw(current,delta,observing){return observing?current:current+delta;}};
}
// Controller forward is (-sin(yaw), -cos(yaw)): use the rendered camera,
// including its easing towards/away from the optional focus, not hidden orbit.
export function cameraMovementYaw(position,target,fallback=0){const dx=position.x-target.x,dz=position.z-target.z;return Number.isFinite(dx)&&Number.isFinite(dz)&&Math.hypot(dx,dz)>1e-5?Math.atan2(dx,dz):fallback;}
