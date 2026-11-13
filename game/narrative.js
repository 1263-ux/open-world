/** CH01 pure story state. No DOM, clock, storage or player teleport side effects. */
export const INTRO =
  "你好，邮差。\n我想带我的小鱼出去玩一次。\n它每天都在等我放学。";
export const MEMORY_ID = "memory_ch01_sky_drawing";
export const FOLDS = Object.freeze(
  [
    { target: 1, hint: "沿右侧折痕，把水槽出口对准东面的缺口。" },
    { target: 0, hint: "接住左侧来的水，再把出口朝北，对准下一页折纸。" },
    { target: 0, hint: "纸船在北侧。顺着中间折痕，让水流向它。" },
  ].map(Object.freeze),
);
// CH01 §10 final letter, with §6 shot structure. Final three seconds remain silent.
export const CUES = Object.freeze(
  [
    { id: "C01", at: 0, text: "你好，邮差。", shot: "envelope" },
    { id: "C02", at: 9, text: "谢谢你带它去看了云。", shot: "cloud-boat" },
    {
      id: "C03",
      at: 20,
      text: "我以前总觉得，小鱼一定很无聊。",
      shot: "paper-water",
    },
    {
      id: "C04",
      at: 31,
      text: "每次放学回来，我都会给它讲今天发生的事情。\n有时候我讲得太久了，它就游到水草后面。\n可是第二天，我还是会继续讲。",
      shot: "fish-bubbles",
    },
    {
      id: "C05",
      at: 53,
      text: "今天下雨了，我想，如果它也能出去看看就好了。\n后来我发现，其实它一直都在认真听。",
      shot: "sunset",
    },
    {
      id: "C06",
      at: 73,
      text: "谢谢你陪它度过了一个下午。\n明天放学，我还会给它讲故事的。",
      shot: "sky-drawing",
    },
    { id: "C07", at: 90, text: "", shot: "collection-wall" },
  ].map(Object.freeze),
);
export const MEMORY_DURATION = 93;
const STAGES = [
  "letter",
  "folds",
  "ready",
  "sailing",
  "sunset",
  "returning",
  "echo",
  "memory",
  "complete",
];
const fresh = () => ({
  version: 2,
  stage: "letter",
  folds: [0, 1, 3],
  solved: [false, false, false],
  rain: false,
  windmill: false,
  sunsetStay: 0,
  paused: false,
  memoryTime: 0,
  collected: false,
});
const finite = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
function restore(s) {
  if (
    !s ||
    s.version !== 2 ||
    !STAGES.includes(s.stage) ||
    !Array.isArray(s.folds) ||
    s.folds.length !== 3 ||
    !s.folds.every((v) => Number.isInteger(v) && v >= 0 && v < 4) ||
    !Array.isArray(s.solved) ||
    s.solved.length !== 3 ||
    !s.solved.every((v) => typeof v === "boolean") ||
    !["rain", "windmill", "collected"].every(
      (k) => typeof s[k] === "boolean",
    ) ||
    !finite(s.sunsetStay, 0, 86400) ||
    !finite(s.memoryTime, 0, MEMORY_DURATION)
  )
    return fresh();
  const n = STAGES.indexOf(s.stage),
    count = s.solved.filter(Boolean).length;
  if (
    s.solved.some(
      (v, i) =>
        v &&
        (s.folds[i] !== FOLDS[i].target ||
          s.solved.slice(0, i).some((v) => !v)),
    ) ||
    (n === 0 && count !== 0) ||
    (n === 1 && count === 3) ||
    (n >= 2 && count !== 3) ||
    (s.stage === "complete" && !s.collected) ||
    (s.collected && !["memory", "complete"].includes(s.stage)) ||
    (n < 7 && s.memoryTime !== 0) ||
    (s.stage === "complete" && s.memoryTime !== MEMORY_DURATION)
  )
    return fresh();
  return {
    ...fresh(),
    stage: s.stage,
    folds: [...s.folds],
    solved: [...s.solved],
    rain: s.rain,
    windmill: s.windmill,
    sunsetStay: s.sunsetStay,
    memoryTime: s.memoryTime,
    collected: s.collected,
  };
}
export function createStory(saved) {
  let s = restore(saved);
  const snapshot = () => ({ ...s, folds: [...s.folds], solved: [...s.solved] });
  const near = (c) =>
    c?.near === true ||
    (finite(c?.distance, 0, 3) &&
      c.distance <=
        Math.min(3, finite(c.maxDistance, 0, 3) ? c.maxDistance : 2.2));
  function canInteract(id, c = {}) {
    if (id === "pause" || id === "resume") return true;
    if (s.paused) return false;
    if (id === "skip") return s.stage === "memory"; // overlay control, not a world hotspot
    if (!near(c)) return false;
    const f = /^fold:([0-2]):(rotate|pour|reset)$/.exec(id);
    if (f)
      return (
        s.stage === "folds" &&
        !s.solved[+f[1]] &&
        s.solved.slice(0, +f[1]).every(Boolean)
      );
    if (id === "letter") return ["letter", "complete"].includes(s.stage);
    if (id === "boat") return s.stage === "ready";
    if (id === "rain" || id === "windmill")
      return ["sailing", "sunset", "returning"].includes(s.stage) && !s[id];
    if (id === "return") return s.stage === "sunset";
    if (id === "echo") return s.stage === "echo";
    if (id === "collection") return s.stage === "complete";
    return false;
  }
  const finish = () => {
    s.stage = "complete";
    s.memoryTime = MEMORY_DURATION;
    if (s.collected) return [];
    s.collected = true;
    return [{ type: "collected", id: MEMORY_ID }];
  };
  function interact(id, c = {}) {
    if (!canInteract(id, c))
      return { ok: false, events: [], state: snapshot() };
    const events = [];
    if (id === "pause" || id === "resume") s.paused = id === "pause";
    else if (id === "letter") {
      if (s.stage === "letter") s.stage = "folds";
      events.push({ type: "letter", text: INTRO });
    } else if (id.startsWith("fold:")) {
      const [, index, action] = id.split(":"),
        i = +index;
      if (action === "rotate") s.folds[i] = (s.folds[i] + 1) % 4;
      if (action === "reset") s.folds[i] = 0;
      if (action === "pour") {
        if (s.folds[i] === FOLDS[i].target) {
          s.solved[i] = true;
          events.push({ type: "water-connected", segment: i });
          if (s.solved.every(Boolean)) s.stage = "ready";
        } else
          events.push({ type: "fold-hint", segment: i, text: FOLDS[i].hint });
      } else
        events.push({
          type: "fold-turned",
          segment: i,
          orientation: s.folds[i],
        });
    } else if (id === "boat") {
      s.stage = "sailing";
      events.push({ type: "board" });
    } else if (id === "rain" || id === "windmill") {
      s[id] = true;
      events.push({ type: id });
    } else if (id === "return") {
      s.stage = "returning";
      events.push({ type: "return-route" });
    } else if (id === "echo" || id === "collection") {
      s.stage = "memory";
      s.memoryTime = 0;
      events.push({ type: "memory-start" }, { type: "cue", ...CUES[0] });
    } else if (id === "skip") {
      events.push(...finish(), { type: "memory-end", skipped: true });
    }
    return { ok: true, events, state: snapshot() };
  }
  function tick(dt, { speed = Infinity, zone = "", paused = false } = {}) {
    const events = [];
    if (s.paused || paused || !finite(dt, 0, 60))
      return { events, state: snapshot() };
    if (s.stage === "sailing" && zone === "sunset") {
      s.stage = "sunset";
      events.push({
        type: "sunset-arrival",
        text: "如果今天可以慢一点就好了。",
      });
    }
    if (
      s.stage === "sunset" &&
      zone === "sunset" &&
      Number.isFinite(speed) &&
      Math.abs(speed) < 0.15
    )
      s.sunsetStay = Math.min(86400, s.sunsetStay + dt);
    if (s.stage === "returning" && zone === "office") {
      s.stage = "echo";
      events.push({ type: "arrived-office" });
    }
    if (s.stage === "memory") {
      const before = s.memoryTime;
      s.memoryTime = Math.min(MEMORY_DURATION, before + dt);
      for (const cue of CUES)
        if (cue.at > before && cue.at <= s.memoryTime)
          events.push({ type: "cue", ...cue });
      if (s.memoryTime >= MEMORY_DURATION)
        events.push(...finish(), { type: "memory-end", skipped: false });
    }
    return { events, state: snapshot() };
  }
  return { snapshot, interact, tick, canInteract };
}
