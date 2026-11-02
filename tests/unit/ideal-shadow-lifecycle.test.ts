import { expect, it } from 'vitest';
import * as THREE from 'three';
import { createIdealCampusLayer } from '../../src/scene/IdealCampusLayer';
import { WebGLShadowMap } from 'three/src/renderers/webgl/WebGLShadowMap.js';
// @ts-expect-error Pinned r186 internal module has no public declaration.
import { WebGLMaterials } from 'three/src/renderers/webgl/WebGLMaterials.js';

it.each(['huyu', 'yingxi'] as const)('owns and releases %s depth material without changing opaque geometry or borrowing another layer', campus => {
  const first = createIdealCampusLayer(campus), second = createIdealCampusLayer(campus);
  const depth = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  first.visual.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.MeshStandardMaterial;
    expect(material.transparent).toBe(false); expect(material.alphaTest).toBe(0);
    if (material.map) textures.add(material.map);
    if (material.bumpMap) textures.add(material.bumpMap);
    if (object.castShadow) {
      expect(object.customDepthMaterial).toBeInstanceOf(THREE.MeshDepthMaterial);
      depth.add(object.customDepthMaterial!);
    } else expect(object.customDepthMaterial).toBeUndefined();
  });
  expect(depth.size).toBe(1); expect(textures.size).toBe(4);
  const owned = [...depth][0]! as THREE.MeshDepthMaterial;
  const defaults = new THREE.MeshDepthMaterial();
  expect(owned.depthPacking).toBe(defaults.depthPacking);
  expect(owned.side).toBe(defaults.side); expect(owned.alphaTest).toBe(defaults.alphaTest);
  let releases = 0, secondReleases = 0;
  owned.addEventListener('dispose', () => releases++);
  const secondDepth = new Set<THREE.Material>();
  second.visual.traverse(object => {
    if (object instanceof THREE.Mesh && object.castShadow) secondDepth.add(object.customDepthMaterial!);
  });
  expect(secondDepth.size).toBe(1); expect(secondDepth.has(owned)).toBe(false);
  [...secondDepth][0]!.addEventListener('dispose', () => secondReleases++);
  const textureReleases = new Map<THREE.Texture, number>();
  for (const texture of textures) texture.addEventListener('dispose', () => textureReleases.set(texture, (textureReleases.get(texture) ?? 0) + 1));
  // r186 assigns a visible caster's map to customDepthMaterial while rendering.
  // Releasing this material must not itself dispose that borrowed map twice.
  owned.map = [...textures][0]!;
  first.dispose(); first.dispose();
  expect(releases).toBe(1); expect(secondReleases).toBe(0);
  expect([...textureReleases.values()]).toEqual([1, 1, 1, 1]);
  second.dispose(); expect(secondReleases).toBe(1); defaults.dispose();
});

it('isolates retired ideal maps from subsequent base casters in the actual r186 CPU shadow/uniform path', () => {
  // These real Three modules run with a draw stub, not a WebGL context. This
  // proves ownership/reference isolation, not GPU allocation or pixel parity.
  function replay(privateDepth: boolean) {
    const uniforms = new Map<THREE.Material, Record<string, THREE.IUniform>>();
    const draws: { material: THREE.MeshDepthMaterial; map: THREE.Texture | null; uniform: THREE.Texture | null }[] = [];
    const refresh = WebGLMaterials({}, { get: () => ({}) });
    const noop = () => {};
    const renderer = {
      localClippingEnabled: false,
      getRenderTarget: () => null, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
      setRenderTarget: noop, clear: noop,
      state: { setBlending: noop, setScissorTest: noop, viewport: noop,
        buffers: { depth: { getReversed: () => false, setTest: noop }, color: { setClear: noop } } },
      renderBufferDirect: (_camera: THREE.Camera, _scene: null, _geometry: THREE.BufferGeometry, material: THREE.MeshDepthMaterial) => {
        if (!uniforms.has(material)) uniforms.set(material, THREE.UniformsUtils.clone(THREE.ShaderLib.depth.uniforms));
        const values = uniforms.get(material)!;
        refresh.refreshMaterialUniforms(values, material, 1, 1, null);
        draws.push({ material, map: material.map, uniform: values.map!.value });
      },
    };
    const shadow = new WebGLShadowMap(
      renderer as unknown as THREE.WebGLRenderer,
      { update: (object: THREE.Mesh) => object.geometry } as unknown as ConstructorParameters<typeof WebGLShadowMap>[1],
      { maxTextureSize: 4096 } as ConstructorParameters<typeof WebGLShadowMap>[2],
    );
    shadow.enabled = true;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), light = new THREE.DirectionalLight();
    light.position.set(0, 10, 0); scene.add(light, light.target);
    const layer = createIdealCampusLayer('yingxi');
    const caster = layer.visual.children.find(object => object instanceof THREE.Mesh && object.castShadow && (object.material as THREE.MeshStandardMaterial).map) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const owned = caster.customDepthMaterial;
    if (!privateDepth) caster.customDepthMaterial = undefined;
    caster.frustumCulled = false; scene.add(caster); scene.updateMatrixWorld(true);
    const retiredMap = caster.material.map!;
    shadow.render([light], scene, camera);
    expect(draws.at(-1)!.uniform).toBe(retiredMap);
    scene.remove(caster); layer.visual.add(caster); layer.dispose();
    const base = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    base.castShadow = true; base.frustumCulled = false; scene.add(base); scene.updateMatrixWorld(true);
    shadow.render([light], scene, camera);
    const after = draws.at(-1)!;
    expect(after.map).toBeNull();
    if (privateDepth) {
      expect(after.material).not.toBe(owned);
      expect(after.uniform).not.toBe(retiredMap);
    } else {
      expect(after.material).toBe(draws[0]!.material);
      expect(after.uniform).toBe(retiredMap); // Old shared-depth failure mechanism.
    }
    base.geometry.dispose(); base.material.dispose(); light.shadow.dispose();
  }
  replay(false); replay(true);
});
