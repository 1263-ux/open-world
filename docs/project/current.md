# 梦境邮局恢复重建 / current

## 用户目标
真正自由移动探索的3D游戏，不是点击流程。参考V2朦胧治愈视觉，邮局汇聚未说出口的话/情绪/遗憾，玩家互动揭示故事意义，结尾信与回忆触动人；不是所有章节都必须套同一循环。持续自主review与迭代，达标才叫用户，不将工程测试当体验满意。

## 当前实况
旧云工作区候选无法找回，已从Library原始双包重新建立本目录。不可把新重建称旧候选复原。浏览器启动当前socket权限受限，无运行截图。可用Blender Cycles CPU及Node执行测试，继续改进不因硬件验收停掉全任务。

入口game/index.html；Python静态serve根目录后/game/。Three.js 0.186.1 MIT全依赖同源vendor；GLB从../asset-recovery加载。主代码main/world/controller/narrative/session/occlusion/sky/audio/memory-art。

## 已处理
真实步行/船惯性/邻近互动；原文CH01；可见水槽出口与逐段流动反馈；复位软锁、组合存档和回忆当前cue；残窗碰撞、真实桥面高度、真实不规则岸线和局部灯位；相机遮挡淡化。22个Node测试通过（含实际控制器84.7秒往返模拟，不是人类试玩），绝非完整实玩通过。

原静态邮局GLB已集成。玻璃v2同几何材质迭代、3离线固定相机已看。天空程序球面纹理和两层原创柔云已接入；实际离线A/B改善有限。合法CC0 KayKit骨架重制原创邮差已集成：Idle/Walking/Interact/Sitting四动画，坐姿根/座面吻合，硬直邮包带已改为随外套权重贴身变形。当前GLB SHA256 d9dd28b2e23fa5e9793ae65c735977a35e0f61acd6e5eae883e78736f9475af5。实际GLTFLoader解析、SkeletonUtils克隆、Mixer采样全部有限，视觉仍非最终品质。音频真实CPU实现DSP已测，未听验；手势开声且可关，隐藏/暂停静音。

## 可靠备份
已核验Library v0：libfile_9942f7620c3881919a7cdf05b61a8c37，快照2026-11-13 06:23:52Z，40,007,078bytes，SHA256 350377f0b4e8c4b31eea7982c45151a93bbb48582f7579aac1502d3bbc999d20。回下载CRC/SHA/109文件manifest一致。v1也已回下载核验：06:58:42Z、71,679,878bytes、195文件，SHA256 b50f7264d66a4708769c58e7d5c4c41fc786b9499b9989e988a2dc770477eac6。WAV排除但脚本/测量JSON保留；随后环境锚点修复待下一版。
Git独立备份分支由/root/create_private_repo在私有1263-ux/open-world建立；main不得更改。当前首次40文件快照上传进行中，未收到commit核验不可称Git备份完成。

## 仍需完成
真实浏览器全流程试玩、触屏/性能、角色细节与实机动作、真正叙事动作与旁白听验、云/水/夜光层次。当前不合格，不发布生产、不让用户验收半成品。

## 本轮恢复后追加核验
2026-11-13：当前已出现CUA云浏览器入口，但localhost:4173连接被拒。单个exec内服务+curl返回200，跨调用curl与浏览器均拒绝，表明目前预览可达性仍受隔离约束，不能据此声称GPU失败。
远端校园基线9b04ab4的Campus prototype checks无push分支过滤，备份分支创建触发校园工作流。6失败3跳过；日志BlobNotFound、steps空，具体失败原因未知。新备份应独立根tree不继承校园workflow，不能修改main/校园配置。

回忆镜头修复：天空/主光随当前叙事镜头位置，不再沿用邮局玩家位置，避免晚霞镜头夜景；回忆时隐藏玩家本体防重复。新增环境锚点回归通过。安全参数Chromium同exec启动仍在process_singleton socket权限处退出，未建立WebGL。

低帧率时间修复：物理仍限0.5s，叙事使用可见真实墙钟；页面可见性切换重置last，隐藏时间不吞进回忆。当前22项Node测试通过，浏览器预览另行尝试中。

## 私密候选预览与增量
现有owner-only Sites v2仅新增candidate-recovery/game/，原根页面及权限未改，source f1aa731377c532331e9c7d7e6d638e20f2556851。CUA访问确认登录墙，ChatGPT继续后为auth登录页；无已登录身份，未实玩、不改公开、不生成绕过token。
Library独立增量libfile_1c1e0ad39bdc8191825b64109c5ecbf9，07:04:41Z，17,528bytes，SHA a3c7e822de89d1fb9f78e6e12d3f8dc1dc02d51399ac2c57cc5ffe479aa8f8de，依赖v1。回下载SHA/CRC/manifest通过。
之后主动读信构图/右侧信纸及鱼缸开口、船端折面修复待下一备份/部署。当前晚霞实际几何离线整合审查进行中，不把离线图当游戏截图。

路线可读性审查另修：纸船在未登船时原先完全隐藏，现在实体停靠水渠末端，返航下船后仍留码头；新增停靠/航行/回忆位置回归。修复pointercancel后拖镜头粘连。当前22项测试通过，晚霞真实几何离线复审进行中。

## 07:17后检查点
完整Library v2已远端回下载通过SHA/CRC/224文件manifest：80,048,160bytes，SHA256 3f64db65cfdf3ab3c2b27776bb6817f938e25f4bdf13bdb18e4422abb9065626，主ID不变，快照07:17:29Z。
22项测试覆盖新增资源后碰撞重验、固定热点闭包与实时距离、弹窗禁R、关键进度/hidden/pagehide即刻保存。当前纸船折壁支撑与四补口同几何离线复审通过，非WebGL验收。
Sites v3已更新仅candidate-recovery子路径，source 327e1eb63727c55cdceea3ac94a538d0db557d23。登录墙后Google入口实际也无已登录账号；不填写未知身份、不改共享、不绕过gate。仍无新游戏浏览器截图。
下一轮独立工作：C06小满儿童贴画场景/动作替代缩小邮差占位；合法低对比HDRI环境反射A/B，仅在证据明确时集成。

## C06工作中接口（尚未接入）
child-recovery正在制作C06_Reality根、6秒Xiaoman_PlaceDrawing单动画，内嵌sky-drawing原创纹理，8岁小满便服而非邮差。三帧动作和FOV48透视复核，拳部有限纸面穿插正在修正；不得把旧beta资产称最终。game/reality-scene.js只是未使用加载器草稿，预设隔离于x=300，game/memory-pose.js提供按故事墙钟确定性求姿态。下一步等几何与图复核→实际GLTFLoader/Mixer/重播检验→只在C06显示并避免跨场景长距离飞镜→原源备份和私密候选更新。

## C06已接入的新候选（待私密预览更新）
最终GLB SHA767e002c03ef3e07fe6be9fad32f1c1232602e0365b8a733c99c73c86a2f2ce9，372424B/4840tri，单6秒/124tracks。最终压纸及FOV48末帧均独立实际查看；577子帧表面约束通过且已实际GLTFLoader+Mixer采样/重播一致。主程序仅C06显示隔离局部，隐藏世界root/主灯/雾/天空，用独立局部灯；切镜不飞越300米，退出恢复。新灯强度是待实机校准起始值，非已验证真实浏览器效果。
存档Quota失败重试与独立警告也已完成，失败/恢复只状态变化通知，不逐帧异常。当前28项测试；3个核心GLB实际加载验证通过。最后一轮只读集成状态审查中，当前部署仍Sites v3旧22-test候选，未误称已更新。

最后独立集成审查另发现C06中途跳过会从300米外插值飞回，已修为退出电影镜头同样直接切回，新增回归覆盖进入/退出/重播；当前28项Node测试全通过。仍非浏览器验收。

## 最新持久检查点与公开预览授权
Library 全量 v3 已回下载核验：主 ID libfile_9942f7620c3881919a7cdf05b61a8c37，快照 2026-11-13 07:56:43Z，90,542,070 bytes / 259 文件，SHA256 062f3e7329e996bf5ed16d711325cc43a04a1b07aa86fbf560884e06d9f96772。CRC、整包及逐文件 manifest 均通过。
Sites v4 已部署，source 587051760aa0e607e601453669ed7fed4470019e，28-test 候选及最终 C06 已包含，不再是上一节所说 v3。
用户最新明确授权“无需仅我可玩，正常访问公开就好”。由部署代理先审查并移除候选中的测试和内部说明，只保留游戏运行文件及许可证，再用正式共享工具公开。此条记录授权与进行中操作，不宣称公开已经成功。原设计双包/内部报告不公开；当前仍未完成真实浏览器试玩。
再次核查只有现有云环境，无新增用户电脑。static-app-previews 不支持当前多文件项目且 Sites 优先；visualize 体积和外部资源限制无法等价承载本游戏，不以简化替代物充当测试。C06 连续7帧离线叙事审查继续进行，登录不再是需要用户处理的前置要求。

## 公开后真实核验与下一候选
公开清洁版 Sites v5 已完成，source 8b85d259dd5fc7a7ac049fa002401f4376deb2b1，public revision 2；CUA tab5 无需登录已读到真实应用。实际 WebGL 失败日志 GL_VENDOR/GL_RENDERER=Disabled、BindToCurrentSequence failed。官方 Firefox157 默认安全配置可启动但同exec环回测试也无法建立 WebGL；临时 xauth Xorg dummy 无法建立本地监听socket。未关闭证书验证/沙箱，不绕过权限；真实游戏仍未试玩。
当前下一候选包含直接空间转槽小实验（32测试通过），以及 C06 4.5–6s 固定肘pole自然撤手修复（新GLB SHA1830d3bc4cd9812dbe108c42afcb19a0ee74d9f2dea60740716cefa390b38246；原前段骨骼误差6.6e-8，纸轨0，577接触采样通过）。我独立实际查看旧新5.25秒与新6秒，确认不再横颈摸肩；实际Three加载/动画采样/rewind通过。总体参考品质仍不合格。
渲染失败页面的虚假“加载中”和无效操作已清理，提供环境说明/重试，不断言用户电脑太弱；真实Firefox验证显示/隐藏/Esc/重载通过，evidence/firefox-failure-clean.png已实际查看。
v3后源增量已远端回下载核验：libfile_912c8279d3c08191b360ac5a642bffad，08:36:13Z，124797bytes，SHA59ed98bee2ad2864f0a89962a0c41b23c0bdd57ba858bbc473c9b945694271dc。该增量不含C06修复，仍待下一完整检查点。

## 用户再次否定候选后的方向重审（最新优先级）
用户明确指出当前候选偏离大，要求每轮回原始文档/参考审美对齐、深入研究成熟项目并在许可合适时实际复用代码，美术和可玩性优先，不能仅修技术细节。此前局部几何/测试驱动过多，没有把第一眼气质设为硬门禁，是执行判断偏差。
已重新通读V2视觉圣经、World Bible、Game Design、Character规范，并实际重看V2-02与当前开场图。新结论：展台式圆盘/矩形地图、俯视摆台镜头、三头身球拳厚靴角色、流水线式谜题路径均需表现/玩法层重审，不是再加水纹可解决。
保留现稳定候选和可靠v4备份，不删除历史；水面B2实验明确不合入。新方向按research-realignment/visual-slice.md制作同一空间30–60秒开场，24m步行路线、眼高三机位、真实取信与门景变化；先在new-realigned-slice独立做原创形体/构图，角色在character-lookdev独立做比例A/B。原state/save/tests保留但不作为审美证明。
实际克隆并审查的源码研究在research-realignment/upstream-candidates.md。Three r186官方Water/Sky及MIT许可证已真实复制到environment-lookdev/upstream-three-r186，未取来源不明的示例法线图。ecctrl独立控制试验正在movement-lookdev准备；没有因库成熟就预先宣布迁移。四部核心参考游戏官方图/预告研究正在补成具体空间/互动可迁移观察，而非收藏链接。
当前公开稳定运行候选为Sites v6 source d4b97e3b0c5469a878624a5fbab060a4dbf82260；新方向的研究与lookdev均未部署。全流程测试已改为实际direct-fold helper，而非旧菜单直接pour调用，32项仍过；仍不是实玩。

## 方向重审后的第二轮实证
已独立实际查看 B2角色正面/坐姿，连续衣袖、非球形手掌与低鞋底比旧版显著改善，仍非参考品质；全周期与船座/读信接触另验，稳定角色未替换。发现runtime读信仅桌面信+modal，并未执行拿信，不能宣称手持交互已完成。
新开场首版与V3仍被否决：空板/独窗虽改善但仍工程化，暖窗需真正的空间焦点，远雾不能全屏蓝填充。官方Quaternius CC0三模块（拱、柱、灌木）已真实下载、转GLB且实际看图，正在独立A/B采用，不是仅收藏链接。
原创云海V1实际看是黑灰噪点环，拒绝集成；V2在修光密度与云层高差，仅离线原始素材试验。movement-lookdev实际ecctrl/Rapier构建与资源/动画解析通过，默认Firefox仍WebGL2 false，不能因此迁移或称手感已验证。
companion-bay-lookdev开始验证伙伴反馈与真实折纸面引水的新玩法假设，独立目录，不改原CH01文本和稳定state。所有新lookdev尚未部署，完整Library v4之后修改待新冻结备份。
