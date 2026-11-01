import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { campuses } from '../../src/campus-data/campuses';
import { disposeObject } from '../../src/scene/CampusScene';
import { PlayerController } from '../../src/scene/PlayerController';
import { createOriginalViewingPlatform, VIEWING_PLATFORM, PLATFORM_GROUND_LINKS, PAPERPLANE_STATION } from '../../src/scene/OriginalViewingPlatform';
import { StudentModel } from '../../src/scene/StudentModel';
import { authoredTouchMagnitude } from '../e2e/complete-release-helpers';
import { waypointKeys, walkRoute } from '../e2e/campus-walk';
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
  it('invalidates settled camera synchronously on a real pointer-look handler and converges in finite frames',()=>{
    world(new Group());frames(60);player.updateCamera(true);expect(player.cameraSettled).toBe(true);
    const controls=player as unknown as {canvas:HTMLElement;onPointerDown:(e:PointerEvent)=>void;onPointerMove:(e:PointerEvent)=>void;onPointerUp:(e:PointerEvent)=>void};
    Object.assign(controls.canvas,{getBoundingClientRect:()=>({left:0,top:0,width:1000,height:600})});
    const event=(x:number)=>({pointerId:1,pointerType:'mouse',button:0,clientX:x,clientY:200,preventDefault(){}} as PointerEvent);
    controls.onPointerDown(event(500));controls.onPointerMove(event(700));
    expect(player.cameraSettled).toBe(false);expect(controls.canvas.dataset.cameraSettled).toBe('false');controls.onPointerUp(event(700));
    let count=0;while(!player.cameraSettled&&count<80){player.updateCamera(false);count++;}
    expect(count).toBeGreaterThan(6);expect(count).toBeLessThan(80);expect(player.cameraSettled).toBe(true);
    const settled=player.camera.position.clone();player.updateCamera(true);expect(player.camera.position.distanceTo(settled)).toBeLessThan(1e-10);
    player.updateCamera(false);expect(player.camera.position.equals(settled)).toBe(true);
  });
  it('invalidates the settled camera when pawn height changes, then settles at the new exact target',()=>{
    world(new Group());frames(60);player.updateCamera(true);player.avatar.position.y+=1.2;expect(player.cameraSettled).toBe(false);
    for(let i=0;i<80&&!player.cameraSettled;i++)player.updateCamera(false);
    expect(player.cameraSettled).toBe(true);expect(player.camera.position.toArray().every(Number.isFinite)).toBe(true);
    const settled=player.camera.position.clone();player.updateCamera(true);expect(player.camera.position.distanceTo(settled)).toBeLessThan(1e-10);
  });
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
  it.each([[-20,175.5],[60.859,173.4]])('clears the new props on the existing A* staging route from %s,%s',(x,z)=>{
    const platform=createOriginalViewingPlatform();player.setCampus(campuses.yingxi,platform.colliders);platform.dispose();player.setPosition([x,z]);input.yaw=-Math.PI/2;
    for(const waypoint of walkRoute(campuses.yingxi,[x,z],[60,170])){
      let reached=false;
      for(let attempt=0;attempt<30;attempt++){
        const p=player.avatar.position,dx=waypoint[0]-p.x,dz=waypoint[1]-p.z,distance=Math.hypot(dx,dz);
        if(distance<.9||Math.hypot(p.x-60,p.z-170)<.9){reached=true;break;}
        const keys=waypointKeys(dx,dz,input.yaw);down('ShiftLeft');keys.forEach(down);
        frames(Math.ceil(Math.max(.08,Math.min(.3,distance/6.5*.5))*60));keys.forEach(up);up('ShiftLeft');
      }
      expect(reached,`Legacy staging waypoint ${waypoint}`).toBe(true);
    }
    expect(Math.hypot(player.avatar.position.x-60,player.avatar.position.z-170)).toBeLessThan(.9);
  });
  it('walks every unsnapped ground-link segment around the desk using the real controller',()=>{
    const platform=createOriginalViewingPlatform();player.setCampus(campuses.yingxi,platform.colliders);platform.dispose();player.setPosition([60,170]);input.yaw=-.7;
    for(const target of PLATFORM_GROUND_LINKS[2]!){
      let reached=false;
      for(let pulse=0;pulse<180;pulse++){
        const p=player.avatar.position,dx=target[0]-p.x,dz=target[1]-p.z;
        if(Math.hypot(dx,dz)<.25){reached=true;break;}
        const keys=waypointKeys(dx*4,dz*4,input.yaw);keys.forEach(down);frames(4);keys.forEach(up);
        expect(player.avatar.position.y).toBeLessThan(.2);
      }
      expect(reached,`Reach authored ground corner ${target} without climbing a solid`).toBe(true);
    }
    const p=player.avatar.position;expect(Math.hypot(p.x-PAPERPLANE_STATION.standing[0],p.z-PAPERPLANE_STATION.standing[2])).toBeLessThan(PAPERPLANE_STATION.interactionRadius);
  });
  it.each([[.52,.79,1.163,.9,.65],[1.5,1.65,1.7,1.4]])('analogue touch route converges under measured or slower pulse latencies %j',(...latencies:number[])=>{
    const platform=createOriginalViewingPlatform();player.setCampus(campuses.yingxi,platform.colliders);platform.dispose();player.setPosition([60,170]);input.yaw=0;frames(30);
    const joystick=(player as unknown as {joystick:{set:(x:number,y:number)=>void}}).joystick;
    let pulse=0;
    for(const target of PLATFORM_GROUND_LINKS[2]!){
      let reached=false;
      for(let attempt=0;attempt<180;attempt++){
        const p=player.avatar.position,dx=target[0]-p.x,dz=target[1]-p.z,distance=Math.hypot(dx,dz);
        if(distance<.25){reached=true;break;}
        const magnitude=authoredTouchMagnitude(distance);expect(magnitude).toBeGreaterThan(0);expect(magnitude).toBeLessThanOrEqual(1);
        joystick.set(-dx/distance*magnitude,-dz/distance*magnitude);
        player.update(latencies[pulse++%latencies.length]!);joystick.set(0,0);
        expect(player.avatar.position.y).toBeLessThan(.2);
        expect(Math.hypot(target[0]-player.avatar.position.x,target[1]-player.avatar.position.z)).toBeLessThan(distance);
      }
      expect(reached,`Strict .25m arrival at ${target}`).toBe(true);
    }
    const p=player.avatar.position;expect(Math.hypot(p.x-PAPERPLANE_STATION.standing[0],p.z-PAPERPLANE_STATION.standing[2])).toBeLessThan(PAPERPLANE_STATION.interactionRadius);
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
