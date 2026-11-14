// Optional isolated detail; no scale or behaviour changes. Existing eye is shared
// as an immutable geometry/material resource, owned by the source fish.
export function addPairedEye(fish){
 const existing=fish.children.find(o=>o.name==='Paired_goldfish_eye');if(existing)return existing;
 const eye=fish.children.find(o=>o.geometry?.type==='SphereGeometry'&&Math.abs(o.geometry.parameters.radius-.008)<1e-9&&o.material?.isMeshBasicMaterial);
 if(!eye)throw Error('Expected original single eye unavailable');
 const mirror=eye.clone();mirror.name='Paired_goldfish_eye';mirror.position.z=-eye.position.z;fish.add(mirror);return mirror;
}
