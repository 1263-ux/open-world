# Asset and dependency sources

Date: 2026-10-29. This prototype uses original procedural geometry and CSS, with no copied external photos, maps, textures or Hks assets.

| Item | Source | Permission / treatment |
|---|---|---|
| Campus names and indicative landmark relationships | https://www.tyut.edu.cn/xxgk1/xydl.htm | Facts/reference only; school images not redistributed. See round-00 research for uncertainty and source dates. |
| Three.js + OrbitControls | https://github.com/mrdoob/three.js | MIT package; retain distribution license. No full example app copied. |
| Vue | https://github.com/vuejs/core | MIT package; retain distribution license. |
| Procedural building/tree/road geometry, UI and quest code | Generated for this project and integrated/reviewed here | Original schematic assets, not a claim of exact architectural reproduction. |
| Hks | https://github.com/ShanEior/Hks | Not included: no verified license for current code/assets. |

Building coordinates are local illustrative coordinates, not geographical survey data. No recognizable people, access-control or security-system details are collected.

## Round 03 geographic data

OpenStreetMap-derived polygons and clipped road centerlines: © OpenStreetMap contributors, ODbL1.0, https://www.openstreetmap.org/copyright . Runtime derived data is supplied in public/data/ with its source snapshot and license notice. No OSM tiles are used. The exact footprint polygons are preserved, projected into WGS84 local meter coordinates. Community height tags and floor-based height estimates are explicitly marked; not a survey or verified current facade.

Offline geometry validation/cropping reuses Shapely, and route generation reuses NetworkX A*. Derived game routes are not real walking/navigation directions and avoid building footprints in the game model. No unverified new buildings are generated to fill coverage gaps.

## 密集建筑轮廓与高度候选（2026-10-30）

- **Overture Maps 2026-10-21.0**：来源 https://docs.overturemaps.org/guides/buildings/ ，许可/署名 https://docs.overturemaps.org/attribution/ 。实际校园候选虎峪100、迎西143；筛选后94/129个建筑多边形，保留原15个OSM命名楼体。底层含OpenStreetMap和East Asian Buildings (Shi et al., DOI10.5281/zenodo.8174931)，ODbL1.0。派生数据库与来源裁片公开随应用提供，不把这些图形称为现场核实楼栋数。
- **Che et al., 3D-GloBFP**：Zenodo https://doi.org/10.5281/zenodo.15487006 ，作者Figshare https://doi.org/10.6084/m9.figshare.28904453.v4 ，CC BY4.0。2020时点机器学习预测，非实测楼高。只用高重叠、无冲突的高度属性；不覆盖已有OSM楼高/楼层。来源、裁片改动、文件checksum和处理门槛见 public/data/sources/manifest.json 与augmentation审计。允许按许可署名使用/改编，保留原作者信息及派生标记；与OSM/Overture混合后仍遵循其ODbL义务。
- **本轮官方照片**：梅花教室 https://xiaoyou.tyut.edu.cn/info/1078/1809.htm ，迎西机械馆照片入口 https://www.tyut.edu.cn/xxgk1/xydl.htm 。仅作外观参考，不把原图/贴图放入仓库，不据照片推造未知真实尺寸。
- **Three BufferGeometryUtils**：已安装Three0.186.1的MIT addon，https://threejs.org/docs/pages/module-BufferGeometryUtils.html 。复用mergeGeometries降低补充体块draw calls；无新增闭源模型/贴图。

## 机械馆自制 GLB

- 文件：public/assets/campuses/yingxi/mechanical-hall.glb，169324字节，3369三角形，无纹理/外部资源。
- 占地源：OSM way182055474，保留原始25个基底顶点；OSM署名与ODbL来源义务同上，原始/派生多边形可在public/data找到。
- 外观参考：官网机械馆照片 https://www.tyut.edu.cn/xxgk1/xydl.htm ，仅目视参考，未把照片嵌入模型或仓库。
- 原创网格：石色立面、拱门、钟面、线脚和窗框由脚本自制；背面、朝向与高度为简化/推断。侧翼约9m、钟楼最高14.95m是展示估计，不是实测。
- 生成和验证：scripts/landmarks/mechanical-hall；详细边界/来源见同目录说明和public资产元数据。模型尚须在Three实际画面中验证，CPU预览不等于产品验收。
