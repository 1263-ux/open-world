// Static comparison controls only; not the game's companion behavior.
import {createCompanionPlacement} from './companion-composition/placement.js';
export function createCompanionStudy(bay){
 const placement=createCompanionPlacement(bay),rotation=bay.fish.quaternion.clone();
 return{select(forward){placement.setEnabled(forward);bay.fish.quaternion.copy(rotation);if(forward)bay.fish.rotation.y=Math.PI/2;bay.root.updateMatrixWorld(true);return {forward:placement.enabled,posed:!!forward};}};
}
