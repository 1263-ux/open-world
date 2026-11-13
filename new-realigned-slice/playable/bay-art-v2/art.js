import {PULL_TABS} from './navigation.js';
import * as T from '../../../game/vendor/three.module.js';
// Original authored geometry. Applied only to the experimental threshold bay.
export function applyBayArt(bay){
 const paper=new T.MeshStandardMaterial({color:0xded8c8,roughness:.87,side:T.DoubleSide});
 const crease=new T.MeshStandardMaterial({color:0xaaa99c,roughness:.88});
 const pale=new T.MeshStandardMaterial({color:0xb4c8ca,roughness:.48,transparent:true,opacity:.65});
 const add=(g,m,x,y,z,parent=bay.root)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 const line=(points,r,m,parent)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(8,points.length*5),r,5,false),m,0,0,0,parent);
 // Refold the reused hull faces: dip the gunwale, raise both pointed tips inside the existing bowl height.
 for(const o of bay.boat.children){const a=o.geometry?.attributes?.position;if(o.geometry?.type!=='BufferGeometry'||!a)continue;for(let i=0;i<a.count;i++){const y=a.getY(i),z=a.getZ(i);if(Math.abs(y-.35)<.001&&Math.abs(z)<.001)a.setY(i,.22);if(Math.abs(y-.44)<.001&&Math.abs(Math.abs(z)-1)<.001)a.setY(i,.32);if(Math.abs(y-.36)<.001&&Math.abs(Math.abs(z)-1.65)<.001)a.setY(i,.60);}a.needsUpdate=true;o.geometry.computeVertexNormals();}
 // The old fourth side triangle bridged across the lowered gunwale notch.
 // Keep only the three continuous side triangles; pointed end faces are distinct.
 for(const o of bay.boat.children){const a=o.geometry?.attributes?.position;if(o.geometry?.type!=='BufferGeometry'||a?.count!==12)continue;const sign=Math.sign(a.getX(0));if(!sign||!Array.from({length:a.count},(_,i)=>i).every(i=>Math.sign(a.getX(i))===sign&&Math.abs(a.getZ(i))<=1.001))continue;o.geometry.setAttribute('position',new T.Float32BufferAttribute(Array.from(a.array).slice(0,27),3));o.geometry.deleteAttribute('normal');o.geometry.computeVertexNormals();o.name='Refolded_side_gunwale_'+sign;}
 // A crease is a real thin folded ridge, not an emissive outline.
 for(const side of[-1,1]){line([[side*.46,.025,-1],[side*.59,.22,-.55],[side*.71,.224,0],[side*.59,.22,.55],[side*.46,.025,1]],.009,crease,bay.boat);for(const end of[-1,1]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([side*.7,.322,end,0,.602,end*1.65,side*.42,.21,end*1.24],3));g.computeVertexNormals();add(g,new T.MeshStandardMaterial({color:side*end>0?0xe8e1d1:0xc3beb0,side:T.DoubleSide,roughness:.9}),0,0,0,bay.boat);}}
 // Distinct lower waterline and glass side highlights retain the original bowl/support envelope.
 const glass=new T.MeshStandardMaterial({color:0xc7e0df,roughness:.16,transparent:true,opacity:.78});
 const ring=add(new T.TorusGeometry(.229,.008,8,40),glass,.35,.58,-.5,bay.boat);ring.rotation.x=Math.PI/2;
 for(const side of[-1,1])line([[.35+side*.13,.24,-.55],[.35+side*.23,.36,-.58],[.35+side*.22,.53,-.56],[.35+side*.18,.63,-.5]],.007,glass,bay.boat);
 bay.fish.material.color.setHex(0xd69d52);bay.fish.scale.multiplyScalar(1.08);
 // Paper shores keep the same blocked footprint; no island collision contract is widened.
 const island=bay.root.children.find(o=>o.geometry?.type==='BoxGeometry'&&o.geometry.parameters.width===4.5&&o.geometry.parameters.depth===5.7);if(island)island.visible=false;
 const shape=new T.Shape();shape.moveTo(-2.1,-2.65);shape.lineTo(-.7,-2.78);shape.lineTo(1.9,-2.65);shape.quadraticCurveTo(2.25,-2.3,2.15,-1.5);shape.lineTo(2.08,2.65);shape.lineTo(.8,2.78);shape.lineTo(-1.9,2.6);shape.quadraticCurveTo(-2.25,2.4,-2.13,1.4);shape.closePath();
 const shore=add(new T.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.025}),new T.MeshStandardMaterial({color:0xa7b7b6,roughness:.94}),0,.1,0);shore.rotation.x=Math.PI/2;shore.name="Paper_shore_solid";
 for(const o of [...bay.root.children])if(o.geometry?.type==='CylinderGeometry'&&o.geometry.parameters.radiusTop===.65)o.visible=false;
 // Source remains at the exact functional inlet, now stacked folded paper rather than a bucket.
 for(let i=0;i<3;i++){const ledge=add(new T.BoxGeometry(1.3-i*.12,.17,.95),paper,0,.15+i*.17,-1.7);ledge.rotation.y=(i-1)*.055;}
 const flap=bay.flap;flap.material=paper;
 const tray=new T.BufferGeometry();tray.setAttribute('position',new T.Float32BufferAttribute([-.5,0,1.3,.5,0,1.3,0,-.035,-1.3,-.5,0,1.3,0,-.035,-1.3,-.72,.04,-1.3,.5,0,1.3,.72,.04,-1.3,0,-.035,-1.3],3));tray.computeVertexNormals();flap.geometry=tray;
 for(const o of bay.hinge.children)if(o!==flap&&o.geometry?.type==='BoxGeometry')o.visible=false;
 for(const x of[-.45,.45])line([[x,.027,-.1],[x*1.2,.03,-1.35],[x*1.5,.027,-2.5]],.008,crease,bay.hinge);
 // Long low-contrast sky streaks follow the bay direction; omit particles and repeated circular banks.
 for(let i=0;i<13;i++){const z=6-i*.85,x=Math.sin(i*2.1)*6.1;if(Math.abs(x)<2.6&&Math.abs(z)<3.1)continue;const pts=[[-.6+x,-.048,z],[x,-.047,z+.045],[.8+x,-.048,z+.02]];line(pts,.012,pale,bay.root);}
 const contact=new T.MeshStandardMaterial({color:0x687d82,transparent:true,opacity:.15,depthWrite:false});
 const shadow=add(new T.CircleGeometry(1,40),contact,0,-.108,0,bay.boat);shadow.rotation.x=-Math.PI/2;shadow.scale.set(.68,1.62,1);
 // Two actual folded paper pull-tabs extend from the crease, visually reachable from either arc.
 for(const tab of PULL_TABS){const side=Math.sign(tab.x);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([side*1.08,.7,-3,side*1.08,.67,-3.55,tab.x,.31,tab.z-.13,side*1.08,.7,-3,tab.x,.31,tab.z-.13,tab.x,.35,tab.z+.13],3));g.computeVertexNormals();const m=add(g,paper,0,0,0);m.name='Fold_pull_tab_'+side;line([[side*1.08,.704,-3.15],[side*1.65,.51,-3.38],[tab.x,.355,tab.z]],.008,crease,bay.root);}
 const environment=[];for(const o of bay.root.children){if(o===bay.boat||o===bay.courier.group)continue;o.traverse(n=>{if(n.isMesh&&n.visible&&!n.material?.transparent&&["BoxGeometry","CylinderGeometry","ExtrudeGeometry"].includes(n.geometry?.type))environment.push(n);});}
 if(!environment.includes(bay.flap))environment.push(bay.flap);
 for(const o of bay.root.children)if(o.name.startsWith("Fold_pull_tab_")&&!environment.includes(o))environment.push(o);
 return{environment,shore};
}
