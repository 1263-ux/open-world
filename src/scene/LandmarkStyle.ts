import { Color, Mesh, MeshStandardMaterial, type Group } from 'three';

// Art direction only: source geometry, landmark identities and spatial semantics
// remain untouched. Keys are names authored into our original, self-contained GLBs.
const palettes: Record<string, Record<string, string>> = {
  'yx-mechanical': {
    stone: '#c8bca8', roof: '#6d786b', trim: '#c5ae8e', light: '#e7dcc8',
    glass: '#587b75', clock: '#344f49', white: '#f1e7d4',
  },
  'yx-garden-setting': {
    tile1: '#d7d0bf', sand: '#cfc5af', stone: '#b9b5a4', pale: '#e6deca',
    wood: '#95704d', metal: '#405e57', soil: '#665c4a', leaf1: '#657f69',
    leaf2: '#829a7b', leaf3: '#9bac89', flowerLight: '#eaded0', flower: '#c8aa9d', bark: '#756750',
  },
  'hy-meihua': {
    stone: '#ded1bc', roof: '#788376', glass: '#769491', frame: '#eee2d0', base: '#758176',
  },
  'hy-north-gate': {
    'Arch - muted gray': '#b7c1b8', 'Arch - reverse gray': '#a6b3aa',
    'Arch - edges': '#d4d9c9', 'Arch - underside': '#87988f',
    'End wings - concrete': '#c8c9b9', 'Plaque - dark red brown': '#825c50',
    'Lettering - warm ivory': '#eee2d0', 'Structural ribs': '#73867c',
  },
};

/** Tune only known named materials; unexpected materials retain their authored appearance. */
export function styleLandmarkMaterials(group: Group, landmarkId: string): void {
  const palette = palettes[landmarkId];
  if (!palette) return;
  const styled = new Set<MeshStandardMaterial>();
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial) || styled.has(material)) continue;
      const color = palette[material.name];
      if (!color) continue;
      material.color.copy(new Color(color));
      material.roughness = Math.max(material.roughness, 0.8);
      styled.add(material);
    }
  });
}

/** Apply after the scene's generic shadow setup; preserve casting and geometry. */
export function applyLandmarkShadowStyle(group: Group, landmarkId: string): void {
  if (landmarkId !== 'hy-north-gate') return;
  group.traverse(object => {
    if (object instanceof Mesh && (object.name === 'Suspended_rectangular_plaque' || /^Vertical_structural_rib(?:\d+)?$/.test(object.name))) {
      object.receiveShadow = false;
    }
  });
}
