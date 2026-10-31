import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Vector2, Vector3 } from 'three';
import { PlayerController } from '../../src/scene/PlayerController';
import { StudentModel } from '../../src/scene/StudentModel';
import { ElementDouble } from './controller-harness';

// Exercise the actual controller's movement math and input mapping without
// claiming these DOM doubles are a substitute for browser input tests.
type Inputs = { yaw: number; joystick: Vector2; onKeyDown: (e: KeyboardEvent) => void; onKeyUp: (e: KeyboardEvent) => void };
let player: PlayerController;
let inputs: Inputs;
const key = (code: string) => ({ code, target: null, repeat: false, preventDefault() {} }) as unknown as KeyboardEvent;
beforeEach(() => {
  vi.stubGlobal('Element', ElementDouble);
  vi.stubGlobal('document', Object.assign(new EventTarget(), { createElement: () => new ElementDouble() }));
  vi.stubGlobal('window', new EventTarget());
  vi.spyOn(performance, 'now').mockReturnValue(0);
  vi.spyOn(StudentModel, 'load').mockReturnValue(new Promise<StudentModel>(() => {}));
  player = new PlayerController(new ElementDouble() as unknown as HTMLElement, new ElementDouble() as unknown as HTMLCanvasElement);
  inputs = player as unknown as Inputs;
});
afterEach(() => { player.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('camera-relative movement', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    it(`maps keyboard and stick to camera axes at yaw ${yaw}`, () => {
      inputs.yaw = yaw;
      player.setPosition([0, 0]);
      player.updateCamera(true);
      // Derive view axes from the real camera, independently of movement math.
      const forward = new Vector3();
      player.camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
      const right = forward.clone().cross(new Vector3(0, 1, 0)).normalize();
      const move = (code?: string, stick?: [number, number]) => {
        player.setPosition([0, 0]);
        if (code) inputs.onKeyDown(key(code));
        if (stick) inputs.joystick.set(...stick);
        player.update(.1);
        const delta = player.avatar.position.clone(); delta.y = 0;
        if (code) inputs.onKeyUp(key(code));
        inputs.joystick.set(0, 0);
        return delta;
      };
      for (const code of ['KeyA', 'ArrowLeft']) expect(move(code).dot(right)).toBeLessThan(-.3);
      for (const code of ['KeyD', 'ArrowRight']) expect(move(code).dot(right)).toBeGreaterThan(.3);
      expect(move(undefined, [-1, 0]).dot(right)).toBeLessThan(-.3);
      expect(move(undefined, [1, 0]).dot(right)).toBeGreaterThan(.3);
      for (const code of ['KeyW', 'ArrowUp']) expect(move(code).dot(forward)).toBeGreaterThan(.3);
      for (const code of ['KeyS', 'ArrowDown']) expect(move(code).dot(forward)).toBeLessThan(-.3);
      expect(move(undefined, [0, -1]).dot(forward)).toBeGreaterThan(.3);
      expect(move(undefined, [0, 1]).dot(forward)).toBeLessThan(-.3);
      expect(inputs.yaw).toBe(yaw);
    });
  }
});
