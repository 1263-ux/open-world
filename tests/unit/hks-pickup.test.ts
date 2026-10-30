import { describe, expect, it } from 'vitest';
import { resolveAttractionStep } from '../../games/hks/src/pickupRules';
import { EXP_ORB_CONFIG, PICKUP_RANGE } from '../../games/hks/src/config';

const speed = EXP_ORB_CONFIG.attractSpeed, radius = EXP_ORB_CONFIG.collectDist;
describe('Hks pickup attraction within the existing pickup radius', () => {
  it('collects at zero distance or the exact pre-move collection boundary', () => {
    expect(resolveAttractionStep(0, speed, .016, radius)).toEqual({ step: 0, collected: true });
    expect(resolveAttractionStep(radius, speed, 0, radius)).toEqual({ step: 0, collected: true });
  });
  it('moves a normal short frame without collecting outside the same radius', () => {
    expect(resolveAttractionStep(100, speed, .05, radius)).toEqual({ step: 20, collected: false });
    expect(resolveAttractionStep(52.01, speed, .1, radius).collected).toBe(false);
  });
  it('collects on the exact swept boundary and crossing it', () => {
    expect(resolveAttractionStep(52, speed, .1, radius)).toEqual({ step: 40, collected: true });
    expect(resolveAttractionStep(51, speed, .1, radius)).toEqual({ step: 40, collected: true });
  });
  it('never overshoots or oscillates with a long frame', () => {
    expect(resolveAttractionStep(38, speed, .2, radius)).toEqual({ step: 38, collected: true });
    expect(resolveAttractionStep(100, speed, 30, radius)).toEqual({ step: 100, collected: true });
    expect(resolveAttractionStep(100, speed, 0, radius)).toEqual({ step: 0, collected: false });
  });
  it('retains the original 120px attraction and 12px collection radii', () => {
    // GameScene is responsible for invoking this helper only at dist < PICKUP_RANGE.
    expect(PICKUP_RANGE).toBe(120); expect(radius).toBe(12); expect(speed).toBe(400);
  });
});
