// Renderer/DOM doubles isolate synchronous guidance ownership, not GPU or browser UI evidence.
import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ElementDouble } from './controller-harness';
class El extends ElementDouble {
  clientWidth=1280; clientHeight=720; children: ElementDouble[]=[];
  setAttribute() {} removeAttribute() {} focus() {}
  appendChild(e:ElementDouble=new ElementDouble()) { this.children.push(e); return e; }
  getBoundingClientRect() { return {left:0,top:0,width:1280,height:720}; }
}
vi.mock('three',async original=>{const t=await original<typeof import('three')>();return {...t,
  WebGLRenderer:class {domElement=new El();shadowMap={};info={render:{calls:0,triangles:0},memory:{geometries:0,textures:0}};setPixelRatio(){}setSize(){}render(){}dispose(){}},
  TextureLoader:class {load(){return new t.Texture();}},
};});
vi.mock('three/examples/jsm/controls/OrbitControls.js',()=>({OrbitControls:class {target=new THREE.Vector3();addEventListener(){}removeEventListener(){}update(){}dispose(){}}}));
vi.mock('three/examples/jsm/renderers/CSS2DRenderer.js',()=>({CSS2DRenderer:class {domElement=new El();setSize(){}render(){}},CSS2DObject:class extends THREE.Object3D {element=new El();center=new THREE.Vector2();}}));
vi.mock('../../src/scene/StudentModel',()=>({StudentModel:{load:()=>new Promise(()=>{})}}));
vi.mock('../../src/scene/LandmarkModels',async original=>({...await original<typeof import('../../src/scene/LandmarkModels')>(),loadLandmarkModel:()=>new Promise(()=>{})}));
vi.mock('../../src/scene/CampusNatureAssets',async original=>({...await original<typeof import('../../src/scene/CampusNatureAssets')>(),loadCampusNatureAssets:()=>new Promise(()=>{})}));
vi.mock('three/examples/jsm/loaders/GLTFLoader.js',()=>({GLTFLoader:class {loadAsync(){return new Promise(()=>{})}load(){}}}));
import { createCampusScene } from '../../src/scene/CampusScene';
import { PlayerController } from '../../src/scene/PlayerController';
import * as guidance from '../../src/scene/CampusGuidance';
import { campuses } from '../../src/campus-data/campuses';
import type { SceneEvent } from '../../src/shared/contracts';

it('failed guidance keeps pose and storage; an existing route is not silently replaced',()=>{
  vi.stubGlobal('getComputedStyle',()=>({position:'relative'}));
  const win=Object.assign(new El(),{location:{search:''},devicePixelRatio:1,matchMedia:()=>({matches:false})});
  vi.stubGlobal('window',win);vi.stubGlobal('document',Object.assign(new El(),{createElement:()=>new El(),hidden:false}));
  vi.stubGlobal('HTMLElement',El);vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
  const save=new Map([['campus-atlas:quests','existing-progress']]);
  const setItem=vi.fn((k:string,v:string)=>save.set(k,v)),removeItem=vi.fn((k:string)=>save.delete(k));
  vi.stubGlobal('localStorage',{getItem:(k:string)=>save.get(k)??null,setItem,removeItem});
  const prepare=PlayerController.prototype.prepareCollision;const controllers:PlayerController[]=[];
  vi.spyOn(PlayerController.prototype,'prepareCollision').mockImplementation(function(this:PlayerController,data,props){controllers.push(this);return prepare.call(this,data,props);});
  const events:SceneEvent[]=[],scene=createCampusScene(new El() as unknown as HTMLElement,campuses.yingxi,e=>events.push(e));
  try {
    expect(events.filter(e=>e.type==='error')).toEqual([]);const pawn=controllers[0]!;
    const before={position:pawn.avatar.position.toArray(),camera:pawn.camera.position.toArray(),rotation:pawn.camera.quaternion.toArray(),save:[...save]};
    const plan=vi.spyOn(guidance,'planCampusGuidance');
    expect(scene.navigateTo('yx-mechanical')).toBe(true);expect(plan).toHaveBeenCalledTimes(1);
    const eventCount=events.length;
    expect(scene.navigateTo('yx-garden')).toBe(false);expect(plan).toHaveBeenCalledTimes(1);expect(events).toHaveLength(eventCount);
    scene.resetJourney();plan.mockReturnValue(null);
    expect(scene.navigateTo('yx-garden')).toBe(false);expect(events).toHaveLength(eventCount);
    expect({position:pawn.avatar.position.toArray(),camera:pawn.camera.position.toArray(),rotation:pawn.camera.quaternion.toArray(),save:[...save]}).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();expect(removeItem).not.toHaveBeenCalled();
  } finally { scene.dispose();vi.restoreAllMocks();vi.unstubAllGlobals(); }
});
