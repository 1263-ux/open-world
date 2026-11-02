# 当前计划：虎峪 / 迎西共享精修与局部理想空间

更新：2026-11-02。用户不满意公开 v7 的品质。功能运行不等于达到高品质作品标准；本轮只精修虎峪、迎西，不做明向，不调用 Astra 或用户模型 API。

## 当前证据与下一轮状态
- 第一轮恢复候选经过独立审查及实际修复，最终功能基线为 `2b54e2a5c401041177aaa8b155f2d3dbc5260c34`，CI `41374822479` 已终态成功：6 个必需 jobs 成功、3 个可选 jobs 跳过，156 单测、原 quality 12 例与 core 4 例、模式 3 例及 reference 4 组对比均通过。不是沿用恢复前结果。
- 根已亲看六组证据。新梅花取景真正覆盖两床之一的石缘/土面/低篱，闭合旧取景遗漏；树冠改善明显，立面和花床提升有限，两处理想设施仍是普通凉廊，不是用户期望的豪华校园。
- 公开 v7 未替换。已验证基线冻结在 `campus-current-recovered`；唯一下一轮 worktree `campus-next-refinement` 从同一 2b54e2a5 派生，禁止把下一轮离线图/静态通过冒充该 CI 已验证。
- 下一轮 11 个代码/测试文件已独立源审，重新 typecheck/lint/174 单测通过，build 在核锁文件后复用缺失 Hks 依赖并重跑通过；首次依赖缺失失败保留记录。此次 PLAN 更新仅文档，不伪称重跑检查。下一轮真实交互、触屏布局、摄影遮挡与六组新像素仍待同 HEAD CI。
- 用户已明确允许原仓库 main 推送及现有 CI，当前仅在已授权精修范围推进；不发布中间版、不新增付费、不调用 Astra/API、不恢复已清理的旧过程包。平台拒绝时停止，不换通道绕过。

## 当前产品边界
- 已发布 v7 功能锚点38d9b0a，39浏览器用例/125单测是历史功能事实；仍是用户不满意的低保真校园原型。公开入口可达不代表云端实时WebGL或实体手机性能已通过。
- 基础画质精修两模式共享；理想模式只叠加明确标注原创的局部可走设施，不是整校切换成豪华新世界，不冒充现实建筑。
- 不新增玩法/谜题，不移动旧平台、六级台阶、地面折纸站或飞行航道，不改变照片/旅程/探索IDs和保存含义。
- 单renderer/RAF，保现有控制、真实输入、碰撞和摄影遮挡标准。不能用状态注入、传送、放宽断言或碰撞容差换通过。

## 下一轮冻结实施范围与单写者
1. `vary_campus_tree_canopies`：SurfaceStyle 树冠及专用 unit。两种确定性位置哈希冠体，各 720 triangles，保持原局部包络/尺度/位置/碰撞；每套双冠共享几何增加 90,816 bytes；迎西 park + near-hall 两套合计增加 181,632 bytes，另有 instanceColor 852 bytes。迎西 65 棵 park + 6 棵 near-hall 树分批净增 5 个冠体批次，虎峪专用庭院树不由此替换。实体遮挡仍须真实摄影回归，不能把包络相同当作射线相同。
2. `refine_ideal_reading_spaces`：IdealCampusLayer 及专用 unit。虎峪阅读庭院、迎西照片手记驿站，在原 bounds/入口/地面连接内增强家具焦点、木石纹理与植物层次。每校 8 个可见批次，虎峪 3,328 / 迎西 2,684 triangles；四张 256² 自有纹理含 mip 约 1.333 MiB。非通行植物实体有匹配碰撞，柱檐下净空和迎西 2.4m 通廊保留，不移动台站/航道。
3. `connect_campus_space_interactions`：App/Scene/contracts 与 activity unit。复用已有校园介绍与照片册；真实近桌、稳定地面、2.4m 距离和 opaque 视线检查后才可打开。介绍只读，照片册仅展示真正拍下的本会话图，少于三张不解锁原下载。单活动互斥、暂停/焦点/触控关闭和离开清理，不新增任务/存档/快捷传送。使用现有 250ms tick 的有界近桌查询，CPU 成本尚未实测。
4. 独立 QA：既有 3 个 mode cases 内加入真实走近、反复开关、Tab/Escape/焦点返回、暂停位姿/进度不变、真实一张照片、触控按钮与布局不重叠断言。总 case caps 600/360/240s 保持，6 组主要对比机位不变，最多 2 张近桌内部诊断图不冒充新增主要对比组。
5. 独立 reviewer：精确 11 文件源审与离线图审已接受，仅属 source-only；集成人独占此 PLAN、提交身份核对与 CI 收口。下一轮不改 PlayerController、旧花床/立面或工作流，不混入未审功能。

上一轮已验证的三栋 visual-family、两处花床和模式原子碰撞架构保留。教学用途/入口/精确实景未被官方逐栋证明，继续标布局参考与设计近似。设施仍是明确原创的局部设计，不宣传全校豪华改造完成。

## 模式接口和安全合同
- CampusMode为base/ideal，与campusId分离。偏好键campus-atlas:campus-mode:v1只存模式；不污染journey/quests。坏值默认base，存储拒绝仍内存可用。
- IDEAL_FACILITIES注册id/原创标签/bounds/sharedGroundZones；createIdealCampusLayer返回visual/colliders/dispose，资源私有且幂等释放。
- Scene getModeSwitchStatus/requestCampusMode；App明确显示结果、原创含义和方位。虎峪书庭在梅花东北侧，东入口接既有地面路；迎西柱廊在平台/折叠站以东，南北两端进入。
- 仅自由步行、稳定共有地面可切；活动/摄影/飞行/Hks/地图/确认框、跳跃/高台、设施bounds+1m内拒绝并解释。共有地面不限于小参考圈，不静默传送。
- Player prepareCollision离线生成快照，finally释放所有自有临时资源但不释放借用材质；canCommit检查共有地面、capsule及实心体；commit仅原子换快照并清输入，不setPosition、不推进模拟。
- Scene同步prepare→attach候选→commit碰撞→卸载旧层；失败回旧视觉/碰撞/pose，候选释放失败不掩盖旧world。提交后旧资源释放失败属于已应用+警告，不能误报回滚。地图pickables仅在成功后移除旧mesh/加入新opaque mesh。
- 校区重建和异步资产仍有generation隔离；模式无新增异步loader/逐帧遍历。新旧CPU代理、可见资源、base资产所有权必须分清，重复切换检查无泄漏。

## 画质、性能和验收
显式URL render-quality=reference锁DPR/renderRatio1及受支持的PCF(1)，只影响画质不写玩法。默认adaptive保留；锁DPR图不是自然性能证明。
仅六组视觉证据：四组旧/新同机位（虎峪入口东侧普通楼立面、梅花前庭、迎西树冠、迎西背光立面），加两组base/ideal设施对照。viewport1280x720、真实脚位误差<=.03m、镜头/加载状态/DPR/shadow相同，否则标不可比而不是强称提升。触控另保自然adaptive844x390。

新候选必须fresh review、全type/lint/unit/build；真输入模式反复切/校区切/忙态拒绝/存档/释放/碰撞/摄影视线，旧主线照片→上台→下台→地面放飞→保存完整保留。离线几何图不代替运行像素，美感仍待用户判断。

已获上传与CI授权，工作流仍仅原6标准jobs：mode3放validate45min内、reference12min放hks45min内；原quality50min及全部旧门禁不变。新增step if !cancelled保留早先失败，不吞断言，不加收费runner/可选deepplay。预算仅最近核实$0硬停，不能声称实时余量；平台quota阻止即停。

## 研究与来源限制
官方虎峪图只支持连续树冠道路、梅花低矮放射翼/竖窗/庭院语言，不证明精确位置尺寸。碧园餐厅东侧花圃有官方文字但当前数据未定位，暂不落地。不得搬迎西清泽园到虎峪或引用明向湖；照片只研究不复制纹理或人物。现底图仍是布局参考与设计近似，不宣传逐栋精确复原。
