import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { campuses } from '../../src/campus-data/campuses';
import { disposeObject } from '../../src/scene/CampusScene';
import { PlayerController } from '../../src/scene/PlayerController';
import { createOriginalViewingPlatform, VIEWING_PLATFORM } from '../../src/scene/OriginalViewingPlatform';
import { StudentModel } from '../../src/scene/StudentModel';
import { ElementDouble } from './controller-harness';
// Isolated real Octree/controller regression, not a natural browser journey.
let player:PlayerController;
let input:{yaw:number;pitch:number;velocityY:number;onKeyDown:(e:KeyboardEvent)=>void;onKeyUp:(e:KeyboardEvent)=>void};
const key=(code:string)=>({code,target:null,repeat:false,preventDefault(){}}) as unknown as KeyboardEvent;
const down=(code:string)=>input.onKeyDown(key(code));
const up=(code:string)=>input.onKeyUp(key(code));
const frames=(n:number,dt=1/60)=>{for(let i=0;i<n;i++)player.update(dt);};
function box(group:Group,x:number,y:number,z:number,w:number,h:number,d:number){const m=new Mesh(new BoxGeometry(w,h,d),new MeshBasicMaterial());m.position.set(x,y,z);group.add(m);}
function world(props:Group){player.setCampus({...campuses.yingxi,features:[],modelObstacles:[],boundary:[]},props);disposeObject(props);player.setPosition([0,-1]);input.yaw=0;}
function stairs(){const g=new Group();for(let i=0;i<6;i++){const h=.3+i*.18;box(g,0,h/2,i*.5,3,h,.5);}box(g,0,.6,4,4,1.2,3);return g;}
beforeEach(()=>{vi.stubGlobal('Element',ElementDouble);vi.stubGlobal('document',Object.assign(new EventTarget(),{createElement:()=>new ElementDouble()}));vi.stubGlobal('window',new EventTarget());vi.spyOn(performance,'now').mockReturnValue(0);vi.spyOn(StudentModel,'load').mockReturnValue(new Promise<StudentModel>(()=>{}));player=new PlayerController(new ElementDouble() as unknown as HTMLElement,new ElementDouble() as unknown as HTMLCanvasElement);input=player as unknown as typeof input;});
afterEach(()=>{player.dispose();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('vertical controller and finite world queries',()=>{
  it.each([false,true])('walks six 0.18m rises and descends without jumping (run=%s)',run=>{
    world(stairs());if(run)down('ShiftLeft');down('KeyW');frames(run?45:86);up('KeyW');up('ShiftLeft');frames(30);
    expect(player.avatar.position.y).toBeCloseTo(1.201,2);expect(player.shadow.visible).toBe(true);expect(player.shadow.position.y).toBeCloseTo(1.215,2);
    down('KeyS');frames(120);up('KeyS');frames(60);expect(player.avatar.position.y).toBeCloseTo(.12,2);expect(player.shadow.position.y).toBeCloseTo(.135,2);
  });
  it('retains exact XYZ and height when disabled and paused, then resumes',()=>{
    world(stairs());down('KeyW');frames(86);up('KeyW');frames(30);const pose=player.avatar.position.clone();
    player.setEnabled(false);down('KeyW');frames(120);expect(player.avatar.position.equals(pose)).toBe(true);
    player.setEnabled(true);player.setPaused(true);frames(120);expect(player.avatar.position.equals(pose)).toBe(true);player.setPaused(false);frames(1);expect(player.avatar.position.y).toBeCloseTo(pose.y,2);
  });
  it('jumps from the deck, hides airborne shadow, and lands on support',()=>{
    world(stairs());down('KeyW');frames(86);up('KeyW');frames(30);down('Space');frames(15);up('Space');expect(player.avatar.position.y).toBeGreaterThan(1.5);expect(player.shadow.visible).toBe(false);frames(90);expect(player.avatar.position.y).toBeCloseTo(1.201,2);
  });
  it('cancels upward velocity on a low ceiling instead of repeatedly pushing into it',()=>{
    const g=new Group();box(g,0,2.2,-1,4,.2,4);world(g);down('Space');frames(8);up('Space');expect(input.velocityY).toBeLessThanOrEqual(0);frames(90);expect(player.avatar.position.y).toBeCloseTo(.12,2);
  });
  it.each([false,true])('ascends and descends the actual authored platform (run=%s)',run=>{
    const platform=createOriginalViewingPlatform();player.setCampus(campuses.yingxi,platform.colliders);platform.dispose();
    player.setPosition([VIEWING_PLATFORM.approach[0],VIEWING_PLATFORM.approach[2]]);input.yaw=0;
    if(run)down('ShiftLeft');down('KeyW');frames(run?52:100);up('KeyW');up('ShiftLeft');frames(30);
    expect(player.avatar.position.z).toBeGreaterThan(177);expect(player.avatar.position.y).toBeCloseTo(1.201,2);
    const top=player.avatar.position.clone();down('KeyW');frames(160);up('KeyW');
    expect(player.avatar.position.z).toBeLessThan(181.1);expect(player.avatar.position.y).toBeCloseTo(top.y,2);
    down('KeyS');frames(180);up('KeyS');frames(30);expect(player.avatar.position.z).toBeLessThan(173.8);expect(player.avatar.position.y).toBeCloseTo(.12,2);
  });
  it.each([1/60,.1])('handles diagonal stair approach and side guard at dt=%s',dt=>{
    const platform=createOriginalViewingPlatform();player.setCampus(campuses.yingxi,platform.colliders);platform.dispose();player.setPosition([60,172.8]);input.yaw=.08;
    down('ShiftLeft');down('KeyW');frames(Math.ceil(.95/dt),dt);up('KeyW');up('ShiftLeft');frames(30);
    expect(player.avatar.position.y).toBeCloseTo(1.201,2);expect(player.avatar.position.toArray().every(Number.isFinite)).toBe(true);
    input.yaw=0;down('KeyD');frames(180);up('KeyD');expect(player.avatar.position.x).toBeGreaterThan(57.9);expect(player.avatar.position.y).toBeCloseTo(1.201,2);
  });
  it('offers a framed elevated garden view not blocked by the platform rail',()=>{
    const platform=createOriginalViewingPlatform();try{
      player.setCampus(campuses.yingxi,platform.colliders);player.resize(1440,960);player.setPosition([60,172.8]);input.yaw=0;down('KeyW');frames(110);up('KeyW');frames(30);
      const photo=VIEWING_PLATFORM.photo,raycaster=new Raycaster();let found=false;
      input.yaw=Math.atan2(photo.target[0]-player.avatar.position.x,photo.target[2]-player.avatar.position.z);
      for(const pitch of [-.7,-.55,-.4,-.25,-.15,0,.15,.3,.45,.6,.75]){
        input.pitch=pitch;player.updateCamera(true);player.camera.updateMatrixWorld(true);
        const fits=(xyz:readonly number[],max:number)=>{const p=new Vector3(xyz[0],xyz[1],xyz[2]).project(player.camera);return p.z>=-1&&p.z<=1&&Math.abs(p.x)<=max&&Math.abs(p.y)<=max;};
        if(!fits(photo.target,.45)||!photo.focusExtent.every(p=>fits(p,.45))||!photo.frameExtent.every(p=>fits(p,.95)))continue;
        const blocked=[photo.target,...photo.focusExtent].some(p=>{const delta=new Vector3(...p).sub(player.camera.position);raycaster.set(player.camera.position,delta.clone().normalize());raycaster.far=delta.length()-.2;return raycaster.intersectObject(platform.visual,true).length>0;});
        if(!blocked){found=true;break;}
      }
      expect(found,'Actual controller camera framing and platform-only ray occlusion (not full scene trial)').toBe(true);
    }finally{platform.dispose();}
  });
  it('rejects initial points inside overlapping solid proxies',()=>{
    const g=new Group();box(g,0,1,0,4,2,4);box(g,.5,1,0,4,2,4);world(g);expect(player.pointBlocked([0,1,0])).toBe(true);
  });
  it('finite segment collision catches thin walls only within segment and actual height',()=>{
    const g=new Group();box(g,0,1,0,.02,2,4);world(g);
    expect(player.segmentHit([-1,1,0],[1,1,0])?.fraction).toBeCloseTo(.495,3);
    expect(player.segmentHit([-1,3,0],[1,3,0])).toBeNull();expect(player.segmentHit([-1,1,0],[-.5,1,0])).toBeNull();expect(player.segmentHit([-1,1,0],[-1,1,0])).toBeNull();
    expect(player.pointBlocked([0,1,0])).toBe(true);expect(player.pointBlocked([0,3,0])).toBe(false);expect(player.pointBlocked([NaN,1,0])).toBe(true);
  });
});
