## Round-01 实施计划

**目标**：交付可启动的 Vue/Three 原型。虎峪、迎西均常显“校园印象示意，非精确建模/导航”；原创程序化校门、楼体、道路，不复制地图图片或 Hks。斜俯视为可逆默认，配置隔离相机方案；本轮不做角色、后端、GLB量产或部署，不追加调研。

**顺序与所有权**
1. 集成人独占根配置、锁文件、入口、`src/shared/contracts.ts`、`src/campus-data/campuses.json`。从 npm registry 解析与当前 Node LTS 兼容的最新 Vue、Vite、Three、TS、Vitest、Playwright、ESLint及配套包，精确锁版本并提交 lockfile，不凭记忆填版本。
2. 先冻结契约：`CampusId`、`Landmark{id,name,position,shape,facts,source,status}`、`CampusData`、`SceneState{selectedId,targetId}`；`createCampusScene(container,data,onEvent)` 返回 `setCampus/setState/resetView/dispose`，事件仅 `select(id)`、`error(reason)`。局部坐标不冒充经纬度。
3. 契约完成后并行：
   - 场景负责人独占 `src/scene/{CampusScene,geometry,picking}.ts`：原创差异化门楼/建筑轮廓、OrbitControls、拾取与拖拽阈值、缩放适配、销毁监听/RAF/显存。
   - UI负责人独占 `src/app/App.vue`、`src/components/{CampusSwitcher,LandmarkCard,QuestPanel,SceneHost}.vue`、`src/games/{quest,storage}.ts`：Vue唯一管理状态；卡片列来源与待核说明，场景不接触任务或存储。
   - QA独占 `tests/{unit,e2e}/`；集成人统一接线，禁止同文件并写。

**体验切片**：虎峪北门→图书馆→梅花教室依序打卡；迎西展示南门、办公楼、清泽园、机械馆骨架。任务支持开始、完成、重玩清空、退出；切校区取消当前任务并提示，刷新按版本恢复。提供键盘地标列表、视角按钮、焦点恢复、状态播报、可见焦点及移动端布局；WebGL失败仍可用列表完成任务。

**验收**：真实执行 `npm ci`、`npm run typecheck/lint/test/build`（分别运行）及 `npm run test:e2e`。单测覆盖任务转换、顺序/重复打卡、重置、损坏存储；浏览器覆盖双校区反复切换、真实画布拾取、拖拽不误选、卡片关闭、完整任务/退出/刷新、键盘与移动端、WebGL降级。保存视觉基准、测试结果与代码身份，未运行不报通过。

**执行与回退**：直接 Responses API 生成工件，由父级沙箱执行；不再嵌套CLI初始化、不绕权限、不接触凭据。失败缩减视觉效果而保留闭环；更新进度、许可及未知费用，不宣称精确复原或性能达标。