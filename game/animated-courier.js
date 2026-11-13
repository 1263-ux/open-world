import * as T from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { clone } from "./vendor/SkeletonUtils.js";
let source;
const getSource = () =>
  (source ??= new GLTFLoader().loadAsync("./assets/courier-candidate.glb"));
export async function upgradeCourier(actor) {
  const data = await getSource(),
    model = clone(data.scene);
  model.scale.setScalar(0.78);
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const fallback = [...actor.group.children],
    oldUpdate = actor.update.bind(actor);
  actor.group.add(model);
  const mixer = new T.AnimationMixer(model),
    actions = {};
  for (const clip of data.animations)
    actions[clip.name] = mixer.clipAction(clip);
  let active = null,
    last = null;
  actor.update = (t, speed, boating) => {
    const dt = last === null ? 0 : Math.max(0, Math.min(1, t - last));
    last = t;
    const desired = boating
      ? "Sitting_Rig"
      : speed > 0.1
        ? "Walking_A_Rig"
        : "Idle_Rig";
    const action = actions[desired];
    if (!action) {
      model.visible = false;
      fallback.forEach((o) => (o.visible = true));
      oldUpdate(t, speed, boating);
      return;
    }
    model.visible = true;
    fallback.forEach((o) => (o.visible = false));
    if (active !== action) {
      active?.fadeOut(0.2);
      action.reset().fadeIn(0.2).play();
      active = action;
    }
    action.timeScale =
      desired === "Walking_A_Rig"
        ? T.MathUtils.clamp(speed / 1.2, 0.65, 2.5)
        : 1;
    mixer.update(dt);
  };
  actor.group.userData.hasSitting = !!actions.Sitting_Rig;
  actor.group.userData.character = "kaykit-original-postal-adaptation";
  return { model, mixer, clips: Object.keys(actions) };
}
