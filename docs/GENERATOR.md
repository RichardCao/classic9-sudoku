# 生成器契约

当前 generator 已经包含请求分析层、最小 `generateOne` 管线、`search` 和候选池选择器。

这样做的目的：

1. 避免用户给出明显冲突的条件后让生成器空跑。
2. 提前识别分数范围和技巧范围之间的矛盾。
3. 为 `generateOne` 和 `search` 提供统一 diagnostics。

## analyzeGenerationRequest

`analyzeGenerationRequest(request)` 会返回：

1. `valid`
2. `unlikely`
3. `invalid`

其中：

1. `invalid` 表示请求本身有硬冲突，不应该进入搜索。
2. `unlikely` 表示请求不一定不可能，但生成成本可能很高。
3. `valid` 表示未发现明显冲突。

## 当前检查内容

当前会检查：

1. 分数下限是否高于上限。
2. 线索数下限是否高于上限。
3. 技巧是否存在于当前评分规则。
4. 技巧是否同时被允许和禁止。
5. required 技巧是否不在 allowed 范围内。
6. required 技巧是否被 forbidden 禁止。
7. required 技巧单步分值是否高于分数上限。
8. 允许技巧过窄但分数下限过高。
9. 分数范围过窄导致命中率低。
10. 达到分数下限所需步骤数是否过高。
11. 高线索数与高分数是否同时出现。
12. 严格条件下预算是否明显偏小。
13. `seed`、`minimality`、`symmetry`、`uniqueness`、`budget` 和 `relaxation` 的基础类型与枚举是否合法。
14. 当前唯一解模式下，线索数上限是否低于 17。

返回结果还包含 `feasibility`，用于给调用方做自动调参：

1. `allowedTechniqueCount`
2. `maxSingleStepScore`
3. `averagePositiveStepScore`
4. `scoreRangeWidth`
5. `clueRangeWidth`
6. `estimatedMinStepsForScoreMin`
7. `estimatedTypicalStepsForScoreMin`
8. `budgetMaxAttempts`
9. `budgetMaxElapsedMs`

## 命令行

可以直接传 JSON 字符串：

```bash
node dist/src/cli/index.js generator-analyze '{"constraints":{"score":{"min":3000},"allowedTechniques":["full-house","naked-single","hidden-single"]}}'
```

也可以传 JSON 文件路径：

```bash
node dist/src/cli/index.js generator-analyze request.json
```

## generateOne

`generateOne(request)` 当前会执行：

1. 分析生成请求。
2. 如果请求无效，直接返回 `invalid-request`。
3. 用 seed 生成完整终盘。
4. 按目标线索数挖洞。
5. 用唯一解检查保证题目唯一。
6. 按 `minimality` 决定是否做严格最小化。
7. 用当前评分规则评分。
8. 按分数和线索数约束筛选。
9. 返回 diagnostics。

红线：

1. `success` 才能作为正式题目结果入库。
2. `bestCandidate` 只用于调参、诊断和回看失败样本，不应直接当成合格题目。
3. 失败状态即使带有 `bestCandidate`，也不代表满足了请求约束。

当前生成器始终保证唯一解。`constraints.uniqueness` 只接受 `required`，第一版不支持跳过唯一性检查。

当前完整终盘生成器是 lightweight / reproducible 取向：它从一个固定合法终盘出发，做数字置换、行列带内/栈内置换、带/栈置换和转置等价变换。它适合 smoke、稳定测试和可复现候选池任务，但不声称覆盖所有终盘等价类。需要更大终盘多样性时，应在后续版本增加真正随机终盘生成或外部终盘池。

`score.target` 和 `score.tolerance` 表示硬约束：如果二者同时给出，生成器只接受分数落在 `[target - tolerance, target + tolerance]` 范围内的题目。`target` 也会用于失败时选择最接近的 `bestCandidate`。

`clues.target` 是硬约束：如果给出，生成器只接受线索数等于 `target` 的题目。严格最小化可能让线索数低于挖洞目标；这类候选会被拒绝，并只可能作为 `bestCandidate` 返回。

`GenerationResult.puzzle` 只会在 `status === "success"` 时出现，并且这时题目满足请求约束。失败状态如果保留了最接近目标的候选，会放在 `bestCandidate` 字段；它只用于诊断或人工调参，不应直接入库。

缺省值：

1. `seed` 范围是 `1..4294967295`；未提供时会把 `Date.now()` 规范化到该范围。
2. `minimality` 未提供时使用 `none`。
3. `symmetry` 未提供时使用 `none`。
4. `constraints.clues.target` 未提供时，优先使用 `constraints.clues.max`，其次使用 `constraints.clues.min`，都没有时使用 `28`。
5. `budget.maxAttempts` 未提供时，普通请求使用 `200`；分析结果为 `unlikely` 的请求使用 `500`。
6. `budget.maxElapsedMs` 未提供时，普通请求使用 `2000`；分析结果为 `unlikely` 的请求使用 `4000`。

`maxResults` 和 `scoreBucketSize` 是 `search` 专用字段。为了方便把同一个请求对象在 `generateOne` 和 `search` 之间复用，`generateOne` 会接受并忽略这两个字段，但仍会校验它们必须是正整数。

当前最小实现还不覆盖核心库内部多进程 worker 协调。并行搜索应通过 CLI `parallel-search-plan` 生成 shard 命令，再由外部 shell、任务队列或 CI runner 并行执行。

## 命令行生成

```bash
node dist/src/cli/index.js generate '{"seed":1,"constraints":{"clues":{"target":30}},"budget":{"maxAttempts":1,"maxElapsedMs":2000},"minimality":"none"}'
```

## minimality

`minimality` 控制是否对题目做严格最小化。

可选值：

1. `none`
   不做最小化。适合优先满足线索数范围的在线生成。

2. `strict`
   做严格最小化。适合离线题库构建，但可能把线索数降到请求范围以下。

默认行为：

```text
minimality = none
```

原因是：公开 generator 应优先尊重用户传入的线索范围，不应该默认用最小化破坏约束。

## relaxation

`relaxation` 只有在显式开启时才生效。

当前第一版支持：

1. 扩大分数范围。
2. 扩大线索数范围。
3. 增加尝试次数预算。

示例：

```json
{
  "relaxation": {
    "enabled": true,
    "maxRounds": 2,
    "scoreExpansionPerRound": 100,
    "clueExpansionPerRound": 1,
    "attemptMultiplierPerRound": 2
  }
}
```

返回结果会包含：

```text
relaxationsApplied
```

用于说明每一轮放宽了什么条件。

`scoreExpansionPerRound` 只会放宽 `constraints.score.min` 和 `constraints.score.max`，不会放宽 `constraints.score.target` / `constraints.score.tolerance`。

`clueExpansionPerRound` 只会放宽 `constraints.clues.min` 和 `constraints.clues.max`，不会放宽 `constraints.clues.target`。如果请求只有 `clues.target`，当前实现不会把它自动转成区间，也不会记录虚假的 `clue-range-expanded`。

## 后续计划

后续 generator 应继续补更细的 relaxation 策略，例如 preferred 技巧放宽。核心原则是：生成器不能只返回失败，还必须解释为什么失败。

技巧 id 和技巧族见：

- [TECHNIQUES.md](./TECHNIQUES.md)

## search

`search(request)` 会多次调用 `generateOne`，并返回事件。

当前事件包括：

1. `accepted`
2. `rejected`
3. `done`

当前实现是同步 iterable，后续可以扩展为 async iterable。

`budget.maxAttempts` 在 `search` 中表示外层最多启动多少次 `generateOne`。每一次外层尝试会把内部 `generateOne` 的 `maxAttempts` 固定为 1。`budget.maxElapsedMs` 是单次 `generateOne` 的时间预算，不是整批 `search` 的全局墙钟时间预算。当前版本没有 `globalMaxElapsedMs` / `searchBudget`；如果调用方需要整批搜索硬 deadline，应在外层调度器中控制。

`done` 事件会包含 `summary`：

1. accepted 总数。
2. rejected 总数。
3. 拒绝原因计数。
4. 分数分桶。
5. 技巧命中统计。
6. 最高分和最低分。

命令行示例：

```bash
node dist/src/cli/index.js search '{"seed":1,"maxResults":1,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}'
```

只输出汇总：

```bash
node dist/src/cli/index.js search '{"seed":1,"maxResults":1,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}' --summary-only
```

只输出指定事件：

```bash
node dist/src/cli/index.js search '{"seed":1,"maxResults":1,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}' --events accepted,done
```

把 accepted 候选直接写入文件：

```bash
node dist/src/cli/index.js search '{"seed":1,"maxResults":5,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":10,"maxElapsedMs":5000}}' --summary-only --write-candidates ./dist/tmp/candidates.json
```

追加写入已有候选池：

```bash
node dist/src/cli/index.js search '{"seed":1000,"maxResults":5,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":10,"maxElapsedMs":5000}}' --summary-only --write-candidates ./dist/tmp/candidates.json --append-candidates
```

追加写入时目标文件必须是 JSON array。这个选项只负责追加，不自动做 canonical 去重；去重应交给后续 `selectFromCandidates` 的 `dedupeCanonical`。如果需要跨同构题去重，应在生成时开启 `canonicalize: true`；否则 `selectFromCandidates` 只能按题面字符串 fallback 去重。

把搜索汇总单独写入文件：

```bash
node dist/src/cli/index.js search '{"seed":1,"maxResults":5,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":10,"maxElapsedMs":5000}}' --summary-only --write-summary ./dist/tmp/search-summary.json
```

记录搜索 manifest：

```bash
node dist/src/cli/index.js search '{"seed":1,"maxResults":5,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":10,"maxElapsedMs":5000}}' --summary-only --write-manifest ./dist/tmp/search-manifest.json
```

从 manifest 续跑：

```bash
node dist/src/cli/index.js search '{"seed":1,"maxResults":5,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":10,"maxElapsedMs":5000}}' --summary-only --resume-manifest ./dist/tmp/search-manifest.json --write-candidates ./dist/tmp/candidates.json --append-candidates
```

manifest 会记录：

1. 请求指纹。
2. 每次 run 的 seed 区间。
3. accepted 和 rejected 数量。
4. `summary`。
5. 下一次续跑应使用的 `nextSeed`。

续跑时会忽略请求里的 `seed`，改用 manifest 的 `nextSeed`。如果分数范围、技巧约束、canonicalize、minimality 或预算等身份字段变化，CLI 会拒绝续跑，避免把不同任务混到同一个 manifest。

`scoreBucketSize` 只影响 summary 的分桶展示，不影响生成序列或候选接受条件，因此不属于 manifest 续跑身份字段。

汇总一个或多个 manifest：

```bash
node dist/src/cli/index.js manifest-summary ./dist/tmp/search-manifest.json
```

也可以汇总多个 shard 的 manifest：

```bash
node dist/src/cli/index.js manifest-summary ./dist/tmp/shards/*-manifest.json --write-summary ./dist/tmp/manifest-summary.json
```

汇总结果包括：

1. manifest 数量和 request hash 分布。
2. run 总数。
3. accepted、rejected 和 attempts。
4. seed 区间。
5. seed 区间重叠和空洞。
6. 拒绝原因、分数分桶和技巧命中汇总。
7. 最高分和最低分。

对应 schema：

```bash
node dist/src/cli/index.js schema searchManifestSummary
```

## 并行 shard

公开库核心不直接管理多进程。CLI 提供 `parallel-search-plan` 生成互不重叠的 shard 命令，调用方可以用 shell、任务队列或 CI runner 并行执行。

示例：

```bash
node dist/src/cli/index.js parallel-search-plan request.json --out-dir ./dist/tmp/shards --workers 5 --attempts-per-worker 100
```

`parallel-search-plan` 会先复用 `search()` 的请求校验；非法 `seed`、`maxResults`、`scoreBucketSize`、生成约束或过滤后无可用技巧都会在计划阶段直接失败，而不是生成一组后续必然失败的 worker 命令。

输出中的每个 worker 都会写自己的：

1. candidates 文件。
2. summary 文件。
3. manifest 文件。

这样可以避免多个进程同时追加同一个 JSON 文件。

合并 shard：

```bash
node dist/src/cli/index.js merge-candidates ./dist/tmp/shards/*-candidates.json --out ./dist/tmp/candidates-merged.json --dedupe-canonical
```

`--dedupe-canonical` 只在候选题带有 `canonicalKey` 时生效。推荐并行生成请求里设置：

```json
{
  "canonicalize": true
}
```

相关 schema：

```bash
node dist/src/cli/index.js schema searchRequest
node dist/src/cli/index.js schema searchEvent
node dist/src/cli/index.js schema searchSummary
node dist/src/cli/index.js schema generatedPuzzle
```

## selectFromCandidates

`selectFromCandidates(candidates, plan)` 用于从候选池中筛题。

当前支持：

1. 最大选择数量。
2. canonical 去重。
3. 分数分桶。
4. preferred 技巧优先排序。

canonical 去重只会对已经通过分桶和桶容量检查、即将被选中的候选生效。桶外候选不会提前占用 canonical key。

候选池文件格式见：

- [CANDIDATE_POOL.md](./CANDIDATE_POOL.md)
