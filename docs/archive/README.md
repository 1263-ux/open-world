# 文档历史索引与恢复

2026-11-01：用户反馈公开 v7 仍不够好，当前入口改为单一现状叙述。这里保存旧文档，不作为当前状态、授权或待办。历史内部链接按原仓库路径理解，部分外部工作目录证据不在仓库；不可把不存在的本地路径当公开验收凭据。

## 本次归档
来源远端 `1263-ux/open-world` 的完整 head：`e6243564c3dde8a130956c567dfd8e0b7a72db86`。八份原文按原路径保存在 `2026-11-01-pre-cleanup/`，字节不改（包括旧矛盾，留作历史）。

| 原路径 | Git blob SHA1 | SHA256 |
|---|---|---|
| `.agent/CURRENT_STATE.md` | `36d7b806bb1bd5d6505a35073fb7711ca692c6ca` | `b742b8031bd00a7129ce4cf4d33b1f0c4555ef2860d750b87af183fa9161fb1f` |
| `.agent/DESIGN.md` | `6e6a43216d3189689554207d102cb839df3f1551` | `408db32cfb84c8b7794f83f4f970c14cc6e27032b27342b9dd09a6fe6d6c4345` |
| `.agent/PLAN.md` | `8ade74150aefe92422b18e9fe50d3bf8c9ea654e` | `5e201e91e10fdca5fb378be50f4172ddc612e344e51ddc475fdf3c5846392ae2` |
| `.agent/RESULT.md` | `68f3be593357ba28fe2d219aedf6b35d8c4b61a9` | `343bd9d1ea78cde7cf614e92f6996f435fb887e73397ab1d46b0eace3c95ba94` |
| `.agent/decisions.md` | `930642752d692b206ab3c802b2fdb8ceedb579a8` | `b751db559bb9e5b1d8b37af9476baa7807d77e43b29a7643103715870b0adbaf` |
| `.agent/progress.md` | `2eac52d5104ca8cd0ae6c06693829e5e133c93b6` | `7a165516a34c20ea90a07a6d59b3e58c7b3834c6a2fab805e92340dcc39ab74b` |
| `AGENTS.md` | `a6e3fb5ac48d574a822bb30a54d94a410faa0299` | `28df94e521155c0edab2f6b416323768f6a76b5ad8739334fbc720818fb254f7` |
| `README.md` | `85999db4448292e854d81862b365a400392854da` | `72a8e483ddd8768ce9bb933328f02ad2443c8eadf0c5632cfcf4f6d2c6debfe9` |

## 原有历史资料
- [三份初始计划](../../.agent/plans/)中的 `01-tools-and-stack.md`、`02-resources-and-references.md`、`03-roadmap-and-acceptance.md`：历史 Draft 基线，原文不改，不是当前 todo。
- 同目录 `round-*.md`、[阶段报告](../../.agent/reports/)、[阶段调研](../../.agent/research/)：只对应各自日期/提交，不覆盖新状态。
- [资源来源](../resources/ASSET_SOURCES.md)、数据来源和许可证不是过期过程材料，继续保留。
- 远端 PNG 为运行游戏资源，不是待清理的过程截图；本轮不删除。仓库外过程截图归档由另一个指定负责人处理。

## 恢复方法与回滚边界
在完整仓库中用 `git show e6243564c3dde8a130956c567dfd8e0b7a72db86:<原路径>` 导出原文；或将本目录归档文件复制回原路径并核对上表 SHA256。恢复只是显式操作方式，不建议把过时状态重新作为当前说明。`git restore --source=e6243564c3dde8a130956c567dfd8e0b7a72db86 -- <原路径>` 可恢复指定文档，不需整体回滚生产。

应用功能锚点 `38d9b0a372a2a3234ec111a44a8391414c73e56b`；更早健康 v6 源 `3febd05b43341c2b32f678508b6e44e9024b0c4a` 保留。Site v6 保存版本为 `appgprj_6ae444838eb881919c96ab5187b62890~appgver_face0b3bdd9c8191b36d20a0e64900a2`，发布源 `43e58dca1c1082987accf3e873260e674a11d839`。Site 回退需使用同 Site 支持的保存版本重部署流程，Git 文档恢复不等于站点回退；本轮不执行任何回退或重新部署。
