# 当前计划：虎峪 / 迎西共享精修与局部理想空间

更新：2026-11-01。用户不满意公开 v7 的品质。功能运行不等于达到高品质作品标准；本轮只精修虎峪、迎西，不做明向，不调用 Astra 或用户模型 API。

## 恢复与证据状态
环境恢复丢失上一轮未提交候选。唯一新工作树 `campus-current-recovered` 以真实远端 e7c2d939b44dc7323f251d832ab6ce2ba5ac1a09 为基底。能逐字恢复的文件必须核旧 hash；其余共享代码与测试按已审合同重建，是新候选，不冒充旧源码身份。旧154单测、旧build记录不能作为新候选通过依据，必须重新静态检查和独立审查。

用户对本轮19文件上传的明确确认尚待，GitHub写入已被审核拒绝；不推送、不触发CI、不换通道外传、不发布、不增加预算。可以继续本地同范围恢复和验证。不恢复此前已清除的518份旧过程材料。

## 当前产品边界
- 已发布 v7 功能锚点38d9b0a，39浏览器用例/125单测是历史功能事实；仍是用户不满意的低保真校园原型。公开入口可达不代表云端实时WebGL或实体手机性能已通过。
- 基础画质精修两模式共享；理想模式只叠加明确标注原创的局部可走设施，不是整校切换成豪华新世界，不冒充现实建筑。
- 不新增玩法/谜题，不移动旧平台、六级台阶、地面折纸站或飞行航道，不改变照片/旅程/探索IDs和保存含义。
- 单renderer/RAF，保现有控制、真实输入、碰撞和摄影遮挡标准。不能用状态注入、传送、放宽断言或碰撞容差换通过。

## 冻结实施范围与单写者
1. 树冠作者：SurfaceStyle.createFoliageGeometry及专用unit；四冠团+少量边叶，752tri小于旧800，原位置、实例数和碰撞保持。实体冠体会改变opaque射线，摄影必须真实回归。
2. 虎峪花床作者：HuyuCourtyards已有(-91,-12)、(-60,-12)两床，石rim/凹土/低绿篱，原包络和碰撞保持；不猜餐厅花圃位置。
3. 集成人：App/Scene/Player/contracts、此PLAN与CI/config。Scene仅三栋原创visual-family比例/基座/楼层节奏，不加未经证实的入口、用途或真实立面断言；features为虎峪 overture:b39690f0-0259-420f-8c33-e8f982bc8273、overture:a04a7502-f32b-4fa2-acee-1f08811fee44 与迎西195741288。保polygon/高度估算/IDs/原碰撞。不能把梅花照片当作这些楼的实测证明。
4. 理想设施作者：IdealCampusLayer与专用unit；虎峪书庭 x[-66,-54]/z[-103,-87]，迎西地面柱廊 x[71.5,75.5]/z[174,184]。柱和檐独立闭合实碰撞，檐下3.2m、顶3.6m；地面铺装无solid。迎西 x<=70飞行保护带不放实体，站仍在地面。
5. QA：模式unit/E2E、reference spec/helper和精确基底画质patch；生产作者不替代独立审查。

## 模式接口和安全合同
- CampusMode为base/ideal，与campusId分离。偏好键campus-atlas:campus-mode:v1只存模式；不污染journey/quests。坏值默认base，存储拒绝仍内存可用。
- IDEAL_FACILITIES注册id/原创标签/bounds/sharedGroundZones；createIdealCampusLayer返回visual/colliders/dispose，资源私有且幂等释放。
- Scene getModeSwitchStatus/requestCampusMode；App明确显示结果、原创含义和方位。虎峪书庭在梅花东北侧，东入口接既有地面路；迎西柱廊在平台/折叠站以东，南北两端进入。
- 仅自由步行、稳定共有地面可切；活动/摄影/飞行/Hks/地图/确认框、跳跃/高台、设施bounds+1m内拒绝并解释。共有地面不限于小参考圈，不静默传送。
- Player prepareCollision离线生成快照，finally释放所有自有临时资源但不释放借用材质；canCommit检查共有地面、capsule及实心体；commit仅原子换快照并清输入，不setPosition、不推进模拟。
- Scene同步prepare→attach候选→commit碰撞→卸载旧层；失败回旧视觉/碰撞/pose，候选释放失败不掩盖旧world。提交后旧资源释放失败属于已应用+警告，不能误报回滚。地图pickables仅在成功后移除旧mesh/加入新opaque mesh。
- 校区重建和异步资产仍有generation隔离；模式无新增异步loader/逐帧遍历。新旧CPU代理、可见资源、base资产所有权必须分清，重复切换检查无泄漏。

## 画质、性能和验收
显式URL render-quality=reference锁DPR/renderRatio1及PCFSoft，只影响画质不写玩法。默认adaptive保留；锁DPR图不是自然性能证明。
仅六组视觉证据：四组旧/新同机位（虎峪入口、梅花前庭、迎西树冠、迎西背光立面），加两组base/ideal设施对照。viewport1280x720、真实脚位误差<=.03m、镜头/加载状态/DPR/shadow相同，否则标不可比而不是强称提升。触控另保自然adaptive844x390。

新候选必须fresh review、全type/lint/unit/build；真输入模式反复切/校区切/忙态拒绝/存档/释放/碰撞/摄影视线，旧主线照片→上台→下台→地面放飞→保存完整保留。离线几何图不代替运行像素，美感仍待用户判断。

待上传另获明确授权后，工作流仅原6标准jobs：mode3放validate45min内、reference12min放hks45min内；原quality50min及全部旧门禁不变。新增step if !cancelled保留早先失败，不吞断言，不加收费runner/可选deepplay。预算仅最近核实$0硬停，不能声称实时余量；平台quota阻止即停。

## 研究与来源限制
官方虎峪图只支持连续树冠道路、梅花低矮放射翼/竖窗/庭院语言，不证明精确位置尺寸。碧园餐厅东侧花圃有官方文字但当前数据未定位，暂不落地。不得搬迎西清泽园到虎峪或引用明向湖；照片只研究不复制纹理或人物。现底图仍是布局参考与设计近似，不宣传逐栋精确复原。
