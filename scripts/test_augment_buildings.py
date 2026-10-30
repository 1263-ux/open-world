import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from shapely.geometry import Polygon
import augment_buildings as a


def ring(x=0,y=0,size=10):
    return [[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]]


def geo(points):
    return {'type':'Polygon','coordinates':[points]}


def record(points,properties):
    return {'type':'Feature','geometry':geo(points),'properties':properties}


class HeightMatching(unittest.TestCase):
    def setUp(self):
        self.p=Polygon(ring())

    def test_high_overlap_is_explicit_prediction(self):
        result=a.match_height(self.p,[(self.p,22,'known')])
        self.assertTrue(result['accepted']);self.assertEqual(result['height'],22)
        self.assertEqual(result['iou'],1)

    def test_low_overlap_never_matches_nearest(self):
        result=a.match_height(self.p,[(Polygon(ring(8)),22,'wrong')])
        self.assertFalse(result['accepted'])

    def test_ambiguity_and_extremes_fail_closed(self):
        self.assertFalse(a.match_height(self.p,[(self.p,20,'a'),(self.p,22,'b')])['accepted'])
        for h in [float('nan'),float('inf'),None,True,-5,2,61]:
            self.assertFalse(a.match_height(self.p,[(self.p,h,'bad')])['accepted'])

    def test_invalid_or_holes_not_repaired(self):
        for geometry in [geo([[0,0],[10,10],[0,10],[10,0],[0,0]]),{'type':'Polygon','coordinates':[ring(),ring(2,2,2)]}]:
            with self.assertRaises(ValueError):a.polygon_from_geo(geometry,lambda p:p)

    def test_geometry_hash_independent_of_ring_order(self):
        r=ring();rot=r[2:-1]+r[:2];rot.append(rot[0])
        self.assertEqual(a._geometry_id(geo(r)),a._geometry_id(geo(rot)))
        self.assertEqual(a._geometry_id(geo(r)),a._geometry_id(geo(list(reversed(r)))))

    def test_augmentation_preserves_evidence_and_deduplicates(self):
        original=[{'id':'main','name':'main','kind':'building','polygon':ring(),'height':45.5,'heightStatus':'level-estimate','levels':13,'source':'osm'}, {'id':'library','name':'library','kind':'building','polygon':ring(20),'height':15,'heightStatus':'unverified','levels':None,'source':'osm'}]
        before=copy.deepcopy(original)
        overture=[record(ring(),{'id':'duplicate'}),record(ring(40),{'id':'new'}),record(ring(40),{'id':'new-copy'}),record(ring(60,0,1),{'id':'fragment'})]
        glo=[record(ring(),{'Height':9.35}),record(ring(20),{'Height':22}),record(ring(40),{'Height':30})]
        with tempfile.TemporaryDirectory() as temp,patch.object(a,'SOURCES',Path(temp)):
            for name,features in [('overture',overture),('globfp',glo)]:
                (Path(temp)/f'tyut-{name}-test.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features}))
            result,audit=a.augment_buildings('test',original,lambda p:p)
            again,again_audit=a.augment_buildings('test',original,lambda p:p)
        self.assertEqual(original,before);self.assertEqual(result,again);self.assertEqual(audit,again_audit)
        self.assertEqual(result[0],original[0]);self.assertEqual(result[1]['height'],22)
        self.assertEqual(result[1]['heightStatus'],'ml-estimate');self.assertEqual(result[1]['heightSource']['year'],2020)
        self.assertEqual(audit['acceptedAdded'],1);self.assertEqual(len(result),3)
        self.assertEqual(result[2]['height'],30)
        json.dumps(audit,allow_nan=False)


if __name__=='__main__':unittest.main()
