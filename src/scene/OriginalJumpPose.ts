import * as THREE from 'three';
import data from './jump-pose.json' with { type: 'json' };

/** Original additive pose, authored against the CC0 character's Idle rig.
 * Caller must restore before the mixer advances and apply only over full Idle. */
export class OriginalJumpPose {
  private readonly rotations: { bone: THREE.Object3D; delta: THREE.Quaternion; applied: THREE.Quaternion }[] = [];
  private readonly translations: { bone: THREE.Object3D; delta: THREE.Vector3 }[] = [];
  private appliedWeight = 0;
  private readonly inverse = new THREE.Quaternion();

  constructor(model: THREE.Object3D) {
    for (const [name, value] of Object.entries(data.rotations)) {
      const bone = model.getObjectByName(name);
      if (!bone) throw new Error(`Missing jump-pose bone: ${name}`);
      this.rotations.push({ bone, delta: new THREE.Quaternion(value[0], value[1], value[2], value[3]).normalize(), applied: new THREE.Quaternion() });
    }
    for (const [name, value] of Object.entries(data.translations)) {
      const bone = model.getObjectByName(name);
      if (!bone) throw new Error(`Missing jump-pose bone: ${name}`);
      this.translations.push({ bone, delta: new THREE.Vector3(value[0], value[1], value[2]) });
    }
  }

  restore(): void {
    for (const entry of this.rotations) entry.bone.quaternion.multiply(this.inverse.copy(entry.applied).invert());
    for (const entry of this.translations) entry.bone.position.addScaledVector(entry.delta, -this.appliedWeight);
    for (const entry of this.rotations) entry.applied.identity();
    this.appliedWeight = 0;
  }

  apply(weight: number): void {
    // Replace, rather than accumulate, a previously applied offset.
    this.restore();
    this.appliedWeight = THREE.MathUtils.clamp(weight, 0, 1);
    for (const entry of this.rotations) {
      entry.applied.identity().slerp(entry.delta, this.appliedWeight);
      entry.bone.quaternion.multiply(entry.applied);
    }
    for (const entry of this.translations) entry.bone.position.addScaledVector(entry.delta, this.appliedWeight);
  }
}
