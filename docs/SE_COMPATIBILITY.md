# Sudoku Explainer 兼容计划

本文档是 `classic9-sudoku` 吸收 Sudoku Explainer / Sukaku Explainer 技巧体系时使用的参考映射文档。这里的目标不是逐字复制 SE 的 Java 实现，也不是在公开 API 中提供 SE profile，而是把外部技巧命名、difficulty 区间和本包自己的 `TechniqueId`、fixture、audit 口径对齐。

参考基线：

1. SudokuMonster/SukakuExplainer FAQ 中的 SE 评分表。
2. SE FAQ 对 Direct 技巧、Forcing Chains、Bidirectional Cycles、Dynamic Forcing Chains 的语义说明。
3. 本包当前 `getTechniqueDefinitions()`、`classic-stable`、`classic-extended`、`SolveStep` evidence 和 release audit 约束。

## 兼容口径

SE compatibility 分四级：

1. `covered`：当前技巧已经能表达 SE 对应技巧的主要结论，并且有 stable 或 experimental finder。
2. `covered-as-variant`：当前技巧可以覆盖主要逻辑，但没有单独 SE 名称、难度或 direct 变体。
3. `partial`：当前有近似实现，但和 SE 原始分类、优先级、分支模型或 difficulty 区间不完全一致。
4. `missing`：当前没有 finder，或者不能稳定返回可回放 `SolveStep`。

一个外部参考技巧进入本包可回归覆盖前应满足：

1. 技巧定义存在，并有 SE 名称、SE difficulty 区间、本包默认分值。
2. `nextStep()` 可通过 `allowedTechniques` 精确命中。
3. `walkthrough()` 产出的步骤可被 `replaySteps()` 回放。
4. `verifyStep()` 对动作和 evidence 结构判定通过。
5. 至少一个 golden fixture 覆盖目标技巧。
6. 对可能误删候选的技巧，release audit 能验证不破坏真解。

## 当前映射矩阵

| SE 技巧 / 难度 | 当前映射 | 状态 | 主要差距 |
| --- | --- | --- | --- |
| Last value in block/row/column `1.0` | `full-house` | `covered` | `evidence.pattern.subtype` 已区分 `block` / `row` / `col`；public id 和 score 仍统一。 |
| Hidden Single in block `1.2` | `hidden-single` | `covered-as-variant` | `evidence.pattern.subtype` 已区分 `block` / `row` / `col`；difficulty 仍按本包统一分值。 |
| Hidden Single in row/column `1.5` | `hidden-single` | `covered-as-variant` | `evidence.pattern.subtype` 已区分 row/col，暂不拆 public `TechniqueId`。 |
| Direct Pointing `1.7` | `direct-pointing` | `covered` | 已返回“删除候选 + 直接落子”步骤；仍需补更多 external-reference corpus 校准。 |
| Direct Claiming `1.9` | `direct-claiming` | `covered` | 已区分 claiming 来源；仍需补 row/column 方向 fixture。 |
| Direct Hidden Pair `2.0` | `direct-hidden-pair` | `covered` | 已返回 direct hidden subset 步骤；仍需补真实题面回归。 |
| Naked Single `2.3` | `naked-single` | `covered` | SE 排序中 Naked Single 晚于 direct 技巧；当前 classic-stable 更早尝试。 |
| Direct Hidden Triplet `2.5` | `direct-hidden-triplet` | `covered` | 已返回 direct hidden subset 步骤；仍需补真实题面回归。 |
| Pointing `2.6` | `locked-candidates` | `covered-as-variant` | 当前统一为 `locked-candidates`，未区分 pointing 与 claiming。 |
| Claiming `2.8` | `locked-candidates` | `covered-as-variant` | 同上。 |
| Naked Pair `3.0` | `naked-pair` | `covered` | 无主要差距。 |
| X-Wing `3.2` | `x-wing` | `covered` | 无主要差距。 |
| Hidden Pair `3.4` | `hidden-pair` | `covered` | 无主要差距。 |
| Naked Triplet `3.6` | `naked-triple` | `covered` | 命名需保留 SE 的 `Triplet` alias。 |
| Swordfish `3.8` | `swordfish` | `covered` | 无主要差距。 |
| Hidden Triplet `4.0` | `hidden-triple` | `covered` | 命名需保留 SE 的 `Triplet` alias。 |
| XY-Wing `4.2` | `xy-wing` | `covered` | 无主要差距。 |
| XYZ-Wing `4.4` | `xyz-wing` | `covered` | 无主要差距。 |
| Unique Rectangles and Loops `4.5..5.0` | `unique-rectangle`, `extended-rectangle`, `unique-loop`, `hidden-unique-rectangle`, `aic-ur`, `rectangle-elimination`, `avoidable-rectangle` | `partial` | `unique-loop` 已作为 experimental 覆盖 2x3 / 3x2 single-roof、2x3 / 3x2 shared-guardian 和最多 14 cell 的有界 generalized single-roof loop；仍需要映射更多 SE UR/UL 类型、difficulty 分段和避免不稳定路径。 |
| Naked Quad `5.0` | `naked-quad` | `covered` | 无主要差距。 |
| Jellyfish `5.2` | `jellyfish` | `covered` | 无主要差距。 |
| Hidden Quad `5.4` | `hidden-quad` | `covered` | 无主要差距。 |
| Bivalue Universal Graves `5.6..6.0` | `bug-plus-one`, `bug-plus-two`, `bug-plus-n` | `partial` | 已覆盖 BUG+1、BUG+2 common-extra elimination、bounded non-common parity-elimination，以及 BUG+n shared-extra common-target 的保守形态；更通用 BUG+n / BUG Lite / broader elimination 仍缺真实题面和 proof tree。 |
| Aligned Pair Exclusion `6.2` | `aligned-pair-exclusion` | `covered` | 需要和 SE 的 APE 搜索范围对齐。 |
| Bidirectional X-Cycles `6.5..7.5` | `bidirectional-x-cycle`, `x-chain`, `simple-coloring`, `x-coloring`, `grouped-x-cycles` | `covered-as-variant` | 已有 SE 命名入口；仍需统一 X-cycle 子类型和长度分值。 |
| Bidirectional Y-Cycles `6.5..7.5` | `bidirectional-y-cycle`, `xy-chain`, `aic` | `covered-as-variant` | 已有 SE 命名入口；仍需区分 Y-Cycle、bivalue cycle、AIC 的 SE 分类。 |
| Forcing X-Chains `6.6..7.6` | `forcing-x-chain`, `x-chain` | `covered-as-variant` | 已有外部参考命名入口；`skyscraper`、`turbot-fish`、`two-string-kite`、`empty-rectangle` 在本包中作为独立 single-digit-chain 技巧维护，不声明为 SE 映射技巧。 |
| Forcing Chains / Bidirectional Cycles `7.0..8.0` | `forcing-chain`, `aic`, `grouped-aic`, `forcing-nets` | `covered-as-variant` | 已有 SE 命名入口；仍需完整统一 implication graph。 |
| Nishio `7.5..8.5` | `nishio-forcing-chains` | `covered` | 需要用 SE fixture 校准 contradiction evidence。 |
| Cell Forcing Chains `8.0..9.0` | `cell-forcing-chains` | `partial` | 当前 experimental，需要更多 real-board fixtures。 |
| Region Forcing Chains `8.0..9.0` | `region-forcing-chains`, `unit-forcing-chains` | `covered-as-variant` | 已有 SE 命名入口；仍是 experimental，需要更多 real-board fixtures。 |
| Dynamic Forcing Chains `8.5..9.5` | `dynamic-forcing-chains` | `partial` | experimental；当前是有界动态分支入口，仍需 proof tree、节点预算和真实题面 fixture。 |
| Dynamic Forcing Chains (+) `9.0..10.0` | `dynamic-forcing-chains-plus` | `partial` | experimental；当前是更深、更宽预算的 DFC 入口，仍需完整 proof tree 和真实题面 fixture。 |
| Nested Forcing Chains `>9.5` | `nested-forcing-chains` | `partial` | experimental；当前仅提供单候选 contradiction 入口并允许一层受控 forcing 嵌套，仍需完整 proof tree 压缩和真实题面 fixture。 |

## 技术路线

### Phase 0：基线冻结

状态：已完成。

目标：建立不会随实现漂移的 SE source-of-truth。

交付：

1. 本文档。
2. `se-compatibility` 技巧矩阵。
3. 当前 `TechniqueId` 到 SE 名称 / alias / difficulty 的映射草案。
4. 缺失技巧 backlog。

验收：

1. 文档列出每个 SE difficulty bucket。
2. 每个 bucket 有当前状态和下一步。
3. 明确哪些技巧不能直接进入 stable。

### Phase 1：外部参考元数据

状态：已完成，并已调整为不暴露公开 SE profile。

目标：不改变 finder 逻辑，先让技巧定义能表达外部参考映射。

交付：

1. `TechniqueDefinition` 增加可选 metadata：`aliases`, `seDifficulty`, `seStatus`。
2. CLI `techniques` 能输出 alias / difficulty 参考信息。
3. 公开内置 policy 保持本包自己的 `classic-stable`、`classic-extended`、`classic-galaxy`。
4. `aliases`、`seDifficulty` 和 `seStatus` 是公开的外部参考元数据；SE 不作为独立 solver、rating policy、CLI profile 或 release gate 进入公开主 API。

验收：

1. 所有现有技巧都有 SE 映射或明确标记为 non-SE extension。
2. unknown SE 技巧不会静默通过。
3. `getRatingPolicy()` 不接受 SE profile，只接受本包自己的内置策略。

### Phase 2：Direct 技巧

状态：首版已完成；fixture 数量和 external-reference corpus 校准仍需扩充。

目标：补 SE 低阶 direct 系列，这是 SE 和当前 classic-stable 排序差异最大的地方。

范围：

1. `direct-pointing`
2. `direct-claiming`
3. `direct-hidden-pair`
4. `direct-hidden-triplet`

实现原则：

1. Direct 技巧返回 `place`，不是单纯 `eliminate`。
2. evidence 必须同时说明触发的删除逻辑和最终 hidden single。
3. 不改变普通 `locked-candidates` / `hidden-pair` / `hidden-triple` 的语义。

验收：

1. 每个 direct 技巧至少 2 个 fixture：row/column 或 box 场景。
2. reference smoke 通过显式 `allowedTechniques` 和 `preferredTechniques` 验证 direct 技巧优先可达。
3. `verifyStep()` 和 `replaySteps()` 通过。

### Phase 3：SE cycle / chain 对齐

状态：首版已完成；single-digit strong-link 图已共享，AIC / Grouped AIC 已抽出候选图基础类型；更细 SE 子类型仍在进行中。subtype / evidence 边界矩阵见 [SE_CHAIN_MATRIX.md](./SE_CHAIN_MATRIX.md)。当前 reference smoke 已固定 `bidirectional-x-cycle`、`forcing-x-chain`、`bidirectional-y-cycle` 和 `forcing-chain` 的 expected elimination 与 strong/weak link 下限。

目标：把当前分散的 coloring、chain、AIC、single-digit-chain 技巧整理到 SE 的 X/Y cycle 与 forcing chain 语义上。

交付：

1. 公共 implication graph：
   - candidate node
   - strong link
   - weak link
   - grouped node
   - bivalue cell edge
2. `bidirectional-x-cycle`
3. `bidirectional-y-cycle`
4. `forcing-x-chain`
5. `forcing-chain`
6. 当前 `x-chain`、`xy-chain`、`aic`、`grouped-aic` 的 alias / fallback 关系。

验收：

1. 链类技巧不重复误报同一结论。
2. shorter proof 优先级可配置。
3. 所有 chain step 都有 `evidence.links`。
4. release audit 校验不删真解候选。

### Phase 4：BUG / Unique Loop 覆盖

状态：subtype matrix 已建立，详见 [SE_UNIQUENESS_MATRIX.md](./SE_UNIQUENESS_MATRIX.md)；真实题面 fixture、更通用 BUG+2/BUG+n、BUG Lite 和 generalized Unique Loop 仍待补齐。

目标：补齐 SE 的 BUG 和 Unique Rectangle/Loop family。

交付：

1. BUG type matrix。
2. Unique Loop / generalized uniqueness loop。
3. SE UR 类型映射。
4. 当前 uniqueness 技巧的 SE alias。

验收：

1. 每个类型至少 1 个 fixture。
2. 所有 uniqueness 技巧默认需要唯一解前提。
3. 可通过 policy 禁用 uniqueness family。

### Phase 5：Dynamic / Nested Forcing

目标：实现 SE 高端 rating 所需的动态和嵌套 forcing。

交付：

1. Branch proof tree 数据结构。
2. 节点预算、深度预算、时间预算。
3. `dynamic-forcing-chains`
4. `dynamic-forcing-chains-plus`
5. `nested-forcing-chains`
6. CLI 输出 proof summary，避免打印爆炸。

验收：

1. 默认不进入 `classic-stable`。
2. 必须显式启用或通过本包自己的高覆盖策略启用。
3. 超预算时返回 no-match，不抛异常。
4. 有慢题 fixture，但 release smoke 只跑短预算。

### Phase 6：外部参考 corpus 和 release gate

状态：首版 smoke gate 已完成；真实题面 reference rating corpus 已建立最小骨架，但每个外部 difficulty bucket 覆盖和 full external-reference audit 仍待补齐。

目标：把兼容性从“技巧存在”推进到“真实题 rating 可回归”。

交付：

1. `tests/fixtures/reference-techniques/*.json`
2. `tests/fixtures/reference-techniques/reference-rating-corpus.json`
3. `scripts/audit-reference-techniques.mjs`
4. CI 中增加轻量 reference smoke。
5. 手动 release 增加 full external-reference audit。

验收：

1. 每个外部 difficulty bucket 至少 1 个 fixture。
2. 每个 stable/reference 技巧至少 1 个单步 fixture。
3. audit 输出 hardest technique、step count、elapsedMs、mismatch。
4. CI 不因极端 DFC/NFC 慢题失控。

## 初始 backlog

优先级 P0：

1. 每个 direct 技巧补齐 row/column/box 方向 fixture。
2. 用真实题面回归校准 direct 技巧和普通 hidden/locked 技巧的优先级。

优先级 P1：

1. Bidirectional X-Cycle。
2. Bidirectional Y-Cycle。
3. Forcing X-Chain。
4. Forcing Chain。
5. BUG variant matrix。

优先级 P2：

1. Dynamic Forcing Chains。
2. Dynamic Forcing Chains (+)。
3. Nested Forcing Chains。
4. External-reference full release corpus。

已完成：

1. SE metadata schema。
2. SE alias / difficulty / status 输出。
3. Direct Pointing。
4. Direct Claiming。
5. Direct Hidden Pair。
6. Direct Hidden Triplet。
7. `bidirectional-x-cycle`。
8. `bidirectional-y-cycle`。
9. `forcing-x-chain`。
10. `forcing-chain`。
11. single-digit strong-link graph 共享层。
12. AIC / Grouped AIC 候选图基础类型与加边去重 helper。
13. Grouped AIC 图构建和搜索入口接入 `CandidateGraph`。
14. AIC / Grouped AIC house candidate 缓存共享 helper。
15. Direct / chain reference fixture 首版表驱动化，并增加 replay、动作结构和 chain link 回归断言。
16. 新增 `tests/fixtures/reference-techniques/reference-smoke.json` 作为后续外部参考 corpus 扩充入口。
17. reference smoke fixture 增加运行时形状校验和 v1 技巧覆盖校验。
18. reference smoke fixture 通过显式技巧 options 校验路径可达性。
19. 新增 `scripts/audit-reference-techniques.mjs` 和 `npm run audit:reference`，作为轻量 reference smoke release gate。
20. 新增 `tests/fixtures/reference-techniques/reference-rating-corpus.json` 和 `scripts/audit-reference-rating-corpus.mjs`，把 reference 回归从人工候选态推进到真实题面评分路径的最小骨架。
21. `npm run verify` 纳入 `audit:reference`，让常规源码验证默认覆盖轻量 reference smoke gate。
22. CI workflow 增加显式 reference smoke audit 步骤，直接运行 `npm run audit:reference`。
23. `audit-reference-techniques.mjs` 增加 fixture 输入校验，并在测试中覆盖 JSON 输出和坏输入失败路径。
24. 新增 `tests/fixtures/reference-techniques/README.md`，明确 smoke fixture 与真实外部 rating corpus 的边界。
25. `audit:reference` 输出增加 `corpusKind: "reference-smoke"` 和非 full external rating corpus 说明，避免误用。
26. 新增 `dynamic-forcing-chains` experimental 技巧，提供有界动态分支入口并接入 galaxy fallback。
27. 新增 `dynamic-forcing-chains-plus` experimental 技巧，提供更深、更宽预算的 DFC+ 入口并接入 galaxy fallback。
28. 新增 `nested-forcing-chains` experimental 技巧，提供一层受控 forcing 嵌套入口；该技巧比 galaxy fallback 更重，当前仅建议显式启用做离线审计。
29. forcing branch evidence 增加 `steps`、`maxSteps`、`truncated` 和 `stopReason` 预算摘要，便于调用方判断分支证明是否因预算截断或 replay 隔离停止。
30. 新增 [SE_UNIQUENESS_MATRIX.md](./SE_UNIQUENESS_MATRIX.md)，固定 BUG / UR / Unique Loop subtype 映射和后续 fixture 目标。
31. uniqueness finder 增加 `evidence.pattern.family/subtype`，用于审计 UR、AR、BUG 等 SE subtype 覆盖，不拆 public `TechniqueId`。
32. 新增 `region-forcing-chains` experimental SE 命名入口，复用 unit/region 分支模型，便于外部参考直接按 SE 术语启用。
33. `full-house` 和 `hidden-single` 增加 `evidence.pattern.subtype`，用于区分 SE 的 block / row / column 变体；当前不拆分 public id 和分值。
34. 新增 `bug-plus-two` experimental finder，保守覆盖两个三值格共享 extra digit 且可删共同可见候选的 BUG+2 common-extra 形态。
35. reference smoke audit 增加 `uniqueness` 分组，首个覆盖项为 `bug-plus-two`，并校验 expected elimination、pattern subtype 和 replay。
36. `avoidable-rectangle` 修正合法三已解角正例判断，并加入 `uniqueness` reference smoke，覆盖 expected elimination、pattern subtype 和 replay。
37. `unique-rectangle` Type 1、Type 3 naked set、Type 3 hidden set 和 Type 4 加入 `uniqueness` reference smoke，固定 subtype evidence 和 replay 可用性。
38. `rectangle-elimination`、`extended-rectangle`、`hidden-unique-rectangle` 和 `aic-ur` 加入 `uniqueness` reference smoke，固定已实现边界的 expected elimination、pattern evidence 和 replay。
39. `bug-plus-one` 加入 `uniqueness` reference smoke，固定 place action、BUG pattern evidence 和 replay。
40. `unique-rectangle` Type 2 shared-extra 加入 `uniqueness` reference smoke，固定 extra digit elimination、pattern subtype 和 replay。
41. `aic-ur` reference smoke 拆分 `single-roof-chain` 和 `floor-roof-chain`，避免两个 UR-AIC 证明形态在后续 finder 调整中退化为同一类 evidence。
42. 修复 `rectangle-elimination` 的 col-strong 几何判断，使列强链 + 行 weak wing 的镜像形态可达；reference smoke 同时覆盖 row-strong 和 col-strong。
43. `extended-rectangle` reference smoke 增加 3x2 镜像布局，固定 2x3 / 3x2 两个扫描方向都可 replay。
44. `aic-ur` 输出基础 `evidence.links`，并让 reference smoke 支持 uniqueness `minLinks` 约束，确保 UR-AIC subtype 不只返回 cells 标注。
45. reference smoke 增加 `negative` no-hit 分组，首批覆盖 UR Type 2 shared-extra 无目标、Avoidable Rectangle forbidden digit 不在候选、Rectangle Elimination 无第四宫候选、Extended Rectangle pure-pair 数不足、HUR 无共同 base pair、UR-AIC 无目标、BUG+1 多三值格、BUG+2 extra 不一致、BUG+2 无共同可见目标，防止高风险 uniqueness finder 误报。
46. `audit-reference-techniques.mjs` 对 positive smoke step 增加 `verifyStep(..., { mode: "evidence" })` 结构校验；人工候选态的上下文矛盾会被过滤，但 invalid action/evidence/link shape 会失败。
47. `audit-reference-rating-corpus.mjs` 对真实题面 rating path 中的每个 step 增加 `verifyStep(..., { mode: "evidence" })`，并校验 place/eliminate 动作不违背已知 solution。
48. 新增 `scripts/find-reference-rating-candidates.mjs` 和 `npm run find:reference-candidates`，用于从候选题面文件中筛选目标技巧真实 rating path，并输出可审阅的建议 corpus row；脚本支持文本题面、JSON `rows` / learning `samples` 字符串题面、JSON 81-cell numeric array 题面、`--hardest` 过滤和 `--exclude-corpus` 跳过已收录题面。
49. `reference-rating-corpus.json` 增加 `avoidable-rectangle` 和 `w-wing` 真实题面路径，使 corpus 从 5 行扩展到 8 行。
50. `bug-plus-two` 增加 bounded non-common parity-elimination subtype；reference smoke 固定 `bug-elimination-targets` 与 `bug-extra-group:*` nodes，并区分 common-extra 文案。
50. `reference-rating-corpus.json` 增加 `aic-ur` 真实题面路径，使 corpus 从 8 行扩展到 9 行，并开始覆盖 UR-AIC 的正常 rating path。
51. `reference-rating-corpus.json` 增加 `rectangle-elimination` 真实题面路径，使 corpus 从 9 行扩展到 10 行，并开始覆盖 Rectangle Elimination 的正常 rating path。
52. `reference-rating-corpus.json` 增加 `xy-wing` 和 `sashimi-x-wing` 真实题面路径，使 corpus 从 10 行扩展到 12 行，并开始补 fish / wing 正常 rating path。
53. `reference-rating-corpus.json` 增加 `als-xz`、`als-xy-wing` 和 `aic-als` 真实题面路径，使 corpus 从 12 行扩展到 15 行，并开始补 ALS family 正常 rating path。
54. `reference-rating-corpus.json` 增加 `finned-x-wing`、`almost-locked-pair` 和 `finned-franken-jellyfish` 真实题面路径，使 corpus 从 15 行扩展到 18 行，并顺带覆盖 Big Wings / WXYZ-Wing 的正常 rating path。
55. `reference-rating-corpus.json` 增加 `finned-swordfish`、`finned-franken-swordfish`、`xyz-wing` 和 `almost-locked-triple` 真实题面路径，使 corpus 从 18 行扩展到 22 行。
56. `reference-rating-corpus.json` 增加 `sashimi-swordfish` 真实题面路径，使 corpus 从 22 行扩展到 23 行；当前 500 题源在 `classic-galaxy` 下仍未命中 `sashimi-jellyfish` 和若干特殊 ALS 技巧；`finned-jellyfish` 已用 `classic-stable` 真实题面覆盖。
57. `reference-rating-corpus.json` 增加 `chute-remote-pairs` 真实题面路径，使 corpus 从 23 行扩展到 24 行；随后又补入 `swordfish` 和 `franken-swordfish` 真实题面路径，使 corpus 扩展到 26 行；随后补入 `jellyfish` 真实题面路径，使 corpus 扩展到 27 行；随后补入 `finned-jellyfish` 真实题面路径，使 corpus 扩展到 28 行；alternatives 源仍未命中 `remote-pairs`、`finned-jellyfish`、`sashimi-jellyfish`、`almost-locked-quad` 或特殊 ALS 目标。
58. 新增 `bug-plus-n` experimental finder，保守覆盖 3 个以上三值格共享同一 extra digit、移除 extra 后形成 BUG base、且存在共同可见 target 的删除形态；reference smoke 增加 BUG+n positive 与 no-target negative guard，使 smoke 从 206 条扩展到 208 条。
59. 新增 `larger-fish` experimental finder，保守覆盖 size 5/6/7 普通 fish；reference smoke 增加 Larger Fish size-5、size-6 positive 与 no-target negative guard，使 smoke 从 208 条扩展到 211 条。
60. 新增 `mutant-fish` experimental finder，保守覆盖 size-3 disjoint mixed-cover fish；reference smoke 增加 Mutant Fish positive 与 no-target negative guard，使 smoke 从 211 条扩展到 213 条。

## 决策记录

1. 现有 `classic-stable` 不为了 SE 排序而破坏兼容性；公开全技巧入口使用本包自己的 `classic-galaxy`。
2. Direct 技巧使用独立 `TechniqueId`，不把它们隐藏在普通技巧评分里。
3. 高端 dynamic / nested forcing 默认 experimental。
4. SE-compatible 表示技巧覆盖、评分区间和解释结构对齐；不承诺和 SE Java 搜索路径逐步同构。
5. 所有新增技巧必须先证明可回放，再考虑进入 stable。
