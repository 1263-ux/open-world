import * as T from '../../../game/vendor/three.module.js';
import{GLTFLoader}from'../../../game/vendor/GLTFLoader.js';
import{createDreamThreshold}from'../dream-threshold.js';
import{applyWaterLook,CONFIG}from'./water-look.js';
import{createCompanionStudy}from'./companion-study.js';
try{
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;document.body.prepend(renderer.domElement);
 const scene=new T.Scene(),neutral=new T.Color(.27,.35,.42);scene.add(new T.HemisphereLight(0xb8c8e3,0x66606c,1.4));const moon=new T.DirectionalLight(0xb9cbe5,1.6);moon.position.set(-5,9,8);scene.add(moon);
 const world=await new GLTFLoader().loadAsync('../../receiving-space-v2/edge-fade/receiving-edge-fade.glb');scene.add(world.scene);const threshold=createDreamThreshold(scene);threshold.reveal();threshold.update(4,4,null);
 const seated=await new GLTFLoader().loadAsync('../../../character-lookdev/b2/courier-b2-candidate.glb');
 const actor=seated.scene;actor.name='Actual_B2_seated_context';actor.scale.setScalar(.78);actor.rotation.y=Math.PI/2;actor.position.set(2,.04065,-13.1);scene.add(actor);
 const sitting=seated.animations.find(a=>a.name==='Sitting_Rig');if(!sitting)throw new Error('B2 seated clip missing');const actorMixer=new T.AnimationMixer(actor);actorMixer.clipAction(sitting).play();actorMixer.setTime(0);
 const originals=[];threshold.root.traverse(o=>{if(o.name==='Shallow_water_fading_edge_not_plinth')originals.push({o,geometry:o.geometry,material:o.material});});
 const sky=await new T.TextureLoader().loadAsync('../../../asset-recovery/hdri-study/hdri-preview.png');const water=applyWaterLook(scene,threshold.root,sky),candidate=water.waters.map(o=>({geometry:o.geometry,material:o.material}));let mode='B';
 function select(value){mode=value;originals.forEach((a,i)=>{const src=mode==='A'?a:candidate[i];a.o.geometry=src.geometry;a.o.material=src.material;});scene.background=mode==='B'?sky:neutral;scene.environment=mode==='B'?sky:null;scene.backgroundIntensity=mode==='B'?CONFIG.backgroundIntensity:1;scene.environmentIntensity=mode==='B'?CONFIG.environmentIntensity:0;document.querySelector('#status').textContent=mode==='B'?'B：同源 LDR 天空、真实浅水材质与微波':'A：中性背景、原水材质';}
 document.querySelector('#a').onclick=()=>select('A');document.querySelector('#b').onclick=()=>select('B');select('B');
 const camera=new T.PerspectiveCamera(43,innerWidth/innerHeight,.1,180);camera.position.set(3.7,1.55,-7.4);camera.lookAt(2,.28,-16);
 const selectView=(seatedView)=>{camera.fov=seatedView?48:43;if(seatedView){camera.position.set(2+Math.sin(.35)*4.1,1.8,-13.1+Math.cos(.35)*4.1);camera.lookAt(2,1,-13.1);}else{camera.position.set(3.7,1.55,-7.4);camera.lookAt(2,.28,-16);}camera.updateProjectionMatrix();};
 document.querySelector('#wide').onclick=()=>selectView(false);document.querySelector('#seated').onclick=()=>selectView(true);
 const companionStudy=createCompanionStudy(threshold.bay);function selectCompanion(forward){companionStudy.select(forward);selectView(true);document.querySelector('#companion-status').textContent=forward?'前侧候选：同尺寸鱼缸与纸托，鱼朝邮差的静态姿态研究；非运行行为':'后侧基线：恢复原缸位置与鱼朝向';}document.querySelector('#back-bowl').onclick=()=>selectCompanion(false);document.querySelector('#front-bowl').onclick=()=>selectCompanion(true);


 document.querySelectorAll("button").forEach(button=>{button.disabled=false;});
 function frame(t){requestAnimationFrame(frame);if(mode==='B')water.update(t/1000);renderer.render(scene,camera);}requestAnimationFrame(frame);addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
}catch(e){document.querySelector('#status').textContent='比对尚未启动';document.querySelectorAll('button').forEach(button=>{button.disabled=true;});document.querySelector('#error').textContent='比对页未启动：'+e.message+'。未获得实机画面，不表示作品已验收。';}
