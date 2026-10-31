/* global process, URL, console */
import fs from 'node:fs';
import { GLTFLoader } from '../../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { Box3 } from '../../../node_modules/three/build/three.module.js';
const f = process.argv[2] ?? new URL('../../../public/assets/campuses/yingxi/qingze-reading-garden.glb', import.meta.url);
const b = fs.readFileSync(f);
const g = await new Promise((ok, bad) => new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', ok, bad));
const box = new Box3().setFromObject(g.scene); let meshes = 0;
g.scene.traverse(o => { if (o.isMesh) meshes++; });
if (meshes !== 13 || box.min.y < -.01 || box.max.y > 9 || g.animations.length) throw Error('Unexpected model structure');
console.log('PASS GLTFLoader parse; meshes', meshes, 'bounds', box.min.toArray(), box.max.toArray(), 'animations', g.animations.length);
