import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import type { CampusData, CampusRoad, CampusSceneHandle, Landmark, Point2, SceneEvent, SceneState } from '../shared/contracts';

const noopHandle = (): CampusSceneHandle => ({
  setCampus() {}, setState() {}, navigateTo: () => false, resetJourney() {},
  focusLandmark() {}, overview() {}, resetView() {}, dispose() {},
});

function validPoint(p: Point2 | undefined): p is Point2 {
  return !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}
function cleanPolygon(points: Point2[]): Point2[] {
  const result: Point2[] = [];
  for (const p of points || []) {
    if (!validPoint(p)) continue;
    const previous = result[result.length - 1];
    if (!previous || Math.hypot(p[0] - previous[0], p[1] - previous[1]) > 0.001) result.push(p);
  }
  if (result.length > 2 && Math.hypot(result[0][0] - result[result.length - 1][0], result[0][1] - result[result.length - 1][1]) < 0.001) result.pop();
  return result;
}
function makeShape(points: Point2[]): THREE.Shape | null {
  const p = cleanPolygon(points);
  if (p.length < 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(p[0][0], -p[0][1]);
  for (let i = 1; i < p.length; i++) shape.lineTo(p[i][0], -p[i][1]);
  shape.closePath();
  return shape;
}
function inside(x: number, z: number, polygon: Point2[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
function boundsOf(points: Point2[]): [number, number, number, number] {
  const p = points.filter(validPoint);
  if (!p.length) return [-250, -250, 250, 250];
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [x, z] of p) { minX = Math.min(minX, x); minZ = Math.min(minZ, z); maxX = Math.max(maxX, x); maxZ = Math.max(maxZ, z); }
  return [minX, minZ, maxX, maxZ];
}
function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (object instanceof CSS2DObject) object.element.remove();
    const item = object as THREE.Mesh;
    if (item.geometry) geometries.add(item.geometry);
    const list = item.material ? (Array.isArray(item.material) ? item.material : [item.material]) : [];
    for (const material of list) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
  for (const geometry of geometries) geometry.dispose();
  root.removeFromParent();
}
function addSurface(group: THREE.Group, points: Point2[], y: number, material: THREE.Material): THREE.Mesh | null {
  const shape = makeShape(points);
  if (!shape) return null;
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
function perimeter(points: Point2[], y: number, material: THREE.Material): THREE.LineLoop | null {
  const polygon = cleanPolygon(points);
  if (polygon.length < 3) return null;
  const geometry = new THREE.BufferGeometry().setFromPoints(polygon.map(([x, z]) => new THREE.Vector3(x, y, z)));
  return new THREE.LineLoop(geometry, material);
}
export function strips(roads: CampusRoad[], extra: number): THREE.BufferGeometry {
  const vertices: number[] = [];
  for (const road of roads || []) {
    const width = Number.isFinite(road.width) && road.width > 0 ? road.width : 4;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      if (!validPoint(a) || !validPoint(b)) continue;
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 0.01) continue;
      const nx = -dz / length * (width / 2 + extra), nz = dx / length * (width / 2 + extra);
      const y = extra ? 0.075 : 0.09;
      // Counter-clockwise from above, so single-sided roads face the camera.
      vertices.push(a[0] + nx, y, a[1] + nz, b[0] + nx, y, b[1] + nz, a[0] - nx, y, a[1] - nz,
        b[0] + nx, y, b[1] + nz, b[0] - nx, y, b[1] - nz, a[0] - nx, y, a[1] - nz);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createCampusScene(container: HTMLElement, initialData: CampusData, onEvent: (event: SceneEvent) => void): CampusSceneHandle {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    onEvent({ type: 'error', reason: `Unable to initialize the 3D scene: ${error instanceof Error ? error.message : 'WebGL unavailable'}` });
    return noopHandle();
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbac7bc);
  const camera = new THREE.OrthographicCamera(-250, 250, 250, -250, 0.1, 6000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.screenSpacePanning = true;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.minZoom = 0.3;
  controls.maxZoom = 5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  // Campus geometry/light are static; do not redraw a 2048px shadow map each frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.setAttribute('data-testid', 'campus-canvas');
  canvas.setAttribute('aria-label', '米制校园三维场景，可拖拽旋转、滚轮缩放或使用地点目录。建筑占地有数据依据，楼高待核。');
  canvas.setAttribute('role', 'img');
  canvas.tabIndex = 0;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  container.appendChild(canvas);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'landmark-label-layer';
  labels.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(labels.domElement);

  const credit = document.createElement('div');
  credit.style.cssText = 'position:absolute;left:14px;bottom:14px;max-width:min(55%,520px);padding:7px 10px;border-radius:6px;background:rgba(22,39,32,.82);color:#f3f0e5;font:11px/1.4 system-ui,sans-serif;pointer-events:none;z-index:2';
  const previousPosition = container.style.position;
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  credit.style.display = 'none';
  container.appendChild(credit);

  const hemisphere = new THREE.HemisphereLight(0xe2e9df, 0x707969, 1.65);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffd6a5, 2.15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.08;
  scene.add(sun, sun.target);

  let data = initialData;
  let state: SceneState = { selectedId: null, targetId: null };
  let world = new THREE.Group();
  let routeLayer = new THREE.Group();
  let highlightLayer = new THREE.Group();
  scene.add(world, routeLayer, highlightLayer);
  let pawn = new THREE.Group();
  let markerMeshes = new Map<string, THREE.Mesh>();
  let buildingMeshes = new Map<string, THREE.Mesh>();
  let pickables: THREE.Object3D[] = [];
  let markerNormal: THREE.MeshStandardMaterial;
  let markerSelected: THREE.MeshStandardMaterial;
  let markerTarget: THREE.MeshStandardMaterial;
  let lastId = 'start';
  let travel: { id: string; points: Point2[]; cumulative: number[]; length: number; distance: number } | null = null;
  let frameSpan = 500;
  let tween: { fromPosition: THREE.Vector3; toPosition: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; fromSpan: number; toSpan: number; elapsed: number; duration: number } | null = null;
  let disposed = false;
  let raf = 0;
  let previousTime = 0;
  let pointer: { x: number; y: number; id: number; moved: boolean } | null = null;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  function refreshFrustum(): void {
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    const aspect = width / height;
    const viewHeight = frameSpan / Math.min(1, aspect);
    camera.left = -viewHeight * aspect / 2;
    camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
  }
  function resize(): void {
    if (disposed) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight), false);
    labels.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
    refreshFrustum();
  }
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(container);
  window.addEventListener('resize', resize);

  function material(color: THREE.ColorRepresentation, roughness = 0.9): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness });
  }
  function setPawnPosition(point: Point2): void { pawn.position.set(point[0], 0.14, point[1]); }
  function clearRoute(): void {
    disposeObject(routeLayer);
    routeLayer = new THREE.Group();
    scene.add(routeLayer);
  }
  function clearHighlights(): void {
    disposeObject(highlightLayer);
    highlightLayer = new THREE.Group();
    scene.add(highlightLayer);
  }

  function updateHighlights(): void {
    if (disposed) return;
    clearHighlights();
    for (const [id, marker] of markerMeshes) marker.material = id === state.selectedId ? markerSelected : id === state.targetId ? markerTarget : markerNormal;
    const ids = [state.targetId, state.selectedId].filter((id, index, all): id is string => !!id && all.indexOf(id) === index);
    for (const id of ids) {
      const landmark = data.landmarks.find((item) => item.id === id);
      const feature = landmark && data.features.find((item) => item.id === landmark.featureId);
      if (!feature || feature.kind !== 'building') continue;
      const mesh = buildingMeshes.get(feature.id);
      if (!mesh) continue;
      const line = perimeter(feature.polygon, Number(mesh.userData.height) + 0.28, new THREE.LineBasicMaterial({ color: id === state.selectedId ? 0x69e1db : 0xf4c36f, depthTest: true }));
      if (line) highlightLayer.add(line);
    }
  }

  function buildCampus(): void {
    travel = null;
    lastId = 'start';
    tween = null;
    clearRoute();
    clearHighlights();
    disposeObject(world);
    world = new THREE.Group();
    scene.add(world);
    markerMeshes = new Map();
    buildingMeshes = new Map();
    pickables = [];
    credit.textContent = `${data.attribution} · Building heights are tagged, estimated or unverified; road widths are approximate.`;

    const boundary = cleanPolygon(data.boundary || []);
    const allPoints = boundary.length ? boundary : data.features.flatMap((f) => cleanPolygon(f.polygon));
    const [minX, minZ, maxX, maxZ] = boundsOf(allPoints);
    const centerX = (minX + maxX) / 2, centerZ = (minZ + maxZ) / 2;
    const extent = Math.max(maxX - minX, maxZ - minZ, 500);
    const landscape = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX + 800, maxZ - minZ + 800), material(0x9aa995));
    landscape.rotation.x = -Math.PI / 2;
    landscape.position.set(centerX, -0.12, centerZ);
    landscape.receiveShadow = true;
    world.add(landscape);
    addSurface(world, boundary, -0.025, material(0xb5c0aa));
    const curb = perimeter(boundary, 0.015, new THREE.LineBasicMaterial({ color: 0x8b9684 }));
    if (curb) world.add(curb);
    sun.position.set(centerX - extent * 0.7, extent * 1.15, centerZ + extent * 0.55);
    sun.target.position.set(centerX, 0, centerZ);
    const shadowCamera = sun.shadow.camera;
    const shadowExtent = extent * 0.95 + 100;
    shadowCamera.left = -shadowExtent; shadowCamera.right = shadowExtent;
    shadowCamera.top = shadowExtent; shadowCamera.bottom = -shadowExtent;
    shadowCamera.near = 1; shadowCamera.far = extent * 3.5 + 500;
    shadowCamera.updateProjectionMatrix();

    const roadEdge = new THREE.Mesh(strips(data.roads, 1.15), material(0xc3c1b2));
    const roads = new THREE.Mesh(strips(data.roads, 0), material(0x777e79));
    roadEdge.receiveShadow = roads.receiveShadow = true;
    world.add(roadEdge, roads);

    // Designed game paths, not actual mapped roads.
    const gamePaths = data.questOrder.flatMap((id, i) => {
      const points = data.routes[`${i ? data.questOrder[i - 1] : 'start'}>${id}`];
      return points && points.length >= 2 && points.every(validPoint)
        ? [{ id: `game-${i}-${id}`, points, width: 2.4, source: 'Designed game path, not a mapped road' }] : [];
    });
    const paths = new THREE.Mesh(strips(gamePaths, 0), material(0xd5d0bf));
    paths.position.y = 0.02; // Keep the paths above existing road surfaces.
    paths.receiveShadow = true;
    world.add(paths);

    const parkMat = material(0x879f82);
    const trackMat = material(0xb5795f);
    const fieldMat = material(0x829d77);
    const facadeMats = [material(0xd4cbb8), material(0xb6b8aa), material(0xb59580), material(0xc3bba9)];
    const roofMat = material(0xa5a89d);
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x647f82, roughness: 0.38, metalness: 0.12 });
    const buildings = data.features.filter((f) => f.kind === 'building' && cleanPolygon(f.polygon).length >= 3);
    const windowTransforms: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();

    for (const feature of data.features) {
      const polygon = cleanPolygon(feature.polygon || []);
      if (polygon.length < 3) continue;
      if (feature.kind === 'park') {
        addSurface(world, polygon, 0.025, parkMat);
      } else if (feature.kind === 'sports') {
        addSurface(world, polygon, 0.035, trackMat);
        const [x0, z0, x1, z1] = boundsOf(polygon);
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const inner = polygon.map(([x, z]): Point2 => [cx + (x - cx) * 0.73, cz + (z - cz) * 0.73]);
        const fits = inner.every((p, i) => {
          const q = inner[(i + 1) % inner.length];
          return inside(p[0], p[1], polygon) && inside((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, polygon);
        });
        if (fits) {
          addSurface(world, inner, 0.047, fieldMat);
          const marking = perimeter(inner, 0.055, new THREE.LineBasicMaterial({ color: 0xd3c3a4 }));
          if (marking) world.add(marking);
        }
      } else {
        const shape = makeShape(polygon);
        if (!shape) continue;
        const height = Number.isFinite(feature.height) && feature.height > 0 ? feature.height : Math.max  (3, (feature.levels || 2) * 3.3);
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
        geometry.rotateX(-Math.PI / 2);
        let hash = 0;
        for (const ch of feature.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
        const building = new THREE.Mesh(geometry, [roofMat, facadeMats[hash % facadeMats.length]]);
        building.castShadow = true;
        building.receiveShadow = true;
        building.userData.height = height;
        const linked = data.landmarks.find((item) => item.featureId === feature.id);
        if (linked) { building.userData.landmarkId = linked.id; pickables.push(building); }
        world.add(building);
        buildingMeshes.set(feature.id, building);
        const parapet = perimeter(polygon, height + 0.12, new THREE.LineBasicMaterial({ color: 0x777e77 }));
        if (parapet) world.add(parapet);
        let area = 0;
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i], b = polygon[(i + 1) % polygon.length];
          area += a[0] * b[1] - b[0] * a[1];
        }
        const floors = Math.min(30, Math.max(1, feature.levels && feature.levels > 0 ? Math.round(feature.levels) : Math.floor(height / 3.4)));
        const floorHeight = height / floors;
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i], b = polygon[(i + 1) % polygon.length];
          const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
          if (len < 3 || height < 2.5) continue;
          const count = Math.min(100, Math.floor(len / 4.5));
          const sign = area >= 0 ? 1 : -1;
          const nx = sign * dz / len, nz = -sign * dx / len;
          for (let floor = 0; floor < floors; floor++) for (let j = 0; j < count; j++) {
            const t = (j + 0.5) / count;
            dummy.position.set(a[0] + dx * t + nx * 0.04, (floor + 0.5) * floorHeight, a[1] + dz * t + nz * 0.04);
            dummy.rotation.set(0, Math.atan2(-dz, dx), 0);
            dummy.scale.set(Math.min(2.6, len / count * 0.67), Math.min(2.0, floorHeight * 0.55), 0.12);
            dummy.updateMatrix();
            windowTransforms.push(dummy.matrix.clone());
          }
        }
      }
    }
    if (windowTransforms.length) {
      const windows = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), windowMat, windowTransforms.length);
      windowTransforms.forEach((matrix, i) => windows.setMatrixAt(i, matrix));
      windows.instanceMatrix.needsUpdate = true;
      windows.receiveShadow = true;
      world.add(windows);
    } else windowMat.dispose();

    // A deterministic clustered planting pattern, always checked against the park and buildings.
    const treePositions: Point2[] = [];
    const isClear = (x: number, z: number, park: Point2[], radius: number): boolean => {
      const samples: Point2[] = [[x, z], [x + radius, z], [x - radius, z], [x, z + radius], [x, z - radius]];
      return samples.every(([sx, sz]) => inside(sx, sz, park) && !buildings.some((f) => inside(sx, sz, f.polygon)));
    };
    for (const feature of data.features.filter((f) => f.kind === 'park')) {
      const polygon = cleanPolygon(feature.polygon || []);
      if (polygon.length < 3) continue;
      const [x0, z0, x1, z1] = boundsOf(polygon);
      const pathVertices: number[] = [];
      const midZ = (z0 + z1) / 2;
      for (let x = x0; x + 5 <= x1; x += 5) {
        if (isClear(x, midZ, polygon, 0.7) && isClear(x + 2.5, midZ, polygon, 0.7) && isClear(x + 5, midZ, polygon, 0.7)) pathVertices.push(x, 0.065, midZ, x + 5, 0.065, midZ);
      }
      if (pathVertices.length) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(pathVertices, 3));
        world.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xc4c3a9 })));
      }
      for (let z = z0 + 12; z < z1 && treePositions.length < 240; z += 30) {
        for (let x = x0 + 12; x < x1 && treePositions.length < 240; x += 30) {
          const offsets: Point2[] = [[0, 0], [5, 3], [-4, 6], [3, -5]];
          for (const [ox, oz] of offsets) {
            const tx = x + ox, tz = z + oz;
            if (Math.abs(tz - midZ) > 3 && isClear(tx, tz, polygon, 2.6)) treePositions.push([tx, tz]);
          }
        }
      }
    }
    if (treePositions.length) {
      const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.45, 3.8, 6), material(0x79765e), treePositions.length);
      const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), material(0x718d70), treePositions.length);
      treePositions.forEach(([x, z], i) => {
        dummy.position.set(x, 1.9, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x, 4.6 + (i % 3) * 0.22, z); dummy.scale.set(2.1 + (i % 3) * 0.15, 2.4, 2.0 + (i % 2) * 0.25); dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
      });
      trunks.instanceMatrix.needsUpdate = crowns.instanceMatrix.needsUpdate = true;
      trunks.castShadow = crowns.castShadow = true;
      world.add(trunks, crowns);
    }

    markerNormal = material(0xe7e0c9, 0.45);
    markerSelected = material(0x66d9d3, 0.4);
    markerTarget = material(0xe9b766, 0.4);
    const markerGeometry = new THREE.OctahedronGeometry(2.2, 0);
    for (const landmark of data.landmarks) {
      if (!validPoint(landmark.position)) continue;
      const marker = new THREE.Mesh(markerGeometry, markerNormal);
      const feature = data.features.find((f) => f.id === landmark.featureId && f.kind === 'building');
      const building = feature ? buildingMeshes.get(feature.id) : undefined;
      marker.position.set(landmark.position[0], building ? Number(building.userData.height) + 4 : 4, landmark.position[1]);
      marker.userData.landmarkId = landmark.id;
      marker.castShadow = true;
      markerMeshes.set(landmark.id, marker);
      pickables.push(marker);
      world.add(marker);
      const name = document.createElement('div');
      name.className = 'landmark-label';
      name.textContent = `${String(data.questOrder.indexOf(landmark.id) + 1).padStart(2, '0')}  ${landmark.name}`;
      const label = new CSS2DObject(name);
      label.position.set(0, 5, 0);
      label.center.set(0.5, 1);
      marker.add(label);
    }
    if (!markerMeshes.size) { markerGeometry.dispose(); markerNormal.dispose(); markerSelected.dispose(); markerTarget.dispose(); }
    // Materials not currently assigned to a marker are still owned by the world.
    else {
      const owner = new THREE.Mesh(new THREE.BufferGeometry(), [markerNormal, markerSelected, markerTarget]);
      owner.visible = false;
      world.add(owner);
    }

    pawn = new THREE.Group();
    const bodyMat = material(0x365f5b), headMat = material(0xe8c9a7), packMat = material(0xcb9963);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.6, 1.45, 8), bodyMat);
    body.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.43, 10, 8), headMat);
    head.position.y = 2.2;
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.35), packMat);
    backpack.position.set(0, 1.22, 0.48);
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.25, 24), new THREE.MeshBasicMaterial({ color: 0x69dcd3, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.06;
    body.castShadow = head.castShadow = backpack.castShadow = false;
    pawn.add(body, head, backpack, halo);
    setPawnPosition(validPoint(data.start) ? data.start : [centerX, centerZ]);
    world.add(pawn);
    renderer.shadowMap.needsUpdate = true;
    updateHighlights();
  }

  function animateView(target: THREE.Vector3, span: number, initial = false): void {
    if (disposed) return;
    const direction = initial ? new THREE.Vector3(0.7, 1, data.id === 'huyu' ? -1.1 : 1.1).normalize() : camera.position.clone().sub(controls.target).normalize();
    if (direction.lengthSq() < 0.01) direction.set(0.7, 1, 1.1).normalize();
    const distance = Math.max(span * 1.5, 200);
    const position = target.clone().addScaledVector(direction, distance);
    frameSpan /= camera.zoom;
    camera.zoom = 1;
    if (initial || reducedMotion) {
      tween = null; frameSpan = span; camera.position.copy(position); controls.target.copy(target); refreshFrustum(); controls.update();
    } else {
      tween = { fromPosition: camera.position.clone(), toPosition: position, fromTarget: controls.target.clone(), toTarget: target.clone(), fromSpan: frameSpan, toSpan: span, elapsed: 0, duration: 0.8 };
    }
  }
  function questView(initial = false): void {
    const ordered = data.questOrder.map((id) => data.landmarks.find((l) => l.id === id)).filter((l): l is Landmark => !!l);
    const landmarks = ordered.length ? ordered : data.landmarks;
    const points = landmarks.flatMap((l) => [l.position, l.arrival]).filter(validPoint);
    if (!points.length && validPoint(data.start)) points.push(data.start);
    const [x0, z0, x1, z1] = boundsOf(points);
    animateView(new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), Math.max(300, (x1 - x0) * 1.35, (z1 - z0) * 1.35), initial);
  }
  function overview(): void {
    const points = cleanPolygon(data.boundary || []);
    const [x0, z0, x1, z1] = boundsOf(points.length ? points : data.features.flatMap((f) => f.polygon));
    animateView(new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), Math.max(500, (x1 - x0) * 1.2, (z1 - z0) * 1.2));
  }
  function focusLandmark(id: string): void {
    const landmark = data.landmarks.find((item) => item.id === id);
    if (!landmark || !validPoint(landmark.position)) return;
    const feature = data.features.find((f) => f.id === landmark.featureId);
    const [x0, z0, x1, z1] = feature ? boundsOf(feature.polygon) : [0, 0, 0, 0];
    const span = Math.max(180, (x1 - x0) * 2.5, (z1 - z0) * 2.5);
    animateView(new THREE.Vector3(landmark.position[0], 0, landmark.position[1]), span);
  }
  function drawRoute(points: Point2[]): void {
    clearRoute();
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, z]) => new THREE.Vector3(x, 0.24, z)));
    const line = new THREE.Line(lineGeometry, new THREE.LineDashedMaterial({ color: 0xeeb760, dashSize: 5, gapSize: 3, transparent: true, opacity: 0.95, depthWrite: false }));
    line.computeLineDistances();
    routeLayer.add(line);
    const geometry = new THREE.SphereGeometry(0.85, 8, 6);
    const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xf4cb7a });
    const stride = Math.max(1, Math.ceil(points.length / 24));
    for (let i = stride; i < points.length; i += stride) {
      const beacon = new THREE.Mesh(geometry, beaconMaterial);
      beacon.position.set(points[i][0], 0.8, points[i][1]);
      routeLayer.add(beacon);
    }
    if (routeLayer.children.length === 1) { geometry.dispose(); beaconMaterial.dispose(); }
  }
  function navigateTo(id: string): boolean {
    if (disposed || travel) return false;
    const landmark = data.landmarks.find((item) => item.id === id);
    const raw = data.routes[`${lastId}>${id}`];
    if (!landmark || !validPoint(landmark.arrival) || !raw || raw.length < 2 || !raw.every(validPoint)) return false;
    const points = raw.map((p): Point2 => [p[0], p[1]]);
    // A route must begin at the current position; never silently jump to it.
    if (Math.hypot(points[0][0] - pawn.position.x, points[0][1] - pawn.position.z) > 0.001) return false;
    const end = points[points.length - 1];
    if (Math.hypot(end[0] - landmark.arrival[0], end[1] - landmark.arrival[1]) > 0.001) return false;
    const cumulative = [0];
    for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    const length = cumulative[cumulative.length - 1];
    if (length < 0.001) return false;
    travel = { id, points, cumulative, length, distance: 0 };
    drawRoute(points);
    const viewPoints = [...points, landmark.position, landmark.arrival].filter(validPoint);
    const [x0, z0, x1, z1] = boundsOf(viewPoints);
    animateView(new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), Math.max(120, (x1 - x0) * 1.35, (z1 - z0) * 1.35));
    onEvent({ type: 'travel', progress: 0 });
    return true;
  }
  function resetJourney(): void {
    if (disposed) return;
    travel = null; lastId = 'start'; clearRoute();
    if (validPoint(data.start)) setPawnPosition(data.start);
    pawn.rotation.y = 0;
  }
  function tick(time: number): void {
    if (disposed) return;
    const dt = previousTime ? Math.min(1, Math.max(0, (time - previousTime) / 1000)) : 0;
    previousTime = time;
    if (tween) {
      tween.elapsed += dt;
      const t = Math.min(1, tween.elapsed / tween.duration), eased = t * t * (3 - 2 * t);
      camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      frameSpan = THREE.MathUtils.lerp(tween.fromSpan, tween.toSpan, eased);
      refreshFrustum();
      if (t >= 1) tween = null;
    }
    if (travel) {
      const current = travel;
      current.distance = Math.min(current.length, current.distance + dt * Math.min(12, current.length / 3));
      let i = 1;
      while (i < current.cumulative.length - 1 && current.cumulative[i] < current.distance) i++;
      const a = current.points[i - 1], b = current.points[i];
      const segmentLength = current.cumulative[i] - current.cumulative[i - 1];
      const t = segmentLength > 0 ? (current.distance - current.cumulative[i - 1]) / segmentLength : 1;
      pawn.position.set(THREE.MathUtils.lerp(a[0], b[0], t), 0.14 + (reducedMotion ? 0 : Math.abs(Math.sin(current.distance * 0.45)) * 0.15), THREE.MathUtils.lerp(a[1], b[1], t));
      if (segmentLength > 0) pawn.rotation.y = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));
      onEvent({ type: 'travel', progress: current.distance / current.length });
      if (disposed) return;
      if (travel === current && current.distance >= current.length) {
        setPawnPosition(current.points[current.points.length - 1]);
        travel = null; lastId = current.id; clearRoute();
        onEvent({ type: 'arrive', id: current.id });
        if (disposed) return;
      }
    }
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  function interruptView(): void { tween = null; }
  controls.addEventListener('start', interruptView);
  function resetFrameClock(): void { previousTime = 0; }
  document.addEventListener('visibilitychange', resetFrameClock);
  function pointerDown(event: PointerEvent): void {
    if (pointer && event.pointerId !== pointer.id) { pointer.moved = true; return; }
    if (event.button !== 0 || pointer) return;
    pointer = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false };
  }
  function pointerMove(event: PointerEvent): void {
    if (pointer && pointer.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) pointer.moved = true;
  }
  function pointerCancel(event: PointerEvent): void { if (pointer?.id === event.pointerId) pointer = null; }
  function pointerUp(event: PointerEvent): void {
    if (!pointer || pointer.id !== event.pointerId) return;
    const click = !pointer.moved && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) <= 6;
    pointer = null;
    if (!click || disposed) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointerNdc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObjects(pickables, false).find((item) => typeof item.object.userData.landmarkId === 'string');
    if (hit) onEvent({ type: 'select', id: hit.object.userData.landmarkId as string });
  }
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerCancel);

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    travel = null; tween = null; pointer = null;
    resizeObserver?.disconnect();
    window.removeEventListener('resize', resize);
    controls.removeEventListener('start', interruptView);
    document.removeEventListener('visibilitychange', resetFrameClock);
    controls.dispose();
    canvas.removeEventListener('pointerdown', pointerDown);
    canvas.removeEventListener('pointermove', pointerMove);
    canvas.removeEventListener('pointerup', pointerUp);
    canvas.removeEventListener('pointercancel', pointerCancel);
    canvas.removeEventListener('webglcontextlost', contextLost);
    disposeObject(routeLayer); disposeObject(highlightLayer); disposeObject(world);
    sun.shadow.dispose();
    renderer.dispose();
    labels.domElement.remove();
    canvas.remove(); credit.remove();
    if (container.style.position === 'relative' && previousPosition !== 'relative') container.style.position = previousPosition;
  }
  function contextLost(event: Event): void {
    event.preventDefault();
    dispose();
    onEvent({ type: 'error', reason: 'The WebGL context was lost. The 3D scene is unavailable.' });
  }
  canvas.addEventListener('webglcontextlost', contextLost);

  try {
    buildCampus();
    resize();
    questView(true);
    raf = requestAnimationFrame(tick);
  } catch (error) {
    dispose();
    onEvent({ type: 'error', reason: `Unable to build the 3D scene: ${error instanceof Error ? error.message : 'unknown error'}` });
    return noopHandle();
  }

  return {
    setCampus(next) {
      if (disposed) return;
      try { data = next; state = { selectedId: null, targetId: null }; buildCampus(); questView(true); }
      catch (error) { dispose(); onEvent({ type: 'error', reason: `Unable to build the 3D scene: ${error instanceof Error ? error.message : 'unknown error'}` }); }
    },
    setState(next) { if (!disposed) { state = { selectedId: next.selectedId, targetId: next.targetId }; updateHighlights(); } },
    navigateTo,
    resetJourney,
    focusLandmark,
    overview,
    resetView() { if (!disposed) questView(); },
    dispose,
  };
}
