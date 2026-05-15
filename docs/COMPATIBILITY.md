# 兼容性策略

第一版兼容策略以“稳定核心、实验生成器”为原则。

## 稳定核心

这些能力应保持兼容：

1. 标准 9x9 棋盘表示。
2. 81 位字符串解析和序列化。
3. `PuzzleState`、`CandidateConstraints` 的基础语义。
4. `SolveStep.actions` 的 `place` 和 `eliminate`。
5. `canonical.classic9.v1` 的 key 版本。
6. 评分结果中的 `ratingPolicyId` 和 `ratingPolicyVersion`。

## 可扩展字段

这些字段允许后续增加内容：

1. `SolveStep.evidence`
2. `GenerationDiagnostics`
3. `GenerationRequestAnalysis`
4. `GeneratedPuzzle` 的额外元数据
5. schema 中明确 `additionalProperties: true` 的对象

调用方应忽略未知字段。

## 实验能力

这些能力第一版仍可能调整：

1. `generateOne`
2. `search`
3. `selectFromCandidates`
4. relaxation 策略。
5. 候选池持久化和续跑格式。
6. 多进程生成协调。

原因是生成器需要根据真实题库任务继续调参。

## canonical 版本

canonical key 必须带算法和版本：

```text
canonical.classic9.v1:<key>
```

如果未来改变最小序算法，即使新算法仍然能生成 81 位 key，也必须升级版本，不能覆盖旧 key。

## 评分版本

同一道题在不同评分规则下可以有不同分数。

题库记录建议保存：

1. `puzzle`
2. `solution`
3. `canonicalKey`
4. `score`
5. `ratingPolicyId`
6. `ratingPolicyVersion`
7. `techniqueCounts`

## TypeScript 和运行时

当前包使用 TypeScript ESM。

测试命令：

```bash
npm test
```

当前沙箱环境中 `tsx` 创建 IPC pipe 会失败，因此测试先用 `tsc` 编译，再用 `node` 运行 `dist/tests/run-tests.js`。
