# 开发进展与证据

更新：2026-10-29 UTC。分类：**C2 + R-architecture + R-security + R-ui；本轮仅本地文档工件**。这不是应用完成报告。

## 已完成

| 声明 | 证据与边界 |
|---|---|
| 三份原计划已完整读取并保存 | Library read：90/98/191 行，均 `has_more=false`；见下方来源与校验表。保留原稿，不用 search 摘要代替全文。 |
| 当前规则与过时草案分离 | 根 `AGENTS.md`、`.agent/decisions.md` 记录最新持续推进/main 直推授权、可逆默认、预算未知与条件性排期。 |
| 本轮计划前已调研复用点 | 2026-10-29 阅读官方 OrbitControls、GLTFLoader、Vite env 和 Poly Haven 许可；URL/适用结论见 decisions。未加入资产或付费服务。 |
| 仓库初始状态核验 | 本任务开始时 `git status --short --branch`：`No commits yet on main`；origin `https://github.com/1263-ux/open-world.git`；HEAD 不存在符合空仓库状态。此项仅为起始快照。 |
| 安全忽略规则已建立 | `.gitignore` 排除 `.env*`、凭据/私有原始资产、依赖及构建产物；以 `git check-ignore` 验证。忽略规则不等于已做所有历史秘密扫描。 |
| 专用 CLI 登录已由主控核验 | 主控报告仓库外独立 auth 保存成功，登录检查 exit 0；本子任务未读取或输出任何密钥，未独立重复登录。模型请求验证另记。 |

## 原计划保真记录

完整 Library read 输出的正文各比元数据 `size_bytes` 少 1 字节且无末尾换行；本地仅在正文末尾统一补 LF。以下 SHA-256 是**read 返回的正文文本**（不含来源注释、不含补加 LF），不是对未取得原始字节的冒充校验。

| 本地副本 | Library ID | read 正文字节 / 原元数据 | read 正文 SHA-256 |
|---|---|---|---|
| `plans/01-tools-and-stack.md` | `libfile_fbef848dce4c8191846307dd1ea399a4` | 4026 / 4027 | `30d1b73cb06509e59d53d5627409cd5510077bf0d0be1146f4ebde07d279d007` |
| `plans/02-resources-and-references.md` | `libfile_615efe2111288191b24eb7e280ae8464` | 5442 / 5443 | `eb875ffc54798882152633732f3bcd4c318fae1c8d6b41eb23737853bc6fef02` |
| `plans/03-roadmap-and-acceptance.md` | `libfile_f5e48d4e73708191a07b967b151e6015` | 8070 / 8071 | `662451e75959b4157e64accfd37851336bdd811a29ad5fef7cef4943c2e1f526` |

## 当前未完成 / 未验证

- **应用尚未实现：** 本文档子任务未建立 package.json、安装依赖、运行 app、建模或浏览器测试。不声称 npm 脚本/CI 已存在或通过。
- **模型权限：** 主控已认证核验 `gpt-6.1-terra` / `gpt-6.1-sol` 在列表，`gpt-6.1-luna` 不在，`gpt-6-luna` 在；不能静默替代。简单任务暂由 Terra 承担；若用 6-Luna 须用户同意。首次 CLI 推理 smoke 在发模型请求前因环境 sandbox/socket mode 检查阻塞，主控保留沙箱诊断中；推理和计费均未验证成功。
- **账单：** API 上限 $90、到期日 2026-11-26 已记录；实际消耗/可用余额未取得，记“未知”，不是 $0 或剩 $90。
- **资料与许可：** 具体校门/建筑、两校区可分发底图、Hks 代码及素材许可未完成；未核验资产不得合入。
- **体验决策：** 地图视角为可逆默认，角色控制未定；批量模型前需要视觉基准检查点。
- **时间线：** 11-23 冻结 / 11-24–25 QA 是压缩提案，不是已达成里程碑或保证日期。
- **发布：** 主控有测试后 main 直推授权；本子任务没有 commit/push。公开部署访问范围仍未明确授权。

## 验证记录（本轮）

- Python 对三份本地正文抽取后与完整 read 文本逐字节比较（除统一末尾 LF）：通过。
- Python 检查 9 个交接文件存在、内部相对引用可解析、无行尾空白/明显 key 模式，三份正文 hash 与预期一致：通过。此模式检查不是穷尽的秘密审计。
- `git diff --check`：通过；因交接文件尚未跟踪，另以 Python 检查全部新文件空白。`git check-ignore`：9 项应忽略、5 项应保留，全部通过；`git status` 只有 `.agent/`、`.gitignore`、`AGENTS.md`、`README.md` 未跟踪，无应用变更。
- 应用 lint/typecheck/unit/build/E2E：**未运行，不适用本轮纯文档交接；尚无应用脚本。**
- 本轮实际执行模型/路由及 API 花费：**运行工具未提供，未知**。用户模型偏好不作为实际调用证据。
- `code_identity`：未提交文档工作树，最终以本轮交接的文件清单/内容校验为依据；尚无 commit SHA。

## 接续顺序

1. 主控合并最新模型/CLI/余额证据到当前状态，不能读取密钥内容来“证明”。
2. 下一开发轮先重读计划与本状态，做 Vue/Vite/Three 当前官方脚手架与许可调研，再提出短计划与明确文件所有权。
3. 在持续开发授权内建立最小可运行技术骨架与真实测试脚本；先闭环一个校门/2–3 建筑/一条任务，不先铺满双校区细模。
4. 补官方校园事实与来源表、视觉基准，验证后扩为双校区；主控检查后可直接推 main，核验远端身份及 CI。
5. 更新每轮真实证据/费用/阻塞，按重大成果通知用户；不以“计划已写完”冒充用户要求的校园世界做好了。

## Round 01 update — 2026-10-29 14:22 UTC

The initial status above is historical. See CURRENT_STATE.md and reports/round-01-local-checks.md for current implemented features, 20 passing unit tests, actual API model usage and blocked local browser checks. A temporary CI branch will be used before advancing main. No public deployment or final completion is claimed.

## Round 01 verified checkpoint — 2026-10-29 14:35 UTC

API-authored plan/scene/UI integrated;20 unit tests and5 real browser tests passed in GitHub Actions run40892347891 for69334abb9dcb7d7f31933a2956d54bc8a858a59b. The code is now on main. Original procedural meshes are still placeholders, not precise campus assets. Visual baseline images prepared for user review. No public deployment. Further external-API private-source review awaits the explicit sharing confirmation requested after a tool rejection.
