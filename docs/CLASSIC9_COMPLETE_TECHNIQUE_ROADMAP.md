# Classic9 Complete Technique Roadmap

本文档定义 classic9 在经典 9x9 数独上的长期技巧集目标：尽可能完整地吸收成熟 human solver 中已公开描述的技巧体系，同时以正确性为最高优先级，可读性次之，效率再次。

它不是承诺复刻某个外部库的源码、评分或排序；classic9 仍保持独立 TypeScript 实现、独立 `TechniqueId`、独立 `RatingPolicy` 和结构化 `SolveStep`。外部库只作为技巧目录、术语、subtype 边界和回归对照来源。

明确未实现技巧的清零执行顺序、完成口径和 missing tracker 见 [CLASSIC9_UNIMPLEMENTED_TECHNIQUE_COMPLETION_PLAN.md](./CLASSIC9_UNIMPLEMENTED_TECHNIQUE_COMPLETION_PLAN.md)。本文档定义准入和门禁，清零计划定义具体执行队列。

## Reference Scope

### Primary Reference Families

| Reference | Use | Boundary |
| --- | --- | --- |
| Sudoku Explainer / Sukaku Explainer | SE difficulty bucket、direct 技巧、forcing / dynamic / nested forcing 术语、BUG / UR family mapping | 只吸收公开技巧体系和行为描述；不移植 Java 源码；不提供公开 `classic-se` policy |
| HoDoKu | 完整 human technique 分类、solver order 风险、chains / fish / uniqueness / coloring / ALS / last-resort 技巧目录 | 只吸收公开文档中的技巧语义；不复制 GPL 或许可不清源码 |
| Sudoku community references | 通用技巧命名，如 fish、wings、AIC、ALS、BUG、UR、coloring | 只作为术语交叉校验，不作为单一 source of truth |

### Explicit Non-Goals

| Non-goal | Reason |
| --- | --- |
| 复制其他库源码 | GPL / 许可 / 维护风险；本包必须独立实现 |
| 宣称完整复刻 SE / HoDoKu rating | 外部 solver 的排序、剪枝、评分和 tie-break 都不是公开 API 的可稳定依赖 |
| 为匹配外部排序破坏 `classic-stable.v1` | 默认策略必须稳定、保守、可维护 |
| 在 proof model 未成熟前实现任意 BUG+n / generalized Unique Loop | 误删风险高，必须先有 proof graph 和 regression corpus |
| 用字符串技巧名替代 `SolveStep` | 会丢失可验证 action、evidence、replay 和审计能力 |

## Quality Priorities

1. Correctness: 不误删真解候选，不返回不可应用动作，不因 finder 内部探测 crash。
2. Evidence: 每个技巧必须返回可解释、可审计的结构化证据。
3. Replayability: 每个步骤必须能通过 `replaySteps()` 复现。
4. External alignment: 对外部技巧名称、subtype、difficulty bucket 给出清晰 mapping。
5. Readability: 实现应优先清晰表达 proof model；必要时牺牲局部性能。
6. Performance: 高阶技巧必须有预算、fallback 策略和基准，不进入默认热路径。

## Implementation Gate

任何新技巧或新 subtype 进入代码前必须满足以下准入。

| Gate | Requirement |
| --- | --- |
| Technique definition | 新增或复用 `TechniqueId`，更新 name、family、score、stability、aliases、external status |
| Scope note | 在相应文档中写清覆盖边界、非覆盖 subtype、是否依赖唯一解 |
| Finder design | 明确输入候选态、必要结构、动作生成、noop 过滤、tie-break 顺序 |
| Safety check | finder 不得生成 filled-cell action、missing-candidate elimination、empty-cell / homeless-digit 后果 |
| Evidence | `evidence.cells` / `houses` / `links` / `branches` / `pattern` 必须足以审计核心推理 |
| Replay | 正例必须通过 `replaySteps()`；复杂分支必须隔离 replay error |
| Verification | 正例和反例都必须通过 `verifyStep()` 或测试中的 replay / no-hit guard |
| Reference smoke | 至少 1 条人工候选态 fixture，校验 technique、actions、pattern/links/branches 和 replay |
| Negative fixture | 对 uniqueness、forcing、pattern、ALS、APE 等高误删风险技巧，至少 1 条 no-hit guard |
| Real-board corpus | stable 之前必须至少 1 条真实题面 rating corpus；experimental 可以先 smoke，后补 corpus |
| Documentation | 更新 `TECHNIQUES.md`、`SE_COMPATIBILITY.md`、必要时更新 family matrix |
| Budget | 高阶 chain / forcing / template / exhaustive 技巧必须有节点或时间预算 |

## Verification Stack

| Layer | Purpose | Required For |
| --- | --- | --- |
| Unit candidate fixture | 精确构造候选态，验证 finder 可达和动作形状 | 所有技巧 |
| No-hit guard | 防止相似但不成立的结构误报 | uniqueness、forcing、pattern、ALS、APE |
| `verifyStep()` | 检查 action 和 evidence 基本形状 | 所有公开步骤 |
| `replaySteps()` | 检查步骤可以应用到上下文 | 所有技巧 |
| `reference-smoke.json` | 轻量外部参考入口，固定 technique/subtype/evidence 边界，并用 no-hit rows 防止误报 | reference 技巧和 partial subtype |
| `reference-rating-corpus.json` | 真实题面路径，检查 solver order、hardest technique、score drift、replay | stable、promotion、release |
| Release audit | 检查稳定技巧不删真解候选、reference smoke 不回退 | release 前 |
| Benchmark | 检查高阶技巧预算和退化路径 | forcing、template、search-like 技巧 |

## Technique Family Roadmap

### Phase A: Baseline And Direct

状态：首版已完成，继续补真实题面。

| Area | Current | Next |
| --- | --- | --- |
| Singles | `full-house`、`naked-single`、`hidden-single` 已 stable；single subtype evidence 已有 | 补 block / row / col real-board corpus |
| Direct | `direct-pointing`、`direct-claiming`、`direct-hidden-pair`、`direct-hidden-triplet` 已 experimental/reference smoke | 补更多 row/col/box 方向和真实题面 |
| Locked candidates | `locked-candidates` stable；direct aliases 已拆 | 明确 pointing / claiming evidence subtype 是否需要公开 |

### Phase B: Subsets, Fish, Wings

状态：大部分 classic techniques 已实现，重点是外部 subtype 和反例覆盖。

| Area | Current | Next |
| --- | --- | --- |
| Naked / Hidden subsets | pair/triple/quad stable；direct hidden pair/triplet experimental | 补 reference smoke 的 row/col/box subtype coverage |
| Basic fish | X-Wing、Swordfish、Jellyfish stable | 补真实题面 corpus |
| Franken / finned fish | Franken Swordfish、Sashimi X-Wing、Finned Franken Swordfish、Finned Franken Jellyfish、finned fish、sashimi fish、Larger Fish size 5/6/7 和 conservative Mutant Fish 已有；finned/sashimi/franken/larger/mutant fish 已固定 `{ family: "fish", subtype }` evidence，并用 `expectedCells` / `expectedHouses` 固定代表性 fish / fin / target cells 与 base / cover / fin houses | 补真实题面；评估更通用 mutant / endofin / overlap fish 是否进入 scope |
| Wings | XY、XYZ、W-Wing、WXYZ、Big Wings、Chute Remote Pairs 和标准 `remote-pairs` 已有；主要 wing 入口已固定 `{ family: "wing", subtype }`，W-Wing / Remote Pairs 已有 selected link smoke，所有 wing rows 已用 `expectedCells` 固定 proof roles | 补真实题面和必要 no-hit guard |

### Phase C: Coloring And Chains

状态：已实现多类 chain / coloring entry point，但外部等价性仍 partial。

| Area | Current | Next |
| --- | --- | --- |
| Single-digit chains | X-Chain、Grouped X-Cycles、Skyscraper、Turbot Fish、Two-String Kite、Empty Rectangle；`bidirectional-x-cycle` / `forcing-x-chain` 已输出 pattern subtype，X-cycle trap / contradiction 均有 smoke；Skyscraper row/col、Empty Rectangle row/column、Turbot 8 种 house 序列、Two-String Kite 9 个 box 方位已有 pattern subtype 和 link smoke | 继续补 X-cycle 和 single-digit pattern 真实题面 |
| Bivalue chains | XY-Chain、AIC、Bidirectional Y-Cycle、Forcing Chain；`forcing-chain` 已输出 endpoint subtype，`aic` same / different endpoint、continuous loop、weak-weak discontinuous loop 与 strong-strong discontinuous loop 已进入 smoke | 明确 chain node model、link compression、shortest proof tie-break，并补更多方向、negative guard 和真实题面 |
| Coloring | Simple Coloring、X-Coloring、Multi-Colors、3D Medusa | 补 contradiction type evidence、negative fixtures |
| Grouped AIC | Grouped AIC 已有；`evidence.nodes` 已能表达 grouped candidate node 的完整 cell set；same / different endpoint subtype 均已进入 smoke | 增加真实题面、target visibility audit 和 grouped-chain renderer 设计 |

Chain / cycle subtype 的当前映射和 reference smoke 边界见 [SE_CHAIN_MATRIX.md](./SE_CHAIN_MATRIX.md)。后续若要给 X-cycle、X-chain 或 AIC 增加 `pattern.subtype`，必须先补 positive / no-hit fixture，避免把本包的近似入口错误宣称为完整 SE subtype。

### Phase D: ALS, AHS, APE, Exclusion

状态：已有核心 ALS/APE/Death Blossom 等，但需要更强 proof evidence。

| Area | Current | Next |
| --- | --- | --- |
| ALS basics | Almost Locked Pair/Triple stable；Almost Locked Quad experimental；ALS-XZ、ALS-XY-Wing 已有；基础 ALS/RCC pattern、links、`minNodes` 和 `expectedNodes` 已进入 reference smoke | 补真实题面、negative guard、ALS cell set subtype 细化 |
| ALS chains | AIC-ALS 已有，且固定 `aic-als-rcc-chain` pattern、RCC links 和 ALS nodes；reference smoke 已 pin `expectedNodes` | 补更完整 chain endpoint proof、no-hit guard、real-board corpus |
| APE | Aligned Pair Exclusion 已固定 subtype pattern / nodes smoke | 对齐 SE/HoDoKu 搜索范围，补反例和真实题面 |
| Death Blossom | 已实现，且固定 `death-blossom` pattern / petal nodes smoke | 补更细 blossom petals evidence 和真实题面 |
| Sue de Coq / Fireworks / Twinned XY | 已实现，且固定 subtype pattern / nodes smoke | 明确 non-SE extension vs external family mapping；补 negative guard 和真实题面 |

### Phase E: Uniqueness

状态：已建立 [SE_UNIQUENESS_MATRIX.md](./SE_UNIQUENESS_MATRIX.md)，主要已实现项已进入 reference smoke；AR、Rectangle Elimination、AIC-UR 已有真实题面，整体真实题面仍不足。

| Area | Current | Next |
| --- | --- | --- |
| UR Type 1 / 2 / 3 / 4 / 5 | Type 1、Type 2 shared-extra、Type 3 naked/hidden set、Type 4、保守 Type 5 已实现并有 reference smoke；Type 5 目前覆盖两个对角 extra cells 或三个 extra cells 的 common-seeing target 删除 | 补真实题面 rating corpus；继续补 Type 5/6 边界和 no-hit |
| Hidden UR / UR-AIC | 已实现保守形态并有 reference smoke；HUR 已固定 `type-6-strong-link-corner`；HUR / UR-AIC 已有基础 links evidence 和 UR rectangle/floor/roof nodes | 增加 UR-AIC / Type 6 边界、negative guard 和真实题面 |
| Avoidable Rectangle | 已修正正例逻辑并有 reference smoke；已有真实题面 | 继续补更多真实题面 |
| Rectangle Elimination | 已实现并有 reference smoke；row-strong / col-strong 两方向已固定；已有 1 条真实题面 | 对齐 SE subtype，继续补更多真实题面 |
| Extended Rectangle | 已实现 2x3 / 3x2 type-1 shape 并有 reference smoke；两个方向已固定 | 不宣称 generalized Unique Loop；补真实题面 |
| BUG | BUG+1 stable；BUG+1 已补 HoDoKu `bug101` 外部候选态 smoke 和 `bug102` no-hit guard，并输出同格等价 `bug-elimination-targets`；BUG+2 common-extra 和 bounded non-common parity-elimination experimental；BUG+n shared-extra common-target experimental；BUG+1/BUG+2/BUG+n smoke 已有 `bug-base` / `bug-extra`，并固定 BUG+1 parity nodes、BUG+2 common-extra target node、BUG+2 non-common `bug-elimination-targets` 与 BUG+n common-extra target node | BUG+1/BUG+2/BUG+n 完整 rating-path real-board；设计 broader BUG+n graph 和 multi-extra proof summary |
| Generalized Unique Loop | `unique-loop` experimental 已覆盖 2x3 / 3x2 single-roof、2x3 / 3x2 shared-guardian 和最多 14 cell 的有界 generalized single-roof loop | 继续补更大 loop、更多 guardian variants 和真实题面 |

### Phase F: Templates, Patterns, Last Resort

状态：已有 Exocet、Pattern Overlay、Tridagons、SK Loops、forcing family；高阶项必须预算化。

| Area | Current | Next |
| --- | --- | --- |
| Templates | Pattern Overlay 已实现 | 增加 template count budget、proof summary |
| Exotic patterns | Exocet、Double Exocet、Tridagons、SK Loops 已有 | 标注 classic9 extension / external mapping；补真实题面 |
| Nishio | stable | 补 contradiction evidence corpus |
| Forcing chains | cell/unit/region/digit/forcing-nets/table/dynamic/nested 已有不同成熟度 | proof tree、node budget、branch replay isolation、真实题面 |
| Bowman's Bingo | fallback safety net | 保持 fallback，不进入 stable primary |

## Promotion Policy

| From | To | Required Evidence |
| --- | --- | --- |
| missing | experimental | 独立 finder、unit positive、unit negative、reference smoke、docs |
| experimental | stable | real-board corpus、release audit 不误删真解、预算稳定、presentation 文案、schema/docs 完整 |
| partial | covered | subtype matrix 清楚、至少一个真实题面、evidence 足以区分 subtype |
| covered | default primary | 性能和排序稳定；不会抢占更简单技巧；有 migration note |

## Execution Order

1. 先补已实现技巧的 reference smoke，固定现有行为。
2. 再补真实题面 corpus，暴露 solver order 和 rating path 问题。
3. 然后补 negative fixtures，降低误删风险。
4. 再实现 missing 但 proof model 清晰的技巧。
5. 最后处理 proof model 大的技巧：broader BUG+n / BUG Lite、generalized Unique Loop、full Dynamic / Nested Forcing。

## Missing Coverage Support Plan

明确未覆盖项不能直接进入 finder 实现，必须先补对应支持能力。

| Missing area | Support that must exist first | Do not implement until |
| --- | --- | --- |
| AIC continuous / discontinuous loops | Continuous loop、weak-weak discontinuous loop 与 strong-strong placement loop 已有保守 positive smoke；closed-loop no-hit 和 endpoint no-target guard 已补；剩余更多方向和真实题面 | `reference-smoke.json` 可以区分 loop、placement、无目标闭环和普通 endpoint chain |
| Generalized Unique Loop | uniqueness loop node model、deadly-pattern compression、target proof summary、loop `evidence.nodes` | `extended-rectangle` 与 generalized loop 边界在 docs 和 fixtures 中清楚 |
| Broader BUG+n / BUG Lite | 保守 `bug-plus-n` shared-extra common-target 已有 positive/no-hit 人工候选态；继续在现有 BUG proof nodes 基础上补 BUG candidate graph、multi-extra proof summary、solution-safety negative fixtures、performance budget | 至少再补 solution-safety negative fixtures 和 1 条真实题面候选 |
| BUG broader elimination variants | BUG family subtype matrix、和 BUG+1 placement 的排序边界 | 不会把 BUG+1 落子场景误报为 elimination |
| Full Dynamic / Nested Forcing proof tree | branch tree schema、node/time budget、truncation semantics、replay-error reporting、benchmark | proof tree 可以被 `verifyStep()` / schema 校验 |
| Mutant / endofin / overlap fish | `larger-fish` size 5/6/7 普通 fish 和 conservative `mutant-fish` size-3 mixed-cover fish 已有 smoke；继续补 generalized fish basis/cover model、fin/sashimi target proof、no-hit fixtures | 可以证明不会误删 solution candidate |
| Fish / wing / ALS subtype expansion | subtype matrix、evidence pattern naming、expectedLinks / nodes 门禁 | 每个 subtype 有 positive 和必要 negative smoke |
| Real-board coverage for implemented techniques | 题面发现/筛选流程、known solution、profile/score/step count 固定 | rating path 不被更简单技巧吸收，且 replay/verify 全过 |

## Immediate Work Queue

| Priority | Work | Acceptance |
| --- | --- | --- |
| P0 | Direct real-board corpus | direct pointing/claiming/hidden pair/hidden triplet 各至少 1 条真实题面；记录 profile、hardest、score、step count |
| P0 | Uniqueness real-board corpus | 已补 AR、Rectangle Elimination、AIC-UR；BUG+1 已有 HoDoKu 外部候选态 smoke / no-hit guard 但仍缺完整 rating-path row；继续为 BUG+1、BUG+2 common-extra、UR Type 1、UR Type 2 shared-extra、UR Type 3、UR Type 4、Extended Rectangle、HUR 逐步补题面 |
| P1 | UR Type 5 / Type 6 boundary | UR Type 5 已有保守 finder、HoDoKu 来源候选态 positive 和 Type 2 边界 guard；继续补完整 rating-path 真实题面，不直接把 UR-AIC 等价成完整 Type 6 |
| P1 | Chain real-board + guards | X/Y cycle、forcing-x-chain、AIC loop / endpoint negative guard 和真实题面 |
| P1 | ALS / fish / wing real-board + guards | ALS endpoint proof、fish/wing variant corpus、必要 no-hit guard |
| P2 | BUG+2 non common-extra / broader BUG+n design | 先设计 graph / parity / proof summary，不盲目扩大 finder |
| P2 | Generalized Unique Loop design | 已有 loop compression / target proof nodes 和基础 no-hit；继续补更大 loop、guardian variants 和真实题面 |
| P2 | Dynamic / Nested proof tree | 先设计 branch tree schema、budget、truncation 和 benchmark |

## Release Checklist

每次新增技巧或 subtype，PR / commit 前至少跑：

1. `npm run typecheck`
2. `npm test`
3. `npm run audit:reference`
4. `npm run smoke:dist`
5. `npm run examples:typecheck`
6. `git diff --check`

发布前额外跑：

1. `npm run verify`
2. `npm run smoke:cli`
3. `npm run pack:dry-run`
4. `npm run smoke:pack`，前提是新增发布文件已纳入包内容检查。
