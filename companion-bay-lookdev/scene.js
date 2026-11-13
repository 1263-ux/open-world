import * as T from '../game/vendor/three.module.js';import {makeBoat}from './boat.js';import {makeCourier}from '../game/world.js';import {CLOUD,RAIN,HINGE}from './model.js';
export function makeBay(scene,{showCourier=true}={}){
 const root=new T.Group();root.name='CompanionBay_AgentHypothesis';scene.add(root);const mat=(color)=>new T.MeshStandardMaterial({color,roughness:.82,side:T.DoubleSide});const paper=mat(0xe2dccb),stone=mat(0x80949c),water=mat(0x86aeb9),gold=mat(0xcbb68e);
 function mesh(g,m,x,y,z,parent=root){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 const bay=mesh(new T.CylinderGeometry(10,10,.13,80),water,0,-.12,0);bay.scale.z=.8;
 mesh(new T.BoxGeometry(4.5,.55,5.7),stone,0,-.15,0);
 // Discontinuous pale paper banks disclose both curves without a narrow rail.
 for(let i=0;i<36;i++){const a=i*Math.PI*2/36;const o=mesh(new T.SphereGeometry(.48,10,7),paper,Math.cos(a)*10,-.05,Math.sin(a)*8);o.scale.set(1,.35,.8);}
 const source=mesh(new T.CylinderGeometry(.65,.55,.6,24),stone,0,.35,-1.7);mesh(new T.CircleGeometry(.54,24),water,0,.66,-1.7).rotation.x=-Math.PI/2;
 const hinge=new T.Group();hinge.name='ActualPaperCrease';hinge.position.set(HINGE.x,.7,HINGE.z);root.add(hinge);
 // Geometry local z=0 edge remains invariant under folding around local x.
 const flap=mesh(new T.BoxGeometry(2.2,.045,2.6),paper,0,0,-1.3,hinge);flap.name='FoldingPaperFace';
 for(const x of[-1.08,1.08])mesh(new T.BoxGeometry(.04,.16,2.6),paper,x,.08,-1.3,hinge);
 const crease=mesh(new T.CylinderGeometry(.025,.025,2.3,8),gold,0,.72,-3);crease.rotation.z=Math.PI/2;
 const inlet=mesh(new T.BoxGeometry(.44,.035,1.3),water,0,.7,-2.35);inlet.rotation.x=.02;
 const receiver=mesh(new T.CylinderGeometry(1.15,1.15,.17,32),stone,0,.05,-5.8);const received=mesh(new T.CircleGeometry(1.03,32),water,0,.15,-5.8);received.rotation.x=-Math.PI/2;received.visible=false;
 const falling=[];for(let i=0;i<4;i++)falling.push(mesh(new T.SphereGeometry(.045,8,6),water,0,.2,-5.58));
 const sourceBeads=[],leakBeads=[];
 for(let i=0;i<6;i++)sourceBeads.push(mesh(new T.SphereGeometry(.06,8,6),water,0,.77,-1.7));
 for(let i=0;i<5;i++)leakBeads.push(mesh(new T.SphereGeometry(.05,8,6),water,.58,.5,-2.85));
 const oldPool=mesh(new T.CircleGeometry(.43,24),water,.58,.145,-2.85);oldPool.rotation.x=-Math.PI/2;
 const stream=[];for(let i=0;i<8;i++)stream.push(mesh(new T.SphereGeometry(.055,8,6),water,0,.1,-i*.3,hinge));
 // Reflection study is authored cloud-shaped color on water, not advertised as physical reflection.
 const cloudGroup=new T.Group();cloudGroup.position.set(CLOUD.x,.015,CLOUD.z);root.add(cloudGroup);
 let cloudLayer=0;for(const [x,z,r]of[[-.55,0,.65],[.1,-.3,.9],[.8,.1,.58]]){const o=mesh(new T.CircleGeometry(r,28),mat(0xc3d4d8),x,cloudLayer++*.003,z,cloudGroup);o.rotation.x=-Math.PI/2;}
 const drops=[];for(let i=0;i<5;i++){const d=mesh(new T.SphereGeometry(.09,10,8),mat(0xb9d8dd),RAIN.x+(i-2)*.25,1+i*.2,RAIN.z);d.scale.y=1.6;drops.push(d);}
 const ripple=mesh(new T.TorusGeometry(.65,.018,6,32),paper,RAIN.x,.02,RAIN.z);ripple.rotation.x=Math.PI/2;
 const {boat,fish,fishTail,bowl,bowlAssembly}=makeBoat(root,paper);const courier=makeCourier(root);courier.group.visible=showCourier;
 function update(t,player,companion,fold){
 boat.position.set(player.x,.06,player.z);boat.rotation.y=player.heading;courier.group.position.set(player.x,.31,player.z);courier.group.rotation.y=player.heading;courier.update(t,0,true);
 hinge.rotation.x=fold.angle;received.visible=fold.connected;
 sourceBeads.forEach((b,i)=>b.position.z=-1.7-((t*.7+i*.22)%1.3));
 leakBeads.forEach((b,i)=>{b.visible=!fold.connected;const a=(t*1.3+i*.2)%1;b.position.set(a*.58,.74-a*.58,-2.85);});
 falling.forEach((b,i)=>{b.visible=fold.connected;b.position.y=.15+(1-(t*2+i*.25)%1)*.24;});
 stream.forEach((b,i)=>{b.visible=fold.connected;b.position.set(0,.07,-((t*.8+i*.32)%2.6));});
 let localAngle=t*.7;
 if(companion.target){const dx=companion.target.x-player.x,dz=companion.target.z-player.z;localAngle=Math.atan2(dz,dx)+player.heading;}
 const holding=companion.mode==='watch-cloud'||companion.mode==='rest';const radius=holding?.06:.08;
 fish.position.set(Math.cos(localAngle)*radius,0,Math.sin(localAngle)*radius);fish.rotation.y=-localAngle;fishTail.rotation.y=Math.sin(t*(holding?2:8))*(holding?.07:.3);
 drops.forEach((d,i)=>d.position.y=.15+(1.7-(t*.7+i*.3)%1.7));ripple.scale.setScalar(.75+(t*.4)%1*.4);
 }
 return{root,boat,fish,bowl,bowlAssembly,courier,hinge,flap,receiver,received,sourceBeads,leakBeads,update};
}
