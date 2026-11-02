import * as THREE from 'three';
import { Octree } from 'three/examples/jsm/math/Octree.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import type { CampusData, Point2 } from '../shared/contracts';
import { StudentModel } from './StudentModel';

export interface PlayerCollisionSnapshot {
  readonly octree: Octree;
  readonly solidVolumes: { bounds: THREE.Box3; triangles: THREE.Triangle[] }[];
}

/** Third-person movement against the same source footprints used by the campus renderer. */
export class PlayerController {
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 2500);
  readonly avatar = new THREE.Group();
  private readonly fallback = new THREE.Group();
  private student: StudentModel | null = null;
  private disposed = false;
  private readonly fadeMaterials = new Map<THREE.Material, { opacity: number; depthWrite: boolean }>();
  private avatarOpacity = 1;
  readonly shadow = new THREE.Mesh(new THREE.CircleGeometry(.38, 20), new THREE.MeshBasicMaterial({ color: 0x253a30, transparent: true, opacity: .24, depthWrite: false }));
  private readonly collider = new Capsule(new THREE.Vector3(0, .34, 0), new THREE.Vector3(0, 1.38, 0), .34);
  private octree = new Octree();
  private solidVolumes: { bounds: THREE.Box3; triangles: THREE.Triangle[] }[] = [];
  private readonly keys = new Set<string>();
  private torso: THREE.Mesh | null = null;
  private readonly arms: THREE.Group[] = [];
  private readonly legs: THREE.Group[] = [];
  private velocityY = 0;
  private grounded = true;
  private yaw = 0;
  private pitch = .24;
  private cameraAtTarget = false;
  private cameraTargetYaw = NaN;
  private cameraTargetPitch = NaN;
  private readonly cameraTargetPawn = new THREE.Vector3(NaN, NaN, NaN);
  /** Read-only: desired angles alone do not imply the damped camera has arrived. */
  get cameraSettled(): boolean {
    return this.cameraAtTarget && this.cameraTargetYaw === this.yaw && this.cameraTargetPitch === this.pitch && this.cameraTargetPawn.equals(this.avatar.position);
  }
  /** Live input state, not last-frame motion telemetry; async scenery must never consume a held gesture. */
  get hasActiveInput(): boolean {
    return this.keys.size > 0 || this.pointer.length > 0 || this.joystick.lengthSq() > 0 || this.runHeld || this.jumpQueued;
  }
  private gait = 0;
  private paused = false;
  private enabled = true;
  private jumpQueued = false;
  private runHeld = false;
  private lastAdvance = performance.now();
  private joystick = new THREE.Vector2();
  private pointer: { id: number; x: number; y: number; kind: 'move' | 'look'; startX: number; startY: number }[] = [];
  private readonly ui: HTMLDivElement;
  private readonly stick: HTMLDivElement;
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (this.paused || !this.enabled) return;
    if (e.target instanceof Element) {
      if (e.target.closest('input, textarea, select, [contenteditable=true]')) return;
      // WASD remains useful after using a scene button, but never steal Space
      // or arrow-key activation/navigation from an interactive control.
      if (e.target.closest('button, a') && !['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(e.code)) return;
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
      e.preventDefault();
      this.advance();
      this.keys.add(e.code);
      if (e.code === 'Space' && !e.repeat) this.jumpQueued = true;
    }
  };
  private readonly onKeyUp = (e: KeyboardEvent) => { this.advance(); this.keys.delete(e.code); };
  private readonly onBlur = () => { this.advance(); this.keys.clear(); this.pointer = []; this.joystick.set(0, 0); this.runHeld = false; this.jumpQueued = false; this.stick.style.transform = ''; };
  private readonly onVisibilityChange = () => { if (document.hidden) this.onBlur(); };
  private readonly onPointerDown = (e: PointerEvent) => {
    if (!this.enabled || this.paused || e.button !== 0 || this.pointer.some(p => p.id === e.pointerId)) return;
    const rect = this.canvas.getBoundingClientRect();
    const kind = e.pointerType !== 'mouse' && e.clientX - rect.left < rect.width * .48 ? 'move' : 'look';
    if (this.pointer.some(p => p.kind === kind)) return;
    this.pointer.push({ id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, kind });
    this.canvas.setPointerCapture(e.pointerId);
  };
  private readonly onPointerMove = (e: PointerEvent) => {
    const p = this.pointer.find(item => item.id === e.pointerId);
    if (!p || this.paused || !this.enabled) return;
    this.advance();
    if (p.kind === 'look') {
      this.yaw -= (e.clientX - p.x) * .005;
      this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - p.y) * .004, -.7, .8);
      this.canvas.dataset.cameraSettled = String(this.cameraSettled);
    } else {
      const x = (e.clientX - p.startX) / 50, y = (e.clientY - p.startY) / 50;
      this.joystick.set(x, y).clampLength(0, 1);
      this.stick.style.transform = `translate(${this.joystick.x * 25}px, ${this.joystick.y * 25}px)`;
    }
    p.x = e.clientX; p.y = e.clientY;
  };
  private readonly onPointerUp = (e: PointerEvent) => {
    this.advance();
    const p = this.pointer.find(item => item.id === e.pointerId);
    if (p?.kind === 'move') { this.joystick.set(0, 0); this.stick.style.transform = ''; }
    this.pointer = this.pointer.filter(item => item.id !== e.pointerId);
  };
  constructor(container: HTMLElement, private readonly canvas: HTMLCanvasElement) {
    this.camera.rotation.order = 'YXZ';
    this.shadow.rotation.x = -Math.PI / 2;
    this.avatar.add(this.fallback);
    this.makeAvatar();
    this.registerFadeMaterials(this.fallback);
    this.canvas.dataset.playerModel = 'loading';
    void StudentModel.load().then(student => {
      if (this.disposed) { student.dispose(); return; }
      this.student = student; this.avatar.add(student.root); this.registerFadeMaterials(student.root); this.applyAvatarFade(this.avatarOpacity); this.fallback.visible = false;
      this.canvas.dataset.playerModel = 'ready';
    }).catch(() => { if (!this.disposed) this.canvas.dataset.playerModel = 'fallback'; });
    this.ui = document.createElement('div');
    this.ui.className = 'player-controls';
    this.ui.innerHTML = '<div class="virtual-stick" aria-hidden="true"><span></span></div><div class="touch-hint" aria-hidden="true">右侧滑动视角</div><button class="touch-run" type="button" aria-label="按住跑步">跑</button><button class="touch-jump" type="button" aria-label="跳跃">跳</button>';
    this.stick = this.ui.querySelector('.virtual-stick span')!;
    const run = this.ui.querySelector<HTMLButtonElement>('.touch-run')!;
    const jump = this.ui.querySelector<HTMLButtonElement>('.touch-jump')!;
    run.addEventListener('pointerdown', e => { e.preventDefault(); this.advance(); this.runHeld = true; run.setPointerCapture(e.pointerId); });
    run.addEventListener('pointerup', () => { this.advance(); this.runHeld = false; });
    run.addEventListener('pointercancel', () => { this.advance(); this.runHeld = false; });
    run.addEventListener('lostpointercapture', () => { this.advance(); this.runHeld = false; });
    jump.addEventListener('pointerdown', e => { e.preventDefault(); if (this.enabled && !this.paused) { this.advance(); this.jumpQueued = true; } });
    container.appendChild(this.ui);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('lostpointercapture', this.onPointerUp);
  }
  private makeAvatar() {
    const cloth = new THREE.MeshStandardMaterial({ color: 0x315f58, roughness: .9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe3b693, roughness: .95 });
    const trousers = new THREE.MeshStandardMaterial({ color: 0x34434a, roughness: .9 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x302e2a, roughness: .95 });
    const pack = new THREE.MeshStandardMaterial({ color: 0xb47550, roughness: .9 });
    const add = (parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
    };
    this.torso = add(this.fallback, new THREE.CapsuleGeometry(.25, .38, 4, 10), cloth, 0, 1.17, 0);
    add(this.fallback, new THREE.SphereGeometry(.19, 12, 10), skin, 0, 1.68, 0);
    add(this.fallback, new THREE.SphereGeometry(.2, 12, 8, 0, Math.PI * 2, 0, Math.PI * .56), hair, 0, 1.71, 0);
    add(this.fallback, new THREE.BoxGeometry(.35, .45, .15), pack, 0, 1.18, -.24);
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * .29, 1.35, 0); this.fallback.add(arm);
      add(arm, new THREE.CapsuleGeometry(.075, .35, 3, 8), cloth, 0, -.22, 0);
      add(arm, new THREE.SphereGeometry(.075, 8, 6), skin, 0, -.47, 0); this.arms.push(arm);
      const leg = new THREE.Group(); leg.position.set(side * .13, .87, 0); this.fallback.add(leg);
      add(leg, new THREE.CapsuleGeometry(.105, .43, 3, 8), trousers, 0, -.32, 0);
      add(leg, new THREE.BoxGeometry(.18, .1, .27), hair, 0, -.68, .04); this.legs.push(leg);
    }
    // Foot origin and total height ~1.77 m.
    for (const child of this.fallback.children) child.position.y -= .14;
  }
  private registerFadeMaterials(root: THREE.Object3D): void {
    // Avatar materials belong to this controller, not the campus world. Set
    // transparency once, then change only render-state/opacity while moving.
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (this.fadeMaterials.has(material)) continue;
        this.fadeMaterials.set(material, { opacity: material.opacity, depthWrite: material.depthWrite });
        if (!material.transparent) { material.transparent = true; material.needsUpdate = true; }
      }
    });
  }
  private applyAvatarFade(opacity: number): void {
    this.avatarOpacity = opacity;
    for (const [material, original] of this.fadeMaterials) {
      material.opacity = original.opacity * opacity;
      material.depthWrite = opacity >= .999 ? original.depthWrite : false;
    }
    this.avatar.visible = opacity > .001;
    this.canvas.dataset.playerOpacity = opacity.toFixed(3);
  }
  prepareCollision(data: CampusData, props?: THREE.Group): PlayerCollisionSnapshot {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial();
    try {
    const buildingVolumes = [
      ...data.features.filter(f => f.kind === 'building').map(f => ({ polygon: f.polygon, height: f.height })),
      ...(data.modelObstacles ?? []).map(f => ({ polygon: f.polygon, height: f.id.startsWith('gate-') ? 6 : 4.5 })),
    ];
    // The campus outline is a gameplay boundary, not a claimed physical fence.
    // Thin closed boxes are used instead of single-sided planes so the capsule
    // and the camera ray collide consistently from either side of every edge.
    const boundary = data.boundary ?? [];
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i], b = boundary[(i + 1) % boundary.length];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const length = Math.hypot(dx, dz);
      if (length < .001) continue;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(length + .1, 12, .12), mat);
      wall.position.set((a[0] + b[0]) / 2, 6, (a[1] + b[1]) / 2);
      wall.rotation.y = -Math.atan2(dz, dx);
      group.add(wall);
    }
    for (const f of buildingVolumes) {
      if (f.polygon.length < 3) continue;
      const shape = new THREE.Shape();
      shape.moveTo(f.polygon[0][0], -f.polygon[0][1]);
      for (const p of f.polygon.slice(1)) shape.lineTo(p[0], -p[1]);
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.max(3, f.height), bevelEnabled: false });
      geometry.rotateX(-Math.PI / 2);
      group.add(new THREE.Mesh(geometry, mat));
    }
    if (props) {
      const copies = props.clone(true);
      copies.traverse(o => { if (o instanceof THREE.Mesh) o.geometry = o.geometry.clone(); });
      group.add(copies);
    }
    group.updateMatrixWorld(true);
    const octree = new Octree().fromGraphNode(group);
    // Preserve individual closed proxy identities only for launch containment.
    // Global parity would XOR overlapping solids instead of testing their union.
    const solidVolumes: PlayerCollisionSnapshot['solidVolumes'] = [];
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.getAttribute('position'), index = object.geometry.index;
      if (!positions) return;
      const triangles: THREE.Triangle[] = [];
      const vertex = (i: number) => new THREE.Vector3().fromBufferAttribute(positions,index ? index.getX(i) : i).applyMatrix4(object.matrixWorld);
      for (let i=0; i<(index?.count ?? positions.count); i+=3) triangles.push(new THREE.Triangle(vertex(i),vertex(i+1),vertex(i+2)));
      solidVolumes.push({bounds:new THREE.Box3().setFromObject(object),triangles});
    });
    return { octree, solidVolumes };
    } finally {
      const owned = new Set<THREE.BufferGeometry>();
      group.traverse(o => { if (o instanceof THREE.Mesh) owned.add(o.geometry); });
      for (const geometry of owned) geometry.dispose();
      mat.dispose();
    }
  }
  getCollisionSnapshot(): PlayerCollisionSnapshot { return { octree: this.octree, solidVolumes: this.solidVolumes }; }
  get onSharedGround(): boolean { return this.grounded && Math.abs(this.velocityY) < .001 && Math.abs(this.avatar.position.y - .12) < .01; }
  canCommitCollision(next: PlayerCollisionSnapshot): boolean {
    if (!this.onSharedGround) return false;
    const hit = next.octree.capsuleIntersect(this.collider.clone());
    return !(hit && hit.depth > .001) && !this.pointBlocked([this.avatar.position.x, this.avatar.position.y + .9, this.avatar.position.z], next);
  }
  commitCollision(next: PlayerCollisionSnapshot): boolean {
    if (!this.canCommitCollision(next)) return false;
    this.octree = next.octree; this.solidVolumes = next.solidVolumes;
    // Do not call onBlur: it advances old input and could move the saved pose.
    this.keys.clear(); this.pointer = []; this.joystick.set(0, 0);
    this.runHeld = false; this.jumpQueued = false; this.stick.style.transform = '';
    this.lastAdvance = performance.now(); this.cameraAtTarget = false;
    return true;
  }
  restoreCollisionSnapshot(previous: PlayerCollisionSnapshot): void {
    this.octree = previous.octree; this.solidVolumes = previous.solidVolumes;
    this.cameraAtTarget = false;
  }
  setCampus(data: CampusData, props?: THREE.Group) {
    const snapshot = this.prepareCollision(data, props);
    this.octree = snapshot.octree; this.solidVolumes = snapshot.solidVolumes;
    // This is a designed gameplay viewpoint, not a surveyed entrance or a
    // replacement for the source's original route start.
    this.setPosition(data.id === 'yingxi' ? [-20, 175.5] : data.start);
    // Designed first view faces the nearby north gate from the original safe ground.
    this.yaw = data.id === 'huyu' ? Math.PI : -Math.PI / 2;
    this.pitch = -.15;
    this.avatar.rotation.y = this.yaw;
    this.lastAdvance = performance.now();
    this.updateCamera(true);
  }
  setPosition(p: Point2) {
    this.avatar.position.set(p[0], .12, p[1]);
    this.shadow.position.set(p[0], .135, p[1]);
    this.collider.start.set(p[0], .46, p[1]); this.collider.end.set(p[0], 1.5, p[1]);
    this.velocityY = 0; this.grounded = true;
    this.canvas.dataset.cameraSettled = String(this.cameraSettled);
  }
  /** Read-only finite point-proxy query against the existing world Octree. */
  segmentHit(from: [number, number, number], to: [number, number, number]): { fraction: number } | null {
    if (![...from, ...to].every(Number.isFinite)) return { fraction: 0 };
    const start = new THREE.Vector3(...from), delta = new THREE.Vector3(...to).sub(start);
    const length = delta.length();
    if (length < 1e-9) return null;
    const hit = this.octree.rayIntersect(new THREE.Ray(start, delta.divideScalar(length)));
    return hit && hit.distance <= length + 1e-8 ? { fraction: Math.max(0, Math.min(1, hit.distance / length)) } : null;
  }
  /** Interior launch rejection; parity of deduplicated two-sided triangle hits. */
  pointBlocked(point: [number, number, number], snapshot: PlayerCollisionSnapshot = this.getCollisionSnapshot()): boolean {
    if (!point.every(Number.isFinite) || point[1] <= .12) return true;
    const origin = new THREE.Vector3(...point);
    if (snapshot.octree.sphereIntersect(new THREE.Sphere(origin, .03))) return true;
    const ray = new THREE.Ray(origin, new THREE.Vector3(.917, .271, .293).normalize());
    const hit = new THREE.Vector3();
    return snapshot.solidVolumes.some(volume => {
      if (!volume.bounds.containsPoint(origin)) return false;
      const distances: number[] = [];
      for (const triangle of volume.triangles) {
        if (ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit)) {
          const d = hit.distanceTo(origin);
          if (!distances.some(previous => Math.abs(previous-d) < 1e-5)) distances.push(d);
        }
      }
      return distances.length % 2 === 1;
    });
  }
  resize(width: number, height: number) { this.camera.aspect = Math.max(1, width) / Math.max(1, height); this.camera.updateProjectionMatrix(); }
  setEnabled(enabled: boolean) { if (!enabled) this.onBlur(); this.enabled = enabled; this.ui.hidden = !enabled; this.lastAdvance = performance.now(); }
  setPaused(paused: boolean) { if (paused) this.onBlur(); this.paused = paused; this.lastAdvance = performance.now(); }
  /** Advance to the event or frame time before changing input. Input edges
   * must not disappear merely because a slow frame missed a short press. */
  advance() {
    const now = performance.now();
    const dt = Math.min(2, Math.max(0, (now - this.lastAdvance) / 1000));
    this.lastAdvance = now;
    this.update(dt);
  }
  update(dt: number) {
    if (!this.enabled || this.paused || dt <= 0) return;
    const x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this.joystick.x;
    const y = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - this.joystick.y;
    const input = new THREE.Vector2(x, y).clampLength(0, 1);
    const running = this.runHeld || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = running ? 6.5 : 3.4;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // The camera is behind the player, looking along (sin(yaw), 0, cos(yaw)).
    // Its screen-right is forward × world-up = (-cos(yaw), 0, sin(yaw)).
    const movement = new THREE.Vector3((-input.x * cos + input.y * sin) * speed, 0, (input.x * sin + input.y * cos) * speed);
    if (this.jumpQueued && this.grounded) { this.velocityY = 5.5; this.grounded = false; }
    this.jumpQueued = false;
    // At very low rendering rates a whole jump can fit between two frames and
    // be invisible. Slow only the airborne vertical simulation in that case;
    // horizontal movement still uses elapsed time and remains collision-tested.
    const verticalDt = this.grounded ? dt : Math.min(dt, .25);
    const previousX = this.collider.start.x, previousZ = this.collider.start.z;
    // Small fixed substeps limit tunnelling at low frame rates, then project out of collision for wall sliding.
    const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
    const sub = dt / steps, verticalSub = verticalDt / steps;
    for (let i = 0; i < steps; i++) {
      const wasGrounded = this.grounded;
      const previousFoot = this.collider.start.y - this.collider.radius;
      this.grounded = false;
      this.velocityY -= 15 * verticalSub;
      this.collider.translate(new THREE.Vector3(movement.x * sub, this.velocityY * verticalSub, movement.z * sub));
      for (let n = 0; n < 3; n++) {
        const hit = this.octree.capsuleIntersect(this.collider);
        if (!hit) break;
        if (wasGrounded && this.velocityY <= 0 && movement.lengthSq() > 0) {
          // Rounded capsule contact at a ledge can otherwise lift the player
          // up its edge over many frames. Probe the surface just ahead before
          // allowing the .24m step; resolve taller contacts horizontally.
          const horizontalSpeed = Math.hypot(movement.x, movement.z);
          const probe = new THREE.Vector3(this.collider.start.x + movement.x / horizontalSpeed * (this.collider.radius + .05), previousFoot + .75, this.collider.start.z + movement.z / horizontalSpeed * (this.collider.radius + .05));
          const top = this.octree.rayIntersect(new THREE.Ray(probe, new THREE.Vector3(0, -1, 0)));
          const tooHigh = !!top && top.position.y > previousFoot + .24 + .005 && top.position.y <= previousFoot + .75;
          const horizontalNormal = new THREE.Vector3(hit.normal.x, 0, hit.normal.z);
          const normalLength = horizontalNormal.length();
          if (tooHigh && normalLength > .01) {
            const correction = Math.min(.15, (hit.depth + .001) / normalLength);
            horizontalNormal.divideScalar(normalLength);
            // Nearly head-on contact at a polygon vertex should not create a
            // sideways force that slowly walks the player around the planter.
            if (horizontalNormal.x * movement.x / horizontalSpeed + horizontalNormal.z * movement.z / horizontalSpeed < -.98) {
              horizontalNormal.set(-movement.x / horizontalSpeed, 0, -movement.z / horizontalSpeed);
            }
            this.collider.translate(horizontalNormal.multiplyScalar(correction));
            continue;
          }
          if (hit.normal.y < .5 && !tooHigh) {
            const raised = this.collider.clone().translate(new THREE.Vector3(0, .24, 0));
            if (!this.octree.capsuleIntersect(raised)) { this.collider.copy(raised); this.grounded = false; break; }
          }
        }
        if (hit.normal.y < -.5 && this.velocityY > 0) this.velocityY = 0;
        if (hit.normal.y > .5 && this.velocityY <= 0) { this.velocityY = 0; this.grounded = true; }
        this.collider.translate(hit.normal.multiplyScalar(hit.depth + .001));
      }
      const foot = this.collider.start.y - this.collider.radius;
      if (foot <= .12) { this.collider.translate(new THREE.Vector3(0, .12 - foot, 0)); this.velocityY = 0; this.grounded = true; }
    }
    this.avatar.position.set(this.collider.start.x, this.collider.start.y - this.collider.radius, this.collider.start.z);
    // Probe from foot level, not overhead: a roof must never receive this shadow.
    const footY = this.avatar.position.y;
    const support = this.octree.rayIntersect(new THREE.Ray(new THREE.Vector3(this.collider.start.x, footY + .06, this.collider.start.z), new THREE.Vector3(0, -1, 0)));
    const supportY = support && support.distance < .16 ? support.position.y : .12;
    this.shadow.visible = footY - supportY < .15;
    this.shadow.position.set(this.collider.start.x, supportY + .015, this.collider.start.z);
    if (input.lengthSq() > .001) {
      const target = Math.atan2(movement.x, movement.z);
      const delta = Math.atan2(Math.sin(target - this.avatar.rotation.y), Math.cos(target - this.avatar.rotation.y));
      this.avatar.rotation.y += delta * Math.min(1, dt * 12);
      this.gait += dt * (running ? 12 : 8);
    }
    const swing = input.lengthSq() > .001 ? Math.sin(this.gait) * (running ? .65 : .42) : 0;
    this.legs[0].rotation.x = this.grounded ? swing : -.25; this.legs[1].rotation.x = this.grounded ? -swing : .38;
    this.arms[0].rotation.x = this.grounded ? -swing * .8 : -.6; this.arms[1].rotation.x = this.grounded ? swing * .8 : -.6;
    if (this.torso) this.torso.scale.y = 1 + (input.lengthSq() < .001 && this.grounded ? Math.sin(performance.now() * .002) * .015 : 0);
    const travelled = Math.hypot(this.collider.start.x - previousX, this.collider.start.z - previousZ);
    const motion = !this.grounded ? 'airborne' : travelled > dt * .05 ? (running ? 'run' : 'walk') : 'idle';
    this.student?.update(motion, dt);
    this.canvas.dataset.playerMotion = motion;
    this.updateCamera(false);
    this.canvas.dataset.cameraYaw = this.yaw.toFixed(4);
    this.canvas.dataset.cameraPitch = this.pitch.toFixed(4);
    this.canvas.dataset.playerX = this.avatar.position.x.toFixed(3);
    this.canvas.dataset.playerY = this.avatar.position.y.toFixed(3);
    this.canvas.dataset.playerZ = this.avatar.position.z.toFixed(3);
  }
  updateCamera(immediate: boolean) {
    const target = this.avatar.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const horizontal = Math.cos(this.pitch) * 6;
    const desired = target.clone().add(new THREE.Vector3(-Math.sin(this.yaw) * horizontal, Math.sin(this.pitch) * 6 + 1.1, -Math.cos(this.yaw) * horizontal));
    // Looking up lowers the orbit, but the camera must remain above the ground.
    desired.y = Math.max(.6, desired.y);
    const delta = desired.clone().sub(target), distance = delta.length();
    const hit = this.octree.rayIntersect(new THREE.Ray(target, delta.normalize()));
    const obstructed = Boolean(hit && hit.distance < distance);
    if (hit && obstructed) desired.copy(target).addScaledVector(delta, Math.max(.1, hit.distance - .12));
    // Pull in immediately to avoid interpolating through a wall; ease back out when clear.
    if (immediate || obstructed || this.camera.position.lengthSq() === 0) this.camera.position.copy(desired); else this.camera.position.lerp(desired, .22);
    // End the asymptotic tail within 5 mm, then judge photographs at the exact
    // collision-adjusted camera pose. This does not relax framing or sight rays.
    if (this.camera.position.distanceToSquared(desired) <= .005 ** 2) this.camera.position.copy(desired);
    this.cameraAtTarget = this.camera.position.equals(desired);
    this.cameraTargetYaw = this.yaw; this.cameraTargetPitch = this.pitch;
    this.cameraTargetPawn.copy(this.avatar.position);
    this.canvas.dataset.cameraSettled = String(this.cameraSettled);
    this.canvas.dataset.cameraX = this.camera.position.x.toFixed(6);
    this.canvas.dataset.cameraY = this.camera.position.y.toFixed(6);
    this.canvas.dataset.cameraZ = this.camera.position.z.toFixed(6);
    const lookTarget = target.clone().add(new THREE.Vector3(0, Math.max(0, -.15 - this.pitch) * 9, 0));
    this.camera.lookAt(lookTarget);
    this.applyAvatarFade(THREE.MathUtils.smoothstep(this.camera.position.distanceTo(target), 1, 1.8));
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.student?.dispose(); this.student = null;
    this.fadeMaterials.clear(); this.solidVolumes = [];
    window.removeEventListener('keydown', this.onKeyDown); window.removeEventListener('keyup', this.onKeyUp); window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.removeEventListener('lostpointercapture', this.onPointerUp);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown); this.canvas.removeEventListener('pointermove', this.onPointerMove); this.canvas.removeEventListener('pointerup', this.onPointerUp); this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.ui.remove();
  }
}
