import { campuses } from '../../src/campus-data/campuses';
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import type { CampusId, Point2 } from '../../src/shared/contracts';
import { walkTo } from './campus-walk';
import { walkAuthoredSegment, waitForSettledCamera } from './complete-release-helpers';
import referenceBaseline from './reference-baseline-manifest.json' with { type: 'json' };

// Reconstructed recovery candidate. Input is real; evaluate only observes telemetry.
export const REFERENCE_VIEWPORT = { width: 1280, height: 720 };
interface Shot { id: string; purpose: string; campus: CampusId; foot: Point2; look: Point2; pitch?: number; authoredApproach?: { staging: Point2; via: Point2[] } }
export const REFERENCE_SHOTS: Shot[] = [
  { id: 'huyu-gate-arrival', purpose: '虎峪原安全spawn内侧：北门形态与入口铺装/植栽景序，不冒充门外正面', campus: 'huyu', foot: [18.26, -177.03], look: [14, -200] },
  { id: 'huyu-campus-approach', purpose: '虎峪原路线西转角：沿梅花方向的连续通行与景序，不以主楼贴墙作为终点', campus: 'huyu', foot: [-35.74, -147.03], look: [-35.74, -105.03] },
  { id: 'yingxi-garden-approach', purpose: '迎西走廊中段朝清泽园：连续近中远景与可走入口', campus: 'yingxi', foot: [7, 172.76], look: [35, 192.8] },
  // Reuse the existing campus-mode shared-ground view, not a default spawn view.
  // Garden first avoids walking east to the wall view and then doubling back.
  { id: 'yingxi-west-facade', purpose: '迎西既有模式验收共享地面东向：195741288西墙窗组，不冒充默认出生镜头', campus: 'yingxi', foot: [69, 173], look: [111.72, 173], authoredApproach: { staging: [54, 172], via: [[69, 172]] } },
];
// Yaw is periodic; preserve strict angular tolerance without equating different directions.
export function referenceYawError(actual: number, expected: number): number {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return Number.POSITIVE_INFINITY;
  const delta = actual - expected; return Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
}
// Test-side input calibration only. Slow CDP delivery can hold a nominal 30ms
// gesture for much longer; never compensate by changing player speed or state.
export function referencePulseMagnitude(distance: number, denominator: number): number {
  if (!Number.isFinite(distance) || distance <= 0 || !Number.isFinite(denominator) || denominator < 6) throw Error('Invalid reference pulse input');
  return Math.min(1, distance / denominator);
}
export function referencePulseDenominator(previous: number, magnitude: number, travelled: number): number {
  if (!Number.isFinite(previous) || previous < 6 || !Number.isFinite(magnitude) || magnitude <= 0 || magnitude > 1 || !Number.isFinite(travelled) || travelled <= 0) throw Error('Reference pulse has no finite post-release displacement');
  const observed = travelled / magnitude * 1.25;
  if (!Number.isFinite(observed)) throw Error('Invalid reference pulse response');
  return Math.max(previous, observed);
}
export function assertReferenceFrameAfterRelease(frame: number, releasedFrame: number): void {
  if (!Number.isFinite(frame) || !Number.isFinite(releasedFrame) || frame <= releasedFrame) throw Error('No new rendered frame after reference touch release');
}
export interface ReferencePose { xyz: number[]; yaw: number; pitch: number; camera: number[]; quality: string; ratio: number; shadow: number; shadowSize: number; shadowActual: number[]; frame: number }
async function read(canvas: Locator): Promise<ReferencePose> {
  return canvas.evaluate(e => { const d = (e as HTMLElement).dataset; return {
    xyz: [Number(d.playerX), Number(d.playerY), Number(d.playerZ)], yaw: Number(d.cameraYaw), pitch: Number(d.cameraPitch),
    camera: [Number(d.cameraX), Number(d.cameraY), Number(d.cameraZ)], quality: d.renderQuality ?? '', ratio: Number(d.renderRatio), shadow: Number(d.shadowType), shadowSize: Number(d.shadowSize), shadowActual: [Number(d.shadowActualSize), Number(d.shadowActualHeight)], frame: Number(d.frame),
  }; });
}
async function precision(page: Page, canvas: Locator, target: Point2) {
  const box = await page.locator('.virtual-stick').boundingBox(); expect(box).not.toBeNull();
  const center = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  try {
    let denominator = 6, pose = await read(canvas);
    for (let attempt = 0; attempt < 30; attempt++) {
      const dx = target[0] - pose.xyz[0]!, dz = target[1] - pose.xyz[2]!, distance = Math.hypot(dx, dz);
      console.log('[REFERENCE_ALIGNMENT]', JSON.stringify({ attempt, target, distance, denominator, pose }));
      if (distance <= .025) return;
      const magnitude = referencePulseMagnitude(distance, denominator);
      // Controller forward=(sin yaw,cos yaw), right=(-cos yaw,sin yaw).
      const right = (-dx * Math.cos(pose.yaw) + dz * Math.sin(pose.yaw)) / distance;
      const forward = (dx * Math.sin(pose.yaw) + dz * Math.cos(pose.yaw)) / distance;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, ...center }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: center.x + right * magnitude * 50, y: center.y - forward * magnitude * 50 }] });
      await page.waitForTimeout(30);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      // A frame newer than the pre-touch pose may still have rendered while
      // the stick was held. Sample release first, then require a distinct RAF.
      const released = await read(canvas);
      let after = released;
      await expect.poll(async () => { after = await read(canvas); return after.frame; }, { timeout: 10000 }).toBeGreaterThan(released.frame);
      assertReferenceFrameAfterRelease(after.frame, released.frame);
      const travelled = Math.hypot(after.xyz[0]! - pose.xyz[0]!, after.xyz[2]! - pose.xyz[2]!);
      denominator = referencePulseDenominator(denominator, magnitude, travelled);
      console.log('[REFERENCE_PULSE]', JSON.stringify({ attempt, magnitude, travelled, denominator, releasedFrame: released.frame, afterFrame: after.frame }));
      pose = after;
    }
    pose = await read(canvas); expect(Math.hypot(target[0] - pose.xyz[0]!, target[1] - pose.xyz[2]!)).toBeLessThanOrEqual(.025);
  } finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {}); await cdp.detach().catch(() => {}); }
}
async function look(page: Page, canvas: Locator, yaw: number, pitch: number) {
  const pose = await read(canvas), delta = Math.atan2(Math.sin(yaw - pose.yaw), Math.cos(yaw - pose.yaw));
  const cdp = await page.context().newCDPSession(page), start = { x: 900, y: 300 };
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 2, ...start }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 2, x: start.x - delta / .005, y: start.y + (pitch - pose.pitch) / .004 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await cdp.detach(); }
  await waitForSettledCamera(page, canvas, 45000);
}
export async function captureReference(page: Page, canvas: Locator, shot: Shot, label: 'before' | 'after', info: TestInfo, baseline?: ReferencePose): Promise<ReferencePose> {
  try {
    if (await canvas.getAttribute('data-campus-ready') !== shot.campus) await page.getByTestId(`campus-${shot.campus}`).click();
    await expect(canvas).toHaveAttribute('data-campus-ready', shot.campus, { timeout: 30000 });
    await expect(canvas).toHaveAttribute('data-player-model', 'ready', { timeout: 30000 });
    await expect(canvas).toHaveAttribute('data-arrival-nature-status', 'ready', { timeout: 30000 }); await expect.poll(async()=>Number(await canvas.getAttribute('data-arrival-nature-instances'))).toBeGreaterThan(0);
    await expect(canvas).toHaveAttribute('data-hero-model', 'ready', { timeout: 30000 });
    if (shot.campus === 'huyu') await expect(canvas).toHaveAttribute('data-huyu-tree-texture', 'ready', { timeout: 30000 });
    else await expect(canvas).toHaveAttribute('data-model-yx-garden-setting', 'ready', { timeout: 30000 });
    const target: Point2 = baseline ? [baseline.xyz[0]!, baseline.xyz[2]!] : shot.foot;
    if (shot.authoredApproach) {
      // Same staging and north-ground segments as the existing mode journey.
      // Source-footprint A* must not invent a shortcut through platform props.
      await walkTo(page, canvas, campuses[shot.campus], shot.authoredApproach.staging, .9);
      for (const point of [shot.authoredApproach.staging, ...shot.authoredApproach.via, target]) await walkAuthoredSegment(page, canvas, point);
    } else await walkTo(page, canvas, campuses[shot.campus], target, .9);
    await precision(page, canvas, target);
    await expect.poll(async () => (await read(canvas)).xyz[1]).toBeLessThan(.125);
    const yaw = baseline?.yaw ?? Math.atan2(shot.look[0] - target[0], shot.look[1] - target[1]);
    await look(page, canvas, yaw, baseline?.pitch ?? shot.pitch ?? -.15);
    const facadeComposition = JSON.parse(await canvas.getAttribute('data-facade-composition') ?? 'null');
    const pose = await read(canvas);
    await page.screenshot({ path: info.outputPath(`${label}-${shot.id}.png`) });
    const screenshotAfter = await read(canvas);
    const shadowMapSize = { value: pose.shadowSize, actual: pose.shadowActual, evidence: 'runtime-telemetry' };
    const conditions = { shadowMapSize, facadeComposition, label, shot, pose, screenshotAfter, viewport: page.viewportSize(), dpr: await page.evaluate(() => devicePixelRatio), baselineCommit: referenceBaseline.baselineCommit, candidateCommit: process.env.GITHUB_SHA ?? 'uncommitted-local' };
    console.log('[REFERENCE_CONDITIONS]', JSON.stringify(conditions));
    await info.attach(`${label}-${shot.id}-conditions`, { body: JSON.stringify(conditions, null, 2), contentType: 'application/json' });
    // A static comparison requires unchanged player/camera/quality across the
    // image capture. Read both sides without adding waits or forcing render state.
    const { frame: _beforeFrame, ...beforeImage } = pose, { frame: _afterFrame, ...afterImage } = screenshotAfter;
    expect(afterImage).toEqual(beforeImage);
    // Pinned Three r186 WebGLShadowMap normalizes removed PCFSoft(2) to PCF(1).
    // Reference explicitly uses supported PCF; Basic(0) remains a failure.
    expect(shadowMapSize.value).toBe(2048); expect(shadowMapSize.actual).toEqual([2048, 2048]); expect(pose.quality).toBe('reference'); expect(pose.ratio).toBe(1); expect(pose.shadow).toBe(1); expect(conditions.dpr).toBe(1);
    if (baseline) {
      expect(pose.shadow).toBe(baseline.shadow); expect(pose.ratio).toBe(baseline.ratio);
      expect(Math.hypot(...pose.xyz.map((v, i) => v - baseline.xyz[i]!))).toBeLessThanOrEqual(.03);
      const rawYawDelta = pose.yaw - baseline.yaw, wrappedYawError = referenceYawError(pose.yaw, baseline.yaw);
      console.log('[REFERENCE_YAW_ALIGNMENT]', JSON.stringify({ shot: shot.id, rawYawDelta, wrappedYawError, tolerance: .0002 }));
      expect(wrappedYawError).toBeLessThanOrEqual(.0002); expect(Math.abs(pose.pitch - baseline.pitch)).toBeLessThanOrEqual(.0002);
      expect(Math.hypot(...pose.camera.map((v, i) => v - baseline.camera[i]!))).toBeLessThanOrEqual(.04);
    }
    return pose;
  } catch (error) {
    await page.screenshot({ path: info.outputPath(`${label}-${shot.id}-NOT-COMPARABLE.png`), timeout: 5000 }).catch(() => {});
    await info.attach(`${label}-${shot.id}-NOT-COMPARABLE`, { body: JSON.stringify({ error: String(error), pose: await read(canvas).catch(() => null) }), contentType: 'application/json' });
    throw error;
  }
}
