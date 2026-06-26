# Generator and Canonical Review Plan

本文档用于规划并记录两项发布前复核工作：

1. 对照多个同类开源项目，评估 classic9 生成器是否能更快命中指定难度级别或分数范围。
2. 复核 `canonical.classic9.v1` 是否完整覆盖标准 9x9 数独的等价变换规则，重点验证有唯一解题面的 canonical key 稳定性。

本文不要求复制外部源码。外部项目只作为算法和产品边界参考；任何实现都必须独立重写，并遵守 license 边界。

## Review Status

状态：completed for 0.5.0 release decision

完成项：

1. M1 external research matrix：已覆盖 QQWing、sudoku-gen、go-sudoku、Tdoku、Sudoku Explainer、dachev/sudoku 和 Radcliffe/sudoku-generator。
2. M2 local generator benchmark：已新增 `scripts/benchmark-generator-targets.mjs` 和 npm script `benchmark:generator-targets`，可复跑 small-sample target difficulty / score hit rate。
3. M3 canonical equivalence audit：已新增 `scripts/audit-canonical-equivalence.mjs` 和 npm script `audit:canonical-equivalence`，覆盖随机等价变换、rotations/mirrors、空盘、单线索和 reference rating corpus rows。
4. M4 decision note：本文已给出 0.5.0 发布结论和后续优化清单。

发布结论：

1. 当前 generator 不应承诺“短时间稳定命中任意指定难度级别或窄 score range”；它应继续承诺 best-effort、diagnostics、`search()` 和候选池 workflow。
2. 默认 `solutionSource = "transform-fixed"` 行为未被新增 benchmark/audit 改变；`random-backtracking` 和 `pool` 是 opt-in。
3. `canonical.classic9.v1` 的变换集合与标准 9x9 Sudoku preserving transformations 对齐；新增 audit 用 reference rating corpus 的唯一解题面验证 key 在随机结构变换和几何变换下稳定。
4. 本复核不阻塞 0.5.0；后续优化应进入 generator throughput / preset pool / uniqueness counter backlog，而不是在 0.5.0 前扩大默认承诺。

新增可复跑命令：

```bash
npm run benchmark:generator-targets -- --attempts 3 --case-limit 4 --max-elapsed-ms 1000 --json
npm run audit:canonical-equivalence -- --max-rows 68 --transforms-per-row 6 --json
```

轻量 smoke 命令：

```bash
npm run benchmark:generator-targets -- --attempts 2 --case-limit 2 --max-elapsed-ms 1000 --json
npm run audit:canonical-equivalence -- --max-rows 1 --transforms-per-row 1 --json
```

## Current classic9 Baseline

### Generator

当前 classic9 生成器主路径：

1. `analyzeGenerationRequest()` 检查请求是否合法或明显低命中率。
2. `SolutionGridFactory` 生成完整终盘。
3. `ClueRemover` 按线索目标和可选对称性挖洞。
4. `checkUniqueness()` 保证唯一解。
5. 可选 `PuzzleMinimizer` 做严格最小化。
6. `rate()` 用目标 rating policy 评分。
7. 用 score、clues、required / forbidden / allowed techniques 过滤。
8. 失败时保留 `bestCandidate` 作为诊断，不作为合格题面。

当前 solution source：

| Source | 当前用途 | 优点 | 风险 |
| --- | --- | --- | --- |
| `transform-fixed` | 默认；从固定终盘做数字、行列、band/stack、转置变换 | 极快、seed 稳定、适合 smoke 和候选池 | 终盘多样性局限于一个等价类；对难度命中率帮助有限 |
| `random-backtracking` | 显式 opt-in；随机回溯生成完整终盘 | 终盘多样性更好 | 仍需后续挖洞和 rating rejection；不保证短时间命中特定难度 |
| `pool` | 显式 opt-in；从外部终盘池抽取 | 可以接入经过筛选的原创/许可终盘 | pool provenance、license、质量由调用方负责 |

当前最核心问题不是“能否生成唯一解题面”，而是“能否在短时间内命中指定难度级别或 score range”。目前仍主要依赖 rejection sampling：先生成候选，再评分过滤；对窄分数区间、高级技巧、指定 hardest technique 的请求，命中率可能很低。

### Canonical

当前 `canonicalizeBoard()`：

1. 枚举 `transposed = false / true`。
2. 枚举行 band 顺序和 band 内 row 顺序，共 `3! * (3!)^3 = 1296`。
3. 枚举列 stack 顺序和 stack 内 col 顺序，共 `1296`。
4. 对每个 cell transform，用“首次出现数字映射到 1、下一新数字映射到 2...”得到该 transform 下的最小 digit relabeling。
5. 选择 lexicographically smallest 81 位 key。

当前 fast path：

1. 空盘直接返回 81 个 `0` 和 identity transform。
2. 单线索题面直接把唯一 clue 放到最后一格并映射为 `1`。

当前 `canonicalizePair()` 不用 solution 决定 canonical transform，只按 puzzle canonical transform 同步变换 solution。对 solution 不完整、与 clue 不匹配或自身重复的情况，返回 warning 和 best-effort 结果。

## External Generator Projects To Review

优先对照多个项目，而不是只选一个。调研目标是找出能提高“短时间命中特定难度或范围”的思路。

| Project | Source | 重点观察 | 初步判断 |
| --- | --- | --- | --- |
| QQWing | <https://qqwing.com/> / <https://qqwing.com/qqwing-main.js.html> | 随机解完整空盘、回滚非猜测 givens、逐格移除并用 solution count 保唯一；支持 difficulty 和 symmetry；difficulty 基于求解历史中 singles、hidden singles、pairs、box-line、guess 等事件 | 值得参考“生成后按 difficulty 过滤”和“对称挖洞”产品边界；difficulty 档位较粗，不适合直接替代 classic9 score |
| sudoku-gen | <https://github.com/petewritescode/sudoku-gen> | 以已知 solvable seed puzzle 做大规模等价变换，提供 easy / medium / hard / expert；强调实时生成 | 适合参考“预筛 seed + 等价变换”的高速路径；更像 preset transform，不解决新题难度搜索 |
| go-sudoku | <https://github.com/eliben/go-sudoku> | 生成唯一解题面、支持对称题面；README 明确 hard puzzle 通常要大量生成后筛选，难题可通过等价变换复用 | 和 classic9 当前路线高度一致；适合参考离线 hard seed pool + transform replay |
| Tdoku | <https://github.com/t-dillon/tdoku> | 高性能 solver / generator / benchmark；重点是快速唯一性和困难题求解性能 | 适合参考 uniqueness/search 内核和 benchmark 设计；不适合直接移植 C/C++ SIMD 实现 |
| Sudoku Explainer | <https://sourceforge.net/projects/sudoku-explainer/> | 以 human solving / rating 为核心；项目说明承认生成 basic human puzzles 可行，但 difficult Sudoku 生成很慢，really hard 主要靠机会 | 适合校准预期：强 human-rating 目标通常难以实时保证 |
| dachev/sudoku | <https://github.com/dachev/sudoku> | Node/Web generator、solver、ratepuzzle；GPL | 只做行为参考，避免代码级复用；可观察轻量 npm 用户对 generator/rating API 的期望 |
| Radcliffe/sudoku-generator | <https://github.com/Radcliffe/sudoku-generator> | 生成带 difficulty 的 puzzle database，README 说明不能直接指定 difficulty / clue count，只能生成后过滤 | 支持“离线生成数据库 + 在线筛选”路线判断 |

## Completed External Project Matrix

| Project | License / reuse boundary | Generation source | Difficulty targeting | Real-time suitability | classic9 decision |
| --- | --- | --- | --- | --- | --- |
| QQWing | GPL; do not copy code into MIT package | Generates full solution, removes clues, counts solutions, supports symmetry | CLI supports `--difficulty`, but difficulty is based on its own solve stats and generated-filter loop | Good for coarse labels; not a proof of narrow classic9 score targeting | Borrow only product ideas: symmetry options, clear stats, generate-and-filter wording |
| sudoku-gen | MIT; implementation can be studied, but seed data provenance still matters | Starts from known solvable seed puzzles and applies equivalence transforms | User requests `easy` / `medium` / `hard` / `expert`; each seed already carries label | Excellent for online label-based generation | Strong candidate for future `preset puzzle seed transform`; not a replacement for fresh score search |
| go-sudoku | BSD-style license in repo; implementation can be studied | Generates unique puzzles and symmetrical boards | README explicitly says genuinely hard boards are best found by generating many and sifting, then transforming hard seeds | Good for online ordinary puzzles; hard targeting is offline-first | Confirms classic9 should recommend candidate pools for hard/narrow targets |
| Tdoku | MIT; C/C++ SIMD implementation not directly portable to TypeScript | Generator driven by customizable loss function and high-performance solver evaluation | Loss weights can drive clue count and hardness proxies | Strong offline generator / solver benchmark model | Reference for optimized uniqueness/search and loss-function generation, not for 0.5 default JS path |
| Sudoku Explainer | GNU LGPL; do not copy code | Human-solver/rating-centered generator | Project page says basic human puzzles are generated, difficult puzzles take ages, really hard puzzles are by chance | Not suitable as real-time hard generator | Calibrates expectation: strong human-logic targeting is expensive |
| dachev/sudoku | GPL-3.0; do not copy code into MIT package | Node/Web `makepuzzle`, `solvepuzzle`, `ratepuzzle` | Rating API exists, no strong target-generation guarantee in README | Useful simple API expectation reference | API comparison only |
| Radcliffe/sudoku-generator | MIT; implementation can be studied | Random generation into a database with clues and difficulty fields | README says difficulty/clue count cannot be specified during generation, only filtered afterward | Offline database-first | Confirms offline generate/filter/store workflow for target ranges |

Research synthesis:

1. Projects that look fast for difficulty labels usually rely on preset / seed transformation, not on fresh human-rating search.
2. Projects that generate fresh unique puzzles usually use generate-and-filter for difficulty; hard or narrow target generation is explicitly expensive or offline.
3. Tdoku is the strongest evidence that adaptive loss functions and faster solution counting can help, but adopting that direction in TypeScript requires a separate design and benchmark, not a patch to current `generateOne()`.
4. For classic9, the practical near-term optimization is workflow-level: generate more candidates, keep `canonicalKey` and rating metadata, then select by score bucket / technique target.

## Generator Review Questions

### Product Questions

1. `generateOne()` 是否需要承诺“指定 difficulty / score range 短时间命中”，还是只提供 best-effort + diagnostics？
2. 对窄 score range，是否应该默认建议 `search()` / candidate pool，而不是单次 `generateOne()`？
3. 是否需要公开 preset / seed pool 机制，提供快速返回已验证题面的路径？
4. 是否应该把“difficulty label” 和 “score range” 分开处理：前者可用预筛池，后者继续 rating rejection？
5. 是否应支持“hardest technique target” 专门路径，而不是把它塞进普通 required technique？

### Algorithm Questions

1. 当前挖洞是直接按 clue target 尝试，是否需要引入 staged removal：先快速达到大致 clue range，再用 rating feedback 调整？
2. 当前每次候选都完整 rating，是否能增加 cheap prefilter：clue count、singles-only score、basic-profile score、candidate density、givens distribution？
3. 是否需要缓存同一 solution grid 的 uniqueness / rating 中间结果？
4. 是否要把 `transform-fixed` 明确升级成 preset-transform 路径：输入已验证 puzzle seed，而不仅是 solution seed？
5. 是否需要提供“离线构建候选池 -> canonical 去重 -> 在线按 difficulty 抽取”的推荐 workflow？
6. `random-backtracking` 终盘多样性是否真正提高目标难度命中率，还是只是提高 canonical key 多样性？
7. 是否需要独立 optimized uniqueness counter，降低 rejection sampling 的主要成本？

## Generator Experiment Plan

### External Project Matrix

为每个外部项目填写：

| Field | Required Notes |
| --- | --- |
| License | 是否允许参考；是否禁止复制代码进入 MIT 包 |
| Generation source | fixed seed transform、random full grid、database/pool、hybrid |
| Hole removal | one-by-one、symmetric pair removal、constructive givens、unknown |
| Uniqueness check | full solution count、limit-to-two、solver status、unknown |
| Difficulty model | clue count、human solver history、score buckets、database label、none |
| Targeting strategy | generate-and-filter、preset by difficulty、offline database、adaptive |
| Real-time suitability | 在线实时、离线预计算、混合 |
| classic9 adoption candidate | yes / maybe / no |

Status: completed in [Completed External Project Matrix](#completed-external-project-matrix).

### Local Benchmarks

先做小样本，避免把调研变成长时间搜索任务。

1. `transform-fixed` vs `random-backtracking` vs `pool`。
2. 每种 source 使用相同 constraints：
   - clue target: 40、34、30、26。
   - score ranges: easy-ish、medium-ish、hard-ish、expert-ish，范围先按当前 `classic-stable` / `classic-galaxy` 实际分布定义。
   - budget: `maxAttempts = 50 / 100`，`maxElapsedMs = 3000 / 5000`。
3. 记录：
   - success rate。
   - median / p95 elapsedMs。
   - rejection reasons。
   - score distribution。
   - hardestTechnique distribution。
   - canonical unique key count。
   - uniqueness elapsed / nodes if available。
4. 对 `search()` 再测：
   - fixed total attempt budget 下的 accepted count。
   - score bucket fill rate。
   - duplicate canonical key rate。
   - candidate selection 后保留率。

Status: implemented by `scripts/benchmark-generator-targets.mjs`.

Small-sample evidence:

```bash
npm run benchmark:generator-targets -- --attempts 3 --case-limit 4 --max-elapsed-ms 1000 --json
```

Observed result on 2026-06-25 local run:

1. `clues-40-easy` succeeded for all three sources: `transform-fixed` 3/3, `random-backtracking` 3/3, `pool` 3/3.
2. `clues-40-medium`, `clues-40-hard` and `clues-40-expert` had 0/3 success for all three sources.
3. All failed medium / hard / expert rows rejected by `score-too-low`; sampled 40 clue puzzles clustered around score `610..620`.
4. Each source produced distinct canonical keys in this sample.
5. `random-backtracking` and `pool` did not change the default behavior, and did not by themselves solve narrow score targeting.

Interpretation:

1. The generator can produce ordinary easy unique puzzles quickly.
2. Targeting a higher score band with the same clue target remains a rejection problem.
3. `solutionSource` improves terminal-grid diversity and external data integration, but does not replace candidate search, preset puzzle seeds, or adaptive scoring.

### Candidate Optimizations To Evaluate

| Optimization | Hypothesis | Gate |
| --- | --- | --- |
| Preset puzzle seed transform | 对常见 difficulty label 可毫秒级返回 | 必须有原创或明确许可 seed；记录 canonical key、rating policy/version、score、solution |
| Offline candidate pool workflow | 对窄 score range 比在线 rejection 更可靠 | 文档和 CLI workflow 足够清楚；不把 pool 打进 npm 包 |
| Cheap prefilter before full rating | 降低明显不合格候选成本 | 不得误拒可能合格候选，或只能作为 opt-in heuristic |
| Symmetric removal improvements | 提升美观度但可能降低命中率 | symmetry request 下保持唯一性和 score audit |
| Optimized uniqueness counter | 降低每次挖洞验证成本 | benchmark 显示 p95 改善，且 solution count 语义不变 |
| Adaptive removal based on rating feedback | 更快靠近目标 score | 需要实验，不先进入 0.5.0 默认路径 |

## Canonical Equivalence Review

### Equivalence Rules To Confirm

标准 9x9 数独保结构变换通常包括：

1. 数字重命名：`9!`。
2. band 置换：`3!`。
3. band 内 row 置换：`(3!)^3`。
4. stack 置换：`3!`。
5. stack 内 column 置换：`(3!)^3`。
6. 转置、反射、旋转的几何对称：额外因子 `2`；其它旋转/镜像可由转置加上述 row/column 置换组合得到。

参考资料：

1. Mathematics of Sudoku 对等价网格列出的 preserving symmetries：<https://encyclopedia.pub/entry/29043>
2. Rust `sudoku` crate 的 `shuffle()` 文档列出 relabel、band/stack、row/column、transpose，并说明其它 rotations / mirrorings 可组合得到：<https://docs.rs/sudoku/latest/sudoku/board/struct.Sudoku.html>
3. Sudopedia canonical form 说明 canonicalized forms 应能用于比较数学等价 Sudoku：<https://sudopedia.enjoysudoku.com/Canonical_Form.html>

### Current Completeness Hypothesis

对标准 9x9 题面，classic9 当前枚举：

```text
2 * (3! * (3!)^3) * (3! * (3!)^3)
```

再加每个 cell transform 下的 canonical digit relabeling。这个集合应覆盖标准 Sudoku 等价变换规则的 cell permutation 部分；digit relabeling 由首次出现顺序生成最小映射，不需要显式枚举 `9!`。

需要验证的关键点：

1. `transposed` 加 row/column structural orders 是否确实覆盖所有 rotations 和 reflections。
2. 对部分题面，首次出现 digit relabeling 是否等价于枚举所有 digit permutations 后取最小 key。
3. 空盘 / 单线索 fast path 是否与完整枚举结果一致。
4. 对有唯一解题面，canonical key 是否只由 givens 决定，且与 solution 的等价变换一致。
5. 对 automorphic puzzles，返回任一最小 transform 都可接受，但 key 必须稳定。

### Canonical Test Plan

#### Property Tests

对 release smoke corpus、reference rating corpus、生成器产物和少量手工边界题执行：

1. 生成随机 digit relabel。
2. 随机 band / stack 置换。
3. 随机 band 内 row / stack 内 col 置换。
4. 随机选择 transpose。
5. 显式构造 rotations / mirrorings，并验证它们可被 canonical key 吸收。
6. 对每个 transformed puzzle 验证：
   - `canonicalizeBoard(transformed).key === canonicalizeBoard(original).key`
   - `canonicalizePair(transformedPuzzle, transformedSolution).key` 一致
   - transformed solution 经 pair canonical transform 后保持合法完整终盘
   - warning 为空，前提是 original solution 正确完整

#### Exhaustive Small Scope Checks

1. 空盘：fast path key 与完整枚举应一致，transform 固定 identity 是有意行为。
2. 单线索：对 81 * 9 个单线索题，key 应全部为 `80 zeros + 1`。
3. 完整终盘：对同一 solution grid 的随机等价变换 key 应一致。
4. 近最小线索题：选若干 17-25 clue 唯一解题面做变换闭包抽样。
5. Automorphism candidate：如果找到自同构题面，key 一致即可；transform 不要求唯一。

#### Cross-Implementation Checks

如时间允许，用外部 canonical 实现或资料做交叉验证：

1. Rust `sudoku` crate 的 canonicalized output 只做参考，不把输出格式作为 classic9 contract。
2. 任一 cross-check 只能用于发现问题；classic9 的 `canonical.classic9.v1` key 不因外部格式不同而改变。
3. 如果发现 classic9 漏掉标准等价变换，需要升级 canonical version，而不能静默改变 `v1` key。

Status: implemented by `scripts/audit-canonical-equivalence.mjs`.

The audit checks:

1. Empty board identity transform.
2. All `81 * 9 = 729` single-clue boards have key `80 zeros + 1`.
3. For each selected reference rating corpus row, `canonicalizePair(puzzle, solution)` emits no warning.
4. For identity, rotate90, rotate180, rotate270, horizontal mirror and vertical mirror transforms, canonical key remains stable.
5. For sampled random transforms using row/band, col/stack, transpose and digit relabel, canonical key remains stable.
6. Transformed pair solution remains a legal complete board after pair canonical transform.

Smoke evidence:

```bash
npm run build
node scripts/audit-canonical-equivalence.mjs --max-rows 1 --transforms-per-row 1 --json
```

Observed result on 2026-06-25 local run:

1. `rowsChecked = 1`
2. `randomTransformsChecked = 1`
3. `geometryTransformsChecked = 6`
4. `singleClueBoardsChecked = 729`
5. `failures = []`

Full release-audit command:

```bash
npm run audit:canonical-equivalence -- --max-rows 68 --transforms-per-row 6 --json
```

Observed full-audit result on 2026-06-25 local run:

1. `rowsChecked = 68`
2. `randomTransformsChecked = 408`
3. `geometryTransformsChecked = 408`
4. `singleClueBoardsChecked = 729`
5. `failures = []`
6. `warnings = []`
7. `passed = true`

Interpretation:

1. The implemented transform set matches the standard preserving transformation generators: digit relabel, row-in-band, band, column-in-stack, stack and transpose.
2. Rotations and mirrors do not require extra primitive flags because they can be generated by transpose plus row/column structural permutations.
3. For uniquely solved puzzles, `canonicalizeBoard()` should remain puzzle-driven; using the solution to tie-break would be a separate API and would change current v1 semantics.
4. If a future full audit finds a mismatch, the fix must either preserve existing v1 keys or introduce `canonical.classic9.v2`.

## Proposed Work Breakdown

### M1 Research Matrix

Deliverable:

1. 完成外部项目矩阵。
2. 标出 license 风险。
3. 明确哪些思路可借鉴，哪些只能作为预期校准。

Acceptance:

1. 至少覆盖 QQWing、sudoku-gen、go-sudoku、Tdoku、Sudoku Explainer 五个项目。
2. 每个项目都说明是否支持指定 difficulty，以及是实时命中还是生成后过滤。

Status: completed.

### M2 Local Generator Benchmark

Deliverable:

1. 生成器小样本 benchmark 报告。
2. 比较 `transform-fixed`、`random-backtracking`、`pool`。
3. 输出 target score / difficulty 命中率和失败原因。

Acceptance:

1. benchmark 命令可复跑。
2. 报告不使用单机耗时作为公开性能承诺。
3. 明确是否需要在 0.5.0 前改 generator 默认行为。

Status: completed.

Decision: no default generator behavior change is required before 0.5.0. Keep `transform-fixed` as default; document target difficulty as best-effort; recommend `search()` and candidate pools for narrow ranges.

### M3 Canonical Equivalence Audit

Deliverable:

1. 新增 canonical property test 或 audit script。
2. 覆盖随机等价变换、rotations/mirrors、唯一解题面 pair canonical。
3. 输出是否保持 `canonical.classic9.v1` 的结论。

Acceptance:

1. 对 reference rating corpus 的所有唯一解题面，随机变换后 key 稳定。
2. `canonicalizePair()` 对正确 solution 不产生 warning。
3. 若发现 key 变更需求，必须改为 v2 设计，不修改 v1 结果。

Status: implemented; full corpus command is available and should be treated as a heavy release audit.

Decision: `canonical.classic9.v1` can remain unchanged unless the full audit finds mismatches.

### M4 Decision Note

Deliverable:

1. 发布前结论：0.5.0 是否可以按当前 generator/canonical contract 发布。
2. 后续优化 issue 列表。
3. 如果 generator 难度命中率不足，给出推荐使用方式：offline candidate pool / preset transform / wider score bucket / relaxation。

Acceptance:

1. 结论能回答“短时间生成指定难度是否可靠”。
2. 结论能回答“有唯一解题面的 canonical 是否完整覆盖等价变换”。
3. 每个不确定项都有后续实验或 issue，而不是停留在口头判断。

Status: completed.

Decision:

1. Short-time generation of a broad easy band is practical; short-time generation of arbitrary narrow score ranges is not a reliable contract.
2. For unique-solution puzzles, the canonical method implements the standard equivalence transform generators and now has a dedicated audit script.
3. Follow-up optimization items are preset puzzle seed metadata, offline candidate pool workflow, optimized uniqueness counter and adaptive generation.

## Release Impact

### Does This Block 0.5.0?

默认不阻塞，除非 M3 发现 `canonical.classic9.v1` 对标准等价变换不稳定，或 M2 发现当前 generator 新增 source 会破坏默认行为。

### Must Fix Before Publishing

1. 如果 canonical property test 发现同一唯一解题面的等价变换 key 不一致，必须先修或明确升级 canonical version。
2. 如果 `random-backtracking` 或 `pool` 影响默认 `transform-fixed` 行为，必须先修。
3. 如果文档声称“指定难度短时间生成”但 benchmark 不支持，必须改文档，不能夸大承诺。

### Can Defer

1. 高性能 uniqueness counter。
2. preset seed pool。
3. adaptive generation by target score。
4. cross-implementation canonical output 对齐。
5. UI-facing difficulty labels。
