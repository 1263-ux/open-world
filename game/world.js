import * as T from "./vendor/three.module.js";
export function makeWorld(scene) {
  const root = new T.Group();
  scene.add(root);
  const mats = {
    stone: new T.MeshStandardMaterial({ color: 0x8695a7, roughness: 0.92 }),
    wood: new T.MeshStandardMaterial({ color: 0xafa797, roughness: 0.88 }),
    paper: new T.MeshStandardMaterial({
      color: 0xe9e2d4,
      roughness: 0.95,
      side: T.DoubleSide,
    }),
    brass: new T.MeshStandardMaterial({
      color: 0x77705d,
      metalness: 0.35,
      roughness: 0.65,
    }),
    warm: new T.MeshBasicMaterial({ color: 0xf2d29e }),
    water: new T.MeshStandardMaterial({
      color: 0x82adb5,
      roughness: 0.32,
      metalness: 0.24,
    }),
    dark: new T.MeshStandardMaterial({ color: 0x435369, roughness: 1 }),
  };
  const mesh = (g, m, x, y, z, parent = root) => {
    let o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  function box(w, h, d, x, y, z, m = mats.stone, p = root) {
    return mesh(new T.BoxGeometry(w, h, d), m, x, y, z, p);
  }
  function island(x, z, r) {
    const o = mesh(
      new T.CylinderGeometry(r, r * 0.82, 0.65, 48),
      mats.stone,
      x,
      -0.35,
      z,
    );
    return o;
  }
  const hub = island(0, 0, 10);
  island(0, -22, 8);
  island(0, -61, 9);
  const sunsetWater = mesh(
    new T.CircleGeometry(8.6, 64),
    mats.water,
    0,
    0.025,
    -61,
  );
  sunsetWater.rotation.x = -Math.PI / 2;
  const benchShore = island(-3, -61, 1.6);
  benchShore.position.y = -0.1;
  const floor = mesh(
    new T.PlaneGeometry(600, 600),
    new T.MeshStandardMaterial({
      color: 0x4e647c,
      roughness: 0.55,
      metalness: 0.25,
    }),
    0,
    -1.2,
    0,
  );
  floor.rotation.x = -Math.PI / 2;
  const bridges = [];
  for (let z = -5; z >= -15; z -= 0.55) {
    const p = box(3, 0.12, 0.5, 0, 0.02, z, mats.wood);
    bridges.push(p);
  }
  function lantern(x, z) {
    const group = new T.Group();
    group.position.set(x, 0, z);
    root.add(group);
    mesh(
      new T.CylinderGeometry(0.04, 0.06, 1.8, 10),
      mats.brass,
      0,
      0.9,
      0,
      group,
    );
    mesh(
      new T.CylinderGeometry(0.18, 0.22, 0.1, 8),
      mats.brass,
      0,
      1.85,
      0,
      group,
    );
    mesh(
      new T.CylinderGeometry(0.16, 0.16, 0.34, 8),
      mats.warm,
      0,
      2.05,
      0,
      group,
    );
    mesh(new T.ConeGeometry(0.25, 0.15, 8), mats.brass, 0, 2.3, 0, group);
    const l = new T.PointLight(0xffd6a1, 5, 5, 2);
    l.position.set(x, 2.15, z);
    root.add(l);
    group.userData.light = l;
    return group;
  }
  const lamps = [
    lantern(-2, 5),
    lantern(3, -3),
    lantern(-2, -10),
    lantern(3, -19),
    lantern(7, -60),
  ];
  // Walkable geometry is the same set of rectangles as collision navigation, not an invisible boat track.
  const waterways = [
    { x: 0, z: -32, w: 4, d: 10 },
    { x: 5, z: -37, w: 14, d: 4 },
    { x: 10, z: -45, w: 4, d: 18 },
    { x: 5, z: -54, w: 14, d: 4 },
    { x: 0, z: -59, w: 4, d: 12 },
  ];
  waterways.forEach((r) => box(r.w, 0.12, r.d, r.x, -0.02, r.z, mats.water));
  // Three distinct foldable paper troughs, with visible water lines on correct orientation.
  const folds = [];
  [
    [-4, -22],
    [0, -22],
    [0, -26],
  ].forEach(([x, z], i) => {
    const g = new T.Group();
    g.position.set(x, 0.15, z);
    root.add(g);
    box(1.2, 0.05, 2.4, 0, 0.1, 0, mats.paper, g);
    let a = box(0.05, 0.45, 2.4, -0.58, 0.3, 0, mats.paper, g);
    a.rotation.z = 0.2;
    let b = box(0.05, 0.45, 2.4, 0.58, 0.3, 0, mats.paper, g);
    b.rotation.z = -0.2; // Narrow asymmetric lip makes the exit readable, unlike a symmetric direction-password tray.
    const lip = box(0.8, 0.04, 0.65, 0, 0.1, -0.85, mats.paper, g);
    const inlet = box(0.95, 0.24, 0.07, 0, 0.2, 0.58, mats.paper, g);
    const arrow = mesh(
      new T.ConeGeometry(0.17, 0.38, 3),
      mats.brass,
      0,
      0.19,
      -0.35,
      g,
    );
    arrow.rotation.x = -Math.PI / 2;
    const water = box(0.65, 0.02, 1.65, 0, 0.14, -0.2, mats.water, g);
    water.visible = false;
    const bead = mesh(
      new T.SphereGeometry(0.07, 8, 6),
      mats.water,
      0,
      0.25,
      0.3,
      g,
    );
    bead.visible = false;
    const target = [1, 0, 0][i],
      angle = (target * Math.PI) / 2;
    const drain = mesh(
      new T.TorusGeometry(0.24, 0.045, 6, 16),
      mats.brass,
      x + Math.sin(angle) * 1.45,
      0.18,
      z - Math.cos(angle) * 1.45,
    );
    drain.rotation.x = -Math.PI / 2;
    folds.push({ g, water, bead });
  });
  const connectedWater = [
    box(4, 0.025, 0.62, -2, 0.16, -22, mats.water),
    box(0.62, 0.025, 4, 0, 0.16, -24, mats.water),
    box(0.62, 0.025, 3, 0, 0.16, -27.5, mats.water),
  ];
  connectedWater.forEach((m) => (m.visible = false));
  // Desk and readable envelope focal point.
  const desk = new T.Group();
  root.add(desk);
  desk.position.set(0, 0, -3);
  box(2.4, 0.12, 1.1, 0, 1, 0, mats.wood, desk);
  for (const x of [-1, 1])
    for (const z of [-0.4, 0.4])
      box(0.09, 0.96, 0.09, x, 0.48, z, mats.brass, desk);
  const letter = box(0.55, 0.025, 0.36, 0, 1.08, 0, mats.paper, desk);
  letter.rotation.y = 0.22;
  const oldArches = new T.Group();
  root.add(oldArches);
  for (const x of [-6, 6]) {
    for (const d of [-0.2, 0.2])
      box(0.12, 3.4, 0.14, x + d, 1.7, -6, mats.stone, oldArches);
    const arch = new T.Mesh(
      new T.TorusGeometry(1.1, 0.07, 8, 40, Math.PI),
      mats.stone,
    );
    arch.position.set(x, 3, -6);
    oldArches.add(arch);
  }
  const booth = new T.Group();
  root.add(booth);
  booth.position.set(-2, 0, -0.5);
  box(1.8, 0.1, 0.5, 0, 1.1, 0, mats.wood, booth);
  const memory = box(0.65, 0.6, 0.035, 0, 1.5, 0, mats.paper, booth);
  memory.visible = false;
  const shoreline = new T.Group();
  root.add(shoreline);
  shoreline.position.set(-3, 0.23, -61);
  box(2.2, 0.09, 0.65, 0, 0.55, 0, mats.wood, shoreline);
  for (const x of [-0.8, 0.8])
    box(0.08, 0.6, 0.08, x, 0.25, 0, mats.brass, shoreline);
  const colliders = [
    { x: 0, z: -3, w: 2.4, d: 1.1 },
    { x: -2, z: -0.5, w: 1.8, d: 0.5 },
  ];
  const inCircle = (x, z, cx, cz, r) => Math.hypot(x - cx, z - cz) < r - 0.3;
  const walkable = (x, z, boat) => {
    if (boat)
      return (
        Math.hypot(x + 3, z + 61) > 1.9 &&
        (waterways.some(
          (r) =>
            Math.abs(x - r.x) < r.w / 2 - 0.3 &&
            Math.abs(z - r.z) < r.d / 2 - 0.3,
        ) ||
          inCircle(x, z, 0, -61, 8.5))
      );
    return (
      inCircle(x, z, 0, 0, 9.7) ||
      inCircle(x, z, 0, -22, 7.7) ||
      (Math.abs(x) < 1.35 && z < 0 && z > -22)
    );
  };
  return {
    root,
    hub,
    oldArches,
    mats,
    folds,
    connectedWater,
    memory,
    lamps,
    letter,
    desk,
    waterways,
    walkable,
    colliders,
  };
}
export function makeCourier(scene) {
  const group = new T.Group();
  scene.add(group);
  const cloth = new T.MeshStandardMaterial({
      color: 0xcac5b4,
      roughness: 0.96,
    }),
    dark = new T.MeshStandardMaterial({ color: 0x49586b, roughness: 0.95 }),
    skin = new T.MeshStandardMaterial({ color: 0xd1b29b, roughness: 0.9 }),
    gold = new T.MeshStandardMaterial({ color: 0xb9a17c, roughness: 0.8 });
  const add = (g, m, x, y, z, p = group) => {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    p.add(o);
    return o;
  };
  const body = add(new T.CapsuleGeometry(0.23, 0.43, 5, 12), cloth, 0, 0.86, 0);
  add(new T.SphereGeometry(0.22, 16, 12), skin, 0, 1.4, 0);
  const hat = add(
    new T.SphereGeometry(0.27, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    dark,
    0,
    1.48,
    0,
  );
  add(new T.CylinderGeometry(0.29, 0.29, 0.035, 20), dark, 0, 1.48, 0.02);
  add(new T.SphereGeometry(0.04, 8, 6), gold, 0, 1.56, 0.24);
  const legs = [-1, 1].map((sign) =>
    add(new T.CapsuleGeometry(0.075, 0.3, 4, 8), dark, sign * 0.13, 0.28, 0),
  );
  const arms = [-1, 1].map((sign) =>
    add(new T.CapsuleGeometry(0.065, 0.32, 4, 8), cloth, sign * 0.3, 0.85, 0),
  );
  add(new T.BoxGeometry(0.25, 0.3, 0.12), gold, 0.28, 0.66, -0.04);
  return {
    group,
    arms,
    update(t, speed, boat) {
      legs.forEach((o, i) => {
        o.rotation.x = boat
          ? -0.8
          : Math.sin(t * 8 + i * Math.PI) * Math.min(0.55, speed * 0.19);
      });
      arms.forEach(
        (o, i) =>
          (o.rotation.x = boat
            ? -0.4
            : Math.sin(t * 8 - i * Math.PI) * Math.min(0.4, speed * 0.13)),
      );
      body.position.y =
        0.86 + (speed > 0.05 && !boat ? Math.abs(Math.sin(t * 8)) * 0.025 : 0);
    },
  };
}
const shorePolygon = [
  [-3.5, 0],
  [-4, -1.5],
  [-3.5, -4],
  [-2.2, -5.1],
  [0, -5.4],
  [2.6, -4.4],
  [3.6, -2.4],
  [3.1, -0.5],
  [1.7, 0.1],
  [-0.4, 0.4],
];
export function authoredFootprint(x, z, boat, fallback) {
  if (boat || z <= -15) return fallback(x, z, boat);
  let inside = false;
  for (
    let i = 0, j = shorePolygon.length - 1;
    i < shorePolygon.length;
    j = i++
  ) {
    const a = shorePolygon[i],
      b = shorePolygon[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return (
    inside ||
    (x > -0.2 && x < 1.2 && z >= 0 && z < 7.2) ||
    (Math.abs(x) < 1.3 && z <= -5 && z > -15)
  );
}
export function authoredHeight(x, z) {
  return z >= 0.3 && z < 7.2
    ? 0.15
    : z > -2.7 && z < 0.3 && Math.abs(x - 0.45) < 0.55
      ? 0.05
      : 0;
}
