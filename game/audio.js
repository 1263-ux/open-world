/** Original procedural ambience, no samples/TTS/network. enable() must be called
 * directly from a trusted click/key handler, never on load or after an await.
 * mute/hidden/pause suspend the graph; update never resumes it. */
export function createAudio() {
  let ctx = null,
    master = null,
    bus = null,
    wind = null,
    water = null,
    volume = 0.5,
    enabled = false,
    dead = false,
    generation = 0,
    lastStep = 0,
    nextTone = 0;
  const loops = [],
    voices = new Set();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function buffer(seconds, brown) {
    const b = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * seconds),
        ctx.sampleRate,
      ),
      a = b.getChannelData(0);
    let state = 0;
    for (let i = 0; i < a.length; i++) {
      const w = Math.random() * 2 - 1;
      state = (state + 0.018 * w) / 1.018;
      a[i] = brown ? state * 3 : w;
    }
    return b;
  }
  function layer(b, hp, lp, gain) {
    const src = ctx.createBufferSource(),
      hi = ctx.createBiquadFilter(),
      lo = ctx.createBiquadFilter(),
      g = ctx.createGain();
    src.buffer = b;
    src.loop = true;
    hi.type = "highpass";
    hi.frequency.value = hp;
    lo.type = "lowpass";
    lo.frequency.value = lp;
    g.gain.value = gain;
    src.connect(hi).connect(lo).connect(g).connect(bus);
    src.start();
    loops.push(src, hi, lo, g);
    return g;
  }
  function build() {
    ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 8;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.18;
    bus = ctx.createGain();
    bus.gain.value = 4;
    bus.connect(compressor).connect(master).connect(ctx.destination);
    loops.push(bus, compressor, master);
    wind = layer(buffer(7, true), 65, 430, 0.12);
    water = layer(buffer(4, false), 160, 850, 0.06);
    ctx.onstatechange = () => {
      if (enabled && ctx.state !== "running") mute();
    };
  }
  function stopVoice(v) {
    voices.delete(v);
    for (const src of v.sources) {
      try {
        src.stop();
      } catch {}
    }
    for (const n of v.nodes) {
      try {
        n.disconnect();
      } catch {}
    }
  }
  function silence() {
    if (master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0, ctx.currentTime);
    }
    for (const v of [...voices]) stopVoice(v);
  }
  function mute() {
    generation++;
    enabled = false;
    silence();
    if (ctx && ctx.state !== "closed") ctx.suspend().catch(() => {});
  }
  async function enable() {
    if (
      dead ||
      globalThis.document?.hidden ||
      globalThis.navigator?.userActivation?.isActive !== true
    )
      return false;
    const token = ++generation;
    try {
      if (!ctx) build();
      await ctx.resume();
      if (dead || token !== generation || globalThis.document?.hidden) {
        silence();
        if (!enabled && ctx.state !== "closed") await ctx.suspend();
        return false;
      }
      enabled = true;
      master.gain.setTargetAtTime(volume * 0.16, ctx.currentTime, 0.035);
      nextTone = ctx.currentTime + 15;
      return true;
    } catch {
      mute();
      return false;
    }
  }
  function setVolume(v) {
    if (!Number.isFinite(v)) return;
    volume = clamp(v, 0, 1);
    if (enabled) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(volume * 0.16, ctx.currentTime, 0.025);
    }
  }
  function cue(type) {
    if (!enabled || dead || voices.size >= 4 || globalThis.document?.hidden)
      return false;
    if (!["paper", "wood", "step", "paddle"].includes(type)) return false;
    const t = ctx.currentTime,
      g = ctx.createGain(),
      sources = [],
      nodes = [g];
    g.connect(bus);
    let duration;
    if (type === "wood") {
      const o = ctx.createOscillator(),
        lp = ctx.createBiquadFilter();
      o.type = "sine";
      o.frequency.value = [261.63, 293.66, 349.23][
        Math.floor(Math.random() * 3)
      ];
      lp.type = "lowpass";
      lp.frequency.value = 700;
      o.connect(lp).connect(g);
      sources.push(o);
      nodes.push(o, lp);
      duration = 0.8;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.085, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    } else {
      const src = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter();
      src.buffer = buffer(type === "paper" ? 0.28 : 0.45, false);
      filter.type = "lowpass";
      filter.frequency.value =
        type === "paper" ? 1800 : type === "step" ? 420 : 850;
      src.connect(filter).connect(g);
      sources.push(src);
      nodes.push(src, filter);
      duration = type === "paper" ? 0.28 : type === "step" ? 0.13 : 0.45;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(type === "paper" ? 0.065 : 0.1, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    }
    const v = { sources, nodes };
    voices.add(v);
    sources[0].onended = () => stopVoice(v);
    for (const src of sources) {
      src.start(t);
      src.stop(t + duration + 0.03);
    }
    return true;
  }
  function update({ zone = "office", speed = 0, paused = false } = {}) {
    if (paused || globalThis.document?.hidden) {
      mute();
      return;
    }
    if (!enabled) return;
    const t = ctx.currentTime;
    water.gain.setTargetAtTime(zone === "office" ? 0.035 : 0.1, t, 0.6);
    wind.gain.setTargetAtTime(zone === "sunset" ? 0.09 : 0.12, t, 0.6);
    if (
      Number.isFinite(speed) &&
      speed > 0.2 &&
      t - lastStep > (zone === "office" ? 0.48 : 0.85)
    ) {
      cue(zone === "office" ? "step" : "paddle");
      lastStep = t;
    }
    if (t >= nextTone) {
      cue("wood");
      nextTone = t + 15 + Math.random() * 12;
    }
  }
  const hidden = () => {
    if (globalThis.document?.hidden) mute();
  };
  globalThis.document?.addEventListener("visibilitychange", hidden);
  function dispose() {
    if (dead) return;
    mute();
    dead = true;
    globalThis.document?.removeEventListener("visibilitychange", hidden);
    for (const n of loops) {
      try {
        n.stop?.();
        n.disconnect();
      } catch {}
    }
    if (ctx) {
      ctx.onstatechange = null;
      ctx.close().catch(() => {});
    }
    loops.length = 0;
  }
  return { enable, mute, setVolume, update, cue, dispose };
}
