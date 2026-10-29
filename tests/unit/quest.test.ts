import { describe, expect, it, vi, afterEach } from 'vitest';
import { campuses } from '../../src/campus-data/campuses';
import { emptyQuest, startQuest, visitQuest, validateQuest } from '../../src/games/quest';
import { loadProgress, saveProgress } from '../../src/games/storage';
const campus = campuses.huyu;
afterEach(() => vi.unstubAllGlobals());
describe('quest state machine', () => {
  it('starts, enforces order, ignores duplicates and completes without mutation', () => {
    const initial = startQuest(campus);
    expect(visitQuest(campus, initial, 'hy-library').state).toBe(initial);
    const first = visitQuest(campus, initial, 'hy-north-gate').state;
    expect(initial.visited).toEqual([]);
    expect(first.visited).toEqual(['hy-north-gate']);
    expect(visitQuest(campus, first, 'hy-north-gate').state).toBe(first);
    const second = visitQuest(campus, first, 'hy-library').state;
    const complete = visitQuest(campus, second, 'hy-meihua').state;
    expect(complete.status).toBe('completed');
    expect(visitQuest(campus, complete, 'hy-meihua').state).toBe(complete);
    expect(startQuest(campus)).toEqual({status:'active',visited:[]});
    expect(emptyQuest()).toEqual({status:'idle',visited:[]});
  });
  it('does not advance an idle task', () => {
    const state = emptyQuest();
    expect(visitQuest(campus,state,'hy-north-gate').state).toBe(state);
  });
  it.each([null,[],{status:'broken',visited:[]},{status:'idle',visited:['hy-north-gate']},{status:'completed',visited:[]},{status:'active',visited:['hy-library']},{status:'active',visited:['hy-north-gate','hy-north-gate']},{status:'active',visited:[0]},{status:'active',visited:campus.questOrder}])('rejects inconsistent save %j', value => {
    expect(validateQuest(campus,value)).toBeNull();
  });
  it('accepts safe copies of valid progress', () => {
    expect(validateQuest(campus,{status:'completed',visited:campus.questOrder})).toEqual({status:'completed',visited:campus.questOrder});
  });
});
describe('optional versioned storage', () => {
  it('works without a browser', () => expect(loadProgress(campuses).huyu.status).toBe('idle'));
  it('round-trips separate campus states', () => {
    const values = new Map<string,string>();
    vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>values.get(k) ?? null,setItem:(k:string,v:string)=>values.set(k,v)}});
    const progress={huyu:visitQuest(campus,startQuest(campus),'hy-north-gate').state,yingxi:emptyQuest()};
    expect(saveProgress(progress)).toBe(true);
    expect(loadProgress(campuses)).toEqual(progress);
  });
  it.each(['not-json','null','[]','{"version":99,"campuses":{}}','{"version":1,"campuses":{"huyu":{"status":"completed","visited":[]}}}'])('falls back for corrupt content %s', raw => {
    vi.stubGlobal('window',{localStorage:{getItem:()=>raw}});
    expect(loadProgress(campuses).huyu).toEqual(emptyQuest());
  });
  it('handles denied storage without throwing', () => {
    vi.stubGlobal('window',{get localStorage(){throw new Error('denied');}});
    expect(loadProgress(campuses).huyu.status).toBe('idle');
    expect(saveProgress({huyu:emptyQuest(),yingxi:emptyQuest()})).toBe(false);
  });
});
