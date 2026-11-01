# 完整版本候选：静态冻结，运行验收待办

## 14:38 冻结静态候选，真实运行门禁待办

Phase: VERIFY/TRIAL pending。生产代码与测试已冻结，独立源码复核接受；修复了初始飞行点在重叠碰撞体中的误判、相册/手记互斥及重拍死锁、多触点释放误清输入、地面站位提示与存储措辞。原 v6 正常公开版未变。
- 当前完整功能候选 application 223 inputs manifest SHA256 `cb3738ac128114c340ec1472f72d1cf77512da33298ae4c0081570275c58c049`；HTTP build63 files manifest `9507799f9eb7e2caf8194f2c090a7601339dfe44365e0edbc61a4f2fc75f2ca9`。
- Typecheck/lint/116 单测/build/离线静态打包通过；49 个 E2E 仅发现，零执行。不能据此说核心旅程已经可玩通过。
- 源码独立复核、严格离线资源嵌入/许可打包、CI最小新增门禁均已审查。CI只将现有quality超时30→45分钟并追加3个新核心spec；既有9 jobs及所有检查/权限保留，没有执行远端。
- 平台仍是已验证静态几何与 CPU 碰撞的灰模。真实输入上/下台与高处摄影、纸飞机成功/失败/重试、桌面及横屏触摸完整旅程、模式/焦点/存档/性能尚待实际浏览器证据。通过灰模实际通路后，再由真实 Astra API 完成必要平台视觉，保持碰撞合同。
- 当前本地进程浏览器不可启动；已存在的云浏览器访问稳定站也显示 WebGL context 不可创建。没有修改安全设置/引擎flags或绕过禁止路径。GitHub Actions 免费用量/预算证据尚待合法只读核验，不新建远端CI/push/deploy，不扩大费用。
- QA建议首次真实批次覆盖新核心3spec、control-direction、quality-slice（含完整触摸主线）、two-campus-release、minimap，保留原CI的Hks/focus/offline门禁；历史渲染诊断不默认运行。飞行等待使用最多180s软件渲染外限，同时记录simulated/wall时间，成功与3门断言不放宽，不代表性能达标。
- 下一步只关闭运行/额度门禁，不扩更多未验证功能。用户要求下一次集中交完整版本，不发局部模型或零碎推送消息。

## 实施与历史证据

# 当前完整交付实施状态

## 14:17 当前实施轮：完整可玩版本（优先于下方历史）

Phase: IMPLEMENT。研究已完成并经主控读审：工作区 full-release-research/product.md 与 engine.md；已更新 AGENTS/DESIGN/PLAN，按其单写文件合同并行实施。
Product Core: 在真实比例双校区中完成可自由探索、摄影、实际登高、纸飞机及手记结算的一次完整浏览器游玩。
Primary User: 初访或回访校园、希望短时可玩而非仅看地图的访客。
Role Ownership: Astra API 为最终原创建模作者；独立执行者审脚本/导出，模块实现者各管指定文件，主控统一源身份/预算/发布，独立 QA 与图审提供证据，用户只做大成果判断。
Non-goals: 后端、多人、真实楼体内部测绘复原、全校 BIM、新超现实/光影/透视谜题。
Forbidden Claims: 未实际走通不得称完整版可玩；模型/单测/离线图不是 runtime；模拟手机不是实体手机；赠金余额与推理标签不能猜测。

已分派：integrate_complete_campus_play 独占 App/Scene/PlayerController/contracts/style/活动适配；implement_paperplane_simulation 纯飞行；implement_campus_journal_ui 摄影/手记/组件/单一新存档；implement_viewing_platform 灰模、实际落位/碰撞代理与既有站点模型复制；verify_complete_campus_release 新测试；规划者仅当前三份计划文件。原 v6 恢复目录、已接受机械馆/梅花模型保持。

迎西完整主线：3 张照片（旧2+高处1）→真实1.20m无顶低台上下行→3门+终点纸飞机成功→手记结算/重玩/保存；虎峪原完整探索与美术照常验收，Hks可选。后续地图/摄影/飞行/Hks互斥输入并保位，单一旅程存档保持旧key/ID。平台确切落位待全占地/道路/所有路径/视线核验，未核前不声称可达。

旧静态通过仅对应旧冻结身份，新生产代码正在修改；当前不是全检查通过。禁止新远端 CI/push/deploy，直到免费 Actions 重置得到核验并由主控恢复。普通 main 推送已授权，不重复索要，但不绕必需确认或费用限制。本地浏览器仍不可用，不重试受限路径。可继续纯逻辑/灰模/静态准备；真输入验证前不追加昂贵平台精模。下一次用户成果集中交完整游戏，不发局部预览。

## 先前阶段记录（不替代新身份验收）

# 当前状态

2026-10-31 12:52 UTC。C2 + R-ui + R-runtime + A0。本地候选；未发布。

## 目标与约束
用户 12:44 要求继续精修。重点是重点建筑辨识度和三处庭院与路线衔接，保留人尺度、两校区、正确左右控制、小地图、摄影和 Hks。免费 Actions 额度待重置核验；不新增远端 CI、push、付费或部署。公开 v6 保持稳定。

## 权威来源与恢复
工作区旧快照不作为当前源。已从 GitHub 只读恢复 v6 commit `3febd05b43341c2b32f678508b6e44e9024b0c4a` / tree `3e1e0ff7fd1acac50e406ad439116e2a4be382d3`，237 blobs 逐一核验。恢复目录 `open-world-recovered-v6` 不修改；当前 `open-world-art-candidate` 是隔离集成副本，不冒充已提交 commit。
庭院来自 `698b9076f0e1ec05f9f00ea5c2af74e9ee59db1d`，仅白名单模块、场景入口、叶图/许可、来源说明、生命周期测试纳入；禁止覆盖其旧 PlayerController 和测试。当前 PlayerController SHA256 `03f91d8cd05ce27b7694ea090f1762aa1dbada9908dbbac17dc8dbc9a40f3b61` 保持 v6。

## 当前集成
- 已接受庭院布局微调 SHA256 `b5ab8210f0911d4bee0cabc7a2b0249ca4cde093e53f7be894862db3da707f75`；相对原接受模块仅三张椅子 z 坐标改变。
- 梅花实体窗台/檐边三文件精确恢复；GLB `9d36f02c61fa959198b70bed3e7c851e185f164133a954e282bd9c1d400f1da0`。五占地/4.5m 估高/bounds 保持，1158 三角面、82956 bytes；离线改善细微。
- 机械馆新增圆窗、石拱、窗台和檐口层次，修复重叠几何黑斑。GLB `909415d5968afede94bc64cc7a471fddf300e41455d0f6d260c2f3c9a1d674fb`，18617 三角面、989908 bytes、7 primitives；25 footprint 顶点和 bounds 保持。独立图审接受离线几何候选；参考照片只支持形式，不证明尺寸/现状。双方离线图统一色板，不证明游戏材质效果。
- 独立图审只接受梅花/图书馆三张椅子靠种植边缘的局部组合，已纳入。叶色和北门跨路实验被暂缓，未纳入。局部离线图不能证明完整庭院与道路已协调。

## 证据与未通过门禁
恢复组合在机械馆更新前 typecheck/lint/78 单测/build 通过；机械馆独立 GLB verifier 通过。机械馆更新后的集成检查由 QA 记录最终身份。新增连续双校区路线测试只完成发现与静态核验，未执行。
本地 Chromium 在页面创建前因 socket EPERM 失败；没有安全绕过。新组合运行时行走、贴墙/镜头、真实游戏同视角截图、手机/性能均未验证。静态检查和 Blender 图不构成游戏 TRIAL。

## 下一步
冻结最终有界候选与身份；核验免费额度重置后，先处理 v6 main 同步（main 历史仍60da4b5），再按最终候选白名单跑真实路线、近景/阴影、触屏及受影响流程。通过 fresh review 后才更新现有公开 URL。不要误上传 QA 诊断 workflow；现网 v6 为回退锚点。


## 13:05 继续推进后的入口连接（本地）
用户认可机械馆预览后要求继续推进。已用真实场景几何、地图道路、现有树椅和固定 GLB 完成离线整场配对检查；只补门阶到旧步道的地面断口，未重建路网。CampusScene.ts SHA256 `2ae8e1c69cb5b9db72830ead03bc837612b9dc2ca7d00fb90b91f35c062d9d52`。新增 1 mesh/6 triangles/0 collider，101 个原 collider 保持；无建筑重叠，mapped road 含路缘净距 0.272m。独立图审接受局部连接，远景提升有限，不是整体校园完成。
1.7m 离线图为人眼研究，不是实际第三人称相机；必须继续验证新 .05m 地面与旧 .11m 步道交界、连续步行和镜头。Blender 中黑接缝不能直接认定游戏缺陷。最新统一静态检查见 final-entrance-candidate-qa，未执行 E2E/未发布。
机械馆 canonical generator 改为单一来源，旧 scripts/art 入口为兼容包装；两入口验证均精确再生已接受 GLB909415...，模型几何未变。metadata generator 字段已修正。


## 13:51 用户指定 Astra API 主建模
用户明确复用本项目 API，由 Astra 做主建模并更新团队/计划；新方向为纸飞机、摄影探索、有限立体空间，排除超现实谜题。原3份计划作为历史Draft，当前AGENTS/DESIGN/PLAN已改为新的角色和阶段门禁。
已核既有项目凭据可访问 models，精确模型 `gpt-6-astra`。13:57:58 UTC 首次真实 Astra pilot completed：原创纸飞机折叠/投掷站的完整 Blender 生成脚本；603 input +6563 output=7166 tokens，output已含2070reasoning。按官方标准短上下文价估算 $0.33418；不是账户账单或赠金实际扣款。累计保守pilot估算 $3.43195，仍保留 $5 guard；项目 $90 总上限和真实余额未知的限制不变。
原始 API 返回和单次最小输入manifest在仓库外 api-execution；首轮仅原创设计简报，没有发送仓库/照片/凭据。资产执行者只负责审查、运行、验证并单记人工patch，不把原生助手冒充 API Astra。生成模型/图审状态以后续实际证据更新；未集成玩法、未部署。


Astra pilot 实际导出：`asset-candidates/astra-paperplane-station/station.glb` SHA256 `e2e5269d8e205fd0484b4ff9f891e6431087f5523c667e20c57d2d7ee5dde4a9`，12844 bytes、180 triangles、4 materials/primitives，2.24×0.96×1.42m，台面0.95m。核心设计/生成脚本来自上述真实 Astra API；执行者只修一处 Blender tessellate_polygon 返回类型兼容，不重写造型。原脚本、执行脚本、补丁、独立几何/站位检查与四张真实离线渲染均保留。站位与发射方向不同，后续玩法需显式转向；资产不是已实现玩法，尚未进入校园 runtime 或公开版。
