# Generator Optimization Plan

本文档只讨论“不依赖维护固定题面库”的生成器优化路线。目标不是承诺 `generateOne()` 能实时稳定命中任意难度，而是建立一套可复跑评估框架，先量化当前生成器，再按阶段改进，并在每个大块完成后重新评估。

相关前置结论见 [GENERATOR_CANONICAL_REVIEW_PLAN.md](./GENERATOR_CANONICAL_REVIEW_PLAN.md)：

1. 多数开源生成器对指定难度也依赖 generate-and-filter、离线筛选或 preset transform。
2. 当前 classic9 新增 `random-backtracking` / `pool` 改善终盘多样性和外部数据接入，但不能单独解决窄 score range 命中率。
3. 当前小样本显示 `clues-40-easy` 容易命中，`clues-40-medium/hard/expert` 在同样条件下全部 `score-too-low`。

## Principles

1. 先评估，再优化。每个阶段必须先有 baseline，再比较改动后的结果。
2. 不把 heuristic 当成 correctness。所有候选最终仍必须通过唯一解检查、`rate()` 和请求约束。
3. 默认行为保持保守。实验策略先 opt-in，不替换 `generateOne()` 当前默认路径。
4. 性能数字只作为开发基准，不写成公开承诺。
5. 生成器优化优先改“搜索效率”和“诊断能力”，不降低求解/评分证据质量。

## Evaluation Framework First

### Evaluation Axes

每次评估至少记录：

| Axis | Metric | Why |
| --- | --- | --- |
| Target hit rate | success / attempts by clue target and score bucket | 衡量是否更容易命中特定难度范围 |
| Runtime | elapsed avg / median / p95 | 衡量在线可用性和长尾 |
| Failure reasons | `rejectedByReason` histogram | 判断主要瓶颈是 too easy、too hard、timeout、missing technique 还是 uniqueness |
| Score distribution | min / max / avg / bucket counts | 判断候选分布是否靠近目标 |
| Hardest technique distribution | top hardest techniques | 判断是否出现目标难度结构 |
| Canonical diversity | unique canonical keys / attempts | 判断是否只是重复等价题 |
| Uniqueness cost | check status, elapsed, nodes if available | 判断生成吞吐瓶颈 |
| Rating cost | rate elapsed if instrumented | 判断 full rating 是否成为瓶颈 |
| Candidate features | candidate density, singles-only depth, givens distribution | 为后续 cheap prefilter / staged removal 提供训练信号 |

### Standard Workloads

评估集固定为三层，避免只优化一个场景。

| Workload | Purpose | Initial Cases |
| --- | --- | --- |
| Smoke | 快速确认脚本和策略没坏 | `attempts=2`、`caseLimit=2`、`maxElapsedMs=1000` |
| Baseline | 每个阶段前后比较 | `attempts=20`、clue targets `40/34/30/26`、score buckets easy/medium/hard/expert |
| Extended | 发布前或重大策略变更 | `attempts=100`、stable + galaxy profile、包含 required technique / hardest technique 请求 |

标准 score bucket 初始定义：

| Bucket | Score Range | Notes |
| --- | --- | --- |
| easy | `0..999` | 当前 40 clue 小样本易命中 |
| medium | `1000..2499` | 当前 40 clue 小样本过低 |
| hard | `2500..5999` | 需要更 aggressive removal 或更低 clue |
| expert | `6000..20000` | 不应承诺实时命中 |

### Required Benchmark Commands

当前已有：

```bash
npm run benchmark:generator-targets -- --attempts 3 --case-limit 4 --max-elapsed-ms 1000 --json
npm run benchmark:uniqueness -- --iterations 20 --json
npm run benchmark:canonical -- --iterations 3 --json
npm run benchmark:candidate-pool -- --size 100 --iterations 3 --json
```

建议新增：

```bash
npm run benchmark:generator-diagnostics -- --attempts 20 --profile classic-stable --json
npm run benchmark:generator-diagnostics -- --attempts 20 --profile classic-galaxy --json
```

`benchmark:generator-diagnostics` 应比当前 `benchmark:generator-targets` 更细，记录每个 attempt 的候选特征和阶段耗时。

Current workload preset entry points:

```bash
npm run benchmark:generator-diagnostics -- --workload smoke --skip-canonicalize --strategy default --out-dir dist/tmp/generator-eval/p0-default
npm run benchmark:generator-diagnostics -- --workload baseline --skip-canonicalize --strategy staged-removal --out-dir dist/tmp/generator-eval/baseline-staged
npm run benchmark:generator-diagnostics -- --workload extended --skip-canonicalize --strategy adaptive-loss --adaptive-pool-size 4 --out-dir dist/tmp/generator-eval/extended-adaptive
```

Explicit CLI values override workload defaults. For example, `--workload smoke --attempts 1 --case-limit 1` keeps `attempts=1` and `caseLimit=1`.

### Result Artifact

每轮评估输出两个文件：

1. JSON：机器可 diff，例如 `dist/tmp/generator-eval/<stage>/summary.json`。
2. Markdown：人工阅读，例如 `dist/tmp/generator-eval/<stage>/report.md`。

报告必须包含：

1. commit 或 git short sha。
2. Node version、machine info、date。
3. workload 参数。
4. target hit rate table。
5. top rejection reasons。
6. p50 / p95 elapsed。
7. interpretation。
8. next action。

## Current Baseline

### Implemented Baseline Tooling

当前已有：

1. `scripts/benchmark-generator-targets.mjs`
2. npm script `benchmark:generator-targets`
3. `scripts/benchmark-uniqueness.mjs`
4. `scripts/benchmark-candidate-pool.mjs`

### Baseline Observation

2026-06-25 小样本：

```bash
npm run benchmark:generator-targets -- --attempts 3 --case-limit 4 --max-elapsed-ms 1000 --json
```

结果摘要：

| Source | 40 clue easy | 40 clue medium | 40 clue hard | 40 clue expert |
| --- | --- | --- | --- | --- |
| `transform-fixed` | 3/3 | 0/3 | 0/3 | 0/3 |
| `random-backtracking` | 3/3 | 0/3 | 0/3 | 0/3 |
| `pool` | 3/3 | 0/3 | 0/3 | 0/3 |

主要拒绝原因：

1. medium / hard / expert 全部为 `score-too-low`。
2. sampled score 集中在 `610..620`。
3. 三种 solution source 都产生不同 canonical key，但难度分布没有显著改变。

当前判断：

1. 默认生成器适合生成普通 easy-ish 唯一解题。
2. 窄 score / 高难度目标需要更强的候选搜索或目标导向挖洞。
3. 只换完整终盘来源不足以提升难度命中率。

## Stage 0: Baseline Instrumentation

目标：先完善评估框架，给当前生成器一份稳定、可复跑的基线。

Status: implemented.

Implemented artifacts:

1. `scripts/benchmark-generator-diagnostics.mjs`
2. npm script `benchmark:generator-diagnostics`
3. JSON / Markdown report output via `--out-dir`, `--output-json` and `--output-markdown`
4. Attempt-level stage timings and candidate feature extraction
5. `--skip-canonicalize` mode for separating pure generation/rating throughput from canonical key cost

### Scope

1. 新增 `scripts/benchmark-generator-diagnostics.mjs`。
2. 记录每次 attempt 的阶段耗时：
   - solution generation
   - clue removal
   - uniqueness checks if available
   - minimization
   - rating
   - canonicalization
3. 记录候选特征：
   - clue count
   - score / grade / hardestTechnique
   - techniqueCounts summary
   - canonicalKey present / duplicate
   - givens distribution by row / col / box
   - initial candidate count if cheap to compute
   - singles-only residual empty cells if implemented
4. 输出 JSON + Markdown 报告。

Current implementation notes:

1. Stage timings currently measure solution generation, clue removal, minimization, feature extraction, rating, canonicalization and total elapsed.
2. `clueRemoval` includes the uniqueness checks currently performed inside `ClueRemover`.
3. Candidate features include clue distribution, candidate density and singles-only solve progress.
4. This is an external benchmark script; it does not change `generateOne()` runtime behavior.
5. Use canonicalized and non-canonicalized runs together. The former measures full candidate-pool ready output; the latter measures generation / rating throughput without canonical overhead.

### Evaluation Before

Run current baseline:

```bash
npm run benchmark:generator-targets -- --attempts 20 --case-limit 16 --max-elapsed-ms 1500 --json
npm run benchmark:uniqueness -- --iterations 20 --json
```

### Acceptance

1. Baseline report can be reproduced from a clean build.
2. Report clearly says which target bands are not reliably hit.
3. No runtime behavior change to `generateOne()`.

### Evaluation After

Run the same commands and compare that behavior is unchanged except for added observability.

Stage 0 baseline run:

```bash
npm run benchmark:generator-diagnostics -- --attempts 2 --case-limit 4 --max-elapsed-ms 1000 --out-dir dist/tmp/generator-eval/stage0-baseline
```

Observed result on 2026-06-25:

| Source | 40 clue easy | 40 clue medium | 40 clue hard | 40 clue expert |
| --- | --- | --- | --- | --- |
| `transform-fixed` | 2/2 | 0/2 | 0/2 | 0/2 |
| `random-backtracking` | 2/2 | 0/2 | 0/2 | 0/2 |
| `pool` | 2/2 | 0/2 | 0/2 | 0/2 |

Aggregate:

1. success rate: `0.25`
2. top rejection reason: `score-too-low` (`18` rejected attempts)
3. score average: `611.667`
4. elapsed p95: `896.663ms`
5. candidate total average: `transform-fixed = 91.5`, `random-backtracking = 93`, `pool = 112`
6. singles-only remaining average: `0` for all sampled rows, confirming these 40 clue samples are basic/easy

Stage timing p95:

| Stage | p95 |
| --- | ---: |
| solution generation | `3.325ms` |
| clue removal | `9.805ms` |
| feature extraction | `8.321ms` |
| rating | `4.276ms` |
| canonicalization | `841.312ms` |
| total | `896.663ms` |

Interpretation:

1. Stage 0 confirms the main difficulty-targeting issue is not terminal-grid diversity; all three sources stay in an easy singles-only band at 40 clues.
2. Under `canonicalize: true` style diagnostics, canonicalization dominates elapsed time. Future generator evaluation should report canonicalized and non-canonicalized modes separately when measuring pure generation throughput.
3. Stage 1 should use the extracted cheap features to rank candidates before full high-cost paths, but must not hard reject candidates until correlation is measured.

Non-canonicalized comparison run:

```bash
npm run benchmark:generator-diagnostics -- --attempts 2 --case-limit 4 --max-elapsed-ms 1000 --skip-canonicalize --out-dir dist/tmp/generator-eval/stage0-baseline-no-canonical
```

Observed result on 2026-06-25:

1. success rate stayed `0.25`
2. top rejection reason stayed `score-too-low` (`18` rejected attempts)
3. score average stayed `611.667`
4. elapsed p95 dropped from `896.663ms` to `83.689ms`
5. stage p95 without canonicalization:
   - solution generation: `4.34ms`
   - clue removal: `22.158ms`
   - feature extraction: `16.681ms`
   - rating: `7.95ms`
   - total: `83.689ms`

Interpretation:

1. Difficulty targeting and canonicalization are separate problems.
2. For generator strategy experiments, use `--skip-canonicalize` as the primary throughput signal and run canonicalized mode as a candidate-pool readiness check.
3. Since all sampled non-easy targets still reject as `score-too-low`, Stage 1 should focus on predicting / escaping singles-only easy puzzles before full candidate-pool canonicalization.

## Stage 1: Cheap Diagnostics And Prefilter Ranking

目标：先收集和排序，不做硬拒绝。证明哪些 cheap features 对目标 score 有预测价值。

Status: implemented as benchmark-only diagnostics; not promoted to generator runtime.

Implemented artifacts:

1. `src/generator/diagnostics.ts`
2. Shared `extractGeneratorCandidateFeatures()` used by generator diagnostics benchmark
3. `--strategy default`
4. `--strategy ranked-rejection`
5. `--ranked-pool-size <n>` for benchmark-only batch ranking
6. Feature/score correlation table in JSON and Markdown reports

Current boundary:

1. `generateOne()` default behavior is unchanged.
2. `ranked-rejection` is not a public API strategy.
3. Ranking does not hard reject by heuristic; final `rate()` still determines success/rejection.
4. In benchmark mode, ranked attempts generate an internal candidate batch and select the highest heuristic candidate before optional canonicalization.

### Candidate Features

Add a cheap candidate feature extractor:

1. `clueCount`
2. row / col / box clue min, max, average
3. givens entropy / distribution imbalance
4. total candidate count after initial candidate computation
5. bi-value and tri-value cell counts
6. singles-only solve progress:
   - placements made
   - remaining empty cells
   - whether solved by singles
7. basic profile partial score if cheap enough

Implemented feature set:

1. clue count and empty cell count
2. row / col / box givens distribution
3. givens min / max / average / entropy / imbalance
4. candidate total / min / max / average
5. bi-value / tri-value / zero-candidate cell counts
6. singles-only solved flag, step count, score, placements, remaining empty cells and stuck reason

### Ranking Mode

Add opt-in diagnostics:

```ts
generationStrategy?: {
  name: 'ranked-rejection';
  prefilter?: 'diagnostic-only' | 'rank-only';
}
```

Initial implementation should:

1. compute features for rejected and accepted candidates;
2. optionally sort / keep best internal candidates by heuristic score;
3. never skip final uniqueness or final `rate()`;
4. never hard reject based only on heuristic.

### Evaluation Before

Use Stage 0 report as baseline.

### Acceptance

1. Feature extraction overhead is measured.
2. Report shows correlation between cheap features and final score bucket.
3. No correctness behavior changes in default mode.
4. Opt-in ranking mode produces equal or better hit rate in at least one non-easy bucket without increasing p95 elapsed by more than an agreed threshold.

Acceptance result:

1. Items 1-3 are satisfied.
2. Item 4 is not satisfied on the current 40-clue workload: ranked selection raises some scores but does not hit medium/hard/expert buckets.
3. Therefore Stage 1 is useful as instrumentation and ranking evidence, but not enough as a generator improvement by itself.

### Evaluation After

Run:

```bash
npm run benchmark:generator-diagnostics -- --attempts 20 --strategy default --json
npm run benchmark:generator-diagnostics -- --attempts 20 --strategy ranked-rejection --json
```

Compare:

1. target hit rate by bucket;
2. p95 elapsed;
3. rejectedByReason;
4. score distribution;
5. feature correlation table.

Stage 1 comparison run:

```bash
npm run benchmark:generator-diagnostics -- --attempts 2 --case-limit 4 --max-elapsed-ms 1000 --skip-canonicalize --strategy default --out-dir dist/tmp/generator-eval/stage1-default
npm run benchmark:generator-diagnostics -- --attempts 2 --case-limit 4 --max-elapsed-ms 1000 --skip-canonicalize --strategy ranked-rejection --ranked-pool-size 4 --out-dir dist/tmp/generator-eval/stage1-ranked-rejection
```

Observed result on 2026-06-25:

| Strategy | Generated candidates / attempt | Success rate | Score avg | Score p95 | Elapsed p95 | Top rejection |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `default` | `1` | `0.25` | `611.667` | `620` | `58.069ms` | `score-too-low` (`18`) |
| `ranked-rejection` | `4` | `0.25` | `627.917` | `740` | `157.309ms` | `score-too-low` (`18`) |

Per-source observation:

1. `transform-fixed` non-easy rows improved from average score `610` to `675`, but still stayed below the medium lower bound `1000`.
2. `random-backtracking` stayed near `610`.
3. `pool` stayed near `615`.
4. All sampled selected candidates remained singles-solvable; `singlesOnlyRemaining` stayed `0`, so that feature has no variance in the current 40-clue workload.

Feature correlation observation:

| Strategy | Corr(candidateTotal, score) | Corr(trivalueCells, score) | Corr(givensImbalance, score) |
| --- | ---: | ---: | ---: |
| `default` | `0.7624` | `0.2928` | `0.7593` |
| `ranked-rejection` | `0.243` | `0.5092` | `0.2536` |

Interpretation:

1. Candidate total, givens imbalance and tri-value count show enough signal to keep measuring them.
2. Ranking alone mostly selects the upper edge of the current easy distribution; it does not create harder puzzle structure.
3. Because the clue-removal path reaches the same singles-solvable basin, the next improvement should change the removal process rather than only sorting finished 40-clue candidates.
4. Stage 2 should implement staged removal with checkpoint diagnostics and target-aware continue/abandon decisions.

## Stage 2: Staged Removal

目标：不再一次挖到目标线索数，而是在多个 clue checkpoints 上做 cheap evaluation，决定继续挖、回退或换 seed。

Status: implemented as benchmark-only diagnostics; not promoted to generator runtime.

Implemented artifacts:

1. `--strategy staged-removal`
2. checkpoint schedule based on target clue count
3. checkpoint diagnostics in each attempt:
   - target clue count
   - actual clue count
   - checkpoint elapsed time
   - score / grade / hardest technique
   - candidate total
   - singles-only solved flag and remaining empty cells
   - decision marker
4. aggregate checkpoint summaries in JSON and Markdown reports

Current boundary:

1. `generateOne()` default path is unchanged.
2. The first staged implementation reuses existing `ClueRemover.carve()` at each checkpoint.
3. It does not yet abandon, backtrack or mutate based on checkpoint loss; it only changes the removal path and records evidence.
4. It still performs final `rate()` and final request-constraint matching before success.

### Strategy

New opt-in strategy:

```ts
generationStrategy?: {
  name: 'staged-removal';
  checkpoints?: number[];
  checkpointEvaluation?: 'cheap' | 'basic-rate';
}
```

Initial checkpoints:

1. For target `40`: `50 -> 45 -> 40`
2. For target `34`: `50 -> 42 -> 38 -> 34`
3. For target `30`: `50 -> 42 -> 36 -> 30`
4. For target `26`: `50 -> 40 -> 33 -> 29 -> 26`

At each checkpoint:

1. ensure uniqueness or record uniqueness uncertainty;
2. compute cheap features;
3. optionally run singles-only / basic profile;
4. decide whether the candidate is too easy to continue under current target.

### Evaluation Before

Use Stage 1 best strategy as baseline.

### Acceptance

1. Default `generateOne()` path unchanged.
2. Staged strategy never returns a puzzle that fails final uniqueness or final constraints.
3. For medium/hard buckets, hit rate improves over Stage 1 under the same attempt budget, or report proves it does not.
4. Diagnostics explain checkpoint decisions.

Acceptance result:

1. Items 1, 2 and 4 are satisfied for benchmark mode.
2. Item 3 is partially satisfied: one `pool:clues-34-medium` small-sample row improved from `0/2` to `1/2`, but aggregate success rate stayed `0.25`.
3. The result is enough to justify a target-aware checkpoint loss function, but not enough to expose staged removal as public generator behavior yet.

### Evaluation After

Run:

```bash
npm run benchmark:generator-diagnostics -- --attempts 20 --strategy ranked-rejection --json
npm run benchmark:generator-diagnostics -- --attempts 20 --strategy staged-removal --json
```

Compare:

1. score bucket hit rate;
2. average number of uniqueness checks per success;
3. checkpoint rejection reasons;
4. p95 elapsed;
5. canonical diversity.

Stage 2 comparison run:

```bash
npm run benchmark:generator-diagnostics -- --attempts 2 --case-limit 8 --max-elapsed-ms 1000 --skip-canonicalize --strategy default --out-dir dist/tmp/generator-eval/stage2-default-case8
npm run benchmark:generator-diagnostics -- --attempts 2 --case-limit 8 --max-elapsed-ms 1000 --skip-canonicalize --strategy staged-removal --out-dir dist/tmp/generator-eval/stage2-staged-removal-case8
```

Observed result on 2026-06-25:

| Strategy | Success rate | Score avg | Score p95 | Elapsed p95 | Top rejection |
| --- | ---: | ---: | ---: | ---: | --- |
| `default` | `0.25` | `683.333` | `880` | `66.897ms` | `score-too-low` (`36`) |
| `staged-removal` | `0.25` | `736.667` | `1340` | `110.886ms` | `score-too-low` (`35`), `score-too-high` (`1`) |

Checkpoint aggregate for `staged-removal`:

| Metric | Value |
| --- | ---: |
| checkpoint count average | `3.5` |
| final checkpoint score average | `736.667` |
| final checkpoint candidate total average | `122.917` |
| final checkpoint singles-only remaining average | `2.5` |
| Corr(candidateTotal, score) | `0.6907` |
| Corr(singlesOnlyRemaining, score) | `0.9335` |

Target-level observations:

1. `pool:clues-34-medium` improved from `0/2` to `1/2`.
2. `pool:clues-34-easy` dropped from `2/2` to `1/2` because one candidate moved above easy and became `score-too-high`.
3. `pool:clues-34-*` staged rows reached average score `1085`, while default was `805`.
4. 40-clue rows still stayed mostly easy, so 40-clue medium/hard/expert should not be treated as an online promise.

Interpretation:

1. Staged removal can change candidate structure more than post-hoc ranking, especially for lower clue targets and pool-sourced terminal grids.
2. The strongest new signal is `singlesOnlyRemaining`; once it becomes non-zero, final score can move into medium territory.
3. The current staged strategy is too blunt: it can overshoot easy targets and still misses most hard/expert targets.
4. The next improvement should add checkpoint scoring/loss decisions instead of only fixed checkpoint sequencing.
5. Stage 3 uniqueness optimization is still relevant because staged removal increases repeated uniqueness-check pressure.

## Stage 3: Uniqueness Counter Optimization

目标：降低每次挖洞和 staged checkpoint 的唯一解验证成本。

Status: evaluated; implementation deferred.

Reason:

1. Current standalone uniqueness benchmark is already sub-millisecond to low-single-millisecond on the included corpus.
2. Stage 0 showed canonicalization dominated full candidate-pool-ready diagnostics (`841.312ms` p95 canonicalization in the small canonicalized run).
3. Stage 2 showed staged removal raises generator elapsed p95, but the immediate need is better checkpoint/loss decisions before replacing the uniqueness engine.
4. A DLX or cached-search rewrite would add correctness risk without enough evidence that uniqueness is currently the top bottleneck.

### Options

Evaluate independently:

1. Optimize current MRV implementation.
2. Add count-up-to-two fast path.
3. Add internal exact-cover / DLX prototype.
4. Cache local search data within one clue-removal session.
5. Expose richer internal diagnostics without changing public `checkUniqueness()` semantics.

### Evaluation Before

Run:

```bash
npm run benchmark:uniqueness -- --iterations 50 --json
npm run benchmark:generator-diagnostics -- --attempts 20 --strategy staged-removal --json
```

### Acceptance

1. `checkUniqueness()` public result semantics unchanged.
2. Existing uniqueness tests pass.
3. p95 uniqueness elapsed improves on benchmark corpus, or diagnostics prove bottleneck is elsewhere.
4. Generator hit rate does not regress.

Acceptance result:

1. Public `checkUniqueness()` semantics remain unchanged.
2. Existing uniqueness benchmark was run before making any search-engine changes.
3. No implementation change was made because the benchmark does not justify a risky rewrite at this point.
4. Stage 3 should be reopened after Stage 4 if adaptive/loss generation increases uniqueness-check volume enough to make this a bottleneck.

### Evaluation After

Run the same commands and compare:

1. uniqueness elapsed p50 / p95;
2. nodes visited;
3. generator elapsed p50 / p95;
4. timeout / exhausted counts;
5. final solution correctness.

Stage 3 baseline run:

```bash
npm run benchmark:uniqueness -- --iterations 20 --json
```

Observed result on 2026-06-25:

| Case | Status | Avg elapsed | Min..max elapsed | Nodes avg |
| --- | --- | ---: | ---: | ---: |
| `solved-board` | `unique` | `1.121ms` | `0.2..6.451ms` | `1` |
| `easy-unique` | `unique` | `0.873ms` | `0.316..3.022ms` | `52` |
| `single-missing` | `unique` | `0.212ms` | `0.163..0.454ms` | `2` |
| `sparse-multiple` | `multiple` | `0.566ms` | `0.356..1.624ms` | `91` |
| `invalid-duplicate` | `invalid` | `0.077ms` | `0.054..0.364ms` | `0` |

Interpretation:

1. Current `checkUniqueness()` is not the first optimization target under the current benchmark corpus.
2. The better Stage 3 follow-up is to expand benchmark coverage with harder near-multiple and low-clue unique cases, not to replace the solver immediately.
3. For this generator plan, move engineering effort to Stage 4 loss-driven generation and revisit uniqueness only if Stage 4 reports high uniqueness time or timeout share.

## Stage 4: Adaptive / Loss-Function Generation

目标：借鉴 Tdoku 的 loss-driven idea，但保持 TypeScript 实现和 classic9 rating contract。

Status: implemented as benchmark-only prototype; not promoted to generator runtime.

Implemented artifacts:

1. `--strategy adaptive-loss`
2. `--adaptive-pool-size <n>`
3. batch generation over staged-removal candidates
4. final-rating-based loss selection
5. loss diagnostics per internal candidate:
   - total loss
   - score distance
   - clue distance
   - unsolved penalty
   - too-easy / too-hard penalty
   - timeout penalty
   - singles-only penalty

Current boundary:

1. This is not a cheap prefilter yet; it uses final `rate()` to evaluate candidates in the experiment.
2. It does not mutate givens across rounds yet.
3. It does not expose a public generator strategy.
4. It keeps deterministic seed behavior by deriving internal batch seeds from the outer attempt seed.

### Loss Function

Prototype opt-in strategy:

```text
loss =
  scoreDistanceWeight * distanceToTargetScore
  + clueDistanceWeight * distanceToTargetClues
  + missingTechniquePenalty
  + tooEasyPenalty
  + timeoutPenalty
  + duplicateCanonicalPenalty
```

Algorithm sketch:

1. Generate an initial candidate batch.
2. Score each candidate by loss.
3. Keep top-N.
4. Mutate givens by add/remove/swap within uniqueness constraints.
5. Repeat for a small number of rounds.
6. Return first final-constraint match, or bestCandidate with detailed loss diagnostics.

### Evaluation Before

Use best Stage 2 or Stage 3 strategy as baseline.

### Acceptance

1. Must be opt-in experimental.
2. Must improve at least one hard target workload enough to justify complexity.
3. Must keep deterministic seed behavior.
4. Must emit loss diagnostics.
5. Must not hide failure as success.

Acceptance result:

1. Items 1, 3, 4 and 5 are satisfied for benchmark mode.
2. Item 2 is not satisfied for hard/expert targets in the current small workload.
3. It improves aggregate success rate slightly by avoiding one staged-removal easy overshoot, but the gain is not enough to justify public API exposure.

### Evaluation After

Run:

```bash
npm run benchmark:generator-diagnostics -- --attempts 20 --strategy staged-removal --json
npm run benchmark:generator-diagnostics -- --attempts 20 --strategy adaptive-loss --json
```

Compare:

1. hit rate for medium/hard/expert buckets;
2. time per success;
3. loss improvement by round;
4. canonical duplicate rate;
5. final `rate()` verification.

Stage 4 comparison run:

```bash
npm run benchmark:generator-diagnostics -- --attempts 2 --case-limit 8 --max-elapsed-ms 1000 --skip-canonicalize --strategy staged-removal --out-dir dist/tmp/generator-eval/stage2-staged-removal-case8
npm run benchmark:generator-diagnostics -- --attempts 2 --case-limit 8 --max-elapsed-ms 1000 --skip-canonicalize --strategy adaptive-loss --adaptive-pool-size 4 --out-dir dist/tmp/generator-eval/stage4-adaptive-loss-case8
```

Observed result on 2026-06-25:

| Strategy | Generated candidates / attempt | Success rate | Score avg | Score p95 | Elapsed p95 | Top rejection |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `staged-removal` | `1` | `0.25` | `736.667` | `1340` | `110.886ms` | `score-too-low` (`35`), `score-too-high` (`1`) |
| `adaptive-loss` | `4` | `0.2708` | `750.208` | `1340` | `228.757ms` | `score-too-low` (`35`) |

Target-level observations:

1. `pool:clues-34-medium` stayed at `1/2`, same as staged removal.
2. `pool:clues-34-easy` improved from `1/2` back to `2/2` because loss selection avoided the `score-too-high` candidate.
3. `transform-fixed:clues-34-medium` rose from average score `735` to `855`, but still missed the `1000` lower bound.
4. `random-backtracking:clues-34-medium` rose from `740` to `810`, still below medium.
5. 40-clue non-easy targets remained far below target.

Interpretation:

1. Loss selection is directionally useful for choosing less bad candidates from a batch.
2. The current prototype does not create enough hard structure because it only selects among candidates produced by the same removal process.
3. The next meaningful adaptive step would need actual mutation or beam search over add/remove/swap operations with uniqueness constraints.
4. Do not expose `adaptive-loss` publicly until it improves medium/hard hit rate by more than a small single-row gain.

## Stage 5: Product-Facing Strategy And Documentation

目标：把实测有效的策略暴露给用户，但不夸大。

Status: decision made; no new public strategy should be exposed yet.

Decision:

1. Keep `generateOne()` default strategy unchanged.
2. Keep `ranked-rejection`, `staged-removal` and `adaptive-loss` inside `benchmark:generator-diagnostics`.
3. Do not add `generationStrategy` to public `GenerationRequest` in the current release.
4. Public docs should continue to describe score targeting as best-effort and recommend `search()` / candidate pools / offline selection for hard targets.
5. The benchmark artifacts are useful for internal development, not yet for user-facing performance claims.

### Possible Public Surface

Only after Stage 1-4 evidence:

```ts
generationStrategy?: 'default' | 'staged-removal' | 'adaptive-loss';
```

or a richer shape:

```ts
generationStrategy?: {
  name: 'default' | 'staged-removal' | 'adaptive-loss';
  diagnostics?: boolean;
  maxRounds?: number;
}
```

### Documentation Requirements

Update:

1. [GENERATOR.md](./GENERATOR.md)
2. [GENERATOR_COOKBOOK.md](./GENERATOR_COOKBOOK.md)
3. [GENERATOR_CANONICAL_REVIEW_PLAN.md](./GENERATOR_CANONICAL_REVIEW_PLAN.md) or replace with final review note
4. README if public API changes

Docs must state:

1. exact strategy semantics;
2. default strategy remains conservative;
3. score targeting remains best-effort unless benchmark proves otherwise;
4. recommended workflow for hard targets is still `search()` / candidate pools / offline selection.

### Evaluation After

Run release-level gates:

```bash
npm test
npm run test:slow
npm run benchmark:generator-targets -- --attempts 20 --case-limit 16 --max-elapsed-ms 1500 --json
npm run audit:reference
npm run verify:coverage
```

## Stage Summary

| Stage | Main Change | Default Behavior Changed? | Required Re-evaluation |
| --- | --- | --- | --- |
| 0 | Better benchmark and diagnostics | No | Complete |
| 1 | Cheap feature extraction and ranking | No | Complete; useful diagnostics, insufficient hit-rate gain |
| 2 | Staged removal benchmark strategy | No | Complete; medium signal on `pool:clues-34`, still unreliable |
| 3 | Uniqueness counter review | No | Evaluated; implementation deferred |
| 4 | Adaptive / loss-function benchmark prototype | No | Complete; slight gain, insufficient for public strategy |
| 5 | Public docs/API decision | No | Keep strategies internal for now |

## Decision Rules

Promote a strategy only if:

1. It improves target hit rate under the same attempt budget.
2. It does not produce invalid, non-unique, unsolved or constraint-mismatched success results.
3. It does not make easy/default generation meaningfully worse.
4. It emits enough diagnostics to explain failures.
5. It passes reference and release gates.

Reject or defer a strategy if:

1. Improvement appears only in one cherry-picked seed range.
2. p95 elapsed gets worse without corresponding hit-rate improvement.
3. Heuristic hard rejects cannot be proven safe.
4. It requires copying incompatible external implementation.
5. It blurs the meaning of classic9 score or rating policy.

## Near-Term Action List

Detailed next-step execution plan: [GENERATOR_STRATEGY_UPDATE_STEPS.md](./GENERATOR_STRATEGY_UPDATE_STEPS.md).

1. Keep current release behavior conservative; do not expose experimental generation strategies yet.
2. Use `benchmark:generator-diagnostics -- --skip-canonicalize` for strategy iteration and canonicalized runs only for candidate-pool readiness checks.
3. If continuing generator work, implement real adaptive mutation / beam search instead of only selecting among fixed carve outputs.
4. Add harder uniqueness benchmark cases before attempting DLX or cached-search rewrites.
5. If publishing now, describe improved diagnostics and random solution sources as 0.5.0-level capability, but do not market reliable hard-target online generation.
