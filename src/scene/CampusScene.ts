import * as THREE from 'three';
import { landmarkModels, loadLandmarkModel } from './LandmarkModels';
import { PlayerController } from './PlayerController';
import { createQingzeFallback, QINGZE_DECORATION_BOUNDS } from './QingzeGarden';
import { createFoliageGeometry, createSurfaceMaterial } from './SurfaceStyle';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import type { CampusData, CampusRoad, CampusSceneHandle, Landmark, PhotoInspection, PhotoPoint, Point2, SceneEvent, SceneState } from '../shared/contracts';

const noopHandle = (): CampusSceneHandle => ({
  setCampus() {}, setState() {}, navigateTo: () => false, resetJourney() {},
  focusLandmark() {}, overview() {}, resetView() {}, pause() {}, resume() {}, dispose() {},
  inspectPhoto: () => ({ inRange: false, framed: false, obstructed: false, distance: Infinity }), capturePhoto: () => null,
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
export function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (object instanceof CSS2DObject) object.element.remove();
    if (object instanceof THREE.InstancedMesh) object.dispose();
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
  const uv: number[] = [];
  for (let i = 0; i < vertices.length; i += 3) uv.push(vertices[i], -vertices[i + 2]);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** Original human-scale streetscape along the designed Mechanical Hall–Qingze guide.
 * These furnishings are interpretive, not a survey of real street furniture. */
function addCorridor(world: THREE.Group, colliders: THREE.Group): void {
  const stone = new THREE.MeshStandardMaterial({ color: 0xd2c8b2, roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x9d6a49, roughness: .9 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x4f5b50, roughness: .8 });
  const light = new THREE.MeshStandardMaterial({ color: 0xf6e2b4, emissive: 0x5b492b });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, physical = false) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; world.add(mesh);
    if (physical) { const copy = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial()); copy.position.copy(mesh.position); colliders.add(copy); }
  };
  // Collision proxies match the three visible, estimated entrance steps of the detailed model.
  // They are deliberately separate from the original source footprint; no interior is claimed.
  for (const [x0, x1, z0, z1, y0, y1] of [
    [-53.16, -51.70, 173.30, 178.00, 0, .12],
    [-53.16, -52.12, 173.38, 177.92, .12, .24],
    [-53.16, -52.50, 173.47, 177.83, .24, .36],
  ]) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), new THREE.MeshBasicMaterial());
    step.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    colliders.add(step);
  }
  // Low kerbs and warm paving frame the existing guide without claiming mapped detail.
  add(new THREE.BoxGeometry(72, .12, 2.5), stone, -26.56, .06, 157.7, true);
  add(new THREE.BoxGeometry(72, .12, 2.5), stone, -26.56, .06, 163.8, true);
  for (const x of [-54, -30, -6, 15]) {
    const z = x === 15 ? 169.5 : 165.8;
    add(new THREE.BoxGeometry(1.8, .13, .55), wood, x, .48, z, true);
    add(new THREE.BoxGeometry(1.8, .55, .12), wood, x, .85, z - .22, true);
    for (const dx of [-.65, .65]) add(new THREE.BoxGeometry(.1, .45, .42), iron, x + dx, .23, z);
  }
  for (const x of [-59, -41, -23, -5, 13]) {
    add(new THREE.CylinderGeometry(.055, .09, 3.5, 8), iron, x, 1.75, 155.5, true);
    add(new THREE.SphereGeometry(.2, 10, 8), light, x, 3.48, 155.5);
  }
  const bark = new THREE.MeshStandardMaterial({ color: 0x746c55, roughness: 1 });
  const leaves = new THREE.MeshStandardMaterial({ color: 0x829c77, roughness: 1, vertexColors: true });
  const treeSites: Point2[] = [[-48, 151], [-24, 151], [0, 151], [-43, 170], [-19, 170], [5, 170]];
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.22, .3, 3.4, 8), bark, treeSites.length);
  const canopies = new THREE.InstancedMesh(createFoliageGeometry(), leaves, treeSites.length);
  const treeTransform = new THREE.Object3D();
  treeSites.forEach(([x, z], i) => {
    treeTransform.position.set(x, 1.7, z); treeTransform.scale.set(1, 1, 1); treeTransform.updateMatrix(); trunks.setMatrixAt(i, treeTransform.matrix);
    treeTransform.position.set(x, 4.2 + (i % 3) * .18, z); treeTransform.scale.set(2.1, 2.4, 2.1); treeTransform.updateMatrix(); canopies.setMatrixAt(i, treeTransform.matrix);
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 3.4, 8), new THREE.MeshBasicMaterial());
    proxy.position.set(x, 1.7, z); colliders.add(proxy);
  });
  trunks.instanceMatrix.needsUpdate = canopies.instanceMatrix.needsUpdate = true;
  trunks.castShadow = canopies.castShadow = true; world.add(trunks, canopies);
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
  scene.background = new THREE.Color(0xb7d5de);
  const distanceFog = new THREE.Fog(0xb7d5de, 380, 1300);
  scene.fog = distanceFog;
  const camera = new THREE.OrthographicCamera(-250, 250, 250, -250, 0.1, 6000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.screenSpacePanning = true;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.minZoom = 0.3;
  controls.maxZoom = 5;
  let renderRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  let slowFrames = 0, fastFrames = 0;
  renderer.setPixelRatio(renderRatio);
  renderer.shadowMap.enabled = true;
  // Campus geometry/light are static; do not redraw a 2048px shadow map each frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.setAttribute('data-testid', 'campus-canvas');
  canvas.setAttribute('aria-label', '第三人称校园场景。WASD 移动，拖动鼠标转向，Shift 跑步，空格跳跃；触屏左侧移动、右侧转动视角。建筑占地有数据依据，楼高待核。');
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
  const player = new PlayerController(container, canvas);
  let mapMode = false;
  controls.enabled = false;

  const credit = document.createElement('div');
  credit.style.cssText = 'position:absolute;left:14px;bottom:14px;max-width:min(55%,520px);padding:7px 10px;border-radius:6px;background:rgba(22,39,32,.82);color:#f3f0e5;font:11px/1.4 system-ui,sans-serif;pointer-events:none;z-index:2';
  const previousPosition = container.style.position;
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  credit.style.display = 'none';
  container.appendChild(credit);

  const hemisphere = new THREE.HemisphereLight(0xe2e9df, 0x707969, 1.65);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffead4, 2.15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.08;
  scene.add(sun, sun.target);

  let data = initialData;
  let campusGeneration = 0;
  let state: SceneState = { selectedId: null, targetId: null };
  let world = new THREE.Group();
  let routeLayer = new THREE.Group();
  let highlightLayer = new THREE.Group();
  scene.add(world, routeLayer, highlightLayer);
  const pawn = player.avatar;
  let markerMeshes = new Map<string, THREE.Mesh>();
  let buildingMeshes = new Map<string, THREE.Mesh>();
  let pickables: THREE.Object3D[] = [];
  let markerNormal: THREE.MeshStandardMaterial;
  let markerSelected: THREE.MeshStandardMaterial;
  let markerTarget: THREE.MeshStandardMaterial;
  let travel: { id: string; initialDistance: number; arrival: Point2; waypoints: Point2[] } | null = null;
  let frameSpan = 500;
  let mapShadow = { x: 0, z: 0, extent: 600 };
  let playerShadowX = Infinity, playerShadowZ = Infinity;
  let tween: { fromPosition: THREE.Vector3; toPosition: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; fromSpan: number; toSpan: number; elapsed: number; duration: number } | null = null;
  let disposed = false;
  let paused = false;
  let frameCount = 0;
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
    renderRatio = Math.min(renderRatio, window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(renderRatio);
    renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight), false);
    labels.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
    refreshFrustum();
    player.resize(container.clientWidth, container.clientHeight);
  }
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(container);
  window.addEventListener('resize', resize);

  function material(color: THREE.ColorRepresentation, roughness = 0.9): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness });
  }
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
      const ids = landmark ? [...(landmark.featureIds ?? []), ...(landmark.featureId ? [landmark.featureId] : [])] : [];
      for (const featureId of ids) {
        const feature = data.features.find((item) => item.id === featureId && item.kind === 'building');
        const mesh = buildingMeshes.get(featureId);
        if (!feature || !mesh) continue;
        const line = perimeter(feature.polygon, mesh.visible ? Number(mesh.userData.height) + 0.28 : 0.3, new THREE.LineBasicMaterial({ color: id === state.selectedId ? 0x69e1db : 0xf4c36f, depthTest: true }));
        if (line) highlightLayer.add(line);
      }
    }
  }

  function buildCampus(): void {
    const generation = ++campusGeneration;
    const models = landmarkModels.filter(item => item.campusId === data.id);
    const modelStatuses = new Map(models.map(item => [item.landmarkId, 'loading']));
    for (const model of landmarkModels) canvas.removeAttribute(`data-model-${model.landmarkId}`);
    const updateModelStatus = (id: string, status: string): void => {
      modelStatuses.set(id, status);
      canvas.setAttribute(`data-model-${id}`, status);
      const statuses = [...modelStatuses.values()];
      canvas.dataset.heroModel = statuses.includes('fallback') ? 'fallback' : statuses.includes('loading') ? 'loading' : statuses.length ? 'ready' : 'none';
    };
    for (const model of models) updateModelStatus(model.landmarkId, 'loading');
    travel = null;
    tween = null;
    clearRoute();
    clearHighlights();
    pawn.removeFromParent();
    player.shadow.removeFromParent();
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
    const landscapeGeometry = new THREE.PlaneGeometry(maxX - minX + 800, maxZ - minZ + 800);
    const terrainPositions = landscapeGeometry.getAttribute('position'), terrainUV = landscapeGeometry.getAttribute('uv');
    for (let i = 0; i < terrainPositions.count; i++) terrainUV.setXY(i, terrainPositions.getX(i) + centerX, terrainPositions.getY(i) - centerZ);
    terrainUV.needsUpdate = true;
    const landscape = new THREE.Mesh(landscapeGeometry, createSurfaceMaterial('grass', 0x96b298));
    landscape.rotation.x = -Math.PI / 2;
    landscape.position.set(centerX, -0.12, centerZ);
    landscape.receiveShadow = true;
    world.add(landscape);
    if (boundary.length >= 3) addSurface(world, boundary, -0.025, createSurfaceMaterial('grass', 0xa6c19e));
    const curb = perimeter(boundary, 0.015, new THREE.LineBasicMaterial({ color: 0x8b9684 }));
    if (curb) world.add(curb);
    mapShadow = { x: centerX, z: centerZ, extent };
    playerShadowX = playerShadowZ = Infinity;

    const roadEdge = new THREE.Mesh(strips(data.roads, 1.15), createSurfaceMaterial('paving', 0xd7d0bb));
    const roads = new THREE.Mesh(strips(data.roads, 0), createSurfaceMaterial('asphalt', 0xa4a79c));
    roadEdge.receiveShadow = roads.receiveShadow = true;
    world.add(roadEdge, roads);

    // Designed game paths, not actual mapped roads.
    const gamePaths = data.questOrder.flatMap((id, i) => {
      const points = data.routes[`${i ? data.questOrder[i - 1] : 'start'}>${id}`];
      return points && points.length >= 2 && points.every(validPoint)
        ? [{ id: `game-${i}-${id}`, points, width: 2.4, source: 'Designed game path, not a mapped road' }] : [];
    });
    const pathMaterial = createSurfaceMaterial('paving', 0xd5d0bf);
    const paths = new THREE.Mesh(strips(gamePaths, 0), pathMaterial);
    paths.position.y = 0.02; // Keep the paths above existing road surfaces.
    paths.receiveShadow = true;
    world.add(paths);
    if (data.id === 'yingxi') {
      // Designed link only: bridge the grass gap from the existing route to
      // the new garden approach without changing mapped roads or quest IDs.
      const linkGeometry = strips([{ id: 'qingze-designed-link', points: [[35, 173], [35, 188.4]], width: 3.4, source: 'Designed game path, not a mapped road' }], 0);
      const positions = linkGeometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) positions.setY(i, THREE.MathUtils.lerp(.11, .05, THREE.MathUtils.clamp((positions.getZ(i) - 173) / 15.4, 0, 1)));
      positions.needsUpdate = true; linkGeometry.computeVertexNormals();
      const link = new THREE.Mesh(linkGeometry, pathMaterial); link.receiveShadow = true; world.add(link);
    }

    const parkMat = data.features.some(f => f.kind === 'park' && cleanPolygon(f.polygon).length >= 3) ? createSurfaceMaterial('grass', 0x879f82) : null;
    const trackMat = material(0xb5795f);
    const fieldMat = material(0x829d77);
    const facadeMats = [material(0xd4cbb8), material(0xb6b8aa), material(0xb59580), material(0xc3bba9)];
    const roofMat = material(0xa5a89d);
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x7f9293, roughness: 0.55, metalness: 0.04 });
    const buildings = data.features.filter((f) => f.kind === 'building' && cleanPolygon(f.polygon).length >= 3);
    const windowTransforms: THREE.Matrix4[] = [];
    const modelWindowRanges = new Map<string, [number, number]>();
    const roofLines = new Map<string, THREE.LineLoop>();
    const windowInstances: { mesh: THREE.InstancedMesh; index: number }[] = [];
    const dummy = new THREE.Object3D();
    const backgroundBuckets = new Map<string, { index: number; geometries: THREE.BufferGeometry[] }>();
    const usedFacadeMats = new Set<THREE.Material>();
    let roofUsed = false;

    for (const feature of data.features) {
      const polygon = cleanPolygon(feature.polygon || []);
      if (polygon.length < 3) continue;
      if (feature.kind === 'park') {
        if (parkMat) addSurface(world, polygon, 0.025, parkMat);
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
        const facadeIndex = hash % facadeMats.length;
        const linked = data.landmarks.find((item) => item.featureId === feature.id || item.featureIds?.includes(feature.id));
        if (!linked) {
          const [x0, z0, x1, z1] = boundsOf(polygon);
          const key = `${facadeIndex}:${Math.floor((x0 + x1) / 200)}:${Math.floor((z0 + z1) / 200)}`;
          const bucket = backgroundBuckets.get(key) ?? { index: facadeIndex, geometries: [] };
          bucket.geometries.push(geometry); backgroundBuckets.set(key, bucket);
        } else {
          usedFacadeMats.add(facadeMats[facadeIndex]);
          roofUsed = true;
          const building = new THREE.Mesh(geometry, [roofMat, facadeMats[facadeIndex]]);
          building.castShadow = true;
          building.receiveShadow = true;
          building.userData.height = height;
          building.userData.landmarkId = linked.id; pickables.push(building);
          world.add(building);
          buildingMeshes.set(feature.id, building);
          const parapet = perimeter(polygon, height + 0.12, new THREE.LineBasicMaterial({ color: 0x777e77 }));
          if (parapet) { world.add(parapet); roofLines.set(feature.id, parapet); }
        }
        const firstWindow = windowTransforms.length;
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
            dummy.scale.set(Math.min(1.8, len / count * 0.5), Math.min(1.6, floorHeight * 0.55), 0.12);
            dummy.updateMatrix();
            windowTransforms.push(dummy.matrix.clone());
          }
        }
        modelWindowRanges.set(feature.id, [firstWindow, windowTransforms.length]);
      }
    }
    for (const { index, geometries } of backgroundBuckets.values()) {
      const merged = mergeGeometries(geometries, false);
      if (merged) geometries.forEach((geometry) => geometry.dispose());
      usedFacadeMats.add(facadeMats[index]);
      for (const geometry of merged ? [merged] : geometries) {
        const mesh = new THREE.Mesh(geometry, facadeMats[index]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        world.add(mesh);
        pickables.push(mesh); // Opaque background geometry must occlude hidden landmarks.
      }
    }
    for (const facadeMat of facadeMats) if (!usedFacadeMats.has(facadeMat)) facadeMat.dispose();
    if (!roofUsed) roofMat.dispose();
    if (windowTransforms.length) {
      // Spatially bounded instances let the player camera cull entire distant
      // blocks; map mode still sees all chunks within its own frustum.
      const chunks = new Map<string, number[]>();
      windowTransforms.forEach((matrix, i) => {
        const key = `${Math.floor(matrix.elements[12] / 100)}:${Math.floor(matrix.elements[14] / 100)}`;
        const indices = chunks.get(key) ?? []; indices.push(i); chunks.set(key, indices);
      });
      const windowGeometry = new THREE.BoxGeometry(1, 1, 1);
      for (const indices of chunks.values()) {
        const windows = new THREE.InstancedMesh(windowGeometry, windowMat, indices.length);
        indices.forEach((global, local) => {
          windows.setMatrixAt(local, windowTransforms[global]); windowInstances[global] = { mesh: windows, index: local };
        });
        windows.instanceMatrix.needsUpdate = true;
        windows.computeBoundingSphere();
        windows.receiveShadow = true;
        windows.userData.photoIgnore = true; // Building bodies already provide occlusion.
        world.add(windows);
      }
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
            const gardenConflict = data.id === 'yingxi' && tx >= QINGZE_DECORATION_BOUNDS.minX && tx <= QINGZE_DECORATION_BOUNDS.maxX && tz >= QINGZE_DECORATION_BOUNDS.minZ && tz <= QINGZE_DECORATION_BOUNDS.maxZ;
            if (!gardenConflict && Math.abs(tz - midZ) > 3 && isClear(tx, tz, polygon, 2.6)) treePositions.push([tx, tz]);
          }
        }
      }
    }
    const collisionProps = new THREE.Group();
    if (treePositions.length) {
      const chunks = new Map<string, number[]>();
      treePositions.forEach(([x, z], i) => {
        const key = `${Math.floor(x / 100)}:${Math.floor(z / 100)}`;
        const indices = chunks.get(key) ?? []; indices.push(i); chunks.set(key, indices);
      });
      const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.45, 3.8, 6);
      const crownGeometry = createFoliageGeometry();
      const trunkMaterial = material(0x79765e), crownMaterial = new THREE.MeshStandardMaterial({ color: 0x718d70, roughness: 1, vertexColors: true });
      for (const indices of chunks.values()) {
        const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, indices.length);
        const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, indices.length);
        indices.forEach((i, local) => {
          const [x, z] = treePositions[i];
          dummy.position.set(x, 1.9, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); trunks.setMatrixAt(local, dummy.matrix);
          dummy.position.set(x, 4.6 + (i % 3) * 0.22, z); dummy.scale.set(2.1 + (i % 3) * 0.15, 2.4, 2.0 + (i % 2) * 0.25); dummy.updateMatrix(); crowns.setMatrixAt(local, dummy.matrix);
        });
        trunks.instanceMatrix.needsUpdate = crowns.instanceMatrix.needsUpdate = true;
        trunks.computeBoundingSphere(); crowns.computeBoundingSphere();
        trunks.castShadow = crowns.castShadow = true;
        world.add(trunks, crowns);
      }
      for (const [x, z] of treePositions) {
        const trunkCollider = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, 3.8, 6), new THREE.MeshBasicMaterial());
        trunkCollider.position.set(x, 1.9, z); collisionProps.add(trunkCollider);
      }
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
      marker.userData.photoIgnore = true; // UI markers are not physical scenery.
      marker.visible = mapMode;
      marker.castShadow = false;
      markerMeshes.set(landmark.id, marker);
      pickables.push(marker);
      world.add(marker);
      const name = document.createElement('div');
      name.className = 'landmark-label';
      const index = data.questOrder.indexOf(landmark.id);
      name.textContent = `${index < 0 ? '•' : String(index + 1).padStart(2, '0')}  ${landmark.name}`;
      const label = new CSS2DObject(name);
      label.position.set(0, 5, 0);
      label.center.set(0.5, 1);
      marker.add(label);
    }
    syncMarkerVisibility();
    if (!markerMeshes.size) { markerGeometry.dispose(); markerNormal.dispose(); markerSelected.dispose(); markerTarget.dispose(); }
    // Materials not currently assigned to a marker are still owned by the world.
    else {
      const owner = new THREE.Mesh(new THREE.BufferGeometry(), [markerNormal, markerSelected, markerTarget]);
      owner.visible = false;
      world.add(owner);
    }

    let gardenFallback: THREE.Group | null = null;
    if (data.id === 'yingxi') {
      addCorridor(world, collisionProps);
      const garden = createQingzeFallback();
      gardenFallback = garden.visual; world.add(garden.visual); collisionProps.add(garden.colliders);
    }
    player.setCampus(data, collisionProps);
    disposeObject(collisionProps);
    world.add(pawn, player.shadow);
    renderer.shadowMap.needsUpdate = true;
    updateHighlights();
    const ownerWorld = world;
    for (const config of models) {
      void loadLandmarkModel(config).then(model => {
        if (disposed || generation !== campusGeneration || ownerWorld !== world) {
          disposeObject(model);
          return;
        }
        for (const featureId of config.featureIds) {
          const fallback = buildingMeshes.get(featureId);
          if (fallback) { fallback.visible = false; pickables = pickables.filter(item => item !== fallback); }
          const roof = roofLines.get(featureId);
          if (roof) roof.visible = false;
          const range = modelWindowRanges.get(featureId);
          if (range) {
            const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
            for (let i = range[0]; i < range[1]; i++) {
              const instance = windowInstances[i];
              instance.mesh.setMatrixAt(instance.index, hidden); instance.mesh.instanceMatrix.needsUpdate = true;
            }
          }
        }
        model.traverse(object => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = object.receiveShadow = true;
            object.userData.landmarkId = config.selectionId ?? config.landmarkId;
            pickables.push(object);
          }
        });
        model.userData.landmarkId = config.landmarkId;
        if (config.landmarkId === 'yx-garden-setting' && gardenFallback) gardenFallback.visible = false;
        ownerWorld.add(model);
        model.updateMatrixWorld(true);
        const marker = markerMeshes.get(config.landmarkId);
        if (marker) marker.position.y = config.markerHeight;
        updateHighlights();
        renderer.shadowMap.needsUpdate = true;
        updateModelStatus(config.landmarkId, 'ready');
        onEvent({ type: 'modelstatus', id: config.landmarkId, name: config.name, status: 'ready' });
      }).catch(() => {
        if (disposed || generation !== campusGeneration || ownerWorld !== world) return;
        updateModelStatus(config.landmarkId, 'fallback');
        onEvent({ type: 'modelstatus', id: config.landmarkId, name: config.name, status: 'fallback' });
      });
    }
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
  function updateSun(forMap: boolean, force = false): void {
    const grid = 20;
    const x = forMap ? mapShadow.x : Math.round(pawn.position.x / grid) * grid;
    const z = forMap ? mapShadow.z : Math.round(pawn.position.z / grid) * grid;
    if (!forMap && !force && x === playerShadowX && z === playerShadowZ) return;
    const extent = forMap ? mapShadow.extent : 400;
    // Warm key light reaches the +X-facing mechanical-hall facade; keep other light parameters unchanged.
    sun.position.set(x + extent * .7, extent * 1.15, z + extent * .55);
    sun.target.position.set(x, 0, z);
    const shadowCamera = sun.shadow.camera;
    const shadowExtent = forMap ? extent * .95 + 100 : 100;
    shadowCamera.left = -shadowExtent; shadowCamera.right = shadowExtent;
    shadowCamera.top = shadowExtent; shadowCamera.bottom = -shadowExtent;
    shadowCamera.near = 1; shadowCamera.far = extent * 3.5 + 500;
    shadowCamera.updateProjectionMatrix();
    playerShadowX = forMap ? Infinity : x; playerShadowZ = forMap ? Infinity : z;
    renderer.shadowMap.needsUpdate = true;
  }
  function syncMarkerVisibility(): void {
    for (const marker of markerMeshes.values()) marker.visible = mapMode;
    canvas.dataset.visibleMarkers = String([...markerMeshes.values()].filter(marker => marker.visible).length);
  }
  function showMap(): void {
    mapMode = true; syncMarkerVisibility();
    canvas.dataset.mapMarkers = '[]'; // Populated from the next rendered map frame.
    controls.enabled = true; player.setEnabled(false); updateSun(true); canvas.dataset.view = 'map';
  }
  function showPlayer(): void {
    mapMode = false; syncMarkerVisibility();
    delete canvas.dataset.mapMarkers;
    controls.enabled = false; player.setEnabled(true); player.updateCamera(true); updateSun(false, true); canvas.dataset.view = 'player';
  }
  function overview(): void {
    showMap();
    const points = cleanPolygon(data.boundary || []);
    const [x0, z0, x1, z1] = boundsOf(points.length ? points : data.features.flatMap((f) => f.polygon));
    animateView(new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), Math.max(500, (x1 - x0) * 1.2, (z1 - z0) * 1.2));
  }
  function focusLandmark(id: string): void {
    showMap();
    const landmark = data.landmarks.find((item) => item.id === id);
    if (!landmark || !validPoint(landmark.position)) return;
    const features = data.features.filter((f) => f.id === landmark.featureId || landmark.featureIds?.includes(f.id));
    const [x0, z0, x1, z1] = features.length ? boundsOf(features.flatMap(f => f.polygon)) : [0, 0, 0, 0];
    const span = Math.max(110, (x1 - x0) * 1.35, (z1 - z0) * 1.35);
    animateView(new THREE.Vector3(landmark.position[0], 0, landmark.position[1]), span);
  }
  function drawRoute(points: Point2[]): void {
    clearRoute();
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, z]) => new THREE.Vector3(x, 0.24, z)));
    const line = new THREE.Line(lineGeometry, new THREE.LineDashedMaterial({ color: 0xeeb760, dashSize: 5, gapSize: 3, transparent: true, opacity: 0.95, depthWrite: false }));
    line.computeLineDistances();
    line.frustumCulled = false;
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
    if (!landmark || !validPoint(landmark.arrival)) return false;
    const start: Point2 = [pawn.position.x, pawn.position.z];
    const distance = Math.hypot(start[0] - landmark.arrival[0], start[1] - landmark.arrival[1]);
    // Join the nearest available waypoint on an authored route to this target.
    // This is still guidance, never automated movement or proof of arrival.
    let closest = Infinity;
    let waypoints: Point2[] = [landmark.arrival];
    for (const [key, points] of Object.entries(data.routes)) {
      if (!key.endsWith(`>${id}`)) continue;
      for (let i = 0; i < points.length; i++) {
        if (!validPoint(points[i])) continue;
        const separation = Math.hypot(start[0] - points[i][0], start[1] - points[i][1]);
        if (separation < closest && points.slice(i).every(validPoint)) {
          closest = separation;
          waypoints = points.slice(i);
        }
      }
    }
    travel = { id, initialDistance: Math.max(distance, 1), arrival: landmark.arrival, waypoints };
    drawRoute([start, ...waypoints]);
    showPlayer();
    onEvent({ type: 'travel', progress: 0 });
    return true;
  }
  function resetJourney(): void {
    if (disposed) return;
    travel = null; clearRoute();
    // Resetting quest progress must not teleport someone already exploring.
  }
  function tick(time: number): void {
    if (disposed || paused) return;
    const dt = previousTime ? Math.min(1, Math.max(0, (time - previousTime) / 1000)) : 0;
    previousTime = time;
    // Keep the canvas responsive on software renderers and slow devices;
    // recover resolution only after sustained fast frames to avoid oscillation.
    if (dt > .1) { slowFrames++; fastFrames = 0; }
    else if (dt > 0 && dt < .025) { fastFrames++; slowFrames = 0; }
    else { slowFrames = 0; fastFrames = 0; }
    const maxRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const nextRatio = slowFrames >= 3 ? Math.max(.5, renderRatio * .75)
      : fastFrames >= 180 ? Math.min(maxRatio, renderRatio / .75) : renderRatio;
    if (nextRatio !== renderRatio) {
      renderRatio = nextRatio; renderer.setPixelRatio(renderRatio);
      const shadowType = renderRatio <= .75 ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
      if (renderer.shadowMap.type !== shadowType) { renderer.shadowMap.type = shadowType; renderer.shadowMap.needsUpdate = true; }
      renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight), false);
      slowFrames = fastFrames = 0;
    }
    canvas.dataset.renderRatio = renderRatio.toFixed(2);
    if (tween) {
      tween.elapsed += dt;
      const t = Math.min(1, tween.elapsed / tween.duration), eased = t * t * (3 - 2 * t);
      camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      frameSpan = THREE.MathUtils.lerp(tween.fromSpan, tween.toSpan, eased);
      refreshFrustum();
      if (t >= 1) tween = null;
    }
    player.advance();
    if (!mapMode) updateSun(false);
    if (travel) {
      const current = travel;
      const distance = Math.hypot(pawn.position.x - current.arrival[0], pawn.position.z - current.arrival[1]);
      let advanced = false;
      while (current.waypoints.length > 1 && Math.hypot(pawn.position.x - current.waypoints[0][0], pawn.position.z - current.waypoints[0][1]) < 4) {
        current.waypoints.shift(); advanced = true;
      }
      if (advanced) drawRoute([[pawn.position.x, pawn.position.z], ...current.waypoints]);
      const guide = routeLayer.children[0];
      if (guide instanceof THREE.Line) {
        const positions = guide.geometry.getAttribute('position');
        positions.setXYZ(0, pawn.position.x, .24, pawn.position.z); positions.needsUpdate = true;
        const distances = guide.geometry.getAttribute('lineDistance');
        let accumulated = 0;
        distances.setX(0, 0);
        for (let i = 1; i < positions.count; i++) {
          accumulated += Math.hypot(positions.getX(i) - positions.getX(i - 1), positions.getY(i) - positions.getY(i - 1), positions.getZ(i) - positions.getZ(i - 1));
          distances.setX(i, accumulated);
        }
        distances.needsUpdate = true;
      }
      onEvent({ type: 'travel', progress: Math.max(0, Math.min(1, 1 - distance / current.initialDistance)) });
      if (travel === current && distance < 5) {
        travel = null; clearRoute(); onEvent({ type: 'arrive', id: current.id });
      }
    }
    controls.update();
    const activeCamera = mapMode ? camera : player.camera;
    scene.fog = mapMode ? null : distanceFog;
    labels.domElement.style.display = mapMode ? '' : 'none';
    labels.render(scene, activeCamera);
    renderer.render(scene, activeCamera);
    if (mapMode) {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      const position = new THREE.Vector3();
      const projected: { id: string; x: number; y: number }[] = [];
      for (const [id, marker] of markerMeshes) {
        if (!marker.visible) continue;
        marker.getWorldPosition(position).project(camera);
        if (position.z < -1 || position.z > 1 || Math.abs(position.x) > 1 || Math.abs(position.y) > 1) continue;
        projected.push({ id, x: (position.x + 1) * width / 2, y: (1 - position.y) * height / 2 });
      }
      // Read-only canvas-relative CSS coordinates from the rendered map;
      // they are not a selection or position-setting interface.
      canvas.dataset.mapMarkers = JSON.stringify(projected);
    }
    canvas.dataset.frame = String(++frameCount);
    canvas.dataset.drawCalls = String(renderer.info.render.calls);
    canvas.dataset.triangles = String(renderer.info.render.triangles);
    raf = requestAnimationFrame(tick);
  }
  function inspectPhoto(point: PhotoPoint): PhotoInspection {
    const distance = Math.hypot(pawn.position.x - point.position[0], pawn.position.z - point.position[1]);
    const result: PhotoInspection = { distance, inRange: distance <= point.radius, framed: false, obstructed: false };
    if (disposed || paused || mapMode || !validPoint(point.position) || !point.target.every(Number.isFinite) || !Number.isFinite(point.radius) || point.radius <= 0 || !result.inRange) return result;
    player.camera.updateMatrixWorld(true);
    const visibleInFrame = (xyz: [number, number, number], maxX: number, maxY: number): boolean => {
      if (!Array.isArray(xyz) || xyz.length !== 3 || !xyz.every(Number.isFinite)) return false;
      const p = new THREE.Vector3(...xyz).project(player.camera);
      return p.z >= -1 && p.z <= 1 && Math.abs(p.x) <= maxX && Math.abs(p.y) <= maxY;
    };
    // The clock must fit the central focus frame and the authored tower
    // silhouette must fit the image, not merely its centroid.
    result.framed = visibleInFrame(point.target, .45, .5)
      && Array.isArray(point.focusExtent) && point.focusExtent.length >= 4 && point.focusExtent.every(xyz => visibleInFrame(xyz, .45, .5))
      && Array.isArray(point.frameExtent) && point.frameExtent.length >= 4 && point.frameExtent.every(xyz => visibleInFrame(xyz, .95, .95));
    // Only evaluate expensive occlusion once the bounded subject fits. Check
    // the center and each clock edge so a branch cannot cover the clock while
    // a single center ray happens to pass through a gap.
    if (!result.framed) return result;
    const visible = (object: THREE.Object3D): boolean => {
      for (let current: THREE.Object3D | null = object; current; current = current.parent) if (!current.visible) return false;
      return true;
    };
    const belongsToTarget = (object: THREE.Object3D): boolean => {
      for (let current: THREE.Object3D | null = object; current; current = current.parent) if (current.userData.landmarkId === point.landmarkId && point.landmarkId) return true;
      return false;
    };
    const objects = world.children.filter(object => object !== pawn && object !== player.shadow && object.visible && !object.userData.photoIgnore && !(point.landmarkId && object.userData.landmarkId === point.landmarkId));
    for (const xyz of [point.target, ...point.focusExtent]) {
      const ray = new THREE.Vector3(...xyz).sub(player.camera.position);
      const targetDistance = ray.length();
      if (targetDistance <= .001) continue;
      raycaster.set(player.camera.position, ray.normalize());
      raycaster.far = Math.max(0, targetDistance - .2);
      if (raycaster.intersectObjects(objects, true).some(hit => visible(hit.object) && !belongsToTarget(hit.object))) {
        result.obstructed = true; break;
      }
    }
    raycaster.far = Infinity;
    return result;
  }
  function capturePhoto(): string | null {
    if (disposed || paused || mapMode) return null;
    try {
      // The default WebGL buffer need not persist after a frame; render and
      // read synchronously rather than returning a blank canvas.
      renderer.render(scene, player.camera);
      return canvas.toDataURL('image/png');
    } catch { return null; }
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
    if (!click || disposed || !mapMode) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointerNdc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    if (hit && typeof hit.object.userData.landmarkId === 'string') onEvent({ type: 'select', id: hit.object.userData.landmarkId });
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
    player.dispose();
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
    showPlayer();
    labels.render(scene, player.camera);
    raf = requestAnimationFrame(tick);
  } catch (error) {
    dispose();
    onEvent({ type: 'error', reason: `Unable to build the 3D scene: ${error instanceof Error ? error.message : 'unknown error'}` });
    return noopHandle();
  }

  return {
    setCampus(next) {
      if (disposed) return;
      try { data = next; state = { selectedId: null, targetId: null }; buildCampus(); questView(true); showPlayer(); labels.render(scene, player.camera); }
      catch (error) { dispose(); onEvent({ type: 'error', reason: `Unable to build the 3D scene: ${error instanceof Error ? error.message : 'unknown error'}` }); }
    },
    inspectPhoto,
    capturePhoto,
    setState(next) { if (!disposed) { state = { selectedId: next.selectedId, targetId: next.targetId }; updateHighlights(); } },
    navigateTo,
    resetJourney,
    focusLandmark,
    overview,
    resetView() { if (!disposed) showPlayer(); },
    pause() {
      if (disposed || paused) return;
      paused = true; controls.enabled = false; player.setPaused(true); previousTime = 0;
      cancelAnimationFrame(raf); canvas.dataset.paused = 'true';
    },
    resume() {
      if (disposed || !paused) return;
      paused = false; controls.enabled = mapMode; player.setPaused(false); previousTime = 0;
      canvas.dataset.paused = 'false'; raf = requestAnimationFrame(tick);
    },
    dispose,
  };
}
