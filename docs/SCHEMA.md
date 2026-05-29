# JSON Schema

当前公开库导出一组 JSON schema，用于描述已经稳定下来的数据结构。

这些 schema 是公开契约雏形，当前覆盖：

1. `board`
2. `candidateConstraints`
3. `puzzleState`
4. `solveStep`
5. `techniqueDefinition`
6. `techniqueList`
7. `canonicalTransform`
8. `canonicalResult`
9. `canonicalPairResult`
10. `ratingPolicy`
11. `ratingResult`
12. `generationRequest`
13. `generationResult`
14. `generatedPuzzle`
15. `searchRequest`
16. `searchSummary`
17. `searchEvent`
18. `candidateSelectionPlan`
19. `candidateSelectionResult`
20. `candidatePoolStats`
21. `candidateDedupeResult`
22. `searchManifestSummary`

## 结构约定

schema 文件内部已经提取复用的计数字典结构，用于：

1. 技巧计数。
2. 分数分桶。
3. 拒绝原因计数。
4. 候选池统计。
5. manifest 汇总。

后续如果继续扩展 schema，优先复用公共结构，避免同一类字段在不同输出里产生不一致约束。

## 命令行

列出所有 schema：

```bash
node dist/src/cli/index.js schema
```

输出指定 schema：

```bash
node dist/src/cli/index.js schema puzzleState
```

## 注意事项

1. `solveStep.evidence` 允许扩展字段，便于后续补充链、鱼、ALS 等更复杂证据。
2. 当前 `solveStep.evidence` 已明确包含 `houses`、`cells`、`links` 和 `branches`。其中 `branches` 主要用于 forcing / 试探类技巧。
3. `branches.assumption`、`branches.contradiction`、`branches.exhausted` 是稳定字段；`branches.contradictionAt` 用于记录候选耗尽、区域重复、区域缺位等矛盾定位。
4. `branches.actions` 是分支内部动作摘要，不承诺完整证明树。
5. canonical 结果现在已经单独建模，并带 algorithm 和 version。
6. generator schema 当前覆盖 `generateOne`、`search`、候选题、候选池选择计划和选择结果。
7. `ratingPolicy` schema 既可以通过 `getJsonSchemas().ratingPolicy` 独立获取，也内嵌在 `generationRequest.properties.ratingPolicy` 中。
8. `ratingPolicy` schema 覆盖公开评分策略的静态结构，包括字段类型、未知字段、技巧 ID 枚举和基础数组约束；技巧枚举由运行时代码根据当前技巧定义生成，不是手写固定列表。
9. `ratingPolicy` 的动态规则必须继续调用 `validateRatingPolicy()` 校验，例如 `techniqueScores` 是否覆盖所有已启用技巧，以及 `gradeRules[].minScore <= maxScore`。例如某个 policy 的 schema 预校验可以通过，但如果缺少已启用技巧分值，`validateRatingPolicy(policy)` 仍会返回错误。
10. `techniqueDefinition` schema 包含 `aliases`、`seDifficulty` 和 `seStatus`，作为外部技巧体系的参考元数据；它们不是独立 SE profile 的主 API 承诺，具体映射口径见 [SE_COMPATIBILITY.md](./SE_COMPATIBILITY.md)。
11. `candidateSelectionPlan` schema 会约束技巧 ID 和基础字段类型；`scoreBuckets` 的 `min <= max`、桶不重叠等跨项规则仍由 `selectFromCandidates()` 运行时校验。
12. `canonicalTransform` schema 会约束 row/col/digit 映射的基础置换形状；公开变换 API 仍会通过 `validateCanonicalTransform()` 做运行时校验。
13. `generatedPuzzle.solution`、`generationResult.*.solution` 和 `canonicalPairResult.solution` 在 schema 中要求为完整 1-9 棋盘；行列宫无冲突、与 puzzle 给定数一致、canonicalKey 与 puzzle 匹配等跨字段规则仍由 `validateCandidatePool()` 或对应运行时 API 校验。
14. 如果 schema 结构发生破坏性变化，后续必须升级 schema 版本。
