/** Landmark guidance uses the same building-safe connector and authored suffix as Scene.navigateTo.
 * This remains real keyboard input, not auto-walk or a gameplay-state write.
 * The generic building-only A* remains for non-landmark viewpoints. */
import type { Locator, Page } from '@playwright/test';
import type { CampusData, Point2 } from '../../src/shared/contracts';
import { position, waypointKeys } from './campus-walk';
import { planCampusGuidance } from '../../src/scene/CampusGuidance';
export function landmarkRoute(campus: CampusData, start: Point2, id: string): Point2[] {
  const plan = planCampusGuidance(campus, start, id);
  if (!plan) throw Error(`No safe authored landmark connection ${id}`);
  const suffix = plan.points;
  // Preserve every original corner; never grid-snap or shortcut a route segment.
  return suffix.flatMap((point, index) => {
    const previous = index ? suffix[index - 1]! : start;
    const steps = Math.max(1, Math.ceil(Math.hypot(point[0] - previous[0], point[1] - previous[1]) / 2));
    return Array.from({ length: steps }, (_, i): Point2 => [
      previous[0] + (point[0] - previous[0]) * (i + 1) / steps,
      previous[1] + (point[1] - previous[1]) * (i + 1) / steps,
    ]);
  });
}
export async function walkLandmark(page: Page, canvas: Locator, campus: CampusData, id: string) {
  const landmark = campus.landmarks.find(item => item.id === id);
  if (!landmark) throw Error(`Unknown landmark ${id}`);
  const target = landmark.arrival, targetTolerance = 4.5;
  const [x,,z] = await position(canvas), route = landmarkRoute(campus, [x,z], id);
  let last = [x,z], stagnant = 0;
  for (const waypoint of route) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const [px,,pz] = await position(canvas), dx = waypoint[0] - px, dz = waypoint[1] - pz;
      if (Math.hypot(dx,dz) < .9 || Math.hypot(target[0] - px, target[1] - pz) < targetTolerance) break;
      // The axis threshold is below .9 / sqrt(2), so every point outside
      // the waypoint tolerance has at least one direction to steer.
      const yaw = Number(await canvas.getAttribute('data-camera-yaw'));
      if (!Number.isFinite(yaw)) throw new Error('Missing read-only camera yaw');
      const keys = waypointKeys(dx, dz, yaw);
      await page.keyboard.down('Shift'); for (const key of keys) await page.keyboard.down(key);
      await page.waitForTimeout(Math.max(80, Math.min(300, Math.hypot(dx,dz) / 6.5 * 500)));
      for (const key of keys) await page.keyboard.up(key); await page.keyboard.up('Shift');
      const [nx,,nz] = await position(canvas);
      if (Math.hypot(nx-last[0]!,nz-last[1]!) < .05) stagnant++; else stagnant = 0;
      if (stagnant >= 12) throw new Error(`Player stuck at ${nx},${nz}; waypoint ${waypoint}`);
      last = [nx,nz];
      if (attempt === 29) throw new Error(`Failed to reach waypoint ${waypoint}, player at ${nx},${nz}`);
    }
  }
}
