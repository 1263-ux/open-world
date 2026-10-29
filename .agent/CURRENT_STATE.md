# Current State

## Goal / Product core
浏览器探索太理虎峪、迎西校园：可辨认地标、可检查信息、至少一条完整可重玩任务。当前先做可验证的小切片，再扩双校区。

## Primary user / Ownership
面向轻量探索校园的访客。主控负责计划、集成、账单与交付；资料 Agent 对事实来源负责，3D/UI 各有具体文件边界；用户做重大成果与方向验证。

## Non-goals for MVP
暂缓后端、账号、实时多人、精细室内与自研框架；不永久排除未来阶段。不得声称精确导航、许可已齐、模型已接通或测试已通过而无对应证据。

## Phase
文档筹备/交接。起始本地仓库为空 main；**本子任务只写文档**，无应用实现、提交或推送。主控可在接手后按最新持续开发与 main 直推授权推进。

## Decisions
Vue/TS/Vite + Three.js，Blender/GLB，JSON/localStorage。地图操作是待用户选择角色模式前的可逆默认。批量建模前先建立视觉基准。权威更新见 `decisions.md`；完整参考见 `plans/`。

## Implemented / Evidence
三份 Library 全文副本、根 AGENTS、安全忽略规则、最新决策/进展；本轮官方 addon/env/license 有界调研。原文保真与验证状态见 `progress.md`。

## Blockers / Unknowns
主控已核验模型列表有 gpt-6.1-terra/sol，无 gpt-6.1-luna；存在 gpt-6-luna 但未经同意不替换，简单任务暂由 Terra 承担。专用 CLI 登录成功；推理 smoke 在模型请求前被 sandbox/socket mode 检查阻塞，保留沙箱诊断中。推理权限与真实 API 余额未验证。具体校园事实/可分发资产/Hks 许可与视觉基准待补。公开部署未授权。$90 是总上限不是已知剩余，11-26 到期确切时刻未知。

## Next
先核对工作树和进展；每轮计划前读全部计划并做相关调研。主控接手骨架→单校门/2–3 建筑/完整任务→视觉验证→双校区→QA。11-23 冻结、11-24–25 QA 仅为条件性排期。
