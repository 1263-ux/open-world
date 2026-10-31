import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const scene=new T.Scene();scene.background=new T.Color('#dce7df');scene.fog=new T.Fog('#dce7df',43,90);
const camera=new T.PerspectiveCamera(38,innerWidth/innerHeight,.1,120);camera.position.set(16,10,22);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;document.querySelector('#scene').append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,2,0);controls.enableDamping=true;controls.minDistance=8;controls.maxDistance=38;controls.maxPolarAngle=Math.PI*.54;controls.enablePan=false;controls.update();controls.saveState();
function clearDamping(){controls.enableDamping=false;controls.update()}
document.querySelector('#reset').onclick=()=>{clearDamping();controls.reset();controls.update();controls.enableDamping=true};
document.querySelector('#close').onclick=()=>{clearDamping();camera.position.set(7,1.7,14);controls.target.set(-1,1.7,0);controls.update();controls.enableDamping=true};
scene.add(new T.HemisphereLight('#e8f0ed','#81927e',2.0));const sun=new T.DirectionalLight('#ffe6c8',2.1);sun.position.set(-12,24,16);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:60});sun.shadow.bias=-.00015;sun.shadow.normalBias=.035;scene.add(sun);
const mat=(c,rough=1)=>new T.MeshStandardMaterial({color:c,roughness:rough});const cream=mat('#ded1bc'), brick=mat('#b9947c'), pale=mat('#eee2d0'),roof=mat('#6d786b'), dark=mat('#405e57'),glass=mat('#769491',.3),wood=mat('#95704d'), lawn=mat('#a4b597'), paving=mat('#cec8ba'),joint=mat('#b9b3a4'),soil=mat('#756956'),bark=mat('#786d58');
// Static opaque pieces are merged by material to keep the scene light enough for inspection.
const batches=new Map();function add(g,m,x,y,z,rx=0,ry=0,rz=0){g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);if(!batches.has(m))batches.set(m,[]);batches.get(m).push(g)}
function box(x,y,z,w,h,d,m,rx=0,ry=0,rz=0){add(new T.BoxGeometry(w,h,d),m,x,y,z,rx,ry,rz)}
function cyl(x,y,z,rt,rb,h,m,rx=0,ry=0,rz=0){add(new T.CylinderGeometry(rt,rb,h,9),m,x,y,z,rx,ry,rz)}
// Continuous garden lawn with a restrained, clearly bounded stone court.
box(0,-.25,0,80,.5,80,lawn);box(0,.025,7,5,.09,23,paving);box(0,.035,1,16,.1,10,paving);box(-6,.04,5,5,.1,3,paving);
for(let z=-3;z<19;z+=1.15)box(0,.09,z,5,.012,.015,joint);for(let x=-7.5;x<8;x+=1.15)box(x,.10,1,.015,.012,10,joint);for(let x of [-2.6,2.6])box(x,.1,10,.15,.18,16,pale);
// Asymmetric single-storey reading pavilion. Actual recess is formed by divided front wall.
box(-4.05,2,-3,2.9,4,6,cream);box(2.55,2,-3,5.9,4,6,cream);box(-1.5,3.5,-3,2.1,1,6,cream);box(-1.5,1.5,-3.45,2.1,3,5.1,cream);
// A short brick side wing adds depth and a legible silhouette.
box(-7,1.65,-2.7,3,3.3,5.4,brick);box(-7,3.36,-2.7,3.2,.2,5.6,pale);
box(0,.18,.08,11.3,.36,.35,pale);box(0,4.03,.08,11.3,.18,.35,pale);box(-7,.18,.08,3,.36,.35,pale);
// Deep eaves and a pitched roof. A low parapet detail avoids a generic flat block.
box(0,4.72,-1.58,11.8,.22,4.1,roof,.40);box(0,4.72,-4.42,11.8,.22,4.1,roof,-.40);box(0,5.55,-3,11.9,.18,.25,pale);box(0,4.0,.18,11.7,.16,.3,pale);
// Arch-shaped inset panes and a matching cream frame, all original vector geometry.
function archShape(w,h){let s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();return s}
function arch(x,y,z,w,h,isDoor=false){const outer=archShape(w,h), hole=archShape(w-.23,h-.15);outer.holes.push(hole);add(new T.ShapeGeometry(outer,20),pale,x,y,z);add(new T.ShapeGeometry(archShape(w-.24,h-.18),20),dark,x,y+.05,z-.025);add(new T.ShapeGeometry(archShape(w-.43,h-.32),20),glass,x,y+.11,z+.002);box(x,y+(h-.4)/2,z+.025,.055,h-.4,.06,pale);if(!isDoor)box(x,y+.85,z+.03,w-.4,.055,.06,pale);box(x,y-.04,z+.12,w+.35,.14,.35,pale)}
arch(-1.5,.18,-.48,2.15,3.15,true);arch(1.4,.9,.11,1.45,2.25);arch(3.65,.9,.11,1.45,2.25);arch(-7,.78,.11,1.45,1.95);
// Entry canopy and small readable sign, explicitly an invented place.
box(-1.5,3.48,.24,3.1,.15,1.25,pale);box(-1.5,3.59,.24,3.2,.1,1.32,roof);for(let x of [-2.85,-.15])box(x,1.8,.75,.12,3.45,.12,pale);
box(-1.5,3.83,.19,2.6,.43,.08,dark);
const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=96;const sc=signCanvas.getContext('2d');sc.fillStyle='#405e57';sc.fillRect(0,0,512,96);sc.fillStyle='#f5ecd9';sc.textAlign='center';sc.textBaseline='middle';sc.font='500 50px serif';sc.fillText('校园书屋',256,50);const signTex=new T.CanvasTexture(signCanvas);signTex.colorSpace=T.SRGBColorSpace;const sign=new T.Mesh(new T.PlaneGeometry(2.45,.34),new T.MeshBasicMaterial({map:signTex}));sign.position.set(-1.5,3.83,.24);scene.add(sign);
// A few physical masonry courses instead of visual noise across the entire facade.
for(let y=.45;y<3.25;y+=.38)box(-7,y,.025,2.9,.015,.015,pale);
function bench(x,z,rot=0){let group=[];for(let i=0;i<4;i++)group.push([0,.63,(i-1.5)*.18,1.85,.09,.13,wood]);group.push([0,1.03,-.31,1.85,.4,.09,wood]);for(let a of [-.7,.7]){group.push([a,.33,0,.09,.6,.55,dark]);group.push([a,.8,-.31,.09,.8,.09,dark])}for(let [dx,y,dz,w,h,d,m] of group){let xx=x+dx*Math.cos(rot)+dz*Math.sin(rot),zz=z-dx*Math.sin(rot)+dz*Math.cos(rot);box(xx,y,zz,w,h,d,m,0,rot)}}bench(5,4,-.15);bench(-6,3,.3);
function planter(x,z,w,d){box(x,.19,z,w,.38,d,pale);box(x,.4,z,w-.2,.07,d-.2,soil)}planter(6,-1,3,1.8);planter(-5,7,3.5,1.6);planter(5,9,2.5,1.4);
// Deterministic fine leaves: individual soft elliptical cards, no oversized polyhedron crowns.
let seed=37;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
const leafCanvas=document.createElement('canvas');leafCanvas.width=64;leafCanvas.height=64;let lc=leafCanvas.getContext('2d');lc.fillStyle='#fff';lc.beginPath();lc.ellipse(32,32,24,13,-.35,0,Math.PI*2);lc.fill();const leafTexture=new T.CanvasTexture(leafCanvas);const leafMat=new T.MeshStandardMaterial({color:'#839f7f',map:leafTexture,alphaMap:leafTexture,alphaTest:.5,side:T.DoubleSide,roughness:1});const leafGeo=new T.PlaneGeometry(.38,.25);let leaves=[];
function tree(x,z,s=1){cyl(x,2.1*s,z,.16*s,.28*s,4.2*s,bark);for(let i=0;i<6;i++){let a=i*Math.PI/3;let bx=x+Math.cos(a)*.55*s,bz=z+Math.sin(a)*.55*s;cyl(bx,3.7*s,bz,.055*s,.11*s,1.9*s,bark,Math.sin(a)*.5,0,-Math.cos(a)*.5)}for(let i=0;i<1150;i++){let a=rand()*Math.PI*2,r=Math.sqrt(rand())*2.0*s,yy=(4.15+rand()*2.0)*s;let o=new T.Object3D();o.position.set(x+Math.cos(a)*r,yy,z+Math.sin(a)*r);o.rotation.set(rand()*2,rand()*6,rand()*3);let k=(.7+rand()*.7)*s;o.scale.set(k,k,k);o.updateMatrix();leaves.push(o.matrix.clone())}}
tree(-11,-6,1.05);tree(10,-6,1);tree(-12,6,.85);
const leafMesh=new T.InstancedMesh(leafGeo,leafMat,leaves.length);leaves.forEach((m,i)=>leafMesh.setMatrixAt(i,m));leafMesh.castShadow=true;leafMesh.receiveShadow=true;scene.add(leafMesh);
// Small rounded planting is confined inside beds, never scattered over pavement.
const shrubGeo=new T.SphereGeometry(1,8,6);const shrubMat=mat('#86a182');const shrubs=[];const flowers=[];for(let [x,z,w,d] of [[6,-1,2.7,1.5],[-5,7,3.2,1.3],[5,9,2.2,1.1]])for(let i=0;i<32;i++){let xx=x+(rand()-.5)*w,zz=z+(rand()-.5)*d;let o=new T.Object3D();o.position.set(xx,.49,zz);o.scale.set(.16,.10,.16);o.updateMatrix();shrubs.push(o.matrix.clone());if(i%2===0){o.position.y=.64+rand()*.16;o.scale.setScalar(.045+rand()*.025);o.updateMatrix();flowers.push(o.matrix.clone())}}
for(let [arr,m] of [[shrubs,shrubMat],[flowers,mat('#e7c7be')]]){let o=new T.InstancedMesh(shrubGeo,m,arr.length);arr.forEach((t,i)=>o.setMatrixAt(i,t));o.castShadow=true;o.receiveShadow=true;scene.add(o)}
for(let [m,parts] of batches){let geo=mergeGeometries(parts);for(let p of parts)p.dispose();let mesh=new T.Mesh(geo,m);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh)}
let frameCount=0;window.__sampleStats=()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,frameCount,camera:camera.position.toArray(),target:controls.target.toArray()});window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);frameCount++});
