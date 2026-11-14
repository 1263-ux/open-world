import * as T from '../../../game/vendor/three.module.js';
import {inside} from '../navigation.js';

export function pointEdgeDistance(x,z,poly){let d=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));d=Math.min(d,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));}return d;}
export function createLayout(data){
 const height=(z)=>{const b=data.heightBreaks;if(z<=b[0][0])return b[0][1];for(let i=1;i<b.length;i++)if(z<=b[i][0]){const t=(z-b[i-1][0])/(b[i][0]-b[i-1][0]);return b[i-1][1]+(b[i][1]-b[i-1][1])*t;}return b.at(-1)[1];};
 const walkable=(x,z)=>inside(x,z,data.walkOutline)&&pointEdgeDistance(x,z,data.walkOutline)>=data.walkEdgeClearance;
 return{data,height,walkable};
}
function clip(poly,z,keepAbove){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=keepAbove?a[1]>=z:a[1]<=z,ib=keepAbove?b[1]>=z:b[1]<=z;if(ia)out.push(a);if(ia!==ib){const t=(z-a[1])/(b[1]-a[1]);out.push([a[0]+(b[0]-a[0])*t,z]);}}return out;}
export function buildSurface(layout){const group=new T.Group();group.name='Shared_polygon_visible_ground';const ground=[],stone=new T.MeshStandardMaterial({color:0xaebdbb,roughness:.92,side:T.DoubleSide}),edge=new T.MeshStandardMaterial({color:0x768d94,roughness:.94,side:T.DoubleSide});
 const addTop=(poly,height,parent,offset=[0,0])=>{const shape=new T.Shape(poly.map(p=>new T.Vector2(...p))),g=new T.ShapeGeometry(shape),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x+offset[0],height(z),z+offset[1]);}g.computeVertexNormals();const m=new T.Mesh(g,stone);m.name='Real_ground_polygon';parent.add(m);return m;};
 const edgeOf=(poly,top,bottom,parent,offset=[0,0])=>{const v=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];const A=[a[0]+offset[0],top(a[1]),a[1]+offset[1]],B=[b[0]+offset[0],top(b[1]),b[1]+offset[1]],C=[b[0]+offset[0],bottom(b[1]),b[1]+offset[1]],D=[a[0]+offset[0],bottom(a[1]),a[1]+offset[1]];v.push(...A,...B,...C,...A,...C,...D);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();parent.add(new T.Mesh(g,edge));};
 const breaks=layout.data.heightBreaks;for(let i=1;i<breaks.length;i++){let poly=clip(layout.data.walkOutline,breaks[i-1][0],true);poly=clip(poly,breaks[i][0],false);if(poly.length>=3)ground.push(addTop(poly,layout.height,group));}// Three-course eased perimeter, top surface remains exactly the navigation polygon.
 const poly=layout.data.walkOutline,ring=(inset)=>poly.map((p,i)=>{const a=poly[(i+poly.length-1)%poly.length],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return[p[0]+dz/l*inset,p[1]-dx/l*inset];});
 const tiers=[[poly,0],[ring(-.025),-.055],[ring(0),-.30],[ring(.035),-.37]];
 for(let t=1;t<tiers.length;t++){const v=[];for(let i=0;i<poly.length;i++){const j=(i+1)%poly.length,a=tiers[t-1][0][i],b=tiers[t-1][0][j],c=tiers[t][0][j],d=tiers[t][0][i],A=[a[0],layout.height(a[1])+tiers[t-1][1],a[1]],B=[b[0],layout.height(b[1])+tiers[t-1][1],b[1]],C=[c[0],layout.height(c[1])+tiers[t][1],c[1]],D=[d[0],layout.height(d[1])+tiers[t][1],d[1]];v.push(...A,...B,...C,...A,...C,...D);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();group.add(new T.Mesh(g,t===1?stone:edge));}
 // Window-side low broken masonry, not a diagonal ramp silhouette.
 const wallMat=new T.MeshStandardMaterial({color:0x9baeb3,roughness:.93});
 for(const block of layout.data.wallBlocks){const m=new T.Mesh(new T.BoxGeometry(...block.size),wallMat);m.position.set(...block.center);m.name='Window_fragment_masonry';group.add(m);}

 return{group,ground};
}
