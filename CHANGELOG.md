# 更新日志

本文档记录公开库层面的重要变化。

## 0.4.0

第四版公开发布。

已新增或收口的内容：

1. 全部 90 个技巧定义都具备 reference rating corpus 覆盖；`audit:coverage` 当前显示 stable 60/60、experimental 30/30 均无真实题面覆盖缺口。
2. 新增 `reference-rating-corpus.json` 真实题面评分路径 corpus，和 `reference-smoke.json` 的人工候选态 smoke fixture 明确分层；正式 corpus 行必须是普通题面、唯一解、完整评分路径可回放。
3. `audit:reference` 现在同时跑 reference smoke 和 real-board rating corpus audit；rating corpus 每一步都会经过 `verifyStep(..., { mode: "evidence" })`，并校验 place / eliminate 动作不违背已知答案。
4. 新增 `audit:coverage`、`find:reference-candidates`、`synthesize:reference-candidates` 等 reference corpus 工具，用于目标技巧优先搜索、候选题面去重、命中后 clue minimization 和覆盖缺口审计。
5. 新增 `verify:coverage`，发布前可单独跑 coverage、forcing evidence、forcing smoke 和 BUG graph evidence 审计；`verify:release` 现在会在基础 `verify` 之后追加这些覆盖审计。
6. 公开 API 补齐二维数组 / nullable board 适配器、`hint()`、`summarizeAnalysis()` 和 `summarizeRating()`，便于前端和题库服务直接消费提示文本、评分摘要和扁平 board 转换。
7. `checkUniqueness()` 输出更完整的搜索诊断，包括预算中止、节点访问、耗时和解数下界，方便服务端区分确定结果和预算内未知。
8. 多个高级技巧的 evidence 增加 `pattern`、`links`、`nodes` 和 subtype 边界测试，覆盖 fish、wing、ALS、chain、UR/BUG、Exocet、Tridagons、SK Loops、forcing 等家族。
9. `classic-galaxy.v1` 的真实题面回归已经覆盖所有已定义技巧；部分重型 forcing / 试探类技巧仍保持 fallback 或显式启用定位。

行为和契约变化：

1. `verify:release` 比 0.3.0 更严格，会额外执行 reference coverage / evidence 类审计；它适合作为发布前门禁，但运行时间明显长于普通 typecheck。
2. `audit:reference` 不再只是轻量 smoke；它也会跑 real-board rating corpus，因此在本地和 CI 中应按慢速审计对待。
3. `reference-smoke.json` 中的 trusted / artificial candidate state 仍只用于技巧 finder 边界测试，不得直接计入真实题面 rating corpus。
4. 添加或搜索 rating corpus 行时，若目标是覆盖某个技巧，应使用 `targetFirstTechniques` 或候选搜索脚本的 `--target-first`，并把目标技巧放在最前面。

当前版本仍不承诺：

1. 和 Sudoku Explainer / Sukaku Explainer Java 实现逐步同构。
2. 将所有 experimental 技巧升为 stable。
3. 所有高级技巧的 subtype 都已完整覆盖外部实现的全部变体。
4. 重型 forcing / 试探技巧适合在线实时批量评分。

## 0.3.0

第三版公开发布。

已新增或收口的内容：

1. 新增 `classic-galaxy.v1` 作为本包自己的全技巧评分/求解 profile，覆盖所有已实现技巧。
2. `classic-galaxy.v1` 将 `forcing-nets`、`digit-forcing-chains`、`cell-forcing-chains`、`unit-forcing-chains`、`region-forcing-chains`、`table-chain`、`dynamic-forcing-chains`、`dynamic-forcing-chains-plus` 和 `bowmans-bingo` 放入 fallback 管线，避免重型分支技巧参与每步常规扫描。
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
