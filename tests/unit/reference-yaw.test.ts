import { expect, it } from 'vitest';
import { referenceYawError } from '../e2e/campus-visual-reference-helpers';
it('compares equivalent orientations across both 2π wraps',()=>{
  for(const turns of [-2,-1,0,1,2])expect(referenceYawError(.37+turns*2*Math.PI,.37)).toBeLessThan(1e-14);
  expect(referenceYawError(3.325,-2.9582)).toBeCloseTo(.0000146928204143,12);
});
it('retains the .0002 boundary and rejects real orientation differences',()=>{
  expect(referenceYawError(.00019999,0)).toBeLessThanOrEqual(.0002);
  expect(referenceYawError(.0002,0)).toBeLessThanOrEqual(.0002);
  expect(referenceYawError(.00020001,0)).toBeGreaterThan(.0002);
  for(const difference of [.01,-.01,Math.PI,-Math.PI])expect(referenceYawError(difference,0)).toBeGreaterThan(.0002);
});
it('fails closed for nonfinite telemetry',()=>{
  for(const value of [NaN,Infinity,-Infinity]){expect(referenceYawError(value,0)).toBe(Infinity);expect(referenceYawError(0,value)).toBe(Infinity);}
});
