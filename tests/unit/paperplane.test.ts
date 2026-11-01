import { describe, expect, it, vi } from 'vitest';
import { createPaperplane, type PaperplaneConfig, type PaperplaneCollision } from '../../src/games/paperplane';
const neutral = { turn: 0, pitch: 0 };
function config(): PaperplaneConfig {
  return { id:'test', launch:{position:{x:0,y:2,z:0},heading:0},
    gates:[.5,1,1.5].map(d=>({center:{x:0,y:2-d,z:-d},normal:{x:0,y:0,z:-1},radius:.3})),
    landing:{center:{x:0,y:0,z:-2},radius:.2}, bounds:{min:{x:-100,y:-1,z:-100},max:{x:100,y:100,z:100}},
    groundY:0,speed:1,turnRate:1,pitchRate:1,minPitch:-1,maxPitch:1,sinkRate:1,liftRate:1,maxDuration:30 };
}
const empty = ():PaperplaneCollision => ({isSolid:()=>false,segmentHit:()=>null});
function run(parts:number[], c=config(), world=empty()) { const p=createPaperplane(c,world);p.launch();const events=parts.flatMap(dt=>p.advance(dt,neutral).events);return {p,state:p.getState(),events}; }
describe('finite point paperplane simulation',()=>{
  it('is deterministic for 60Hz, 30Hz and irregular frame partitions',()=>{
    const a=run(Array(60).fill(1/60)).state;
    expect(run(Array(30).fill(1/30)).state).toEqual(a);
    expect(run(Array.from({length:30},()=>[.01,1/30-.01]).flat()).state).toEqual(a);
  });
  it('caps a stall at six steps and does not retain catch-up time',()=>{
    const p=createPaperplane(config(),empty());p.launch();p.advance(60,neutral);
    expect(p.getState().elapsed).toBeCloseTo(.1);p.advance(1/60,neutral);expect(p.getState().elapsed).toBeCloseTo(7/60);
  });
  it('pauses simulation and discards fractional pre-pause clock',()=>{
    const p=createPaperplane(config(),empty());p.launch();p.advance(.01,neutral);p.setPaused(true);p.advance(20,neutral);
    expect(p.getState().elapsed).toBe(0);p.setPaused(false);p.advance(.01,neutral);expect(p.getState().elapsed).toBe(0);
  });
  it('requires three ordered gates then lands, and emits terminal exactly once',()=>{
    const {p,state,events}=run(Array(150).fill(1/60));
    expect(state.result).toMatchObject({reason:'landed',success:true,gatesPassed:3});
    expect(events.filter(e=>e.type==='gate')).toEqual([0,1,2].map(gateIndex=>({type:'gate',gateIndex})));
    expect(events.filter(e=>e.type==='result')).toHaveLength(1);
    expect(p.advance(1,neutral).events).toEqual([]);expect(p.cancel().events).toEqual([]);expect(p.launch().events).toEqual([]);
    expect(p.retry().state).toMatchObject({mode:'ready',gateIndex:0,elapsed:0,result:null});
  });
  it('does not award an out-of-order or missed gate',()=>{
    const c=config();c.gates=[c.gates[1]!,c.gates[0]!,c.gates[2]!];
    expect(run(Array(150).fill(1/60),c).state.result).toMatchObject({reason:'missed-gates',success:false,gatesPassed:1});
  });
  it('stops at a thin wall before a gate even when one step spans both',()=>{
    const c=config();c.speed=120;c.sinkRate=0;
    const world=empty();world.segmentHit=(a,b)=>a.z>-.25&&b.z<=-.25?{fraction:(-.25-a.z)/(b.z-a.z)}:null;
    const {state}=run([1/60],c,world);expect(state.position.z).toBeCloseTo(-.25);expect(state.gateIndex).toBe(0);expect(state.result?.reason).toBe('hit');
  });
  it('world contact tied with a goal wins',()=>{
    const c=config();c.speed=60;c.sinkRate=60;
    const world=empty();world.segmentHit=()=>({fraction:.5});
    const {state}=run([1/60],c,world);expect(state.gateIndex).toBe(0);expect(state.result?.reason).toBe('hit');
  });
  it('rejects solid starts and ignores invalid/zero clock without querying segments',()=>{
    const segmentHit=vi.fn(()=>null);const p=createPaperplane(config(),{segmentHit,isSolid:()=>true});
    expect(p.launch().state.result?.reason).toBe('invalid-launch');expect(segmentHit).not.toHaveBeenCalled();
    const q=createPaperplane(config(),{segmentHit,isSolid:()=>false});q.launch();for(const dt of [0,-1,NaN,Infinity])q.advance(dt,neutral);
    expect(q.getState().elapsed).toBe(0);expect(segmentHit).not.toHaveBeenCalled();
  });
  it('right input turns +X and up input raises pitch; nonfinite controls stay finite',()=>{
    const p=createPaperplane(config(),empty());p.launch();p.advance(.1,{turn:1,pitch:1});
    expect(p.getState().position.x).toBeGreaterThan(0);expect(p.getState().pitch).toBeGreaterThan(0);
    p.advance(.1,{turn:NaN,pitch:Infinity});expect(Object.values(p.getState().position).every(Number.isFinite)).toBe(true);
  });
  it.each([0,Math.PI])('steers relative to chase-camera screen right at heading %s',heading=>{
    for(const turn of [-1,1]){
      const c=config();c.launch.heading=heading;c.sinkRate=0;const p=createPaperplane(c,empty());p.launch();p.advance(.1,{turn,pitch:0});
      const delta=p.getState().position;const right={x:Math.cos(heading),z:Math.sin(heading)};
      expect((delta.x*right.x+delta.z*right.z)*turn).toBeGreaterThan(0);
    }
  });
  it('fails closed on invalid collision fractions and bounds',()=>{
    for(const fraction of [NaN,Infinity,-.1,1.1])expect(run([1/60],config(),{isSolid:()=>false,segmentHit:()=>({fraction})}).state.result?.reason).toBe('hit');
    const c=config();c.bounds.min.z=-.01;expect(run([1/60],c).state.result?.reason).toBe('out-of-bounds');
  });
  it('keeps config and snapshots detached, supports timeout and cancel retry',()=>{
    const c=config();c.maxDuration=.05;const p=createPaperplane(c,empty());c.launch.position.x=99;
    const snapshot=p.getState();snapshot.position.x=88;expect(p.getState().position.x).toBe(0);
    p.launch();expect(p.advance(.1,neutral).state.result?.reason).toBe('timeout');p.retry();expect(p.cancel().state.result?.reason).toBe('cancelled');expect(p.reinitialize().state.mode).toBe('ready');
  });
});
