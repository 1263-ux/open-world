import * as T from '../../game/vendor/three.module.js';
// A shallow exterior belly meets the water; interior floor and supports stay fixed.
export function addBoatWaterline(boat){
 const old=boat.getObjectByName('Paper_boat_submerged_belly');if(old)return old;
 // Upper ring exactly shares the folded floor perimeter, not a guessed short rim.
 const ring=[[-.46,0,-1],[0,.38,-1.65],[.46,0,-1],[.46,0,1],[0,.38,1.65],[-.46,0,1]];
 const bottom=[[-.25,-.13,-.75],[0,-.06,-1.15],[.25,-.13,-.75],[.25,-.13,.75],[0,-.06,1.15],[-.25,-.13,.75]];
 const vertices=[],indices=[];for(const p of[...ring,...bottom])vertices.push(...p);
 for(let i=0;i<6;i++){const j=(i+1)%6;indices.push(i,j,j+6,i,j+6,i+6);}for(let i=1;i<5;i++)indices.push(6,6+i+1,6+i);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
 const m=new T.Mesh(g,new T.MeshStandardMaterial({color:0xc5c1b7,roughness:.88,side:T.DoubleSide}));m.name='Paper_boat_submerged_belly';m.castShadow=m.receiveShadow=true;boat.add(m);return m;
}
