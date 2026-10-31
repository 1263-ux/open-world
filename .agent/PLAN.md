# 当前有界续建 · 虎峪口袋庭院

2026-10-31 08:40 UTC。C2 + R-ui + R-runtime + R-architecture + A3。仅关闭v5实际虎峪三处前场稀疏缺口；设计/新官方资源核验见DESIGN末节。无新增付费、凭据、后端或多人。

## 基线与边界
main `60da4b5` 为文档提交；已验应用 `6c5fb3fd4034537a402e4fff13990dae2a235745`，v5同URL已发布健康核验。当前调用链仍App→CampusScene.buildCampus→既有GLB/前场→PlayerController，保持footprints、ID、存档、摄影、小地图/Hks。已重读AGENTS/四工件及实际clearRoutes、虎峪ground/planter实现，复用现有GLTFLoader/实例化与原创样例家具。

## 单写分工
- build_huyu_pocket_gardens：仅新增 `src/scene/HuyuCourtyards.ts`、`public/assets/environment/*`、`docs/resources/huyu-courtyard-assets.md`。最多2树2灌木免费CC0子集；包不可全塞运行时；记文件许可/hash/字节/三角面与派生处理。若无法核清则不用该资产。
- scene owner：仅 `src/scene/CampusScene.ts`、`SurfaceStyle.ts` 集成与生命周期；不并写新模块。确保园景实际出现在北门/梅花/图书馆三个英雄视角，所有路线段/footprints净空，原碰撞与相机规则不放宽。
- integrate/release owner：既有tests/config/CI/发布与CURRENT_STATE/RESULT；先有快速定点场景CI取得三图和真实路线证据，再跑适用最终回归，避免每个试摆全量昂贵套件。
- planner：仅DESIGN/PLAN，本轮不并写CURRENT/RESULT，不动源码资产或远端。

## 实施与退出
1. 选小子集→许可/字节/hash确认→原创木椅/花池组合；本轮只做三处口袋庭院，不添新楼/道路或全校森林。
2. 场景接入与释放；用所有graph路线段和建筑footprints检查树/椅/边缘，正常相机下可见种植边缘+椅+树冠语境。先出三张真实输入英雄图；“代码中有”不算完成。
3. typecheck/lint/针对性单测/build、定点真实虎峪连续步行/相机/三图、资产预算与draw/triangles/帧实测。与v5同机位或可比视角检查改善；失败先改布局，不改路线/碰撞/截图作弊。
4. 最终同身份受影响回归：两校区切换/小地图全景保位、手机横屏输入、摄影/Hks往返、资源迟到/失败/重复释放。只重测依赖触及路径；旧证据冻结须身份可比。
5. fresh实际像素复核确认三处不再空场、无新障碍且资产成本有界，即停止本轮美术增加。验证后按已有main/原公开URL授权发布，核CI终态/资源hash/回滚到v5；准确更新CURRENT/RESULT。不声称全校园完成、实测复原或实体手机性能。
