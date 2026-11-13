import { createDirectFold } from "./direct-fold.js";
import { shouldCutShot } from "./memory-pose.js";
import { createRealityScene, createLightIsolation } from "./reality-scene.js";
import {
  createProgressSave,
  bindProgressLifecycle,
  captureInteraction,
  allowSafetyReset,
  validateLoadedPosition,
} from "./progress-save.js";
import { boatPose } from "./boat-state.js";
import { frameTime } from "./frame-time.js";
import { environmentAnchor } from "./shot-environment.js";
import { upgradeCourier } from "./animated-courier.js";
import { createSky } from "./sky.js";
import { createAudio } from "./audio.js";
import { createMemoryProps } from "./memory-art.js";
import { makeOcclusion } from "./occlusion.js";
import { safeAnchor, restorePlayer } from "./session.js";
import * as T from "three";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { Controller, nearestInteraction } from "./controller.js";
import {
  makeWorld,
  makeCourier,
  authoredFootprint,
  authoredHeight,
} from "./world.js";
import { createStory, INTRO, FOLDS, CUES } from "./narrative.js";
const $ = (s) => document.querySelector(s),
  canvas = $("#view"),
  panel = $("#panel"),
  prompt = $("#prompt");
let renderer,
  sceneReady = false;
try {
  renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "low-power",
  });
} catch (e) {
  $("#title").textContent = "暂时无法打开雾海";
  $("#copy").textContent =
    "当前浏览器没有提供游戏所需的 WebGL2 图形环境，游戏尚未启动。\n这不一定是电脑配置不足。可以在支持 WebGL2 的浏览器中重新打开，或稍后重试。";
  $("#menu").hidden = true;
  prompt.hidden = true;
  $("#status").hidden = true;
  $("#touch").style.display = "none";
  $("#use").style.display = "none";
  const retry = document.createElement("button");
  retry.textContent = "重新尝试";
  retry.onclick = () => location.reload();
  $("#choices").replaceChildren(retry);
  panel.addEventListener("cancel", (event) => event.preventDefault());
  panel.showModal();
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new T.Scene();
scene.background = new T.Color("#536780");
scene.fog = new T.FogExp2("#536780", 0.025);
const worldFog = scene.fog;
const camera = new T.PerspectiveCamera(48, 1, 0.1, 180);
scene.add(new T.HemisphereLight(0xb5c5de, 0x354050, 1.4));
const sun = new T.DirectionalLight(0xd2deee, 2);
sun.position.set(-10, 18, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, {
  left: -17,
  right: 17,
  top: 17,
  bottom: -17,
  near: 0.1,
  far: 65,
});
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0003;
scene.add(sun, sun.target);
const sky = createSky(scene);
const world = makeWorld(scene),
  actor = makeCourier(scene),
  occlusion = makeOcclusion(),
  occlusionRoots = [world.root];
const reality = createRealityScene(scene),
  lightIsolation = createLightIsolation(scene, reality.root);
reality.loaded
  .then(() => (canvas.dataset.realityReady = "1"))
  .catch((e) => (canvas.dataset.realityError = String(e)));
let saved = null;
try {
  saved = JSON.parse(localStorage.getItem("dream-post-office-recovery-v1"));
} catch {}
const story = createStory(saved?.story);
const player = new Controller({
  walkable: world.walkable,
  colliders: world.colliders,
});
Object.assign(player, restorePlayer(saved, story.snapshot(), world));
let saveStatus = null;
const progressSave = createProgressSave({
  onStatus: (ok) => {
    saveStatus = ok;
    $("#save-warning").hidden = ok;
  },
  storage: { setItem: (k, v) => localStorage.setItem(k, v) },
  read: () => ({
    story: story.snapshot(),
    player: { x: player.x, z: player.z, boating: player.boating },
  }),
});
bindProgressLifecycle(progressSave, document, window);
const directFold = createDirectFold({story,position:()=>player,location:i=>world.folds[i].g.position,emit:events});
document.addEventListener("visibilitychange",()=>{if(document.hidden)directFold.cancel();});
const memoryCourier = makeCourier(scene),
  xiaoman = makeCourier(scene);
memoryCourier.group.visible = false;
xiaoman.group.visible = false;
xiaoman.group.scale.setScalar(0.78);
upgradeCourier(actor)
  .then((r) => (canvas.dataset.characterClips = r.clips.join(",")))
  .catch((e) => (canvas.dataset.characterError = String(e)));
upgradeCourier(memoryCourier).catch(() => {});
const memoryProps = createMemoryProps(T);
memoryProps.rainGroup.position.set(10, 0, -43);
memoryProps.windmillGroup.position.set(9, 0, -51);
scene.add(memoryProps.rainGroup, memoryProps.windmillGroup);
const readableLetter = new T.Mesh(
  new T.PlaneGeometry(0.67, 0.45),
  new T.MeshStandardMaterial({
    map: memoryProps.letterTexture,
    roughness: 0.95,
  }),
);
readableLetter.rotation.x = -Math.PI / 2;
readableLetter.position.set(-0.42, 1.015, -2.1);
scene.add(readableLetter);
const cloudDrawing = new T.Mesh(
  new T.PlaneGeometry(0.65, 0.44),
  new T.MeshStandardMaterial({
    map: memoryProps.drawingTexture,
    roughness: 0.9,
  }),
);
cloudDrawing.position.set(-2, 1.5, -0.475);
scene.add(cloudDrawing);
const boat = new T.Group();
scene.add(boat);
const shape = new T.Shape();
shape.moveTo(-0.7, -1);
shape.lineTo(0, -1.65);
shape.lineTo(0.7, -1);
shape.lineTo(0.7, 1);
shape.lineTo(0, 1.65);
shape.lineTo(-0.7, 1);
shape.closePath();
const bottom = new T.Mesh(new T.ShapeGeometry(shape), world.mats.paper);
bottom.rotation.x = -Math.PI / 2;
boat.add(bottom);
const seat = new T.Mesh(new T.BoxGeometry(0.95, 0.05, 0.5), world.mats.paper);
seat.position.y = 0.185;
boat.add(seat);
for (const side of [-1, 1]) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [
        side * 0.46,
        0,
        -1,
        side * 0.7,
        0.44,
        -1,
        side * 0.74,
        0.35,
        0,
        side * 0.46,
        0,
        -1,
        side * 0.74,
        0.35,
        0,
        side * 0.46,
        0,
        1,
        side * 0.46,
        0,
        1,
        side * 0.74,
        0.35,
        0,
        side * 0.7,
        0.44,
        1,
        side * 0.7,
        0.44,
        -1,
        side * 0.7,
        0.44,
        1,
        side * 0.74,
        0.35,
        0,
      ],
      3,
    ),
  );
  geometry.computeVertexNormals();
  const paper = world.mats.paper.clone();
  paper.side = T.DoubleSide;
  const wall = new T.Mesh(geometry, paper);
  wall.castShadow = wall.receiveShadow = true;
  boat.add(wall);
  const seatFold = new T.Mesh(
    new T.BoxGeometry(0.035, 0.16, 0.48),
    world.mats.paper,
  );
  seatFold.position.set(side * 0.38, 0.08, 0);
  seatFold.castShadow = seatFold.receiveShadow = true;
  boat.add(seatFold);
}
// Close the four small folds between the sloped side walls and pointed ends.
for (const side of [-1, 1])
  for (const end of [-1, 1]) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(
        [side * 0.46, 0, end, side * 0.7, 0, end, side * 0.7, 0.44, end],
        3,
      ),
    );
    geometry.computeVertexNormals();
    const paper = world.mats.paper.clone();
    paper.side = T.DoubleSide;
    const gusset = new T.Mesh(geometry, paper);
    gusset.castShadow = gusset.receiveShadow = true;
    boat.add(gusset);
  }
// Folded pointed ends close the hull without covering the usable inner floor.
for (const end of [-1, 1]) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [
        -0.7,
        0.44,
        end,
        0,
        0.36,
        end * 1.65,
        -0.7,
        0,
        end,
        -0.7,
        0,
        end,
        0,
        0.36,
        end * 1.65,
        0,
        0,
        end * 1.65,
        0,
        0.36,
        end * 1.65,
        0.7,
        0.44,
        end,
        0.7,
        0,
        end,
        0,
        0.36,
        end * 1.65,
        0.7,
        0,
        end,
        0,
        0,
        end * 1.65,
      ],
      3,
    ),
  );
  geometry.computeVertexNormals();
  const paper = world.mats.paper.clone();
  paper.side = T.DoubleSide;
  const folded = new T.Mesh(geometry, paper);
  folded.castShadow = folded.receiveShadow = true;
  boat.add(folded);
}
const bowl = new T.Mesh(
  new T.SphereGeometry(
    0.26,
    24,
    16,
    0,
    Math.PI * 2,
    Math.acos(0.18 / 0.26),
    Math.PI - Math.acos(0.18 / 0.26),
  ),
  new T.MeshPhysicalMaterial({
    color: 0xbadce3,
    transparent: true,
    opacity: 0.24,
    roughness: 0.1,
    side: T.DoubleSide,
  }),
);
bowl.position.set(0.35, 0.46, -0.5);
boat.add(bowl);
const rim = new T.Mesh(
  new T.TorusGeometry(0.18, 0.012, 6, 24),
  world.mats.paper,
);
rim.rotation.x = Math.PI / 2;
rim.position.set(0.35, 0.64, -0.5);
boat.add(rim);
const bowlWater = new T.Mesh(
  new T.CircleGeometry(0.23, 28),
  new T.MeshStandardMaterial({
    color: 0xa6ccd1,
    transparent: true,
    opacity: 0.2,
    roughness: 0.25,
    side: T.DoubleSide,
    depthWrite: false,
  }),
);
bowlWater.rotation.x = -Math.PI / 2;
bowlWater.position.set(0.35, 0.58, -0.5);
boat.add(bowlWater);
const bowlTray = new T.Mesh(
  new T.CylinderGeometry(0.16, 0.18, 0.045, 20),
  world.mats.paper,
);
bowlTray.position.set(0.35, 0.18, -0.5);
boat.add(bowlTray);
for (let i = 0; i < 3; i++) {
  const a = (i * Math.PI * 2) / 3;
  const fold = new T.Mesh(
    new T.BoxGeometry(0.035, 0.16, 0.1),
    world.mats.paper,
  );
  fold.position.set(0.35 + Math.cos(a) * 0.11, 0.08, -0.5 + Math.sin(a) * 0.11);
  fold.rotation.y = -a;
  fold.castShadow = fold.receiveShadow = true;
  boat.add(fold);
}

const fish = new T.Mesh(
  new T.SphereGeometry(0.075, 12, 8),
  new T.MeshStandardMaterial({ color: 0xdcb879 }),
);
fish.scale.set(1.1, 0.8, 0.7);
bowl.add(fish);
const fishTail = new T.Mesh(new T.ConeGeometry(0.05, 0.1, 3), fish.material);
fishTail.rotation.z = -Math.PI / 2;
fishTail.position.x = -0.09;
fish.add(fishTail);
const eye = new T.Mesh(
  new T.SphereGeometry(0.008, 6, 4),
  new T.MeshBasicMaterial({ color: 0x333a43 }),
);
eye.position.set(0.05, 0.02, 0.05);
fish.add(eye);
// Authored scene study is a real GLB, not a background image. Reuse only compatible hub sections.
new GLTFLoader().load(
  "../asset-recovery/mist-post-office-study.glb",
  (gltf) => {
    const authored = gltf.scene;
    authored.name = "AuthoredPostOffice";
    authored.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(authored);
    occlusionRoots.push(authored);
    world.colliders[0] = { x: -0.85, z: -2.1, w: 2, d: 0.84 };
    world.colliders.push({ x: -1.25, z: -3.3, w: 2.9, d: 0.65 });
    for (const l of world.lamps.slice(0, 2)) {
      l.visible = false;
      l.userData.light.visible = false;
    }
    for (const [x, y, z] of [
      [-0.7, 1.39, 4.4],
      [1.7, 1.59, 1.5],
      [1.6, 1.94, -2.7],
      [-1.1, 1.8, -2.7],
    ]) {
      const light = new T.PointLight(0xffd4a2, z === -2.7 ? 5 : 3, 4);
      light.position.set(x, y, z);
      scene.add(light);
    }
    world.desk.visible = false;
    world.hub.visible = false;
    world.oldArches.visible = false;
    // Match actual authored shore/bridge footprint, leave no invisible giant hub disc.
    const oldWalk = player.walkable;
    player.walkable = (x, z, boat) => authoredFootprint(x, z, boat, oldWalk);
    if (player.z > 0 && player.z < 8 && Math.abs(player.x) < 2) player.x = 0.5;
    validateLoadedPosition(player, recoverPlayer);
    canvas.dataset.authoredAssets = "loaded";
    sceneReady = true;
    canvas.style.opacity = "1";
  },
  undefined,
  (error) => {
    canvas.dataset.assetError = String(error?.message || error);
    sceneReady = true;
    canvas.style.opacity = "1";
    $("#status").textContent =
      "美术资产载入失败，当前仅为工程占位。请勿把此画面当作最终版本。";
  },
);
const audio = createAudio();
let soundWanted = false,
  soundRunning = false;
function resumeSound() {
  return audio.enable().then((ok) => {
    soundRunning = ok;
    $("#sound").textContent = ok ? "关闭声音" : "恢复声音";
    return ok;
  });
}
document.addEventListener("visibilitychange", () => {
  last = performance.now(); // hidden time is never consumed by the narrative on resume
  if (document.hidden && soundWanted) {
    soundRunning = false;
    $("#sound").textContent = "恢复声音";
  }
});
const keys = {},
  uiPaused = { value: false };
let yaw = 0,
  pitch = 0.42,
  distance = 6,
  last = performance.now(),
  time = 0,
  near = null,
  currentCue = null,
  appliedCinematic = null;
function recoverPlayer() {
  directFold.cancel();
  const a = safeAnchor(story.snapshot().stage);
  player.safeReset(a.x, a.z);
  player.boating = a.boating;
  progressSave.flush();
}
if (story.snapshot().stage === "memory")
  currentCue = CUES.filter((c) => c.at <= story.snapshot().memoryTime).at(-1);
function modal(title, text, buttons, kind = "default") {
  panel.dataset.kind = kind;
  $("#title").textContent = title;
  $("#copy").textContent = text;
  $("#choices").replaceChildren();
  for (const [label, action] of buttons) {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = () => {
      panel.close();
      action?.();
      if (soundWanted) resumeSound();
    };
    $("#choices").append(b);
  }
  panel.showModal();
}
function events(result) {
  for (const e of result.events) {
    if (e.type === "letter" || e.type === "memory-start") audio.cue("paper");
    if (e.type === "water-connected") audio.cue("wood");
    if (e.type === "board") {
      player.boating = true;
      player.y = player.vy = 0;
      player.x = 0;
      player.z = -28;
    }
    if (e.type === "letter")
      modal("一封画着小鱼的信", e.text, [["收好信，去水渠看看"]], "letter");
    if (e.type === "fold-hint") $("#status").textContent = e.text;
    if (e.type === "water-connected")
      $("#status").textContent =
        `第 ${e.segment + 1} 段水渠已接通，水流正朝纸船汇去。`;
    if (e.type === "cue") currentCue = e;
    if (e.type === "memory-end") {
      currentCue = null;
      $("#status").textContent = "那幅云的画留在了邮局。你随时可以再读这封信。";
    }
    if (e.type === "return-route")
      $("#status").textContent = "顺着已经接通的水路返航。岸边可以下船。";
  }
  progressSave.changed();
  return result;
}
function hotspots() {
  const s = story.snapshot();
  let a = [
    { id: "letter", x: 0, z: -2, label: "读一封未寄出的信" },
    { id: "boat", x: 0, z: -28, label: "坐进纸船" },
    { id: "return", x: 0, z: -61, label: "返航" },
    { id: "echo", x: 0, z: -2, label: "展开回信" },
    { id: "collection", x: -2, z: -0.5, label: "看看留下的云" },
    { id: "rain", x: 10, z: -43, label: "伸手接住雨滴" },
    { id: "windmill", x: 9, z: -51, label: "拨动纸风车" },
  ];
  for (let i = 0; i < 3; i++)
    a.push({
      id: `fold:${i}:rotate`,
      x: world.folds[i].g.position.x,
      z: world.folds[i].g.position.z,
      label: `转动第 ${i + 1} 页纸槽 · 让出口对准接水口`,
    });
  return a.filter((o) => story.canInteract(o.id, { near: true }));
}
function interact() {
  if (panel.open || uiPaused.value) return;
  if (
    player.boating &&
    player.z > -29 &&
    story.snapshot().stage === "returning"
  ) {
    player.boating = false;
    player.z = -27;
    progressSave.flush();
    return;
  }
  if (!near) return;
  const applyInteraction = captureInteraction(
    near,
    () => player,
    story,
    events,
  );
  if (near.id.startsWith("fold:")) {
    directFold.start(+near.id.split(":")[1]);
  } else applyInteraction();
}
addEventListener("keydown", (e) => {
  if (
    [
      "w",
      "a",
      "s",
      "d",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      " ",
    ].includes(e.key)
  )
    e.preventDefault();
  keys[e.key.toLowerCase()] = true;
  if (!e.repeat && e.key.toLowerCase() === "e") interact();
  if (
    !e.repeat &&
    e.key.toLowerCase() === "r" &&
    allowSafetyReset(panel.open)
  ) {
    recoverPlayer();
  }
});
addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));
addEventListener("blur", () => {
  for (const k in keys) keys[k] = false;
});
let drag = null;
canvas.addEventListener("pointerdown", (e) => {
  drag = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  yaw -= (e.clientX - drag.x) * 0.005;
  pitch = T.MathUtils.clamp(pitch + (e.clientY - drag.y) * 0.003, 0.15, 0.85);
  drag = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointerup", () => (drag = null));
canvas.addEventListener("pointercancel", () => (drag = null));
canvas.addEventListener(
  "wheel",
  (e) => {
    distance = T.MathUtils.clamp(distance + e.deltaY * 0.004, 3.8, 9);
  },
  { passive: true },
);
$("#pause").onclick = () => {
  uiPaused.value = true;
  modal(
    "在这里歇一会儿",
    (saveStatus === false
      ? "本浏览器未能保存最新进度，请暂时不要关闭或刷新页面。"
      : saveStatus === true
        ? "最近一次进度已保存在这台浏览器。"
        : "正在尝试将进度保存在这台浏览器。") +
      "当前仍为恢复开发版，未达到参考品质验收。",
    [
      ["继续", () => (uiPaused.value = false)],
      [
        "回安全位置",
        () => {
          recoverPlayer();
          uiPaused.value = false;
        },
      ],
      [
        "跳过当前回响",
        () => {
          events(story.interact("skip"));
          uiPaused.value = false;
        },
      ],
    ],
  );
};
panel.addEventListener("cancel", () => (uiPaused.value = false));
$("#sound").onclick = () => {
  if (soundRunning) {
    soundWanted = false;
    soundRunning = false;
    audio.mute();
    $("#sound").textContent = "开启声音";
  } else {
    soundWanted = true;
    resumeSound();
  }
};
$("#use").onclick = interact;
document.querySelectorAll("[data-key]").forEach((b) => {
  b.onpointerdown = (e) => {
    keys[b.dataset.key] = true;
    b.setPointerCapture(e.pointerId);
  };
  b.onpointerup = b.onpointercancel = () => (keys[b.dataset.key] = false);
});
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
function loop(now) {
  requestAnimationFrame(loop);
  const { wall, physics: dt } = frameTime(now, last);
  last = now;
  if (document.hidden) return;
  let s = story.snapshot();
  const paused = panel.open || uiPaused.value || !sceneReady;
  if (paused && soundWanted && soundRunning) {
    soundRunning = false;
    $("#sound").textContent = "恢复声音";
  }
  if (!paused) time += wall;
  if (!paused && sceneReady && s.stage !== "memory")
    player.step(
      dt,
      {
        forward: keys.w || keys.arrowup,
        backward: keys.s || keys.arrowdown,
        left: keys.a || keys.arrowleft,
        right: keys.d || keys.arrowright,
        run: keys.shift,
        jump: keys[" "],
      },
      yaw,
    );
  events(
    story.tick(wall, {
      speed: player.speed,
      zone: player.z < -56 ? "sunset" : player.z > -10 ? "office" : "river",
      paused,
    }),
  );
  directFold.update(wall, {paused});
  s = story.snapshot();
  const floorY =
    canvas.dataset.authoredAssets === "loaded" && !player.boating
      ? authoredHeight(player.x, player.z)
      : 0;
  actor.group.position.set(
    player.x,
    player.y +
      floorY +
      (player.boating
        ? actor.group.userData.hasSitting
          ? 0.04065 + Math.sin(time) * 0.015
          : 0.3
        : 0),
    player.z,
  );
  actor.group.visible = s.stage !== "memory";
  actor.group.rotation.y = player.heading;
  actor.update(time, paused ? 0 : player.speed, player.boating);
  // Keep the physical boat at its dock before boarding and after disembarking.
  // An invisible hotspot is not a readable vehicle or destination.
  boat.visible = true;
  const boatTransform = boatPose(s.stage, player, time);
  boat.position.set(boatTransform.x, boatTransform.y, boatTransform.z);
  boat.rotation.y = boatTransform.heading;
  const watchingClouds = s.stage === "sunset" && player.speed < 0.15;
  fish.position.x =
    Math.sin(time * (watchingClouds ? 0.2 : 1)) *
    (watchingClouds ? 0.025 : 0.05);
  fish.rotation.z = watchingClouds ? 0.16 : Math.sin(time) * 0.04;
  fishTail.rotation.y = Math.sin(time * (watchingClouds ? 2 : 7)) * 0.25;
  world.memory.visible = s.collected;
  memoryCourier.group.visible =
    s.stage === "memory" &&
    ["cloud-boat", "fish-bubbles", "sunset"].includes(currentCue?.shot);
  memoryCourier.group.position.set(
    0,
    memoryCourier.group.userData.hasSitting ? 0.04065 : 0.3,
    -61,
  );
  memoryCourier.group.rotation.y = Math.PI;
  memoryCourier.update(time, 0, true);
  const realityActive =
    s.stage === "memory" && currentCue?.shot === "sky-drawing" && reality.ready;
  reality.update(realityActive, s.memoryTime);
  xiaoman.group.visible =
    s.stage === "memory" &&
    currentCue?.shot === "sky-drawing" &&
    !reality.ready;
  xiaoman.group.position.set(-2.7, 0, -0.1);
  xiaoman.group.rotation.y = Math.PI / 2;
  xiaoman.update(time, 0, false);
  if (xiaoman.group.visible) xiaoman.arms[1].rotation.x = -1.5;
  cloudDrawing.visible = s.collected || s.stage === "memory";
  memoryProps.update(time, { rain: s.rain, windmill: s.windmill });
  world.folds.forEach((f, i) => {
    const foldVisual = directFold.visual(i);
    f.g.rotation.y = foldVisual.angle;
    f.water.visible = s.solved[i];
    world.connectedWater[i].visible = s.solved[i];
    f.bead.visible = s.solved[i] || foldVisual.trying;
    f.bead.position.z = s.solved[i]
      ? 0.4 - ((time * 0.6 + i * 0.3) % 1) * 1.5
      : 0.4 - foldVisual.progress * 1.25;
  });
  const focus = new T.Vector3(player.x, player.y + 1.1, player.z),
    dest = new T.Vector3(
      player.x + Math.sin(yaw) * distance,
      player.y + 1 + Math.sin(pitch) * distance,
      player.z + Math.cos(yaw) * distance,
    );
  if (s.stage === "memory" && currentCue) {
    const targets = {
      envelope: [-0.4, 1.55, -1.1, -0.42, 1.01, -2.1],
      "cloud-boat": [3, 3, -56, 0, 1, -61],
      "paper-water": [5, 4, -17, 0, 0.5, -22],
      "fish-bubbles": [1, 1, -59, 0, 0.3, -61],
      sunset: [4, 3, -56, 0, 1, -61],
      "sky-drawing": [-2, 2, 2, -2, 1.5, -0.5],
      "collection-wall": [-2, 2, 2, -2, 1.5, -0.5],
    };
    const v = realityActive
      ? [...reality.camera.position, ...reality.camera.focus]
      : targets[currentCue.shot];
    dest.set(...v.slice(0, 3));
    focus.set(...v.slice(3));
    prompt.hidden = !currentCue.text;
    prompt.textContent = currentCue.text;
  } else {
    near = nearestInteraction(player, hotspots(), 2.3);
    prompt.hidden = !near;
    prompt.textContent = near ? "E · " + near.label : "";
    if (player.boating && player.z > -29 && s.stage === "returning") {
      prompt.hidden = false;
      prompt.textContent = "E · 靠岸下船";
    }
  }
  // Authored reading composition only after an explicit read action; never override free orbit.
  if (panel.open && panel.dataset.kind === "letter") {
    dest.set(-0.05, 3.446562718, 5.1);
    focus.set(-0.85, 1.4, -2.1);
  }
  const cinematicKey =
    s.stage === "memory" && currentCue
      ? `${currentCue.id}:${realityActive}`
      : null;
  if (shouldCutShot(appliedCinematic, cinematicKey)) camera.position.copy(dest);
  else camera.position.lerp(dest, 1 - Math.exp(-5 * dt));
  appliedCinematic = cinematicKey;
  camera.lookAt(focus);
  scene.updateMatrixWorld(true);
  occlusion.update(focus, camera.position, occlusionRoots);
  const environment = environmentAnchor(s.stage, player, focus);
  audio.update({
    zone:
      environment.z < -56 ? "sunset" : environment.z > -10 ? "office" : "river",
    speed: s.stage === "memory" ? 0 : player.speed,
    paused,
  });
  sun.position.set(environment.x - 10, 18, environment.z + 3);
  sun.target.position.set(environment.x, 0, environment.z);
  const warmth = T.MathUtils.smoothstep(-environment.z, 30, 59);
  scene.background.set("#536780").lerp(new T.Color("#b7a8b1"), warmth);
  worldFog.color.copy(scene.background);
  lightIsolation.set(realityActive);
  world.root.visible = !realityActive;
  scene.fog = realityActive ? null : worldFog;
  if (realityActive) scene.background.set("#8b8780");
  sky.update(environment.x, environment.y, environment.z, warmth);
  sky.sphere.visible = sky.ready && !realityActive;
  if (!sceneReady) {
    prompt.hidden = false;
    prompt.textContent = "正在展开雾海…";
  }
  renderer.render(scene, camera);
  canvas.dataset.position = `${player.x.toFixed(2)},${player.z.toFixed(2)}`;
  canvas.dataset.stage = s.stage;
  progressSave.tick(wall);
}
camera.position.set(0, 4, 13);
requestAnimationFrame(loop);
