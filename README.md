# 太理 · 校园漫游 / Campus Atlas

更新：2026-11-01。**公开 v7 已发布，但用户明确反馈“依旧不够好”。当前应称低保真、可运行的校园功能原型，不是已达到用户期待的完整高品质作品。** 技术门禁通过与用户对品质满意是两个不同结论。

[打开公开 v7](https://tyut-campus-world-private-preview.aglowswan513.chatgpt.site)

## 现在有什么
- 虎峪、迎西两个校区的示意场景、地标资料、探索任务和地图。
- 第三人称角色步行；桌面 WASD、拖动视角、Shift 跑、Space 跳，触控使用摇杆与屏幕按钮。地图是辅助，不是旧版斜俯视地图控制模式。
- 迎西校园手记：两张地面照片→真实走上原创低台拍第三张→下台绕到折叠站→纸飞机三道门和落地→保存、重开或继续漫游。
- 独立可选 Hks 古建守护小游戏；返回继续校园旅程。上游与修改记录见 [Hks 说明](games/hks/README.md)。
- WebGL 不可用时提供地标/任务无障碍界面；这不等同完整 3D 玩法。

## 验证到哪一步
- 功能验证提交：`38d9b0a372a2a3234ec111a44a8391414c73e56b`。
- [同提交 CI 41290585490](https://github.com/1263-ux/open-world/actions/runs/41290585490)：6 个必需 jobs 通过，39 个实际浏览器用例、125 单测；3 个可选诊断 jobs 未运行。
- 公开 v7 Site source：`c4ccc0c681685bb705b8e534138f0b8ebf3c375b`；部署：`appgdep_6ae705dd4ac08191a9491a89abf6451e`，状态 succeeded。
- 223 项应用输入清单 SHA256：`d6f5ff69a49912b5480c202be27a4ce478abb4039a217cbd38ef6bea9ed0ad14`；63 项构建清单 SHA256：`7f6b59c5b6826b4ae58543d4c3a2b8aefc5b4613f3224c60eeba0ca72e898ef8`。
- 后续纯文档提交不是新的功能验证或新部署，不能把文档 head 冒充运行锚点。

## 尚未做好与验证边界
- 校园大部分仍是低细节体块，场景质感、角色/镜头与界面整体品质未达到用户期待；通过功能测试不证明美术或游玩体验优秀。
- 横屏完成面板与背景跑跳控件存在叠压/低对比。CI 关键操作可读且流程通过，不等于所有比例都理想。
- 实体手机和普通设备性能未测。软件渲染 CI 的低帧率与长测试耗时不能作为真机性能结论，也不能宣称达到 30 FPS。
- 公开入口可达，入口主 JS/CSS 引用与发布构建一致；云浏览器 WebGL context 创建失败，只检查了入口/无障碍界面，未完成公开站点 live 3D 试玩。全量网络回读 hash 未获证明；发布包内一致性不能代替它。
- 摄影 PNG 仅会话内保存，应主动下载；本地进度保存不包含 PNG，存储被拒绝/清理可能丢失进度。
- 平台是原创展示设计，不是校园实测建筑；纸飞机是游戏化运动及点代理碰撞，不是完整机翼物理。

## API 与美术来源
本轮新增设施中，确认由 Astra API 生成并接入的是折纸站；平台最终表面为本地实现，不是 Astra 新平台。后续平台请求在计数阶段没有确认收据，结果/计费未知，已停止，未取得新生成产物，不推定零费用。历史其他开发调用与模型作者记录仍保留在归档，不据此扩大本轮 Astra 成果。网站运行不需要 API key。

## 本地运行
Node.js 24，使用锁文件安装；默认开发服务仅监听本机。

```bash
npm ci
npm --prefix games/hks ci --ignore-scripts
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

浏览器验证需安装匹配的 Playwright Chromium：`npx playwright install --with-deps chromium`，然后 `npm run test:e2e`。执行结果只对实际运行的提交负责。离线包构建见 [离线说明](scripts/offline/README.md)；HTTP 测试不能冒充 file:// 验证。

## 文档与下一步
- [当前状态](.agent/CURRENT_STATE.md)、[验收边界](.agent/RESULT.md)、[设计现状](.agent/DESIGN.md)、[当前计划](.agent/PLAN.md)。
- [历史归档及恢复方法](docs/archive/README.md)：初始三份计划和阶段日志都是历史，不是当前待办。
- [数据来源](public/data/README.md)、[资源来源与许可](docs/resources/ASSET_SOURCES.md) 保留；示意占地、预测/估算楼高不是测绘或现实导航。

本轮只澄清现状、清理文档和过期过程材料；不开发新功能，不改站点。下一轮先和用户讨论具体品质差距及验收基准，再决定有界改进范围。
