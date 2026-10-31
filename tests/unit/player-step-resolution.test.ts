import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { campuses } from '../../src/campus-data/campuses';
import { disposeObject } from '../../src/scene/CampusScene';
import { PlayerController } from '../../src/scene/PlayerController';
import { createQingzeFallback } from '../../src/scene/QingzeGarden';
import { StudentModel } from '../../src/scene/StudentModel';
import { ElementDouble } from './controller-harness';

// Real controller and Octree, but test-only synthetic time/input and starting
// positions: this is deterministic physics regression, not browser gameplay.
type ControllerInputs = { yaw:number; onKeyDown:(event:KeyboardEvent)=>void; onKeyUp:(event:KeyboardEvent)=>void };
let controller: PlayerController;
let inputs: ControllerInputs;
const event = (code:string) => ({ code, target:null, repeat:false, preventDefault() {} }) as unknown as KeyboardEvent;
const down = (code:string) => inputs.onKeyDown(event(code));
const up = (code:string) => inputs.onKeyUp(event(code));
const frames = (count:number) => { for(let i=0;i<count;i++) controller.update(1/60); };

beforeEach(() => {
  vi.stubGlobal('Element',ElementDouble);
  vi.stubGlobal('document',Object.assign(new EventTarget(),{createElement:()=>new ElementDouble()}));
  vi.stubGlobal('window',new EventTarget());
  vi.spyOn(performance,'now').mockReturnValue(0);
  vi.spyOn(StudentModel,'load').mockReturnValue(new Promise<StudentModel>(()=>{}));
  controller=new PlayerController(new ElementDouble() as unknown as HTMLElement,new ElementDouble() as unknown as HTMLCanvasElement);
  inputs=controller as unknown as ControllerInputs;
});
afterEach(() => { controller.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function gardenAndHallProps(): Group {
  const garden=createQingzeFallback();const props=garden.colliders;
  disposeObject(garden.visual);
  // Matches the three visible hall entrance proxies, not a fabricated taller step.
  for (const [x0,x1,z0,z1,y0,y1] of [
    [-53.16,-51.70,173.30,178.00,0,.12],[-53.16,-52.12,173.38,177.92,.12,.24],[-53.16,-52.50,173.47,177.83,.24,.36],
  ]) {
    const mesh=new Mesh(new BoxGeometry(x1!-x0!,y1!-y0!,z1!-z0!),new MeshBasicMaterial());
    mesh.position.set((x0!+x1!)/2,(y0!+y1!)/2,(z0!+z1!)/2);props.add(mesh);
  }
  return props;
}
function useYingxi() {
  const props=gardenAndHallProps();controller.setCampus(campuses.yingxi,props);disposeObject(props);
}

describe('step resolution using the controller and collision Octree',()=>{
  it('walks the open approach but cannot roll up the 0.40m flower island',()=>{
    useYingxi();controller.setPosition([35.85,200]);inputs.yaw=0;down('KeyW');frames(180);
    const p=controller.avatar.position.clone();
    expect(p.z).toBeGreaterThan(203);expect(p.z).toBeLessThan(204.08);
    expect(p.y).toBeLessThan(.2);expect(Math.abs(p.x-35.85)).toBeLessThan(.2);
    frames(420);const held=controller.avatar.position;
    expect(Math.hypot(held.x-p.x,held.z-p.z)).toBeLessThan(.3);expect(held.y).toBeLessThan(.2);
    up('KeyW');
  });
  it('retains diagonal sliding around the island rather than sticking to its edge',()=>{
    useYingxi();controller.setPosition([35.85,200]);inputs.yaw=0;down('KeyW');frames(180);
    const atRim=controller.avatar.position.clone();down('KeyA');frames(120);up('KeyA');up('KeyW');
    const around=controller.avatar.position;
    expect(around.x).toBeGreaterThan(atRim.x+2);expect(around.z).toBeGreaterThan(206.72);
  });
  it('preserves deliberate jump and landing on the actual island top',()=>{
    useYingxi();controller.setPosition([35.85,200]);inputs.yaw=0;down('KeyW');frames(180);
    down('Space');frames(30);up('KeyW');up('Space');frames(90);
    const p=controller.avatar.position;
    expect(p.z).toBeGreaterThan(204.08);expect(p.z).toBeLessThan(206.72);
    expect(p.y).toBeGreaterThan(.39);expect(p.y).toBeLessThan(.43);
  });
  it('retains the shallow three-step mechanical-hall approach',()=>{
    useYingxi();controller.setPosition([-51.2,175.5]);inputs.yaw=Math.PI;down('KeyA');frames(120);up('KeyA');
    const p=controller.avatar.position;expect(p.x).toBeLessThan(-52.1);expect(p.y).toBeGreaterThan(.33);expect(p.y).toBeLessThan(.4);
  });
  it('still stops at the Huyu main-building wall and Yingxi campus boundary',()=>{
    controller.setCampus(campuses.huyu);inputs.yaw=0;down('ShiftLeft');down('KeyW');frames(1000);up('KeyW');up('ShiftLeft');
    const wall=controller.avatar.position.clone();expect(wall.z).toBeGreaterThan(-144);expect(wall.z).toBeLessThan(-142.78);
    useYingxi();controller.setPosition([33.44,388.76]);inputs.yaw=Math.PI;down('KeyS');frames(600);up('KeyS');
    const boundary=controller.avatar.position;expect(boundary.z).toBeGreaterThan(392);expect(boundary.z).toBeLessThan(394);
  });
});
