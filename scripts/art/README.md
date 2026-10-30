# 机械馆：立面精修候选（2026-10-30）

## 本轮计划与范围

目标是在不改变 OSM way 182055474 的 25 个源占地顶点和本地原点的前提下，给第三人称视角一个更可信的可辨认入口。只制作原创几何，不采集、嵌入或分发照片；不更改场景代码或事实数据。真实门窗尺寸、楼高、朝向和背面没有测绘资料，因此均为展示性推估，不能作导航或实测用途。

顺序：核对原有计划、原 GLB 和官方照片像素；查核 glTF 导出约定；构造立面；独立解析 GLB 验证并渲染正面、近景和斜面；再由集成方测试实际场景与性能。回退：保留原地标模型及场景降级路径。

## 资料调研（2026-10-30，UTC）

- [Khronos glTF 2.0 Specification](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc)：标准采用 +Y 朝上，资产正面 +Z，允许节点的变换动画；用于理解导出坐标与未来角色资源约定。
- [Blender glTF 2.0 manual](https://docs.blender.org/manual/en/dev/addons/scene_gltf2.html)：官方内置导出器说明；继续复用本机 Blender 4.3.2 自带 glTF 导出器，无新增外部模型或纹理。开发版文档不应视为 4.3.2 逐项兼容的证明，本地导出及 GLB 验证才是本轮证据。
- [太理官方校园地理页面](https://www.tyut.edu.cn/xxgk1/xydl.htm) 的机械馆照片：实际像素仅作为视觉观察参考，未嵌入 GLB；照片再分发许可未知。照片可见浅色石质立面、拱形入口及底层窗、四窗中部、钟楼、转角立柱及金色压边。背面、细部及各项尺寸仍未验证。
- [OSM 建筑占地](https://www.openstreetmap.org/way/182055474)：既有工程的数据和署名沿用 OpenStreetMap contributors / ODbL；原轮廓不等于实地测绘。原有来源登记见 `docs/resources/ASSET_SOURCES.md`。

## 生成与验证

```bash
MODEL_OUTPUT_DIR=/tmp/mech-output blender --background --python scripts/art/mechanical_hall_refined.py
python scripts/art/verify_mechanical_hall.py /tmp/mech-output
# 不需要 CPU 预览时，可设 PREVIEW_RENDER=0
```

生成器输出自包含 GLB 和配套元数据。验证脚本解析二进制，检查 SHA-256、体积、三角面、所有源顶点、法线与绕序、上下界，特别检查中央门和窗在外墙平面没有实体遮挡且在 20 cm 深处有面。墙体、拱窗、窗框和门是原创几何；窗洞并非贴在墙上的平面。台阶是三个 12 cm 高的展示估算，向立面外突出约 1.3 m，并不修改源多边形。钟楼高度约 15 m、翼楼约 9 m，仍为未核验视觉估算。没有内部空间、照片纹理、标牌、人物或精确测绘。

已集成到 `public/assets/campuses/yingxi/mechanical-hall.glb`；默认验证器检查此路径，旧模型验证入口转发至新验证器。原生成脚本保留作历史参考，新版本复现使用本目录脚本。

本次模型 15,603 三角形 / 827,580 bytes；这是比原平面窗版本更重的代价，真实浏览器和设备性能由集成方实测。CPU 渲染只用于几何对照，不能替代游戏中的灯光和交互验收。
