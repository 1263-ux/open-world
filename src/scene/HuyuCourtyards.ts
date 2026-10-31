import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Interpretive planting and furniture, not surveyed campus features.
 * All solid props are admitted by the caller's route/footprint test and have
 * matching collision meshes before the player's collision tree is baked. */
export function createHuyuCourtyards(
  isClear: (x: number, z: number, radius: number) => boolean,
): { visual: THREE.Group; colliders: THREE.Group } {
  const world = new THREE.Group();
  const colliders = new THREE.Group();
  const beds: [number, number][] = [
    [0, -182], [29, -182], [-91, -12], [-60, -12], [57, -53], [79, -53],
  ];
  const benches: [number, number, number][] = [
    [1, -177, 0], [28, -177, 0], [-90, -6, 0], [-60, -6, 0], [57, -40, 0], [79, -40, 0],
  ];
  const foliage = new THREE.MeshStandardMaterial({ color: 0x829d79, roughness: 1 });
  const flower = new THREE.MeshStandardMaterial({ color: 0xd9c8bc, roughness: 1 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xd9d2c0, roughness: 1 });
  const soil = new THREE.MeshStandardMaterial({ color: 0x786e5b, roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x956e49, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x405e57, roughness: 1 });
  const proxyMaterial = new THREE.MeshBasicMaterial();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mound = new THREE.SphereGeometry(1, 8, 6);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const batch = (mesh: THREE.Mesh): void => {
    mesh.updateMatrix();
    const geometries = batches.get(mesh.material as THREE.Material) ?? [];
    geometries.push(mesh.geometry.clone().applyMatrix4(mesh.matrix));
    batches.set(mesh.material as THREE.Material, geometries);
  };
  const addBox = (parent: THREE.Group, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, angle = 0): void => {
    const m = new THREE.Mesh(parent === colliders ? new THREE.BoxGeometry(1, 1, 1) : box, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = angle;
    m.castShadow = m.receiveShadow = true; if (parent === colliders) parent.add(m); else batch(m);
  };
  // Ankle-height beds and groundcover are intentionally traversable, like
  // the existing low planters. Clearance still keeps them off routes/buildings.
  for (const [x, z] of beds) {
    if (!isClear(x, z, 2.1)) continue;
    addBox(world, stone, x, .11, z, 3.5, .18, 1.45);
    addBox(world, soil, x, .22, z, 3.2, .04, 1.2);
    for (let i = 0; i < 9; i++) {
      const plant = new THREE.Mesh(mound, i % 4 === 0 ? flower : foliage);
      plant.position.set(x - 1.25 + (i % 5) * .62, i % 4 === 0 ? .38 : .33, z + (i < 5 ? -.25 : .25));
      plant.scale.set(i % 4 === 0 ? .16 : .31, i % 4 === 0 ? .11 : .17, i % 4 === 0 ? .16 : .29);
      plant.castShadow = true; batch(plant);
    }
  }
  for (const [x, z, angle] of benches) {
    if (!isClear(x, z, 1.8)) continue;
    const place = (mat: THREE.Material, lx: number, y: number, lz: number, sx: number, sy: number, sz: number): void => {
      addBox(world, mat, x + lx * Math.cos(angle) + lz * Math.sin(angle), y, z - lx * Math.sin(angle) + lz * Math.cos(angle), sx, sy, sz, angle);
    };
    // Reuses the project's established warm wood / teal metal bench language.
    for (let i = 0; i < 3; i++) place(wood, 0, .51, -.18 + i * .18, 1.9, .08, .14);
    for (let i = 0; i < 2; i++) place(wood, 0, .76 + i * .17, -.27, 1.9, .13, .08);
    place(metal, -.7, .25, 0, .12, .5, .48); place(metal, .7, .25, 0, .12, .5, .48);
    addBox(colliders, proxyMaterial, x, .49, z, 1.9, .98, .58, angle);
  }
  for (const [mat, geometries] of batches) {
    const merged = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    if (merged) { const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = mesh.receiveShadow = true; world.add(mesh); }
  }
  for (const mat of [foliage, flower, stone, soil, wood, metal]) if (!batches.has(mat)) mat.dispose();
  if (!colliders.children.length) proxyMaterial.dispose();
  box.dispose(); mound.dispose();
  return { visual: world, colliders };
}
