import * as T from '../../../game/vendor/three.module.js';
// Exploration fades are a player visibility tool, not an editorial decision.
// update(empty, same point) first restores every previous material through the
// existing occlusion object's restoration path, then performs no raycast.
export function createPresentationOcclusion(occlusion){let mode='office';const zero=new T.Vector3();return{
 update({owner,target,camera,roots}){mode=owner;if(owner==='echo'||owner==='return'){occlusion.update(zero,zero,[]);return 'restored-no-player-fade'}occlusion.update(target,camera,roots);return 'player-fade'},
 dispose(){occlusion.update(zero,zero,[])},get mode(){return mode}
};}
