# 当前计划：默认进入就可见的校园体验优化

更新：2026-11-02。用户在公开 v8 后仍不满意，要求横向调研、吸收复用。分级 **C2 + R-ui/R-runtime，离线打包窄范围 R-security；当前 A0，提交/推送 A1/A2 与发布 A3 分别守门**。不调用 Astra/API，不新增包或费用，不将旧全绿当新体验通过。

## G0 与来源事实
- Product core：保留虎峪/迎西布局参考与明确原创理想空间，提供可辨认、可连续步行、可停留的校园体验。
- Primary user：普通进入网页的桌面/横屏触控访客；无需隐藏画质参数或专用镜头即可发现下一处目标。
- Ownership：集成人独占 Scene/App/contracts 与当前文档、最终 push/CI；模块单写者只改分配文件；QA/fresh reviewer 独立；用户判断美感，Site 单作者待明确放行。
- Non-goals：明向、全校重建、第三凉亭、车辆/多人/新任务系统、迁移存档、API生成、收费素材/runner。
- Forbidden claims：不称逐栋精确复原、豪华完成、用户满意；锁画质截图不代表默认体验或设备性能；历史校园活动不冒充当前活动，原创设施不冒认实景。
- 当前唯一 checkout campus-current，Git 基底 `c17b46220743fe0059bf5b3bfedacebe37a1212a`。公开 v8 功能锚点 `3c5a1e3d`、CI 41395763908 六 jobs/178 units 是历史冻结证据，当前变更相关路径必须重验。v8 保留至新候选放行。

## 研究结论与实现选择
1. Summer Afternoon 的连续景序、Infinitown 的首层街道界面、Bruno 的清晰交互点、Townscaper 的模块连接、Slow Roads 的低干扰 HUD/画质选择：吸收空间组织，不复制商业资产/整套引擎。研究有官方图与源码依据，但云 WebGL 限制下未完成全部试玩。
2. 现有 Scene:1112–1123 在 3 个 >100ms 帧后连降倍率，恢复要求 180 个连续 <25ms 帧；30fps 稳态不能恢复。改为可单测时间窗口/滞回策略，显式自动/清晰/流畅选择，画质不触运动模拟。
3. 两校首段要有路缘/铺装/树群构成连续前中后景，不仅围着亭子加装饰。PlayerController:261 实际迎西出生 `[-20,175.5]` 朝西，虎峪为 data.start、yaw0 朝+Z主楼（此前北向推断已纠正）；门外仅约3.77m，6m追随镜头会撞边界，外沿出生点被否决。root批准仅将虎峪setCampus初始yaw改为π，保原脚点/物理，从门内侧回望北门（非门正面校名），随后真实折返入校。迎西机械馆/清泽园作为短首程，虎峪先回望北门内侧，明确点击“去梅花教室”后沿既有路线走向主楼西侧转角，梅花为主动选择后的延伸；全三站环线约536/550 world m只作可选延伸，非实地距离或三分钟承诺。
4. KayKit Forest FREE 已核包内 CC0，已选树/灌草五种小子集，共享 atlas、按模型 instancing；本轮只一份共享1024² atlas，含mip GPU纹理≤6MiB（预计5.33MiB），反复切校/重入不能按模型重复纹理；已按真实形态/成本冻结子集，绝不全包导入或执行作者脚本。迎西near-hall6点逐点以真实closed组件准入，首次候选5/6可换；实际近镜验收后当前修复候选4/6可换（保留-43,170及5,170旧树），远65park和虎峪专用树不动；新路线植被另准入。替换opaque树冠会改变摄影，旧包络不能替代射线回归。
5. 复用现有旅程/目录与照片册，单一当前目标优先；官方带年份故事替代主段免责声明，模型来源/不确定性仍可展开。旧 IDs/answers/progress/storage 与照片门槛不变，不添加完成条件。

## 并行单写边界与接口
- integrate_complete_campus_play：src/scene/CampusScene.ts、src/app/App.vue、src/shared/contracts.ts；AGENTS 与既有 PLAN/CURRENT_STATE/DESIGN。负责模块接线、单 renderer/RAF、加载 generation、旧/新 opaque picking 与碰撞资源一致；另明确PlayerController.setCampus虎峪初始yaw一行，以及只读hasActiveInput用于自动加载延后（不改运动积分）获准；不并发接手作者文件。
- stabilize_adaptive_render_quality：仅新 AdaptiveRenderQuality.ts 与专用 unit。API createAdaptiveRenderQuality({devicePixelRatio,mode:auto|clear|smooth,reference,nowMs})，observe(frameMs,nowMs)/resetSampling/setMode/setDevicePixelRatio/getState；state 给 effective renderRatio/shadowType/shadowMapSize/reason。Scene负责前后台/加载/切校重置、shadow map 释放。
- compose_campus_arrival_landscape：仅新 CampusArrivalLandscape.ts 与 unit/本模块配置；唯一沿线摆放 owner，给自有地面可见层/植物位置/销毁合同，地面不产生实体 proxy，植物真实组件碰撞由资产工厂提供，不写Scene或植物loader。
- 合规资产作者：独立 loader/factory、批准模型子集/许可证来源及 unit；按模型 instancing、明确共享资源所有权、异步失败保留 fallback；不决定摆放、不新增网络依赖。自然GLB file://适配仅scripts/offline/build.mjs/check.mjs/package.sh四文件allowlist与自包含字节内嵌，经R-security针对审，不泛放models目录。
- 集成同时单写 src/campus-data/stories.ts：仅官方可追溯短故事/数据，不改 quest/journey/storage；集成处理 HUD。
- 独立 QA：新默认首程/质量选择/资源失败与必要旧摄影/碰撞/模式回归；实现作者不改断言。最后一次整树静态与精确源身份、fresh review 后才统一远端验证。

## 默认体验验收（先定义，不能靠高清专用图替代）
- 产品目标仍含桌面1280×720及横屏844×390默认首程；本轮新CI两例实际均1280×720+真实触控摇杆输入，90秒只读样本含加载/步行/停留，不代表90秒连续行走。844×390仍由既有mode触控门禁核近桌交互和控件，完整横屏首程为后续真人待验，不称本次覆盖。两校从真实默认出生与自动画质各走一条有界前段；不得传送、覆盖内部状态或强行reference。每次转向有可见可达下一景/目标，路缘/植被不中断为展示孤岛；保留同路短录像或有时序的关键帧供人工判断，不堆无关截图。
- 对应旧/新默认路线，记录实际 ratio/shadow/frame时间分布、draw/tri/纹理与加载体积；同画质图仅辅助隔离美术差异，单独标记。默认 UI 只突出一个主目标，活动覆盖时不让底层按钮穿透；触控卡片/跑跳/摇杆bbox及实际开关操作通过。
- 质量单测：短加载尖峰不连续降底，30fps稳态有机会恢复，持续慢设备有界降级、滞回不振荡；后台/暂停大gap及NaN不污染窗口；用户三档有效且不影响pose/存档；reference仍严格ratio1/PCF1。
- 资源：许可/来源/文件hash明确，只批准子集；失败可降级且不空景，校区/模式切换无迟到对象、资源泄漏或重复opaque体。新增路径实体真实碰撞，不缩小旧角色/camera或放宽摄影。
- 保留并按依赖重验：三照/真实上下台/地面放飞/保存、自然遮挡拒拍、完整相册/下载/重拍、模式事务、触控控制、Hks和offline。故事不得把不存在的当前展览/室内玩法作为目标。
- A2：同仓 main 唯一集成推送，fresh审/静态/受影响真实测试预算明确；原6免费eligible jobs不增收费资源，quota阻止即停。A3：新候选真实体验与像素审后另放行同Site，v8回滚保留。没有真机证据就明确未测，不承诺30fps。

## 官方故事与许可边界
梅花2026播种教学（gongqingtuan.tyut.edu.cn/info/1019/32971.htm）不等于模型花床是碧园种植地；虎峪图书馆2023迎新同地留影（www.lib.tyut.edu.cn/info/1274/2875.htm）；训练馆2025五育杯（tyxy.tyut.edu.cn/info/1175/10344.htm）；机械馆2024迷你马拉松（mc.tyut.edu.cn/info/1060/9545.htm）；清泽园2019档案图展（www.tyut.edu.cn/info/1026/13156.htm）；迎西图书馆2026材料书展（lib.tyut.edu.cn/info/1275/7254.htm）。保历史日期与来源，不复制新闻照片纹理、不称活动正在举办。官方地图只支持两校辨识骨架，不将原创亭台命名为实景百年学坛。

## 当前运行证据与修复边界
- 首次候选 `82264396e6c39769d76e6a51cdbd3b4342d31e87` 在 CI `41448774421` 于 2026-11-02 13:28:58 UTC 终态失败。原提交 220 单测/构建通过；两校默认首程实际完成，但不能把默认截图中的地图遮挡、鲜绿配色、迎西近树遮视野及虎峪贴墙终点称品质通过。公开 v8 不变。
- 已证并修复中的范围：紧凑目标条避开小地图/摇杆；北门明确可选“去梅花教室”，仅当前会话导航，不自动开始任务/写存档；虎峪沿原北门至梅花路线在主楼西角转向可走路，不以看窗墙作结束。植物共享材质仅 linear RGB 去饱和 .32 / tint(.98,1,.96)，原 CC0 GLB/atlas 不改，无新纹理。
- near-hall 新模型逐点保实际闭合实体。新增普通首程追随相机的侧向净空筛选（3视角、正常到达偏差±.9m，.8m authoring buffer），不改运行相机、碰撞、摄影门槛；最终候选接入索引0/1/2/4，(-43,170)/(5,170)保留原树。近镜恢复方案需新实际画面验证，不声称完全无遮挡。
- 当前 CPU 实际 Scene 旧 props 筛选：虎峪4树/6灌/18草（28实例），1842地面三角形+8360自然三角形；迎西5树/7灌/18草（30实例），1884+9620三角形，各3地面材质批次+5植物类型批次。迎西另4棵 near-hall 替换混合进植物批次，总34实例；远65棵旧树不动。这是 renderer/DOM mock 的 CPU 结果，非GPU draw或性能观测。
- 其余实际失败分开诊断：园入口旧测试A*穿新增树体；地图标签投影等待；首次摄影新帧等待超时；模式往返 base 纹理计数每次净增1。实际触控桌交互通过不替代资源循环无增长。root批准定向修复：园路测试沿既有北侧通道到x33再南下（真实全props控制器复核，不移树）；地图将已有15s实际投影ready前移，保原count/pick；core仅startup显式20s新帧等待，其他10s/总cap不动，实测14.263s长帧仍是软件性能问题。理想层给opaque caster私有customDepthMaterial并随layer dispose，隔离r186共享depth保留旧map uniform的候选机制，不改Three库/几何/alpha。真实r186 CPU shadow+uniform回放证明旧引用保留与新owner隔离，尚不等于GPU净增已修；原资源严格等值断言保留，必须新CI证明。
- 参考首组 yaw 相差约2π、真实相机差约0.000055m，修正仅最短圆周角比较，保.0002门槛/位置/俯仰/倍率等严格条件。旧离线2例虽通过，但工件没有自然资产运行证据，须补file:// ready/实际实例/场景图，不从静态内嵌推断通过。原两例trace总耗时约118–123s（含hooks），root明确准许仅这两例body cap120→150s容纳新增双校证据；原20min job、具体等待上限、既有动作/断言均不变，不新增绕行或重载，不作产品性能改善声明。
- 自动异步接入仍须真实输入空闲、共有地面、目标capsule可提交；等待保旧树，不用DOM旧motion吞W。实际ready/generation/instances、渲染buffer及shadow map尺寸已在首轮默认运行记录；修复后按新身份复验。
- CI原6jobs/时限不变：two-campus内2×240s默认首程，旧门禁保留；hks 4旧新参考组，另2模式图组在validate。基线c17b原生reference，无源码补丁；baseline shadow2048是源码证据，候选GPU尺寸为实际观测。修复统一fresh审/静态后再单次同HEAD运行，不沿用首轮通过片段冒充新整包通过，不提前发布。
