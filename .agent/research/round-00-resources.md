# Round 00 — 校园资料、可复用轮子与素材权利

核查时间：2026-10-29（UTC）。范围：太原理工大学虎峪 + 迎西浏览器开放世界的「校门 + 2–3 个地标」首个切片。仅只读网页 / GitHub / 浏览器核查，未安装或执行第三方仓库；未调用付费 Firecrawl 或生成 API。状态含义：**reuse** = 已核到可用的软件许可；**reference** = 事实 / 外观参考，不是素材分发许可；**blocked** = 直接复制尚欠授权或无法读取。

## 1. 立即可用的结论

- 首轮不要以 Hks 为 3D 引擎底座：核到的上游是 Phaser 2D《山西古建保卫战》，不是 Three.js 校园漫游；其当前快照未找到项目许可。先独立使用 MIT Three.js 官方能力，程序化搭建少量原创低模。
- **虎峪候选切片：北门 + 图书馆 + 梅花教室。** 官方示意图和近期官方文字能支持这些名称、粗拓扑；梅花教室还有独立官方照片页面。不要声称真实距离、楼高或测绘级精度。
- **迎西候选切片：南门 + 办公楼 + 清泽园 + 机械馆。** 党办示意图可见这些标注；办公楼在南门内侧，清泽园在其进一步内侧，机械馆在园的图面左侧。路线应走楼侧室外通路，不让玩家穿办公楼；实际通路状态仍须核验。
- 校园照片 / 地图先 **reference only**；不要把官方 JPG 直接作为游戏地图底图、纹理、封面或打包附件。网页版权声明不等于开放授权。用原创几何 / 自绘文字占位，并保留来源与「示意、待核」说明。

## 2. 官方校园证据：小而具体

| 来源、日期 / 核查 | 核实到什么 | 决策与限制 |
|---|---|---|
| [TYUT 校园导览](https://www.tyut.edu.cn/xxgk1/xydl.htm)，2026-10-29 可检索 / 读取 | 提供虎峪、迎西平面图与立体图入口；照片目录明确标有迎西机械馆、图书馆、清泽园百年学坛。页面给出迎西地址为迎泽西大街 79 号；虎峪交通说明为从迎西南校门公交站沿新矿院路南行约 150 米到达。 | **reference**。该 150 米是交通文字，不是两张地图的配准控制点，不能据此推算所有楼的位置。网页尾部为学校版权所有，未见开放素材许可。网页本身没给所有照片完整年月。 |
| [地球科学与测绘工程学院：太原理工大学校区地图](https://dcxy.tyut.edu.cn/info/1821/3591.htm)，发布 2024-09-27 | 列出虎峪 / 迎西平面、立体 JPG 附件；学院地址为新矿院路 18 号。 | **reference**。附件点击进入下载 JSP，本轮未取得原图内容；不能把「2024 发布附件」说成「2026 实测地图」。 |
| [党政办公室：校区地图](https://dangban.tyut.edu.cn/ggzx/xqdt.htm)，页面未见发布日期；2026-10-29 图像直接浏览成功 | 同页明确分列虎峪、迎西、明向校园图。下列两张图已视觉检查，不只是搜索摘要。 | **reference**。未见比例尺、测绘坐标 / 开放许可；图的年代和现场现状没有核实。 |
| [虎峪示意图 JPG](https://dangban.tyut.edu.cn/__local/1/21/32/33478728DD64E67FFD19ECBBC31_E0DF3B09_29B64.jpg)，1024×679 | 图面上方中部绘有入口；图书馆在中部；梅花教室在其图面左侧。可读出西侧千峰南路、东侧大王路的道路标注。 | **reference**。粗关系可支持小切片；未用像素换算米数。上方入口与现实「北门」的对应是结合下面官方文字的合理推定，而非图像自身明确写出的门名。 |
| [迎西示意图 JPG](https://dangban.tyut.edu.cn/__local/6/04/07/1C2D00D15E84638D6D5640CA123_D01484E0_8209B.jpg)，1605×1956 | 南侧道路标迎泽西大街；南边中部入口内为办公楼，进一步内侧为清泽园，机械馆在园图面左侧。已放大查看南部区域。 | **reference**。采用图上名称「办公楼」，不擅自更名为某现行楼名；南北方位结合道路与官方南门文字判断。 |
| [保卫部：校领导春节慰问坚守一线工作人员](https://bwc.tyut.edu.cn/info/1023/8296.htm)，2026-02-17 | 正文同时点名迎西校区南门、虎峪校区北门。 | **reference**。证明门的存在 / 名称，不证明外观或尺寸。 |
| [虎峪校区梅花教室](https://www.tyut.edu.cn/info/2093/22644.htm)，2017-05-03；[图片](https://www.tyut.edu.cn/__local/0/5B/39/94C6C4A9540BA6AC1F4AFDC4268_240EBC14_8F21.png) | 官方校园风光条目明确命名，含照片。 | **reference**。照片年份较旧；本轮未视觉核看该照片，不能据此记录立面细节。 |
| [2026 年教师节走访](https://www.tyut.edu.cn/info/1027/98311.htm)，2026-09 | 官方近期报道仍明确提到虎峪梅花教室授课活动。 | **reference**。较新的存在证据，不证明与旧照片完全一致。 |

### 首轮最少照片参考集

- 迎西机械馆：[官方导览列名的 JPG](https://www.tyut.edu.cn/__local/2/5C/41/446E0BE7610583437A2528CE065_89898C9B_2AE58.jpg)。
- 迎西图书馆：[官方导览列名的 JPEG](https://www.tyut.edu.cn/__local/0/C4/D1/F10D9C2F69D571D72969C3C3E52_661BDAB4_22C8A.jpeg)。
- 迎西清泽园百年学坛：[官方图片链接](https://www.tyut.edu.cn/__local/F/CA/B3/14D2C7CEA9A9A31A5AB7F6083AF_94254D6D_71CB1.jpg)，本轮读取超时；不报告外观已核实。
- [学校旧简介](https://www.tyut.edu.cn/info/1033/1356.htm) 的图注含「迎西校区进强门」，但**不能仅凭该名称断言就是所选南门**。南门真实立面参考仍待核。
- 虎峪图书馆：[官方图书馆虎峪页面](https://lib.tyut.edu.cn/gzbj/hyxq.htm) 有多幅图片，但本轮未核实哪些是外观、哪些是馆藏布局，不能当作已找到建筑立面照。

### 时效 / 复原边界

[2024 年校园更新规划征集](https://jijianchu.tyut.edu.cn/info/1010/1785.htm) 与 [2025 年设计征求意见](https://xcb.tyut.edu.cn/info/1077/10702.htm) 表明两校区存在更新规划；这不是已经按某方案建成的证据。因此地图 / 老照片和 2026 现状可能有差异。MVP 以「校园印象示意」为明确定位，建筑实体 / 门形 / 道路精度都要记置信度，不发明地理关系。

## 3. 复用技术：优先官方、少依赖

| 可复用项 | 证据 | 决策 / 首轮实际用法 |
|---|---|---|
| Three.js 核心 + 自带 addons | [官方 MIT LICENSE](https://github.com/mrdoob/three.js/blob/dev/LICENSE)，2026-10-29 读取；[GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) | **reuse**，保留版权与 MIT notice；项目应锁定实际依赖版本。先 Box / Plane / Cylinder 原创低模，后用 `three/addons/loaders/GLTFLoader.js` 加载自建 GLB。MIT 软件许可不能自动覆盖示例模型、外部贴图。 |
| 第一人称控制与静态碰撞 | [PointerLockControls](https://threejs.org/docs/pages/PointerLockControls.html)、[Octree](https://threejs.org/docs/pages/Octree.html)、[Capsule](https://threejs.org/docs/pages/Capsule.html)；[官方 FPS 示例源码](https://github.com/mrdoob/three.js/blob/dev/examples/games_fps.html) | **reuse** 数学 / 控制能力，参考官方示例的胶囊碰撞、地面判定、delta clamp / 子步、越界重置。小切片可先简单 AABB，需复杂静态几何时再 Octree；不把整套示例 / `collision-world.glb` 或 Stats / GUI 依赖盲搬进来。 |
| 重复树木、灯杆、窗块 | [InstancedMesh 官方说明](https://threejs.org/docs/pages/InstancedMesh.html) | **reuse**。同 geometry / material 用实例化减少 draw calls；树 / 灯做原创几何，不必首轮采购环境包。 |
| Blender → GLB → Three.js | [Blender 许可说明](https://www.blender.org/about/license/)、[glTF 官方手册（4.0）](https://docs.blender.org/manual/id/4.0/addons/import_export/scene_gltf2.html)、[旧版英文 glTF 手册](https://docs.blender.org/manual/en/2.80/addons/io_scene_gltf2.html) | **reuse workflow**。Blender 软件 GPL 不把自行创作的 `.blend` / 输出美术强制变为 GPL。用少量材质、低模楼壳、独立简化碰撞体；导出 GLB 将 mesh / textures 打包，Three GLTFLoader 加载。只导出所需 objects，核法线 / Y-up / 变换。 |

手册验证限制：当前 latest 英文 Blender 手册和许可证页面 direct-open 返回抓取端 402；官方搜索索引能读取许可页和上述版本的手册段落。因此本轮只采用稳定的 GLB / 输出许可原则，**不声称当前 Blender UI 菜单 / Python 参数已验证**。正式 Blender 自动化前按实际安装版本读官方文档。首轮不用 Draco / KTX2 / 网格简化库，避免为 3 个楼壳增加解码器与工具链。

建议最小流程：官方图只供人工判断粗拓扑 → 手工原创 blockout（3–4 个有辨识度轮廓）→ 简化碰撞 → 走通 / 越界恢复 / 标识点 → 用获得授权的实拍或进一步人工核验修轮廓 → 有必要再 Blender。没有必要先全校测绘、抓取地图瓦片或寻找通用教学楼资产包。

## 4. Hks 当前许可与素材源：直接复用暂缓

核到的上游：[ShanEior/Hks](https://github.com/ShanEior/Hks)，默认分支 `master`，2026-10-29 当前 HEAD **`3cb39bc86050edd0a909b7a5c9f56de0670a3d48`**（commit 时间 2026-05-30）。[commit](https://github.com/ShanEior/Hks/commit/3cb39bc86050edd0a909b7a5c9f56de0670a3d48)；[完整递归树](https://api.github.com/repos/ShanEior/Hks/git/trees/master?recursive=1) 返回 `truncated:false`。

- GitHub 仓库元数据 `license:null`；当前完整树未见 `LICENSE` / `COPYING` / `NOTICE` / README 许可文件；[`package.json`](https://github.com/ShanEior/Hks/blob/3cb39bc86050edd0a909b7a5c9f56de0670a3d48/package.json) 也没有 `license` 字段。它声明 Phaser `^3.80.1`、TS / Vite，与 3D 校园目标技术差异大。**blocked：复制项目代码 / 图像 / 音效到新游戏，直至取得权利人的明确许可或用户能证明已有授权。** 公开可见、允许 fork、连接器显示 push 权限均不等于复制分发许可。
- [`src/ArtGen.ts`](https://github.com/ShanEior/Hks/blob/3cb39bc86050edd0a909b7a5c9f56de0670a3d48/src/ArtGen.ts) 头部描述 Canvas2D 程序化像素纹理，另有风格参考；这能说明该代码的生成方法，**不能替代作者授予代码复用许可**。
- [`src/GameScene.ts`](https://github.com/ShanEior/Hks/blob/3cb39bc86050edd0a909b7a5c9f56de0670a3d48/src/GameScene.ts) 的 preload 实际加载 7 个 PNG：`bg.png`、`building.png`、`monster_termite.png`、`monster_wind.png`、`monster_acid_rain.png`、`monster_fire.png`、`monster_freeze_thaw.png`，对应 `public/assets/`。**这些 PNG 的逐项作者、原始来源、生成记录、许可未核实。**
- [`assets/ai-prompts.md`](https://github.com/ShanEior/Hks/blob/3cb39bc86050edd0a909b7a5c9f56de0670a3d48/assets/ai-prompts.md) 提到 Holopix / Pixel Art Generator 的建议生成与后处理流程；[`assets/sprite-spec.md`](https://github.com/ShanEior/Hks/blob/3cb39bc86050edd0a909b7a5c9f56de0670a3d48/assets/sprite-spec.md) 说明精灵规格。**提示词文档不证明仓库现有每张 PNG 实际由哪个服务 / 账户生成，也不证明服务条款下有可转授权利。**
- 仓库含 `SXGJBWZ.zip`；本轮未下载 / 展开，不能排除其中另有文件，也不能把当前树无许可说成「所有历史及压缩包绝对没有许可」。不要为了找许可执行 zip 内程序。
- 指定 fork [`fork1263-ux/Hks`](https://github.com/fork1263-ux/Hks)：GitHub connector 对仓库 metadata 请求返回 **404 NOT_FOUND**；普通网页读取为 cache miss。**blocked / inaccessible to this connection**，不能据此断言仓库不存在、被删除或无许可；需要准确 URL / 已授权连接访问再核。

本轮省工选择：只研究 Hks 的玩法层组织思路，不复制表达性代码 / 图像；3D 主流程复用许可明确的 Three.js 官方类，所有校园几何与 UI 独立编写。

## 5. 明确没有拿到的资料（不是断言不存在）

- 用户提供的 [微信参考文章](https://mp.weixin.qq.com/s/VnDaqaKRRM6DPTjpp5isUg)：2026-10-29 web open 返回不可重试的读取错误；**未读内容，未推断标题 / 图片 / 地理事实**。若用户可提供截图或导出内容，再作为视觉参考核查权利。
- 校门最新正立面、建筑精确尺寸、现场照片拍摄位置、道路宽度 / 可步行连通性、两校区精确配准、官方图的开放复用授权：**unverified**。本轮没有找到可直接拿来分发的 TYUT 校园低模 / GLB / 开放贴图集；这不等于证明它们不存在。
- 下轮仅需补最影响观感的 2–3 张校门 / 地标外观和示意路线的现场核验，不以缺少全校资料阻塞一个明确标示为示意的原创小切片。
