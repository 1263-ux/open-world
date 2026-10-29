> 来源副本：ChatGPT Library《01-工具配置与技术选型.md》
> library_file_id: `libfile_fbef848dce4c8191846307dd1ea399a4`；读取日期：2026-10-29 UTC；完整读取 90 行，无后续分片。
> 下方正文按完整 read 结果保留，不改写，文末统一补 LF 换行。Draft 中的建议、排期和操作清单是参考，不构成独立授权。当前选择以最新用户指示及 `../decisions.md`、`../progress.md`、根 `AGENTS.md` 为准。
> 注意：本地环境文件并不能阻止前端构建泄露密钥；详见最新安全决策。

<!-- ORIGINAL SOURCE TEXT BELOW; DO NOT REWRITE -->
# Open World · 太理校园世界：工具配置与技术选型

> Draft 0.1 · 2026-10-29 · OpenAI API 预算上限：90 美元

## 1. 首版目标

在浏览器中探索太原理工大学虎峪、迎西两个校区：校区切换、斜俯视 3D 场景、拖拽/缩放、点击地标查看信息、至少一条探索任务或小游戏。首版不追求全校 BIM 精度。

暂不做：室内逐层建模、实时多人、复杂账号系统、微服务、专用 GIS 平台、自研物理引擎。

## 2. 技术栈

| 层级 | 选择 | 用途 |
|---|---|---|
| 前端 | Vue 3 + TypeScript + Vite | 页面、任务 UI、内容索引 |
| 3D | Three.js | 浏览器 3D 渲染、相机、点击拾取、GLB 加载 |
| 建模 | Blender | 低多边形建筑、树木、道具 |
| 资产 | glTF/GLB | 模型与代码分离、按需加载 |
| 数据 | JSON + localStorage | 地标、任务、收集进度 |
| 测试 | Vitest + Playwright | 单元测试、浏览器关键路径 |
| 质量 | ESLint + Prettier + TypeScript strict | 代码质量 |
| CI | GitHub Actions | lint、typecheck、test、build |
| 部署 | GitHub Pages / Cloudflare Pages / Vercel | 静态部署 |

架构原则：Vue 管界面与状态，Three.js 管场景；用 `CampusScene`、`AssetRegistry`、`CampusData`、`GameRegistry` 分离职责。首版单体前端，不引入 Agent 框架运行时和后端。

## 3. Codex 需要的工具

必需：Git、GitHub CLI（`gh`）、Node.js LTS、npm、Codex CLI/编辑器集成、Chrome/Edge 开发者工具、Blender。可选：glTF Transform，用于压缩 GLB 和纹理。

初始化后应提供以下真实可用的命令：
```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```
脚本必须真实存在于 `package.json`，不能只在文档里承诺。

根目录创建 `AGENTS.md`，规定产品边界、目录职责、视觉规范、资源授权要求、必跑检查、任务交付格式。每个 Agent 明确负责文件范围，避免并行修改同一核心文件。

## 4. OpenAI API 预算：$90

| 用途 | 上限 |
|---|---:|
| 架构与复杂任务规划 | $25 |
| 实现与代码迭代 | $30 |
| 资料/开源项目研究总结 | $10 |
| 测试、修复与回归 | $15 |
| 预备金 | $10 |
| **总计** | **$90** |

建议在 OpenAI Platform 设置 $70 提醒、$80 暂停非关键调用、$90 停止调用。API 账单与 Codex 订阅额度通常属于不同计费体系，应分别核对。

成本纪律：
1. 先让 Agent 给计划，再批准执行。
2. 每个任务限定目标、文件范围、测试命令和验收条件。
3. 先本地测试，再请模型排查；连续两轮无实质进展就缩小问题范围。
4. 不允许 Agent 自动开通付费服务或超预算调用。
5. 每阶段记录实际账单和剩余预算。
6. API Key 不得进入前端、仓库、日志或截图；使用 `.env.local` 并加入 `.gitignore`。

## 5. 性能与验收目标

- 首屏尽快显示可操作场景；普通设备争取 5 秒内可交互，需实测。
- 当前校区优先加载，另一个校区和小游戏按需加载。
- 桌面目标 30 FPS 以上，需在目标设备实测。
- 重点建筑有辨识度，普通建筑使用可复用模块。
- WebGL 或模型加载失败时有降级提示。
- 构建体积、模型大小和主要用户路径纳入发布检查。

## 6. 技术参考

- Three.js：<https://threejs.org/>
- GLTFLoader：<https://threejs.org/docs/#examples/en/loaders/GLTFLoader>
- Blender：<https://www.blender.org/>
- glTF：<https://www.khronos.org/gltf/>
- Vue：<https://vuejs.org/>
- Vite：<https://vite.dev/>
- Playwright：<https://playwright.dev/>
- GitHub Actions：<https://docs.github.com/actions>

## 7. 决策状态

- **建议采用：** Vue 3 + TypeScript + Vite + Three.js + Blender/GLB。
- **建议采用：** JSON 驱动内容，首版不设后端。
- **待验证：** 是否需要 GIS/真实地理坐标；先用官方平面图校准局部坐标。
- **待确认：** Hks 授权与集成方式。
