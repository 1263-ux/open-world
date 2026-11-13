import * as T from "./vendor/three.module.js";
export function makeOcclusion() {
  const ray = new T.Raycaster(),
    direction = new T.Vector3(),
    modified = new Map();
  return {
    update(target, cameraPosition, roots) {
      for (const [o, orig] of modified) {
        o.material = orig;
      }
      modified.clear();
      direction.copy(cameraPosition).sub(target);
      const distance = direction.length();
      if (distance < 0.1) return;
      ray.set(target, direction.normalize());
      ray.far = distance - 0.25;
      for (const hit of ray.intersectObjects(roots, true)) {
        const o = hit.object;
        if (!o.isMesh || !o.visible || modified.has(o)) continue;
        let ancestor = o,
          hidden = false;
        while (ancestor) {
          if (!ancestor.visible) hidden = true;
          ancestor = ancestor.parent;
        }
        if (hidden) continue;
        const original = o.material;
        const items = Array.isArray(original) ? original : [original];
        if (items.every((m) => m.transparent && m.opacity < 0.3)) continue;
        if (!o.userData.occlusionMaterials)
          o.userData.occlusionMaterials = items.map((m) => {
            const c = m.clone();
            c.transparent = true;
            c.opacity = 0.08;
            c.depthWrite = false;
            return c;
          });
        modified.set(o, original);
        o.material = Array.isArray(original)
          ? o.userData.occlusionMaterials
          : o.userData.occlusionMaterials[0];
      }
    },
  };
}
