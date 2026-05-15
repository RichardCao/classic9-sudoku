# API 说明

本文件只描述已经落地并通过测试的公开接口。

## 题目解析

`parsePuzzle(input)` 用于把题目输入转成 81 长度数组。

支持输入：

1. 81 位字符串。
2. 字符串中 `0` 表示空格。
3. 字符串中 `.` 表示空格。
4. 81 长度数字数组。

`serializeBoard(board)` 用于把棋盘数组转回字符串。

## 状态标准化

`normalizeState(input)` 是求解、评分、校验之前的统一入口。

它会输出：

1. 标准棋盘。
2. 候选数数组。
3. 给定数标记。
4. 矛盾列表。
5. 警告列表。

## 校验和唯一解

`validate(input)` 用于检查题目格式、冲突和候选约束矛盾。

`checkUniqueness(input)` 用于判断题目是无解、唯一解还是多解。

## 等价变换

`canonicalizeBoard(board)` 返回 `canonical.classic9.v1` 的最小序题面。

`canonicalizePair(puzzle, solution)` 会对题面和答案同步 canonical。

`applyTransformToBoard(board, transform)` 把同一个 canonical transform 应用到棋盘。

`invertTransform(transform)` 返回反向变换，可把 canonical 后的棋盘还原到原始坐标和数字。

`applyTransformToState(state, transform)` 同步变换题面、给定数、候选约束和假设分支。

`applyTransformToStep(step, transform)` 同步变换步骤动作和证据中的格子、数字、区域引用。

## 求解

`nextStep(input, options)` 返回下一步结构化解法。

`walkthrough(input, options)` 返回完整解题过程。

`replaySteps(input, steps)` 用结构化步骤回放棋盘状态。

`getTechniqueDefinitions()` 返回当前技巧定义列表，其中包含 `stable` 和 `experimental` 两类。CLI 中也可以用 `techniques` 命令查看。

默认情况下，`nextStep()` 和 `walkthrough()` 只会运行 `stable` 技巧。

如果调用方需要显式启用某个 experimental 技巧，应传入 `allowedTechniques`。例如：

```ts
const step = nextStep(puzzle, {
  allowedTechniques: ['bowmans-bingo'],
});
```

`allowedTechniques` 只限制可用技巧范围，不改变默认由易到难的尝试顺序。

如果多个技巧在同一候选态上都能命中，而调用方希望某些技巧优先返回，可以使用 `preferredTechniques`：

```ts
const step = nextStep(puzzle, {
  allowedTechniques: ['naked-single', 'hidden-single'],
  preferredTechniques: ['hidden-single'],
});
```

对于 forcing / 试探类技巧，`SolveStep.evidence.branches` 会返回结构化分支证据，包括：

1. `assumption`：分支入口假设。
2. `contradiction`：该分支是否导向矛盾。
3. `contradictionAt`：可定位时的矛盾点。
4. `exhausted`：当前预算下是否已经穷尽。
5. `actions`：分支内部推导动作摘要。

## 评分

`rate(input, policy)` 按指定评分规则重新计算分数。

评分结果必须带：

1. `ratingPolicyId`
2. `ratingPolicyVersion`

分数不是题目的客观属性，而是某套评分规则下的结果。

## 展示

`formatStep(step, options)` 把结构化步骤转成文本。

当前支持：

1. `zh-CN`
2. `en-US`
3. `short`
4. `teaching`

## JSON Schema

`getJsonSchemas()` 返回当前公开数据结构的 JSON schema。

CLI 也可以输出 schema：

```bash
node dist/src/cli/index.js schema
node dist/src/cli/index.js schema puzzleState
```

生成器相关的稳定 schema 包括：

1. `generationRequest`
2. `generationResult`
3. `generatedPuzzle`
4. `searchRequest`
5. `searchEvent`
6. `searchSummary`
7. `candidateSelectionPlan`
8. `candidateSelectionResult`

技巧相关 schema 包括：

1. `techniqueDefinition`
2. `techniqueList`
