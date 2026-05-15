# 求解器契约

求解器的目标是输出可回放、可评分、可展示的结构化步骤，而不是直接输出 UI 文案。

## 输入

求解入口接受普通题面字符串，也接受标准化题目状态：

```ts
type StateInput = PuzzleInput | PuzzleState;
```

其中 `PuzzleState` 可以包含：

1. `board`：当前盘面。
2. `candidateMasks`：可信候选 mask，用于表达已经求解到中途的候选态。
3. `givens`：题面给定数位置。
4. `constraints`：外部候选数约束。
5. `assumptions`：调用方记录的假设分支。
6. `metadata`：外部系统自己的元数据。

如果调用方要复现外部流程中的某个中间辅助过程，优先传 `candidateMasks`，或使用 `constraints.exactCandidatesMode: 'trusted'`。这样 solver 会在调用方提供的候选态上寻找技巧，而不是强制回到“按当前盘面重新计算合法候选”的初始题面语义。

候选数语义见：

- [STATE.md](./STATE.md)

## 输出步骤

`SolveStep` 是稳定结构：

```ts
interface SolveStep {
  technique: TechniqueId;
  actions: StepAction[];
  evidence: StepEvidence;
  score: number;
}
```

`actions` 是真正改变状态的动作：

1. `place`：在某格填入某数字。
2. `eliminate`：从某格删除某候选数。

`evidence` 是解释步骤为什么成立的证据。第一版保证它是结构化对象，并允许后续扩展字段；调用方不应该依赖 `evidence.note` 生成最终文案。

常见证据字段：

1. `houses`：相关行、列或宫。
2. `cells`：相关格子，使用 `target`、`reason`、`pivot`、`link` 等角色。
3. `links`：链式技巧的强链或弱链。
4. `branches`：forcing / 试探类技巧的分支假设、矛盾状态、矛盾定位、穷尽状态和分支动作摘要。

`branches.actions` 是摘要，不是完整证明树。公开库优先保证最终 `actions` 可回放、分支假设可解释；完整教学动画可以在调用方基于这些结构继续扩展。

## 回放

`replaySteps(input, steps)` 会按步骤动作回放棋盘。

第一版要求：

1. 每个 `place` 必须能落到空格。
2. 每个 `eliminate` 只影响候选数，不直接填盘。
3. walkthrough 返回的步骤应该能回放到求解器得到的终态。

## 文案

展示文案由 `formatStep(step, options)` 负责。

当前支持：

1. `zh-CN`
2. `en-US`
3. `short`
4. `teaching`

核心步骤里不固定中文描述，这样后续调整教学文本不会破坏 API。

## 技巧范围

`nextStep(input, options)` 和 `walkthrough(input, options)` 支持 `allowedTechniques`。

如果限制技巧范围，求解器只会尝试这些技巧，但仍保留默认的由易到难顺序。这个默认顺序很重要：同一候选态上多个技巧可能同时成立，默认会优先返回更基础的技巧。

如果调用方希望某一个或多个技巧优先命中，可以使用 `preferredTechniques`。求解器会先按 `preferredTechniques` 数组顺序尝试这些技巧，再回到默认顺序尝试其余允许技巧。生成器的 `allowedTechniques` 和 `preferredTechniques` 也是通过这个机制影响评分和筛选的。

当前 stable 技巧列表见：

- [TECHNIQUES.md](./TECHNIQUES.md)

## 卡住原因

`walkthrough` 返回的 `SolveAnalysis` 包含：

1. `solved`
2. `steps`
3. `score`
4. `hardestTechnique`
5. `candidates`
6. `stuckReason`

`stuckReason` 当前可能是：

1. `contradiction`
2. `no-technique-match`
3. `step-limit`

## 当前边界

当前 solver 只把已经有结构化证据和测试的技巧暴露为 stable。更复杂的技巧会逐步迁移，但在证据结构、中文展示和测试稳定前，不应该直接作为公开稳定 API。
