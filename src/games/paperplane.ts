/** Deterministic arcade flight. Collision is a finite centreline POINT proxy,
 * not swept-wing CCD. This module owns no clock, DOM, renderer or persistence. */
export const PAPERPLANE_STEP_SECONDS = 1 / 60
export const PAPERPLANE_MAX_STEPS = 6
const EPSILON = 1e-9

export interface PaperplaneVector { x: number; y: number; z: number }
export interface PaperplaneInput { turn: number; pitch: number }
export interface PaperplaneConfig {
  id: string
  /** Radians: heading 0 faces -Z; positive heading turns right toward +X. */
  launch: { position: PaperplaneVector; heading: number; pitch?: number }
  /** Exactly three ordered, one-way disks. Normal points in travel direction. */
  gates: readonly { center: PaperplaneVector; normal: PaperplaneVector; radius: number }[]
  /** Horizontal ground landing disk; center.y must equal groundY. */
  landing: { center: PaperplaneVector; radius: number }
  bounds: { min: PaperplaneVector; max: PaperplaneVector }
  groundY: number
  speed: number
  turnRate: number
  pitchRate: number
  minPitch: number
  maxPitch: number
  sinkRate: number
  liftRate: number
  maxDuration: number
}
export interface PaperplaneCollision {
  /** Nearest hit on this finite 3D segment, fraction in [0,1], or null.
   * Must include start contact. Never mutate arguments. */
  segmentHit(from: Readonly<PaperplaneVector>, to: Readonly<PaperplaneVector>): { fraction: number } | null
  /** Must reject points inside closed proxies, not merely surface ray hits. */
  isSolid(point: Readonly<PaperplaneVector>): boolean
}
export type PaperplaneReason = 'landed' | 'missed-gates' | 'hit' | 'ground' | 'out-of-bounds' | 'timeout' | 'invalid-launch' | 'cancelled'
export interface PaperplaneResult {
  reason: PaperplaneReason
  success: boolean
  elapsed: number
  gatesPassed: number
  distance: number
}
export interface PaperplaneState {
  mode: 'ready' | 'flying' | 'result'
  paused: boolean
  position: PaperplaneVector
  heading: number
  pitch: number
  elapsed: number
  gateIndex: number
  distance: number
  result: PaperplaneResult | null
}
export type PaperplaneEvent = { type: 'gate'; gateIndex: number } | { type: 'result'; result: PaperplaneResult }
export interface PaperplaneUpdate { state: PaperplaneState; events: PaperplaneEvent[] }
export interface PaperplaneController {
  getState(): PaperplaneState
  launch(): PaperplaneUpdate
  /** Returns to ready; launch is deliberately a separate action. */
  retry(): PaperplaneUpdate
  reinitialize(): PaperplaneUpdate
  cancel(): PaperplaneUpdate
  setPaused(paused: boolean): PaperplaneUpdate
  /** Seconds, not timestamps. Invalid/negative deltas are ignored. Stalls discard
   * excess wall time; elapsed and scoring use only simulated fixed steps. */
  advance(deltaSeconds: number, input: Readonly<PaperplaneInput>): PaperplaneUpdate
}

const finiteVector = (p: PaperplaneVector) => [p.x, p.y, p.z].every(Number.isFinite)
const copy = (p: PaperplaneVector): PaperplaneVector => ({ x: p.x, y: p.y, z: p.z })
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
const lerp = (a: PaperplaneVector, b: PaperplaneVector, t: number): PaperplaneVector => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
})
const distance = (a: PaperplaneVector, b: PaperplaneVector) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)

/** Invalid authored configuration throws before creating any activity. External
 * mutation of the supplied config or returned snapshots cannot change a flight. */
export function createPaperplane(source: PaperplaneConfig, collision: PaperplaneCollision): PaperplaneController {
  const config: PaperplaneConfig = {
    ...source, launch: { ...source.launch, position: copy(source.launch.position) },
    gates: source.gates.map(g => ({ ...g, center: copy(g.center), normal: copy(g.normal) })),
    landing: { ...source.landing, center: copy(source.landing.center) },
    bounds: { min: copy(source.bounds.min), max: copy(source.bounds.max) },
  }
  const numbers = [config.launch.heading, config.launch.pitch ?? 0, config.groundY, config.speed,
    config.turnRate, config.pitchRate, config.minPitch, config.maxPitch, config.sinkRate,
    config.liftRate, config.maxDuration, config.landing.radius]
  if (!config.id || !numbers.every(Number.isFinite) || config.gates.length !== 3 ||
    !finiteVector(config.launch.position) || !finiteVector(config.landing.center) ||
    !finiteVector(config.bounds.min) || !finiteVector(config.bounds.max) ||
    config.speed <= 0 || config.turnRate < 0 || config.pitchRate < 0 || config.sinkRate < 0 ||
    config.liftRate < 0 || config.maxDuration <= 0 || config.landing.radius <= 0 ||
    config.minPitch > config.maxPitch || config.minPitch <= -Math.PI / 2 || config.maxPitch >= Math.PI / 2 ||
    Math.abs(config.landing.center.y - config.groundY) > EPSILON ||
    (['x', 'y', 'z'] as const).some(axis => config.bounds.min[axis] >= config.bounds.max[axis]) ||
    config.gates.some(g => !finiteVector(g.center) || !finiteVector(g.normal) || !Number.isFinite(g.radius) ||
      g.radius <= 0 || !Number.isFinite(Math.hypot(g.normal.x, g.normal.y, g.normal.z)) ||
      Math.hypot(g.normal.x, g.normal.y, g.normal.z) <= EPSILON)) {
    throw new RangeError('Invalid paperplane activity configuration')
  }
  // Normalize authored gate normals once; no Three.js dependency is needed.
  for (const gate of config.gates) {
    const length = Math.hypot(gate.normal.x, gate.normal.y, gate.normal.z)
    gate.normal.x /= length; gate.normal.y /= length; gate.normal.z /= length
  }
  let accumulator = 0
  const initial = (): PaperplaneState => ({ mode: 'ready', paused: false,
    position: copy(config.launch.position), heading: config.launch.heading,
    pitch: clamp(config.launch.pitch ?? 0, config.minPitch, config.maxPitch),
    elapsed: 0, gateIndex: 0, distance: 0, result: null })
  let state = initial()
  const snapshot = (): PaperplaneState => ({ ...state, position: copy(state.position), result: state.result && { ...state.result } })
  const update = (events: PaperplaneEvent[] = []): PaperplaneUpdate => ({ state: snapshot(), events })
  const outside = (p: PaperplaneVector) => (['x', 'y', 'z'] as const)
    .some(axis => p[axis] < config.bounds.min[axis] || p[axis] > config.bounds.max[axis])
  const finish = (reason: PaperplaneReason, events: PaperplaneEvent[]) => {
    if (state.mode === 'result') return
    state.mode = 'result'; state.paused = false; accumulator = 0
    state.result = { reason, success: reason === 'landed', elapsed: state.elapsed,
      gatesPassed: state.gateIndex, distance: state.distance }
    events.push({ type: 'result', result: { ...state.result } })
  }
  const reset = () => { accumulator = 0; state = initial(); return update() }

  const step = (input: Readonly<PaperplaneInput>, events: PaperplaneEvent[]) => {
    const dt = Math.min(PAPERPLANE_STEP_SECONDS, config.maxDuration - state.elapsed)
    if (dt <= EPSILON) { finish('timeout', events); return }
    const turn = Number.isFinite(input.turn) ? clamp(input.turn, -1, 1) : 0
    const pitch = Number.isFinite(input.pitch) ? clamp(input.pitch, -1, 1) : 0
    state.heading = (state.heading + turn * config.turnRate * dt) % (2 * Math.PI)
    state.pitch = clamp(state.pitch + pitch * config.pitchRate * dt, config.minPitch, config.maxPitch)
    const from = state.position
    const horizontal = config.speed * Math.cos(state.pitch)
    const to = { x: from.x + Math.sin(state.heading) * horizontal * dt,
      y: from.y + (Math.sin(state.pitch) * config.liftRate - config.sinkRate) * dt,
      z: from.z - Math.cos(state.heading) * horizontal * dt }
    if (!finiteVector(to)) { finish('hit', events); return }
    let stopFraction = Infinity
    const contact: { reason: PaperplaneReason } = { reason: 'hit' }
    // Strict replacement preserves tie priority: world > bounds > ground > goals.
    const stop = (fraction: number, reason: PaperplaneReason) => {
      if (fraction >= 0 && fraction <= 1 && fraction < stopFraction) { stopFraction = fraction; contact.reason = reason }
    }
    const length = distance(from, to)
    if (!Number.isFinite(length) || !Number.isFinite(state.distance + length)) { finish('hit', events); return }
    if (length > EPSILON) {
      const hit = collision.segmentHit(copy(from), copy(to))
      if (hit) {
        // Broken queries fail closed rather than award goals through unknown geometry.
        if (!Number.isFinite(hit.fraction) || hit.fraction < 0 || hit.fraction > 1) stop(0, 'hit')
        else stop(hit.fraction, 'hit')
      }
    }
    for (const axis of ['x', 'y', 'z'] as const) {
      if (to[axis] < config.bounds.min[axis]) stop((config.bounds.min[axis] - from[axis]) / (to[axis] - from[axis]), 'out-of-bounds')
      if (to[axis] > config.bounds.max[axis]) stop((config.bounds.max[axis] - from[axis]) / (to[axis] - from[axis]), 'out-of-bounds')
    }
    if (to.y <= config.groundY && from.y > config.groundY) stop((config.groundY - from.y) / (to.y - from.y), 'ground')
    let lastGateFraction = -Infinity
    while (state.gateIndex < config.gates.length) {
      const gate = config.gates[state.gateIndex]!
      const signed = (p: PaperplaneVector) => (p.x - gate.center.x) * gate.normal.x +
        (p.y - gate.center.y) * gate.normal.y + (p.z - gate.center.z) * gate.normal.z
      const start = signed(from), end = signed(to)
      if (start > 0 || end <= 0 || end - start <= EPSILON) break
      const fraction = -start / (end - start)
      // A gate coincident with contact loses; ordered gates cannot be scored backwards.
      if (fraction >= stopFraction - EPSILON || fraction < lastGateFraction) break
      const crossing = lerp(from, to, fraction)
      if (distance(crossing, gate.center) > gate.radius + EPSILON) break
      lastGateFraction = fraction
      events.push({ type: 'gate', gateIndex: state.gateIndex })
      state.gateIndex++
    }
    const traveledFraction = Math.min(1, stopFraction)
    state.position = lerp(from, to, traveledFraction)
    state.distance += length * traveledFraction
    state.elapsed += dt * traveledFraction
    if (stopFraction <= 1) {
      if (contact.reason === 'ground') {
        const inside = Math.hypot(state.position.x - config.landing.center.x, state.position.z - config.landing.center.z) <= config.landing.radius
        contact.reason = inside ? (state.gateIndex === config.gates.length ? 'landed' : 'missed-gates') : 'ground'
      }
      finish(contact.reason, events)
    } else if (state.elapsed >= config.maxDuration - EPSILON) finish('timeout', events)
  }
  return {
    getState: snapshot,
    launch() {
      if (state.mode !== 'ready' || state.paused) return update()
      accumulator = 0
      const events: PaperplaneEvent[] = []
      if (outside(state.position) || state.position.y <= config.groundY || collision.isSolid(copy(state.position))) finish('invalid-launch', events)
      else state.mode = 'flying'
      return update(events)
    },
    retry: reset,
    reinitialize: reset,
    cancel() { const events: PaperplaneEvent[] = []; finish('cancelled', events); return update(events) },
    setPaused(paused) { accumulator = 0; state.paused = state.mode === 'result' ? false : paused; return update() },
    advance(deltaSeconds, input) {
      const events: PaperplaneEvent[] = []
      if (state.mode !== 'flying' || state.paused || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return update()
      accumulator = Math.min(accumulator + deltaSeconds, PAPERPLANE_STEP_SECONDS * PAPERPLANE_MAX_STEPS)
      let steps = 0
      while (accumulator + EPSILON >= PAPERPLANE_STEP_SECONDS && steps < PAPERPLANE_MAX_STEPS && state.mode === 'flying') {
        accumulator = Math.max(0, accumulator - PAPERPLANE_STEP_SECONDS)
        step(input, events); steps++
      }
      return update(events)
    },
  }
}
