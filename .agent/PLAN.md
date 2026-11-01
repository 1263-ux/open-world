# 实施计划 · 下一次交付完整可玩版本

2026-10-31 14:20 UTC。C2 + R-ui + R-runtime + R-architecture + R-data。产品与引擎深入研究完成；主控已选低开放平台/单一手记存档/无随机纸飞机等方案。**主控已分派有界实现；此文不代表新功能或runtime已通过。** 下一次外部成果交付完整游戏，不再发局部模型/零碎截图；内部仍分小切片验证。

## 已选方案与不可漂移边界
- 迎西5–15分钟目标主线：开始/继续→hall+garden两旧摄影→真实走上原创低台并拍第3张→纸飞机3顺序门+终点成功→手记结算/继续漫游/重玩。飞行成功属于完成条件，失败可立即重试；Hks独立可选。
- 虎峪完整既有探索和梅花/庭院照常交付验证，不复制新增活动，不新增第四类超现实/光影/透视谜题；普通摄影构图保留。
- 平台deck1.20m、groundfoot.12m、6级×.18m、踏面≥.40m、净梯宽≥2.4m；中心XZ(60,179)、5×5m，北侧同一条2.4m宽梯负责上/下行，实际栏边及无阻地面绕行；不要求两个独立台面出口。开放无顶，不做旁侧covered passage/真楼内。
- 一个renderer/RAF/现有Octree；优先窄只读segment query注入，不先抽整WorldCollision。固定60Hz、最多6步/frame、无随机风、有限高度点代理连续碰撞，绝不宣称机翼CCD。
- 一个新journey:v1存档，旧quest/photo key/ID不动；不另建竞争的paperplane存档。图片会话内/可导出，进度持久化，文案必须区分。
- 用户已给main直推/原公开链接授权，14:07重申无需普通推送确认。适用检查、免费额度核验和实际工具权限满足后主控自主推进；不代批准PR、不绕权限/加钱/skip-ci。远端门禁尚未解决前不新建CI/push/部署。

## 研究依据与现状调用链
研究原文：`../full-release-research/product.md`（官方游戏体验结构、保存/UI/验收）与`engine.md`（锁定Three0.186.1及Octree/控制器源码、官方docs/风险）。阅读日期2026-10-31；未声称试玩这些参考。DESIGN明确采用/不采用项。
现状：App持有校区/旧任务/摄影/Hks → CampusScene单RAF/renderer → PlayerController自有Octree(源建筑挤出+同步props)；GLB仅异步替换视觉。摄影inspectPhoto仅XZ/构图/遮挡，需新增可选heightRange；setPosition(Point2)落地，不能拿来恢复高台pose；影子固定.135需支撑面处理。App目前摄影硬限迎西，符合本轮新增内容集中迎西，无需为虎峪改接口。
当前 `open-world-art-candidate` 入口组合manifest `165b3653861f997f04e5bd654415e6584c344b64b38ac1d59ef39237cb4940b9` 静态通过、真实E2E未跑。公开v6应用`3febd05b43341c2b32f678508b6e44e9024b0c4a`保持；恢复v6目录只读，旧open-world不是当前源。

## 单写者分工（主控已绑定）
14:20绑定：共享集成人 `integrator`；纯飞行 `implement_paperplane_simulation`；摄影/手记UI `implement_campus_journal_ui`；平台 `implement_viewing_platform`；QA `verify_complete_campus_release`。下表文件边界保持。
| 单一角色 | 唯一可写文件/范围 | 不可越界 |
|---|---|---|
| **共享集成人** | `src/app/App.vue`、`src/scene/CampusScene.ts`、`src/scene/PlayerController.ts`、`src/shared/contracts.ts`、`src/style.css`；新`src/scene/PaperplaneActivity.ts`（renderer/input/camera适配）；根配置/部署 | 负责所有共享入口与模式契约，其他作者只交接口需求。无需求不动依赖/锁文件；不改Hks上游 |
| **纯飞行实现者** | 新`src/games/paperplane.ts` | 纯状态/数值/门跨越/结果，不直接写App/Scene/storage/DOM或建新RAF。只依赖约定数值输入与只读碰撞结果 |
| **摄影/手记UI实现者** | `src/games/photography.ts`、`src/components/PhotoJournal.vue`；新`src/games/journey.ts`、`journey-storage.ts`、`src/components/JourneyPanel.vue`、`PaperplanePanel.vue` | 新key只在journey-storage定义；不改旧quest.ts/storage.ts/questOrder；组件样式用scoped，根style仍集成人 |
| **平台资产/代理执行者** | 新`src/scene/OriginalViewingPlatform.ts`；`scripts/landmarks/viewing-platform/`中明确generator/verify；`public/assets/exhibits/viewing-platform.{glb,metadata.json}`；若接入已接受站点，仅`public/assets/exhibits/paperplane-station.{glb,metadata.json}`复制与来源登记 | 不覆盖机械馆/梅花/园景GLB，不写CampusScene/PlayerController或spatial.json；Astra负责最终原创建模作者，执行者审代码/导出/记录patch |
| **Astra API主建模/主控调用者** | 模型返回隔离generator/参数/metadata；主控唯一管理API runner、输入manifest、usage账本与预算释放 | 真实API身份，不原生改名；不上传全仓库/秘密、不自动追加调用。灰模通路与尺寸确认后才考虑下一次有用建模 |
| **QA** | 新`tests/unit/{paperplane,journey-storage,photo-height,player-vertical,platform-layout}.test.ts`、`tests/e2e/{complete-release,paperplane,vertical-exploration}.spec.ts`；既有测试需修改先列具体文件给主控 | 不写生产代码来迎合测试；输入helper单写者仍由主控明确转交。直接运行测试不等拥有文件 |
| **fresh reviewer** | 只读最终diff/manifest/实际像素/输入旅程/预算 | 实现者不自批，关键finding回原owner，非阻塞美化不扩本轮 |
| **规划者/主控工件** | 规划者仅AGENTS/DESIGN/PLAN；主控CURRENT_STATE/RESULT | 三份初始Draft保留原文；同文件禁止并发 |

文件名是本轮准入边界，不单凭计划声称已创建。每次共享接口变更由集成人一次更新，通知worker后再接入；不因多Agent先造框架。

## 先冻结的接口/状态/资产契约
- `PhotoPoint.heightRange?:[min,max]`默认缺省兼容旧点；高处目标单独稳定ID，以footY校验finite range，保留距离/遮挡/构图/ready条件。
- 飞行状态最小`idle→ready→flying→result`，pause为生命周期门控；结果包含成功/碰撞/漏门或越界/超时/取消，终态仅一次。纯模块接收dt/input和只读finite segmentHit，不持有Scene/DOM。
- Scene adapter用现有RAF驱动，飞行只disable人物输入/冻结capsule，不pause整个Scene；App单一互斥mode控制地图/摄影/Hks/切校/弹框，photo poll/E不得读取飞行camera。begin/input/launch/retry/end等小方法及≤10Hz事件由集成人定型，不将Vector塞Vue每帧响应式。
- 本轮从地面站点发射，不声称实际高台飞行；飞行退出恢复保留的xyz/yaw/pitch/校区/目标；保持capsule原地优先，不用XZ setPosition。取消、销毁、迟到load、重复点幂等；hidden暂停/显式resume并清时钟/input。
- 碰撞：复用PlayerController世界，有限线段最早world/ground/envelope命中先于门；normalized ray有距离上限，零长度不归一化、起点在固体拒绝、真实估高参与，非无限高XZ建筑。
- 平台模块返回同步visual+独立colliders，GLB成功仅换显示；代理闭合/法线正确、栏边不能成跨步攀爬捷径、无强制跳跃，资源归属清楚。站点metadata anchors需显式读取/转场景，不当作GLB节点。
- journey保存稳定完成ID、有限best、教程和安全checkpoint，输入白名单/版本/有限数字校验；不保存飞行中间态/任意高空坐标。重试不清进度；重开手记确认并仅清本轮journey，保留旧任务/永久photo stamps。新一轮完成条件不能被历史照片直接绕过。

## 实施/验证阶段（内部增量，不逐片外部交付）
### S0：身份、运行路径与合同
冻结新分支/本地manifest、当前资源hash、接口和whole-footprint落位候选；核所有route（包括非当前绘制return线）、mapped road+verge、源building/model障碍和两旧摄影视线。主控已审当前whole-footprint静态净空并分派实现：台面XZ(60,179)，高处摄影XZ(60,178)看园中岛；下台后地面站点XYZ(65,.12,179)，面桌−Z/发射+Z。静态净空不是runtime通过。QA指出旧方案“两出口”不一致后，主控明确它是研究附加而非用户要求：改为同一北侧宽梯上下行+地面绕行，不能回写旧条件PASS。
适用历史静态证据可FROZEN，**不为文档改动重跑全套**。先做最小合规浏览器能力探测/免费额度只读核验；EPERM保留准确blocker，不换路径绕禁止。缺runtime时可做纯逻辑/灰模/本地静态准备，但阶段不得标可玩通过或开始昂贵精模。

### S1：风险最高的灰模链
平台真实上/下行+高处height gate+站位启动/取消飞行串通，未精模。共享集成人实现窄query、mode与必要支撑阴影；先复用现有camera，只有可复现近裁剪问题才补探针；撞顶若相关测试暴露再修，不重写全部控制。
Focused tests：6级正常/跑/斜向上下、栏边不攀、跳下落地、旧3浅阶/岛边/方向不回归，高处同XZ地面拒绝、相机/pose保留、pointer取消。真实步行灰模chain是空间可行gate；不能用位置注入/单测替代。失败则改几何或最小控制假设，不先精模遮问题。

### S2：完整飞行循环+手记
并行纯flight与photo/journey组件，集成人顺序接共享入口。1架飞机、3门、1终点；无随机v1、无粒子/后处理/新shader。实际操控能成功一次，故意碰撞/漏门/越界失败后重试成功；触屏、后台暂停、Escape/exit/快速双击、map/Hks/campus互斥。
Focused units：60×1/60与30×1/30一致、不规则dt/6step cap、terminal once、墙前门不计、低帧薄墙/门跨越、零位移/初始固体、高于/低于屋顶。存档旧v1兼容/恶意数字/未来version/拒绝storage、照片像素会话文案与导出实际打开检查。

### S3：Astra有界最终空间+整体艺术
只有S1真实可达和已确定落位/碰撞尺寸后，决定是否需要Astra新建模调用；复用已接受站点，先最小prompt/hash/费用reserve再发。生成器输入只含局部尺寸、通路/站位/碰撞合同、已有色板及必要片段；不发送整个仓库/照片/秘密。原始响应、执行适配patch分存。
预算设计目标：平台+站点新增GLB合计≤500KB、可见新增triangle≤20k、draw≤20（平台尽量≤8）；简单代理≤40，飞机≤1k tri/1material、无新纹理。超限先证明必要性/减量，不事后改门槛。这些是待测工程目标不是设备性能事实。离线同视角+正常游戏相机整体审查入口、树荫、平台/栏杆、飞行标记，保留已接受机械馆/梅花，不把离线图作为最终交付。

### S4：同一身份完整接受
实现写者停笔→集成人冻结application/build manifests→typecheck/lint/全部unit/build/适用模型验证→一个有界最终真实E2E批次。将新核心loop与必须旧旅程合并，复用trace/screenshots不重复跑诊断长套件。
- 干净存档自然开始到三照片/登高/飞行成功/结算/重玩，记录真实时长和first-confusion；失败不能改进度注入。桌面与横屏touch均完成；Hks保留可选进出/重入与声音焦点。
- 两校区完整旧探索、地图保位、摄影保存/导出/刷新、GLB失败/迟到切校/销毁、指针取消/blur/后台恢复；同构建真实路线不与旧CI拼接。
- 同设备同viewport基线/flight/返回采样：至少60s帧时中位/p95/长帧、加载至可控、draw/triangles/buffer/DPR，10次retry/5次切校资源趋势。桌面30FPS/5s仅目标，软件渲染/模拟触屏标签明确，不能伪称普通手机通过。
- Fresh非作者review最终identity、源/许可、真实图与自然旅程；修fix只解冻受影响路径和必要邻接回归。一次核心finding修复后定点复核，不无限审计/追加外观。

### S5：完整发布与交付
门禁都满足后，主控无需普通再次确认即可在既有repo main直推并核远端SHA/CI终态；不得带QA-only workflow/秘密/临时输出。更新原公开URL，核部署身份、资源hash及公开关键旅程；失败回滚健康v6。用户成果包：可玩入口、完整旅程/操作说明、源码/版本身份与真实限制；不是局部模型展示。CI pending/浏览器blocked/缺主线成功证据都不叫完整版已交付。

## 测试与API预算纪律
- 已有$90累计ceiling，grant到期日用户给2026-11-26，真实余额/最终账单未知。旧$5累计pilot guard保持；历史保守估算约$3.43195非余额证明。首站实际token603input/6563output（reasoning2070已包含）估算$0.33418非实扣；原生Agent工作不混为API消费。
- 此计划不自动授权新一批API。每个必要请求由主控先核精确模型/短上下文价格、manifest的input tokens、max output与累计reserve；无法保持旧guard或余额/计费条件不明则暂停该调用，不能为完整版自动加钱。Astra可用/执行/账单证据分开。
- 输入manifest逐条path/source、截取范围/hash、用途/数据资格/bytes或tokens；无env/key/auth、整仓库、无关对话、未许可照片。输出脚本先安全审查，无网络/安装/子进程/凭据读，隔离运行。
- 账本每次UTC/task/request与response ID、requested/actual model、usage字段、价格日期、reserve/估价/累计、账单证据未知；超时先核结果/计费状态，不盲重发。新模型输出足够就停止，不为消耗额度调用。
- 免费Actions reset必须被核实，日历跨月不等于重置。当前不新建CI/push/deploy，不用skip-ci/付费runner绕；可本地focused静态+一批最终验收减少重复消耗。运行门禁不通过可继续有用准备，但不无限扩待验功能队列。

## 主控在实施前需锁定的具体项（不必为常规实现再问用户）
1. 平台/摄影/地面站位及单梯设计已锁定，主控已审静态whole-footprint净空；飞行envelope/门位及完整实际上下行、视线/发射仍须运行验收，不能从静态推定。
2. 上表单写owner已绑定；共享contract及最多一条短flight的速度/门大小/仿真时限初值由集成人锁定；依据灰模试玩调，不保证目标耗时。
3. 合规runtime执行通道/免费额度证据；若依旧被拒/未知，记确切action/target/reason/completed/status，不造新权限或费用。
4. S1后是否值得下一次Astra空间建模、所需reserve能否在$5guard内。若必须提高支出或扩大权限，只对此明确新决定请求用户。
