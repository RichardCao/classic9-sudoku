# Classic9 Implementation Status and BUG Research

本文档把当前技巧实现状态、一次外部资料调研和后续项目推进计划收口到同一处。它不替代 [TECHNIQUES.md](./TECHNIQUES.md)、[CLASSIC9_NEXT_TASK_PLAN.md](./CLASSIC9_NEXT_TASK_PLAN.md) 或 [CLASSIC9_UNIMPLEMENTED_TECHNIQUE_COMPLETION_PLAN.md](./CLASSIC9_UNIMPLEMENTED_TECHNIQUE_COMPLETION_PLAN.md)，而是作为下一轮执行时的工作台。

## Current Technique Baseline

当前 `getTechniqueDefinitions()` 暴露 90 个技巧定义，其中 60 个 `stable`、30 个 `experimental`。

0.4.0 release baseline: `audit:coverage` 当前要求 90 个技巧定义全部具备 real-board rating corpus 覆盖；stable missing rating corpus 为 0，experimental missing rating corpus 为 0。下面的外部调研和扫描记录保留为历史推进日志，旧段落中的 37 / 40 / 42 / 59 等 coverage 数字不是当前状态。

| Family | Total | Stable | Experimental | Current read |
| --- | ---: | ---: | ---: | --- |
| `single` | 3 | 3 | 0 | 基础单数完整，`full-house` / `hidden-single` 已有 house subtype evidence。 |
| `intersection` | 3 | 1 | 2 | `locked-candidates` stable；direct pointing / claiming 已实现但保持 experimental。 |
| `subset` | 8 | 6 | 2 | naked / hidden pair/triple/quad stable；direct hidden pair / triplet experimental。 |
| `fish` | 14 | 9 | 5 | 主流 fish、finned / sashimi 主线 stable；finned Franken、larger fish、mutant fish 仍 experimental / partial。 |
| `wing` | 6 | 5 | 1 | XY / XYZ / WXYZ / W-Wing / Chute Remote Pairs stable；Remote Pairs experimental。 |
| `als` | 12 | 9 | 3 | ALP / ALT / ALS-XZ / ALS-XY / APE / Fireworks / Twinned XY / Death Blossom / Sue-de-Coq stable；ALQ / AIC-ALS / Big Wings experimental。 |
| `coloring` | 5 | 4 | 1 | Simple / X / Multi Colors / 3D Medusa stable；Bidirectional X-Cycle 作为 SE 命名入口 experimental。 |
| `chain` | 7 | 5 | 2 | X-Chain / XY-Chain / AIC / AIC-Exotic / Grouped AIC stable；Bidirectional Y-Cycle 和 Forcing Chain experimental。 |
| `single-digit-chain` | 6 | 5 | 1 | Grouped X-Cycles、Skyscraper、Two-String Kite、Turbot Fish、Empty Rectangle stable；Forcing X-Chain experimental。 |
| `pattern` | 5 | 5 | 0 | Exocet、Double Exocet、Pattern Overlay、Tridagons、SK Loops 已 stable，但真实题面仍偏少。 |
| `forcing` | 11 | 1 | 10 | Nishio stable；其余 forcing / dynamic / nested / table / Bowman 保持 experimental，proof tree 仍 partial。 |
| `uniqueness` | 10 | 7 | 3 | UR / AR / Rectangle / HUR / AIC-UR / BUG+1 stable；Unique Loop、BUG+2、BUG+n experimental / partial。 |

Current gates:

| Gate | Current value |
| --- | --- |
| Reference smoke | 213 rows: direct 13、fish 15、chains 41、wings 7、ALS 11、patterns 5、uniqueness 28、negative 93 |
| Real-board rating corpus | 68 rows，覆盖 90/90 public `TechniqueId` |
| Main current gap | public 技巧 id 级别真实题面覆盖已清零；后续风险集中在 subtype 完整性、proof compression、negative guard、性能预算和 experimental 技巧是否可晋升 stable |

## Research Target: Complete BUG Family

选择 BUG family 作为本轮外部调研目标，原因：

1. 当前 active queue 已经停在 BUG candidate graph proof model。
2. `bug-plus-one` 已 stable，但 `bug-plus-two` / `bug-plus-n` 仍 experimental。
3. `BUG Lite` 仍 missing，broader BUG eliminations 只有 evidence node 设计，没有 finder/action。
4. BUG 类依赖唯一解假设，误删风险高，必须先明确 proof model、negative guard 和真实题面来源。

### External Sources Reviewed

| Source | URL | Notes saved for later |
| --- | --- | --- |
| HoDoKu Unique Rectangles page | <https://hodoku.sourceforge.net/en/tech_ur.php> | HoDoKu 把 BUG 归在 uniqueness family 下，并给出 `bug101`、`bug102` 等候选态示例。当前仓库已经把 `bug101` 作为 BUG+1 trusted smoke，把 `bug102` 作为 parity no-hit guard。 |
| Sudopedia BUG page | <https://www.sudopedia.org/wiki/Bivalue_Universal_Grave> | BUG 的核心目标是识别“除少量 extra 外全盘 bivalue，移除 extra 后会形成 deadly multi-solution pattern”的结构；用唯一解假设推出 placement 或 elimination。 |
| SudokuWiki BUG solver page | <https://www.sudokuwiki.org/BUG> | 页面提供 BUG/BUG+1 解释和多条 exemplar puzzle URL。已保存 puzzle-string leads，后续用 corpus search 脚本复核是否形成 full rating path。 |
| DailySudoku / BrainBashers BUG+1 note | <http://www.dailysudoku.com/sudoku/forums/viewtopic.php?p=23050> | 讨论指向 BrainBashers 2008-10-08 和 2009-02-17 的 BUG+1 场景，记录了中途候选删除线索；只能作为外部候选态来源线索，不直接导入 corpus。 |
| BUG Lite explanation page | <https://sudoku.allanbarker.com/sweb/general.htm> | BUG Lite 不要求全盘都是 BUG base，而是在局部 cluster 中形成 BUG-like subgraph；最终实现应是 graph/proof family，不应简单套用现有 `bug-plus-n` shared-extra 规则。 |

### Final Implementation Target

BUG family 的最终目标不是只补一个 finder，而是形成一个可审计 BUG candidate graph：

| Subtarget | Required end state |
| --- | --- |
| BUG base graph | 从当前候选态构造 base graph：移除 declared extras 后，每个参与格必须 bivalue；每个 digit 在每个相关 house 中应满足 0/2 或被 subtype 证明的 parity invariant。 |
| Extra classification | 明确区分 BUG+1 placement、BUG+2 common-extra elimination、BUG+2 non-common parity elimination、BUG+n shared / mixed extras、BUG Lite local cluster 和 broader elimination variants。 |
| Proof evidence | 所有 BUG 步骤必须输出 `bug-base`、`bug-extra`，并根据结论输出 `bug-parity-*`、`bug-extra-group:*`、`bug-common-extra-targets` 或 `bug-elimination-targets`。 |
| Action safety | 对 elimination 必须证明目标不是 solution digit；对 placement 必须证明不会把普通 single / simpler technique 抢占成 BUG。 |
| Negative coverage | 至少覆盖 extra 不一致、base graph broken、无共同 target、target parity proof missing、budget exceeded、solution digit deletion、BUG+1 placement 不误报 elimination、BUG Lite 不误标 BUG+n。 |
| Real-board corpus | BUG+1、BUG+2 common-extra、BUG+2 non-common、BUG+n、BUG Lite 至少各有一个 provenance 明确的真实题面或明确标注“只能作为 trusted candidate-state smoke”。 |
| Policy | `bug-plus-one` 继续 stable；BUG+2、BUG+n、BUG Lite 和 broader eliminations 在真实题面、proof 和性能成熟前保持 experimental。 |

## Saved External Puzzle Leads

这些题面和页面只作为调研线索保存。使用前必须跑 `find-reference-rating-candidates.mjs`、`audit-reference-rating-corpus.mjs`、`verifyStep()` 和 solution-safety check；如果 full rating path 不命中，只能作为 trusted candidate-state smoke 或文档说明，不得直接计入 real-board corpus。

| Source | Lead | Puzzle / note | Next validation |
| --- | --- | --- | --- |
| SudokuWiki BUG exemplar 1 | `sudoku.htm?bd=200400501...` | `200400501001038090030000708070002003060090005040000009004000060620300800810047000`; also saved in [BUG_EXTERNAL_LEADS.txt](./BUG_EXTERNAL_LEADS.txt) | Run under `classic-galaxy`, target `bug-plus-one`, `bug-plus-two`, `bug-plus-n`; inspect first BUG-like candidate state if full path misses. |
| SudokuWiki BUG exemplar 2 | `sudoku.htm?bd=000009004...` | `000009004000000015832000070100703060900080003060102009010000647490000000700800000`; also saved in [BUG_EXTERNAL_LEADS.txt](./BUG_EXTERNAL_LEADS.txt) | Same validation as above. |
| SudokuWiki BUG exemplar 3 | `sudoku.htm?bd=560904000...` | `560904000002003000100070080000302500090000106000040030009000600700000709056` | This string appears shorter than 81 cells from URL extraction; verify source before use. |
| SudokuWiki BUG exemplar 4 | long `S9B0...` encoded board | `S9B0b080i070d060e010c0d0c06050i0a0b0g080a0g050c0b0h04090f0h0e070r0f7q7n0u0b8i0d0n0208077n1i0e8i0b0n0r0e7q081q0g0e09080f0g0d030b0a030f0d0h0a02070e0i0g010b090c050f080d` | SudokuWiki compressed format; write decoder or manually inspect before use. |
| BrainBashers 2008-10-08 hard | <https://www.brainbashers.com/sudokuanswer.asp?date=1008&diff=6> | DailySudoku discussion says BUG+1 can place at `r5c6=8` after removing a candidate at `r2c5`. | Reconstruct puzzle and candidate state; likely trusted smoke, not full rating corpus. |
| BrainBashers 2009-02-17 hard | <https://www.brainbashers.com/sudokuanswer.asp?date=0217&diff=6> | DailySudoku discussion says BUG+1 can place at `r7c8=9` after locked candidate cleanup. | Reconstruct puzzle and candidate state; verify with current solver. |
| HoDoKu `bug101` | HoDoKu UR page | Already saved as external-source trusted BUG+1 candidate-state smoke. | Keep as smoke; still not a full rating-path row. |
| HoDoKu `bug102` | HoDoKu UR page | Already saved as trusted no-hit guard for “single trivalue but parity fails”. | Keep as no-hit; useful for BUG+1 safety. |

Validation note: running `find-reference-rating-candidates.mjs` on [BUG_EXTERNAL_LEADS.txt](./BUG_EXTERNAL_LEADS.txt) with `classic-galaxy` scanned 2 rows and matched 0 rows for `bug-plus-one`, `bug-plus-two` and `bug-plus-n`. With `--include-misses --max-misses 5`, both rows are confirmed unique and solved, but the current full rating paths are absorbed before BUG: exemplar 1 has `hardestTechnique = "wxyz-wing"` with no BUG counts, and exemplar 2 has `hardestTechnique = "finned-x-wing"` with no BUG counts. These public SudokuWiki examples therefore remain lead material for reconstructing trusted candidate states, not real-board rating corpus rows.

Local source scan note: the first 25 rows of `dist/tmp/learning/game-500-source.json` under `classic-galaxy` matched 0 rows for the direct, BUG/UR and single-digit-chain gap target groups; the first 25 rows of `dist/tmp/learning/classic9-game-500-alternatives-overused-gt-4/input-filtered-sorted.json` also matched 0 rows for the same groups and took about 64 seconds per target group. Future broad scans should use `--max-elapsed-ms` and persist output to `dist/tmp` before expanding the budget.

Gap audit tooling note: [audit-reference-gaps.mjs](../scripts/audit-reference-gaps.mjs) now wraps the candidate search across grouped target families and multiple sources. It writes one detail file per `group/source` plus `summary.json` under `dist/tmp/reference-gap-audit` by default, skips missing local candidate pools, excludes the existing rating corpus when available, and keeps elapsed / row / miss budgets explicit.

Latest small-budget gap audit: running `node scripts/audit-reference-gaps.mjs --group direct,uniqueness,chain,als-fish-wing --max-puzzles 10 --max-elapsed-ms 5000` scanned 120 candidate rows across 20 `group/source` runs and matched 3 rows. All 3 matches came from `als-fish-wing` on `dist/tmp/learning/classic9-game-500-alternatives-overused-gt-4/input-filtered-sorted.json`: `epic-082` hit `finned-franken-swordfish`, `epic-097` hit `finned-franken-swordfish` plus `sashimi-x-wing`, and `hard-086` hit `sashimi-x-wing`. These are valid optional corpus reinforcement candidates, but they do not close the main missing gaps for direct, uniqueness/BUG, chain, Remote Pairs, Almost Locked Quad, larger/mutant fish or Big Wings.

Coverage audit tooling note: [audit-reference-coverage.mjs](../scripts/audit-reference-coverage.mjs) now reports the technique coverage matrix from `getTechniqueDefinitions()`, reference smoke and the real-board rating corpus. Current 0.4.0 baseline is 90 definitions, 60 stable, 30 experimental, 61 techniques with positive smoke coverage, 66 with negative smoke coverage and 90 with real-board rating corpus coverage. The corpus supports `targetFirstTechniques` rows for target-first discovery paths; when a row exists mainly to cover one technique, the target technique must be placed first and then revalidated by `audit-reference-rating-corpus.mjs`.

Hard-gap scan note: targeted searches for `remote-pairs,almost-locked-quad,larger-fish,mutant-fish` found 0 matches in `dist/tmp/learning/game-500-source.json` rows 1-100 and rows 101-229, and 0 matches in `dist/tmp/learning/classic9-game-500-alternatives-overused-gt-4/input-filtered-sorted.json` rows 1-8 and rows 9-50 under the current elapsed budgets. `find-reference-rating-candidates.mjs` now supports `--start-row` so later scans can continue from later chunks instead of repeatedly spending budget on the same slow prefix.

Latest corpus expansion: `stable-gaps` on `dist/tmp/learning/game-500-source.json` rows 1-24 found low-risk real-board paths and added `classic-galaxy-hidden-single-x-wing-path` plus `classic-galaxy-locked-candidates-path`, covering `hidden-single`, `x-wing` and `locked-candidates` in the rating corpus. `stable-gaps` on `dist/tmp/learning/classic9-game-500-alternatives-overused-gt-4/input-filtered-sorted.json` rows 1-15 added `classic-galaxy-naked-hidden-pair-path` and `classic-galaxy-hidden-pair-naked-triple-path`, covering `naked-pair`, `hidden-pair` and `naked-triple`. Continuing `hard-gaps` on the same overused source from row 51 scanned 51 rows before the elapsed budget and added `classic-galaxy-mutant-fish-path`. `game-500-source.json` rows 230-302 still matched 0 hard-gap rows under the same budget. Next hard-gap scan can continue around overused row 102 and game-500 row 303.

Latest scan continuation: `hard-gaps` on the overused source from row 102 scanned 41 rows and matched `epic-014`, another valid `mutant-fish` path, but it does not add new coverage beyond `classic-galaxy-mutant-fish-path`. `hard-gaps` on `game-500-source.json` from row 303 scanned 60 rows and matched 0 rows. `stable-gaps` on the overused source from row 16 scanned 15 rows and matched 10 rows, all already-covered low-risk techniques (`hidden-single`, `locked-candidates`, `naked-pair`, `hidden-pair`, `naked-triple`, `x-wing`). Next continuation points are overused hard-gap row 143, game-500 hard-gap row 363 and overused stable-gap row 31.

Forcing evidence audit note: [audit-forcing-branch-evidence.mjs](../scripts/audit-forcing-branch-evidence.mjs) now re-rates the real-board corpus and validates forcing-related proof-tree metadata. It currently finds 3 `nishio-forcing-chains` real-board steps, all with branch evidence, `assumption`, `steps`, `maxSteps`, `truncated`, `stopReason` and a localized `contradictionAt`. The Nishio exact no-solution branch now records a representative contradiction endpoint from the exhaustive branch probe instead of leaving `contradictionAt` absent.

Forcing smoke evidence gate: [audit-forcing-smoke-evidence.mjs](../scripts/audit-forcing-smoke-evidence.mjs) now validates the artificial trusted forcing smoke state across 11 forcing-style techniques, including `table-chain`, `dynamic-forcing-chains`, `dynamic-forcing-chains-plus`, `bowmans-bingo` and `nested-forcing-chains`. Current output is `Forcing smoke evidence: 11/11 fixture(s) passed`, with 16 branches, 0 truncated branches, 11 contradiction branches, fixed `evidence.pattern.family = "forcing"` subtypes, and fixed max-step budgets for the high-risk forcing variants (`table-chain=20`, `dynamic=28`, `dynamic+=40`, `bowmans=16`, `nested=18`).

BUG graph evidence note: BUG+2 common-extra, BUG+2 bounded non-common parity-elimination and BUG+n common-extra elimination steps now expose the BUG base graph as `evidence.links`. The helper emits one strong link for each house/digit that has exactly two candidates after declared extras are removed, and reference smoke now pins this with `minLinks` so future refactors cannot silently collapse BUG proof evidence back to node-only labels.

Latest gap scan after BUG graph link work: `hard-gaps` on the overused source from row 143 scanned 95 rows under the 60s elapsed budget and matched 0 rows; `hard-gaps` on `game-500-source.json` from row 363 scanned 50 rows and matched 0 rows. `stable-gaps` on the overused source from row 31 matched 5/5 rows, but their union was only already-covered `hidden-single`, `locked-candidates`, `hidden-pair` and `x-wing`, so no new corpus rows were added. Next continuation points are overused hard-gap row 238, game-500 hard-gap row 413 and overused stable-gap row 36.

BUG graph gate note: [audit-bug-graph-evidence.mjs](../scripts/audit-bug-graph-evidence.mjs) now replays the BUG reference smoke rows and validates BUG+1 parity nodes plus BUG+2 / BUG+n base strong-link evidence and target nodes. Current output is `BUG graph evidence: 5/5 BUG smoke row(s) passed`, with 2 placement rows, 3 elimination rows, 3 rows with base links and 78 total base strong links.

Latest gap scan after BUG graph gate: `stable-gaps` on the overused source from row 36 scanned 6 rows, matched 5 rows and found only already-covered `hidden-single`, `locked-candidates`, `naked-pair`, `hidden-pair` and `x-wing`; `hard-gaps` on the overused source from row 238 scanned 94 rows and matched 0 rows; `hard-gaps` on `game-500-source.json` from row 413 scanned 67 rows and matched `epic-014`, another already-covered `mutant-fish` path. `uniqueness` scans matched 0 rows in game500 rows 1-100 and overused rows 1-22; `chain` overused rows 1-22 also matched 0 rows. Next continuation points are overused hard-gap row 332, game-500 hard-gap row 480 and overused stable-gap row 42.

Latest gap scan continuation: `hard-gaps` on the overused source from row 332 scanned 100 rows and matched 0 rows; `hard-gaps` on `game-500-source.json` from row 480 scanned the remaining 21 rows and matched 0 rows. `stable-gaps` on the overused source from row 42 matched 5/5 rows, but again only already-covered `hidden-single`, `locked-candidates`, `naked-pair`, `hidden-pair` and `x-wing`. `uniqueness` from overused row 23 scanned 23 rows and matched 0 rows, `uniqueness` from game500 row 101 scanned 85 rows and matched 0 rows, `chain` from overused row 23 scanned 22 rows and matched 0 rows, and `chain` from game500 row 1 scanned 150 rows and matched 0 rows. Next continuation points are overused hard-gap row 432, overused stable-gap row 47, overused uniqueness row 46, game500 uniqueness row 186, overused chain row 45 and game500 chain row 151; game500 hard-gap has no remaining 500-bank rows under the current source.

Latest gap scan and corpus expansion: `hard-gaps` on the overused source from row 432 scanned the remaining 67 rows and matched 0 rows, so both current 500-bank hard-gap sources are exhausted under this target set. `stable-gaps` on the overused source from row 47 scanned 7 rows, found `epic-004`, and added `classic-galaxy-hidden-triple-path`, moving `hidden-triple` into the real-board rating corpus; `audit:coverage` then reported rating corpus coverage 37 and stable missing rating corpus 30. Continuing `stable-gaps` from rows 54, 61, 67, 73, 80, 86 and 91 found only already-covered `hidden-single`, `locked-candidates`, `naked-pair`, `hidden-pair`, `naked-triple` and `x-wing`. `uniqueness` from overused rows 46, 120, 219, 319 and 419 matched 0 and has exhausted the current overused source; `uniqueness` from game500 rows 186, 303, 387 and 484 matched 0 and has exhausted the current game500 source. `chain` from overused rows 45, 120, 199, 271, 371 and 471 matched 0 and has exhausted the current overused source; `chain` from game500 rows 151, 283, 339 and 413 matched 0, exhausting the current game500 source. `direct` from overused rows 26, 84, 184, 284 and 334 matched 0, and `direct` from game500 rows 26, 126, 226, 326 and 400 matched 0. Rechecking underfilled targeted samples found no full rating-path `fireworks`, `twinned-xy-chains` or `exocet`, but `fireworks` sample `expert-007` included a full `naked-quad` path and added `classic-galaxy-naked-quad-path`. A follow-up extraction from `avoidable-rectangle` / `double-exocet` learning audit rows found four validated `hidden-quad` paths and added `classic-galaxy-hidden-quad-path`. Another learning-audit candidate from `aligned-pair-exclusion:epic-017` did not reproduce APE, but did validate a full `x-coloring` path and added `classic-galaxy-x-coloring-path`; `audit:coverage` now reports rating corpus coverage 40 and stable missing rating corpus 27. Additional all-local/repo small-source scans matched 0/255, hardcap4 matched only already-covered low-tier / fish rows, `missing-epic-only` matched only already-covered low-tier / fish rows, dedicated chain / uniqueness / small ALS-pattern learning-audit replays found no additional target hits beyond `x-coloring`, and a current-code batch re-rate of 422 non-corpus learning-audit candidates found 0 remaining-missing technique hits. Next continuation points are overused stable-gap row 96, overused direct row 434 and game500 direct row 494; current overused uniqueness/BUG, current game500 uniqueness/BUG, current overused chain and current game500 chain sources are exhausted under these target groups.

Web-source expansion note: `find-reference-rating-candidates.mjs` now supports `--per-candidate-timeout-ms`, running each candidate in a worker so one expensive public puzzle cannot block a full web batch. A timeout is recorded as `missReason = "candidate-timeout"` and counted in the JSON summary. This was validated with both normal 30s worker runs and an artificial 1ms timeout. Plain-text candidate lines can also carry a source id token before the puzzle string, so web-derived hits can preserve provenance such as `hodoku:tech_chains.php:aic101` or `sudokuwiki:Unique_Rectangles`. `extract-web-sudoku-candidates.mjs` now formalizes the web extraction step for URL lists, including `bd=`, `playsudoku?p=`, common `p/puzzle/grid` query parameters, HoDoKu "Original sudoku" blocks, raw 81-character puzzle strings and forum-style 9-line ASCII grids; it de-duplicates per URL and emits `sourceId puzzle` lines consumable by the rating candidate search. The extractor also falls back to `curl` for pages such as HoDoKu that reject Node `fetch`.

Latest web/search-engine corpus scan: widened external candidate search beyond saved local sources to include search-engine leads, SudokuWiki `bd=` pages, PuzzleMadness `playsudoku?p=` exercise pages, HoDoKu `show_example.php` original-sudoku examples, DailySudoku forum ASCII grids, and EnjoySudoku/SudoCue-style forum text pages. The following earlier public-source batches produced 0 new real-board coverage for the remaining missing targets: SudokuWiki BUG / XY Chains / Empty Rectangles / X Chains plus HoDoKu chain/UR pages scanned 36 rows for BUG/UR/chain/coloring/single-digit-chain gaps; SudokuWiki Aligned Pair Exclusion / Death Blossom / Sue De Coq scanned 17 rows for ALS exotic gaps; SudokuWiki Fireworks scanned 8 rows for Fireworks / Twinned XY / ALQ; PuzzleMadness Two-String Kite scanned 10 rows and PuzzleMadness Skyscraper / Empty Rectangle / Crane / Y-Wing scanned 40 rows for single-digit-chain and chain gaps; HoDoKu `tech_chains.php` show examples scanned 24 rows under `classic-galaxy` and selected chain examples scanned 14 rows under `classic-stable`; SudokuWiki Exocet / SK Loops / Pattern Overlay / Tridagon scanned 14 rows with 2 per-candidate timeouts and 0 pattern target hits; HoDoKu `tech_ur.php` scanned 27 rows and only hit already-covered `avoidable-rectangle`; HoDoKu `tech_fishfs.php` and SudokuWiki Jelly Fish Strategy found only already-covered finned / sashimi X-Wing, finned / sashimi Swordfish, Jellyfish and Finned Franken Jellyfish paths, with no `sashimi-jellyfish` or `larger-fish` hit. A larger HoDoKu extraction across `tech_sdp.php`, `tech_col.php`, `tech_als.php`, `tech_wings.php`, `tech_fishb.php`, `tech_fishc.php`, `tech_fishfs.php`, `tech_chains.php` and `tech_ur.php` produced 108 cleaned original-sudoku candidates with source ids and matched 0/108 remaining targets under `classic-galaxy`; one APE-related HoDoKu ALS puzzle surfaced `aligned-pair-exclusion` in an unsolved partial path, so it remains candidate-state research material only, not corpus. A larger SudokuWiki Strategy Families extraction across 40 relevant pages produced 353 candidates; segmented scans from rows 1, 76, 151, 226 and 301 matched 0/353 remaining targets, with 5 total per-candidate timeouts. A follow-up search-engine URL batch including SudokuWiki `Twinned_XY_Chains`, `Whats_New`, `Sudoku_Solver___Version_History`, `Naked_Candidates`, `Hidden_Candidates`, `Extended_Unique_Rectangles`, `Hidden_Unique_Rectangles`, `Remote_Pairs`, `Finned_X_Wing`, `X_Cycles`, `Forcing_Nets` and `Print_Static_Patterns` extracted 71 candidates and matched 0/71 remaining targets, with 5 per-candidate timeouts. DailySudoku forum searches for APE / Death Blossom / Sue-de-Coq / Fireworks-style discussions extracted 17 ASCII-grid candidates and matched 0/17 ALS exotic targets under `classic-galaxy`, with 1 per-candidate timeout; the known APE forum puzzle was solved but absorbed by `finned-x-wing`. EnjoySudoku expansion added five new batches: initial `enjoysudoku-extra` / `enjoysudoku-http` extracted 6 candidates from DailySudoku / Ironmonger / EnjoySudoku search URLs and matched 0; `mixed-web-extra` covered SudoCue, Walter Bislins, gamesudoku, SourceForge and Reddit links, with 3/7 URLs accessible but 0 extracted candidates; `enjoysudoku-tech-extra` covered Fireworks, Sue de Coq and APE threads, extracted 47 candidates and matched 0 with 1 timeout; `enjoysudoku-search-extra` covered Remote Pairs, Unique Loop, Sashimi Jellyfish, Empty Rectangle, Sue de Coq, BUG+3 and benchmark-list threads, extracted 112 candidates and found one solved+unique full-rating-path `death-blossom` hit from EnjoySudoku benchmark list. A follow-up `next-task-web` batch covered ALS exotic, chain/fish/wing and UR/BUG target URLs, extracted 1053 candidates from 20/20 URLs, scanned 47 priority candidates with 0 hits and 4 timeouts, and scanned 1006 `fireworks-t39513-45` candidates in seven chunks with 2 `almost-locked-quad` hits and 6 timeouts. The first ALQ hit is now `classic-galaxy-almost-locked-quad-path` in `reference-rating-corpus.json`; at that time `audit:reference` passed 39/39 and `audit:coverage` reported rating corpus 42 with stable missing rating corpus 26 and experimental missing rating corpus 22. Multi-path follow-up scans added St. Olaf / Quatrian / Ironmonger / SudokuCoach-Taupier (`multipath-extra`) and direct SudokuWiki `bd=` links (`bd-link-extra`): `multipath-extra` accessed 19/22 URLs, extracted 16 Ironmonger original puzzles and matched 0; `bd-link-extra` extracted 8 direct puzzles and matched 0 with 1 timeout. St. Olaf examples were inspected directly: `examples.htm` lists method pages, while `ex_A1w.htm`, `ex_P.htm` and related pages expose `index.htm?puzzle=i520...&MARKS=...` candidate-state URLs plus explanations, with no original givens/grid parameter; these are provenance-only unless a future decoder/source map can recover original boards. Local专项池复扫 found 0 new hits: ALS-small 35 rows with 1 timeout, chain 28 rows with 2 timeouts, x-coloring 1 row, ALS audit rows 1-953 with 13 timeouts, stable audit rows 1-500 with 9 timeouts, and uniqueness audit rows 1-581 with 3 timeouts. Additional external batches also matched 0: `uniqueness-chain-extra` covered SudokuWiki HUR, SudoCue UR/HUR, DailySudoku Extended UR, Sudopedia and GitHub/Gitee tutorial pages, extracted 9 candidates from 8/9 accessible URLs; `chain-medusa-extra` covered SudoCue / EnjoySudoku AIC, XY-Chain, 3D Medusa, Remote Pairs and Nishio pages, extracted 4 candidates; `pattern-extra` covered EnjoySudoku Exocet / SK Loop / Tridagon / Pattern Overlay, SudokuWiki Pattern Overlay, Sudopedia and GitHub pattern examples, extracted 10 candidates from 9/10 accessible URLs and recorded 1 timeout. Remaining public pages and local pools are still useful as candidate-state / provenance sources, but non-hit original puzzles should not be added to `reference-rating-corpus.json` without a future target hit.

## Project Completion Plan

### Phase A: Freeze and Publish Status

| Task | Output | Gate |
| --- | --- | --- |
| A1. Keep technique inventory synced | `TECHNIQUES.md` and this doc agree with `getTechniqueDefinitions()` | Scripted count: 90 total, 60 stable, 30 experimental |
| A2. Keep missing tracker authoritative | `CLASSIC9_UNIMPLEMENTED_TECHNIQUE_COMPLETION_PLAN.md` remains the source of truth for missing / partial | No duplicated contradictory status in planning docs |
| A3. Keep validation baseline green | typecheck, reference audit, diff check | Required before new finder work |

### Phase B: BUG Family Completion

| Order | Task | Files | Acceptance |
| --- | --- | --- | --- |
| B1 | Candidate graph abstraction | `src/solver/techniques.ts` or extracted BUG helper module | BUG+1 / BUG+2 / BUG+n current smoke unchanged; graph exposes base cells, base strong links, extra groups, parity components and candidate hit safety. |
| B2 | Real-board search from saved leads | `scripts/find-reference-rating-candidates.mjs`, `reference-rating-corpus.json` | At least one full rating-path BUG+1 row, or documented evidence that public examples only work as trusted candidate states. |
| B3 | BUG+2 non-common proof upgrade | BUG helper + `reference-smoke.json` | Replace or supplement bounded completion proof with a deterministic parity proof; bounded mode remains clearly labeled. |
| B4 | Broader BUG elimination variant | `bug-plus-two` / possible new subtype | Positive + no-hit + solution-safety guard; must not change existing BUG+1 placement behavior. |
| B5 | BUG+n mixed extras | `bug-plus-n` | Multi-extra proof summary, common / non-common separation, no-target no-hit, solution-safety regression. |
| B6 | BUG Lite design gate | docs + fixtures first | Define local cluster graph, at least one positive external-source trusted fixture and one non-BUG-Lite no-hit before writing finder. |

### Phase C: Real-Board Corpus Expansion

| Area | Target |
| --- | --- |
| Direct | Decide whether each direct technique can realistically appear in full rating path; otherwise document explicit single-step boundary. |
| Chain / coloring | Add rows for Bidirectional X/Y Cycle, Forcing X-Chain, AIC loop variants, Skyscraper, Turbot Fish, Two-String Kite, Empty Rectangle. |
| Uniqueness | Add rows for UR Type 1/2/3/4/5, HUR, Extended Rectangle, Unique Loop, BUG+1/2/n. |
| Fish / wings / ALS | Add rows for Remote Pairs, Larger Fish and undercovered ALS/pattern techniques. Almost Locked Quad now has a real-board row. |

### Phase D: High-Risk Finder Completion

| Area | Guardrail |
| --- | --- |
| Endofin / overlap fish | Do not fold into current `franken-swordfish`; require explicit subtype, fin/overlap evidence and no-hit guards. |
| Generalized Unique Loop | Extend beyond bounded 14-cell single-roof only after proof compression and loop path evidence are stable. |
| Dynamic / Nested Forcing | Implement proof tree / budget metadata first; no stable promotion without real-board rows and performance benchmark. |
| Full SE clone | Out of scope for core; only document compatibility mapping unless a separate profile is designed. |

## Immediate Next Commands

```bash
npm run typecheck
npm run audit:reference
npm run audit:coverage
npm run audit:forcing-evidence
npm run audit:forcing-smoke
npm run audit:bug-evidence
git diff --check
node scripts/find-reference-rating-candidates.mjs --input docs/BUG_EXTERNAL_LEADS.txt --profile galaxy --target bug-plus-one --json
node scripts/find-reference-rating-candidates.mjs --input docs/BUG_EXTERNAL_LEADS.txt --profile galaxy --target bug-plus-two --json
node scripts/find-reference-rating-candidates.mjs --input docs/BUG_EXTERNAL_LEADS.txt --profile galaxy --target bug-plus-one --include-misses --max-misses 5 --json
node scripts/find-reference-rating-candidates.mjs --input dist/tmp/learning/classic9-game-500-alternatives-overused-gt-4/input-filtered-sorted.json --exclude-corpus tests/fixtures/reference-techniques/reference-rating-corpus.json --profile galaxy --target bug-plus-one,bug-plus-two,bug-plus-n,unique-rectangle,hidden-unique-rectangle,extended-rectangle,unique-loop --include-misses --max-misses 3 --max-rows 5 --max-elapsed-ms 5000 --per-candidate-timeout-ms 10000 --json
node scripts/audit-reference-gaps.mjs --group direct,uniqueness,chain --max-puzzles 25 --max-elapsed-ms 5000
node scripts/audit-reference-coverage.mjs
node scripts/audit-reference-gaps.mjs --group stable-gaps --source overused=dist/tmp/learning/classic9-game-500-alternatives-overused-gt-4/input-filtered-sorted.json --start-row 96 --max-puzzles 100 --max-elapsed-ms 60000
node scripts/audit-reference-gaps.mjs --group direct --source overused=dist/tmp/learning/classic9-game-500-alternatives-overused-gt-4/input-filtered-sorted.json --start-row 434 --max-puzzles 100 --max-elapsed-ms 60000
node scripts/audit-reference-gaps.mjs --group direct --source game500=dist/tmp/learning/game-500-source.json --start-row 494 --max-puzzles 100 --max-elapsed-ms 60000
```

If a public example does not produce a full rating-path BUG row, preserve it as a `trusted` candidate-state fixture only when the candidate state can be reconstructed and replayed safely.
