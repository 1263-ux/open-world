# 实施计划 · 第三人称校园品质样板 + 完整原版 Hks

更新：2026-10-30 UTC。`C2 + R-ui + R-runtime + R-architecture + A3`。

## 本轮目标 / 非目标

自行验收并持续实施：先把迎西机械馆→清泽园做成温暖清晰、有独特美术、人尺度、连续可控的横屏第三人称样板；接入完整 `ShanEior/Hks main@7199cae` 原生1280×720/420秒；与给定参考按证据比较；验证后直推 main 并升级现有公开链接。用户只做重大成果验证，**不等新一轮批准再开始常规实施**。

不做本轮后端/多人/室内/GIS，不任意改米制占地，不重写 Hks，不把未验证候选覆盖现网。G0、详细美术与验收见 DESIGN；最新授权见 AGENTS。

## 当前调用链快照

- `src/app/App.vue` 的 `onMounted` 创建 `createCampusScene`，`travel()` 调用 `scene.navigateTo`，`onSceneEvent` 管到达/任务；`openHks/closeHks` 暂停/恢复校园。
- `src/scene/CampusScene.ts:createCampusScene/navigateTo/tick` 原先为 OrthographicCamera + OrbitControls、按路线自动移动 pawn。场景实现者正在加入独立人物控制/透视相机与手动到达；必须验证真实输入，不凭新增类/aria-label 声称完成。
- `src/scene/LandmarkModels.ts` 按地标异步导入 GLB；保留世代校验/失败基础体块/释放。
- `src/components/HksOverlay.vue` 懒加载同源子页；`games/hks/src/main.ts` Phaser factory 提供退出清理与只读测试快照。旧 `config.ts` 在本轮开始为1024×768、手机600×960、300秒；这些是待替换的旧行为，不是目标。
- 工作区当前没有可用本地 HEAD，不能把历史 CI SHA 当当前树；最终集成者须建立候选 fingerprint/commit，再执行对应验证。

## 文件所有权（并行但单写）

| 工作流 | 唯一写入边界 | 交接要求 |
|---|---|---|
| 规划/验收 | `AGENTS.md`、`.agent/{DESIGN,PLAN,CURRENT_STATE,RESULT}.md` | 其他文档只读；先给实现者可执行标准 |
| 场景/角色 | 主控指定的 `src/scene/*`、`src/shared/contracts.ts` | UI 若需接口只交契约，不同时改 App/CSS |
| UI/布局 | 主控指定的 App/components/style 文件 | 横屏、收起面板、返回人物、操作说明；不写 scene/Hks |
| Hks | `games/hks/**` | 固定完整上游身份、清单、适配 diff、原生横屏与自然输入证据 |
| 测试/集成/发布 | 主控分配 tests/config/lock/部署面 | 合并前报告冲突；最终同一身份跑验证与发布 |

实际分派以主控明确到文件的消息为准，不能由本表推导共享文件写权限。规划者不修改 src 或 games/hks。

## 顺序与退出条件

### 1. 已完成：定向研究与纠正边界

已读取三份原始计划、当前规则/历史状态、现有源码；阅读 Three OrbitControls 和 Phaser Scale Manager 官方文档；本轮参考网站读取失败，准确记录 WebGL/玩法未知。复用现有引擎/数据/GLB，不重新选栈。纠正“角色未定/公开未授权/Hks所有权待确认/竖屏300秒”的过时假设。

### 2. 实施中的两条主线

**校园：** 人物尺寸与速度→真实键鼠/触摸控制→镜头→碰撞/边界/失焦→机械馆起点与清泽园连续路线→统一日光/色板/路缘/铺装/树群/近景尺度→简洁横屏 UI。三处空间节拍都要可走，不能先扩全校园堆模型。路线按钮只开启引导，不能代步。

**Hks：** 解析 main7199cae 完整 SHA→拉取/保存完整来源清单→逐文件确定适配差异→保留原图/技能/教程/战斗/结算→iframe 生命周期→1280×720/420s/FIT→桌面与触屏实际试玩。已有源码来源声明不等于目标上游已经完整集成。

### 3. 最终本地验证

1. 核对候选 diff、文件所有权、无秘密/原始参考图/未知许可资产；记录 fingerprint/commit。
2. `npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`；增加本轮新人物移动/碰撞/相机逻辑的针对性测试。现有空间生成/GLB/离线链受影响才解冻重跑。
3. 真实浏览器 `npm run test:e2e` 覆盖 DESIGN 的 C1–C5、H1–H3、R1，尤其真实键鼠移动/转向、失焦、贴墙、完整连续样板、hasTouch 双区输入、地图返回人物、Hks 前后位置/存档、重复进出/音频与失败恢复。
4. Hks 常量/画布运行值同时核对；实际战斗/升级/自然失败/重玩/返回。后期/Boss/自然胜利未到达就列缺口，不注入时间/血量/经验伪造通关。
5. 三节拍同构建截图 + 控制台/trace，标注设备/网络/FPS/加载采样；UI 静态布局检查只补充，不能代替触控试玩。

### 4. 自行验收与参考比较

fresh-context reviewer 只收 Goal/Constraints/Diff/Evidence/Questions，不收“已经很好”的结论。发现阻塞先修再定点复核；非阻塞建议入下一轮，不无限审计。

按 DESIGN 比较表逐项记录。参考若仍无法渲染，诚实保留“UI已观察、游戏未验证”；继续完成自身可验证改进，不要求用户解决参考站 WebGL。用户授权自行验收，不需要再次发选择题，但最终重大体验判断仍交用户。

### 5. 发布与闭环

- 候选通过后，主控在已授权目标直推 main，核对远端 SHA 与 CI 终态。非同身份 CI 不串接为 PASS。
- 现网仍为 `https://tyut-campus-world-private-preview.aglowswan513.chatgpt.site`。保存其上版部署/构建/产物、确认可回滚，再验证候选公共 HTTP 资源与核心旅程，最后升级相同站点。
- 升级后重查同一 URL、部署身份、首屏控制、模型加载、Hks进入/退出；失败回滚到上个已验证部署。未确认成功不报告“已上线改进版”。
- 更新 CURRENT_STATE/RESULT，先向用户给可玩成果、关键实证及剩余缺口；若 CI/部署在跑继续跟踪到终态，不止于“已触发”。

## 风险 / 故障路由

- 同时输入冲突/碰撞卡住/镜头穿墙 → targeted真实输入重现；两次同假设无新证据改设计，不持续补丁。
- 地理数据与装饰冲突 → 保留米制占地/ID，改装饰/路径，不擅自移动真实建筑。
- 原版恢复引起测试依赖旧300秒/竖屏 → 修测试预期与真实截图，不倒改原玩法迎合旧测试。
- 访问失败或浏览器环境能力不足 → 明确 action/target/reason/已完成/状态，有限重试、继续独立实现，不把未测写通过。
- A3 当前授权覆盖既有游戏升级；新付费/扩大权限/无关目标才需要特定新授权，不重复询问已有许可。

## 本轮研究引用

2026-10-30 已读：[Three OrbitControls](https://threejs.org/docs/pages/OrbitControls.html)、[Phaser Scale Manager](https://docs.phaser.io/phaser/concepts/scale-manager)。参考原链接和 `jlu.online` 的 web 读取失败；Firecrawl live fetch 返回内部代理 `ERR_TUNNEL_CONNECTION_FAILED`。可复用结论与不确定项见 DESIGN。

## 当前品质切片（2026-10-30 14:11 UTC）

用户最新要求：持续深度调研、自行试玩改进，未有实质高质量成果不发零碎进度。研究与验收标准见 docs/research/game-quality-benchmark.md；此要求不是“已达到市场一流”的证据。

1. 本轮固定CC0 Quaternius Hoodie、1.75m人尺度、Idle/Walk/Run混合、原创Idle-based跳姿与近镜淡隐，确保失败回退/迟到释放；来源及限制在 docs/resources/quality-assets.md 和角色metadata。
2. 收紧近景单sun阴影并保留地图范围；原创米制地表和多团树冠保持。没有新造真实校园事实。
3. 两站自主取景→记录印记→本地明信片；场景投影/距离/遮挡判定，无自动走路；旧章节/Hks保留、无账户/外传；导出保留地图/高度来源。
4. 在同一候选运行旧场景、Hks、离线、headed真实焦点及quality-slice六场景；人工目视机械馆/连接段/清泽园、导出图、角色动作、近墙和手机。静态54单测不能替代这些。
5. 失败必须定位真实场景或测试机制，不修改状态/RNG/时钟造成功；修复后复验相关路径。若全过再fresh review/版本身份核对/既有公开站点升级。当前不发布。
