# 太理 · 校园漫游 / Campus Atlas

更新：2026-11-02。虎峪、迎西的**局部精修体验版**：基础校园与明确原创的理想空间可切换。它仍是低模校园原型，不是全校豪华重建或逐栋精确复原，也不能宣称用户已满意。

原公开站点已更新为 **v8**；发布包 63 个构建文件逐项匹配已验构建。

[打开校园漫游](https://tyut-campus-world-private-preview.aglowswan513.chatgpt.site)

## 体验内容
- 第三人称双校区探索、地标资料、地图与任务。桌面 WASD、拖动视角、Shift 跑、Space 跳；横屏触控摇杆与屏幕按钮。
- 基础/理想开关保留进度。仅稳定共有地面可切，设施内部、高台或活动中会提示拒绝，不静默传送。
- 虎峪梅花东北侧原创阅读庭院：从东入口步行到阅读台打开校园介绍；迎西原创平台/折叠站以东的照片手记驿站：从南北入口走近展示台，查看已拍照片。
- 迎西手记主线仍为三张照片→真实上下低台→地面折叠站放飞→穿三门并落地→保存/重开。Hks 古建守护仍是独立可选支线。
- 无 WebGL 时提供无障碍地标/任务界面，不等于完整 3D 玩法。

## 验证与限制
功能代码锚点 `3c5a1e3d6629f05e25898741b89f6102ec9a34cc`，[CI 41395763908](https://github.com/1263-ux/open-world/actions/runs/41395763908) 的 6 个必需 jobs 通过，178 单测通过；3 个可选诊断 jobs 未运行。模式、真实触控到桌开关、摄影负面判定、完整三照/下载/重拍/存档及原双校区/Hks/file:// 门禁保留。详见 [验收结果](.agent/RESULT.md)；发布身份见 [当前状态](.agent/CURRENT_STATE.md)。后续 docs-only head 不是新的功能验收。

双冠、局部窗框、花床及木石家具改善已在真实桌面画面中看到，但大面积楼群仍均质，树冠仍有云团感和粗直树干，设施是局部公共凉廊而非豪华全校园。新触控功能/卡片布局以真实输入和 bbox 断言验证，**没有专属触控画面的人工像素验收**。实体手机/普通设备性能未测，软件渲染 CI 低 FPS 不代表真机结果。历史手记完成面板仍有背景跑跳控件叠压/低对比余项。

摄影 PNG 只保存在当前会话，刷新后不可恢复，需主动下载；进度存储被拒绝或清除时可能丢失。纸飞机采用游戏化运动/点代理碰撞，不是完整机翼物理。

## 来源与 API
本轮精修、阅读/相册设施与树冠全部本地实现，未调用 Astra/API。既有折纸站是已确认接入的 Astra 资产；历史后续平台计数尝试结果/计费未知且已停，不推定零费用。网站运行不需要 API key。底图是布局参考与设计近似，参见 [数据来源](public/data/README.md)、[资源许可](docs/resources/ASSET_SOURCES.md)。

## 本地运行
Node.js 24，使用锁文件；默认开发服务仅监听本机。

```bash
npm ci
npm --prefix games/hks ci --ignore-scripts
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

浏览器验证先安装匹配版本：`npx playwright install --with-deps chromium`，再 `npm run test:e2e`。离线构建见 [说明](scripts/offline/README.md)。固定画质对比的 `?render-quality=reference` 只锁 DPR/PCF，不改变玩法，不能拿它代替自然性能测试。

[当前计划](.agent/PLAN.md) · [设计边界](.agent/DESIGN.md) · [历史归档/恢复](docs/archive/README.md)。接下来先依据用户实际体验反馈诊断品质，不以测试数量替代美感判断。
