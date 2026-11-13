import * as T from "../game/vendor/three.module.js";
// Exact procedural paper boat/bowl/fish geometry copied from stable main at experiment creation.
export function makeBoat(scene,paper){const world={mats:{paper}};
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
const bowlAssembly=new T.Group();bowlAssembly.name='Companion_bowl_and_support';boat.add(bowlAssembly);
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
bowlAssembly.add(bowl);
const rim = new T.Mesh(
  new T.TorusGeometry(0.18, 0.012, 6, 24),
  world.mats.paper,
);
rim.rotation.x = Math.PI / 2;
rim.position.set(0.35, 0.64, -0.5);
bowlAssembly.add(rim);
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
bowlAssembly.add(bowlWater);
const bowlTray = new T.Mesh(
  new T.CylinderGeometry(0.16, 0.18, 0.045, 20),
  world.mats.paper,
);
bowlTray.position.set(0.35, 0.18, -0.5);
bowlAssembly.add(bowlTray);
for (let i = 0; i < 3; i++) {
  const a = (i * Math.PI * 2) / 3;
  const fold = new T.Mesh(
    new T.BoxGeometry(0.035, 0.16, 0.1),
    world.mats.paper,
  );
  fold.position.set(0.35 + Math.cos(a) * 0.11, 0.08, -0.5 + Math.sin(a) * 0.11);
  fold.rotation.y = -a;
  fold.castShadow = fold.receiveShadow = true;
  bowlAssembly.add(fold);
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

return {boat,fish,fishTail,bowl,bowlAssembly};}
