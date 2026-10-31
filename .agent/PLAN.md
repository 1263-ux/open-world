# 双校区统一建设计划

2026-10-31 UTC。C2 + R-ui + R-runtime + R-architecture + A3。目标/依据/验收见 DESIGN。调研先于此计划完成，立即在授权范围建设，不再等逐项美术批准。

## 当前调用链与身份
App.vue创建createCampusScene→CampusScene.ts:317 buildCampus数据驱动双校区→LandmarkModels.ts加载4个GLB异步替换→SurfaceStyle材质/树冠。PlayerController真实操控保持；Vue保存任务/摄影，Hks同源iframe隔离。
集成人核对：远端main14a8877/tree6b48b9f；dev/campus-thirdperson9034aea/tree4e924e0。本地无可用HEAD，除未发布 tests/e2e/hks.spec.ts 自然手机升级修改外与dev blob一致。不得reset吞改动或把dev诊断当main发布认可。

## 精确单写边界（最终分派以主控消息为准）
| Lane | 唯一写文件 | 交接 |
|---|---|---|
| 场景 unify_two_campus_scenes | src/scene/CampusScene.ts、SurfaceStyle.ts；必要新增CampusDecor.ts | 两校园灯光/表面/细叶/家具/通用楼统一，兼容原导出；自己集成新模块，不让其他人写CampusScene |
| 地标 refine_campus_landmarks | src/scene/LandmarkModels.ts；必要新增src/scene/LandmarkStyle.ts | 仅运行时语义材质/色板；保留几何、边界、坐标、featureID、节点契约；不改生成器/GLB/metadata，确有必要先由主控授权 |
| QA/集成 integrate_two_campus_release | 主控分配的tests/config/发布面 | 保留本地未发布hks.spec.ts；读资产新hash、核候选身份、全部受影响验收。App/style必要修复先领单写权 |
| UI add_campus_minimap | src/app/App.vue、src/style.css、必要新增src/components/CampusMinimap.vue | 左上SVG小地图点击既有全景模式；复用当前校区与状态、返回人物不丢位置；不建第二WebGL；worker做针对性官方UI文档核验 |
| 计划 plan_two_campus_build | 仅.agent/{DESIGN,PLAN,CURRENT_STATE,RESULT}.md | 不改AGENTS、源码、资产、测试或远端 |

用户新要求授权第四UI lane，其他UI不额外扩建。共享contracts默认不改；App/style仅UI lane写。本轮不再生成已验证模型；二进制/生成器默认冻结。

## 实施顺序与停止条件
1. 场景与地标并行各形成完整两校区风格，不陷单个窗/参数永续小修。先保留几何身份，再统一材质、路边/叶冠，最后补关键人尺度细节。
2. 集成同一树；核spatial/ID/存档/摄影与Hks契约未变，检查GLB边界与许可、资源体积与清理。保持诊断显式且不进入普通发布路径。
3. npm run typecheck/lint/test/build与受影响模型/空间验证；运行最终候选正常E2E、quality、offline、focus、Hks回归（以package真实脚本/CI为准）。真实输入完整两校区旅程与手机横屏；新增小地图需验证两校区左上显示、点击全景与返回保位，SVG无第二WebGL；截图不能替代试玩。
4. 主控与独立fresh reviewer按DESIGN六项验收。阻断/风格不统一定点修复后复核；非阻断建议不扩大本轮。两次同假设无新证据转RETHINK，不无限调参。
5. 在既有main与既有公开校园站授权内，核final diff/秘密/许可→推main→等同身份CI终态→候选公开资源和关键路径→升级原URL→查部署身份/资源/Hks/回退。失败恢复保存的上一正常部署，不把旧源码重构建冒充回滚。

## 风险
细叶透明过绘/阴影成本→分块实例化、预算与实测；新装饰挡路/摄影→只放空地、原碰撞/摄影回归；运行时地标装饰越界→保留原几何，仅语义材质；必要附加细节须另有授权并比对bounds；无WebGL→准确记录环境限制，继续可运行CI实证，不声称线上3D已玩。新增费用/权限/无关站点不在授权内。
