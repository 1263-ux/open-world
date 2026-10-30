import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, BoxGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { OriginalJumpPose } from '../../src/scene/OriginalJumpPose';
import { StudentModel } from '../../src/scene/StudentModel';
import data from '../../src/scene/jump-pose.json' with { type: 'json' };

function rig() {
  const model=new Group(),bones:Record<string,Bone>={};
  for(const name of new Set([...Object.keys(data.rotations),...Object.keys(data.translations)])) {
    const bone=new Bone();bone.name=name;bone.position.set(.13,-.21,.08);
    bone.quaternion.setFromAxisAngle(new Vector3(0,1,0),.17);model.add(bone);bones[name]=bone;
  }
  const geometry=new BoxGeometry(1,2,1), material=new MeshStandardMaterial();
  model.add(new Mesh(geometry,material));return {model,bones,geometry,material};
}
function snapshot(bones:Record<string,Bone>) {
  return Object.fromEntries(Object.entries(bones).map(([name,bone])=>[name,{position:bone.position.clone(),rotation:bone.quaternion.clone()}]));
}
function expectRestored(bones:Record<string,Bone>, reference:Record<string,{position:Vector3;rotation:Quaternion}>) {
  for(const [name,bone] of Object.entries(bones)) {
    expect(bone.position.distanceTo(reference[name]!.position)).toBeLessThan(1e-7);
    // Quaternion angleTo amplifies ~1e-15 norm drift through acos. Normalize
    // and compare components (accounting for q and -q representing one pose).
    const actual=bone.quaternion.clone().normalize(), expected=reference[name]!.rotation.clone().normalize();
    const sign=actual.dot(expected)<0?-1:1;
    expect(Math.max(Math.abs(actual.x-sign*expected.x),Math.abs(actual.y-sign*expected.y),Math.abs(actual.z-sign*expected.z),Math.abs(actual.w-sign*expected.w))).toBeLessThan(1e-9);
  }
}
describe('original airborne pose',()=>{
  it('replaces old offsets, clamps weight, and restores idempotently over repeated cycles',()=>{
    const {model,bones,geometry,material}=rig();const pose=new OriginalJumpPose(model),baseline=snapshot(bones);
    pose.apply(-1);expectRestored(bones,baseline);
    pose.apply(1);const full=snapshot(bones);pose.apply(9);expectRestored(bones,full);
    for(let i=0;i<1000;i++){pose.apply(1);pose.apply(.4);pose.restore();pose.restore();}
    expectRestored(bones,baseline);geometry.dispose();material.dispose();
  });
  it('rejects an incomplete rig instead of silently producing a broken pose',()=>{
    expect(()=>new OriginalJumpPose(new Group())).toThrow('Missing jump-pose bone');
  });
});

describe('student motion transition lifecycle',()=>{
  it('uses full Idle only in air, restores on landing even with 1s dt, then permits locomotion and cleans up',()=>{
    const {model,bones,geometry,material}=rig(), baseline=snapshot(bones);
    // The constructor is private in production; access it only here for an
    // isolated synthetic-rig unit test, never to control a live game.
    const Constructor=StudentModel as unknown as new (root:Group,clips:Record<'idle'|'walk'|'run',AnimationClip>)=>StudentModel;
    const student=new Constructor(model,{idle:new AnimationClip('Idle',1,[]),walk:new AnimationClip('Walk',1,[]),run:new AnimationClip('Run',1,[])});
    const internals=student as unknown as { actions:Record<'idle'|'walk'|'run',import('three').AnimationAction>; jumpWeight:number };
    let geometryDisposals=0,materialDisposals=0;geometry.addEventListener('dispose',()=>geometryDisposals++);material.addEventListener('dispose',()=>materialDisposals++);
    for(let i=0;i<12;i++) {
      student.update(i%2?'run':'walk',1);
      expect(internals.actions[i%2?'run':'walk'].isRunning()).toBe(true);
      student.update('airborne',1);
      expect(internals.jumpWeight).toBe(1);expect(internals.actions.idle.isRunning()).toBe(true);
      expect(internals.actions.idle.getEffectiveWeight()).toBe(1);
      expect(internals.actions.walk.isRunning()).toBe(false);expect(internals.actions.run.isRunning()).toBe(false);
      // One large landing step releases the pose but must not blend locomotion yet.
      student.update('run',1);expect(internals.jumpWeight).toBe(0);expectRestored(bones,baseline);
      expect(internals.actions.idle.isRunning()).toBe(true);expect(internals.actions.run.isRunning()).toBe(false);
      student.update('run',1);expect(internals.actions.run.isRunning()).toBe(true);
    }
    student.update('airborne',1);student.dispose();expectRestored(bones,baseline);
    expect(geometryDisposals).toBe(1);expect(materialDisposals).toBe(1);
    student.dispose();student.update('airborne',1);
    expect(geometryDisposals).toBe(1);expect(materialDisposals).toBe(1);expectRestored(bones,baseline);
  });
});
