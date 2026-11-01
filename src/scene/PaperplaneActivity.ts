import * as THREE from 'three';
import { createPaperplane, type PaperplaneConfig, type PaperplaneState } from '../games/paperplane';
import type { PaperplaneInput, PaperplaneSnapshot } from '../shared/contracts';
import type { PlayerController } from './PlayerController';

/** A camera/mesh adapter driven exclusively by CampusScene's existing RAF. */
export class PaperplaneActivity {
  readonly root = new THREE.Group();
  readonly camera = new THREE.PerspectiveCamera(58, 1, .1, 1500);
  private readonly simulation;
  private readonly plane: THREE.Mesh;
  private readonly keys = new Set<string>();
  private touch: PaperplaneInput = { turn: 0, pitch: 0 };
  private published = 0;
  private disposed = false;
  private readonly gates: THREE.Mesh[] = [];
  private readonly keyDown = (event: KeyboardEvent) => {
    if (this.simulation.getState().paused || this.simulation.getState().mode !== 'flying') return;
    if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable=true],button,a')) return;
    if (['KeyA','KeyD','KeyW','KeyS','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code)) { event.preventDefault(); this.keys.add(event.code); }
  };
  private readonly keyUp = (event: KeyboardEvent) => { this.keys.delete(event.code); };
  private readonly interruption = () => { this.pause(); };
  private readonly visibility = () => { if (document.hidden) this.pause(); };
  constructor(private readonly config: PaperplaneConfig, player: PlayerController, private readonly publish: (snapshot: PaperplaneSnapshot, pose: {position:[number,number,number];heading:number;pitch:number}) => void) {
    this.simulation = createPaperplane(config, {
      segmentHit: (a,b) => player.segmentHit([a.x,a.y,a.z],[b.x,b.y,b.z]),
      isSolid: p => player.pointBlocked([p.x,p.y,p.z]),
    });
    this.root.userData.photoIgnore = true;
    const geometry = new THREE.BufferGeometry();
    // Original folded-paper silhouette; local forward is -Z.
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0,.07,-.65, -.5,0,.35, 0,.13,.15,
      0,.07,-.65, 0,.13,.15, .5,0,.35,
      0,.07,-.65, 0,-.08,.3, -.5,0,.35,
      0,.07,-.65, .5,0,.35, 0,-.08,.3,
    ],3));
    geometry.computeVertexNormals();
    this.plane = new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xfff2d2,roughness:.9,side:THREE.DoubleSide}));
    this.root.add(this.plane);
    for (const gate of config.gates) {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(gate.radius,.09,6,32),new THREE.MeshBasicMaterial({color:0xe4ad51}));
      mesh.position.set(gate.center.x,gate.center.y,gate.center.z);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(gate.normal.x,gate.normal.y,gate.normal.z).normalize());
      this.gates.push(mesh); this.root.add(mesh);
    }
    const landing = new THREE.Mesh(new THREE.RingGeometry(config.landing.radius-.15,config.landing.radius,48),new THREE.MeshBasicMaterial({color:0xeee7bc,side:THREE.DoubleSide}));
    landing.rotation.x = -Math.PI/2; landing.position.set(config.landing.center.x,config.groundY+.02,config.landing.center.z); this.root.add(landing);
    window.addEventListener('keydown',this.keyDown); window.addEventListener('keyup',this.keyUp);
    window.addEventListener('blur',this.interruption); window.addEventListener('resize',this.interruption);
    // Pointer ownership stays in PaperplanePanel: releasing/cancelling one
    // captured control must preserve the aggregate of its other held pointers.
    // Only whole-activity lifecycle interruptions clear every input here.
    document.addEventListener('visibilitychange',this.visibility);
    this.render(this.simulation.getState()); this.emit();
  }
  private clearInput() { this.keys.clear(); this.touch = {turn:0,pitch:0}; }
  private emit() {
    const state = this.simulation.getState(), reason = state.result?.reason;
    const result: PaperplaneSnapshot['result'] = !reason ? null : reason === 'landed' ? 'success' : reason === 'missed-gates' ? 'missed-gate' : reason === 'out-of-bounds' || reason === 'timeout' || reason === 'cancelled' ? reason : 'collision';
    this.publish({phase:state.mode,paused:state.paused,elapsed:state.elapsed,gatesPassed:state.gateIndex,gateCount:this.config.gates.length,result},{position:[state.position.x,state.position.y,state.position.z],heading:state.heading,pitch:state.pitch});
  }
  private render(state: PaperplaneState) {
    const p = new THREE.Vector3(state.position.x,state.position.y,state.position.z);
    this.plane.position.copy(p); this.plane.rotation.set(state.pitch,-state.heading,0,'YXZ');
    const forward = new THREE.Vector3(Math.sin(state.heading),0,-Math.cos(state.heading));
    this.camera.position.copy(p).addScaledVector(forward,-5).add(new THREE.Vector3(0,2,0));
    this.camera.lookAt(p.clone().addScaledVector(forward,4));
    this.gates.forEach((gate,index) => { gate.visible = index >= state.gateIndex; });
  }
  resize(width: number,height: number) { this.camera.aspect = Math.max(1,width)/Math.max(1,height); this.camera.updateProjectionMatrix(); }
  input(value: PaperplaneInput) { this.touch = {turn:Number.isFinite(value.turn) ? THREE.MathUtils.clamp(value.turn,-1,1) : 0,pitch:Number.isFinite(value.pitch) ? THREE.MathUtils.clamp(value.pitch,-1,1) : 0}; }
  launch() { if (this.disposed || document.hidden) return; this.clearInput(); this.simulation.launch(); this.emit(); }
  retry() { if (this.disposed) return; this.clearInput(); const update = this.simulation.retry(); this.render(update.state); this.emit(); }
  pause() { if (this.disposed) return; this.clearInput(); this.simulation.setPaused(true); this.emit(); }
  resume() { if (this.disposed || document.hidden) return; this.clearInput(); this.simulation.setPaused(false); this.emit(); }
  update(dt: number) {
    if (this.disposed) return;
    const turn = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const pitch = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const update = this.simulation.advance(dt,{turn:turn+this.touch.turn,pitch:pitch+this.touch.pitch});
    this.render(update.state); this.published += dt;
    if (update.events.length || this.published >= .1) { this.published = 0; this.emit(); }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.clearInput(); this.simulation.cancel();
    window.removeEventListener('keydown',this.keyDown); window.removeEventListener('keyup',this.keyUp);
    window.removeEventListener('blur',this.interruption); window.removeEventListener('resize',this.interruption);
    document.removeEventListener('visibilitychange',this.visibility);
    this.root.removeFromParent();
    this.root.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose(); } });
  }
}
