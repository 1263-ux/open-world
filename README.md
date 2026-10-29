# 太理 · 校园漫游 / Campus Atlas

一个浏览器里的低多边形校园探索原型，覆盖太原理工大学虎峪与迎西校区的示意地标、信息卡片和一条可完成、重玩、退出的探索任务。

> 当前是技术与视觉样板。建筑外观、尺寸及局部坐标为原创程序化示意，不是准确复原或导航地图。尚未公开部署。

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

本地 typecheck、lint、20 项单元测试、build 已通过。GitHub Actions 已在提交 `69334abb9dcb7d7f31933a2956d54bc8a858a59b` 上通过全部检查，包括 5 项 Playwright 浏览器测试（桌面/移动视口、画布拾取、任务、刷新、WebGL 初始化失败与运行时 context loss）。[验证记录](https://github.com/1263-ux/open-world/actions/runs/40892347891)。这只证明技术样板通过已列测试，不代表建筑精度、真实手机性能或最终 MVP 已验收。

## 项目资料

- [执行规则](AGENTS.md)
- [三份原计划](.agent/plans/)
- [当前进度](.agent/CURRENT_STATE.md)
- [来源与复用调研](.agent/research/round-00-resources.md)
- [本轮检查记录](.agent/reports/round-01-local-checks.md)

MVP 先做可玩的单体前端，后端与多人为后续方向。API 只用于开发过程，网站运行不需要 API key；任何密钥都不得进入仓库或客户端。
