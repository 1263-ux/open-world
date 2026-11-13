import {SCENE_ASSET,SCENE_LAYOUT} from './scene-config.js';
import assert from 'node:assert/strict';import fs from 'node:fs';import{createNavigation}from'./navigation.js';
const l=JSON.parse(fs.readFileSync(new URL(SCENE_LAYOUT,import.meta.url)));const p=createNavigation(l);
for(const [x,z]of[[2.5,4.4],[2,2.8],[0,0],[-2.2,-2.5],[-2.2,-3.64]]){for(let i=0;i<1800&&Math.hypot(p.x-x,p.z-z)>.12;i++)p.step(1/60,{right:p.x<x-.08,left:p.x>x+.08,forward:p.z>z+.08,backward:p.z<z-.08});assert(Math.hypot(p.x-x,p.z-z)<.2,`blocked at ${p.x},${p.z}`);}
assert(p.blockedAt(-3.45,-3.85));assert(p.blockedAt(9,9));assert(Math.hypot(p.x-l.interactionStudy.letterThree[0],p.z-l.interactionStudy.letterThree[2])<1.25);console.log('PASS actual fixed-step route from new spawn to letter, table and void blocked; NOT rendered or played');
