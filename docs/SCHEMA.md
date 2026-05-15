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
10. `ratingResult`
11. `generationRequest`
12. `generationResult`
13. `generatedPuzzle`
14. `searchRequest`
15. `searchSummary`
16. `searchEvent`
17. `candidateSelectionPlan`
18. `candidateSelectionResult`
19. `candidatePoolStats`
20. `candidateDedupeResult`
21. `searchManifestSummary`

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
7. rating policy 本身后续还会继续补 schema。
8. 如果 schema 结构发生破坏性变化，后续必须升级 schema 版本。
