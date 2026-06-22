# Learning Sample Run Issues

本文记录用小游戏 500 题生成 classic9 学习样例时遇到的运行问题，便于后续修改 classic9 包本身。

## 2026-05-30 forcing-nets branch replay crash

### 现象

运行学习样例脚本时，baseline 已经跑到 `epic-013` 附近，进程崩溃：

```text
[2026-05-30T02:21:07.817Z] baseline 413/500 epic-013 solved=true score=3200 hardest=nishio-forcing-chains steps=58 elapsed=1184ms
file:///Users/create/SudokuGame/gen-and-score/public-repo/classic9-sudoku/dist/src/solver/context.js:175
        throw new Error(`eliminate 动作的数字不是候选：cell=${action.cell}, digit=${action.digit}`);
              ^

Error: eliminate 动作的数字不是候选：cell=8, digit=8
    at assertApplicableStepAction (.../dist/src/solver/context.js:175:15)
    at SolverContext.applyStep (.../dist/src/solver/context.js:92:13)
    at runBranchWalkthrough (.../dist/src/solver/techniques.js:6555:16)
    at evaluateBranchWithPlacement (.../dist/src/solver/techniques.js:6508:12)
    at ForcingNetsTechnique.find (.../dist/src/solver/techniques.js:2692:37)
    at scanFindStepsTechniques (.../dist/src/solver/index.js:65:32)
    at findSteps (.../dist/src/solver/index.js:43:5)
    at findSimpleAlternatives (.../scripts/build-learning-samples.mjs:267:17)
```

### 触发路径

崩溃不是发生在主 baseline 求解路径本身，而是发生在学习样例脚本的候选排序辅助逻辑：

1. 脚本收集候选样例。
2. 脚本为了满足“到这个示例时尽量没有特别简单的其他技巧可以用”，在候选步骤前的状态调用 `findSteps()`。
3. 当时脚本把所有 defaultScore 更低的技巧都作为“更简单替代技巧”扫描。
4. 这个集合错误地包含了 `forcing-nets` 等 experimental / forcing 技巧。
5. `findSteps()` 调用 `ForcingNetsTechnique.find()`。
6. `ForcingNetsTechnique.find()` 内部调用 `evaluateBranchWithPlacement()`。
7. `evaluateBranchWithPlacement()` 调用 `runBranchWalkthrough()`。
8. `runBranchWalkthrough()` 在分支上下文中反复调用 `findBranchStep()` 并执行 `branch.applyStep(step)`。
9. 某个分支步骤包含一个已经不再存在的候选删除动作：`cell=8, digit=8`。
10. `SolverContext.applyStep()` 做严格动作校验，抛出 `eliminate 动作的数字不是候选`。

源码位置：

```text
src/solver/techniques.ts
- ForcingNetsTechnique.find()
- evaluateBranchWithPlacement()
- runBranchWalkthrough()
- findBranchStep()

src/solver/context.ts
- SolverContext.applyStep()
- assertApplicableStepAction()
```

### 直接原因

`runBranchWalkthrough()` 在 forcing 分支内部执行 branch step 时，假设 `findBranchStep()` 返回的步骤一定仍可应用。但实际发生了一个 race-like 状态问题：

1. `findBranchStep()` 找到某个可用步骤。
2. `runBranchWalkthrough()` 先遍历 `step.actions`，记录 `placements` / `eliminations`。
3. 随后调用 `branch.applyStep(step)`。
4. `applyStep()` 会按动作顺序在 draft context 上逐个校验并应用。
5. 如果同一个 step 中较早的动作已经改变候选状态，较晚的 `eliminate` 动作可能变成 noop，即“要删的数字已经不是候选”。
6. `applyStep()` 对这种 noop elimination 默认视为错误，于是抛异常。

这说明 branch 内部某个 technique 返回的 `SolveStep` 在当前分支上下文中不满足 `applyStep()` 的严格可回放要求。可能原因包括：

1. 该 technique 在生成多动作 step 时没有去掉 noop eliminations。
2. 该 technique 的多个 actions 之间存在顺序依赖，前面的 placement 删除了后面 elimination 的候选。
3. branch walkthrough 使用的 technique 集合中包含了不适合在假设分支里直接复用的复杂技巧。
4. `runBranchWalkthrough()` 没有对 branch 内部 step 做防御性校验或降级处理。

### 脚本侧影响

学习样例脚本中，这个调用只是排序 hint：

```text
simpleAlternativeTechniques
```

它的目标是判断候选步骤前是否还有更简单技巧可用，用来惩罚“不够干净”的教学样例。

因此这个探测失败不应该中断整个 learning sample 生成任务，也不应该影响已完成的 checkpoint。

脚本侧已经做了规避：

1. `simpleAlternativeTechniques` 只扫描 `classic-galaxy` primary 中的 stable 技巧。
2. 排除 `forcing` 和 `pattern` family，因为它们不是“特别简单的其他技巧”。
3. 每个替代技巧单独 `try/catch`。
4. 前缀 `verifyWalkthrough()` 失败时返回空替代列表。
5. 替代技巧探测失败只影响样例排序，不影响主流程和 checkpoint。

### classic9 包侧建议

这个问题不应该只靠调用方规避。classic9 包内部建议做以下改进。

#### 1. branch walkthrough 不应被单个 branch step 异常打断

`runBranchWalkthrough()` 当前直接调用：

```ts
branch.applyStep(step);
```

建议改成防御性执行：

```ts
try {
  branch.applyStep(step);
} catch (error) {
  return {
    assumption,
    contradiction: true,
    exhausted: true,
    contradictionAt: inspectContradiction(branch),
    placements,
    eliminations,
    // 可选：记录 internalError / invalidStepReason 供 diagnostics 使用
  };
}
```

如果不希望把 invalid branch step 当作 contradiction，也可以返回 `exhausted: true` 并附带内部错误原因。核心原则是：forcing 技巧内部搜索不应把底层异常泄漏到外层 `find()` / `findSteps()`，除非这是调用方输入非法。

#### 2. branch step 应先验证再应用

`findBranchStep()` 当前只检查 `technique.find(context)` 是否返回 step，没有验证 step 在当前 context 中是否适用。

建议在 branch 内部复用主求解器的适用性判断，或显式调用 `verifyStep(..., { mode: 'action' })` / 一个轻量版本：

```ts
const step = technique.find(context);
if (!step) continue;
if (!isApplicableStep(context, step)) continue;
return step;
```

如果 `isApplicableStep()` 目前是私有函数，可以考虑抽出一个内部 helper，供 branch walkthrough 和主 pipeline 共用。

#### 3. 生成 SolveStep 时过滤 noop eliminations

所有 technique finder 都应该保证：

1. `place` 动作落在空格上。
2. `place` 数字当前是合法候选。
3. `eliminate` 动作对应候选当前存在。
4. 同一个 step 内多个 actions 顺序应用后仍可回放。

尤其是多动作 step，如果包含 placement 和 elimination，应该注意 placement 会更新 peers 的候选，可能让后面的 elimination 变成 noop。

可选策略：

1. 构造 step 前按当前 context 过滤 `context.isCandidatePresent(cell, digit)`。
2. 构造 step 后用 draft context replay 一遍，去掉 noop elimination 或拒绝该 step。
3. 测试里加入“所有 finder 返回的 step 都可 `applyStep()`”的通用断言。

#### 4. forcing branch technique 集合需要更保守

`BRANCH_TECHNIQUE_IDS` 当前包含了一些复杂技巧，例如：

```text
pattern-overlay
aic
aic-exotic
three-d-medusa
fireworks
twinned-xy-chains
grouped-aic
```

这些技巧在普通主路径中可用，不代表适合在 forcing 分支内部反复调用。

建议评估：

1. branch walkthrough 是否应该只使用基础稳定技巧，例如 singles、locked candidates、subset。
2. 是否把高级 chain / pattern 技巧从 branch cache 中移除。
3. 是否为 branch 模式增加专用 technique subset，避免分支内部使用会产生复杂多动作 step 的技巧。

#### 5. 增加 regression fixture

这次崩溃发生在小游戏 500 题的 baseline 过程中，checkpoint 显示已保存到：

```text
galaxy-baseline:all:epic-012
```

日志中下一条为：

```text
baseline 413/500 epic-013 solved=true score=3200 hardest=nishio-forcing-chains steps=58
```

建议后续从 learning sample checkpoint 或复跑日志中提取导致 `forcing-nets` branch crash 的具体候选状态，做成最小回归：

1. 输入：触发 `findSteps()` 的 `board` + `candidateMasks`。
2. 调用：`findSteps(state, { allowedTechniques: ['forcing-nets'], preferredTechniques: ['forcing-nets'], fallbackTechniques: [], limit: 1 })`。
3. 期望：不抛异常。
4. 如果没有可用 forcing-nets step，返回空也可以；关键是不应 crash。

### 结论

脚本侧原本把 `forcing-nets` 当成“更简单替代技巧”扫描，这是调用方策略错误，已经修正。

但 classic9 包侧仍建议加强 forcing branch 的异常隔离和 step replay 校验。否则任何调用方显式启用 `forcing-nets` 或把它放入 `findSteps()` 都可能遇到同类崩溃。

### 包侧处理进展

已在 classic9 包侧做防御性修复：

1. `findBranchStep()` 不再直接返回任意 `technique.find()` 产出的 step，而是先在 clone context 上尝试 `applyStep()`，不可回放的 branch step 会被跳过。
2. `runBranchWalkthrough()` 执行 `branch.applyStep(step)` 时增加异常隔离；如果内部 step 在分支上下文中仍然不可应用，会把该分支降级为 `exhausted: true`，不再把异常泄漏给外层 `find()` / `findSteps()`。
3. 增加回归测试：显式调用 `findSteps(state, { allowedTechniques: ['forcing-nets'], preferredTechniques: ['forcing-nets'], fallbackTechniques: [], limit: 1 })` 不应向外抛出 branch replay 异常。

这次修复不把 invalid branch step 解释为逻辑 contradiction，只作为该分支当前预算/技巧集合下无法继续可靠展开处理。后续如果能从 checkpoint 中提取原始触发候选态，仍建议补一个更贴近 `epic-013` 的最小 fixture。
