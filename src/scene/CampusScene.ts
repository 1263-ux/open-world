import {
  ACESFilmicToneMapping,
  AmbientLight,
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFSoftShadowMap,
  Raycaster,
  RingGeometry,
  Scene,
  Shape,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type {
  CampusData,
  CampusSceneHandle,
  Landmark,
  SceneEvent,
  SceneState,
} from '../shared/contracts';

const DEFAULT_POSITION = new Vector3(48, 52, 58);
const VIEW_SPAN = 86;

function disposeGroup(group: Group): void {
  const geometries = new Set<{ dispose(): void }>();
  const materials = new Set<{ dispose(): void }>();
  group.traverse((object) => {
    if (object instanceof Mesh) {
      geometries.add(object.geometry);
      const entries = Array.isArray(object.material) ? object.material : [object.material];
      entries.forEach((material) => materials.add(material));
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  group.clear();
}

function material(color: string): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: 0.88 });
}

function box(
  parent: Group,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  surface: MeshStandardMaterial,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), surface);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function roundedIsland(): ExtrudeGeometry {
  const half = 36;
  const radius = 5;
  const shape = new Shape();
  shape.moveTo(-half + radius, -half);
  shape.lineTo(half - radius, -half);
  shape.quadraticCurveTo(half, -half, half, -half + radius);
  shape.lineTo(half, half - radius);
  shape.quadraticCurveTo(half, half, half - radius, half);
  shape.lineTo(-half + radius, half);
  shape.quadraticCurveTo(-half, half, -half, half - radius);
  shape.lineTo(-half, -half + radius);
  shape.quadraticCurveTo(-half, -half, -half + radius, -half);
  return new ExtrudeGeometry(shape, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.3,
    bevelSize: 0.3,
    bevelSegments: 3,
    curveSegments: 8,
  });
}

function addTree(parent: Group, x: number, z: number, scale: number, trunk: MeshStandardMaterial, foliage: MeshStandardMaterial): void {
  const tree = new Group();
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);
  const stem = new Mesh(new CylinderGeometry(0.18, 0.24, 1.5, 7), trunk);
  stem.position.y = 0.75;
  stem.castShadow = true;
  tree.add(stem);
  const crown = new Mesh(new ConeGeometry(1.15, 2.4, 8), foliage);
  crown.position.y = 2.35;
  crown.castShadow = true;
  tree.add(crown);
  parent.add(tree);
}

function addRoof(parent: Group, width: number, depth: number, height: number, roof: MeshStandardMaterial): void {
  const halfDepth = depth / 2 + 0.45;
  const rise = 0.8;
  const length = Math.hypot(halfDepth, rise);
  const angle = Math.atan2(rise, halfDepth);
  for (const side of [-1, 1]) {
    const slab = box(parent, width + 0.9, 0.22, length, 0, height + 0.22 + rise / 2, side * halfDepth / 2, roof);
    slab.rotation.x = side * angle;
  }
  box(parent, width + 0.95, 0.22, 0.3, 0, height + rise + 0.23, 0, roof);
}

function addWindows(parent: Group, width: number, height: number, depth: number, rows: number, glass: MeshStandardMaterial, trim: MeshStandardMaterial): void {
  const columns = Math.max(3, Math.floor(width / 1.8));
  const spacing = width / (columns + 1);
  for (let row = 0; row < rows; row += 1) {
    const y = 1.25 + (height - 2) * (row + 0.5) / rows;
    for (let column = 1; column <= columns; column += 1) {
      const x = -width / 2 + spacing * column;
      for (const side of [-1, 1]) {
        box(parent, 0.72, 0.95, 0.08, x, y, side * (depth / 2 + 0.035), glass);
        box(parent, 0.82, 0.09, 0.13, x, y - 0.52, side * (depth / 2 + 0.06), trim);
      }
    }
  }
}

function makeLandmark(landmark: Landmark, roof: MeshStandardMaterial, glass: MeshStandardMaterial, trim: MeshStandardMaterial, trunk: MeshStandardMaterial, foliage: MeshStandardMaterial): Group {
  const group = new Group();
  const [width, height, depth] = landmark.size;
  group.position.set(landmark.position[0], 0, landmark.position[1]);
  const wall = material(landmark.color);

  if (landmark.shape === 'gate') {
    const pierWidth = 1.5;
    for (const side of [-1, 1]) {
      box(group, pierWidth, height, depth, side * (width / 2 - pierWidth / 2), height / 2, 0, wall);
      box(group, pierWidth + 0.3, 0.25, depth + 0.3, side * (width / 2 - pierWidth / 2), 0.13, 0, trim);
    }
    box(group, width, 1.1, depth, 0, height - 0.55, 0, wall);
    box(group, width * 0.48, 0.4, 0.1, 0, height - 0.55, depth / 2 + 0.06, trim);
    addRoof(group, width, depth, height, roof);
  } else if (landmark.shape === 'garden') {
    box(group, width, 0.18, depth, 0, 0.09, 0, wall);
    box(group, width - 0.8, 0.06, 1.15, 0, 0.22, 0, trim);
    box(group, 1.15, 0.06, depth - 0.8, 0, 0.22, 0, trim);
    for (const x of [-width * 0.3, width * 0.3]) {
      for (const z of [-depth * 0.3, depth * 0.3]) {
        addTree(group, x, z, 0.8, trunk, foliage);
      }
    }
    const pond = new Mesh(new CircleGeometry(1.1, 24), glass);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(0, 0.26, 0);
    pond.receiveShadow = true;
    group.add(pond);
  } else {
    box(group, width + 0.4, 0.3, depth + 0.4, 0, 0.15, 0, trim);
    box(group, width, height, depth, 0, height / 2 + 0.3, 0, wall);
    addWindows(group, width, height, depth, landmark.shape === 'library' ? 3 : 2, glass, trim);
    if (landmark.shape === 'library') {
      box(group, width * 0.48, height * 0.62, 1.1, 0, height * 0.31 + 0.3, depth / 2 + 0.5, trim);
      for (const x of [-width * 0.16, 0, width * 0.16]) {
        box(group, 0.3, height * 0.48, 0.3, x, height * 0.24 + 0.3, depth / 2 + 1.1, wall);
      }
      box(group, width * 0.52, 0.25, 1.5, 0, height * 0.62 + 0.3, depth / 2 + 0.5, roof);
    } else if (landmark.shape === 'office') {
      box(group, width * 0.4, 0.35, 1.5, 0, 2.8, depth / 2 + 0.6, roof);
      for (const x of [-width * 0.15, width * 0.15]) {
        box(group, 0.3, 2.5, 0.3, x, 1.55, depth / 2 + 1.15, trim);
      }
    } else {
      box(group, width * 0.3, 0.35, 1.2, 0, 2.5, depth / 2 + 0.45, roof);
    }
    addRoof(group, width, depth, height + 0.3, roof);
  }
  group.traverse((object) => {
    if (object instanceof Mesh) object.userData.landmarkId = landmark.id;
  });
  return group;
}

function addPath(parent: Group, start: [number, number], end: [number, number], surface: MeshStandardMaterial): void {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const path = box(parent, 1.5, 0.05, Math.hypot(dx, dz), (start[0] + end[0]) / 2, 0.035, (start[1] + end[1]) / 2, surface);
  path.rotation.y = Math.atan2(dx, dz);
  path.castShadow = false;
}

function distanceToSegment(x: number, z: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared === 0 ? 0 : MathUtils.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / lengthSquared, 0, 1);
  return Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz));
}

function noOpHandle(): CampusSceneHandle {
  return { setCampus: () => {}, setState: () => {}, resetView: () => {}, dispose: () => {} };
}

export function createCampusScene(container: HTMLElement, data: CampusData, onEvent: (event: SceneEvent) => void): CampusSceneHandle {
  let renderer: WebGLRenderer | undefined;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: false });
  } catch {
    onEvent({ type: 'error', reason: '无法初始化 WebGL，仍可使用地标列表探索。' });
    return noOpHandle();
  }

  const activeRenderer = renderer;
  let controls: OrbitControls | undefined;
  let observer: ResizeObserver | undefined;
  let frame = 0;
  let disposed = false;
  let campusGroup: Group | undefined;
  let scene: Scene | undefined;
  let sun: DirectionalLight | undefined;
  let removeListeners: (() => void) | undefined;

  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    removeListeners?.();
    controls?.dispose();
    if (campusGroup) {
      scene?.remove(campusGroup);
      disposeGroup(campusGroup);
      campusGroup = undefined;
    }
    sun?.shadow.dispose();
    activeRenderer.dispose();
    activeRenderer.domElement.remove();
  };

  try {
    activeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    activeRenderer.shadowMap.enabled = true;
    activeRenderer.shadowMap.type = PCFSoftShadowMap;
    activeRenderer.outputColorSpace = SRGBColorSpace;
    activeRenderer.toneMapping = ACESFilmicToneMapping;
    activeRenderer.toneMappingExposure = 1.08;
    const canvas = activeRenderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '校园印象示意模型，可拖动旋转、缩放并点击地标；非精确建模或导航。');
    canvas.dataset.testid = 'campus-canvas';
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    scene = new Scene();
    scene.background = new Color('#f5efe4');
    const camera = new OrthographicCamera(-43, 43, 43, -43, 0.1, 250);
    camera.position.copy(DEFAULT_POSITION);
    camera.lookAt(0, 0, 0);
    controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minZoom = 0.65;
    controls.maxZoom = 3;
    controls.minPolarAngle = 0.01;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.screenSpacePanning = true;
    controls.update();

    scene.add(new AmbientLight('#fff3e3', 0.75));
    scene.add(new HemisphereLight('#fff8ec', '#9aab89', 1.25));
    sun = new DirectionalLight('#fff2dd', 2.1);
    sun.position.set(-28, 55, 35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -48;
    sun.shadow.camera.right = 48;
    sun.shadow.camera.top = 48;
    sun.shadow.camera.bottom = -48;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 150;
    sun.shadow.normalBias = 0.04;
    scene.add(sun);

    const activeScene = scene;
    const activeControls = controls;
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const landmarks = new Map<string, Group>();
    const markers = new Map<string, { selected: Mesh; target: Mesh }>();
    let currentState: SceneState = { selectedId: null, targetId: null };

    const applyState = (): void => {
      markers.forEach((marker, id) => {
        marker.selected.visible = currentState.selectedId === id;
        marker.target.visible = currentState.targetId === id;
      });
    };

    const buildCampus = (campus: CampusData): void => {
      if (campusGroup) {
        activeScene.remove(campusGroup);
        disposeGroup(campusGroup);
      }
      landmarks.clear();
      markers.clear();
      const root = new Group();
      campusGroup = root;
      activeScene.add(root);
      const island = new Mesh(roundedIsland(), material('#e7dbbe'));
      island.rotation.x = -Math.PI / 2;
      island.position.y = -1.3;
      island.receiveShadow = true;
      root.add(island);
      const pathMaterial = material('#d0bea0');
      const roof = material('#ad624e');
      const trim = material('#f0dfc4');
      const glass = material('#78939a');
      const trunk = material('#81634c');
      const foliage = material('#79916a');
      const selectedMaterial = material('#b85c43');
      const targetMaterial = material('#e0aa48');
      const points = campus.questOrder
        .map((id) => campus.landmarks.find((item) => item.id === id))
        .filter((item): item is Landmark => item !== undefined)
        .map((item) => item.position);
      for (let index = 1; index < points.length; index += 1) {
        addPath(root, points[index - 1], points[index], pathMaterial);
      }
      campus.landmarks.forEach((item) => {
        const building = makeLandmark(item, roof, glass, trim, trunk, foliage);
        landmarks.set(item.id, building);
        root.add(building);
        const radius = Math.hypot(item.size[0], item.size[2]) / 2 + 0.8;
        const selected = new Mesh(new RingGeometry(radius, radius + 0.28, 64), selectedMaterial);
        const target = new Mesh(new RingGeometry(radius + 0.38, radius + 0.57, 64), targetMaterial);
        for (const marker of [selected, target]) {
          marker.rotation.x = -Math.PI / 2;
          marker.position.set(item.position[0], 0.08, item.position[1]);
          marker.visible = false;
          root.add(marker);
        }
        markers.set(item.id, { selected, target });
      });
      let seed = campus.id === 'huyu' ? 413 : 719;
      const random = (): number => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const treePositions: Array<[number, number]> = [];
      for (let attempt = 0; attempt < 250 && treePositions.length < 36; attempt += 1) {
        const x = (random() - 0.5) * 65;
        const z = (random() - 0.5) * 65;
        const nearBuilding = campus.landmarks.some((item) =>
          Math.abs(x - item.position[0]) < item.size[0] / 2 + 3 &&
          Math.abs(z - item.position[1]) < item.size[2] / 2 + 3,
        );
        const nearPath = points.slice(1).some((point, index) => distanceToSegment(x, z, points[index], point) < 2.3);
        const nearTree = treePositions.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 2.5);
        if (nearBuilding || nearPath || nearTree) continue;
        treePositions.push([x, z]);
        addTree(root, x, z, 0.7 + random() * 0.45, trunk, foliage);
      }
      applyState();
    };

    const resize = (): void => {
      if (disposed) return;
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const aspect = width / height;
      const span = aspect < 1 ? 110 : VIEW_SPAN;
      const halfWidth = span * Math.max(1, aspect) / 2;
      const halfHeight = span * Math.max(1, 1 / aspect) / 2;
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      activeRenderer.setSize(width, height, false);
    };

    let gesture: { id: number; x: number; y: number; moved: boolean } | null = null;
    const onPointerDown = (event: PointerEvent): void => {
      if (gesture) {
        gesture.moved = true;
        return;
      }
      if (event.button === 0 && event.isPrimary) {
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      }
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (gesture && gesture.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6) {
        gesture.moved = true;
      }
    };
    const onPointerUp = (event: PointerEvent): void => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const select = !gesture.moved && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) <= 6;
      gesture = null;
      if (!select || disposed) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(Array.from(landmarks.values()), true)[0];
      const id: unknown = hit?.object.userData.landmarkId;
      if (typeof id === 'string' && landmarks.has(id)) onEvent({ type: 'select', id });
    };
    const onPointerCancel = (): void => { gesture = null; };
    const onContextLost = (event: Event): void => {
      event.preventDefault();
      cleanup();
      onEvent({ type: 'error', reason: '图形上下文中断，请刷新恢复三维场景；地标列表仍可使用。' });
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('resize', resize);
    removeListeners = () => {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('resize', resize);
    };
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(resize);
      observer.observe(container);
    }
    buildCampus(data);
    resize();
    const animate = (): void => {
      if (disposed) return;
      activeControls.update();
      activeRenderer.render(activeScene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return {
      setCampus(campus: CampusData): void {
        if (!disposed) buildCampus(campus);
      },
      setState(state: SceneState): void {
        if (disposed) return;
        currentState = { selectedId: state.selectedId, targetId: state.targetId };
        applyState();
      },
      resetView(): void {
        if (disposed) return;
        camera.position.copy(DEFAULT_POSITION);
        camera.zoom = 1;
        camera.updateProjectionMatrix();
        activeControls.target.set(0, 0, 0);
        activeControls.update();
      },
      dispose: cleanup,
    };
  } catch {
    cleanup();
    onEvent({ type: 'error', reason: '校园场景初始化失败，仍可使用地标列表探索。' });
    return noOpHandle();
  }
}
