import { describe, expect, it } from 'vitest';
import { segmentIntersectsCircle } from '../../games/hks/src/projectileRules';

describe('Hks basic attack swept 12px hit radius', () => {
  it('hits when the original 420px/s bolt crosses its target during a 100ms frame', () => {
    // Endpoints at x=0 and x=42 both fail the old strict <12 point test for x=30.
    expect(Math.abs(0-30) < 12).toBe(false); expect(Math.abs(42-30) < 12).toBe(false);
    expect(segmentIntersectsCircle(0,0,42,0,30,0,12)).toBe(true);
  });
  it('hits a normal short step entering the radius but not one ending outside', () => {
    expect(segmentIntersectsCircle(0,0,20,0,30,0,12)).toBe(true);
    expect(segmentIntersectsCircle(0,0,17,0,30,0,12)).toBe(false);
  });
  it('retains the strict boundary: tangent and offset paths do not hit', () => {
    expect(segmentIntersectsCircle(0,12,42,12,30,0,12)).toBe(false);
    expect(segmentIntersectsCircle(0,12.1,42,12.1,30,0,12)).toBe(false);
    expect(segmentIntersectsCircle(0,11.9,42,11.9,30,0,12)).toBe(true);
  });
  it('handles zero-length movement without NaN or a false boundary hit', () => {
    expect(segmentIntersectsCircle(1,1,1,1,1,1,12)).toBe(true);
    expect(segmentIntersectsCircle(12,0,12,0,0,0,12)).toBe(false);
    expect(segmentIntersectsCircle(13,0,13,0,0,0,12)).toBe(false);
  });
});
