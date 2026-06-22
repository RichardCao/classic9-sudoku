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

`evidence` 是解释步骤为什么成立的证据。当前保证它是结构化对象，并允许后续扩展字段；调用方不应该依赖 `evidence.note` 生成最终文案。

常见证据字段：

1. `houses`：相关行、列或宫。
2. `cells`：相关格子，使用 `target`、`reason`、`pivot`、`link` 等角色。
3. `links`：链式技巧的强链或弱链。
4. `branches`：forcing / 试探类技巧的分支假设、矛盾状态、矛盾定位、穷尽状态和分支动作摘要。

`branches.actions` 是摘要，不是完整证明树。公开库优先保证最终 `actions` 可回放、分支假设可解释；完整教学动画可以在调用方基于这些结构继续扩展。

## 回放

`replaySteps(input, steps)` 会按步骤动作回放棋盘。

当前要求：

1. 只接受 `place` 和 `eliminate` 两类动作。
2. `place` 会按动作写盘，`eliminate` 只影响候选数。
3. walkthrough 返回的步骤应该能回放到求解器得到的终态。
4. `replaySteps()` 不验证动作为什么成立，也不检查候选、冲突或 evidence；需要这些检查时使用 `verifyStep()` / `verifyWalkthrough()`。

## 文案

展示文案由 `formatStep(step, options)` 负责。

当前支持：

1. `zh-CN`
2. `en-US`
3. `short`
4. `teaching`

核心步骤里不固定中文描述，这样后续调整教学文本不会破坏 API。

## 当前可用步骤

`findSteps(input, options)` 用于返回当前状态下可找到的步骤列表。

当前语义：

1. 默认仍只运行 stable 技巧。
2. `allowedTechniques` 只限制技巧集合，不改变默认由易到难的顺序。
3. `preferredTechniques` 会把指定技巧按数组顺序提前。
4. 如果希望直接复用内置 profile，可以先通过 `getRatingPolicy()` 取到 `classic-stable`、`classic-extended` 或 `classic-galaxy`，再用 `buildSolveOptionsFromRatingPolicy()` 转成 `walkthrough()` / `nextStep()` 可用的求解选项。
5. `nishio-forcing-chains` 已经进入 stable，会按正常由易到难顺序参与默认求解。其余 forcing / 试探类技巧仍为 experimental，需要调用方显式启用。
6. 内置默认 fallback 列表只包含 `bowmans-bingo`、`forcing-nets`、`digit-forcing-chains`、`cell-forcing-chains`、`unit-forcing-chains`、`region-forcing-chains`、`dynamic-forcing-chains`、`dynamic-forcing-chains-plus`。这些技巧即使出现在 `allowedTechniques` 中，也只会在当前状态 primary 技巧全部无命中时才尝试；`table-chain` 和 `nested-forcing-chains` 不在默认 fallback 列表中，需要显式放进 `preferredTechniques` 或 `fallbackTechniques`。
7. 若调用方要显式提前某个 forcing 技巧，需要把它放进 `preferredTechniques`。
8. 每个技巧最多返回一条步骤。
9. `sort: 'pipeline'` 按实际技巧管线顺序返回，是默认值。
10. `sort: 'score-desc'` 按步骤分数从高到低返回。
11. `sort: 'action-count-desc'` 按动作数量从多到少返回。
12. `sort: 'canonical'` 按技巧名和动作稳定排序，适合测试。
13. `limit` 若传入，必须是正整数；`0` 和负数会作为参数错误处理。
14. 初始状态存在矛盾时不会继续扫描技巧，`findSteps()` 返回空步骤；启用 diagnostics 时会带上 `stuckReason: 'contradiction'`。
15. `allowContradictoryCandidateState` 只用于技巧审计和局部候选态测试。默认公开入口会阻断所有初始矛盾；不要在正式题面求解或提示链路中开启该选项。

这个接口适合分析和教学场景。常规自动求解仍建议使用 `nextStep()` 或 `walkthrough()`。

### 默认技巧与 fallback 真值表

| 调用方式 | primary 管线 | fallback 管线 |
| --- | --- | --- |
| `nextStep(puzzle)` / `walkthrough(puzzle)` | stable 技巧 | 空 |
| 显式传 `allowedTechniques`，且未传 `fallbackTechniques` | 允许技巧中不属于默认 fallback 列表的技巧 | 允许技巧中属于默认 fallback 列表的技巧 |
| `buildSolveOptionsFromRatingPolicy(getRatingPolicy('classic-stable'))` | stable 技巧 | 空 |
| `buildSolveOptionsFromRatingPolicy(getRatingPolicy('classic-extended'))` | stable 技巧 | `bowmans-bingo` |
| `buildSolveOptionsFromRatingPolicy(getRatingPolicy('classic-galaxy'))` | 全部非重型技巧 | `forcing-nets`、`digit-forcing-chains`、`cell-forcing-chains`、`unit-forcing-chains`、`region-forcing-chains`、`table-chain`、`dynamic-forcing-chains`、`dynamic-forcing-chains-plus`、`bowmans-bingo` |

默认 fallback 列表用于显式 `allowedTechniques` 场景，不等于 `classic-extended` 会启用全部 forcing 技巧。`classic-extended.v1` 的增强来自 fallback 中的 `bowmans-bingo`，主顺序仍是 stable 顺序。

`classic-galaxy.v1` 是本包自己的全技巧入口。它不进入默认求解入口，适合调用方显式要求更强覆盖或离线分析时使用。

如果需要定位某个技巧第一次命中的真实候选态，可以使用：

```ts
findTechniqueScenario(input, ['grouped-aic'])
findTechniqueScenario(input, ['bowmans-bingo'], buildSolveOptionsFromRatingPolicy(getRatingPolicy('classic-extended')))
```

返回结果会包含：

1. `stepNumber`
2. `step`
3. `boardBefore / boardAfter`
4. `candidateMasksBefore / candidateMasksAfter`

这个接口主要面向：

1. 技巧吸收和回归验证
2. 真实题面回归样本抽取
3. 教学或提示素材定位

## 技巧范围

`nextStep(input, options)` 和 `walkthrough(input, options)` 支持 `allowedTechniques`。

如果限制技巧范围，求解器只会尝试这些技巧，但仍保留默认的由易到难顺序。这个默认顺序很重要：同一候选态上多个技巧可能同时成立，默认会优先返回更基础的技巧。

当前公开库里的“由易到难”具体落法是：默认管线使用一条显式的人类解题顺序，先尝试基础技巧，再尝试复杂技巧；`defaultScore` 只用于评分和难度权重，不直接决定默认扫描顺序。这样做的目标不是保证绝对最优路径，而是让 solver 在存在多条可行路径时，尽量先走更基础、通常也更便宜的步骤。

如果调用方希望某一个或多个技巧优先命中，可以使用 `preferredTechniques`。求解器会先按 `preferredTechniques` 数组顺序尝试这些技巧，再回到默认顺序尝试其余允许技巧。生成器的 `allowedTechniques` 和 `preferredTechniques` 也是通过这个机制影响评分和筛选的。

同一候选态上可能同时存在多个有效步骤。不同优先顺序会改变后续候选态，甚至让某条自动求解路径更早卡住或进入矛盾；这类现象本身不等于某个技巧实现错误。实现错误需要用更强的证据确认，例如给定同一 `board + candidateMasks` 时删除了唯一解中的真值候选，或与已确认合法的回归候选态不一致。

对外库的判断原则是“正确性优先”，不是“和某个参考实现完全一致”优先。如果某个技巧在参考实现中存在更宽的删除口径，而回归验证显示它会在真解一致状态下删除唯一解中的真值候选，公开库会优先收紧该技巧，而不是为了保持一致把风险保留下来。

当前 stable 技巧列表见：

- [TECHNIQUES.md](./TECHNIQUES.md)

## 步骤验证

`replaySteps(input, steps)` 只负责应用动作，不检查动作为什么成立；但步骤动作结构必须合法，只接受 `place` 和 `eliminate`。

如果需要检查候选、冲突和 evidence，使用：

```ts
verifyStep(input, step)
verifyWalkthrough(input, steps)
```

`verifyStep()` 默认检查：

1. 技巧 id 是否已知。
2. 动作是否非空。
3. `place` 是否填在空格上。
4. `place` 的数字是否是当前候选数。
5. `place` 是否造成同行、同列或同宫冲突。
6. `eliminate` 是否作用在空格上。
7. `eliminate` 的候选数是否当前存在。
8. 应用动作后是否造成空候选格。
9. 应用动作后是否造成某区域内数字重复。
10. 应用动作后是否造成某区域内某数字无位置。
11. evidence 中的 house、cell、link、branch 引用是否合法。

`verifyStep()` 支持 `action` 和 `evidence` 两种模式。默认 `evidence` 模式会验证动作和 evidence；`action` 模式只验证动作能否应用。当前版本不会重新运行对应技巧 finder。原因是同一状态下可能存在多个等价步骤，内部遍历顺序也可能优化变化。

`verifyStep()` 不是 technique proof checker。它验证动作结构、候选合法性和 evidence 引用合法性，但不证明某个技巧的语义推理一定成立。如果要审计 stable 技巧是否误删真解候选，应使用真实题面、唯一解或已知 solution 对照重新跑 walkthrough。仓库提供 `npm run audit:stable -- --input <puzzles.js|ts|json|ndjson>` 作为发布前外部题集 gate；该脚本不会打进 npm 包。

`verifyWalkthrough()` 会按顺序验证并应用步骤，返回第一处非法步骤、最终棋盘、最终候选数和是否解出。

## 求解统计

`analyzeSolve(input, { includeUsage: true })` 会返回和 `walkthrough()` 相同的求解结果，并额外附带 `usage`。

`usage` 当前统计：

1. `totalElapsedMs`：本次分析总耗时。
2. `totalCalls`：技巧 finder 总调用次数。
3. `totalHits`：技巧命中次数。
4. `totalPlacements`：填数动作总数。
5. `totalEliminations`：删候选动作总数。
6. `byTechnique`：按技巧统计 calls、hits、placements、eliminations、actions、totalScore、maxScore 和 elapsedMs。

计时用于观察趋势和批处理分析，不保证跨机器绝对可比。

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
