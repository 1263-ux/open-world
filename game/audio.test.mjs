import assert from "node:assert/strict";
import { createAudio } from "./audio.js";
let made = 0,
  latest;
const listeners = new Map();
globalThis.document = {
  hidden: false,
  addEventListener: (k, v) => listeners.set(k, v),
  removeEventListener: (k) => listeners.delete(k),
};
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { userActivation: { isActive: false } },
});
class Param {
  value = 0;
  cancelScheduledValues() {}
  setValueAtTime(v) {
    this.value = v;
  }
  setTargetAtTime(v) {
    this.value = v;
  }
  linearRampToValueAtTime(v) {
    this.value = v;
  }
  exponentialRampToValueAtTime(v) {
    this.value = v;
  }
}
class Node {
  gain = new Param();
  frequency = new Param();
  threshold = new Param();
  knee = new Param();
  ratio = new Param();
  attack = new Param();
  release = new Param();
  connect(n) {
    return n;
  }
  disconnect() {}
  start() {}
  stop() {}
}
class Context {
  currentTime = 0;
  sampleRate = 1000;
  state = "suspended";
  destination = new Node();
  gains = [];
  constructor() {
    made++;
    latest = this;
  }
  createGain() {
    const g = new Node();
    this.gains.push(g);
    return g;
  }
  createBuffer(c, n) {
    return { getChannelData: () => new Float32Array(n) };
  }
  createBufferSource() {
    return new Node();
  }
  createBiquadFilter() {
    return new Node();
  }
  createDynamicsCompressor() {
    return new Node();
  }
  createOscillator() {
    return new Node();
  }
  async resume() {
    this.state = "running";
  }
  async suspend() {
    this.state = "suspended";
  }
  async close() {
    this.state = "closed";
  }
}
globalThis.AudioContext = Context;
const a = createAudio();
assert.equal(made, 0);
assert.equal(await a.enable(), false);
assert.equal(made, 0);
navigator.userActivation.isActive = true;
assert.equal(await a.enable(), true);
assert.equal(latest.gains[0].gain.value, 0.08);
a.setVolume(100);
assert.equal(latest.gains[0].gain.value, 0.16);
for (let i = 0; i < 4; i++) assert.equal(a.cue("paper"), true);
assert.equal(a.cue("paper"), false);
a.update({ paused: true });
assert.equal(latest.gains[0].gain.value, 0);
assert.equal(a.cue("wood"), false);
a.update({ paused: false });
assert.equal(latest.state, "suspended");
await a.enable();
document.hidden = true;
listeners.get("visibilitychange")();
assert.equal(latest.gains[0].gain.value, 0);
assert.equal(await a.enable(), false);
document.hidden = false;
await a.enable();
a.mute();
assert.equal(latest.gains[0].gain.value, 0);
a.dispose();
assert.equal(latest.state, "closed");
assert.equal(listeners.size, 0);
assert.equal(await a.enable(), false);
const b = createAudio();
const promise = b.enable();
b.mute();
assert.equal(await promise, false);
assert.equal(latest.state, "suspended");
b.dispose();
console.log(
  "PASS lazy gesture startup, gain ceiling, 4-voice cap, pause/visibility mute, no autoresume, disposal, pending-enable cancellation. Mock lifecycle only, no audio hearing or peak measurement.",
);
