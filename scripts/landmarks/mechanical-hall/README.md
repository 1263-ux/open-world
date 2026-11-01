# 机械馆：来源约束的自制地标

用 Blender4.3.2 内置 glTF 导出器制作，无外部模型或纹理。源占地为 OSM way182055474，公开数据见 public/data。单元测试校验元数据的25个基底顶点与当前校园数据完全一致；Python脚本进一步解析GLB二进制坐标轴、基底、尺寸、三角形和自包含性。

官方照片只作外观参考，不随模型分发。朝东的正立面来自突出体块的推断；三层侧翼约9m、中央塔约15m仍为展示估计，不是实测楼高。钟楼、窗列和背面有简化。保留OSM署名与ODbL来源说明，参见 docs/resources/ASSET_SOURCES.md。

生成建议在临时目录执行，避免预览PNG进入公共素材目录：

    MODEL_OUTPUT_DIR=/tmp/mechanical-output blender --background --python scripts/landmarks/mechanical-hall/generator.py

将输出的GLB与机械馆metadata复制到 public/assets/campuses/yingxi 后运行：

    python scripts/landmarks/mechanical-hall/verify.py

预览地面只用于CPU渲染，不在导出的模型里。浏览器加载失败保留原基础体块并提示；模型异步返回时校验校区世代，避免切区后旧模型错误回挂。

## 唯一生成源（2026-10-31）

本目录 `generator.py` 是机械馆几何的唯一事实源；导出 metadata 的 `generator` 字段也指向此路径。`scripts/art/mechanical_hall_refined.py` 仅为兼容包装，不再保留第二份几何实现。两入口显式设置相同 `MODEL_OUTPUT_DIR` 时输出同一 GLB；未设置时，canonical 默认输出本目录，legacy 默认输出 `scripts/art`，保持旧行为。`PREVIEW_RENDER=0` 可跳过预览。

当前局部候选为 18,617 triangles / 989,908 bytes，GLB SHA256 `909415d5968afede94bc64cc7a471fddf300e41455d0f6d260c2f3c9a1d674fb`。圆窗、石拱、檐口和钟面边框均为参考照片的原创展示推估；候选导出验证不等于游戏运行时验收。
