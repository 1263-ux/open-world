/** Rendering-only policy. All times are milliseconds; never use its samples as physics dt. */
export type RenderQualityMode = 'auto' | 'clear' | 'smooth';
export type RenderShadowType = 'pcf' | 'basic';

export interface RenderQualityState {
  mode: RenderQualityMode;
  reference: boolean;
  /** Absolute renderer pixel ratio, not a multiplier of devicePixelRatio. */
  renderRatio: number;
  shadowType: RenderShadowType;
  shadowMapSize: number;
  /** Zero is the highest automatic tier. Manual/reference modes report zero. */
  adaptiveLevel: number;
  reason: 'initial' | 'reference' | 'manual' | 'sampling-grace' | 'resize' | 'load-reduction' | 'recovery';
}

export interface AdaptiveRenderQualityOptions {
  devicePixelRatio?: number;
  mode?: RenderQualityMode;
  reference?: boolean;
  nowMs?: number;
}

/** Exported for deterministic tests and truthful UI diagnostics, not runtime tuning. */
export const RENDER_QUALITY_POLICY = Object.freeze({
  graceMs: 3000,
  windowMs: 2000,
  changeCooldownMs: 3000,
  recoveryWindows: 5,
  slowWindows: 2,
  backgroundGapMs: 5000,
  maximumSampleMs: 2000,
  maximumWindowSamples: 512,
});

interface Profile { renderRatio: number; shadowType: RenderShadowType; shadowMapSize: number }

function pixelRatio(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.min(1.5, Math.max(.5, value)) : 1;
}

function validMode(mode: RenderQualityMode): RenderQualityMode {
  return mode === 'clear' || mode === 'smooth' ? mode : 'auto';
}

/**
 * Static shadow cost is reduced before image resolution. Duplicate profiles at
 * low device DPR are removed, so a tier change always changes actual rendering.
 * PCF is supported by Three r186; the removed PCFSoft mode is never requested.
 */
function automaticProfiles(cap: number): Profile[] {
  const profiles: Profile[] = [
    { renderRatio: cap, shadowType: 'pcf', shadowMapSize: 2048 },
    { renderRatio: cap, shadowType: 'pcf', shadowMapSize: 1024 },
    { renderRatio: Math.min(cap, 1), shadowType: 'pcf', shadowMapSize: 1024 },
    { renderRatio: Math.min(cap, .75), shadowType: 'pcf', shadowMapSize: 1024 },
    { renderRatio: .5, shadowType: 'basic', shadowMapSize: 1024 },
  ];
  return profiles.filter((profile, index) => index === 0 || JSON.stringify(profile) !== JSON.stringify(profiles[index - 1]));
}

export function createAdaptiveRenderQuality(options: AdaptiveRenderQualityOptions = {}) {
  let cap = pixelRatio(options.devicePixelRatio ?? 1);
  let mode = validMode(options.mode ?? 'auto');
  const reference = options.reference === true;
  let profiles = automaticProfiles(cap), level = 0;
  let reason: RenderQualityState['reason'] = reference ? 'reference' : mode === 'auto' ? 'initial' : 'manual';
  let lastNow: number | null = null, graceUntil = 0, windowStartedAt: number | null = null;
  let lastChangeAt = -Infinity, slowWindows = 0, recoveryWindows = 0;
  let sampleCount = 0, sampleSum = 0, slowSampleCount = 0;
  const samples: number[] = [];
  let anomalyGraceAvailable = true;

  function clearWindow(): void {
    windowStartedAt = null; sampleCount = 0; sampleSum = 0; slowSampleCount = 0; samples.length = 0;
  }

  function getState(): RenderQualityState {
    const profile: Profile = reference
      ? { renderRatio: 1, shadowType: 'pcf', shadowMapSize: 2048 }
      : mode === 'clear' ? profiles[0]
        : mode === 'smooth' ? { renderRatio: Math.min(cap, .75), shadowType: 'pcf', shadowMapSize: 1024 }
          : profiles[level];
    return { mode, reference, ...profile, adaptiveLevel: reference || mode !== 'auto' ? 0 : level, reason };
  }

  /** Call when assets finish loading, after a campus rebuild, and on foreground resume. */
  function resetSampling(nowMs: number): RenderQualityState {
    if (!Number.isFinite(nowMs) || nowMs < 0) return getState();
    if (lastNow !== null && nowMs < lastNow) lastChangeAt = -Infinity;
    lastNow = nowMs; graceUntil = nowMs + RENDER_QUALITY_POLICY.graceMs;
    anomalyGraceAvailable = true;
    clearWindow(); slowWindows = 0; recoveryWindows = 0;
    if (!reference && mode === 'auto') reason = 'sampling-grace';
    return getState();
  }

  function setMode(nextMode: RenderQualityMode, nowMs: number): RenderQualityState {
    const next = validMode(nextMode);
    if (next === mode) return getState();
    mode = next; level = 0; lastChangeAt = Number.isFinite(nowMs) ? nowMs : -Infinity;
    resetSampling(nowMs);
    reason = reference ? 'reference' : mode === 'auto' ? 'sampling-grace' : 'manual';
    return getState();
  }

  function setDevicePixelRatio(nextRatio: number, nowMs: number): RenderQualityState {
    const nextCap = pixelRatio(nextRatio);
    if (nextCap === cap) return getState();
    const previous = getState();
    cap = nextCap; profiles = automaticProfiles(cap);
    // Resizing must not silently undo an existing automatic load reduction.
    const matching = profiles.findIndex(profile => profile.renderRatio <= previous.renderRatio
      && profile.shadowMapSize <= previous.shadowMapSize);
    level = previous.adaptiveLevel === 0 ? 0 : matching >= 0 ? matching : profiles.length - 1;
    resetSampling(nowMs); reason = reference ? 'reference' : 'resize';
    return getState();
  }

  function observe(frameMs: number, nowMs: number): RenderQualityState {
    if (!Number.isFinite(nowMs) || nowMs < 0) return getState();
    if (lastNow === null) return resetSampling(nowMs);
    if (nowMs < lastNow) return resetSampling(nowMs);
    if (!Number.isFinite(frameMs) || frameMs <= 0) return getState();
    const gapMs = nowMs - lastNow;
    const anomalous = gapMs > RENDER_QUALITY_POLICY.backgroundGapMs
      || frameMs > RENDER_QUALITY_POLICY.maximumSampleMs;
    if (anomalous && anomalyGraceAvailable) {
      // One isolated resume/loading stall may be ignored, but repeated foreground
      // multi-second frames must not renew grace forever. Explicit lifecycle resets
      // or a genuinely healthy window re-arm this allowance.
      resetSampling(nowMs);
      anomalyGraceAvailable = false;
      return getState();
    }
    // Clamp rendering statistics only, never simulation dt. A repeated large wall
    // gap remains pressure even if a caller supplied a clamped frame duration.
    const sampleMs = Math.min(RENDER_QUALITY_POLICY.maximumSampleMs,
      anomalous ? Math.max(frameMs, gapMs) : frameMs);
    lastNow = nowMs;
    if (reference || mode !== 'auto' || nowMs < graceUntil) return getState();
    if (windowStartedAt === null) windowStartedAt = nowMs;
    // Bound memory even on high-refresh devices. The percentile uses the most
    // recent 512 frames; mean and slow-frame share cover the entire window.
    samples[sampleCount % RENDER_QUALITY_POLICY.maximumWindowSamples] = sampleMs;
    sampleCount++; sampleSum += sampleMs;
    if (sampleMs > 45) slowSampleCount++;
    if (nowMs - windowStartedAt < RENDER_QUALITY_POLICY.windowMs || sampleCount < 2) return getState();

    const ordered = [...samples].sort((a, b) => a - b);
    const p90 = ordered[Math.max(0, Math.ceil(ordered.length * .9) - 1)];
    const mean = sampleSum / sampleCount, slowShare = slowSampleCount / sampleCount;
    const severe = mean >= 100 && slowShare >= .5;
    const overloaded = p90 > 45 && slowShare >= .25;
    // 30 fps (33.3 ms) has a recovery path; it is not required to sustain 40 fps.
    const healthy = p90 <= 36 && mean <= 35 && slowShare <= .1;
    if (healthy) anomalyGraceAvailable = true;
    slowWindows = overloaded ? slowWindows + 1 : 0;
    recoveryWindows = healthy ? recoveryWindows + 1 : 0;
    clearWindow();

    if (nowMs - lastChangeAt < RENDER_QUALITY_POLICY.changeCooldownMs) return getState();
    if ((severe || slowWindows >= RENDER_QUALITY_POLICY.slowWindows) && level < profiles.length - 1) {
      level++; reason = 'load-reduction'; lastChangeAt = nowMs;
      slowWindows = 0; recoveryWindows = 0;
    } else if (recoveryWindows >= RENDER_QUALITY_POLICY.recoveryWindows && level > 0) {
      level--; reason = 'recovery'; lastChangeAt = nowMs;
      slowWindows = 0; recoveryWindows = 0;
    }
    return getState();
  }

  if (options.nowMs !== undefined) resetSampling(options.nowMs);
  return { observe, resetSampling, setMode, setDevicePixelRatio, getState };
}

export type AdaptiveRenderQuality = ReturnType<typeof createAdaptiveRenderQuality>;
