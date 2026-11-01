import { describe, expect, it } from 'vitest';
import { isPhotoHeightEligible } from '../../src/scene/CampusScene';
import { PHOTO_POINTS } from '../../src/games/photography';
describe('photography foot-height eligibility',()=>{
  it('preserves old stable hall/garden IDs and unrestricted height defaults',()=>{
    expect(PHOTO_POINTS.map(p=>p.id)).toEqual(expect.arrayContaining(['hall','garden']));
    expect(isPhotoHeightEligible(.12)).toBe(true);expect(isPhotoHeightEligible(1.2)).toBe(true);
  });
  it('denies the ground below the same XZ and accepts the real deck',()=>{
    expect(isPhotoHeightEligible(.12,[1.1,1.4])).toBe(false);expect(isPhotoHeightEligible(1.2,[1.1,1.4])).toBe(true);
    expect(isPhotoHeightEligible(1.1,[1.1,1.4])).toBe(true);expect(isPhotoHeightEligible(1.4,[1.1,1.4])).toBe(true);
  });
  it('rejects nonfinite feet and malformed height ranges',()=>{
    for(const y of [NaN,Infinity,-Infinity])expect(isPhotoHeightEligible(y,[1,2])).toBe(false);
    for(const range of [[2,1],[NaN,2],[1,Infinity]] as [number,number][])expect(isPhotoHeightEligible(1.2,range)).toBe(false);
  });
});
