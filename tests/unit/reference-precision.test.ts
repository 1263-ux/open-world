import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { campuses } from '../../src/campus-data/campuses';
import type { CampusId, Point2 } from '../../src/shared/contracts';
import { PlayerController } from '../../src/scene/PlayerController';
import { StudentModel } from '../../src/scene/StudentModel';
import { assertReferenceFrameAfterRelease, referencePulseDenominator, referencePulseMagnitude } from '../e2e/campus-visual-reference-helpers';
import { ElementDouble } from './controller-harness';

// CI41603226679 / d55e9eed: observed XYZ from REFERENCE_ALIGNMENT. The CDP
// trace records request/response times, not in-page dispatch timestamps. These
// CPU replays use displacement-equivalent held times, NOT claimed real timings
// or browser evidence. The final west-wall cleanup-overlapped pulse is excluded.
const traces: { name: string; campus: CampusId; target: Point2; yaw: number; positions: Point2[] }[] = [
  { name: 'baseline Huyu corner', campus: 'huyu', target: [-35.74, -147.03], yaw: 3.325, positions: [[-35.591,-147.662],[-35.643,-147.441],[-35.711,-147.154],[-35.735,-147.051]] },
  { name: 'baseline Yingxi garden', campus: 'yingxi', target: [7,172.76], yaw: -1.5708, positions: [[6.926,172.317],[7.009,172.814],[6.999,172.753]] },
  { name: 'baseline Yingxi west wall', campus: 'yingxi', target: [69,173], yaw: .9496, positions: [[68.944,172.779],[69.004,173.018]] },
  { name: 'candidate Huyu corner', campus: 'huyu', target: [-35.735,-147.051], yaw: 3.325, positions: [[-35.551,-147.69],[-35.621,-147.449],[-35.675,-147.258],[-35.728,-147.075],[-35.732,-147.062]] },
  { name: 'candidate Yingxi garden', campus: 'yingxi', target: [6.999,172.753], yaw: -1.5708, positions: [[6.479,172.322],[7.73,173.359],[6.441,172.291],[7.329,173.026],[6.837,172.619],[7.166,172.891],[6.771,172.565],[7.212,172.928],[6.896,172.668],[7.063,172.806],[6.937,172.702],[7.08,172.82],[6.972,172.73],[7.014,172.767]] },
  { name: 'candidate Yingxi west wall before deadline', campus: 'yingxi', target: [69.004,173.018], yaw: .9496, positions: [[69.099,172.788],[68.971,173.098],[69.042,172.927],[68.984,173.066],[69.016,172.99]] },
];

class InputCanvas extends ElementDouble {
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
}
type PointerInputs = { yaw: number; onPointerDown(e: PointerEvent): void; onPointerMove(e: PointerEvent): void; onPointerUp(e: PointerEvent): void };
let player: PlayerController, inputs: PointerInputs, canvas: InputCanvas, now: number;
beforeEach(() => {
  vi.stubGlobal('Element', ElementDouble);
  vi.stubGlobal('document', Object.assign(new EventTarget(), { createElement: () => new ElementDouble() }));
  vi.stubGlobal('window', new EventTarget());
  now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(StudentModel, 'load').mockReturnValue(new Promise<StudentModel>(() => {}));
  canvas = new InputCanvas();
  player = new PlayerController(new ElementDouble() as unknown as HTMLElement, canvas as unknown as HTMLCanvasElement);
  inputs = player as unknown as PointerInputs;
});
afterEach(() => { player.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function read(): Point2 { return [Number(canvas.dataset.playerX), Number(canvas.dataset.playerZ)]; }
function advance(seconds: number) {
  for (let remaining = seconds; remaining > 1e-9;) {
    const dt = Math.min(.25, remaining); now += dt * 1000; player.advance(); remaining -= dt;
  }
}
function touch(x: number, y: number): PointerEvent {
  return { pointerId: 1, pointerType: 'touch', button: 0, clientX: x, clientY: y } as PointerEvent;
}
function replay(trace: typeof traces[number], calibrated: boolean, responseScale = 1) {
  player.setCampus(campuses[trace.campus]); player.setPosition(trace.positions[0]); inputs.yaw = trace.yaw; advance(.02);
  let denominator = 6;
  const results: { distance: number; magnitude: number; denominator: number }[] = [];
  for (let i = 0; i < trace.positions.length - 1; i++) {
    const before = read(), dx = trace.target[0] - before[0], dz = trace.target[1] - before[1], distance = Math.hypot(dx, dz);
    if (distance <= .025) break;
    const a = trace.positions[i], b = trace.positions[i + 1];
    const originalDistance = Math.hypot(trace.target[0] - a[0], trace.target[1] - a[1]);
    const observedGain = Math.hypot(b[0] - a[0], b[1] - a[1]) / (originalDistance / 6);
    const magnitude = referencePulseMagnitude(distance, denominator);
    const right = (-dx * Math.cos(inputs.yaw) + dz * Math.sin(inputs.yaw)) / distance;
    const forward = (dx * Math.sin(inputs.yaw) + dz * Math.cos(inputs.yaw)) / distance;
    inputs.onPointerDown(touch(80, 600));
    inputs.onPointerMove(touch(80 + right * magnitude * 50, 600 - forward * magnitude * 50));
    // 3.4m/s is the unchanged real controller's walking speed. Real pointer
    // handlers and advance() perform all replay movement and collision checks.
    advance(observedGain / 3.4 * responseScale);
    inputs.onPointerUp(touch(80, 600));
    advance(.02); // Synthetic post-release frame, not an E2E frame substitute.
    const after = read(), travelled = Math.hypot(after[0] - before[0], after[1] - before[1]);
    if (calibrated) denominator = referencePulseDenominator(denominator, magnitude, travelled);
    results.push({ distance: Math.hypot(trace.target[0] - after[0], trace.target[1] - after[1]), magnitude, denominator });
  }
  return results;
}

describe('reference input precision without changing player physics or tolerances', () => {
  it('starts at d/6, caps only input magnitude, and never reduces learned response', () => {
    expect(referencePulseMagnitude(.6, 6)).toBeCloseTo(.1);
    expect(referencePulseMagnitude(12, 6)).toBe(1);
    const gain = referencePulseDenominator(6, .1, 1.4);
    expect(gain).toBeCloseTo(17.5);
    expect(referencePulseDenominator(gain, .1, .2)).toBe(gain);
    expect(referencePulseMagnitude(.6, gain)).toBeLessThan(.1);
  });
  it('fails closed on zero motion, invalid magnitudes, nonfinite telemetry and stale release frames', () => {
    for (const travel of [0, -1, NaN, Infinity]) expect(() => referencePulseDenominator(6, .1, travel)).toThrow();
    for (const magnitude of [0, -1, 2, NaN]) expect(() => referencePulseDenominator(6, magnitude, .1)).toThrow();
    for (const distance of [0, -1, NaN, Infinity]) expect(() => referencePulseMagnitude(distance, 6)).toThrow();
    for (const frame of [183, 182, NaN, Infinity]) expect(() => assertReferenceFrameAfterRelease(frame, 183)).toThrow();
    expect(() => assertReferenceFrameAfterRelease(184, NaN)).toThrow();
    expect(() => assertReferenceFrameAfterRelease(184, 183)).not.toThrow();
  });
  for (const trace of traces) it(`replays ${trace.name} through actual PlayerController`, () => {
    const original = replay(trace, false), calibrated = replay(trace, true);
    expect(calibrated.at(-1)!.distance).toBeLessThanOrEqual(.025);
    expect(calibrated.length).toBeLessThanOrEqual(original.length);
    for (let i = 1; i < calibrated.length; i++) expect(calibrated[i].denominator).toBeGreaterThanOrEqual(calibrated[i - 1].denominator);
    console.info('REFERENCE_CONTROLLER_REPLAY', JSON.stringify({ name: trace.name, originalPulses: original.length, calibratedPulses: calibrated.length, original, calibrated, syntheticDisplacementEquivalentTimes: true }));
  });
  it('keeps the slow garden sequence convergent with 25% response variation', () => {
    const trace = traces.find(row => row.name === 'candidate Yingxi garden')!;
    for (const scale of [.75, 1.25]) expect(replay(trace, true, scale).at(-1)!.distance).toBeLessThanOrEqual(.025);
  });
});
