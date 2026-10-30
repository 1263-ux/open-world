# 太理 · 校园漫游 / Campus Atlas

一个浏览器里的低多边形校园探索原型，覆盖太原理工大学虎峪与迎西校区的示意地标、信息卡片和一条可完成、重玩、退出的探索任务。

> 当前仍是开发中的校园探索原型，尚未公开部署或完成视觉验收。占地轮廓来自 OSM / Overture，统一转换为米制坐标；楼高分别标注来源值、楼层估算、机器学习预测或展示用估算，不是实测模型或现实导航。

## 运行

Node.js 24；依赖版本由 package-lock.json 锁定。

```bash
npm ci
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

默认开发服务仅监听 127.0.0.1。本机预览地址由 Vite 输出。若已有适配的 Chromium，可通过 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH 指定；默认使用 Playwright 管理的浏览器。

## 当前功能

- 虎峪、迎西场景切换；斜俯视旋转、拖拽、缩放、重置。
- 点击建筑或使用键盘地标目录查看说明及来源。
- 按顺序记录地标，开始/完成/重玩/退出；本地进度保存，损坏存储安全回退。
- WebGL 不可用时仍可使用地标列表与任务流程。
- 响应式布局。实际移动设备性能仍待实测。

## 验证状态

已验证的主线版本为 `4ee33f834f25a6e1b51e8e6cad317406663dc951`：24 项单元测试及 5 项真实浏览器流程测试通过。[主线验证记录](https://github.com/1263-ux/open-world/actions/runs/40934250289)。

本次密集轮廓更新增加 6 项 Python 数据匹配回归，TypeScript 单测增至 26 项；新版本以对应提交的 GitHub Actions 结果为准。测试通过不代表建筑精度、真实手机性能或最终美术验收通过。

## 数据生成与精度边界

- 筛选后使用虎峪 94 个、迎西 129 个建筑多边形，包含原有 15 个命名地标建筑。数量是来源数据中的图形，不是现场核实的楼栋数。
- 已有 OSM 楼高、楼层优先。207 个高度采用轮廓高重叠的 2020 年 3D-GloBFP 模型预测；不匹配或矛盾数据不自动覆盖。
- 补充建筑以低细节体块批量渲染，重点建筑立面仍在深化。任务路线避开所有已接入楼体，但不保证现实可通行。
- 来源、许可证和筛选记录见 [数据说明](public/data/README.md)、[来源清单](public/data/sources/manifest.json)。学校照片仅作参考，不在仓库中分发。

离线重建需要 Python 3.12，建议使用虚拟环境：

```bash
python -m venv .venv
# 激活虚拟环境后：
pip install -r scripts/requirements.txt
python scripts/test_augment_buildings.py
python scripts/build_spatial_data.py
```

## 项目资料

- [执行规则](AGENTS.md)
- [三份原计划](.agent/plans/)
- [当前进度](.agent/CURRENT_STATE.md)
- [来源与复用调研](.agent/research/round-00-resources.md)
- [本轮检查记录](.agent/reports/round-01-local-checks.md)

MVP 先做可玩的单体前端，后端与多人为后续方向。API 只用于开发过程，网站运行不需要 API key；任何密钥都不得进入仓库或客户端。
