# 机械馆：来源约束的自制地标

用 Blender4.3.2 内置 glTF 导出器制作，无外部模型或纹理。源占地为 OSM way182055474，公开数据见 public/data。单元测试校验元数据的25个基底顶点与当前校园数据完全一致；Python脚本进一步解析GLB二进制坐标轴、基底、尺寸、三角形和自包含性。

官方照片只作外观参考，不随模型分发。朝东的正立面来自突出体块的推断；三层侧翼约9m、中央塔约15m仍为展示估计，不是实测楼高。钟楼、窗列和背面有简化。保留OSM署名与ODbL来源说明，参见 docs/resources/ASSET_SOURCES.md。

生成建议在临时目录执行，避免预览PNG进入公共素材目录：

    MODEL_OUTPUT_DIR=/tmp/mechanical-output blender --background --python scripts/landmarks/mechanical-hall/generator.py

将输出的GLB与机械馆metadata复制到 public/assets/campuses/yingxi 后运行：

    python scripts/landmarks/mechanical-hall/verify.py

预览地面只用于CPU渲染，不在导出的模型里。浏览器加载失败保留原基础体块并提示；模型异步返回时校验校区世代，避免切区后旧模型错误回挂。
