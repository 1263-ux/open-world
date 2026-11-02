import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PlayerController } from '../../src/scene/PlayerController';
import { StudentModel } from '../../src/scene/StudentModel';
import { campuses } from '../../src/campus-data/campuses';
import { ElementDouble } from './controller-harness';
// Real registered input handlers, isolated DOM/Octree. Not browser performance.
class Controls extends ElementDouble {
  readonly children = new Map<string, ElementDouble>();
  override querySelector(selector = '') { if (!this.children.has(selector)) this.children.set(selector, new ElementDouble()); return this.children.get(selector)!; }
}
let player:PlayerController, canvas:ElementDouble, controls:Controls;
function event(type:string, properties:Record<string,unknown> = {}) { return Object.assign(new Event(type, {cancelable:true}), properties); }
const pointer = (type:string,x=600,kind='touch') => event(type,{pointerId:1,pointerType:kind,button:0,clientX:x,clientY:200});
beforeEach(()=>{
  controls=new Controls();canvas=new ElementDouble();Object.assign(canvas,{getBoundingClientRect:()=>({left:0,top:0,width:1000,height:600})});
  vi.stubGlobal('Element',ElementDouble);vi.stubGlobal('document',Object.assign(new EventTarget(),{createElement:()=>controls}));vi.stubGlobal('window',new EventTarget());
  vi.spyOn(performance,'now').mockReturnValue(0);vi.spyOn(StudentModel,'load').mockReturnValue(new Promise<StudentModel>(()=>{}));
  player=new PlayerController(new ElementDouble() as unknown as HTMLElement,canvas as unknown as HTMLCanvasElement);player.setCampus(campuses.yingxi);
});
afterEach(()=>{player.dispose();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('reports actual held keyboard immediately before any RAF and clears on release',()=>{
  const pose=player.avatar.position.clone();window.dispatchEvent(event('keydown',{code:'KeyW',repeat:false}));
  expect(player.hasActiveInput).toBe(true);expect(player.avatar.position.equals(pose)).toBe(true);
  window.dispatchEvent(event('keyup',{code:'KeyW'}));expect(player.hasActiveInput).toBe(false);
});
it.each(['mouse','touch'])('reports a held %s look pointer even without a movement delta',kind=>{
  canvas.dispatchEvent(pointer('pointerdown',600,kind));expect(player.hasActiveInput).toBe(true);
  canvas.dispatchEvent(pointer('pointercancel',600,kind));expect(player.hasActiveInput).toBe(false);
});
it('retains held joystick input and clears it only on release',()=>{
  canvas.dispatchEvent(pointer('pointerdown',100));canvas.dispatchEvent(pointer('pointermove',140));expect(player.hasActiveInput).toBe(true);
  player.update(1/60);expect(player.hasActiveInput).toBe(true);canvas.dispatchEvent(pointer('pointerup',140));expect(player.hasActiveInput).toBe(false);
});
it('reports touch run and queued jump independently of keyboard state',()=>{
  const run=controls.querySelector('.touch-run'),jump=controls.querySelector('.touch-jump');
  run.dispatchEvent(pointer('pointerdown'));expect(player.hasActiveInput).toBe(true);run.dispatchEvent(pointer('pointerup'));expect(player.hasActiveInput).toBe(false);
  jump.dispatchEvent(pointer('pointerdown'));expect(player.hasActiveInput).toBe(true);player.update(1/60);expect(player.hasActiveInput).toBe(false);
});
it('keeps the original safe Huyu spawn, faces its gate and restores this view on return',()=>{
  player.setCampus(campuses.huyu);const p=player.avatar.position.clone();
  expect([p.x,p.z]).toEqual(campuses.huyu.start);expect(player.avatar.rotation.y).toBeCloseTo(Math.PI,8);
  expect(player.camera.position.z).toBeGreaterThan(p.z); // behind an avatar looking toward -Z
  window.dispatchEvent(event('keydown',{code:'KeyW',repeat:false}));for(let i=0;i<60;i++)player.update(1/60);window.dispatchEvent(event('keyup',{code:'KeyW'}));
  expect(player.avatar.position.z).toBeLessThan(p.z-3);expect(Math.abs(player.avatar.position.x-p.x)).toBeLessThan(.001);
  player.setCampus(campuses.yingxi);player.setCampus(campuses.huyu);expect([player.avatar.position.x,player.avatar.position.z]).toEqual(campuses.huyu.start);expect(player.avatar.rotation.y).toBeCloseTo(Math.PI,8);
});
