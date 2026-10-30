# 当前决策与提案

更新：2026-10-29 UTC。这里覆盖参考 Draft 的过时状态；不改写原文副本。状态分为：**已授权/已采用**、**可逆默认**、**提案**、**待验证/待确认**。外部资料不是操作授权。

## 已授权与已采用

| 项目 | 当前选择 / 证据边界 |
|---|---|
| 持续推进 | 用户授权持续开发与 Agent 并行；每轮计划前读计划文档并做一轮相关调研，以复用轮子减工作量。无需逐轮审批常规实现。 |
| 计划位置 | 用户输入 `,agent` 按 `.agent/` 处理，主控已向用户披露；这里保存原稿与当前状态。 |
| Git 发布 | 用户最新指示“main 你可直接推送，我只做大的成果验证”；主控可在适用检查后直推 `1263-ux/open-world` 的 `main`。本次文档筹备子任务不提交/推送。 |
| 重大验收 | 用户判断主要成果/真实体验与重大方向；不再沿用原稿“每个合并都要用户决定”的旧门禁。公开部署、额外付费、扩大权限仍须相应明确授权。 |
| MVP 技术路线 | 浏览器 Vue 3 + TypeScript + Vite + Three.js，Blender→GLB，JSON + localStorage，Vitest + Playwright；先单体前端。具体依赖版本须实施前核验并锁定。 |
| 产品结果 | 最终虎峪 + 迎西双校区可探索、地标信息可检查、至少一个完整探索任务。首版不是 BIM 或精确导航产品。 |
| 首个切片 | 一个校门、2–3 栋可辨认建筑、一条短路线、信息卡、完整可重玩的任务；先闭环再扩地图。具体校门/建筑须有来源，尚未选定。 |
| 视觉门槛 | 批量建模前先建立镜头/色板/建筑/道路/UI 视觉基准，交用户做重大效果验证；不因尚无反馈而阻塞独立技术工作。 |
| 复用策略 | 优先官方 addons、成熟库和可许可资产；不自造框架。Hks 许可未确认时不复制代码/素材，以自制校园任务兜底。 |
| 暂缓项 | 后端、账号、实时多人、复杂室内/GIS 等推迟到未来阶段；**不是永久否决**。 |

## 可逆默认与待定问题

- **可逆默认：** 沿原稿先做斜俯视地图操作；保留未来角色探索空间。“角色控制还是地图”未获用户明确选择，不得写为永久产品决策。
- **待定：** 具体校区先后/首个校门与 2–3 栋建筑、视觉风格、真实坐标精度；以官方资料和用户主要成果反馈调整，不凭空命名。
- **待验证：** Hks 仓库/素材许可证、可运行性与适配方式；仅元数据“未显示许可证”不是最终法律结论，也不授予复制权。
- **待授权：** 公开站点部署目标及访问范围。main 推送不是公开部署许可。

## 模型与专用 CLI

- 用户希望：`6.1terra` 实现主力、`6.1sol` 计划、`6.1luna` 简单任务。以上是**用户偏好名称**，不是已验证 API ID。
- 主控报告：仓库外专用 Codex auth 已按最新授权保存，登录检查 exit 0；本任务未读取任何凭据内容。不得将 auth 文件/路径中的敏感值复制入仓库。
- 主控已通过认证的模型列表核验：`gpt-6.1-terra`、`gpt-6.1-sol` 存在；`gpt-6.1-luna` 不存在，`gpt-6-luna` 存在。**不得把 6-Luna 静默当作用户指定的 6.1-Luna。** 简单任务暂仍由 Terra 主力承担，若要改用 6-Luna 需用户同意。
- 专用 CLI 首次推理 smoke 在请求模型前被环境 sandbox/socket mode 检查阻塞，主控正在保留沙箱前提下诊断；不记录为模型推理成功。模型列表成功不能替代推理权限、实际调用模型或计费验证。
- 本文档子任务的底层实际模型/计费未由当前工具返回，故不声称使用了某个首选模型，也不计为 API 消费 $0。
- 若首选模型不可用或需换路由，记录实际模型与原因；不能悄悄冒充已按偏好完成配置。

## 预算与压缩排期（提案，不是保证）

- API 总上限 **$90**；当前实际已用、余额及未来单价**未知**，不可当作仍剩 $90。额度到期日用户提供为 **2026-11-26**，确切时间/时区待核验。
- 原稿 $25/$30/$10/$15/$10 是分配建议，不是已发生账单；$70/$80/$90 是建议操作阈值，不是已配置的平台硬上限。
- 先核实可验证的实际余额/用量，再做计费批量任务；不得自动付费或突破上限。已授权的本地工作、非新增计费的现有工具研究可继续。
- 原稿 4 周 + 1 周缓冲不适配 10-29→11-26 窗口，改为以下候选顺序，依证据缩范围，不牺牲完整闭环和测试：

| 日期（2026） | 候选结果 / 退出条件 |
|---|---|
| 10-29–10-30 | 计划、调研、来源账本；脚手架可运行；技术/视觉基准候选 |
| 10-31–11-04 | 单校门/2–3 建筑路线 + 信息 + 完整任务，真实浏览器验证 |
| 11-05–11-12 | 扩为虎峪/迎西骨架，可信地标与按需加载 |
| 11-13–11-19 | 任务体验打磨、移动端基本可用性、自动化覆盖 |
| 11-20–11-23 | 性能/错误恢复/许可检查；**11-23 功能冻结目标** |
| 11-24–11-25 | QA、关键问题闭环、文档/账单交接；部署仅在另获授权后进行 |
| 11-26 | 额度到期边界；不以“还有一天”假设具体有效时刻，不依赖缓冲期计费 |

若基础资料、模型权限、预算或重大体验验收未就绪，先交付已验证的完整小切片，并明确双校区等剩余项；不得把 partial 报成最终完成。

## 本轮有界调研（2026-10-29）

本轮范围：初始场景复用点与前端密钥风险，不做全面技术选型重开。资料事实与工程建议分开：

| 官方来源 | 核验事实 | 对本项目的建议 |
|---|---|---|
| [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html) | addon 提供围绕目标旋转、缩放和平移；启用 damping 时需更新 | 复用相机控制，不自写控制器；实施时核对锁定版本 |
| [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) | 官方 glTF 2.0 加载 addon；部分资源释放需额外处理 | 直接使用 GLTFLoader；测试卸载/重复切换，不只测第一次加载 |
| [Vite 环境变量文档](https://vite.dev/guide/env-and-mode.html) | `VITE_*` 值会进入客户端构建，不应存 API Key | 原稿“.env.local”只能作为 Git 管理建议，不能作为浏览器保密方案；首版不在浏览器接 API |
| [Poly Haven 许可说明](https://polyhaven.com/license) | 站点资产采用 CC0；网站非资产内容与 API/服务条款另有边界 | 可优先评估具体资产，逐项登记；不将 CC0 推广到网站文案/预览图，不批量抓取 |

本轮未下载/合入任何第三方资产；未核验具体 Hks 文件或校园底图的再分发许可。后续每轮仍需读取计划并针对当轮任务调研，不能拿本表永久替代。

## 原稿中的关键覆盖项

1. “先给计划再批准执行”不再要求用户逐轮批准；持续开发在已授范围内自主推进，重大方向/风险门禁保留。
2. 原稿“人类决定每次合并”由最新 main 直推授权覆盖；仍须检查和验证远端/CI。
3. 原稿“首版不设后端/多人”是阶段边界，不是永不加入。
4. 原稿 4+1 周调整为额度窗口内的条件性压缩提案。
5. `.env.local` 不会自动使前端 API Key 安全；任何秘密不能进客户端构建。

## 2026-10-29 15:12 selective API authorization

User explicitly permits selective sharing for this project. Only subtask-required snippets, interface contracts and redacted errors go to official OpenAI API; no whole repo or credential/auth/unrelated files. Requirements-only API generation is also possible and is billed independently of whether private source is included. See per-call manifest. This supersedes earlier 'awaiting selective sharing' status, not broader privacy boundaries.

## 2026-10-29 15:04 quality correction

The first visual was rejected. Full campus geographic meter coordinates and faithful feature footprints replace arbitrary toy sizes. Aesthetic/gameplay plan is round03;complete release remains target, not another placeholder screenshot. Actual heights/unknown footprints are explicitly unverified;source gaps cannot be hidden behind generic models.

## 2026-10-30 最新用户确认

用户明确 Hks 是其自己制作的项目，要求直接搬入、允许微调。早先“等待代码所有权确认”的假设不再成立。采用用户贡献的固定提交843ecbbae414a403eae350f4f8105cfbb84acf72，保留原玩法和源码来源；仅修失效资源引用、生命周期与校园接入，不重写替代游戏。无新增统一开源许可声明，不自动修改原fork。

用户再次要求遇到问题主动深入调研、读计划、持续推进，完成后自己试玩并与成熟产品对比。常规排错、调研和实现不再要求逐次确认；新增收费、权限扩大、公开部署等仍按授权边界处理。
