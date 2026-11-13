// Isolated opt-in placement; no automatic import from live main.
import {Vector3} from '../../../../game/vendor/three.module.js';
export const COMPANION_OFFSET=Object.freeze({x:-.08,y:0,z:1.28});
export function createCompanionPlacement(bay){
 const group=bay?.bowlAssembly;
 if(!group?.isGroup||group.parent!==bay.boat||!bay.bowl||bay.bowl.parent!==group)throw new TypeError('A complete named boat.bowlAssembly is required');
 const baseline=group.position.clone();let enabled=false;
 return{get enabled(){return enabled;},setEnabled(value){enabled=!!value;group.position.copy(baseline);if(enabled)group.position.add(new Vector3(COMPANION_OFFSET.x,COMPANION_OFFSET.y,COMPANION_OFFSET.z));group.updateMatrixWorld(true);return enabled;}};
}
