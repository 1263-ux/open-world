import { expect, it } from 'vitest';
import { gardenApproachRoute, gardenWalkingSegments } from '../e2e/complete-release-helpers';
import { PHOTO_POINTS } from '../../src/games/photography';
import type { Point2 } from '../../src/shared/contracts';
it.each([[-20,175.5],[-23,175.5],[-20,169]])('preserves the north-channel corners with <=5m bounded keyboard segments from %s,%s',(x,z)=>{
  const start:Point2=[x,z],corners=gardenApproachRoute(start),points=gardenWalkingSegments(start);
  expect(corners).toEqual([[x,172.76],[33,172.76],[33,PHOTO_POINTS[1]!.position[1]],[...PHOTO_POINTS[1]!.position]]);
  let previous=start,cornerIndex=0;
  for(const p of points){
    expect(Math.hypot(p[0]-previous[0],p[1]-previous[1])).toBeLessThanOrEqual(5+1e-10);
    expect(p[0]===previous[0]||p[1]===previous[1]).toBe(true);
    if(p[0]===corners[cornerIndex]?.[0]&&p[1]===corners[cornerIndex]?.[1])cornerIndex++;
    previous=p;
  }
  expect(cornerIndex).toBe(corners.length);expect(points.at(-1)).toEqual(PHOTO_POINTS[1]!.position);
});
