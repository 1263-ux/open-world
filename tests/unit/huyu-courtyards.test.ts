import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { campuses } from '../../src/campus-data/campuses';
import { createHuyuCourtyards } from '../../src/scene/HuyuCourtyards';
import type { Point2 } from '../../src/shared/contracts';

// This is a deterministic mock/unit test, not a real browser or a route trial.
// The copied clearance calculation uses the project's actual Huyu source data.
function inside(x:number,z:number,polygon:Point2[]) {
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i]!,b=polygon[j]!;
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}
function distance(x:number,z:number,polygon:Point2[]) {
  let nearest=Infinity;
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i]!,b=polygon[(i+1)%polygon.length]!,dx=b[0]-a[0],dz=b[1]-a[1],d=dx*dx+dz*dz;
    const t=d?THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/d,0,1):0;
    nearest=Math.min(nearest,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
  }
  return nearest;
}
function clear(x:number,z:number,radius:number) {
  const data=campuses.huyu;
  const routes=Object.values(data.routes).every(points=>points.slice(1).every((b,i)=>{
    const a=points[i]!,dx=b[0]-a[0],dz=b[1]-a[1],d=dx*dx+dz*dz;
    const t=d?THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/d,0,1):0;
    return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)>=radius+2;
  }));
  return inside(x,z,data.boundary)&&distance(x,z,data.boundary)>=radius&&routes&&
    data.features.filter(f=>f.kind==='building'&&f.polygon.length>=3).every(f=>!inside(x,z,f.polygon)&&distance(x,z,f.polygon)>=radius);
}
let loaded:Parameters<THREE.TextureLoader['load']>[1],failed:((event:unknown)=>void)|undefined;
function mockLoader() {
  return vi.spyOn(THREE.TextureLoader.prototype,'load').mockImplementation((_url,onLoad,_onProgress,onError)=>{
    loaded=onLoad;failed=onError;return new THREE.Texture<HTMLImageElement>();
  });
}
afterEach(()=>{loaded=undefined;failed=undefined;vi.restoreAllMocks();});

describe('Huyu courtyard resource ownership and admission (mocked loader)',()=>{
  it('admits the expected real-data sites and keeps visual/collider geometry independent',()=>{
    mockLoader();const admitted:{x:number;z:number;radius:number}[]=[];
    const garden=createHuyuCourtyards((x,z,radius)=>{const ok=clear(x,z,radius);if(ok)admitted.push({x,z,radius});return ok;});
    expect(admitted.filter(x=>x.radius===3.5)).toHaveLength(3);
    expect(admitted.filter(x=>x.radius===2.1)).toHaveLength(4);
    expect(admitted.filter(x=>x.radius===1.8)).toHaveLength(4);
    expect(garden.visual.userData.treeCount).toBe(3);expect(garden.colliders.children).toHaveLength(7);
    const visualGeometry=new Set<THREE.BufferGeometry>(),colliderGeometry=new Set<THREE.BufferGeometry>();
    garden.visual.traverse(o=>{if(o instanceof THREE.Mesh)visualGeometry.add(o.geometry);});
    garden.colliders.traverse(o=>{if(o instanceof THREE.Mesh)colliderGeometry.add(o.geometry);});
    for(const geometry of colliderGeometry)expect(visualGeometry.has(geometry)).toBe(false);
    let visualDisposed=0;for(const geometry of visualGeometry)geometry.addEventListener('dispose',()=>{visualDisposed++;});
    for(const geometry of colliderGeometry)geometry.dispose();expect(visualDisposed).toBe(0);
    garden.dispose();
  });
  it('shows real-mesh leaves when an active texture load succeeds',()=>{
    mockLoader();const garden=createHuyuCourtyards(clear);const trees=garden.visual.children.filter(o=>o instanceof THREE.InstancedMesh) as THREE.InstancedMesh[];
    expect(garden.visual.userData.treeTextureStatus).toBe('loading');expect(trees).toHaveLength(3);
    const texture=new THREE.Texture<HTMLImageElement>();loaded!(texture);
    expect(garden.visual.userData.treeTextureStatus).toBe('ready');expect(trees[1]!.visible).toBe(true);expect(trees[2]!.visible).toBe(false);
    expect((trees[1]!.material as THREE.MeshStandardMaterial).map).toBe(texture);garden.dispose();
  });
  it('keeps fallback visible when an active texture load fails',()=>{
    mockLoader();const garden=createHuyuCourtyards(clear);const trees=garden.visual.children.filter(o=>o instanceof THREE.InstancedMesh) as THREE.InstancedMesh[];
    failed!(new Error('simulated network failure'));
    expect(garden.visual.userData.treeTextureStatus).toBe('fallback');expect(trees[1]!.visible).toBe(false);expect(trees[2]!.visible).toBe(true);garden.dispose();
  });
  it('disposes a late successful texture and ignores a late error after cancellation',()=>{
    mockLoader();const garden=createHuyuCourtyards(clear);const trees=garden.visual.children.filter(o=>o instanceof THREE.InstancedMesh) as THREE.InstancedMesh[];
    garden.dispose();const texture=new THREE.Texture<HTMLImageElement>(),dispose=vi.spyOn(texture,'dispose');loaded!(texture);failed!(new Error('late error'));
    expect(dispose).toHaveBeenCalledOnce();expect(garden.visual.userData.treeTextureStatus).toBe('disposed');
    expect(trees[1]!.visible).toBe(false);expect(trees[2]!.visible).toBe(true);expect((trees[1]!.material as THREE.MeshStandardMaterial).map).toBeNull();
  });
});
