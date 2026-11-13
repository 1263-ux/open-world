import {Controller} from '../../game/controller.js';
export function inside(x,z,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!=(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
export function createNavigation(layout){const w=layout.walkSurfaceStudy,b=w.bridge;const walkable=(x,z)=>inside(x,z,w.platformOutlineXZ)||inside(x,z,w.thresholdOutlineXZ)||(Math.abs(x-b.centerXZ[0])<b.width/2-.22&&Math.abs(z-b.centerXZ[1])<b.length/2+.001);return new Controller({x:2.5,z:6.5,walkable,colliders:[{x:-3.45,z:-3.85,w:1.5,d:.62}]});}
