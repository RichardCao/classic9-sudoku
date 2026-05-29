# 更新日志

本文档记录公开库层面的重要变化。

## 0.3.0

第三版公开发布。

已新增或收口的内容：

1. 新增 `classic-galaxy.v1` 作为本包自己的全技巧评分/求解 profile，覆盖所有已实现技巧。
2. `classic-galaxy.v1` 将 `forcing-nets`、`digit-forcing-chains`、`cell-forcing-chains`、`unit-forcing-chains`、`table-chain` 和 `bowmans-bingo` 放入 fallback 管线，避免重型分支技巧参与每步常规扫描。
3. CLI 新增 `--profile galaxy`，内置 profile 统一为 `stable`、`extended` 和 `galaxy`。
4. SE 相关内容收口为外部参考映射文档和开发 fixture，不再作为公开内置评分策略或 CLI profile 暴露。
5. 开发审计脚本改为中性命名：`audit:reference` 用于 reference smoke，`audit:technique-priority` 用于技巧优先级审计。
6. reference smoke fixture 改到 `tests/fixtures/reference-techniques`，并通过显式 `allowedTechniques` / `preferredTechniques` 验证可达性。
7. `verify` 流程纳入 `audit:reference`，CI 中对应步骤改为 Reference Technique Smoke Audit。
8. 公开文档同步说明 `classic-stable.v1`、`classic-extended.v1` 和 `classic-galaxy.v1` 的边界。

行为和契约变化：

1. `getRatingPolicy()` 不再提供公开 `classic-se` 策略；调用方应使用 `classic-galaxy` 或自定义 `RatingPolicy`。
2. CLI 不再接受 `--profile se`；需要全技巧入口时应使用 `--profile galaxy`。
3. `aliases`、`seDifficulty` 和 `seStatus` 保留为外部技巧体系参考元数据，不构成独立 SE 主 API 承诺。

当前版本仍不承诺：

1. 和 Sudoku Explainer / Sukaku Explainer Java 实现逐步同构。
2. 将所有 experimental 技巧升为 stable。
3. 重型 forcing / 试探技巧适合批量实时评分。

## 0.2.0

第二版公开发布。

已新增或收口的内容：

1. 公开版本号统一为 `0.2.0`，并同步了 npm 元信息、包内版本常量和发布检查断言。
2. 新增结构化求解验证入口 `verifyStep()` 和 `verifyWalkthrough()`，用于校验步骤动作与回放结果。
3. 求解器默认尝试顺序调整为显式的人类解题顺序，整体从基础技巧走向复杂技巧；`defaultScore` 仍作为评分权重，保留 `preferredTechniques` 作为局部优先顺序。
4. `x-coloring` 进入 stable。
5. `big-wings` 保持 `experimental`，并收紧为双链接场景。
6. `table-chain` 保持 `experimental`，作为安全的通用分支 reduction 暴露。
7. `empty-rectangle`、`aic-als`、`franken-swordfish`、`sk-loops` 等技巧的高风险分叉态回归已补齐。
8. 发布元信息补全了 `repository`、`bugs` 和 `homepage`。
9. 发布检查脚本、示例 typecheck、dist smoke、pack smoke 和 verify 流程已纳入公开文档。
10. README 增加参考与致谢，注明高级技巧吸收和审计过程中参考了开源项目 Sudoku Explainer。

行为和契约变化：

1. `GeneratedPuzzle` 新增必需字段 `solved`，并在未解出时附带 `stuckReason`。
2. `generateOne()` / `search()` 只把当前评分策略可解出的题作为 `success` 结果；不可解候选会以 `unsolved-by-rating-policy` 拒绝，并只可能出现在 `bestCandidate`。
3. `clues.target` 从挖洞目标收紧为硬约束，生成器只接受线索数等于 target 的题目。
4. `generationRequest` JSON schema 顶层不再接受未知字段，拼写错误会被 schema 校验拦截。
5. `serializeBoard()`、`canonicalizeBoard()` 和 `applyTransformToBoard()` 会对 Board 值域做运行时校验，非法数字、NaN 和非整数会抛错。

当前版本仍不承诺：

1. 任意尺寸数独。
2. 变体数独。
3. 将所有 experimental 技巧升为 stable。
4. 生成器在严格约束下的实时命中率。

## 0.1.0

第一版公开发布。

已具备：

1. 标准 9x9 数独解析、序列化、校验和唯一解检查。
2. `PuzzleState` 和候选约束标准化。
3. stable 人类逻辑求解器和步骤回放。
4. `classic-stable.v1` 评分规则。
5. `canonical.classic9.v1` 等价变换和最小序表示。
6. 单题生成、批量搜索、续跑 manifest、并行 shard 计划。
7. 候选池统计、去重、筛选和合并。
8. JSON schema、CLI、文档和示例。
9. 公开 `getPackageInfo()`，CLI `version` 和包版本测试保持一致。
10. 示例目录纳入 `examples:typecheck` 和 `verify`。
11. 发布后的 dist CLI 纳入 `smoke:cli` 和 `verify`。

仍未稳定承诺：

1. 任意尺寸数独。
2. 变体数独。
3. 全部高级技巧。
4. 生成器在严格约束下的实时命中率。
