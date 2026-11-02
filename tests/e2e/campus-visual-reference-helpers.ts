import { campuses } from '../../src/campus-data/campuses';
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import type { CampusId, Point2 } from '../../src/shared/contracts';
import { walkTo } from './campus-walk';
import { waitForSettledCamera } from './complete-release-helpers';

// Reconstructed recovery candidate. Input is real; evaluate only observes telemetry.
export const REFERENCE_VIEWPORT = { width: 1280, height: 720 };
interface Shot { id: string; purpose: string; campus: CampusId; foot: Point2; look: Point2; pitch?: number; via?: Point2[] }
export const REFERENCE_SHOTS: Shot[] = [
  { id: 'huyu-gate-arrival', purpose: '虎峪原安全spawn内侧：北门形态与入口铺装/植栽景序，不冒充门外正面', campus: 'huyu', foot: [18.26, -177.03], look: [14, -200] },
  { id: 'huyu-campus-approach', purpose: '虎峪入校中段：连续铺装、植栽与主楼方向可读性', campus: 'huyu', foot: [18.26, -158], look: [15.79, -132.35] },
  { id: 'yingxi-hall-arrival', purpose: '迎西真实spawn：机械馆前景与新树形/首程入口', campus: 'yingxi', foot: [-20, 175.5], look: [-53.045, 175.65] },
  { id: 'yingxi-garden-approach', purpose: '迎西走廊中段朝清泽园：连续近中远景与可走入口', campus: 'yingxi', foot: [7, 172.76], look: [35, 192.8] },
];
export interface ReferencePose { xyz: number[]; yaw: number; pitch: number; camera: number[]; quality: string; ratio: number; shadow: number; frame: number }
async function read(canvas: Locator): Promise<ReferencePose> {
  return canvas.evaluate(e => { const d = (e as HTMLElement).dataset; return {
    xyz: [Number(d.playerX), Number(d.playerY), Number(d.playerZ)], yaw: Number(d.cameraYaw), pitch: Number(d.cameraPitch),
    camera: [Number(d.cameraX), Number(d.cameraY), Number(d.cameraZ)], quality: d.renderQuality ?? '', ratio: Number(d.renderRatio), shadow: Number(d.shadowType), frame: Number(d.frame),
  }; });
}
async function precision(page: Page, canvas: Locator, target: Point2) {
  const box = await page.locator('.virtual-stick').boundingBox(); expect(box).not.toBeNull();
  const center = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  try {
    for (let attempt = 0; attempt < 30; attempt++) {
      const pose = await read(canvas), dx = target[0] - pose.xyz[0]!, dz = target[1] - pose.xyz[2]!, distance = Math.hypot(dx, dz);
      console.log('[REFERENCE_ALIGNMENT]', JSON.stringify({ attempt, target, distance, pose }));
      if (distance <= .025) return;
      const magnitude = Math.min(1, distance / 6);
      // Controller forward=(sin yaw,cos yaw), right=(-cos yaw,sin yaw).
      const right = (-dx * Math.cos(pose.yaw) + dz * Math.sin(pose.yaw)) / distance;
      const forward = (dx * Math.sin(pose.yaw) + dz * Math.cos(pose.yaw)) / distance;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, ...center }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: center.x + right * magnitude * 50, y: center.y - forward * magnitude * 50 }] });
      await page.waitForTimeout(30);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(async () => (await read(canvas)).frame, { timeout: 10000 }).toBeGreaterThan(pose.frame);
    }
    const pose = await read(canvas); expect(Math.hypot(target[0] - pose.xyz[0]!, target[1] - pose.xyz[2]!)).toBeLessThanOrEqual(.025);
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
    if (label === 'after') { await expect(canvas).toHaveAttribute('data-arrival-nature-status', 'ready', { timeout: 30000 }); await expect.poll(async()=>Number(await canvas.getAttribute('data-arrival-nature-instances'))).toBeGreaterThan(0); }
    await expect(canvas).toHaveAttribute('data-hero-model', 'ready', { timeout: 30000 });
    if (shot.campus === 'huyu') await expect(canvas).toHaveAttribute('data-huyu-tree-texture', 'ready', { timeout: 30000 });
    else await expect(canvas).toHaveAttribute('data-model-yx-garden-setting', 'ready', { timeout: 30000 });
    for (const point of shot.via ?? []) await walkTo(page, canvas, campuses[shot.campus], point, .9);
    const target: Point2 = baseline ? [baseline.xyz[0]!, baseline.xyz[2]!] : shot.foot;
    await walkTo(page, canvas, campuses[shot.campus], target, .9); await precision(page, canvas, target);
    await expect.poll(async () => (await read(canvas)).xyz[1]).toBeLessThan(.125);
    const yaw = baseline?.yaw ?? Math.atan2(shot.look[0] - target[0], shot.look[1] - target[1]);
    await look(page, canvas, yaw, baseline?.pitch ?? shot.pitch ?? -.15);
    const shadowMapSize = label === 'before' ? { value: 2048, evidence: 'pinned-source-constant' } : { value: Number(await canvas.getAttribute('data-shadow-size')), evidence: 'runtime-telemetry' };
    const pose = await read(canvas), conditions = { shadowMapSize, label, shot, pose, viewport: page.viewportSize(), dpr: await page.evaluate(() => devicePixelRatio), candidateCommit: process.env.GITHUB_SHA ?? 'uncommitted-local' };
    console.log('[REFERENCE_CONDITIONS]', JSON.stringify(conditions));
    await info.attach(`${label}-${shot.id}-conditions`, { body: JSON.stringify(conditions, null, 2), contentType: 'application/json' });
    await page.screenshot({ path: info.outputPath(`${label}-${shot.id}.png`) });
    // Pinned Three r186 WebGLShadowMap normalizes removed PCFSoft(2) to PCF(1).
    // Reference explicitly uses supported PCF; Basic(0) remains a failure.
    expect(shadowMapSize.value).toBe(2048); expect(pose.quality).toBe('reference'); expect(pose.ratio).toBe(1); expect(pose.shadow).toBe(1); expect(conditions.dpr).toBe(1);
    if (baseline) {
      expect(pose.shadow).toBe(baseline.shadow); expect(pose.ratio).toBe(baseline.ratio);
      expect(Math.hypot(...pose.xyz.map((v, i) => v - baseline.xyz[i]!))).toBeLessThanOrEqual(.03);
      expect(Math.abs(pose.yaw - baseline.yaw)).toBeLessThanOrEqual(.0002); expect(Math.abs(pose.pitch - baseline.pitch)).toBeLessThanOrEqual(.0002);
      expect(Math.hypot(...pose.camera.map((v, i) => v - baseline.camera[i]!))).toBeLessThanOrEqual(.04);
    }
    return pose;
  } catch (error) {
    await page.screenshot({ path: info.outputPath(`${label}-${shot.id}-NOT-COMPARABLE.png`), timeout: 5000 }).catch(() => {});
    await info.attach(`${label}-${shot.id}-NOT-COMPARABLE`, { body: JSON.stringify({ error: String(error), pose: await read(canvas).catch(() => null) }), contentType: 'application/json' });
    throw error;
  }
}
