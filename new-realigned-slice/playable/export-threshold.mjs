import fs from 'node:fs';
import * as T from '../../game/vendor/three.module.js';
import {GLTFExporter} from '../../../open-world/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import {createDreamThreshold} from './dream-threshold.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result='data:application/octet-stream;base64,'+Buffer.from(v).toString('base64');this.onloadend?.();});}};
const scene=new T.Scene(),a=createDreamThreshold(scene);a.reveal();a.update(4,4,null);scene.updateMatrixWorld(true);
const data=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});fs.mkdirSync(new URL('./threshold-evidence/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('./threshold-evidence/threshold.glb',import.meta.url),Buffer.from(data));
