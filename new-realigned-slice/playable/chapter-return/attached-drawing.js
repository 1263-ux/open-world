import * as T from '../../../game/vendor/three.module.js';
export function attachDrawing(world,texture){
 world.updateMatrixWorld(true);let bar=null;world.traverse(o=>{if(o.isMesh&&/^Window muntin(?:\.?001)$/.test(o.name.replaceAll('_',' ')))bar=o});if(!bar)throw Error('Existing upper window crossbar missing; do not float drawing');
 const b=new T.Box3().setFromObject(bar),center=b.getCenter(new T.Vector3()),front=b.max.z+.055,top=b.min.y-.02;
 const group=new T.Group();group.name='Sky_drawing_hung_on_existing_window_crossbar';
 const paper=new T.Mesh(new T.PlaneGeometry(.84,.56),new T.MeshStandardMaterial({map:texture,roughness:.9,side:T.DoubleSide}));paper.name='Attached_memory_paper';paper.position.set(center.x,top-.28,front);group.add(paper);
 const metal=new T.MeshStandardMaterial({color:0x9d8862,metalness:.5,roughness:.5}),hooks=[];
 const box=(name,x,y,z,w,h,d)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),metal);o.name=name;o.position.set(x,y,z);group.add(o);hooks.push(o);return o};
 for(const dx of[-.28,.28]){const x=center.x+dx,back=b.min.z-.009,roof=b.max.y+.01;
  box('Hook_top_resting_on_crossbar',x,roof,(back+front)/2,.035,.02,front-back+.02);
  box('Hook_rear_return',x,(roof+b.min.y)/2,back,.035,roof-b.min.y+.015,.016);
  box('Paper_gripping_front_clip',x,(roof+top-.045)/2,front+.005,.04,roof-top+.045,.022);
  box('Paper_back_jaw',x,top-.018,front-.008,.04,.055,.012);
 }
 group.updateMatrixWorld(true);return{group,paper,bar,hooks,anchor:{barMin:b.min.toArray(),barMax:b.max.toArray(),paperTop:top,paperZ:front},dispose(){group.removeFromParent();group.traverse(o=>{if(o.isMesh)o.geometry.dispose()});paper.material.dispose();metal.dispose()}};
}
