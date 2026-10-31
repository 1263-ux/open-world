import { describe, expect, it } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { applyLandmarkShadowStyle } from '../../src/scene/LandmarkStyle';

describe('gate shadow style', () => {
  it('disables receive only for the plaque and seven named ribs; casting stays enabled', () => {
    const group = new Group();
    const names = ['Suspended_rectangular_plaque', ...Array.from({length:7},(_,i)=>`Vertical_structural_rib${i ? String(i).padStart(3,'0') : ''}`), 'Continuous_shallow_arch'];
    for (const name of names) {const mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial());mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
    applyLandmarkShadowStyle(group,'other');
    expect(group.children.every(node=>(node as Mesh).receiveShadow)).toBe(true);
    applyLandmarkShadowStyle(group,'hy-north-gate');
    expect(group.children.slice(0,8).every(node=>!(node as Mesh).receiveShadow && (node as Mesh).castShadow)).toBe(true);
    expect((group.children[8] as Mesh).receiveShadow).toBe(true);
  });
});
