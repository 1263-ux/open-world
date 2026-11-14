import * as T from '../../../game/vendor/three.module.js';
export function paperAnchor(paper){if(!paper?.isMesh)throw Error('Actual paper mesh required');paper.updateWorldMatrix(true,false);paper.geometry.computeBoundingBox();const b=paper.geometry.boundingBox;return paper.localToWorld(new T.Vector3(b.min.x+(b.max.x-b.min.x)*.72,b.max.y,b.min.z+(b.max.z-b.min.z)*.30));}
export function waterContact(water,x=4.1,z=-13.5){if(!water?.isMesh)throw Error('Actual water mesh required');water.updateWorldMatrix(true,false);const ray=new T.Raycaster(new T.Vector3(x,5,z),new T.Vector3(0,-1,0));const hit=ray.intersectObject(water,false)[0];if(!hit)throw Error('No actual water intersection');return hit.point.clone();}
export function createInkTransition({scene,releasePoint,water,legacyGuide,releaseTime}){
 if(!Number.isFinite(releaseTime)||releaseTime<=0)throw Error('Explicit release contract required');
 const contact=waterContact(water),origin=releasePoint.clone(),top=origin.clone().add(new T.Vector3(0,.18,0));
 const curve=new T.CubicBezierCurve3(top,new T.Vector3(-1.9,1.7,-6),new T.Vector3(3.1,.8,-10.4),contact);
 const group=new T.Group();group.name='Single_ink_water_transition';scene.add(group);
 const drop=new T.Mesh(new T.SphereGeometry(.045,16,10),new T.MeshStandardMaterial({color:0x9fc4c8,roughness:.35,transparent:true,opacity:.9}));drop.name='One_actual_ink_drop';group.add(drop);
 const ripple=new T.Mesh(new T.RingGeometry(.83,1,40),new T.MeshBasicMaterial({color:0x9fc4c8,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));ripple.name='One_actual_water_contact_ripple';ripple.rotation.x=-Math.PI/2;ripple.position.copy(contact).add(new T.Vector3(0,.003,0));group.add(ripple);
 let armed=false,used=false,active=false,elapsed=0,completed=false,skipRequested=false,disposed=false,stable=false;
 const saved=legacyGuide?{visible:legacyGuide.visible,children:legacyGuide.children.map(o=>[o,o.visible])}:null;
 // Hide only legacy particles, not their resources or bay visibility. Caller retains original ownership.
 if(saved)for(const[o]of saved.children)o.visible=false;
 function draw(){group.visible=active&&!skipRequested;drop.visible=elapsed<3.3;ripple.visible=elapsed>=3.3&&elapsed<4.4;
 if(elapsed<.8){const k=elapsed/.8;drop.position.copy(origin).lerp(top,k*k*(3-2*k));drop.scale.setScalar(.4+.6*k);}else{drop.position.copy(curve.getPointAt(Math.min(1,(elapsed-.8)/2.5)));drop.scale.setScalar(1);}
 const r=T.MathUtils.clamp((elapsed-3.3)/1.1,0,1);ripple.scale.setScalar(.03+r*.34);ripple.material.opacity=.32*Math.sin(Math.PI*r);
 }
 function settle(){if(completed&&(skipRequested||elapsed>=4.4)){active=false;stable=true;}draw();}
 function snapshot(){return{armed,used,active,elapsed,completed,skipRequested,stable,locksInput:false,ownsCamera:false};}
 draw();group.visible=false;
 return{group,drop,ripple,curve,origin,contact,
 arm({returned=false}={}){if(disposed||used||armed||returned)return false;armed=true;return true;},
 observe(before,after,dt,{paused=false,hidden=false,blurred=false}={}){if(disposed||paused||hidden||blurred||!Number.isFinite(dt)||dt<0)return snapshot();
 if(armed&&!used&&before.active&&((before.phase==='returning'&&before.time<releaseTime&&(after.time>=releaseTime||!after.active))||(before.time>=releaseTime))){used=true;armed=false;active=true;elapsed=Math.min(4.4,Math.max(0,dt-Math.max(0,releaseTime-before.time)));}
 if(used&&before.active&&!after.active)completed=true;settle();return snapshot();},
 advance(dt,{paused=false,hidden=false,blurred=false}={}){if(disposed||paused||hidden||blurred||!Number.isFinite(dt)||dt<0)return snapshot();if(active)elapsed=Math.min(4.4,elapsed+dt);settle();return snapshot();},
 skip(){if(disposed||!used)return false;skipRequested=true;settle();return true;},snapshot,
 dispose(){if(disposed)return;disposed=true;group.removeFromParent();drop.geometry.dispose();drop.material.dispose();ripple.geometry.dispose();ripple.material.dispose();if(saved){for(const[o,v]of saved.children)o.visible=v;}active=false;}
 };
}
