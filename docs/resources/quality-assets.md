# 校园品质样板：可复用资产候选与验证

调研日期：2026-10-30 UTC。仅为候选；此文档不代表候选已进入游戏或满足最终验收。原始和衍生文件暂存于仓库外 `/workspace/scratch/dfaf4727a8b4/asset-candidates/`；最终入库时由资产/集成人确认路径、记录改动并随项目附来源。未经验证的图像/文件不应直接发布。

## 观察与选择原则

对照 `thirdperson-campus-second/test-results/http/explore-default-Yingxi-hal-9f387--and-runtime-frame-evidence/yingxi-post-warmup-hall.png` 实看：机械馆已可辨认，但角色为粗玩偶比例，树为球形块，步道缺少细节。目标是人尺度、辨识清楚、统一暖净校园，而非换一个不同风格玩偶或堆满高对比真实材质。以下候选像素实看是局部改进，不代表“一流水准”。

## 角色：优先做实机场景试验

**Quaternius — Ultimate Modular Men / Casual_2**：作者的[具体包页](https://quaternius.com/packs/ultimatemodularcharacters.html)直接标 CC0、11 人物、24 动画、glTF；由该页指向的[原始文件](https://drive.google.com/file/d/1Jn7kULNmrtqP8BUUL19h8MhbdOnwPFhv/view)下载到 `Casual_2.gltf`。包内 [License.txt](https://drive.google.com/file/d/1TTvylHa1CsiJuHFWWiv6PFGhLM-aAH5z/view)实际写 Ultimate Modular Males、CC0 1.0 Universal；作者 [FAQ](https://quaternius.com/faq.html)确认可商用、修改、无需署名（仍建议记来源）。`Casual_2.glb` 是将原始内嵌 base64 buffer 直接无损重封装到标准 GLB，未换骨骼、材质或动作；1,611,924 字节，SHA-256 `c0f29d4e7af1be4b573ceaa0634183b0622cc48295187e274a3acab88ca64afc`。索引统计 5,776 三角；无外部图像或 buffer 依赖。Three GLTFLoader 实际 parse 成功，AABB y=-0.0015..1.8144，高约 1.816 m，近脚底原点，像素观察朝 +Z；动画 `Idle`/`Idle_Neutral` 1.67s、`Walk` 1.33s、`Run` 0.80s，合计 24 clips。**没有 Jump**：不能伪称完整跳跃动作。Blender 渲染 `casual2-render.png` 是灰色短袖、长裤的低面真人比例；相比现有人物是实质改善，但仍有明显棱角、服装普通，需放入现场决定能否作为过渡，而非视为最终高质量人物。应做动画交叉淡入、脚底/移动速率/朝向、地面阴影、资源失败与释放、移动设备性能验收。

另一个同包源文件 [Casual_Hoodie](https://drive.google.com/file/d/1em1So1xwwQNfHJYMvzKcXkZllvtxpKP5/view)，`Casual_Hoodie.glb` 1,646,732 字节，SHA-256 `d647ee4ca1c66008bca70aafcc0315b62c8ac0a6bc0f611e369569b43d0b214b`，6,206 三角，AABB 高 1.828m，同样 24 clips、无 Jump。`hoodie-render.png` 显示紫连帽衫和短裤。来源、许可、重封装方法同上。

**不推荐直接投入的替代**：[Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) 页面称 CC0、glTF、均值 13k 三角且兼容 [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html)，后者标 CC0 / GLB；但实际看官网宣传图 `universalbasecharacters.jpg`，只有内衣人体底模，不能直接作为校园学生。服装、重定向、免费包具体动画及 Three 兼容性均未证实。未下载该包，勿按官网整体动画数假设免费包具有全部动作。

## 树：视觉候选，许可文本不一致待解决

**Quaternius — Ultimate Stylized Nature / BirchTree_1**：作者[具体包页](https://quaternius.com/packs/ultimatestylizednature.html)标 CC0、glTF、可商用，[作者官方 Drive](https://drive.google.com/drive/folders/1IV3bXHzkNvuNWFHPi4KPx-G4ghuxIuT-) 含模型及贴图。实际 `BirchTree_1.gltf` + `.bin` 与三张贴图已下载并 Blender 导入，4,596 三角，原始网格约 2.71×1.94×5.45 m。`tree-render.png` 直接渲染出分层金色叶片和树枝，明显比球形树有层次，但其秋色、白桦树形是否适合地标场景应由实景验证；不应当作实测真实树种。

重封装 `BirchTree_1_1k.glb` 为 657,308 字节、SHA-256 `dae0f07965b86db4554c621313d654ee218335391040f8b11d7a1111e52f3d56`；贴图最长边缩到 1024，树皮和法线转有损 JPEG，树叶保留透明 PNG，全部嵌入 GLB。Blender 成功导入，`tree-packed-render.png` 与原渲染肉眼相近，**尚未验证 Three 中透明、阴影、多个实例性能**。

**许可不一致：** 官方包页直接声称 CC0，但该官方 Drive 根目录 `License.txt` 实际写的是“Ultimate Platformer Pack”而非 Nature。不能把这个错名文件视为对具体树的无歧义包内确认；需补证或向作者核对后再分发。候选当前只在仓库外，不投入发布。

## 铺装：可用的已核验材质，但暂不建议未经艺术测试混搭

**Poly Haven — Rectangular Paving**：作者 Dimitrios Savva；[资源页](https://polyhaven.com/a/rectangular_paving)直接标 CC0、2m 宽，[许可页](https://polyhaven.com/license)明确可商用和修改、无需署名。由[官方 API](https://api.polyhaven.com/files/rectangular_paving)下载 1K JPG diffuse、OpenGL normal、roughness，实际字节分别 649,580 / 637,525 / 432,381，MD5 均与 API 一致；合计 1,719,486 字节。`rectangular_paving_Diffuse_1k.jpg` 等在候选目录。该资源是写实粗石铺装，与现有简化建筑/低面人物可能冲突；应在两米物理平铺尺寸、色彩空间、法线强度、远距重复感和移动显存预算下试验，而不是全校园铺满。仓库路径：尚未入库。

## 其他候选和缺口

[Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html)单包明确 CC0、glTF，官网宣传图 `stylizednaturemegakit.jpg` 里叶片、花草、树枝较丰富；但免费的 60–70% 子集具体内容、大小及具体模型尚未下载验证，宣传图不等于免费子集，不能直接入库。其付费 Source shader 不能假定包括在免费 glTF 里。

[Poly Haven Painted Wooden Bench](https://polyhaven.com/a/painted_wooden_bench)具体页标 CC0、630 tris、1.2m，但画面偏室内复古，非理想校园长椅；[Modular Streets](https://quaternius.com/packs/modularstreets.html)具体包标 CC0，页面只列 FBX/OBJ/Blend、未确认适合校园的灯和长椅。**本次没有完成可交付、实物像素验证且风格协调的长椅/路灯**，不以候选名称冒充完成。真实人形 Jump 动画也未解决。

## 验证边界

以上查阅和下载均于 2026-10-30；Blender 4.3 导入渲染、Three GLTFLoader Node parse 不等于浏览器设备/游戏动态验证。脚滑、材质色彩、动画过渡、同屏成本、首次载入和失败降级必须在候选构建内测。未使用付费服务或新增凭据；未经许可不复制非授权参考站素材。

## 交接：已选 Hoodie，目标路径 `public/assets/characters/casual-hoodie.glb`

- 作者 Quaternius；包 [Ultimate Modular Men Pack](https://quaternius.com/packs/ultimatemodularcharacters.html)（该页面标明 CC0、glTF、24 animations）、官方包 [Drive 根目录](https://drive.google.com/drive/folders/1USAAquX2JJWuA2m6zol0KUkFe3UkZ8zX) / [glTF 子目录](https://drive.google.com/drive/folders/1qpSIycVWTwhKMgyA_bEFHPh1CfBBBa09) / [Casual_Hoodie.gltf](https://drive.google.com/file/d/1em1So1xwwQNfHJYMvzKcXkZllvtxpKP5/view) / [包内 License.txt](https://drive.google.com/file/d/1TTvylHa1CsiJuHFWWiv6PFGhLM-aAH5z/view)。该许可证文件名 `Ultimate Modular Males` 与包名同义，实际写 CC0 1.0 Universal；可复制、改编、商用，署名非强制但本项目保留来源。下载日 2026-10-30。
- 原始 `Casual_Hoodie.gltf`：3,104,001 bytes，SHA-256 `dd74886c26998a0fa888b4ce557a0932d7d97b0265dd4c763154d081b7a6cb98`。许可证副本 `license-men.txt` SHA-256 `e8dbf915a2b82229913e301a0787696611241bdefec4832bc084f54161db1efe`。
- 输出 `Casual_Hoodie.glb` → 计划由集成人拷贝为 `public/assets/characters/casual-hoodie.glb`：1,646,732 bytes；SHA-256 `d647ee4ca1c66008bca70aafcc0315b62c8ac0a6bc0f611e369569b43d0b214b`。仅将单个内嵌二进制 buffer 从 base64 移至 GLB BIN chunk；JSON 与 BIN 规范对齐，模型和动画内容未重建，未引用外部图像或文件。Blender 4.3 和 Three GLTFLoader 均能解析；6,206 索引三角（未做性能测试）。
- Three 默认姿态 AABB 最小 `(-0.27346, -0.00430, -0.17099)`，最大 `(0.33094, 1.82387, 0.47195)`，尺寸约 `(0.60440, 1.82817, 0.64294)`；脚近 y=0。Blender 像素预览的正面相机对应 glTF +Z，前向为 +Z 的结论仍需最终运行中核验。不是在动画所有帧的包围盒。
- 精确 24 动画名：`Death`, `Gun_Shoot`, `HitRecieve`, `HitRecieve_2`, `Idle`, `Idle_Gun`, `Idle_Gun_Pointing`, `Idle_Gun_Shoot`, `Idle_Neutral`, `Idle_Sword`, `Interact`, `Kick_Left`, `Kick_Right`, `Punch_Left`, `Punch_Right`, `Roll`, `Run`, `Run_Back`, `Run_Left`, `Run_Right`, `Run_Shoot`, `Sword_Slash`, `Walk`, `Wave`。使用非武器的 `Idle`/`Idle_Neutral`, `Walk`, `Run`；**无 Jump**。如现场继续保留跳跃，只能明确它是程序位移配占位姿势而非真实跳跃动画。
- 集成状态：本文写作时仍仅在仓库外。集成人复制后须校验目标文件哈希并同步最终资产来源清单；现场运行、脚滑/镜头、阴影、帧率与游戏美术统一性尚待验证。
