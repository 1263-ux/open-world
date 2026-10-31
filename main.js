import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const scene=new T.Scene();scene.background=new T.Color('#dce8df');scene.fog=new T.Fog('#dce8df',55,110);
const camera=new T.PerspectiveCamera(35,innerWidth/innerHeight,.1,200); camera.position.set(19,12,29);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;document.querySelector('#scene').append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,3,0);controls.enableDamping=true;controls.minDistance=13;controls.maxDistance=54;controls.maxPolarAngle=Math.PI*.47;controls.enablePan=false;controls.update();controls.saveState();document.querySelector('#reset').onclick=()=>{controls.enableDamping=false;controls.update();controls.reset();controls.update();controls.enableDamping=true};document.querySelector('#close').onclick=()=>{camera.position.set(8,1.7,15);controls.target.set(-2,2.2,-5);controls.update()};
scene.add(new T.HemisphereLight('#e7f1f3','#8b978a',2.5));const sun=new T.DirectionalLight('#fff0d8',2.0);sun.position.set(-18,30,20);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:1,far:80});sun.shadow.bias=-.0002;sun.shadow.normalBias=.04;scene.add(sun);
const mat=(c,rough=1)=>new T.MeshStandardMaterial({color:c,roughness:rough});const wall=mat('#c8b9a7'),trim=mat('#e5ddcf'),dark=mat('#405d58'),glass=mat('#567b7b',.35),roof=mat('#737e75'),ground=mat('#a9ba9e'),pave=mat('#d6d0c5'),edge=mat('#b4ad98'),wood=mat('#987754'),bark=mat('#756d53');
const texCanvas=document.createElement('canvas');texCanvas.width=256;texCanvas.height=256;const ctx=texCanvas.getContext('2d');ctx.fillStyle='#cdb9a6';ctx.fillRect(0,0,256,256);let ts=27;for(let i=0;i<5000;i++){ts=(ts*1664525+1013904223)>>>0;let x=ts%256;ts=(ts*1664525+1013904223)>>>0;let y=ts%256;ctx.fillStyle=i%2?'rgba(80,73,57,.035)':'rgba(255,255,245,.07)';ctx.fillRect(x,y,1+(i%3),1)}const glassCanvas=document.createElement('canvas');glassCanvas.width=64;glassCanvas.height=128;const gc=glassCanvas.getContext('2d');const gg=gc.createLinearGradient(0,0,64,128);gg.addColorStop(0,'#92b7b3');gg.addColorStop(.48,'#547b79');gg.addColorStop(1,'#385f60');gc.fillStyle=gg;gc.fillRect(0,0,64,128);gc.fillStyle='rgba(230,241,229,.12)';gc.beginPath();gc.moveTo(6,0);gc.lineTo(27,0);gc.lineTo(60,128);gc.lineTo(43,128);gc.closePath();gc.fill();const glassTex=new T.CanvasTexture(glassCanvas);glassTex.colorSpace=T.SRGBColorSpace;glass.map=glassTex;glass.color.set('#ffffff');glass.needsUpdate=true;const stoneTex=new T.CanvasTexture(texCanvas);stoneTex.colorSpace=T.SRGBColorSpace;stoneTex.wrapS=stoneTex.wrapT=T.RepeatWrapping;stoneTex.repeat.set(2,2);wall.map=stoneTex;wall.color.set('#f0e3d5');wall.needsUpdate=true;
function box(x,y,z,w,h,d,m,shadow=true){let o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=shadow;o.receiveShadow=true;scene.add(o);return o}
function cylinder(x,y,z,r1,r2,h,m,n=10){let o=new T.Mesh(new T.CylinderGeometry(r1,r2,h,n),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o}
box(0,-.25,0,90,.5,90,ground,false);
// A continuous paved arrival path and a quiet court, in approximate metres.
box(0,.025,10,7,.08,29,pave,false);box(0,.03,-1,23,.1,13,pave,false);box(-8,.04,6,9,.1,3.5,pave,false);
for(let z=-7;z<24;z+=1.3)box(0,.085,z,7,.018,.018,edge,false);
for(let x=-11;x<=11;x+=1.3)box(x,.09,-1,.018,.018,13,edge,false);
box(-3.6,.1,10,.16,.18,28,trim);box(3.6,.1,10,.16,.18,28,trim);
// Main hall: facade organized around a genuinely recessed central entrance.
box(-6.65,4.35,-10,9.7,8.7,7,wall);box(6.65,4.35,-10,9.7,8.7,7,wall);box(0,6.45,-10,3.6,4.5,7,wall);box(0,2.1,-10.5,3.6,4.2,6,wall);box(0,.3,-6.38,23.5,.6,.7,trim);box(0,8.75,-10,23.5,.35,7.5,trim);box(0,9.15,-10,23,.45,7.1,roof);
// front facade depth and pilasters
for(let x=-11;x<=11;x+=2.75)if(Math.abs(x)>1)box(x,4.5,-6.35,.23,8.4,.35,trim);
for(let y of [3.25,6.25])box(0,y,-6.28,23,.13,.2,trim);
// layered windows, trim and mullions
for(let x of [-9.6,-6.85,-4.1,4.1,6.85,9.6])for(let y of [1.9,4.7,7.2]){
 box(x,y,-6.25,1.95,1.8,.18,trim);box(x,y,-6.13,1.67,1.55,.09,dark);box(x,y,-6.07,1.48,1.38,.04,glass);box(x,y,-6.01,.055,1.45,.05,trim);box(x,y-.1,-6.01,1.5,.055,.05,trim);box(x,y-.96,-6.05,2.1,.14,.38,trim);
}
// Deep entrance shadow, columns, canopy and doors.
box(0,2.05,-7.43,3.55,4.1,.12,dark);box(0,2.05,-7.34,3.25,3.65,.08,glass);box(0,2.05,-7.27,.1,3.65,.08,trim);for(let x of [-1.7,1.7])box(x,2.05,-7.24,.17,3.8,.2,trim);box(0,4.32,-5.72,5.4,.22,1.35,trim);box(0,4.49,-5.72,5.6,.12,1.5,roof);for(let x of [-2.45,2.45])box(x,2.1,-5.17,.22,4.2,.22,trim);
box(0,4.85,-6.12,4.7,.57,.12,dark); // quiet sign band
const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=96;const sc=signCanvas.getContext('2d');sc.fillStyle='#365c57';sc.fillRect(0,0,512,96);sc.fillStyle='#f1ead7';sc.textAlign='center';sc.textBaseline='middle';sc.font='500 50px serif';sc.fillText('校园书屋',256,50);const signTex=new T.CanvasTexture(signCanvas);signTex.colorSpace=T.SRGBColorSpace;const sign=new T.Mesh(new T.PlaneGeometry(4.45,.48),new T.MeshBasicMaterial({map:signTex}));sign.position.set(0,4.85,-6.045);scene.add(sign);
box(0,9.45,-9.8,8,.5,7.3,trim);box(0,9.8,-9.8,8.4,.2,7.55,roof);
// Fine masonry seams break up the large wall without fake photographic texture.
const mortar=mat('#b2ab99');for(let y=.65;y<8.7;y+=.48){box(-6.65,y,-6.47,9.7,.012,.012,mortar,false);box(6.65,y,-6.47,9.7,.012,.012,mortar,false);if(y>4.2)box(0,y,-6.47,3.6,.012,.012,mortar,false);}
// Side wing makes a sheltered corner
box(-15,2.5,-5,7,5,11,wall);box(-15,5.1,-5,7.3,.3,11.2,trim);for(let x of [-17,-14.5,-12]){box(x,2.6,.58,1.7,2.7,.13,trim);box(x,2.6,.67,1.42,2.4,.08,glass);box(x,2.6,.73,.06,2.4,.04,dark)}
// Garden borders, planted islands and bench
function planter(x,z,w,d){box(x,.25,z,w,.5,d,trim);box(x,.52,z,w-.25,.08,d-.25,mat('#665f4d'));}
planter(8,5,5,3);planter(-8,9,4,3);planter(7,-2,4,2);
function bench(x,z){for(let i=0;i<4;i++)box(x,.65,z+(i-1.5)*.23,2.2,.1,.17,wood);box(x,1.1,z-.4,2.2,.55,.1,wood);for(let a of [-.85,.85]){box(x+a,.34,z,.1,.65,.7,dark);box(x+a,.9,z-.4,.1,1.05,.1,dark)}}bench(7,9);bench(-8,3);
// deterministic richly layered tree crowns
let seed=178;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}const greens=['#648469','#779579','#89a485','#a3b99a','#719789','#b4c8aa'].map(c=>mat(c));const leafGeo=new T.SphereGeometry(1,8,6);const foliage=greens.map(()=>[]);function leaf(i,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){const o=new T.Object3D();o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.set(rx,ry,rz);o.updateMatrix();foliage[i].push(o.matrix.clone())}
function tree(x,z,s=1){cylinder(x,2.3*s,z,.20*s,.36*s,4.6*s,bark,9);for(let k=0;k<5;k++){let a=k*1.26;let branch=cylinder(x+Math.cos(a)*.45*s,4.2*s,z+Math.sin(a)*.45*s,.09*s,.17*s,2*s,bark,7);branch.rotation.z=Math.cos(a)*-.45;branch.rotation.x=Math.sin(a)*.45}
 for(let i=0;i<170;i++){let a=rand()*Math.PI*2,r=Math.sqrt(rand())*2.5*s;let ci=Math.floor(rand()*greens.length);leaf(ci,x+Math.cos(a)*r,(5.2+rand()*2.4)*s,z+Math.sin(a)*r,(.32+rand()*.34)*s,(.18+rand()*.20)*s,(.30+rand()*.32)*s,rand(),rand()*3,rand())}}
for(let p of [[-13,11,1.05],[-13,19,1.15],[17,17,1.05],[15,7,1.2],[13,-3,.9],[-21,-1,1],[-20,12,1]])tree(...p);
// Low shrubs and small flowers, grouped rather than scattered across circulation.
function shrub(x,z,s=1){for(let i=0;i<13;i++){let ci=Math.floor(rand()*4);leaf(ci,x+(rand()-.5)*s,.5+rand()*.25,z+(rand()-.5)*s,.27*s,.22*s,.27*s)}}
for(let x=-20;x<21;x+=1.1){if(x<-11||x>11)shrub(x,22,.9)}for(let [x,z,w,d] of [[8,5,4,2],[-8,9,3,2],[7,-2,3,1],[-18,3,3,3],[17,1,4,5]])for(let i=0;i<16;i++)shrub(x+(rand()-.5)*w,z+(rand()-.5)*d,.55);
const flowerM=['#e5d6b3','#e3a8a0','#c2a7c9','#f4e7cc'].map(c=>mat(c));for(let [x,z,w,d] of [[8,5,4,2],[-8,9,3,2],[7,-2,3,1]])for(let i=0;i<32;i++){let xx=x+(rand()-.5)*w,zz=z+(rand()-.5)*d;cylinder(xx,.7,zz,.012,.012,.55,greens[0],5);let o=new T.Mesh(new T.IcosahedronGeometry(.09,0),flowerM[Math.floor(rand()*4)]);o.position.set(xx,.99,zz);scene.add(o)}
// Fine, grouped grass blades soften the transition from paving to lawn.
const grassGeo=new T.ConeGeometry(.045,.55,4);grassGeo.translate(0,.27,0);const grassMat=mat('#829e6e');const grasses=new T.InstancedMesh(grassGeo,grassMat,1500);const dummy=new T.Object3D();for(let i=0;i<1500;i++){let side=rand()<.5?-1:1;let xx=side*(3.9+rand()*4.2),zz=-3+rand()*26;dummy.position.set(xx,.02,zz);dummy.rotation.set((rand()-.5)*.4,rand()*6,(rand()-.5)*.4);let k=.5+rand()*.8;dummy.scale.set(k,k,k);dummy.updateMatrix();grasses.setMatrixAt(i,dummy.matrix)}grasses.castShadow=false;grasses.receiveShadow=true;scene.add(grasses);
// Batch foliage into six draw calls while retaining each crown's shape and color.
foliage.forEach((items,i)=>{if(!items.length)return;const mesh=new T.InstancedMesh(leafGeo,greens[i],items.length);items.forEach((m,j)=>mesh.setMatrixAt(j,m));mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh)});
// Low garden bollards and stepping accents.
for(let z of [5,11,17])for(let x of [-4.25,4.25]){cylinder(x,.48,z,.08,.12,.95,dark,8);cylinder(x,.95,z,.15,.15,.12,trim,8)}
let frameCount=0;window.__sampleStats=()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,frameCount,camera:camera.position.toArray(),target:controls.target.toArray()});window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);frameCount++});
