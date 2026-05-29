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

`validate().invalidValueIndexes` 会包含数字数组中的非法值位置，也会包含 81 位字符串中非法字符的位置。字符串非法字符仍会在内部按空格参与后续统计，并在 `contradictions` 中保留原始错误说明。

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

`findSteps(input, options)` 返回当前状态下可找到的结构化解法列表。当前每个技巧最多返回一条步骤，适合分析同一候选态上还有哪些技巧可用。`limit` 若传入，必须是正整数；初始状态存在矛盾时返回空步骤，并可通过 diagnostics 标记 `stuckReason: 'contradiction'`。

`walkthrough(input, options)` 返回完整解题过程。

`analyzeSolve(input, options)` 返回和 `walkthrough()` 等价的求解结果，并可通过 `includeUsage: true` 额外输出每个技巧的调用、命中、动作和耗时统计。

`findTechniqueScenario(input, targetTechniques, options)` 用于定位一个或多个目标技巧第一次命中的中间状态，并返回命中前后的棋盘和候选数快照。它适合做技巧吸收、真实题面回归和提示素材抽取。

`replaySteps(input, steps)` 用结构化步骤回放棋盘状态。

`replaySteps()` 不验证技巧推理是否成立，但动作结构必须合法，只接受 `place` 和 `eliminate`。

`verifyStep(input, step, options)` 检查一个结构化步骤能否在给定状态上合法应用，并检查 evidence 中的区域、格子、链和分支引用是否合法。

`verifyStep()` 不会重新运行技巧 finder，也不是 technique proof checker。它验证动作结构、候选合法性和 evidence 引用合法性；如果要验证技巧语义是否误删真解候选，应使用真实题面加已知 solution 做独立审计。

`verifyWalkthrough(input, steps, options)` 逐步验证并应用一组步骤，返回第一处非法步骤、最终棋盘和最终候选数。

`getTechniqueDefinitions()` 返回当前技巧定义列表，其中包含 `stable` 和 `experimental` 两类。技巧定义还会带上 SE 兼容元数据：`aliases`、`seDifficulty` 和 `seStatus`。CLI 中也可以用 `techniques` 命令查看。

默认情况下，`nextStep()` 和 `walkthrough()` 只会运行 `stable` 技巧。

如果调用方希望使用内置策略构造求解选项，可以调用：

```ts
import { buildSolveOptionsFromRatingPolicy, getRatingPolicy, walkthrough } from '@sudoku-tools/classic9';

const policy = getRatingPolicy('classic-extended');
const result = walkthrough(puzzle, buildSolveOptionsFromRatingPolicy(policy));
```

当前内置策略包括：

1. `classic-stable.v1`：默认策略，只使用 stable 技巧。
2. `classic-extended.v1`：显式增强策略，先完整运行 stable 技巧；只有当前状态 primary 技巧全部无命中时，才把 `bowmans-bingo` 作为 fallback safety net 尝试，用于提升部分高难题的可解率。
3. `classic-galaxy.v1`：本包自己的全技巧策略，启用所有已实现技巧，并把重型 forcing / 试探类技巧放入 fallback 管线。

如果调用方需要显式启用某个 experimental 技巧，应传入 `allowedTechniques`。例如：

```ts
const step = nextStep(puzzle, {
  allowedTechniques: ['bowmans-bingo'],
});
```

`allowedTechniques` 只限制可用技巧范围，不改变默认由易到难的尝试顺序。

`nishio-forcing-chains` 已经进入 stable，因此默认可以参与 `classic-stable.v1`。其余 forcing / 试探类技巧仍为 experimental，必须通过 `allowedTechniques`、内置 profile 或显式 fallback 设置启用。

为避免旧式调用方把 forcing / 试探类技巧误当成常规技巧每步扫描，公开库内置的默认 fallback 列表只包含 `bowmans-bingo`、`forcing-nets`、`digit-forcing-chains`、`cell-forcing-chains`、`unit-forcing-chains`。也就是说：这些技巧即使出现在 `allowedTechniques` 中，也只会在当前状态没有任何 primary 技巧命中时才尝试。`table-chain` 不在默认 fallback 列表中；调用方如果需要它，应显式放入 `preferredTechniques` 或 `fallbackTechniques`。若调用方确实希望某个 forcing 技巧优先命中，可以把它放入 `preferredTechniques`。但对默认 `classic-extended.v1` 来说，fallback 目前仍只包含 `bowmans-bingo`，不是完整 experimental profile。

`table-chain` 可能非常慢，不建议默认用于批量评分或生成。它更适合离线审计、人工研究或针对少量题面的复核场景。

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

`verifyStep()` 支持 `action` 和 `evidence` 两种模式。默认 `evidence` 模式会验证动作合法性和 evidence 引用合法性；`action` 模式只验证动作能否合法应用。当前版本不会重新运行对应技巧 finder，因此不会把内部遍历顺序误当成公开契约。

## 评分

`rate(input, policy)` 按指定评分规则重新计算分数。

自定义 `policy` 会被严格校验；未知技巧、缺失已启用技巧分值、非法分档范围等会抛错。可以先用 `validateRatingPolicy(policy)` 做配置检查。

评分结果必须带：

1. `ratingPolicyId`
2. `ratingPolicyVersion`

分数不是题目的客观属性，而是某套评分规则下的结果。

## 批量 CLI

`batch-solve` 和 `batch-rate` 用于批量分析题集。

输入支持：

1. 一行一个题面。
2. `id<TAB>puzzle`。
3. JSON 数组，元素可以是字符串，也可以是包含 `puzzle` 或 `grid` 的对象。

示例：

```bash
sudoku batch-solve --input puzzles.txt --output solve.jsonl --format jsonl --summary solve-summary.json --usage solve-usage.json
sudoku batch-rate --input puzzles.txt --output rating.csv --format csv --only 12,18,33
sudoku batch-solve --input puzzles.txt --start-line 100 --end-line 200 --allow full-house,naked-single,hidden-single --prefer hidden-single --max-steps 64
sudoku batch-rate --input puzzles.txt --profile extended
sudoku batch-rate --input puzzles.txt --profile galaxy
```

常用参数：

1. `--format json|jsonl|csv|text`
2. `--summary <file>`
3. `--usage <file>`
4. `--only <id,id,...>`
5. `--start-line <n>`
6. `--end-line <n>`
7. `--allow <technique,technique,...>`
8. `--prefer <technique,technique,...>`
9. `--max-steps <n>`
10. `--include-steps`
11. `--include-usage`
12. `--profile stable|extended|galaxy`

`--profile` 用于选择内置求解/评分策略。未指定时使用 `stable`。未指定 `--allow` 时使用当前 profile 的技巧范围；指定 `--allow` 时按完整技巧定义全集过滤，因此可以显式启用 profile 外的 experimental 技巧。`--prefer` 用于把一个或多个已启用技巧按指定顺序提前；如果 `--prefer` 指向未启用技巧，CLI 会返回参数错误。

批量命令的 `--summary` 中，`scoreMin` / `scoreMax` / `scoreAvg` 只统计已解出题目的完整评分；未解题目的部分路径累计分不会混入这些汇总字段。

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

评分策略 schema 可通过 `getJsonSchemas().ratingPolicy` 获取；它也会内嵌在 `generationRequest.properties.ratingPolicy` 中。动态规则仍需调用 `validateRatingPolicy()` 做运行时校验。
