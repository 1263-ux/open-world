import * as T from '../game/vendor/three.module.js';
export function applyOffsetDock(d){
 d.landingMesh.position.set(2.4,.04,-12.05);d.landingMesh.scale.z=1.15;
 const connector=new T.Mesh(new T.BoxGeometry(1.5,.08,.6),d.landingMesh.material.clone());connector.name='Trial_offset_walk_connector';connector.position.set(2.2,-.12,-11.25);d.root.add(connector);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([2,-.08,-11.35,2.8,-.08,-11.35,2.8,.08,-11.65,2,.08,-11.65],3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();const ramp=new T.Mesh(g,d.landingMesh.material.clone());ramp.material.side=T.DoubleSide;ramp.name='Trial_real_offset_ramp';d.root.add(ramp);d.root.updateMatrixWorld(true);
 return {ground:[d.landingMesh,connector,ramp],stand:{x:2.4,y:.08,z:-12.12},walkable:(x,z)=>(x>=1.8&&x<=2.6&&z>=-11.4&&z<=-11.05)||(x>=2.22&&x<=2.58&&z>=-12.32&&z<=-11.2)};
}
