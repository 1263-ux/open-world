# 双校区首版风格与小地图 · 已部署，艺术仍部分完成

2026-10-31 UTC。应用源码 `6c5fb3fd4034537a402e4fff13990dae2a235745` / tree `3b86bd42eb25eb1597eaa7301437656939c2c806`；plan_ref：PLAN.md。

## 改动与证据
- 迎西/虎峪统一暖灰米、青绿窗、细叶、建筑细部与人尺度前场，保留原数据、地标/存档 ID、碰撞、摄影和 Hks。虎峪新增前场/花池为设计，不是测绘事实。
- 左上小地图复用当前校区数据和位置，点击进入既有全景并可返回人物原位。精确应用身份 CI [41183734400](https://github.com/1263-ux/open-world/actions/runs/41183734400) 所有适用 jobs 成功；测试含两校区真实键盘多点连续行走、桌面/模拟横屏触控、重复切换、地图/小地图往返、摄影、存档、Hks 返回、资源回退和离线。三处虎峪及三处迎西截图与实际输入记录随 CI 工件保存。
- 北门牌匾黑齿由同机位 SwiftShader A/B 找到接收阴影贡献；只对北门牌匾及七根肋关闭 receiveShadow，保留 cast/几何。最终截图复核黑齿消失；focused unit 测试验证范围。
- 已发布公开站 v5：`https://tyut-campus-world-private-preview.aglowswan513.chatgpt.site`，站点源码 `582ee5d726ccbcd85f11dc17034212e1117b5375`，部署 `appgdep_6ae5a80d2c3c8191b470d7d0905ede91`。匿名 HTTP 200，live index/JS/CSS hashes 与构建相同，Hks HTML 和两校区关键模型 HTTP 200。回滚为 v4 部署 `appgdep_6ae563c3f27081919c0aceca4d7e202d`、站点源码 `fa0465b6b2508100a80fb3f7765fbc318a99cbc9`；样例站未修改。

## 准确边界
- 首版修订可交重大体验验证，但不是全校园艺术精修完成：虎峪仍稀疏、背景楼重复，尚未达到批准样例的局部庭院细腻度。
- 验收浏览器为 CI 无头 Chromium/SwiftShader，触屏为模拟；非实体手机。迎西机械馆五秒暖机采样约 2.84 FPS、113 draw calls、172211 triangles、ratio .5，不能外推物理设备；30 FPS 目标未验证。线上静态健康检查不等于线上真实 3D 旅程。
- 本轮不声称 Hks 自然打到 Boss 或 420 秒胜利；先前自然局有失败。官方公开信息与来源不等于实测或无条件图片再分发许可。预算及实际 API 账单未知。
