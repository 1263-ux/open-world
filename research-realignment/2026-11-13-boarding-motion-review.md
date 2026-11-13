# 登船动作最小可行制作方案（只读研究，2026-11-13）

## 结论
不要继续固定整人 yaw 后把脚拖进船。也不建议为了一个登船过渡引入新引擎、运行时全身IK或整套新骨架。最低成本方案是保留 B2 骨架/外部根运动/现有 Sitting_Rig，重做“面向船 → 抬足 → 首足入船 → 转移重心 → 后足入船 → 转身坐下”的6个可读姿态；确定支持关系后再加中间帧。手先做自然平衡、不宣称扶舷，只有可达且全掌/手指接触验证通过才加入扶舷。

这是基于项目历史失败证据与官方工具能力的工程建议，不是已经验证的动作成果。本轮本地项目尚在恢复，未重新读取恢复后的骨架或运行GLB。

## 资源核验

### KayKit Character Animations：优先保留已有同源坐姿，不再寻找不存在的现成攀爬
官方当前页面明确提供 Rig_Medium / Rig_Large、FBX/GLTF 与 CC0 自由使用，含 movement 与 sitting 类别；Swimming/Climbing 被列在计划追加项，而非已交付列表。免费导出资产与付费 .blend 源文件区分，不能把免费理解为可直接取得控制rig源。
来源：https://kaylousberg.itch.io/kaykit-character-animations
官网补充：https://kaylousberg.com/game-assets/character-animations
采用：如果当前B2确实沿用此骨架，先复用已经实际持有和验证的 Sitting_Rig 末姿态与步行动作的身体节奏。不要基于来源相同便宣称所有比例/骨名能无损映射。
成本判断：低于跨骨架retarget；无需购买。未核实包内有 Sitting_Enter，不凭Sitting类别补造名称。

### Quaternius Universal Animation Library 2：确有免费 CLIMBUP 1M，但不是直接登船成品
官方 Standard 预览图已实际查看，列出 `CLIMBUP 1M`；该图同时标明42个免费CC0动画。官网宣传130+是整个包范围，不能把全部都说成免费。当前作者页称存在带/不带root motion版本，免费Standard包17MB、Source50MB为付费层。
官方页：https://quaternius.com/packs/universalanimationlibrary2.html
作者下载说明：https://quaternius.itch.io/universal-animation-library-2
实际查看的官方清单图：https://quaternius.com/assets/images/fullres/universalanimationlibrary2/standard.jpg
采用：可在需要时从作者正式免费入口取得导出资产，取抬膝/重心延迟的节奏作参考，或做独立重定向试验。不能把1m攀爬整体压缩成低舷动作：接触高度、比例、root平移与手撑位置会一起失真。
成本判断：中高；B2非同骨架时需检查rest pose、轴、肢长、root motion与足接触。本轮未下载动作二进制、未retarget、未实际播放，故不列为已可用资产。
第一库有sitting类别，但未核实免费清单包含哪一项具体坐下过渡，不建议凭第三方清单下注。
https://quaternius.com/packs/universalanimationlibrary.html

## 立即可执行的6姿态合同（Agent建议，不是外部规范）
1. 靠近：双足仍真实落码头，整人向“船内落脚点 − 岸上站位”的方向转身，不硬编码沿船纵轴。
2. 起步：后脚仍承担支撑；首脚先在舷外抬高，最低鞋底高于实际舷三角包络约4cm。髋不提前跨入舷。
3. 入首脚：首脚越舷落到真正船底，不是装饰折线/座板；保持后脚可达，必要时起步前收一小步。
4. 换支撑：首脚落稳后才释放后脚；髋随首脚进入，不在两脚悬空时用“有扶手”虚构支撑。
5. 入后脚：后脚先垂直抬清再横跨、再落地，不能用一条端点smoothstep斜线扫过舷；整人此时仍主要面对入船方向。
6. 转坐：双足已在船内后，再小步转到座位方向、屈髋坐下，最后精确接现有 Sitting_Rig。不要同时强行锁定远隔的双脚与最终座位骨盆。

每pose先看真实侧面与探索镜头，看到侧蹲/劈叉就先改身体方向和root，不先追小数误差。通过后再做60Hz扫掠：鞋、脚踝/小腿、腰/衣物、手指与新前侧鱼缸；相交计数要分硬鞋/手与软裤。髋投影只能是视觉重心代理，不是物理平衡证明。

## 官方Blender方法与具体用途
- IK约束的Chain Length定义影响骨链，Stretch明确允许伸展，Pole Target控制弯曲方向。对B2上/下腿建议明确2骨链、禁用stretch以暴露不可达，不让短腿被拉长掩盖路径问题。Pole改善弯曲方向，不解决root/靶点距离不可达。此2骨链设置是本项目建议。
  https://docs.blender.org/manual/en/4.4/animation/constraints/tracking/ik_solver.html
- Child Of支持动画化Influence、并提供Set Inverse保持建立关系前的位置。可用于制作期脚部目标在码头/船坐标间切换；先建立各空间的inverse，再切换，避免接触点突然跳动。不要把Child Of误用来重建骨骼父子链。
  https://docs.blender.org/manual/en/4.3/animation/constraints/relationship/child_of.html
- Bake Action计算含约束/driver的最终运动，Visual Keying记录最终变换。应在副本上烘焙，每帧采样后导出glTF，再重新导入/Mixer验证；不是把控制rig直接丢给运行时。清约束前先视觉烘焙并保留源Blend。
  https://docs.blender.org/manual/en/4.5/editors/nla/editing/strip.html
  https://docs.blender.org/api/4.5/bpy.ops.nla.html

## 证据边界与未做项
已核官方网页、实际查看UAL2官方免费清单图片，并读官方Blender搜索返回的相关正文。Blender完整页面直连返回403/搜索open返回402，未谎称逐页完整阅读。未下载未知程序/二进制、未购买、未修改项目、未实玩。先前临时下载的清单图片在环境重新出现后不可见，本报告保留官方原URL而不虚称本地仍有原件。官方营销图片只作研究，不应作为游戏资产发布。

## 恢复后本地核对补充
已实际读取 `character-lookdev/b2/provenance.json`、`build.py` 与 `seat-contract.json`。B2确实由官方KayKit CC0 Rogue派生，但代码明确延长了rest arm chains并重新制作手/衣裤/鞋，因此不能按“同KayKit”假定外部动作无须复核。当前坐姿是自己改过的低座fixed-pole two-bone IK、静态烘焙 Sitting_Rig；合同actorScale .78、actorY .04065、boatY .06、seatLocalY .185。最低成本末段应直接匹配该已保全低座末姿态，不拿新的高椅坐姿覆盖它。上述资料只核对来源与合同，没有本轮重新播放骨架。
