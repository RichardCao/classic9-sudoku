# Generator Strategy Update Checklist

本文档把外部开源项目可借鉴的生成器方向，改写成可直接拆任务执行的 checklist。

目标不是让 `generateOne()` 立刻承诺“实时稳定命中任意 hard / expert”，而是把生成器拆成三条互补路径：

1. 在线快速路径：对常见粗难度标签，用已验证 seed puzzle 做等价变换，快速返回。
2. 离线候选池路径：对窄 score range、hardest technique、hard / expert，批量生成、评分、canonical 去重、筛选。
3. 目标导向搜索路径：对 fresh generation，使用 staged removal、cheap features、loss 和 beam search 提高命中率。

Related docs:

1. [GENERATOR_CANONICAL_REVIEW_PLAN.md](./GENERATOR_CANONICAL_REVIEW_PLAN.md)：外部项目对比和 canonical 复核。
2. [GENERATOR_OPTIMIZATION_PLAN.md](./GENERATOR_OPTIMIZATION_PLAN.md)：Stage 0-5 本地 benchmark 和实验策略记录。
3. [CANDIDATE_POOL.md](./CANDIDATE_POOL.md)：现有候选池工作流。
4. [GENERATOR.md](./GENERATOR.md)：当前公开生成器语义。

## External Inputs

| Source direction | Borrow | Do not borrow | classic9 target |
| --- | --- | --- | --- |
| `sudoku-gen` | verified puzzle seeds + equivalence transform | external seed data without provenance; difficulty labels as exact score | `preset-transform` |
| `QQWing` | coarse labels, symmetry option, clear stats | QQWing rating model or guess-based score semantics | diagnostics + broad labels |
| `go-sudoku` / Radcliffe | offline generate-filter-store workflow | claim online hard targeting | candidate pool production |
| Tdoku | loss-driven search and benchmark discipline | C/C++ SIMD implementation | `adaptive-beam` benchmark strategy |
| Sudoku Explainer | expectation calibration for human-rating hard puzzles | license-incompatible implementation | docs and release boundary |

## Global Rules

1. Default `generateOne()` behavior must remain unchanged until a strategy passes benchmark gates.
2. Benchmark-only strategies are allowed to be experimental and slower, but must never report invalid success.
3. Public output must never treat `bestCandidate` as a successful generated puzzle.
4. Every final accepted puzzle must pass uniqueness, full `rate()`, and request constraints.
5. Use `--skip-canonicalize` for strategy throughput; run canonicalized mode separately for candidate-pool readiness.
6. Do not commit third-party puzzle seeds unless license/provenance is explicit and compatible.
7. Keep hard/expert online generation documented as best-effort or offline-first until evidence changes.

## Shared Metrics

Every phase that changes generation behavior must report these metrics:

| Metric | Required output |
| --- | --- |
| hit rate | success / attempts by source, clue target, score bucket |
| failure reasons | `rejectedByReason` histogram |
| runtime | average, median, p95 total elapsed |
| score distribution | min, max, average, median, p95 |
| feature distribution | candidate total, givens imbalance, singles-only remaining |
| canonical readiness | canonicalize on/off comparison when relevant |
| invalid success count | must be `0` |
| deterministic seed behavior | same command + same seed gives same selected candidate shape |

Quantitative gates use these defaults unless a phase states otherwise:

1. easy hit rate regression: no more than `10%` relative regression on baseline workload.
2. medium improvement: at least `+20%` relative hit-rate improvement or at least `+1` additional success in the same small workload.
3. p95 overhead: no more than `2.5x` baseline unless the strategy is explicitly offline-only.
4. invalid/non-unique/unsolved accepted count: exactly `0`.
5. public API compatibility: existing tests and examples must pass.

## Phase 0: Evaluation Contract

Goal:

Make all later strategy changes comparable with stable workloads and report fields.

Status:

Implemented and verified on 2026-06-25.

Completed tasks:

1. P0-T1: `--workload` parser added.
2. P0-T2: `smoke`, `baseline` and `extended` workload presets added.
3. P0-T3: report fields added for `workload`, `strategyVersion`, `timePerSuccessMs` and `internalCandidateCount`.
4. P0-T4: Markdown report now includes a Strategy Summary table.
5. P0-T5: docs link workload-based usage and keep canonicalized/non-canonicalized evaluation split.

Verification evidence:

1. `p0-default`: `workload=smoke`, `strategyVersion=default.v1`, `attempts=2`, `caseLimit=4`, `maxElapsedMs=1000`, internal candidates average `1`.
2. `p0-staged`: `workload=smoke`, `strategyVersion=staged-removal.v1`, internal candidates average `1`.
3. `p0-adaptive`: `workload=smoke`, `strategyVersion=adaptive-loss.v1`, internal candidates average `2`.
4. Explicit override check: `--workload smoke --attempts 1 --case-limit 1` preserved `attempts=1` and `caseLimit=1`.
5. `npm test` passed.

Minimum viable slice:

Add `--workload smoke|baseline|extended` to `benchmark-generator-diagnostics` without changing any generator runtime behavior.

Task breakdown:

| ID | Task | Files | Implementation | Tests |
| --- | --- | --- | --- | --- |
| P0-T1 | Add workload parser | `scripts/benchmark-generator-diagnostics.mjs` | Add `--workload`; reject unknown values; preserve explicit CLI overrides | smoke command with each workload |
| P0-T2 | Define workload presets | `scripts/benchmark-generator-diagnostics.mjs` | `smoke={attempts:2,caseLimit:4,maxElapsedMs:1000}`, `baseline={attempts:20,caseLimit:16,maxElapsedMs:1500}`, `extended={attempts:100,caseLimit:16,maxElapsedMs:5000}` | JSON report options match preset |
| P0-T3 | Add report fields | `scripts/benchmark-generator-diagnostics.mjs` | Include `workload`, `strategyVersion`, `canonicalize`, `timePerSuccess`, `internalCandidateCount` | inspect `summary.json` |
| P0-T4 | Add comparison table | `scripts/benchmark-generator-diagnostics.mjs` | Markdown report includes aggregate strategy metrics and next action | inspect `report.md` |
| P0-T5 | Update docs | this file, `GENERATOR_OPTIMIZATION_PLAN.md` | Link workload commands and explain canonicalized vs non-canonicalized runs | docs diff only |

Acceptance:

1. Existing strategies still work: `default`, `ranked-rejection`, `staged-removal`, `adaptive-loss`.
2. `--workload smoke` produces the same effective values as manually passing `--attempts 2 --case-limit 4 --max-elapsed-ms 1000`.
3. Explicit CLI values override workload defaults.
4. JSON and Markdown include workload id and strategy version.
5. `generateOne()` source files are unchanged.

Verification:

```bash
npm run benchmark:generator-diagnostics -- --workload smoke --skip-canonicalize --strategy default --out-dir dist/tmp/generator-eval/p0-default
npm run benchmark:generator-diagnostics -- --workload smoke --skip-canonicalize --strategy staged-removal --out-dir dist/tmp/generator-eval/p0-staged
npm run benchmark:generator-diagnostics -- --workload smoke --skip-canonicalize --strategy adaptive-loss --adaptive-pool-size 2 --out-dir dist/tmp/generator-eval/p0-adaptive
npm test
git diff --check -- scripts/benchmark-generator-diagnostics.mjs docs/GENERATOR_STRATEGY_UPDATE_STEPS.md
```

Defer / rollback:

1. If workload presets make output ambiguous, remove `--workload` and keep explicit commands.
2. If report fields break old JSON consumers, version the benchmark id to `generator-diagnostics-benchmark.v2`.

## Phase 1: Preset Puzzle Transform

Goal:

Prototype the `sudoku-gen` style path: known verified puzzle seeds transformed online for fast coarse difficulty generation.

Status:

Minimum viable slice implemented and verified on 2026-06-25.

Completed tasks:

1. P1-T1: added `tests/fixtures/generator/preset-puzzle-seeds.json` with three local/generated easy seeds.
2. P1-T3: added script-local seed validation for board shape, clue consistency, uniqueness, rating metadata and canonical key.
3. P1-T5: added benchmark-only `--strategy preset-transform`.
4. P1-T6: report includes selected seed id, target difficulty, transform, validation status and canonical before/after when canonicalization is enabled.

Scoped deferral:

1. P1-T2 / P1-T4 are intentionally script-local in this slice; no public/internal TypeScript module was added yet.
2. `preset-transform.v1` uses digit relabel only. Full row/column/band/stack/transpose structural transforms were tested during implementation and exposed rating drift under the current solver scan order.
3. Structural preset transforms must wait for a separate rating-invariance decision: either make rating invariant under structural transforms, or store transformed rating metadata per emitted puzzle.

Verification evidence:

1. Non-canonicalized preset smoke: success rate `1`, elapsed p95 `9.648ms`, time per success `9.342ms`, preset seed count `3`.
2. Canonicalized preset smoke: success rate `1`, elapsed p95 `1349.759ms`, time per success `1070.599ms`, canonical key check enabled.
3. Canonical equivalence smoke passed with `--max-rows 1 --transforms-per-row 1`.

Minimum viable slice:

Benchmark-only `--strategy preset-transform` using a tiny local fixture with generated/provenance-safe rows.

Task breakdown:

| ID | Task | Files | Implementation | Tests |
| --- | --- | --- | --- | --- |
| P1-T1 | Define seed fixture format | `tests/fixtures/generator/preset-puzzle-seeds.json` | 3-5 local generated rows; include metadata and provenance | fixture load smoke |
| P1-T2 | Add internal seed type | `src/generator/preset-seed.ts` or script-local type first | Define `PresetPuzzleSeed`, source metadata, rating metadata | typecheck |
| P1-T3 | Add seed validator | `src/generator/preset-seed.ts` or script-local first | Validate puzzle/solution shape, clue consistency, uniqueness, rating metadata, canonical key | unit-style assertions or benchmark validation failures |
| P1-T4 | Add transform utility | `src/generator/preset-transform.ts` or script-local first | start with digit relabel; defer structural transforms until rating-invariance issue is resolved | transform preserves board shape and rating metadata |
| P1-T5 | Add benchmark strategy | `scripts/benchmark-generator-diagnostics.mjs` | `--strategy preset-transform`, `--preset-seeds`, `--difficulty`; select matching seed and transform | smoke benchmark |
| P1-T6 | Add report fields | `scripts/benchmark-generator-diagnostics.mjs` | seed id, transform seed, before/after score, before/after canonical key, validation status | inspect report |
| P1-T7 | Add docs | `GENERATOR_COOKBOOK.md`, this file | State preset is verified-transform, not fresh generation | docs diff |

Seed fixture schema:

```ts
interface PresetPuzzleSeed {
  id: string;
  puzzle: string;
  solution: string;
  clueCount: number;
  ratingProfile: 'classic-stable' | 'classic-galaxy';
  ratingPolicyVersion: string;
  score: number;
  grade: string | null;
  hardestTechnique: string | null;
  techniqueCounts: Record<string, number>;
  canonicalKey: string;
  source: {
    kind: 'authored' | 'generated' | 'imported';
    license: string;
    note?: string;
  };
}
```

Acceptance:

1. Transformed puzzle has a unique solution and matches transformed solution.
2. Transformed puzzle has the same score, grade, hardestTechnique and techniqueCounts under the same rating profile for the enabled transform scope.
3. `canonicalizePair(transformedPuzzle, transformedSolution).key` equals original `canonicalKey` when canonicalization is enabled.
4. Preset-transform p95 elapsed on smoke is at most `20%` of fresh default/staged baseline for the same coarse label, or the phase remains experimental.
5. Fixture rows have explicit local/generated provenance.
6. No public API change.

Verification:

```bash
npm run benchmark:generator-diagnostics -- --workload smoke --case-limit 1 --source transform-fixed --skip-canonicalize --strategy preset-transform --difficulty easy --preset-seeds tests/fixtures/generator/preset-puzzle-seeds.json --out-dir dist/tmp/generator-eval/p1-preset-smoke
npm run benchmark:generator-diagnostics -- --workload smoke --case-limit 1 --source transform-fixed --strategy preset-transform --difficulty easy --preset-seeds tests/fixtures/generator/preset-puzzle-seeds.json --out-dir dist/tmp/generator-eval/p1-preset-canonical
npm run audit:canonical-equivalence -- --max-rows 1 --transforms-per-row 1 --json
npm test
git diff --check -- scripts/benchmark-generator-diagnostics.mjs tests/fixtures/generator/preset-puzzle-seeds.json docs/GENERATOR_STRATEGY_UPDATE_STEPS.md
```

Defer / rollback:

1. If score metadata changes after transform, fix transform or rating invariance before continuing.
2. If provenance is unclear, remove fixture rows and keep only validator/loader code.
3. If latency is not materially better, keep this as a tooling feature, not a product path.

## Phase 2: Candidate Pool Production Workflow

Goal:

Make offline generate-filter-store strong enough for hard/expert and narrow score targets.

Status:

Minimum viable slice implemented and verified on 2026-06-25.

Completed tasks:

1. P2-T2: candidate stats now report `solved` distribution and `sourceCounts`.
2. P2-T3: selection plan now supports optional `clueBuckets`, `hardestTechniqueBuckets` and `requiredTechniqueBuckets`.
3. P2-T5: `CANDIDATE_POOL.md` and `GENERATOR_COOKBOOK.md` document pool-first medium/hard workflow.
4. P2-T6: selection rejects `solved: false` candidates with `unsolved-candidate`.

Scoped deferral:

1. P2-T1 manifest metadata expansion remains partially deferred; current run manifests are unchanged to avoid widening CLI resume semantics in the same slice.
2. P2-T4 dedicated pool benchmark remains deferred; current verification uses API/CLI tests and existing candidate stats/select commands.

Verification evidence:

1. `npm run typecheck` passed.
2. `npm test` passed.
3. Candidate selection tests cover clue buckets, hardest technique buckets, required technique buckets and `unsolved-candidate`.
4. Candidate stats tests cover `solved.true` and `sourceCounts.unknown`.

Minimum viable slice:

Manifest and selection improvements that let users build, dedupe, inspect and select a medium/hard-oriented pool without new public generator strategy.

Task breakdown:

| ID | Task | Files | Implementation | Tests |
| --- | --- | --- | --- | --- |
| P2-T1 | Extend manifest metadata | `src/generator/index.ts`, `src/cli/index.ts`, schema docs as needed | Add strategy, profile, rating policy version, canonical version, source/provenance, createdAt | CLI search manifest smoke |
| P2-T2 | Extend stats | candidate pool stats implementation | Add score/clue/hardestTechnique/techniqueCounts/source histograms | candidate-stats smoke |
| P2-T3 | Extend selection plan | `src/generator/index.ts`, `src/schema/index.ts`, CLI select path | Add clue buckets, hardestTechnique buckets, requiredTechnique buckets, per-bucket limits | schema + selection tests |
| P2-T4 | Add pool benchmark | `scripts/benchmark-candidate-pool.mjs` or new script | Measure selection time, selected hit rate, duplicate rate | benchmark smoke |
| P2-T5 | Add cookbook | `docs/GENERATOR_COOKBOOK.md`, `docs/CANDIDATE_POOL.md` | Full offline workflow with append/resume/dedupe/stats/select | docs diff |
| P2-T6 | Add negative guards | tests | Ensure invalid/non-unique/unsolved candidates cannot be selected as accepted | `npm test` |

Acceptance:

1. A repeatable local pool run fills easy and medium score buckets with at least one selected candidate each.
2. Selected candidates all have `solved === true` and pass uniqueness when rechecked.
3. Canonical duplicate count is visible in stats.
4. Candidate pool data remains external to package by default.
5. Existing candidate pool APIs remain backward-compatible.

Verification:

```bash
npm run build
node dist/src/cli/index.js search '{"seed":1,"maxResults":50,"scoreBucketSize":250,"canonicalize":true,"minimality":"none","constraints":{"clues":{"min":26,"max":40}},"budget":{"maxAttempts":200,"maxElapsedMs":5000}}' --summary-only --write-candidates ./dist/tmp/pool/candidates.json --write-manifest ./dist/tmp/pool/manifest.json
node dist/src/cli/index.js candidate-stats ./dist/tmp/pool/candidates.json
node dist/src/cli/index.js dedupe-candidates ./dist/tmp/pool/candidates.json --out ./dist/tmp/pool/candidates-deduped.json
node dist/src/cli/index.js select ./dist/tmp/pool/candidates-deduped.json ./selection-plan.json --write-selected ./dist/tmp/pool/selected.json --write-rejected ./dist/tmp/pool/rejected.json
npm test
```

Defer / rollback:

1. If schema changes are too broad, keep new selection fields script-only until API review.
2. If pool fill rate is poor, do not tune selection first; feed pool with Phase 3/4 strategies.

## Phase 3: Target-Aware Staged Removal

Goal:

Upgrade current staged-removal diagnostics into an actual checkpoint decision strategy.

Status:

Implemented and evaluated on 2026-06-25; not promoted.

Completed tasks:

1. P3-T1: checkpoint diagnostics now include decision, reason and loss.
2. P3-T2: checkpoint evaluator added for target score range, clue target, singles-only signal and score distance.
3. P3-T3: decisions include `continue`, `accept-for-final-rating`, `restore-and-branch`, `abandon-too-hard` and `final-checkpoint`.
4. P3-T4: benchmark-only `--strategy staged-targeted` added.
5. P3-T5: target thresholds added for easy and non-easy buckets.
6. P3-T6: report summary includes checkpoint decision counts.

Evaluation result:

1. `staged-removal` case8: success rate `0.25`, elapsed p95 `90.672ms`, time per success `139.343ms`, internal candidates average `1`.
2. `staged-targeted` case8: success rate `0.2708`, elapsed p95 `360.871ms`, time per success `451.821ms`, internal candidates average `4`.
3. Decision counts for `staged-targeted`: `continue=84`, `restore-and-branch=36`, `final-checkpoint=35`, `accept-for-final-rating=13`.
4. The improvement came from avoiding one easy overshoot, not from improving medium hit rate.

Acceptance result:

1. Medium hit-rate gate was not met.
2. Easy regression gate was met; `pool:clues-34-easy` improved from `1/2` to `2/2`.
3. p95 overhead gate was not met under this small workload.
4. Diagnostics gate was met; checkpoint decisions and reasons are visible.
5. Default `generateOne()` remains unchanged.

Decision:

Keep `staged-targeted` benchmark-only. Use its traces as input for Phase 4 adaptive beam search instead of productizing it.

Minimum viable slice:

Add benchmark-only `--strategy staged-targeted` with checkpoint evaluator and explicit checkpoint decisions.

Task breakdown:

| ID | Task | Files | Implementation | Tests |
| --- | --- | --- | --- | --- |
| P3-T1 | Define checkpoint diagnostics | `scripts/benchmark-generator-diagnostics.mjs` first | Add checkpoint status, features, basic score, decision, reason | smoke report |
| P3-T2 | Add checkpoint evaluator | script first, later `src/generator/staged-removal.ts` | Evaluate target score range, clue target, singlesOnlyRemaining, candidateTotal, elapsed budget | deterministic fixture call |
| P3-T3 | Add decision actions | script first | `continue`, `accept-for-final-rating`, `abandon-too-easy`, `abandon-too-hard`, `restore-and-branch`, `timeout` | report decision histogram |
| P3-T4 | Add strategy flag | `scripts/benchmark-generator-diagnostics.mjs` | `--strategy staged-targeted`; preserve `staged-removal` baseline | smoke benchmark |
| P3-T5 | Add target thresholds | script first | easy prefers singles-solvable; medium prefers non-zero singles residual without huge score overshoot; hard/expert allow lower clues | baseline benchmark |
| P3-T6 | Add branch trace | report renderer | show decisions and reasons in JSON; summarize in Markdown | inspect report |

Acceptance:

1. Medium hit rate improves over `staged-removal` by `+20%` relative or at least `+1` success on the same baseline workload.
2. Easy hit rate regresses by no more than `10%` relative.
3. p95 elapsed is no more than `2.5x` `staged-removal` on non-canonicalized baseline.
4. Every early abandon/branch has a reason in JSON.
5. Default `generateOne()` unchanged.

Verification:

```bash
npm run benchmark:generator-diagnostics -- --workload baseline --skip-canonicalize --strategy staged-removal --out-dir dist/tmp/generator-eval/p3-staged
npm run benchmark:generator-diagnostics -- --workload baseline --skip-canonicalize --strategy staged-targeted --out-dir dist/tmp/generator-eval/p3-staged-targeted
npm test
git diff --check -- scripts/benchmark-generator-diagnostics.mjs docs/GENERATOR_STRATEGY_UPDATE_STEPS.md
```

Defer / rollback:

1. If medium does not improve, keep checkpoint traces and move to Phase 4 beam search.
2. If easy regresses, split thresholds by target bucket before further tuning.
3. If p95 explodes, reduce branch count or mark strategy offline-only.

## Phase 4: Adaptive Beam Search

Goal:

Turn loss selection into an iterative generator search with mutation and beam pruning.

Status:

Minimum viable slice implemented and evaluated on 2026-06-26. Keep `adaptive-beam` benchmark-only and do not promote to public generation yet.

Completed tasks:

1. P4-T1: added script-local beam candidate state with puzzle, solution, seed, round, features, rating, uniqueness summary, loss and mutation history.
2. P4-T2: added `scoreAdaptiveBeamLoss()` with score distance, clue distance, singles penalty, uniqueness penalty, target-band reward and profile-specific rewards.
3. P4-T3: added deterministic `remove-one-clue` and `restore-one-clue` mutation families.
4. P4-T4: added benchmark-only `--strategy adaptive-beam` with `--beam-width`, `--beam-rounds`, `--mutations-per-candidate` and `--loss-profile`.
5. P4-T5: used `extractGeneratorCandidateFeatures()` for ranking signals, without hard-rejecting by cheap features.
6. P4-T6: final accepted candidates still require full `rate()`, target constraints and uniqueness when clue count matches the target.
7. P4-T7: reports include selected loss, selected round, mutation history, top beam candidates and bounded trace rows.

Evaluation evidence:

1. Smoke `adaptive-beam`: `workload=smoke`, `beamWidth=4`, `beamRounds=3`, `mutationsPerCandidate=4`, `skipCanonicalize=true`. Easy rows stayed successful, but medium/hard/expert at 40 clues did not improve over `staged-targeted`; p95 reached about `1.0s-3.4s` depending source/row.
2. Smoke `staged-targeted` comparison: same workload, internal candidates average `4`, p95 mostly `~75ms-304ms`, same success profile for sampled 40-clue non-easy rows.
3. Pool case8 `adaptive-beam`: `attempts=2`, `caseLimit=8`, `source=pool`, `maxElapsedMs=1000`; 34-clue medium stayed `1/2`, hard/expert stayed `0/2`; p95 roughly `480ms-1406ms`.
4. Pool case8 `staged-targeted`: same sample; 34-clue medium also `1/2`, hard/expert `0/2`; p95 roughly `83ms-396ms`.
5. Initial beam implementation found higher-score non-target clue-count intermediates; pruning was adjusted to keep target-clue candidates in the beam and final selection, removing `clue-count-target-mismatch` as the top rejection in the pool case8 rerun.
6. Follow-up relocation mutation: added `relocate-one-clue` to move one given to another empty cell while preserving clue count. It raised some average scores at the same clue count, but did not add medium/hard successes in the pool case8 sample.
7. Follow-up uniqueness priority: relocation initially selected high-score non-unique puzzles for hard/expert rows; final and beam ranking now prefer unique candidates before lower loss, returning rejections to `score-too-low` instead of `adaptive-beam-not-unique`.
8. Follow-up early stop: beam now stops once a valid success is already in the beam. Pool case8 easy rows dropped to internal candidates average `4`, with p95 around `369ms` for 40 clues easy and `173ms` for 34 clues easy; non-easy hit rate stayed unchanged.

Decision:

Do not promote `adaptive-beam.v1`. It is useful as an offline diagnostic/search harness, and early-stop is worth keeping inside the benchmark strategy. Current remove/restore/relocate mutations still do not improve hit rate enough to justify the p95 overhead for online generation. Next generator optimization should focus on stronger target-preserving mutation operators and pool-first production, not public online hard targeting.

Follow-up: target-preserving paired mutation plan and result:

Goal:

Improve `adaptive-beam` candidate quality by generating target-clue-count-preserving neighbors first, instead of increasing beam width or mutation count.

Executable steps:

1. Add attempt-local caches for cheap features, full rating and uniqueness checks.
2. Replace random `relocate-one-clue` priority with scored `paired-remove-restore` proposals.
3. Rank remove cells by dense row/column/box givens, and restore cells by sparse row/column/box givens.
4. Cap raw pair proposals before feature extraction, then rank the capped pairs by feature deltas.
5. Prefer proposals that increase non-easy structure signals: singles-only remaining cells, candidate total, bivalue cells and trivalue cells.
6. Penalize proposals that create zero-candidate cells, worsen givens imbalance or undo non-easy structure through the restored clue.
7. Keep full acceptance unchanged: selected success still requires target clue count, unique solution, full `rate()` and request constraints.
8. Compare against `staged-targeted` with the same `source=pool`, `attempts=2`, `caseLimit=8`, `maxElapsedMs=1000` workload.

Implementation status:

Implemented on 2026-06-26 in `scripts/benchmark-generator-diagnostics.mjs`.

1. `paired-remove-restore` mutation records `removeCell`, `restoreCell` and `proposalScore`.
2. `feature`, `rating` and `uniqueness` caches are attempt-local and reported in `strategy.cacheStats`.
3. Proposal cap reduced feature extraction work while preserving the observed 34-clue medium improvement.

Verification evidence:

1. `staged-targeted` pool case8: 34-clue medium `1/2`, score average `1085`, p95 `160.264ms`.
2. Earlier beam with random relocation and uniqueness priority: 34-clue medium `1/2`, score average `1120`, p95 `1525.813ms`.
3. Paired mutation before proposal cap: 34-clue medium `2/2`, score average `1459`, p95 `1376.139ms`; feature cache misses for one sampled successful attempt were `584`.
4. Paired mutation after proposal cap: 34-clue medium `2/2`, score average `1586`, p95 `909.713ms`; feature cache misses for one sampled successful attempt dropped to `140`.
5. 40-clue medium improved over staged in score average (`750` vs `635`) but still hit `0/2`.
6. 34-clue hard/expert score average improved over staged (`1586`/`2377` vs `1085`), but still hit `0/2`.
7. Top rejection after uniqueness-aware ranking remained `score-too-low`, not non-unique or clue-count mismatch.

Acceptance result:

Partially accepted as an offline/benchmark improvement. It passes the medium small-sample hit-rate gate for 34 clues (`+1` success versus staged-targeted) and reduces proposal overhead versus uncapped paired search. It does not pass public API promotion gates because hard/expert hit rate did not improve and p95 remains materially higher than staged-targeted.

API decision:

Do not add this to public API yet. Keep `paired-remove-restore` inside `adaptive-beam` benchmark tooling. Reconsider public exposure only if a baseline or extended workload shows medium improvement without large p95 overhead and at least one hard row improvement.

Minimum viable slice:

Benchmark-only `--strategy adaptive-beam` with one mutation family and fixed beam width.

Task breakdown:

| ID | Task | Files | Implementation | Tests |
| --- | --- | --- | --- | --- |
| P4-T1 | Define beam candidate | script-local first; later `src/generator/adaptive-beam.ts` | puzzle, solution, seed, round, features, optional rating, uniqueness, loss, history | typecheck |
| P4-T2 | Add loss breakdown | shared script utility first | score distance, clue distance, singles penalty, missing technique penalty, duplicate penalty, timeout penalty | unit-style loss samples |
| P4-T3 | Add mutations | script first | start with remove-one-clue and restore-one-clue; later symmetric pair and swap | deterministic mutation smoke |
| P4-T4 | Add beam loop | `scripts/benchmark-generator-diagnostics.mjs` | `--beam-width`, `--beam-rounds`, `--mutations-per-candidate`, `--loss-profile` | smoke benchmark |
| P4-T5 | Add cheap gate | script first using `extractGeneratorCandidateFeatures()` | no hard reject by default; only rank/prioritize | compare full rating sample |
| P4-T6 | Add final verifier | script | final uniqueness + `rate()` + constraints + optional canonicalization | no invalid success |
| P4-T7 | Add trace report | report renderer | round, mutation, loss before/after, score, rejection reason, elapsed | inspect report |

Acceptance:

1. Medium hit rate improves over `staged-targeted` by at least `+20%` relative or `+1` success on baseline.
2. At least one hard row improves over `staged-targeted`, or the strategy is explicitly limited to medium/offline pool production.
3. p95 elapsed is reported and is no more than `3x` `staged-targeted` unless marked offline-only.
4. Same seed and options produce deterministic selected result.
5. Invalid/non-unique/unsolved accepted count is `0`.

Verification:

```bash
npm run benchmark:generator-diagnostics -- --workload smoke --skip-canonicalize --strategy adaptive-beam --beam-width 4 --beam-rounds 3 --mutations-per-candidate 4 --out-dir dist/tmp/generator-eval/p4-beam-smoke
npm run benchmark:generator-diagnostics -- --workload baseline --skip-canonicalize --strategy staged-targeted --out-dir dist/tmp/generator-eval/p4-staged-targeted
npm run benchmark:generator-diagnostics -- --workload baseline --skip-canonicalize --strategy adaptive-beam --beam-width 4 --beam-rounds 3 --mutations-per-candidate 4 --out-dir dist/tmp/generator-eval/p4-beam
npm test
```

Defer / rollback:

1. If beam only improves one cherry-picked seed/source, keep it benchmark-only.
2. If p95 grows without hit-rate gain, narrow it to offline pool production.
3. If hard/expert remain poor, stop investing in online hard generation and prioritize preset/pool.

## Phase 5: Technique-Targeted Generation

Goal:

Handle hardestTechnique / requiredTechnique targets as technique-search problems, not ordinary score-search problems.

Status:

Minimum viable benchmark slice implemented and verified on 2026-06-26. Keep technique-targeted fresh generation benchmark-only; production guidance remains pool-first.

Completed tasks:

1. P5-T1: added benchmark case targets through `--required-technique` and `--hardest-technique`; case ids include the active technique constraint.
2. P5-T2: added technique loss penalties for missing required technique and hardest-technique mismatch; `--loss-profile technique` adds rewards for technique matches.
3. P5-T3: pool technique index support was already added in Phase 2 through `hardestTechniqueBuckets` and `requiredTechniqueBuckets`.
4. P5-T4: pool-first technique targeting remains documented in `GENERATOR_COOKBOOK.md` and `CANDIDATE_POOL.md`.
5. P5-T5: benchmark acceptance still requires solved, score range, clue count and technique constraints; unsolved candidates remain rejected.

Evaluation evidence:

1. Required-technique smoke: `source=pool`, `strategy=adaptive-beam`, `lossProfile=technique`, `requiredTechnique=hidden-single`, `caseLimit=2`. Easy row hit `2/2`; medium row stayed `0/2` due to `score-too-low`.
2. Hardest-technique smoke: `source=pool`, `strategy=adaptive-beam`, `lossProfile=technique`, `hardestTechnique=hidden-single`, `caseLimit=1`. Easy row hit `2/2`.
3. These runs prove the constraint and reporting path, not stable online technique targeting across medium/hard techniques.

Decision:

Do not expose public technique-targeted fresh generation. Use candidate pools for technique targets, and use the benchmark options to measure whether a future mutation operator improves technique hit rate before promoting anything.

Minimum viable slice:

Add benchmark cases and pool selection support for technique buckets before changing fresh generation.

Task breakdown:

| ID | Task | Files | Implementation | Tests |
| --- | --- | --- | --- | --- |
| P5-T1 | Add benchmark case config | `scripts/benchmark-generator-diagnostics.mjs` or fixture JSON | required technique, hardest technique set, family coverage | smoke benchmark |
| P5-T2 | Add technique loss | adaptive strategy utility | missing target technique, appears-but-not-hardest, forbidden appears, unsolved by allowed profile | loss sample rows |
| P5-T3 | Add pool technique index | candidate stats/selection files | hardestTechnique, techniqueCounts, family buckets | candidate-stats test |
| P5-T4 | Add docs | `GENERATOR_COOKBOOK.md`, `CANDIDATE_POOL.md` | technique-targeted generation is pool-first | docs diff |
| P5-T5 | Add negative guards | tests | forbidden technique and unsolved candidates cannot be accepted | `npm test` |

Acceptance:

1. Benchmark reports hit rate by technique/family.
2. Candidate pool selection fills at least one common medium/hard technique bucket in local run.
3. Fresh strategy failures include low-hit diagnostics, not silent no-match.
4. No public convenience API until pool-backed path is stable.

Verification:

```bash
npm run benchmark:generator-diagnostics -- --workload smoke --case-limit 2 --source pool --skip-canonicalize --strategy adaptive-beam --beam-width 4 --beam-rounds 3 --mutations-per-candidate 4 --loss-profile technique --required-technique hidden-single --out-dir dist/tmp/generator-eval/p5-technique-smoke
npm run benchmark:generator-diagnostics -- --workload smoke --case-limit 1 --source pool --skip-canonicalize --strategy adaptive-beam --beam-width 4 --beam-rounds 3 --mutations-per-candidate 4 --loss-profile technique --hardest-technique hidden-single --out-dir dist/tmp/generator-eval/p5-hardest-technique-smoke
npm test
```

Defer / rollback:

1. If a target technique is too rare, document it as offline-only.
2. If technique family mapping is ambiguous, keep exact `TechniqueId` only and defer family buckets.

## Phase 6: Public API Decision

Goal:

Expose only strategies that have benchmark evidence and stable semantics.

Status:

Completed on 2026-06-26 as a no-new-public-strategy decision.

Completed tasks:

1. P6-T1: updated `GENERATOR.md` with a dated public strategy boundary.
2. P6-T2: deferred request type changes because no benchmark-only strategy passed promotion gates.
3. P6-T3: deferred schema changes because request shape remains unchanged.
4. P6-T4: deferred CLI mode changes; existing `generate`, `search`, candidate pool and benchmark scripts remain the supported split.
5. P6-T5: documented exact semantics and limits: online `generateOne()` is best-effort for hard targets; stable medium/hard/expert and technique targeting are pool-first.
6. P6-T6: compatibility is preserved because no public request fields were added.

Decision:

Expose no new public generation strategy in this update. Keep `generateOne()` behavior unchanged. Keep `preset-transform`, `staged-targeted`, `adaptive-beam` and technique loss as benchmark/tooling paths until separate evidence shows stable hit-rate gains and acceptable p95.

Minimum viable slice:

Make a yes/no API decision document before changing `GenerationRequest`.

Candidate public surface only if prior phases pass:

```ts
type GenerationMode =
  | 'default'
  | 'pool'
  | 'preset-transform';
```

Possible request shape only after API review:

```ts
interface GenerationRequest {
  mode?: 'default' | 'pool' | 'preset-transform';
  difficultyLabel?: 'easy' | 'medium' | 'hard' | 'expert';
  presetPool?: PresetPuzzleSeed[];
}
```

Task breakdown:

| ID | Task | Files | Implementation | Tests |
| --- | --- | --- | --- | --- |
| P6-T1 | Write API decision | new docs note or update `GENERATOR.md` | promote/defer each strategy with benchmark links | docs review |
| P6-T2 | If exposing, update request type | `src/generator/index.ts` | add fields and validation; default stays unchanged | typecheck/tests |
| P6-T3 | If exposing, update schema | `src/schema/index.ts`, docs | generation request/result schema fields | schema tests |
| P6-T4 | If exposing, update CLI | `src/cli/index.ts` | parse mode/difficulty/preset pool | CLI smoke |
| P6-T5 | Update user docs | `README.md`, `GENERATOR.md`, `GENERATOR_COOKBOOK.md` | exact semantics, limits, examples | docs diff |
| P6-T6 | Add compatibility tests | `tests/run-tests.ts`, examples | old requests still pass; unknown fields still rejected as expected | `npm test` |

Acceptance:

1. Public docs say difficulty labels are broad and best-effort unless pool/preset-backed.
2. Existing `generateOne()` requests continue to behave the same.
3. Unknown field validation remains consistent.
4. Schemas and examples match runtime behavior.
5. `adaptive-beam` is not public unless it has clear hit-rate evidence and acceptable p95.

Verification:

```bash
npm run typecheck
npm test
npm run examples:typecheck
npm run smoke:dist
npm run smoke:cli
```

Defer / rollback:

1. If API semantics are unclear, publish docs/CLI workflow only and keep runtime API unchanged.
2. If benchmark evidence is weak, expose no new public strategy.

## Priority Order

1. P0: lock benchmark workloads.
2. P1: preset puzzle transform prototype.
3. P2: candidate pool production workflow.
4. P3: target-aware staged removal.
5. P4: adaptive beam search.
6. P5: technique-targeted generation.
7. P6: public API decision.

Reason:

1. Preset transform and candidate pools solve user latency sooner than fresh hard generation.
2. Staged/beam work is valuable, but mostly as an offline pool producer until proven otherwise.
3. Public API should follow evidence, not lead it.

## Release Boundary

Safe now:

1. Keep `generateOne()` behavior unchanged.
2. Keep experimental strategies inside benchmark scripts.
3. Document generator targeting as best-effort.
4. Recommend candidate pools for hard / expert / narrow score ranges.
5. Publish diagnostics and benchmark tooling as development evidence.

Not safe yet:

1. Public `generationStrategy: 'adaptive-loss'` or `adaptive-beam`.
2. Public promise of real-time hard/expert generation.
3. Built-in preset puzzle database without provenance policy.
4. Heuristic hard rejection in production generation.
5. Uniqueness engine rewrite without harder benchmark evidence.

## Immediate Next Tasks

1. Design stronger mutation operators before revisiting public `adaptive-beam`: symmetric pair swap, house-aware relocation scoring, paired remove/restore with uniqueness-aware pruning, and checkpoint-informed branch seeds.
2. Add a dedicated candidate-pool benchmark if pool production throughput or duplicate rate becomes a release blocker.
3. Keep P2-T1 manifest metadata expansion as a follow-up only if pool resume/reporting needs it.
4. Decide whether structural preset transforms require rating-invariant solver ordering or per-transform rating metadata.
5. Keep public API unchanged until a future strategy beats staged baseline on hit rate and p95 in the same workload.
