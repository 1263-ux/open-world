import * as T from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { memoryClipTime } from "./memory-pose.js";
export function createRealityScene(scene) {
  const root = new T.Group();
  root.name = "Isolated_C06";
  root.position.set(300, 0, 0);
  root.visible = false;
  scene.add(root);
  let ready = false,
    mixer,
    action,
    duration = 6;
  const light = new T.PointLight(0xffdfba, 4, 4, 2);
  light.position.set(0.3, 2.2, -0.1);
  light.castShadow = true;
  light.shadow.mapSize.set(512, 512);
  light.shadow.camera.near = 0.05;
  light.shadow.camera.far = 5;
  light.shadow.bias = -0.0005;
  root.add(new T.HemisphereLight(0xd5e1eb, 0x62594e, 0.65));
  root.add(light);
  const loaded = new GLTFLoader()
    .loadAsync("../child-recovery/c06-child-scene.glb")
    .then((g) => {
      const clip = g.animations.find((c) => c.name === "Xiaoman_PlaceDrawing");
      if (!clip) throw Error("C06 animation missing");
      g.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = !(o.material?.transparent && o.material.opacity < 0.5);
          o.receiveShadow = true;
        }
      });
      root.add(g.scene);
      mixer = new T.AnimationMixer(g.scene);
      action = mixer.clipAction(clip);
      action.setLoop(T.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      duration = clip.duration;
      ready = true;
      return { duration };
    });
  return {
    root,
    loaded,
    get ready() {
      return ready;
    },
    camera: { position: [301.6, 1.65, 2.2], focus: [300.05, 1, -0.12] },
    update(visible, memoryTime) {
      root.visible = visible && ready;
      if (!root.visible) return;
      action.enabled = true;
      action.paused = false;
      mixer.setTime(
        Math.min(memoryClipTime(memoryTime, 73, duration), duration - 0.0001),
      );
    },
  };
}

export function createLightIsolation(scene, localRoot) {
  const original = new Map();
  const local = (o) => {
    for (let p = o; p; p = p.parent) if (p === localRoot) return true;
    return false;
  };
  return {
    set(active) {
      if (active) {
        scene.traverse((o) => {
          if (o.isLight && !local(o)) {
            if (!original.has(o)) original.set(o, o.visible);
            o.visible = false;
          }
        });
      } else {
        for (const [o, visible] of original) o.visible = visible;
        original.clear();
      }
    },
  };
}
