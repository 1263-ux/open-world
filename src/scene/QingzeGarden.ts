import * as THREE from 'three';
import layout from './qingze-garden-layout.json' with { type: 'json' };

/** Interpretive garden placement, not a surveyed reconstruction. */
export const QINGZE_CENTER = [35, 205] as const;
export const QINGZE_DECORATION_BOUNDS = { minX: 23.6, maxX: 45.8, minZ: 185.8, maxZ: 217.9 };

/** Create a visible simple fallback and matching solid proxies immediately.
 * Each footprint comes from the authored asset's design metadata, not a map.
 * The fallback stays until the detailed GLB succeeds, so failure never leaves
 * colliders without corresponding visible objects. */
export function createQingzeFallback(): { visual: THREE.Group; colliders: THREE.Group } {
  const visual = new THREE.Group(), colliders = new THREE.Group();
  visual.name = 'qingze-designed-fallback';
  visual.userData.landmarkId = 'yx-garden-setting';
  const stone = new THREE.MeshStandardMaterial({ color: 0xc9c6b5, roughness: 1 });
  const planting = new THREE.MeshStandardMaterial({ color: 0x728e68, roughness: 1 });
  const bark = new THREE.MeshStandardMaterial({ color: 0x766d59, roughness: 1 });
  const leaves = new THREE.MeshStandardMaterial({ color: 0x79946c, roughness: 1 });
  const proxyMaterial = new THREE.MeshBasicMaterial();
  const court = new THREE.Mesh(new THREE.CircleGeometry(8.2, 48), stone);
  court.rotation.x = -Math.PI / 2; court.position.set(35, .05, 205); court.receiveShadow = true; visual.add(court);
  const path = new THREE.Mesh(new THREE.BoxGeometry(3.4, .05, 8.8), stone);
  path.position.set(35, .025, 192.8); path.receiveShadow = true; visual.add(path);
  for (const item of layout.solidColliders) {
    const shape = new THREE.Shape();
    shape.moveTo(item.polygon[0][0], -item.polygon[0][1]);
    for (const point of item.polygon.slice(1)) shape.lineTo(point[0], -point[1]);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: item.height, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, item.kind === 'tree-trunk' ? bark : stone);
    mesh.name = item.id; mesh.castShadow = mesh.receiveShadow = true; visual.add(mesh);
    const proxy = new THREE.Mesh(geometry.clone(), proxyMaterial);
    proxy.name = item.id; colliders.add(proxy);
    if (item.kind === 'tree-trunk') {
      const x = item.polygon.reduce((sum, point) => sum + point[0], 0) / item.polygon.length;
      const z = item.polygon.reduce((sum, point) => sum + point[1], 0) / item.polygon.length;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), leaves);
      crown.position.set(x, item.height + .8, z); crown.scale.set(1.35, 1.5, 1.35); crown.castShadow = true; visual.add(crown);
    }
  }
  const plants = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .12, 12), planting);
  plants.position.set(35.85, .44, 205.4); plants.scale.set(2.30, 1, 1.0); visual.add(plants);
  return { visual, colliders };
}
