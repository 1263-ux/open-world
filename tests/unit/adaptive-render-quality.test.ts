import { describe, expect, it } from 'vitest';
import { createAdaptiveRenderQuality, RENDER_QUALITY_POLICY } from '../../src/scene/AdaptiveRenderQuality';
import type { AdaptiveRenderQuality, RenderQualityState } from '../../src/scene/AdaptiveRenderQuality';

function feed(policy: AdaptiveRenderQuality, from: number, durationMs: number, frameMs: number): number {
  let now = from;
  const end = from + durationMs;
  while (now < end) { now += frameMs; policy.observe(frameMs, now); }
  return now;
}

function rendering(state: RenderQualityState) {
  return [state.renderRatio, state.shadowType, state.shadowMapSize];
}

describe('render-only quality policy', () => {
  it('does not collapse resolution for three startup stalls or three isolated spikes', () => {
    const policy = createAdaptiveRenderQuality({ devicePixelRatio: 1.5, nowMs: 0 });
    let now = feed(policy, 0, 1800, 600);
    now = feed(policy, now, 6000, 1000 / 60);
    for (let n = 0; n < 3; n++) { now += 150; policy.observe(150, now); }
    feed(policy, now, 6000, 1000 / 60);
    expect(rendering(policy.getState())).toEqual([1.5, 'pcf', 2048]);
  });

  it('treats first observation as warmup even without a constructor timestamp', () => {
    const policy = createAdaptiveRenderQuality();
    policy.observe(500, 50000);
    feed(policy, 50000, 2000, 500);
    expect(policy.getState().adaptiveLevel).toBe(0);
  });

  it('keeps a stable 30 fps device sharp instead of requiring uninterrupted 40 fps', () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 0 });
    feed(policy, 0, 120000, 1000 / 30);
    expect(rendering(policy.getState())).toEqual([1, 'pcf', 2048]);
  });

  it('reduces static shadow cost before resolution under sustained severe pressure', () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 0, devicePixelRatio: 1.5 });
    feed(policy, 0, 5400, 200);
    expect(rendering(policy.getState())).toEqual([1.5, 'pcf', 1024]);
    feed(policy, 5400, 30000, 200);
    expect(rendering(policy.getState())).toEqual([.5, 'basic', 1024]);
    expect(policy.getState().reason).toBe('load-reduction');
  });

  it('has bounded low-load response even when only two frames fit a window', () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 0 });
    feed(policy, 0, 30000, 1000);
    expect(rendering(policy.getState())).toEqual([.5, 'basic', 1024]);
  });

  for (const frameMs of [2500, 6000]) it(`bounds anomaly grace for sustained ${frameMs} ms foreground frames`, () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 0 });
    policy.observe(frameMs, frameMs);
    expect(policy.getState().adaptiveLevel).toBe(0); // isolated stall is forgiven
    let now = feed(policy, frameMs, 60000, frameMs);
    expect(rendering(policy.getState())).toEqual([.5, 'basic', 1024]);
    now = feed(policy, now, 60000, 1000 / 30);
    expect(rendering(policy.getState())).toEqual([1, 'pcf', 2048]);
    policy.observe(frameMs, now + frameMs); // healthy windows re-arm one allowance
    expect(policy.getState().adaptiveLevel).toBe(0);
    expect(policy.getState().reason).toBe('sampling-grace');
  });

  it('samples repeated wall gaps even when the reported frame duration was clamped', () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 0 });
    for (let now = 6000; now <= 90000; now += 6000) policy.observe(1000, now);
    expect(rendering(policy.getState())).toEqual([.5, 'basic', 1024]);
    policy.resetSampling(90000); // explicit lifecycle reset still grants fresh grace
    expect(policy.observe(6000, 96000).reason).toBe('sampling-grace');
    expect(policy.getState().renderRatio).toBe(.5);
  });

  for (const frameMs of [1000 / 30, 1000 / 60]) it(`recovers from the floor at ${Math.round(1000 / frameMs)} fps`, () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 0 });
    let now = feed(policy, 0, 30000, 200);
    expect(policy.getState().renderRatio).toBe(.5);
    now = feed(policy, now, 8000, frameMs);
    expect(policy.getState().renderRatio).toBe(.5); // no one-window bounce
    feed(policy, now, 50000, frameMs);
    expect(rendering(policy.getState())).toEqual([1, 'pcf', 2048]);
    expect(policy.getState().reason).toBe('recovery');
  });

  it('does not oscillate for alternating moderate windows near the threshold', () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 0 });
    let now = feed(policy, 0, 30000, 200);
    const floor = rendering(policy.getState());
    for (let n = 0; n < 20; n++) {
      now = feed(policy, now, 2200, 1000 / 30);
      now = feed(policy, now, 2200, 40);
    }
    expect(rendering(policy.getState())).toEqual(floor);
  });

  it('leaves at least the cooldown between actual tier changes', () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 0, devicePixelRatio: 1.5 });
    let previous = policy.getState().adaptiveLevel, lastChangedAt = -Infinity;
    for (let now = 200; now <= 40000; now += 200) {
      const level = policy.observe(200, now).adaptiveLevel;
      if (level === previous) continue;
      expect(now - lastChangedAt).toBeGreaterThanOrEqual(RENDER_QUALITY_POLICY.changeCooldownMs);
      lastChangedAt = now; previous = level;
    }
  });

  it('excludes background gaps and resets startup/campus/asset sampling without inventing pressure', () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 0 });
    let now = feed(policy, 0, 6000, 1000 / 60);
    now += 60000; policy.observe(1000, now); // callers may have clamped physical dt
    now = feed(policy, now, 2500, 500);
    expect(policy.getState().adaptiveLevel).toBe(0);
    policy.resetSampling(now); // asset completion or campus rebuild
    now = feed(policy, now, 2500, 500);
    expect(policy.getState().adaptiveLevel).toBe(0);
    policy.observe(7000, now + 7000);
    expect(policy.getState().adaptiveLevel).toBe(0);
  });

  it('preserves a degraded tier on resume, then permits normal recovery', () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 0 });
    let now = feed(policy, 0, 30000, 200);
    policy.resetSampling(now);
    now = feed(policy, now, 2000, 200);
    expect(policy.getState().renderRatio).toBe(.5);
    feed(policy, now, 60000, 1000 / 30);
    expect(policy.getState().renderRatio).toBe(1);
  });

  it('supports explicit clear/smooth choices without silently overriding them', () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 0, devicePixelRatio: 2 });
    policy.setMode('smooth', 0);
    feed(policy, 0, 40000, 16);
    expect(rendering(policy.getState())).toEqual([.75, 'pcf', 1024]);
    policy.setMode('clear', 40000);
    feed(policy, 40000, 40000, 500);
    expect(rendering(policy.getState())).toEqual([1.5, 'pcf', 2048]);
    policy.setMode('auto', 80000);
    expect(policy.getState().adaptiveLevel).toBe(0);
    feed(policy, 80000, 30000, 500);
    expect(policy.getState().renderRatio).toBe(.5);
  });

  it('keeps reference quality exactly ratio 1/PCF/2048 regardless of mode or device', () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 0, devicePixelRatio: .5, reference: true });
    feed(policy, 0, 30000, 1000);
    policy.setMode('smooth', 30000);
    policy.setDevicePixelRatio(3, 30000);
    feed(policy, 30000, 30000, 1000);
    expect(rendering(policy.getState())).toEqual([1, 'pcf', 2048]);
    expect(policy.getState().reference).toBe(true);
  });

  it('clamps device ratios and does not clear an automatic reduction on resize', () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 0, devicePixelRatio: 3 });
    expect(policy.getState().renderRatio).toBe(1.5);
    let now = feed(policy, 0, 30000, 200);
    policy.setDevicePixelRatio(1, now);
    expect(policy.getState().renderRatio).toBe(.5);
    policy.setDevicePixelRatio(.2, now);
    expect(policy.getState().renderRatio).toBe(.5);
    now += 100;
    policy.setMode('clear', now);
    expect(policy.getState().renderRatio).toBe(.5);
    policy.setDevicePixelRatio(NaN, now);
    expect(policy.getState().renderRatio).toBe(1);
  });

  it('handles invalid samples and clock rollback without invalid rendering outputs', () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 0 });
    for (const sample of [NaN, Infinity, -1, 0]) policy.observe(sample, 4000);
    policy.observe(200, NaN); policy.observe(200, Infinity); policy.observe(200, -1);
    policy.observe(200, 100); // clock rollback starts a fresh grace period
    feed(policy, 100, 2500, 500);
    expect(rendering(policy.getState())).toEqual([1, 'pcf', 2048]);
    const copy = policy.getState(); copy.renderRatio = -100;
    expect(policy.getState().renderRatio).toBe(1);
  });

  it('does not retain a future cooldown timestamp after a clock reset', () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 100000 });
    feed(policy, 100000, 30000, 200);
    expect(policy.getState().renderRatio).toBe(.5);
    policy.observe(200, 0);
    feed(policy, 0, 50000, 1000 / 30);
    expect(policy.getState().renderRatio).toBe(1);
  });

  it('bounds every emitted profile during a long mixed sample stream', () => {
    const policy = createAdaptiveRenderQuality({ nowMs: 0, devicePixelRatio: 1.25 });
    let now = 0;
    for (let n = 0; n < 30000; n++) {
      const frameMs = n % 1000 < 500 ? 1 : 200;
      now += frameMs;
      const state = policy.observe(frameMs, now);
      expect(state.renderRatio).toBeGreaterThanOrEqual(.5);
      expect(state.renderRatio).toBeLessThanOrEqual(1.25);
      expect(['pcf', 'basic']).toContain(state.shadowType);
      expect([1024, 2048]).toContain(state.shadowMapSize);
    }
  });
});
