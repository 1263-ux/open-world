import * as T from '../../../game/vendor/three.module.js';
// Isolated comparison. Does not alter hull, seat, bowl support or swim radius.
export function applyFishStudy(bay){
 bay.fish.scale.set(1.5,.9,.72);bay.fish.material=bay.fish.material.clone();bay.fish.material.color.setHex(0xd9a051);bay.fish.material.emissive.setHex(0x5d2b0b);bay.fish.material.emissiveIntensity=.12;
 bay.fish.children.find(o=>o.geometry?.type==='ConeGeometry')?.scale.setScalar(.65);
 const tail=bay.fish.children.find(o=>o.geometry?.type==='ConeGeometry');if(tail)tail.position.x=-.065;
 bay.fish.parent.material=bay.fish.parent.material.clone();bay.fish.parent.material.opacity=.12;bay.fish.parent.material.roughness=.13;bay.fish.parent.material.depthWrite=false;
 const eye=new T.Mesh(new T.SphereGeometry(.008,8,6),new T.MeshBasicMaterial({color:0x333a43}));eye.position.set(.05,.02,-.05);bay.fish.add(eye);
}
