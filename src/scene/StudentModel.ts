import * as THREE from 'three';
import { OriginalJumpPose } from './OriginalJumpPose';

/** Quaternius CC0 character, normalized independently from the collider.
 * The model's Idle/Walk/Run clips are authored in-place; airborne layers an
 * original pose over Idle, not a jump clip from the upstream asset. */
export type StudentMotion = 'idle' | 'walk' | 'run' | 'airborne';

function disposeModel(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse(object => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
    }
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
  root.removeFromParent();
}

export class StudentModel {
  readonly root = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions: Record<'idle' | 'walk' | 'run', THREE.AnimationAction>;
  private active: 'idle' | 'walk' | 'run' = 'idle';
  private disposed = false;
  private readonly jumpPose: OriginalJumpPose;
  private jumpWeight = 0;
  private wasAirborne = false;

  private constructor(private readonly model: THREE.Group, clips: Record<'idle' | 'walk' | 'run', THREE.AnimationClip>) {
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('Invalid student model dimensions');
    const scale = 1.75 / size.y;
    model.scale.setScalar(scale);
    model.position.set(-(box.min.x + box.max.x) * .5 * scale, -box.min.y * scale, -(box.min.z + box.max.z) * .5 * scale);
    model.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = false; object.receiveShadow = true; } });
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = { idle: this.mixer.clipAction(clips.idle), walk: this.mixer.clipAction(clips.walk), run: this.mixer.clipAction(clips.run) };
    this.actions.idle.play();
    this.jumpPose = new OriginalJumpPose(model);
  }

  static async load(): Promise<StudentModel> {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/characters/casual-hoodie.glb`);
    try {
      const idle = gltf.animations.find(clip => clip.name === 'Idle');
      const walk = gltf.animations.find(clip => clip.name === 'Walk');
      const run = gltf.animations.find(clip => clip.name === 'Run');
      if (!idle || !walk || !run) throw new Error('Student locomotion clips are missing');
      return new StudentModel(gltf.scene, { idle, walk, run });
    } catch (error) {
      disposeModel(gltf.scene);
      throw error;
    }
  }

  update(motion: StudentMotion, dt: number): void {
    if (this.disposed) return;
    this.jumpPose.restore();
    const airborne = motion === 'airborne';
    if (airborne && !this.wasAirborne) {
      // The authored offsets were validated ONLY on Idle. Stop every action,
      // including in-flight crossfades, before applying any pose to the rig.
      this.mixer.stopAllAction();
      this.actions.idle.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
      this.active = 'idle';
    }
    const releasingPose = !airborne && this.jumpWeight > 0;
    this.jumpWeight = THREE.MathUtils.clamp(this.jumpWeight + (airborne ? 1 : -1) * Math.max(0, dt) / .12, 0, 1);
    // Even if a large dt finishes release in this call, keep Idle until after
    // the old pose is entirely removed; locomotion can resume on the next call.
    const next = airborne || releasingPose ? 'idle' : motion;
    if (next !== this.active) {
      const previous = this.actions[this.active], incoming = this.actions[next];
      incoming.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
      previous.crossFadeTo(incoming, .2, false);
      this.active = next;
    }
    this.mixer.update(dt);
    if (this.jumpWeight > 0) this.jumpPose.apply(this.jumpWeight);
    this.wasAirborne = airborne;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.jumpPose.restore();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    disposeModel(this.root);
  }
}
