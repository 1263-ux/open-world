# 当前状态

2026-10-30 15:11 UTC。C2 + R-ui + R-runtime + R-architecture + A3。

## Goal / Product core
真实人尺度、横屏第三人称校园漫游，统一晴日校园美术；先打磨机械馆—清泽园连续样板及两站自主取景，再扩展。完整 Hks 保留，后端/多人后置。

## 授权与沟通
已授权持续开发/自验收、适用检查后直推1263-ux/open-world/main、公开游戏链接；不含额外付费或超预算。用户13:40明确不再要零碎进度，要求深度调研/自行试玩/迭代到实质高质量；不得自称已达市场一流。必要问题/阻塞仍应说明。

## Phase / 当前身份
VERIFY/TRIAL，修复候选待推。远端dev/campus-thirdperson=`960d7e7a2f71455caeaf29fe2a75e43baa396063`，tree=`aa26a783ba3cbb7deff8a9e2907bdb58471c5498`，CI41075070647。main仍`3d531d47068280751cf7094c88de013e6badad13`，公开站点保持旧版，未发布新候选。

## Implemented
- 真正键鼠/触屏移动、跑跳、建筑/台阶/边界碰撞、避障与近镜人物淡隐；原有双校区任务/Hks往返。
- 精修机械馆15603tris/827580bytes，真实凹入门窗；米制细纹理/多团树冠与200m近景单sun阴影。楼高等仍是明确估计。
- 核验CC0 Quaternius Hoodie 1646732bytes/6206tris，Idle/Walk/Run混合，原资产无Jump；新增原创Idle-based空中姿态，专门还原/生命周期测试。
- 晴日两站真实取景、构图/遮挡检查、本地明信片和来源署名；进度小量localStorage，照片仅会话内，不上传。

## Evidence
- 40cb7ef CI41064484634：旧场景validate/Hks/offline成功，真实自然实战是失败62.6s/Lv3/14击杀，未到Boss，不能证明平衡/普遍可胜。该Hks源码后续未变。
- 3affbdbf CI41070054665：headed focus/offline/Hks通过；validate 13通过2失败。两校区完整真实步行任务已通过；人物加载/回退/延迟切区/近镜淡隐、手机第一站照片通过。
- 两失败：遮挡测试按住A过冲至范围外10.04m；新跳姿测试在刚离地即断言峰值高度。现已改为真实短脉冲位置闭环和有界等待同一>.1m高度，不注入状态。
- 新鲜独立复核另发现真正UI/语义缺口：以建筑中心而非钟面判构图、完成卡不暂停、竖屏提示无出口。本地已改为钟面四角入中央框+塔体入画面、真实有限仰视、ready-only禁止fallback假拍；模态暂停/inert/焦点；全屏方向锁取消竞态和继续竖屏。源复核无当前阻塞，但实际新图/输入尚待。
- 3aff软件渲染后窗：3.18FPS、94drawcalls、76911tris，1440×960/DPR1/SwiftShader/ratio0.5；真实行走短窗4.15FPS。不是实际GPU设备数据，未达30FPS目标，不可隐瞒或泛化。
- 当前本地typecheck/lint/54单测/生产构建通过；完整移动双站、正确钟楼框、模态和新竖屏路径待新身份CI。

## Reference / Limits
研究见docs/research/game-quality-benchmark.md，资产见docs/resources/quality-assets.md。实际查看官方静帧（Bruno/Alba/A Short Hike）；用户参考jlu.online首页可见，游戏内WebGL未成功，不能声称玩过/全面超过。角色/光影/地面有可见进步，但当前截图仍简化，不标记最终审美通过。API真实余额/账单未知，本轮未新增批量计费API调用。

## Next / 停止扩张
1. 将本地定点修复推新dev候选。CI分开legacy explore、quality-slice全移动双站、Hks、offline、真实headedfocus，便于分别收集证据。
2. 下载同身份截图/trace，亲看钟楼、沿路、园旁、人物动作、移动界面、明信片；由QA/产品作者复核。失败修根因，不改状态造PASS。
3. 满足该连续切片的行为与画面标准后核对最终身份、直接main、同一既有公开站点更新与外部检查。当前不发布、不作完成通知。

## 最新定点迭代
960d7e：legacy validate/focus/offline/Hks均通过；quality6通过2失败，均在首站测试瞄准。trace截图是天空过多/钟楼在底部；测试 helper 仍复制旧固定胸部相机公式，未计新地面clamp/仰视aim，现换有界真实手势+已渲染帧+UI只读构图反馈，绝不写相机状态或放宽框。双站拍摄/导出仍未通过。

视觉研究核实实际GLB138个正面石材三角法线≈(+.9995,0,-.0316)，旧主光方向点积−.493，正立面背光；下一候选只改sun X偏移为正，点积+.469，保持强度/曝光/其他色不变，必须同机位图片比较后才接受。依据Three官方DirectionalLight/HemisphereLight语义与GLB数值，不声称实地光照。

下一身份包括该定点光向、真实反馈瞄准测试、只读构图DOM标记和原创SVG旋转图标。未开始扩新场景或菜单。
