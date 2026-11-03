import { describe, expect, it } from 'vitest';
import { campuses } from '../../src/campus-data/campuses';
import { planCampusGuidance } from '../../src/scene/CampusGuidance';
import type { CampusData, Point2 } from '../../src/shared/contracts';

const fixture = (wall = false): CampusData => ({ ...campuses.huyu,
  boundary: [[-20,-20],[20,-20],[20,20],[-20,20]],
  features: wall ? [{ ...campuses.huyu.features.find(f=>f.kind==='building')!, polygon:[[-1,-20],[1,-20],[1,20],[-1,20]] }] : [], modelObstacles: [],
  landmarks: [{ ...campuses.huyu.landmarks[0]!,id:'target',arrival:[10,0] }], routes:{'start>target':[[10,0]]},
});
describe('bounded static connector into unchanged authored guidance',()=>{
  it('avoids the real building from the observed wide-view position and retains the suffix',()=>{
    const start:Point2=[-74.281,-11.360],before=JSON.stringify(campuses.huyu);
    const plan=planCampusGuidance(campuses.huyu,start,'hy-training');
    expect(plan).not.toBeNull();expect(plan!.expandedNodes).toBeLessThanOrEqual(20000);
    expect(plan!.points[plan!.connectorCount-1]).toEqual([-65.74,-45.03]);
    expect(plan!.points.at(-1)).toEqual(campuses.huyu.landmarks.find(l=>l.id==='hy-training')!.arrival);
    expect(JSON.stringify(campuses.huyu)).toBe(before);expect(start).toEqual([-74.281,-11.360]);
  });
  it('fails closed for an impassable wall, outside boundary, insufficient clearance and invalid input',()=>{
    expect(planCampusGuidance(fixture(true),[-10,0],'target')).toBeNull();
    for(const start of [[-21,0],[-19.5,0],[NaN,0]] as Point2[])expect(planCampusGuidance(fixture(),start,'target')).toBeNull();
    expect(planCampusGuidance(fixture(),[-10,0],'missing')).toBeNull();
  });
  it('does not mutate routes when the nearest authored entry is blocked',()=>{
    const data=fixture(true);data.routes={'a>target':[[0,0],[10,0]]};const before=JSON.stringify(data);
    expect(planCampusGuidance(data,[-10,0],'target')).toBeNull();expect(JSON.stringify(data)).toBe(before);
  });
  it('retains every authored corner after the safely joined entry',()=>{
    const data=fixture();data.routes={'a>target':[[0,0],[0,8],[10,8],[10,0]]};
    const plan=planCampusGuidance(data,[-10,0],'target')!;
    expect(plan.points.slice(plan.connectorCount)).toEqual([[0,8],[10,8],[10,0]]);
  });
  it('bounds oversized and unreachable searches, and records CPU cost without a browser performance claim',()=>{
    const samples=[];
    for(const [campus,start,id] of [
      [campuses.huyu,[-74.281,-11.360],'hy-training'],
      [campuses.huyu,[...campuses.huyu.start],'hy-north-gate'],
      [campuses.yingxi,[-20,175.5],'yx-mechanical'],
    ] as [CampusData,Point2,string][]) {
      const began=performance.now(),plan=planCampusGuidance(campus,start,id);
      samples.push({id,elapsedMs:performance.now()-began,nodes:plan?.expandedNodes,points:plan?.points.length});
      expect(plan).not.toBeNull();expect(plan!.expandedNodes).toBeLessThanOrEqual(20000);
    }
    const blocked=fixture(true);blocked.boundary=[[-380,-300],[380,-300],[380,300],[-380,300]];
    blocked.features[0]!.polygon=[[-1,-300],[1,-300],[1,300],[-1,300]];
    blocked.landmarks[0]!.arrival=[300,0];blocked.routes={'a>target':[[300,0]]};
    const began=performance.now();expect(planCampusGuidance(blocked,[-300,0],'target')).toBeNull();
    samples.push({id:'unreachable-bounded-20k',elapsedMs:performance.now()-began,nodes:undefined,points:undefined});
    blocked.boundary=[[-1000,-1000],[1000,-1000],[1000,1000],[-1000,1000]];
    expect(planCampusGuidance(blocked,[-300,0],'target')).toBeNull();
    console.log('[GUIDANCE_CPU_BUDGET]',JSON.stringify({samples,cache:'per-call only',gridCellLimit:120000,expandedNodeLimit:20000,heapInsertUpperBound:160001,notBrowserPerformance:true}));
  });

});
