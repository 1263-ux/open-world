"""Verify generated paths, immutable source footprints and audited display-only models."""
import json
import unittest
from pathlib import Path
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
class SpatialModels(unittest.TestCase):
    def test_all_routes_avoid_buildings_and_design_obstacles(self):
        campuses=json.loads((ROOT/'src/campus-data/spatial.json').read_text())
        for campus in campuses.values():
            buildings=[Polygon(f['polygon']).buffer(3) for f in campus['features'] if f['kind']=='building']
            designs=[Polygon(o['polygon']).buffer(3) for o in campus['modelObstacles']]
            blocked=unary_union(buildings+designs)
            for name,points in campus['routes'].items():
                line=LineString(points)
                # Coordinate serialization rounds to 1 cm; allow only rounding tolerance.
                self.assertTrue(Polygon(campus['boundary']).buffer(-4).buffer(.01).covers(line), (campus['id'],name,'boundary'))
                self.assertTrue(blocked.buffer(-.01).disjoint(line), (campus['id'],name,'obstacle'))
    def test_source_geometry_and_audited_overrides(self):
        campus=json.loads((ROOT/'src/campus-data/spatial.json').read_text())['huyu']
        meta=json.loads((ROOT/'public/assets/campuses/huyu/meihua-classroom-group.metadata.json').read_text())
        audit=json.loads((ROOT/'public/data/augmentation-huyu-audit.json').read_text())
        self.assertEqual(len(audit['visualOverrides']),5)
        for ident,ring in meta['sourceFootprintsWorldXZ'].items():
            f=next(f for f in campus['features'] if f['id']=='overture:'+ident)
            entry=next(o for o in audit['visualOverrides'] if o['featureId']==f['id'])
            self.assertEqual(f['polygon'],ring+[ring[0]])
            self.assertEqual((f['height'],f['heightStatus']),(4.5,'unverified'))
            self.assertEqual(entry['before']['heightStatus'],'ml-estimate')
            self.assertEqual(entry['after']['height'],4.5)
            self.assertIn('照片',entry['reason'])
        self.assertEqual(campus['questOrder'],['hy-main','hy-library','hy-training'])
        self.assertEqual(len(campus['modelObstacles']),3)
        self.assertTrue(all(o['status']=='model-design-only' for o in campus['modelObstacles']))
        self.assertEqual(campus['modelObstacles'][0]['polygon'],meta['inferredConnector']['fullWorldXZPolygon'])
        gate=next(l for l in campus['landmarks'] if l['id']=='hy-north-gate')
        self.assertIsNone(gate['featureId']);self.assertTrue(gate['optional'])
        self.assertEqual(gate['positionStatus'],'approximate-inferred')

if __name__=='__main__': unittest.main()
