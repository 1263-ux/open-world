import { describe, expect, it } from 'vitest';
import { BUILDING_CONFIG } from '../../games/hks/src/config';
import { chooseDisplayedUpgrade, chooseMovement, crossesBase, isDisplayedCard, validateOutcome, validateSurvivalState, type DisplayedCard, type SurvivalState } from '../e2e/hks-survival-policy';
const state = (): SurvivalState => ({
  scene:'GameScene', remaining:420, paused:false, ended:false, levelUp:false, kills:0, x:960, y:790, level:1, monsters:0, nearestXP:null,
  building:{x:BUILDING_CONFIG.x,y:BUILDING_CONFIG.y,structures:{wood:{currentHp:120,maxHp:120},stone:{currentHp:70,maxHp:70},tile:{currentHp:90,maxHp:90},painting:{currentHp:80,maxHp:80}}},
  boss:{spawned:false,killed:false,hp:null,maxHp:null,active:false,dead:false},outcome:null,outcomeStructures:null,upgradeCards:[],
});
describe('Hks natural-play policy and truthful terminal guards',()=>{
  it('requires the full read-only runtime telemetry',()=>{expect(()=>validateSurvivalState(state())).not.toThrow();expect(()=>validateSurvivalState({scene:'GameScene'})).toThrow('telemetry');expect(()=>validateSurvivalState({...state(),outcome:undefined})).toThrow('outcome');});
  it('moves toward reachable XP but avoids the full native triangle collider',()=>{const s=state();s.nearestXP={x:1060,y:790,value:6,distance:100};expect(chooseMovement(s)).toMatchObject({kind:'collect-xp',keys:['ArrowRight']});s.nearestXP={x:960,y:480,value:6,distance:310};expect(crossesBase(s,s.nearestXP,s.building)).toBe(true);expect(chooseMovement(s).kind).toBe('orbit');});
  it('collects nearby XP even just outside the preferred defense ring',()=>{const s=state();s.x=640;s.y=540;s.nearestXP={x:620,y:540,value:6,distance:20};expect(chooseMovement(s).kind).toBe('collect-xp');});
  it('chooses an input trajectory outside the conservative collider bound',()=>{const s=state();const m=chooseMovement(s);expect(crossesBase(s,m.plannedEnd,s.building)).toBe(false);expect(Math.hypot(m.target.x-s.building.x,m.target.y-s.building.y)).toBeCloseTo(240);});
  it('ignores distant XP and escapes a conservative corner instead of idling',()=>{const s=state();s.nearestXP={x:1600,y:790,value:6,distance:640};expect(chooseMovement(s).kind).toBe('orbit');s.x=800;s.y=540;s.nearestXP=null;const m=chooseMovement(s);expect(m.keys).toEqual(['ArrowLeft']);expect(m.plannedEnd.x).toBeLessThan(s.x);});
  it('checks the actual equal-axis key trajectory when seeking XP',()=>{const s=state();s.x=760;s.y=380;s.nearestXP={x:820,y:400,value:6,distance:Math.hypot(60,20)};const m=chooseMovement(s);expect(crossesBase(s,m.plannedEnd,s.building)).toBe(false);});
  it('retains default orbit and supports only explicit finite positive trial radii',()=>{
    const s=state();for(const radius of [240,190,220]) {
      const m=chooseMovement(s,radius);expect(Math.hypot(m.target.x-s.building.x,m.target.y-s.building.y)).toBeCloseTo(radius);
    }
    expect(chooseMovement(s)).toEqual(chooseMovement(s,240));expect(()=>chooseMovement(s,0)).toThrow('Invalid orbit radius');
  });
  it('ranks only actually displayed choices and never assumes early stone tier heals',()=>{
    const s=state(),card=(name:string,level:number,x:number):DisplayedCard=>({x,y:352,displayed:{name,level,description:'真实显示的描述'}});
    const stone1=card('石材修补',1,100),water3=card('防渗保护层',3,200),wood2=card('梁柱补强',2,300);
    s.building.structures.stone.currentHp=7;
    expect(chooseDisplayedUpgrade([stone1,water3,wood2],s.building.structures)).toBe(water3);
    s.building.structures.stone.currentHp=70;s.building.structures.wood.currentHp=12;
    expect(chooseDisplayedUpgrade([stone1,water3,wood2],s.building.structures)).toBe(wood2);
    expect(()=>chooseDisplayedUpgrade([],s.building.structures)).toThrow('No valid displayed');
    expect(isDisplayedCard({x:0,y:0})).toBe(false);
    expect(isDisplayedCard({x:0,y:0,displayed:{name:'',level:1,description:'x'}} as DisplayedCard)).toBe(false);
  });
  it('accepts natural loss or timer victory, and rejects inconsistent outcomes',()=>{const loss=state();loss.ended=true;loss.outcome='defeat';loss.remaining=200;loss.outcomeStructures=structuredClone(loss.building.structures);loss.outcomeStructures.wood.currentHp=0;expect(()=>validateOutcome(loss)).not.toThrow();const win=state();win.ended=true;win.outcome='victory';win.remaining=0;win.outcomeStructures=structuredClone(win.building.structures);expect(()=>validateOutcome(win)).not.toThrow();expect(()=>validateOutcome({...win,remaining:200})).toThrow('contradicts');expect(()=>validateOutcome(state())).toThrow('600-second');expect(()=>validateOutcome({...win,outcome:'defeat'})).toThrow('contradicts');});
});
