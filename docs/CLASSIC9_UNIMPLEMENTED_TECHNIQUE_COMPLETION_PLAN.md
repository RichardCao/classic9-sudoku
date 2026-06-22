# Classic9 Unimplemented Technique Completion Plan

本文档是“明确未实现技巧清零”的执行计划。它补充 [CLASSIC9_COMPLETE_TECHNIQUE_ROADMAP.md](./CLASSIC9_COMPLETE_TECHNIQUE_ROADMAP.md) 和 [CLASSIC9_NEXT_TASK_PLAN.md](./CLASSIC9_NEXT_TASK_PLAN.md)：前者定义长期准入和质量门禁，后者跟踪当前短期任务；本文档只跟踪那些当前仍不能宣称已实现的技巧或 proof family。

0.4.0 release note: 以 public `TechniqueId` 为口径，当前已经没有未实现或无真实题面覆盖的技巧 id。`audit:coverage` 要求 90/90 rating corpus 覆盖，stable missing 和 experimental missing 都为 0。本文后续仍保留为 subtype、proof model、negative guard、性能预算和 experimental-to-stable 晋升的工作清单；旧段落中的早期 corpus 数字是历史推进状态。

## Completion Definition

计划结束时，`missing` 不再表示“没有实现”。每个明确未实现技巧必须达到以下最低标准：

| Gate | Requirement |
| --- | --- |
| Public shape | 有 `TechniqueId`，或明确作为既有 `TechniqueId` 的 `evidence.pattern.subtype` 合并 |
| Finder | 有独立 finder，或有 generalized finder 中清晰可测试的分支 |
| Evidence | 返回可审计 `SolveStep`，包含安全 `actions` 和足够解释核心推理的 `pattern` / `nodes` / `links` / `branches` |
| Positive fixture | 至少 1 条 reference smoke positive fixture |
| Negative fixture | 至少 1 条 no-hit guard；uniqueness、BUG、fish、forcing 等高误删风险技巧需要多组 guard |
| Replay and verify | `verifyStep()` / replay 通过，不误删已知解候选 |
| Documentation | 文档写清 scope、subtype、非覆盖边界、是否依赖唯一解、是否 stable |
| Policy | 新增高风险技巧默认 `experimental`；只有真实题面、排序、性能和 proof 均成熟后才考虑 stable promotion |

不纳入本计划终点的内容：完整复刻 Sudoku Explainer / HoDoKu 的评分、排序、剪枝和难度克隆。这属于 compatibility/rating policy 研究，不是单个技巧 finder 的实现完成标准。

## Current Baseline

当前代码基线：

| Area | Current state |
| --- | --- |
| Technique definitions | `getTechniqueDefinitions()` 暴露 90 个技巧定义，其中 60 个 `stable`、30 个 `experimental` |
| Reference smoke | 213 条；direct 13、fish 15、chains 41、wings 7、ALS 11、patterns 5、uniqueness 28、negative 93 |
| Rating corpus | 68 条真实题面，`audit:coverage` 显示 90 个技巧均有真实题面覆盖；target-first rows 用 `targetFirstTechniques` 固定“目标技巧置顶”发现路径 |
| Main risk | 技巧 id 覆盖已经完成，但高级技巧仍需继续补 subtype proof model、negative guard、性能预算、解释文案和更多真实题面多样性 |

当前应先修正的基线问题：

| Item | Status | Acceptance |
| --- | --- | --- |
| `TECHNIQUES.md` stable/experimental table mismatch | `done` | 文档与 `TECHNIQUE_DEFINITIONS.stability` 一致 |
| Current missing inventory freeze | `done` | 本文档和 `CLASSIC9_NEXT_TASK_PLAN.md` 对 missing / partial / out-of-scope 使用同一口径 |
| Validation baseline | `done` | `typecheck`、`audit:reference`、`audit:coverage`、`audit:bug-evidence`、`audit:forcing-smoke`、`diff --check` 通过 |

## Execution Order

### Phase 0: Baseline Freeze

目标：消除状态歧义，确保后续实现建立在可信基线上。

| Order | Task | Files | Acceptance |
| --- | --- | --- | --- |
| 0.1 | Fix technique status docs | `docs/TECHNIQUES.md` | `almost-locked-quad`、`bug-plus-two` 等表述与代码 stability 一致 |
| 0.2 | Link completion plan | `docs/CLASSIC9_NEXT_TASK_PLAN.md`, `docs/CLASSIC9_COMPLETE_TECHNIQUE_ROADMAP.md` | 后续 missing 技巧以本文档为主索引 |
| 0.3 | Freeze inventory | this file | 明确 missing、partial、out-of-scope 的边界 |
| 0.4 | Baseline validation | npm scripts | `npm run typecheck`、`npm run audit:reference`、`git diff --check` |

### Phase 1: Shared Proof Infrastructure

目标：先补 proof/evidence 基础设施，不直接写高风险 finder。

| Order | Task | Required support | Acceptance |
| --- | --- | --- | --- |
| 1.1 | Unique Loop proof model | loop path node、deadly pattern cell-set、base digits、target proof、guardian/escape candidates、loop compression | `unique-loop` experimental 已覆盖 2x3 / 3x2 single-roof、2x3 / 3x2 shared-guardian 和最多 14 cell 的有界 generalized single-roof loop，并固定 `unique-loop` / `unique-loop:base-pair` / `unique-loop:guardians` / `unique-loop:targets` node ids |
| 1.2 | BUG candidate graph | BUG base graph、bivalue base cells、extra cells、多 extra digit parity、common-extra / non-common-extra target proof | BUG+1 / BUG+2 common-extra / bounded non-common parity-elimination 继续通过，并输出一致 `bug-base` / `bug-extra` nodes |
| 1.3 | Generalized fish proof model | line basis、box basis、mixed basis、cover sets、fins、sashimi gap、endofin、overlap、target visibility | 现有 fish smoke 不回退，普通 fish、普通 Franken 与 8 个 finned/sashimi/franken no-target guard 保持 |
| 1.4 | Forcing proof tree schema | branch tree、nested branch、共同结论 reduction、budget、truncation、replay-error isolation | 现有 forcing 技巧继续通过；`audit-forcing-smoke-evidence.mjs` 固定 DFC / DFC+ / Nested / Table / Bowman 的有限 proof-tree branch metadata、`evidence.pattern` subtype 和预算 |

### Phase 2: Uniqueness Completion

目标：补齐当前最明确的 uniqueness 缺口。

| Order | Technique / Area | Implementation | Acceptance |
| --- | --- | --- | --- |
| 2.1 | UR Type 5 | 已作为 `unique-rectangle` 的 `pattern.subtype = "type-5"` 保守实现，不新增 public id；覆盖两个对角 extra cells 或三个 extra cells 的 common-seeing target 删除 | 两条 HoDoKu 来源候选态 positive、Type 2 不误标 Type 5、无外部 target no-hit、非 deadly pair no-hit 已进入 reference smoke；HoDoKu u501/u502 原题复核后仍不能作为当前 full rating-path row，仍需继续找真实题面 |
| 2.2 | UR Type 6 boundary | `hidden-unique-rectangle` 的 row/col strong-link corner 两个几何方向已固定；`aic-ur` single-roof 与 floor-roof chain 已固定，floor-roof 左右方向均有 smoke；mirrored floor-roof no-target、AIC-UR single-roof conjugate boundary、HUR conjugate boundary guards 已补 | 不把普通 UR-AIC 误标成完整 Type 6；HUR 两方向和 UR-AIC floor-roof 两方向 reference smoke 通过 |
| 2.3 | Generalized Unique Loop | 已新增 `unique-loop` experimental；当前覆盖 2x3 / 3x2 single-roof、2x3 / 3x2 shared-guardian 和最多 14 cell 的有界 generalized single-roof loop；已补 broken-loop、target-without-pair、multi-guardian/no-target、shared-guardian extra mismatch / multi-extra no-hit | 继续补更大 loop 和真实题面 |
| 2.4 | Rectangle family regression | 覆盖 UR、AR、Rectangle Elimination、Extended Rectangle、HUR、AIC-UR | 新 subtype 不抢占更简单技巧；reference smoke / rating corpus 不退化 |

### Phase 3: BUG Completion

目标：从 BUG+1 / BUG+2 common-extra 扩到 BUG+2 variants、BUG+n、BUG Lite。

| Order | Technique / Area | Implementation | Acceptance |
| --- | --- | --- | --- |
| 3.1 | BUG+2 non-common-extra | 扩展 `bug-plus-two`，新增 subtype，例如 `bug-plus-two-parity-elimination` | non-common-extra positive；common-extra 不误进；无安全目标 no-hit |
| 3.2 | BUG broader eliminations | BUG graph 支持 placement 与 elimination 两类结论；当前 BUG+1 placement 已用 `bug-elimination-targets` 标出同格非落子候选的等价删除目标，但 action 仍保持 placement | BUG+1 placement 不误报 elimination；新增真正 broader elimination positive/no-hit |
| 3.3 | BUG+n | `bug-plus-n` experimental 已保守覆盖 shared-extra common-target；继续扩展前必须限制 n 或预算 | 已有 multi-extra positive 和 no-target no-hit；仍需更多 no-hit、solution-safety audit、真实题面和性能预算 |
| 3.4 | BUG Lite | 新增 `bug-lite` 或作为 BUG+n subtype，取决于 proof 是否共享 | 明确和 BUG+n / BUG+1 / BUG+2 的边界，不能误标普通 BUG |

### Phase 4: Fish Completion

目标：补 mutant fish、larger fish、endofin/overlap fish。

| Order | Technique / Area | Implementation | Acceptance |
| --- | --- | --- | --- |
| 4.1 | Mutant fish | `mutant-fish` experimental 已保守覆盖 size-3、base/cover sectors 各自互不重叠的 mixed-cover fish；后续更通用 mutant / endofin / overlap 仍需 generalized fish proof | 已有 positive/no-target smoke；仍需 cover invalid no-hit、solution-safety audit 和真实题面 |
| 4.2 | Larger fish | `larger-fish` experimental 已保守覆盖 size 5/6/7 普通 fish；mutant / endofin / overlap 仍需 generalized fish proof | 已有 size-5、size-6 positive 和 no-target smoke；预算可控；不进入 stable；不拖慢默认 pipeline |
| 4.3 | Endofin / overlap fish | 单独 subtype，显式标出 endofin / overlap cells | 现有 `franken-swordfish` 保守口径不变；新增 proof 安全 |
| 4.4 | Existing fish migration | 让现有 fish 共享 proof abstraction 或校验 helper | fish reference smoke 全过；现有 no-target guards 保持 |

### Phase 5: Dynamic / Nested Forcing Completion

目标：把已有 experimental finder 从“有界入口”提升为“proof tree 可审计实现”。

| Order | Technique / Area | Implementation | Acceptance |
| --- | --- | --- | --- |
| 5.1 | Dynamic Forcing Chains | 记录动态分支内每一步推导、共同结论、截断状态、预算 | DFC positive 可展示共同结论来源；无共同结论 no-hit；超预算返回 null |
| 5.2 | Dynamic Forcing Chains Plus | 更深/更宽预算，并和 DFC 有明确 subtype 或 budget metadata | DFC+ 命中 DFC 命不中样例；不进入 stable 热路径 |
| 5.3 | Nested Forcing Chains | 支持多层 branch tree、嵌套 replay、共同结论 reduction | nested positive、replay-error isolation、truncation no-hit |
| 5.4 | Table Chain alignment | 明确当前 `table-chain` 与 SE TableChain 的差异，补 proof tree 或 subtype | 文档不再使用模糊“接近”口径；fixture 固定 covered subset |

### Phase 6: Real-Board Corpus Expansion

目标：把“人工候选态能命中”推进到“真实题面路径可回归”。

| Order | Area | Required rows | Acceptance |
| --- | --- | --- | --- |
| 6.1 | Direct | `direct-pointing`、`direct-claiming`、`direct-hidden-pair`、`direct-hidden-triplet` | 若 normal path 被基础技巧吸收，文档明确只保证 explicit single-step |
| 6.2 | Chains | X/Y cycle、forcing-x-chain、AIC loop、grouped AIC、skyscraper、turbot、kite、empty rectangle | 每个 family 至少 1 条真实题面 path |
| 6.3 | Fish / wings / ALS | finned/sashimi/franken/mutant/larger fish、W-Wing、Remote Pairs、ALS-XZ/XY/AIC-ALS、APE、Death Blossom、Sue de Coq | 新增 experimental 至少 smoke；stable promotion 前至少真实题面 |
| 6.4 | Uniqueness / BUG | UR Type 1/2/3/4/5/6、Unique Loop、BUG+1、BUG+2、BUG+n、BUG Lite | stable promotion 前每个主要 subtype 有真实题面 |

### Phase 7: Policy, Performance, Release Gate

目标：实现完整后不破坏默认求解顺序、评分和性能。

| Order | Task | Acceptance |
| --- | --- | --- |
| 7.1 | Policy layering | `classic-stable` 只纳入成熟技巧；高风险技巧留在 `experimental` / `classic-galaxy` |
| 7.2 | Priority audit | 新技巧不抢占更简单技巧；hard/normal/basic grading 不漂移或有 migration note |
| 7.3 | Performance budget | fish generalized search、BUG graph、Unique Loop、Dynamic/Nested Forcing 有节点/时间预算 |
| 7.4 | Release validation | `typecheck`、`audit:reference`、`smoke:dist`、`examples:typecheck`、`diff --check`；`npm test` OOM 风险另行拆分跟踪 |

## Missing Tracker

| Area | Missing item | Target id / subtype | Status | Next action |
| --- | --- | --- | --- | --- |
| Uniqueness | UR Type 5 | `unique-rectangle` subtype | `implemented-partial` | 保守 finder、两条 positive smoke、无 target / 非 deadly pair no-hit 和 Type 2 边界 guard 已有；继续补完整 rating-path 真实题面 |
| Uniqueness | Complete UR Type 6 boundary | `unique-rectangle` / `hidden-unique-rectangle` / `aic-ur` subtype | `partial` | HUR row/col and UR-AIC floor-roof left/right smoke done; mirrored floor-roof no-target guard done; continue real-board rows |
| Uniqueness | Generalized Unique Loop | `unique-loop` | `implemented-partial` | Extend beyond bounded 14-cell single-roof loops and 2x3/3x2 shared guardians; add real-board rows and additional guardian variants |
| BUG | BUG+2 non-common-extra | `bug-plus-two` subtype | `implemented-partial` | Bounded non-common parity-elimination 已有，并已固定 proof mode / completion budget 审计输出；仍需更通用 parity proof 和真实题面 |
| BUG | BUG broader eliminations | BUG family subtype | `partial-design` | BUG+1 已输出等价 elimination target nodes；finder/action 仍未覆盖真正 broader eliminations，继续 Phase 3.2 |
| BUG | BUG+n | `bug-plus-n` | `implemented-partial` | Shared-extra common-target 形态已实现并有 positive/no-hit smoke；仍需真实题面、更通用 multi-extra proof 和 solution-safety guard |
| BUG | BUG Lite | `bug-lite` or BUG+n subtype | `missing` | Phase 3.4 |
| Fish | Mutant fish | `mutant-fish` | `implemented-partial` | Size-3 disjoint mixed-cover fish 已有 positive/no-target smoke；仍需更通用 mutant、cover invalid no-hit、真实题面和 solution-safety audit |
| Fish | Larger fish | `larger-fish` | `implemented-partial` | Size 5/6/7 普通 fish 已有 positive/no-target smoke；仍需真实题面和 solution-safety audit |
| Fish | Endofin / overlap fish | fish subtype | `missing` | Phase 4.3 |
| Forcing | Full Dynamic proof tree | `dynamic-forcing-chains` evidence | `partial` | Phase 1.4, then Phase 5.1 |
| Forcing | Full DFC+ proof tree | `dynamic-forcing-chains-plus` evidence | `partial` | Phase 5.2 |
| Forcing | Full Nested proof tree | `nested-forcing-chains` evidence | `partial` | Phase 5.3 |
| Forcing | Table Chain alignment | `table-chain` subtype / docs | `partial` | Phase 5.4 |

## Proof Node Conventions

Phase 1.1 已开始落地 Unique Loop proof model。当前 schema 和 `verifyStep()` 已允许通用 node id，因此无需改公开 schema；先固定以下 node id，后续 finder 和 reference smoke 必须复用这些 id。

### Unique Loop Nodes

| Node id | Role | Meaning |
| --- | --- | --- |
| `unique-loop` | `reason` | 完整 deadly loop cell set |
| `unique-loop:base-pair` | `reason` | loop 中构成基础 pair pattern 的 cell set |
| `unique-loop:guardians` | `pivot` | 防止 deadly loop 成立的 guardian / escape cells |
| `unique-loop:targets` | `target` | 可删除或可落子的目标 cell set，可选 `digit` |

### BUG Graph Nodes

Phase 1.2 从现有 `bug-plus-one` / `bug-plus-two` nodes 出发，先固定通用 BUG candidate graph 的证据命名；代码侧已抽出 `buildBugBaseGraph()`、base graph strong-link evidence helper、declared-extra map、BUG+2 extra-pair classifier、extra parity summary、parity evidence node helper、elimination target node helper、target parity proof draft helper、BUG+2 common-extra elimination helper，以及 bounded non-common completion probe。BUG+2 / BUG+n elimination steps 现在会把移除 extra 后每个 house/digit 的二候选 BUG base 关系作为 `evidence.links` 暴露；`audit-bug-graph-evidence.mjs` 已把 BUG+1 parity nodes、BUG+2 / BUG+n base links 和 target nodes 固定为可重复 gate。bounded completion 分支已在 finder note 和 inspection JSON 中固定 `proofMode`、budget、completion status 和 solution count，避免被误读为通用 parity theorem。后续更通用 BUG+2 non-common-extra、BUG+n、BUG Lite 和 broader BUG eliminations 必须复用这些 id / helper 或在本表扩展后再实现。

| Node id | Role | Meaning |
| --- | --- | --- |
| `bug-base` | `reason` | 移除 extra 后形成 BUG bivalue pattern 的 base cells；当前 BUG+1 / BUG+2 已输出 |
| `bug-extra` | `pivot` | 破坏 BUG deadly pattern 的 extra cells；单 extra digit 时带 `digit`，multi-extra / mixed-extra 时可不带 `digit` 并在 subtype / note 中解释 |
| `bug-parity-row` | `reason` | BUG+1 placement 对应 digit 在目标 row 的 parity 证据；当前 BUG+1 已输出 |
| `bug-parity-col` | `reason` | BUG+1 placement 对应 digit 在目标 column 的 parity 证据；当前 BUG+1 已输出 |
| `bug-parity-box` | `reason` | BUG+1 placement 对应 digit 在目标 box 的 parity 证据；当前 BUG+1 已输出 |
| `bug-common-extra-targets` | `target` | BUG+2 common-extra elimination 的共同可见 target cells；当前 BUG+2 已输出 |
| `bug-extra-group:*` | `pivot` | BUG+n / non-common-extra 中按 digit 或 parity component 分组的 extra candidate set，例如 `bug-extra-group:3`；当前 BUG+2 bounded non-common parity-elimination 已输出 |
| `bug-elimination-targets` | `target` | Broader BUG elimination、BUG+n 共同结论、BUG+1 placement 的同格等价删除目标，或 BUG+2 bounded non-common parity-elimination 的 target cells；必须带目标 `digit` |

BUG graph 实现门禁：

| Gate | Requirement |
| --- | --- |
| Base graph safety | 所有 unsolved cells 移除 declared extras 后必须是 bivalue；每个 digit 在每个 house 中出现 0 或偶数次，除非 subtype 明确证明 parity 结论 |
| Base graph evidence | BUG+2 / BUG+n elimination 必须暴露移除 extra 后的 BUG base strong links；reference smoke 通过 `minLinks` 固定该 proof graph 不退化为单纯 node 标签；`npm run audit:bug-evidence` 必须通过 |
| Extra classification | subtype 必须区分 `bug-plus-one` placement、`bug-plus-two-common-extra` elimination、non-common-extra parity elimination、BUG+n multi-extra、BUG Lite |
| Target proof | elimination 必须有 `bug-common-extra-targets` 或 `bug-elimination-targets`；placement 必须有 row/col/box parity nodes |
| Negative guards | 至少覆盖 extra 不一致、无共同 target、base graph 非 bivalue / 非闭合、non-common-extra 不误报 common-extra、缺 target parity proof 不误报 parity elimination、会删除 solution digit 的 safety regression；reference smoke 已覆盖 BUG+2 different-extra、no-common-target、broken-base-graph、non-common-not-common-extra、target-parity-proof-no-hit 和 BUG+n no-common-target，并通过 `forbiddenEliminations` / `forbiddenPlacements` 固定 solution-safety action guards |
| Policy | BUG+2 non-common-extra、BUG+n、BUG Lite 默认 `experimental`；不得改变当前 `bug-plus-one` stable 行为 |

BUG+2 non-common-extra proof draft:

| Step | Requirement |
| --- | --- |
| Extra pair | 必须来自 BUG+2 extra-pair classifier，且 `kind = non-common-extra`；两个 declared extras 移除后必须通过 `buildBugBaseGraph()` |
| Parity proof | 不能复用 common-extra 的共同可见 target 规则；必须消费 BUG+2 extra-pair classifier 输出的 extra parity summary，证明某个 extra digit 在 row/col/box parity 或 grouped parity component 中被强制为 false。own-house odd parity 只是 non-common pair 的安全不变量，不足以单独推出 elimination；common-extra 也不能套用该 invariant |
| Evidence | `bug-base` / `bug-extra` 必须保留；新增 target 必须使用 target parity proof draft helper 聚合的 `bug-elimination-targets`、`bug-extra-group:*` 和 `bug-parity-*` |
| Fixtures before finder | 至少 1 个 non-common-extra positive、1 个 common-extra 不误进 no-hit、1 个 target parity proof no-hit、1 个 solution-safety regression；当前已有 non-common-extra 不误报 common-extra no-hit、target parity proof no-hit、bounded completion zero-completion no-hit、bounded completion over-budget no-hit、forbidden solution-digit elimination guard 和 forbidden placement guard；`scripts/inspect-bug-plus-two-candidates.mjs` 可用 `--id` 定位 fixture，枚举 extra pairs、parity summary、target probes 和 bounded completion probe，并标注 `solutionDigit` / `isSolutionDigit`、`safeTargetCandidates`、completion `solutionCount` 与 extra candidate hit count 辅助设计 positive / no-hit |
| Scope guard | 在上述 fixtures 前，不新增 `bug-plus-two-parity-elimination` finder 分支，不新增 broader BUG public id |

## Active Work Queue

Current active sequence:

1. Phase 0.1: Fix technique status docs. `done`
2. Phase 0.2: Link this plan from current planning docs. `done`
3. Phase 0.3: Run baseline validation. `done`
4. Phase 1.1: Start Unique Loop proof model design and schema/helper implementation. `done`
5. Phase 2.3: Expand `unique-loop` beyond 2x3 / 3x2 single-roof loop. `done` for 14-cell bounded loops and 2x3/3x2 shared-guardian extra elimination; next target is real-board rows / larger guardian variants.
6. Phase 6: Expand real-board rating corpus with current candidate sources. `done` for 43 rows / 59 covered techniques, including target-first rows; remaining gaps require new source, smaller target-first groups, or generated candidates.
7. Phase 1.2: Start BUG candidate graph proof model. `in-progress` with BUG node conventions, first code helpers, BUG+2 / BUG+n base graph strong-link evidence, BUG graph evidence audit gate, BUG+2 extra-pair classifier, non-common own-house odd invariant, extra parity summary, parity evidence node helper, elimination target node helper, target parity proof draft helper, broken-base negative fixture, non-common-not-common-extra fixture, target parity proof no-hit fixture, bounded completion zero-completion no-hit, bounded completion over-budget no-hit, forbidden solution-digit elimination guard, forbidden placement guard, BUG+2 inspection script, bounded non-common parity-elimination positive fixture, bounded completion proof metadata gate, HoDoKu `bug101` external-source BUG+1 candidate-state smoke, and HoDoKu `bug102` external-source BUG+1 no-hit guard; `audit:bug-evidence` currently passes 5/5 rows with 78 base strong links. Next target is full rating-path BUG+1 / BUG+2 rows and a more general non-common parity proof that does not rely on bounded completion enumeration.
8. Phase 1.4: Start forcing proof-tree gate. `in-progress` with real-board forcing branch audit and artificial smoke forcing audit for 11 forcing-style techniques; DFC / DFC+ / Nested / Table / Bowman now have fixed branch metadata, `evidence.pattern` subtype and max-step budget gates; `audit:forcing-smoke` currently passes 11/11 rows with 16 branches and 0 truncated branches. Next target is richer nested proof-tree shape, not just single-level branch metadata.
