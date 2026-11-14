import * as T from '../game/vendor/three.module.js';
// Opt-in art study: same hinge, pull tabs, receiver and collision footprint.
export function applyReadableFold(bay){
 const paper=new T.MeshStandardMaterial({color:0xd7d9ca,roughness:.88,side:T.DoubleSide}),wet=new T.MeshStandardMaterial({color:0x81acb2,roughness:.18,metalness:0,side:T.DoubleSide,transparent:true,opacity:.78,depthWrite:false}),edge=new T.MeshStandardMaterial({color:0xa5bfc0,roughness:.4});
 const group=new T.Group();group.name='Readable_paper_water_study';bay.root.add(group);
 const mesh=(vertices,faces,material,parent,name)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices.flat(),3));g.setIndex(faces.flat());g.computeVertexNormals();const m=new T.Mesh(g,material);m.name=name;parent.add(m);m.castShadow=m.receiveShadow=true;return m;};
 const quad=(v,m,p,n)=>mesh(v,[[0,1,2],[0,2,3]],m,p,n);
 // Retire only the old stair/source water proxies, not the navigable paper shore.
 for(const o of bay.root.children){const p=o.geometry?.parameters;if((o.geometry?.type==='BoxGeometry'&&p.height===.17&&p.depth===.95)||(o.geometry?.type==='CircleGeometry'&&p.radius===.54)||(o.geometry?.type==='BoxGeometry'&&p.width===.44&&p.depth===1.3))o.visible=false;}
 for(const o of bay.root.children)if(o.geometry?.type==='CylinderGeometry'&&o.geometry.parameters.radiusTop===.025&&o.geometry.parameters.height===2.3)o.visible=false;
 for(const o of bay.hinge.children)if(o.geometry?.type==='TubeGeometry')o.visible=false;
 const hidden=[...bay.sourceBeads,...bay.leakBeads];bay.root.traverse(o=>{if(o.geometry?.type==='SphereGeometry'&&[.045,.055].includes(o.geometry.parameters.radius))hidden.push(o);});
 // One shallow folded catchment, not three stacked blocks.
 mesh([[-.8,.84,-1.25],[.8,.74,-1.25],[-.5,.70,-1.6],[.5,.70,-1.6],[-.25,.70,-3.02],[.25,.70,-3.02],[-.83,.88,-2.7],[.83,.74,-2.7]],[[0,2,3],[0,3,1],[2,4,5],[2,5,3],[0,6,4],[0,4,2],[1,3,5],[1,5,7]],paper,group,'Single_folded_rain_catchment');
 quad([[-.18,.707,-1.55],[.18,.707,-1.55],[.18,.707,-3.02],[-.18,.707,-3.02]],wet,group,'Visible_water_to_hinge');
 // Replace the broad upright flag with a recognizable folded gutter, same extents/pivot.
 const verts=[[-1.08,.12,1.3],[-.30,0,1.3],[.30,0,1.3],[1.08,.12,1.3],[-1.08,.12,-1.3],[-.30,0,-1.3],[.30,0,-1.3],[1.08,.12,-1.3]],faces=[[0,4,5],[0,5,1],[1,5,6],[1,6,2],[2,6,7],[2,7,3]];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts.flat(),3));g.setIndex(faces.flat());g.computeVertexNormals();bay.flap.geometry=g;bay.flap.material=paper;
 const waterVertices=[],waterFaces=[];for(let i=0;i<=32;i++){const t=i/32,w=.16+.018*Math.sin(t*12),y=.014+.003*Math.sin(t*15);waterVertices.push([-w,y,-2.6*t],[w,y,-2.6*t]);if(i<32){const n=i*2;waterFaces.push([n,n+2,n+3],[n,n+3,n+1]);}}const troughWater=mesh(waterVertices,waterFaces,wet,bay.hinge,'Connected_channel_water');
 const spill=quad([[.18,.71,-2.9],[.24,.71,-2.9],[.64,.16,-2.85],[.58,.16,-2.85]],wet,group,'Before_fold_side_spill');
 const fv=[],ff=[];for(let i=0;i<=12;i++){const t=i/12,w=.16-.055*t,y=.4-.24*t,z=-5.58-.22*(1-Math.cos(t*Math.PI/2));fv.push([-w,y,z],[w,y,z]);if(i<12){const n=i*2;ff.push([n,n+2,n+3],[n,n+3,n+1]);}}const fall=mesh(fv,ff,wet,group,'After_fold_receiver_waterfall');
 // Folded return edges reach the actual paper shore, rather than leaving a floating tray.
 for(const side of[-1,1])mesh([[side*.8,side>0?.74:.84,-1.25],[side*.78,.11,-1.50],[side*.5,.70,-1.6]],[[0,1,2]],paper,group,'Paper_return_support_'+side);
 // Small curved glints instead of road-like white dashes.
 const glints=[];for(let i=0;i<4;i++){const curve=new T.CatmullRomCurve3([new T.Vector3(-.09,.019,.012),new T.Vector3(0,.022,0),new T.Vector3(.07,.019,.008)]);const o=new T.Mesh(new T.TubeGeometry(curve,8,.003,4,false),edge);bay.hinge.add(o);glints.push(o);}

 function update(time,connected){const p=bay.flap.geometry.attributes.position;for(const i of[0,3,4,7]){p.setX(i,Math.sign(p.getX(i))*(connected?.52:1.08));p.setY(i,connected?(i===3||i===7?.025:.06):.005);}p.needsUpdate=true;bay.flap.geometry.computeVertexNormals();for(const o of hidden)o.visible=false;troughWater.visible=fall.visible=connected;spill.visible=!connected;glints.forEach((o,i)=>{o.visible=connected;o.position.z=-((time*.3+i*.5)%2.55);});}
 update(0,false);return{group,update,troughWater,fall,spill};
}
