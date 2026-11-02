import { createIdealCampusLayer, IDEAL_FACILITIES, IDEAL_ACTIVITY_POINTS } from './IdealCampusLayer';
import { createOriginalViewingPlatform, VIEWING_PLATFORM, PAPERPLANE_STATION, PAPERPLANE_COURSE } from './OriginalViewingPlatform';
import { PaperplaneActivity } from './PaperplaneActivity';
import type { PaperplaneConfig } from '../games/paperplane';
import * as THREE from 'three';
import { landmarkModels, loadLandmarkModel } from './LandmarkModels';
import { applyLandmarkShadowStyle } from './LandmarkStyle';
import { PlayerController, type PlayerCollisionSnapshot } from './PlayerController';
import { createQingzeFallback, QINGZE_DECORATION_BOUNDS } from './QingzeGarden';
import { createFoliageGeometry, createSurfaceMaterial, getFoliageVariation } from './SurfaceStyle';
import { createHuyuCourtyards } from './HuyuCourtyards';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import type { IdealActivityInspection, CampusMode, CampusModeSwitchStatus, CampusModeSwitchResult, CampusData, CampusRoad, CampusSceneHandle, Landmark, PhotoInspection, PhotoPoint, Point2, SceneEvent, SceneState } from '../shared/contracts';

const noopHandle = (): CampusSceneHandle => ({
  inspectIdealActivity: () => null,
  getCampusMode: () => 'base', getModeSwitchStatus: () => ({allowed:false,reason:'三维场景不可用。'}), requestCampusMode: () => ({applied:false,mode:'base',reason:'三维场景不可用。'}),
  setCampus() {}, setState() {}, navigateTo: () => false, resetJourney() {},
  focusLandmark() {}, overview() {}, resetView() {}, pause() {}, resume() {}, dispose() {},
  canBeginPaperplane: () => false, beginPaperplane: () => false,
  setPaperplaneInput() {}, launchPaperplane() {}, retryPaperplane() {}, pausePaperplane() {}, resumePaperplane() {}, endPaperplane() {},
  inspectPhoto: () => ({ settling: true, inRange: false, framed: false, obstructed: false, distance: Infinity }), capturePhoto: () => null,
});

type ModeLayer = Pick<ReturnType<typeof createIdealCampusLayer>, 'visual' | 'dispose'>;
/** Synchronous transaction: the next RAF sees one coherent visual/collision world. */
export function commitCampusModeLayer(
  world: THREE.Group,
  player: Pick<PlayerController, 'getCollisionSnapshot' | 'commitCollision' | 'restoreCollisionSnapshot'>,
  target: PlayerCollisionSnapshot, previous: ModeLayer | null, prepared: ModeLayer | null,
): { applied: boolean; cleanupWarning: boolean } {
  const oldSnapshot = player.getCollisionSnapshot();
  try {
    if (prepared) world.add(prepared.visual);
    if (!player.commitCollision(target)) throw new Error('Unsafe collision target');
    previous?.visual.removeFromParent();
  } catch {
    player.restoreCollisionSnapshot(oldSnapshot);
    prepared?.visual.removeFromParent();
    if (previous && previous.visual.parent !== world) world.add(previous.visual);
    let cleanupWarning = false;
    try { prepared?.dispose(); } catch { cleanupWarning = true; }
    return { applied: false, cleanupWarning };
  }
  try { previous?.dispose(); return { applied: true, cleanupWarning: false }; }
  catch { return { applied: true, cleanupWarning: true }; }
}

/** Pure eligibility gate; the scene supplies current physical support and real line of sight. */
export function idealActivityEligibility(input: { free: boolean; grounded: boolean; withinFacility: boolean; distance: number; obstructed: boolean }): { available: boolean; reason: string } {
  if (!input.free) return { available: false, reason: '请先退出当前活动或面板。' };
  if (!input.grounded) return { available: false, reason: '请在地面站稳后使用台面。' };
  if (!Number.isFinite(input.distance) || input.distance < 0 || input.distance > 2.4 || !input.withinFacility) return { available: false, reason: '走入廊下，靠近阅读或展示台。' };
  if (input.obstructed) return { available: false, reason: '台面被景物遮挡，请从通道侧靠近。' };
  return { available: true, reason: '' };
}

/** Opaque scenery blocks a table interaction; no collision/pose writes. */
export function hasIdealActivityLineOfSight(from: THREE.Vector3, target: THREE.Vector3, objects: THREE.Object3D[], raycaster = new THREE.Raycaster()): boolean {
  const ray = target.clone().sub(from);
  if (!Number.isFinite(ray.length()) || ray.lengthSq() < .000001) return false;
  raycaster.set(from, ray.clone().normalize()); raycaster.far = ray.length();
  try {
    return !raycaster.intersectObjects(objects, true).some(hit => {
      for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible || object.userData.photoIgnore) return false;
      return true;
    });
  } finally { raycaster.far = Infinity; }
}

/** Optional vertical gate preserves legacy ground-level photography. */
export function isPhotoHeightEligible(footY: number, range?: [number, number]): boolean {
  return Number.isFinite(footY) && (range === undefined || (Array.isArray(range) && range.length === 2 && range.every(Number.isFinite) && range[0] <= range[1] && footY >= range[0] && footY <= range[1]));
}

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
  const leaves = new THREE.MeshStandardMaterial({ color: 0x839f7f, roughness: 1, vertexColors: true, side: THREE.DoubleSide });
  const treeSites: Point2[] = [[-48, 151], [-24, 151], [0, 151], [-43, 170], [-19, 170], [5, 170]];
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.22, .3, 3.4, 8), bark, treeSites.length);
  const treeTransform = new THREE.Object3D();
  treeSites.forEach(([x, z], i) => {
    treeTransform.position.set(x, 1.7, z); treeTransform.scale.set(1, 1, 1); treeTransform.updateMatrix(); trunks.setMatrixAt(i, treeTransform.matrix);
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 3.4, 8), new THREE.MeshBasicMaterial());
    proxy.position.set(x, 1.7, z); colliders.add(proxy);
  });
  trunks.instanceMatrix.needsUpdate = true;
  trunks.castShadow = true; world.add(trunks);
  for (const variant of [0, 1] as const) {
    const indices = treeSites.flatMap(([x, z], i) => getFoliageVariation(x, z).variant === variant ? [i] : []);
    if (!indices.length) continue;
    const canopies = new THREE.InstancedMesh(createFoliageGeometry(variant), leaves, indices.length);
    indices.forEach((i, local) => {
      const [x, z] = treeSites[i], variation = getFoliageVariation(x, z);
      treeTransform.position.set(x, 4.2 + (i % 3) * .18, z); treeTransform.rotation.set(0, variation.yaw, 0);
      treeTransform.scale.set(2.1, 2.4, 2.1); treeTransform.updateMatrix(); canopies.setMatrixAt(local, treeTransform.matrix);
      canopies.setColorAt(local, new THREE.Color().setScalar(variation.colorScale));
    });
    canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    canopies.computeBoundingSphere(); canopies.castShadow = true; world.add(canopies);
  }
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
  scene.background = new THREE.Color(0xdce7df);
  const distanceFog = new THREE.Fog(0xdce7df, 45, 320);
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
  const referenceQuality = new URLSearchParams(window.location.search).get('render-quality') === 'reference';
  let renderRatio = referenceQuality ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
  let slowFrames = 0, fastFrames = 0;
  renderer.setPixelRatio(renderRatio);
  renderer.shadowMap.enabled = true;
  // Campus geometry/light are static; do not redraw a 2048px shadow map each frame.
  renderer.shadowMap.autoUpdate = false;
  // r186 removed PCFSoft: reference runs select its supported PCF replacement explicitly.
  renderer.shadowMap.type = referenceQuality ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
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
  let plane: PaperplaneActivity | null = null;
  let planeConfig: PaperplaneConfig | null = null;
  let planeStation: { position: Point2; radius: number; heightRange: [number,number] } | null = null;
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
  let collisionGeneration = 0;
  let campusMode: CampusMode = 'base';
  let idealLayer: ReturnType<typeof createIdealCampusLayer> | null = null;
  let baseCollisionProps: THREE.Group | null = null;
  let baseCollisionSnapshot: PlayerCollisionSnapshot | null = null;
  let courtyard: ReturnType<typeof createHuyuCourtyards> | null = null;
  let platform: ReturnType<typeof createOriginalViewingPlatform> | null = null;
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
    renderRatio = referenceQuality ? 1 : Math.min(renderRatio, window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(renderRatio);
    renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight), false);
    labels.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
    refreshFrustum();
    player.resize(container.clientWidth, container.clientHeight);
    plane?.resize(container.clientWidth, container.clientHeight);
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
    endPaperplane(); planeConfig = null; planeStation = null;
    idealLayer?.dispose(); idealLayer = null;
    if (baseCollisionProps) disposeObject(baseCollisionProps);
    baseCollisionProps = null; baseCollisionSnapshot = null; campusMode = 'base';
    canvas.dataset.campusMode = campusMode;
    platform?.dispose(); platform = null;
    delete canvas.dataset.viewingPlatform; delete canvas.dataset.paperplaneStation;
    delete canvas.dataset.campusReady;
    delete canvas.dataset.playerX; delete canvas.dataset.playerY; delete canvas.dataset.playerZ;
    delete canvas.dataset.cameraYaw; delete canvas.dataset.cameraPitch;
    delete canvas.dataset.huyuTreeTexture; delete canvas.dataset.huyuTreeCount;
    courtyard?.dispose(); courtyard = null;
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
      // Interpretive ground-only arrival apron: join the entrance steps to the
      // existing guide, stopping before the mapped north–south road verge.
      // This is a design connection, not a surveyed campus path. It adds no
      // solid obstacles, changes no routes, and remains below road/path tops.
      const arrival = addSurface(world, [
        [-51.7, 172.6], [-47, 172.6], [-43, 171.4], [-28.8, 171.4],
        [-28.8, 175], [-43, 175], [-47, 178.6], [-51.7, 178.6],
      ], .05, pathMaterial);
      if (arrival) { arrival.receiveShadow = true; arrival.userData.photoIgnore = true; }
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
    const facadeMats = [material(0xded1bc), material(0xc5c3b3), material(0xb9947c), material(0xd2c6b3)];
    const roofMat = material(0x6d786b);
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x769491, roughness: 0.55, metalness: 0.04 });
    const buildings = data.features.filter((f) => f.kind === 'building' && cleanPolygon(f.polygon).length >= 3);
    const windowTransforms: THREE.Matrix4[] = [];
    const trimParts: THREE.BufferGeometry[] = [];
    const modelWindowRanges = new Map<string, [number, number]>();
    const roofLines = new Map<string, THREE.LineLoop>();
    const windowInstances: { mesh: THREE.InstancedMesh; frame: THREE.InstancedMesh; index: number }[] = [];
    const dummy = new THREE.Object3D();
    const backgroundBuckets = new Map<string, { index: number; geometries: THREE.BufferGeometry[] }>();
    const usedFacadeMats = new Set<THREE.Material>();
    let roofUsed = false;

    // Original visual-family studies, not surveyed facade/use/entrance claims.
    // Footprints, estimated heights, source IDs and collision data stay unchanged.
    const facadeStudies = new Set([
      'overture:b39690f0-0259-420f-8c33-e8f982bc8273',
      'overture:a04a7502-f32b-4fa2-acee-1f08811fee44',
      '195741288',
    ]);
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
        // Restrained projecting plinth and coping are merged once for the
        // campus. Detailed GLB footprints are omitted to avoid overlaying them.
        if (!models.some(model => model.featureIds.includes(feature.id))) {
          for (let edge = 0; edge < polygon.length; edge++) {
            const a = polygon[edge], b = polygon[(edge + 1) % polygon.length];
            const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
            if (length < .2) continue;
            for (const y of [.13, height + .06]) {
              const part = new THREE.BoxGeometry(length, .14, .16);
              part.rotateY(Math.atan2(-dz, dx));
              part.translate((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
              trimParts.push(part);
            }
          }
        }
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
        const studyFacade = facadeStudies.has(feature.id);
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
          if (studyFacade) {
            // Shallow plinth and restrained floor courses share the existing trim batch.
            for (const y of [.38, ...Array.from({length: Math.max(0, floors - 1)}, (_, floor) => (floor + 1) * floorHeight)]) {
              const band = new THREE.BoxGeometry(len, y === .38 ? .34 : .09, .12);
              band.rotateY(Math.atan2(-dz, dx));
              band.translate((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
              trimParts.push(band);
            }
          }
          for (let floor = 0; floor < floors; floor++) for (let j = 0; j < count; j++) {
            const pairOffset = studyFacade && count > 1 ? (j % 2 === 0 ? .1 : -.1) : 0;
            const t = (j + 0.5 + pairOffset) / count;
            dummy.position.set(a[0] + dx * t + nx * 0.04, (floor + 0.5) * floorHeight, a[1] + dz * t + nz * 0.04);
            dummy.rotation.set(0, Math.atan2(-dz, dx), 0);
            const windowWidth = Math.min(studyFacade ? 2 : 1.8, len / count * .5);
            const windowHeight = Math.min(studyFacade ? 1.9 : 1.6, floorHeight * (studyFacade ? .62 : .55));
            // Pane front .09m, mullion front .10m: preserve original envelope
            // with a real .01m depth gap, not coplanar faces or polygonOffset.
            dummy.scale.set(windowWidth, windowHeight, studyFacade ? .10 : .12);
            dummy.updateMatrix();
            windowTransforms.push(dummy.matrix.clone());
            if (studyFacade && j % 2 === 0) {
              const mullion = new THREE.BoxGeometry(.055, windowHeight, .02);
              mullion.rotateY(Math.atan2(-dz, dx));
              mullion.translate(dummy.position.x + nx * .05, dummy.position.y, dummy.position.z + nz * .05);
              trimParts.push(mullion);
            }
          }
        }
        modelWindowRanges.set(feature.id, [firstWindow, windowTransforms.length]);
      }
    }
    if (trimParts.length) {
      const trimGeometry = mergeGeometries(trimParts, false);
      trimParts.forEach(part => part.dispose());
      if (trimGeometry) {
        const trim = new THREE.Mesh(trimGeometry, material(0xeee2d0));
        trim.castShadow = trim.receiveShadow = true;
        trim.userData.photoIgnore = true;
        world.add(trim);
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
      const frameGeometry = new THREE.BoxGeometry(1.15, 1.12, .55);
      const frameMaterial = material(0xeee2d0);
      for (const indices of chunks.values()) {
        const windows = new THREE.InstancedMesh(windowGeometry, windowMat, indices.length);
        const frames = new THREE.InstancedMesh(frameGeometry, frameMaterial, indices.length);
        indices.forEach((global, local) => {
          windows.setMatrixAt(local, windowTransforms[global]); frames.setMatrixAt(local, windowTransforms[global]); windowInstances[global] = { mesh: windows, frame: frames, index: local };
        });
        windows.instanceMatrix.needsUpdate = frames.instanceMatrix.needsUpdate = true;
        windows.computeBoundingSphere(); frames.computeBoundingSphere();
        frames.userData.photoIgnore = true;
        world.add(frames);
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
    // Every decorative collider must clear every route segment, including
    // nearby crossing/return segments, not just the segment it was derived from.
    const clearsRoutes = (x: number, z: number, clearance: number): boolean => Object.values(data.routes).every(points =>
      points.slice(1).every((b, index) => {
        const a = points[index], dx = b[0] - a[0], dz = b[1] - a[1];
        const length2 = dx * dx + dz * dz;
        const t = length2 ? THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / length2, 0, 1) : 0;
        return Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz)) >= clearance;
      }));
    if (data.id === 'huyu') {
      // Designed, unsurveyed arrival paving: ground-only accents below mapped
      // roads and route strips, with no changes to geometry or navigation.
      const court = createSurfaceMaterial('paving', 0xd7d0bb);
      for (const polygon of [
        [[-8, -202], [36, -202], [36, -165], [-8, -165]],
        [[-63.5, -42], [-56, -42], [-56, -18], [-63.5, -18]],
        [[-99, -18], [-56, -18], [-56, -1.2], [-99, -1.2]],
        [[52, -62], [80, -62], [80, -32], [52, -32]],
      ] as Point2[][]) {
        const surface = addSurface(world, polygon, .05, court);
        if (surface) { surface.receiveShadow = true; surface.userData.photoIgnore = true; }
      }
      // Low designed planters are set away from all graph routes and sampled
      // building footprints. They are ankle-height, non-blocking scenery, not
      // mapped planting or collision substitutes for existing solid objects.
      const sites: Point2[] = [[-4, -190], [-62, -30], [-94, -8], [-63, -8], [58, -48]];
      const safeSites = sites.filter(([x, z]) => clearsRoutes(x, z, 5) &&
        [[x, z], [x - 1.5, z - 1], [x + 1.5, z + 1], [x - 1.5, z + 1], [x + 1.5, z - 1]].every(([sx, sz]) => inside(sx, sz, boundary) && !buildings.some(f => inside(sx, sz, f.polygon))));
      if (safeSites.length) {
        const edges = new THREE.InstancedMesh(new THREE.BoxGeometry(2.8, .16, 1.3), material(0xeee2d0), safeSites.length);
        const soil = new THREE.InstancedMesh(new THREE.BoxGeometry(2.5, .04, 1.0), material(0x756956), safeSites.length);
        const shrubs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), material(0x86a182), safeSites.length * 5);
        safeSites.forEach(([x, z], i) => {
          dummy.rotation.set(0, 0, 0); dummy.position.set(x, .13, z); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); edges.setMatrixAt(i, dummy.matrix);
          dummy.position.y = .23; dummy.updateMatrix(); soil.setMatrixAt(i, dummy.matrix);
          for (let j = 0; j < 5; j++) {
            dummy.position.set(x - .95 + j * .47, .28, z + (j % 2 ? .17 : -.17)); dummy.scale.set(.26, .13, .25); dummy.updateMatrix(); shrubs.setMatrixAt(i * 5 + j, dummy.matrix);
          }
        });
        for (const mesh of [edges, soil, shrubs]) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.receiveShadow = true; mesh.userData.photoIgnore = true; world.add(mesh); }
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
      const crownGeometries = new Map<number, THREE.BufferGeometry>();
      const trunkMaterial = material(0x79765e), crownMaterial = new THREE.MeshStandardMaterial({ color: 0x839f7f, roughness: 1, vertexColors: true, side: THREE.DoubleSide });
      for (const indices of chunks.values()) {
        const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, indices.length);
        indices.forEach((i, local) => {
          const [x, z] = treePositions[i];
          dummy.position.set(x, 1.9, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); trunks.setMatrixAt(local, dummy.matrix);
        });
        trunks.instanceMatrix.needsUpdate = true; trunks.computeBoundingSphere(); trunks.castShadow = true; world.add(trunks);
        for (const variant of [0, 1] as const) {
          const group = indices.filter(i => getFoliageVariation(...treePositions[i]).variant === variant);
          if (!group.length) continue;
          let geometry = crownGeometries.get(variant);
          if (!geometry) { geometry = createFoliageGeometry(variant); crownGeometries.set(variant, geometry); }
          const crowns = new THREE.InstancedMesh(geometry, crownMaterial, group.length);
          group.forEach((i, local) => {
            const [x, z] = treePositions[i], variation = getFoliageVariation(x, z);
            // Preserve each existing tree's scale and height; only its bounded silhouette and subtle tint vary.
            dummy.position.set(x, 4.6 + (i % 3) * .22, z); dummy.rotation.set(0, variation.yaw, 0);
            dummy.scale.set(2.1 + (i % 3) * .15, 2.4, 2.0 + (i % 2) * .25); dummy.updateMatrix(); crowns.setMatrixAt(local, dummy.matrix);
            crowns.setColorAt(local, new THREE.Color().setScalar(variation.colorScale));
          });
          crowns.instanceMatrix.needsUpdate = true;
          if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
          crowns.computeBoundingSphere(); crowns.castShadow = true; world.add(crowns);
        }
      }
      for (const [x, z] of treePositions) {
        const trunkCollider = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, 3.8, 6), new THREE.MeshBasicMaterial());
        trunkCollider.position.set(x, 1.9, z); collisionProps.add(trunkCollider);
      }
    }

    // Designed human-scale rest points, placed beside existing routes rather
    // than changing mapped geometry. Conservative clearance keeps the route
    // and known building footprints free; their collision proxies match seats.
    const benchSites: { x: number; z: number; angle: number }[] = [];
    for (const path of gamePaths) for (let i = 1; i < path.points.length && benchSites.length < 14; i++) {
      const a = path.points[i - 1], b = path.points[i];
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 12) continue;
      const x = (a[0] + b[0]) / 2 - dz / length * 3.4;
      const z = (a[1] + b[1]) / 2 + dx / length * 3.4;
      const samples: Point2[] = [[x, z], [x + 2, z], [x - 2, z], [x, z + 2], [x, z - 2]];
      const gardenConflict = data.id === 'yingxi' && ((x >= QINGZE_DECORATION_BOUNDS.minX && x <= QINGZE_DECORATION_BOUNDS.maxX && z >= QINGZE_DECORATION_BOUNDS.minZ && z <= QINGZE_DECORATION_BOUNDS.maxZ) || (x >= -8 && x <= 8 && z >= 174 && z <= 190));
      if (gardenConflict || !clearsRoutes(x, z, 2.8) || !samples.every(([sx, sz]) => inside(sx, sz, boundary) && !buildings.some(f => inside(sx, sz, f.polygon))) || benchSites.some(site => Math.hypot(site.x - x, site.z - z) < 18) || treePositions.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 3)) continue;
      benchSites.push({ x, z, angle: Math.atan2(-dz, dx) });
    }
    if (benchSites.length) {
      const wood = material(0x95704d), metal = material(0x405e57);
      const seat = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, .12, .48), wood, benchSites.length);
      const back = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, .42, .10), wood, benchSites.length);
      const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .5, .42), metal, benchSites.length * 2);
      benchSites.forEach(({ x, z, angle }, i) => {
        const place = (mesh: THREE.InstancedMesh, index: number, localX: number, y: number, localZ: number): void => {
          dummy.position.set(x + localX * Math.cos(angle) + localZ * Math.sin(angle), y, z - localX * Math.sin(angle) + localZ * Math.cos(angle));
          dummy.rotation.set(0, angle, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
        };
        place(seat, i, 0, .53, 0); place(back, i, 0, .84, -.2);
        place(legs, i * 2, -.65, .25, 0); place(legs, i * 2 + 1, .65, .25, 0);
        const proxy = new THREE.Mesh(new THREE.BoxGeometry(1.8, .9, .5), new THREE.MeshBasicMaterial());
        proxy.position.set(x, .45, z); proxy.rotation.y = angle; collisionProps.add(proxy);
      });
      for (const mesh of [seat, back, legs]) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.castShadow = true; mesh.receiveShadow = true; world.add(mesh); }
    }

    if (data.id === 'huyu') {
      // Exact point-to-edge clearance for the whole footprint disk, not only
      // centre-point containment; route buffer includes player walking room.
      const edgeDistance = (x: number, z: number, polygon: Point2[]): number => {
        let nearest = Infinity;
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i], b = polygon[(i + 1) % polygon.length];
          const dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
          const t = length2 ? THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / length2, 0, 1) : 0;
          nearest = Math.min(nearest, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
        }
        return nearest;
      };
      const garden = createHuyuCourtyards((x, z, radius) =>
        inside(x, z, boundary) && edgeDistance(x, z, boundary) >= radius &&
        clearsRoutes(x, z, radius + 2) &&
        buildings.every(feature => !inside(x, z, feature.polygon) && edgeDistance(x, z, feature.polygon) >= radius));
      courtyard = garden;
      canvas.dataset.huyuTreeCount = String(garden.visual.userData.treeCount);
      canvas.dataset.huyuTreeTexture = String(garden.visual.userData.treeTextureStatus);
      world.add(garden.visual);
      collisionProps.add(garden.colliders);
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
      platform = createOriginalViewingPlatform(); world.add(platform.visual); collisionProps.add(platform.colliders);
      const vector = (p: readonly number[]) => ({x:p[0],y:p[1],z:p[2]});
      planeConfig = {
        id:PAPERPLANE_COURSE.id,
        launch:{position:vector(PAPERPLANE_STATION.release),heading:PAPERPLANE_STATION.heading,pitch:0},
        gates:PAPERPLANE_COURSE.gates.map(gate => ({center:vector(gate.center),normal:vector(gate.normal),radius:gate.radius})),
        landing:{center:vector(PAPERPLANE_COURSE.landing.center),radius:PAPERPLANE_COURSE.landing.radius},
        bounds:{min:vector(PAPERPLANE_COURSE.bounds.min),max:vector(PAPERPLANE_COURSE.bounds.max)},
        groundY:PAPERPLANE_COURSE.groundY,speed:2.2,sinkRate:.055,liftRate:.6,turnRate:.45,pitchRate:.18,minPitch:-.25,maxPitch:.25,maxDuration:30,
      };
      planeStation = {position:[PAPERPLANE_STATION.standing[0],PAPERPLANE_STATION.standing[2]],radius:PAPERPLANE_STATION.interactionRadius,heightRange:PAPERPLANE_STATION.heightRange};
      canvas.dataset.viewingPlatform = JSON.stringify({status:'graybox',deckTop:VIEWING_PLATFORM.deckTop,photo:VIEWING_PLATFORM.photo.position});
      canvas.dataset.paperplaneStation = 'loading';
    }
    // Retain private CPU proxy geometry, never borrowed model/platform resources.
    baseCollisionProps = collisionProps.clone(true);
    const proxyMaterial = new THREE.MeshBasicMaterial();
    baseCollisionProps.traverse(object => {
      if (object instanceof THREE.Mesh) { object.geometry = object.geometry.clone(); object.material = proxyMaterial; }
    });
    player.setCampus(data, collisionProps);
    baseCollisionSnapshot = player.getCollisionSnapshot();
    canvas.dataset.collisionGeneration = String(++collisionGeneration);
    canvas.dataset.worldGeneration = String(campusGeneration);
    platform?.colliders.removeFromParent(); // Handle owns these resources.
    disposeObject(collisionProps);
    world.add(pawn, player.shadow);
    renderer.shadowMap.needsUpdate = true;
    updateHighlights();
    const ownerWorld = world;
    if (platform) {
      const platformOwner = platform;
      void import('three/examples/jsm/loaders/GLTFLoader.js').then(({GLTFLoader}) => new GLTFLoader().loadAsync(PAPERPLANE_STATION.assetUrl)).then(gltf => {
        if (disposed || generation !== campusGeneration || ownerWorld !== world || platform !== platformOwner) { disposeObject(gltf.scene); return; }
        gltf.scene.position.set(...PAPERPLANE_STATION.position); gltf.scene.rotation.y = PAPERPLANE_STATION.rotationY;
        gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true; });
        platformOwner.stationVisual.visible = false; ownerWorld.add(gltf.scene); gltf.scene.updateMatrixWorld(true);
        renderer.shadowMap.needsUpdate = true; canvas.dataset.paperplaneStation = 'ready';
      }).catch(() => {
        if (disposed || generation !== campusGeneration || platform !== platformOwner) return;
        canvas.dataset.paperplaneStation = 'fallback';
        onEvent({type:'modelstatus',id:'paperplane-station',name:'原创纸飞机桌',status:'fallback'});
      });
    }
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
              instance.frame.setMatrixAt(instance.index, hidden); instance.frame.instanceMatrix.needsUpdate = true;
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
        applyLandmarkShadowStyle(model, config.landmarkId);
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
    if (plane) return;
    mapMode = true; labels.domElement.style.display = ''; syncMarkerVisibility();
    canvas.dataset.mapMarkers = '[]'; // Populated from the next rendered map frame.
    controls.enabled = true; player.setEnabled(false); updateSun(true); canvas.dataset.view = 'map';
  }
  function showPlayer(): void {
    if (plane) return;
    mapMode = false; labels.domElement.style.display = 'none'; syncMarkerVisibility();
    delete canvas.dataset.mapMarkers;
    controls.enabled = false; player.setEnabled(true); player.updateCamera(true); updateSun(false, true); canvas.dataset.view = 'player';
  }
  function overview(): void {
    if (plane) return;
    showMap();
    const points = cleanPolygon(data.boundary || []);
    const [x0, z0, x1, z1] = boundsOf(points.length ? points : data.features.flatMap((f) => f.polygon));
    animateView(new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), Math.max(500, (x1 - x0) * 1.2, (z1 - z0) * 1.2));
  }
  function focusLandmark(id: string): void {
    if (plane) return;
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
    if (plane) return false;
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
    const nextRatio = referenceQuality ? 1 : slowFrames >= 3 ? Math.max(.5, renderRatio * .75)
      : fastFrames >= 180 ? Math.min(maxRatio, renderRatio / .75) : renderRatio;
    if (nextRatio !== renderRatio) {
      renderRatio = nextRatio; renderer.setPixelRatio(renderRatio);
      const shadowType = renderRatio <= .75 ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
      if (renderer.shadowMap.type !== shadowType) { renderer.shadowMap.type = shadowType; renderer.shadowMap.needsUpdate = true; }
      renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight), false);
      slowFrames = fastFrames = 0;
    }
    canvas.dataset.renderRatio = renderRatio.toFixed(2);
    canvas.dataset.renderQuality = referenceQuality ? 'reference' : 'adaptive';
    canvas.dataset.shadowType = String(renderer.shadowMap.type);
    if (tween) {
      tween.elapsed += dt;
      const t = Math.min(1, tween.elapsed / tween.duration), eased = t * t * (3 - 2 * t);
      camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      frameSpan = THREE.MathUtils.lerp(tween.fromSpan, tween.toSpan, eased);
      refreshFrustum();
      if (t >= 1) tween = null;
    }
    if (plane) plane.update(dt); else player.advance();
    if (!mapMode) updateSun(false);
    if (travel && !plane) {
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
    const activeCamera = plane?.camera ?? (mapMode ? camera : player.camera);
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
    // Readiness denotes a rendered frame whose player coordinates and yaw
    // belong to the current campus, not merely synchronous world assembly.
    if (canvas.dataset.playerX !== undefined && canvas.dataset.cameraYaw !== undefined) canvas.dataset.campusReady = data.id;
    if (courtyard) canvas.dataset.huyuTreeTexture = String(courtyard.visual.userData.treeTextureStatus);
    canvas.dataset.frame = String(++frameCount);
    canvas.dataset.drawCalls = String(renderer.info.render.calls);
    canvas.dataset.triangles = String(renderer.info.render.triangles);
    canvas.dataset.geometries = String(renderer.info.memory.geometries);
    canvas.dataset.textures = String(renderer.info.memory.textures);
    raf = requestAnimationFrame(tick);
  }
  function canBeginPaperplane(): boolean {
    return !disposed && !paused && !plane && !mapMode && data.id === 'yingxi' && !!planeConfig && !!planeStation
      && Math.hypot(pawn.position.x-planeStation.position[0],pawn.position.z-planeStation.position[1]) <= planeStation.radius
      && isPhotoHeightEligible(pawn.position.y,planeStation.heightRange);
  }
  function beginPaperplane(): boolean {
    if (!canBeginPaperplane() || !planeConfig) return false;
    // Disable/clear input before snapshot. The capsule, yaw and pitch remain
    // untouched until exit; setPosition would incorrectly discard elevated Y.
    player.setEnabled(false); controls.enabled = false; tween = null; pointer = null;
    try {
      plane = new PaperplaneActivity(planeConfig,player,(snapshot,pose) => {
        canvas.dataset.paperplane = JSON.stringify(snapshot);
        canvas.dataset.paperplanePose = JSON.stringify(pose);
        onEvent({type:'paperplane',snapshot});
      });
      plane.resize(container.clientWidth,container.clientHeight); scene.add(plane.root);
      canvas.dataset.view = 'paperplane'; previousTime = 0;
      return true;
    } catch {
      plane?.dispose(); plane = null; showPlayer();
      onEvent({type:'paperplane',snapshot:null}); return false;
    }
  }
  function endPaperplane(): void {
    if (!plane) return;
    plane.dispose(); plane = null; previousTime = 0;
    delete canvas.dataset.paperplane; delete canvas.dataset.paperplanePose;
    if (!disposed) showPlayer();
    onEvent({type:'paperplane',snapshot:null});
  }
  function inspectPhoto(point: PhotoPoint): PhotoInspection {
    const distance = validPoint(point.position) ? Math.hypot(pawn.position.x - point.position[0], pawn.position.z - point.position[1]) : Infinity;
    const result: PhotoInspection = { settling: !player.cameraSettled, distance, inRange: Number.isFinite(point.radius) && point.radius > 0 && distance <= point.radius && isPhotoHeightEligible(pawn.position.y, point.heightRange), framed: false, obstructed: false };
    if (disposed || paused || plane || mapMode || !validPoint(point.position) || !Array.isArray(point.target) || point.target.length !== 3 || !point.target.every(Number.isFinite) || !Number.isFinite(point.radius) || point.radius <= 0 || !result.inRange) return result;
    if (result.settling) return result;
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
    if (disposed || paused || plane || mapMode || !player.cameraSettled) return null;
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

  function inspectIdealActivity(): IdealActivityInspection | null {
    if (disposed || campusMode !== 'ideal' || !idealLayer || paused || plane || mapMode || travel || tween) return null;
    const point = IDEAL_ACTIVITY_POINTS[data.id];
    const [tx, ty, tz] = point.target;
    const foot = player.avatar.position;
    const distance = Math.hypot(foot.x - tx, foot.z - tz);
    const [minX, minZ, maxX, maxZ] = IDEAL_FACILITIES[data.id].bounds;
    const withinFacility = foot.x >= minX && foot.x <= maxX && foot.z >= minZ && foot.z <= maxZ;
    let obstructed = false;
    if (distance <= 2.4 && withinFacility && player.onSharedGround) {
      // Ray from the player's eye to a point above the physical table, not through it.
      const from = new THREE.Vector3(foot.x, foot.y + 1.5, foot.z);
      const objects = world.children.filter(object => object !== pawn && object !== player.shadow);
      obstructed = !hasIdealActivityLineOfSight(from, new THREE.Vector3(tx, ty, tz), objects, raycaster);
    }
    const status = idealActivityEligibility({ free: true, grounded: player.onSharedGround, withinFacility, distance, obstructed });
    const dx = tx - foot.x, dz = tz - foot.z;
    const direction = Math.abs(dx) > Math.abs(dz) * 2 ? (dx > 0 ? '东侧' : '西侧')
      : Math.abs(dz) > Math.abs(dx) * 2 ? (dz > 0 ? '南侧' : '北侧')
      : `${dx > 0 ? '东' : '西'}${dz > 0 ? '南' : '北'}侧`;
    return { id: point.id, kind: point.kind, label: point.label, distance, direction, ...status };
  }

  function getModeSwitchStatus(): CampusModeSwitchStatus {
    if (disposed) return { allowed: false, reason: '三维场景不可用，无法切换设施。' };
    if (paused || plane || mapMode || travel || tween) return { allowed: false, reason: '请先退出当前活动或地图，回到自由步行后切换。' };
    if (!player.onSharedGround) return { allowed: false, reason: '请先走下台阶并在共有地面站稳，再切换校园模式。' };
    const [minX, minZ, maxX, maxZ] = IDEAL_FACILITIES[data.id].bounds;
    const { x, z } = player.avatar.position;
    if (x >= minX - 1 && x <= maxX + 1 && z >= minZ - 1 && z <= maxZ + 1)
      return { allowed: false, reason: '请先走出原创设施，回到入口旁共有地面后切换；不会自动移动角色。' };
    return { allowed: true, reason: '' };
  }
  function requestCampusMode(nextMode: CampusMode): CampusModeSwitchResult {
    if (nextMode !== 'base' && nextMode !== 'ideal') return { applied: false, mode: campusMode, reason: '未知校园模式。' };
    if (nextMode === campusMode) return { applied: true, mode: campusMode, reason: '' };
    const status = getModeSwitchStatus();
    if (!status.allowed) return { applied: false, mode: campusMode, reason: status.reason };
    if (!baseCollisionProps || !baseCollisionSnapshot) return { applied: false, mode: campusMode, reason: '场景尚未准备好，请稍后再试。' };
    let prepared: ReturnType<typeof createIdealCampusLayer> | null = null;
    try {
      let target = baseCollisionSnapshot;
      if (nextMode === 'ideal') {
        prepared = createIdealCampusLayer(data.id);
        const combined = new THREE.Group();
        combined.add(baseCollisionProps.clone(true), prepared.colliders.clone(true));
        target = player.prepareCollision(data, combined);
        combined.clear(); // Borrowed geometry, not recursively disposed.
      }
      if (!player.canCommitCollision(target)) {
        prepared?.dispose();
        return { applied: false, mode: campusMode, reason: '当前位置与目标设施重叠或没有稳定地面，请走到入口旁的空地再试。' };
      }
      const previousMeshes = new Set<THREE.Object3D>();
      idealLayer?.visual.traverse(object => { if (object instanceof THREE.Mesh) previousMeshes.add(object); });
      const nextPickables = pickables.filter(object => !previousMeshes.has(object));
      prepared?.visual.traverse(object => { if (object instanceof THREE.Mesh) nextPickables.push(object); });
      const transaction = commitCampusModeLayer(world, player, target, idealLayer, prepared);
      if (!transaction.applied) return { applied: false, mode: campusMode, reason: '设施切换失败，已保留原校园模式和人物位置。' + (transaction.cleanupWarning ? ' 候选资源释放出现问题，建议刷新页面。' : '') };
      pickables = nextPickables; idealLayer = prepared; campusMode = nextMode;
      renderer.shadowMap.needsUpdate = true;
      canvas.dataset.campusMode = campusMode;
      canvas.dataset.collisionGeneration = String(++collisionGeneration);
      previousTime = 0;
      const direction = data.id === 'huyu'
        ? '新增书庭位于梅花教室东北侧，东侧入口接现有地面路。'
        : '新增柱廊在观景台和地面折叠站以东，可从南北两端进入。';
      const description = campusMode === 'ideal'
        ? `${IDEAL_FACILITIES[data.id].label}仅是局部原创空间，并非校园实景。${direction}`
        : '已回到基础校园，旅程与人物位置保留。';
      return { applied: true, mode: campusMode, reason: description + (transaction.cleanupWarning ? ' 旧资源释放出现问题，建议刷新页面。' : '') };
    } catch {
      try { prepared?.dispose(); } catch { /* Retain the old mode despite failed candidate cleanup. */ }
      return { applied: false, mode: campusMode, reason: '设施准备失败，已保留原校园模式，请稍后重试。' };
    }
  }

  function dispose(): void {
    if (disposed) return;
    endPaperplane();
    idealLayer?.dispose(); idealLayer = null;
    if (baseCollisionProps) disposeObject(baseCollisionProps);
    baseCollisionProps = null; baseCollisionSnapshot = null;
    disposed = true;
    delete canvas.dataset.campusReady;
    delete canvas.dataset.huyuTreeTexture; delete canvas.dataset.huyuTreeCount;
    courtyard?.dispose(); courtyard = null;
    platform?.dispose(); platform = null;
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
    inspectIdealActivity,
    getCampusMode: () => campusMode, getModeSwitchStatus, requestCampusMode,
    setCampus(next) {
      if (disposed) return;
      try { data = next; state = { selectedId: null, targetId: null }; buildCampus(); questView(true); showPlayer(); labels.render(scene, player.camera); }
      catch (error) { dispose(); onEvent({ type: 'error', reason: `Unable to build the 3D scene: ${error instanceof Error ? error.message : 'unknown error'}` }); }
    },
    canBeginPaperplane, beginPaperplane,
    setPaperplaneInput(input) { plane?.input(input); },
    launchPaperplane() { plane?.launch(); },
    retryPaperplane() { plane?.retry(); previousTime = 0; },
    pausePaperplane() { plane?.pause(); previousTime = 0; },
    resumePaperplane() { plane?.resume(); previousTime = 0; },
    endPaperplane,
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
      plane?.pause();
      paused = true; controls.enabled = false; player.setPaused(true); previousTime = 0;
      cancelAnimationFrame(raf); canvas.dataset.paused = 'true';
    },
    resume() {
      if (disposed || !paused) return;
      paused = false; controls.enabled = mapMode && !plane; player.setPaused(false); previousTime = 0;
      canvas.dataset.paused = 'false'; raf = requestAnimationFrame(tick);
    },
    dispose,
  };
}
