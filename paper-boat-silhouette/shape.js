import * as T from '../game/vendor/three.module.js';
// Isolated replacement of hull skins only. No seat/floor/bowl/actor changes.
export function applyPaperHull(boat){
 const original=[...boat.children],replace=original.filter(o=>o.isMesh&&o.geometry.type==='BufferGeometry');
 for(const o of replace)o.visible=false;
 const floor=original.find(o=>o.geometry?.type==='ShapeGeometry');floor.visible=false;
 const shell=new T.Group();shell.name='Folded_paper_hull_candidate';boat.add(shell);
 const ivory=new T.MeshStandardMaterial({color:0xe2dccb,roughness:.88,side:T.DoubleSide}),under=ivory.clone();under.color.setHex(0xc5c1b7);
 function face(name,v,mat=ivory){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v.flat(),3));g.setIndex(v.length===3?[0,1,2]:[0,1,2,0,2,3]);g.computeVertexNormals();const m=new T.Mesh(g,mat);m.name=name;m.castShadow=m.receiveShadow=true;shell.add(m);return m;}
 // Narrow floor remains level beneath all existing seat and bowl supports;
 // keel rises into each tip instead of ending in a tall vertical nose.
 face('central_support_floor',[[-.46,0,-1],[.46,0,-1],[.46,0,1],[-.46,0,1]]);
 for(const end of[-1,1])face('raised_point_keel_'+end,[[-.46,0,end],[.46,0,end],[0,.38,end*1.65]]);
 // Central boarding dip remains below the old rail; outer shoulders turn up
 // into pointed pleats instead of continuing as a single flat rectangular wall.
 for(const side of[-1,1]){
  const s=x=>side*x;
  for(const end of[-1,1]){
   face(`outer_fold_${side}_${end}`,[[s(.46),0,0],[s(.46),0,end],[s(.7),.39,end],[s(.7),.22,0]],under);
   face(`turned_paper_edge_${side}_${end}`,[[s(.7),.22,0],[s(.7),.39,end],[s(.665),.385,end],[s(.665),.215,0]]);
   // A real overlapped triangular flap creates a diagonal crease and shadow.
   face(`diagonal_lapped_fold_${side}_${end}`,[[s(.704),.222,0],[s(.702),.392,end],[s(.57),.19,end*.72]]);
   // Tapered bow/stern: raised tips, lower shoulder, visible doubled paper edge.
   face(`pointed_end_${side}_${end}`,[[s(.46),0,end],[0,.38,end*1.65],[0,.44,end*1.65],[s(.7),.39,end]]);
   face(`point_fold_${side}_${end}`,[[s(.7),.39,end],[0,.44,end*1.65],[s(.32),.25,end*1.27]],under);
  }
 }
 return{shell,hidden:[...replace,floor]};
}
