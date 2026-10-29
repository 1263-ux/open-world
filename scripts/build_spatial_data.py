"""Build reproducible WGS84->meter campus data. Requires shapely and networkx.
OSM-derived database: ODbL1.0. Route lines are GAME navigation, not real directions.
"""
from pathlib import Path
import json, math
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union
import networkx as nx
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'.agent/research/inputs'
geo=json.loads((SRC/'tyut-osm-footprints.geojson').read_text())
raw=json.loads((SRC/'tyut-overpass-campus.json').read_text())
meta=json.loads((SRC/'tyut-osm-measurements.json').read_text())
byid={str(e['id']):e for e in raw['elements']}
def ecef(lon,lat):
    lo,la=math.radians(lon),math.radians(lat);a=6378137.;e2=6.69437999014e-3
    n=a/math.sqrt(1-e2*math.sin(la)**2)
    return n*math.cos(la)*math.cos(lo),n*math.cos(la)*math.sin(lo),n*(1-e2)*math.sin(la)
def projector(origin):
    ox,oy,oz=ecef(*origin);lo,la=map(math.radians,origin)
    def project(pair):
        x,y,z=ecef(*pair);dx,dy,dz=x-ox,y-oy,z-oz
        east=-math.sin(lo)*dx+math.cos(lo)*dy
        north=-math.sin(la)*math.cos(lo)*dx-math.sin(la)*math.sin(lo)*dy+math.cos(la)*dz
        return [round(east,2),round(-north,2)]
    return project
out={}
for cid in ['huyu','yingxi']:
    project=projector(meta['origins'][cid]); rows=[f for f in geo['features'] if f['properties']['campus']==cid]
    br=next(f for f in rows if f['properties']['kind']=='campus');boundary=[project(p) for p in br['geometry']['coordinates'][0]]
    area=Polygon(boundary);assert area.is_valid
    features=[];buildings=[]
    for f in rows:
        p=f['properties'];oid=f['id'].split('/')[-1]
        if p['kind']=='campus':continue
        poly=[project(q) for q in f['geometry']['coordinates'][0]];shape=Polygon(poly)
        if not shape.is_valid or shape.area<1:continue
        tags=byid.get(oid,{}).get('tags',{})
        kind='building' if p['kind']=='building' else ('sports' if tags.get('sport') or tags.get('leisure') in ['pitch','track'] else 'park')
        levels=float(p['building_levels']) if p['building_levels'] else None
        height=p['height_m'] or ((levels*3.5) if levels else (15 if kind=='building' else .2))
        item={'id':oid,'name':p['name'] if p['name']!='unnamed' else ('运动场' if kind=='sports' else '绿地'),'kind':kind,'polygon':poly,'height':height,'heightStatus':'osm-tag' if p['height_m'] else ('level-estimate' if levels else 'unverified'),'levels':levels,'source':p['source']}
        features.append(item)
        if kind=='building':buildings.append(shape)
    roads=[]
    for e in raw['elements']:
        tags=e.get('tags',{})
        if 'highway' not in tags or len(e.get('geometry',[]))<2:continue
        line=LineString([project([p['lon'],p['lat']]) for p in e['geometry']]);clipped=line.intersection(area)
        parts=list(clipped.geoms) if hasattr(clipped,'geoms') else [clipped]
        for n,seg in enumerate(parts):
            if seg.geom_type!='LineString' or seg.length<4:continue
            roads.append({'id':str(e['id'])+'-'+str(n),'points':[[round(x,2),round(z,2)] for x,z in seg.coords],'width':7 if tags['highway'] in ['secondary','tertiary'] else 4.5,'source':'https://www.openstreetmap.org/way/'+str(e['id'])})
    free=area.buffer(-4).difference(unary_union([p.buffer(3) for p in buildings]))
    bounds=list(area.bounds);step=6;minx,minz,maxx,maxz=bounds
    graph=nx.Graph();points={}
    for ix in range(math.ceil((maxx-minx)/step)+1):
        for iz in range(math.ceil((maxz-minz)/step)+1):
            point=(minx+ix*step,minz+iz*step)
            if free.covers(Point(point)):points[(ix,iz)]=point;graph.add_node((ix,iz))
    for n,p in points.items():
        for dx,dz in [(1,0),(0,1),(1,1),(1,-1)]:
            m=(n[0]+dx,n[1]+dz)
            if m in points and free.covers(LineString([p,points[m]])):
                graph.add_edge(n,m,weight=math.hypot(dx,dz))
    # Restrict all playable stops to the largest connected free-space component.
    component=max(nx.connected_components(graph),key=len);graph=graph.subgraph(component).copy();points={n:points[n] for n in component}
    def nearest(p):return min(points,key=lambda n:math.dist(points[n],p))
    def feature(oid):return next(f for f in features if f['id']==oid)
    def landmark(lid,oid,name,subtitle,clue,q,choices,answer):
        f=feature(oid);poly=Polygon(f['polygon']);center=[poly.centroid.x,poly.centroid.y]
        # Game stop is nearest walkable grid cell, NOT asserted to be a real entrance.
        target=nearest(center);arrival=list(points[target])
        return {'id':lid,'name':name,'subtitle':subtitle,'position':[round(x,2) for x in center],'arrival':[round(x,2) for x in arrival],'featureId':oid,'facts':'占地轮廓来自 OpenStreetMap 社区地理数据，按米制坐标投影。立面细节与楼高仍待独立核验；到站点为游戏设定，不是现实导航入口。','source':f['source'],'clue':clue,'question':q,'choices':choices,'answer':answer}
    if cid=='huyu':
        landmarks=[landmark('hy-main','689323083','中区主楼','序章 · 工科的坐标','先找到校园北部修长的主楼，观察它与图书馆的位置关系。','从轮廓看，主楼更接近哪一种形状？',['细长横向体块','圆形场馆','开放球场'],0),landmark('hy-library','689323088','图书馆','第二站 · 书页之间','沿金色路线走向图书馆，在建筑轮廓中寻找转折。','图书馆的地面轮廓是完整的简单长方形吗？',['有转折的复合轮廓','一条直线','圆形'],0),landmark('hy-training','689323087','训练馆','终章 · 学习与运动','前往南侧训练馆，把书与运动连成一段校园旅程。','训练馆旁能找到什么类型的场地？',['运动场','海港','机场'],0)]
        p=landmarks[0]['arrival'];start=list(points[nearest([p[0],p[1]-30])])
    else:
        landmarks=[landmark('yx-office','182055472','主楼','序章 · 校园中轴','由南侧进入校园，先观察主楼横向展开的翼体。','主楼的占地轮廓有什么特点？',['多段翼体横向展开','只有圆形轮廓','单独一根柱子'],0),landmark('yx-garden','343238097','清泽园','第二站 · 绿意之间','沿室外路径来到清泽园，让建筑与树影相互映衬。','这一站在地图上主要属于什么空间？',['园林绿地','教学楼室内','地下停车场'],0),landmark('yx-mechanical','182055474','机械馆','第三站 · 工科记忆','从园区前往机械馆，沿着狭长的建筑轮廓观察。','机械馆的占地更接近哪种形态？',['沿南北延伸的长形','紧凑圆形','没有建筑轮廓'],0),landmark('yx-library','182055475','图书馆','终章 · 收集一页校史','前往图书馆，为这次迎西漫游收集最后一枚印记。','本次旅程中的建筑尺度主要依据什么？',['公开地理轮廓数据','随机大小的方块','真实测绘竣工图'],0)]
        start=list(points[nearest(project([112.5166178,37.8576493]))])
    destinations={'start':start,**{p['id']:p['arrival'] for p in landmarks}};routes={}
    for ka,pa in destinations.items():
        for kb,pb in destinations.items():
            if kb=='start' or ka==kb:continue
            a,b=nearest(pa),nearest(pb)
            path=nx.astar_path(graph,a,b,heuristic=lambda x,y:math.dist(x,y),weight='weight')
            coords=[points[n] for n in path]
            if len(coords)==1:coords=coords*2
            shape=LineString(coords).simplify(.01)
            assert free.buffer(.001).covers(shape),f'route violates obstacle {ka}>{kb}'
            routes[ka+'>'+kb]=[[round(x,2),round(z,2)] for x,z in shape.coords]
    out[cid]={'id':cid,'name':'虎峪校区' if cid=='huyu' else '迎西校区','englishName':'HUYU' if cid=='huyu' else 'YINGXI','description':'书与工的线索' if cid=='huyu' else '清泽园的四枚印记','origin':meta['origins'][cid],'boundary':boundary,'bounds':[round(x,2) for x in bounds],'features':features,'roads':roads,'landmarks':landmarks,'questOrder':[p['id'] for p in landmarks],'start':[round(x,2) for x in start],'routes':routes,'extentMeters':[round(maxx-minx,1),round(maxz-minz,1)],'attribution':'© OpenStreetMap contributors · ODbL 1.0'}
    print(cid, 'features',len(features),'roads',len(roads),'routes',len(routes),'extent',out[cid]['extentMeters'])
(ROOT/'src/campus-data/spatial.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
(ROOT/'public/data/campus-spatial.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
(ROOT/'public/data/osm-source.geojson').write_text(json.dumps(geo,ensure_ascii=False,indent=2)+'\n')
print('Validated all game-route segments against campus bounds and buffered building footprints.')
