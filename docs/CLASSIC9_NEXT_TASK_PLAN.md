# Classic9 Next Task Plan

本文档把 Sudoku Explainer 覆盖缺口和 npm 包评审中的可采纳建议整理成可执行任务。它不是外部评分体系承诺；默认策略仍以 `classic-stable.v1` 为准，SE 相关内容只作为参考映射和回归目标。

完整技巧吸收路线、实现准入和验证门禁见 [CLASSIC9_COMPLETE_TECHNIQUE_ROADMAP.md](./CLASSIC9_COMPLETE_TECHNIQUE_ROADMAP.md)。明确未实现技巧的清零执行顺序、完成口径和 missing tracker 见 [CLASSIC9_UNIMPLEMENTED_TECHNIQUE_COMPLETION_PLAN.md](./CLASSIC9_UNIMPLEMENTED_TECHNIQUE_COMPLETION_PLAN.md)。后续补技巧必须先满足这些文档中的 correctness、evidence、replay、reference smoke 和真实题面 corpus 要求。

当前技巧实现盘点、BUG family 外部资料调研、已保存题面线索和项目推进计划见 [CLASSIC9_IMPLEMENTATION_STATUS_AND_BUG_RESEARCH.md](./CLASSIC9_IMPLEMENTATION_STATUS_AND_BUG_RESEARCH.md)。

## 当前直接执行

当前主线进入 0.4.0 发布收口。技巧 id 级别的实现和 real-board rating corpus 覆盖已经清零；下一步重点不是继续扩大 finder，而是发布门禁、文档一致性、测试耗时分层和发布后质量深化。

| Task | Scope | Acceptance |
| --- | --- | --- |
| 0.4.0 version sync | 同步 `package.json`、lockfile、`src/version.ts`、CLI/help 测试和 CHANGELOG | `getPackageInfo()`、CLI `version`、package metadata 均返回 `0.4.0` |
| Release gate | 发布前跑完整源码门禁和 coverage/evidence 审计 | `npm test`、`npm run audit:reference`、`npm run audit:coverage`、`npm run verify:coverage`、`git diff --check` 通过 |
| Reference corpus policy | 文档明确 smoke fixture 与 real-board rating corpus 的边界 | target-first rows 把目标技巧放第一位；smoke/trusted candidate state 不计入 rating corpus |
| Post-release quality plan | 0.4.0 之后继续补 subtype、proof compression、negative guard、学习样例和测试耗时分层 | 不再以 missing technique id 为主线；以质量矩阵和样例可解释性为主线 |

## 已完成门禁

| Task | Result | Verification |
| --- | --- | --- |
| Chain pattern evidence | 已为 `bidirectional-x-cycle`、`forcing-x-chain`、`forcing-chain`、`grouped-aic` 和 single-digit pattern chains 增加结构化 `evidence.pattern`；`bidirectional-x-cycle` 的 two-color trap / same-color contradiction、`bidirectional-y-cycle` 既有 pattern 和镜像方向、`aic` same / different endpoint、grouped AIC same / different endpoint，以及 `skyscraper` row/col、`empty-rectangle` row/column、`turbot-fish` 8 种 house 序列、`two-string-kite` 9 个 box 方位 subtype 均已进入 reference smoke；AIC 已补 same-endpoint 镜像方向、different-endpoint transpose 方向、continuous-loop column 方向、weak/weak column loop 和 strong/strong shifted loop；X/Y-cycle、XY-Chain open-chain、X-Chain、classic coloring extensions 和 single-digit pattern chain 已补 no-target negative guard；chain rows 已用 `expectedCells` 固定 reason / target roles | `reference-smoke.json` 的 `chains` 分组校验 expected pattern、expected elimination、link 下限、expectedCells 和 replay |
| AIC loops | `aic` 已新增保守 loop fallback：优先保留 existing endpoint-chain 命中；continuous loop 从 loop weak links 推导删数；discontinuous weak/weak loop 删除断点候选；discontinuous strong/strong loop 返回断点落子 | `reference-smoke.json` 新增 `aic` continuous-loop、discontinuous-loop-weak-weak 与 discontinuous-loop-strong-strong rows，并用 closed-loop no-hit、endpoint no-target 和 `forbiddenPattern` 固定无目标 loop / endpoint chain 不应误报；当前 reference smoke 由 `audit:reference` 统一校验 |
| Finned / sashimi fish evidence | 已为 `x-wing`、`swordfish`、`jellyfish`、`franken-swordfish`、`finned-x-wing`、`sashimi-x-wing`、`finned-swordfish`、`finned-jellyfish`、`sashimi-swordfish`、`sashimi-jellyfish`、`finned-franken-swordfish`、`finned-franken-jellyfish` 固定 `{ family: "fish", subtype }` pattern evidence，并用 `expectedCells` / `expectedHouses` 固定代表性 fish / fin / target cells 与 base / cover / fin houses | `reference-smoke.json` 新增 `fish` 分组；普通 fish、普通 Franken 和 8 个 finned / sashimi / franken fish 入口 no-target negative guard 已补；当前 reference smoke 校验 expected elimination、pattern、expectedCells、expectedHouses 和 replay |
| Wing subtype evidence | 已为 `xy-wing`、`xyz-wing`、`w-wing`、`wxyz-wing`、`big-wings`、`chute-remote-pairs`、`remote-pairs` 固定 `{ family: "wing", subtype }`；`w-wing` 和 `remote-pairs` 补 selected link gate；所有 wing rows 已用 `expectedCells` 固定 reason / pivot / link / target proof roles | `reference-smoke.json` 的 `wings` 分组扩到 7 行；XY/XYZ/WXYZ/W-Wing/BigWings/Chute Remote Pairs/Remote Pairs 已补 no-target negative guard；当前 reference smoke 统一校验 |
| ALS / RCC evidence | 已为 `almost-locked-pair`、`almost-locked-triple`、`almost-locked-quad`、`als-xz`、`als-xy-wing`、`aic-als`、`fireworks`、`twinned-xy-chains`、`aligned-pair-exclusion`、`death-blossom`、`sue-de-coq` 固定 `{ family: "als", subtype }` pattern；ALS-XZ / ALS-XY / AIC-ALS 输出 RCC links；ALS/APE rows 已有 `evidence.nodes` cell-set gate | `reference-smoke.json` 的 `als` 分组扩到 11 行；AIC-ALS 固定 `aic-als-rcc-chain`；ALS rows 已用 `minNodes` 和 `expectedNodes` 固定 ALS/AHS/RCC/petal/intersection proof nodes；ALP/ALT/ALS-XZ/ALS-XY/AIC-ALS/APE/Fireworks/Twinned XY/Death Blossom/Sue de Coq 已补 no-target/no-action negative guard |
| UR node evidence | `unique-rectangle`、`hidden-unique-rectangle` 和 `aic-ur` 已输出 `ur-rectangle` / `ur-floor` / `ur-roof` cell-set nodes，固定 rectangle base、floor 与 roof proof boundary；UR Type 5 另输出 `ur-extra` / `ur-targets` nodes | uniqueness reference smoke 对 UR/HUR/AIC-UR rows 已加 `minNodes`；UR Type 1/2/3/4/5、HUR、AIC-UR rows 已用 `expectedNodes` 固定 proof nodes；后续 Type 6 mapping 可基于 node evidence 拆分 |
| BUG node evidence | `bug-plus-one`、`bug-plus-two` 和 `bug-plus-n` 已输出 `bug-base` / `bug-extra` nodes；BUG+1 还输出 row/col/box parity nodes 和同格等价 `bug-elimination-targets`，BUG+2 已覆盖 common-extra target node 和 bounded non-common parity-elimination target node，BUG+n 已覆盖 shared-extra common-target node，固定 BUG base、extra cells、parity/target proof boundary | uniqueness reference smoke 对 BUG+1/BUG+2/BUG+n rows 已提高 `minNodes`，并用 `expectedNodes` 固定 parity / target nodes；后续 BUG+1/BUG+2/BUG+n 仍需真实题面，BUG+2/BUG+n 仍需更通用 proof |
| Almost Locked Quad | 已新增 `almost-locked-quad` experimental，复用 ALS/AHS line-box intersection proof 模型；不会进入 `classic-stable`，可显式启用或经 galaxy 覆盖策略使用 | 已补 positive / no-hit 单测，已进入 `reference-smoke.json` 的 `als` 分组，并新增 `classic-galaxy-almost-locked-quad-path` 真实题面 corpus |
| Remote Pairs | 已新增 HoDoKu / 常见高级体系中的标准 `remote-pairs`；不同于 `chute-remote-pairs`；已返回合法 eliminations、chain links，并补 positive / no-hit 测试 | 已进入 `reference-smoke.json` 的 `wings` 分组，并固定 pattern / expected link |
| Pattern / exotic evidence | 已为 `exocet`、`double-exocet`、`pattern-overlay`、`tridagons`、`sk-loops` 固定 `{ family: "pattern", subtype }`、关键 `evidence.nodes` 和短 proof note；Pattern Overlay note 已固定 template count / budget；Exocet、Double Exocet、Pattern Overlay、Tridagons、SK Loops 已补 no-hit guard | `reference-smoke.json` 的 `patterns` 分组固定 expected actions、pattern、nodes、proof note 片段和 pattern no-hit 边界；README 已说明 pattern fixture 格式；当前 `audit:reference` 为 124/124 |
| Chain subtype matrix | 已新增 `SE_CHAIN_MATRIX.md`，固定 X/Y cycle、forcing-x-chain、forcing-chain/AIC、grouped X-Cycles、grouped AIC 和 single-digit pattern chain 的当前映射、evidence 边界和已知缺口 | `reference-smoke.json` 的 `chains` 分组已固定 expected elimination、`minStrongLinks`、`minWeakLinks`，并为 single-digit pattern 的双向/中心代表 rows 固定 exact link endpoints |
| Grouped chain evidence node | 已新增可选 `evidence.nodes`，`grouped-aic` 会输出 grouped candidate node 的完整 cell set；same / different endpoint 均已补代表镜像方向 | `verifyStep()` 和 JSON schema 已校验 `nodes`；reference smoke 已用 `expectedNodes` 固定 grouped node cell set |
| Grouped AIC reference gate | `grouped-aic` 已进入 chain reference smoke，并补 target visibility negative guard、mirror / transpose no-target variants 和 ordinary-AIC no-hit guards | `reference-smoke.json` 固定 `minGroupedNodes`、`expectedNodes`、无目标 no-hit 和必须包含 grouped node 的边界 |

## Coverage Gap Inventory

这张表是后续推进的主索引。`missing` 表示当前没有 finder 或不应宣称覆盖；`partial` 表示 finder 已有，但 subtype、proof evidence、negative guard、真实题面或预算仍不足。

| Area | Status | Covered now | Not implemented / incomplete | Next move |
| --- | --- | --- | --- | --- |
| Real-board corpus | `complete-for-technique-id` | `reference-rating-corpus.json` 已有 68 行，`audit:coverage` 当前显示 90/90 public `TechniqueId` 具备 rating corpus coverage；除 normal profile rows 外，target-first rows 用 `targetFirstTechniques` 固定“目标技巧置顶”发现路径；已新增 `find-reference-rating-candidates.mjs`、`synthesize-reference-rating-candidates.mjs` 和 `audit-reference-gaps.mjs` 作为题面发现入口 | 技巧 id 级别缺口已清零；后续仍需更多题面多样性、subtype coverage、解释素材和性能分层 | P0：发布前保持 corpus 审计通过；发布后再按 subtype / learning sample 质量补充 |
| Direct techniques | `implemented-partial` | `direct-pointing`、`direct-claiming`、`direct-hidden-pair`、`direct-hidden-triplet` finder、artificial smoke、no-hit guard 和 real-board single-step smoke 已有 | normal rating path 仍会被 singles/基础技巧吸收；真实 rating corpus 覆盖不足 | P0：继续找 direct rating-path 题面；如不可达，保持 single-step real-board smoke 作为边界 |
| Singles / subsets | `implemented-partial` | full-house / hidden-single subtype evidence；naked/hidden pair/triple/quad stable | subtype 的真实题面覆盖不足；direct hidden pair/triplet 仍 experimental | P0/P1：补 corpus，不急于拆 public id |
| Chain / coloring | `implemented-partial` | X/Y cycle、forcing-x-chain、x-chain、forcing-chain、AIC loops、grouped-X-Cycles、grouped-AIC、single-digit pattern chain 的 smoke/evidence 已固定；X-cycle / X-chain / forcing-x-chain / classic coloring extension / grouped-X-Cycles no-target guards 已有；AIC closed-loop no-hit、endpoint no-target guard、same/different endpoint 镜像方向、continuous-loop column 方向和 discontinuous loop 代表方向已补 | AIC 更多方向、chain length / scoring calibration、X/Y cycle 真实题面不足；grouped proof renderer 未做 | P1：补 negative guard 和真实题面；不新增大 proof tree |
| Fish / wings | `implemented-partial` | finned/sashimi/franken fish pattern、representative cells 和 representative houses 已固定；`larger-fish` size 5/6/7 普通 fish 和 conservative `mutant-fish` size-3 mixed-cover fish 已有 positive/no-target smoke；XY/XYZ/WXYZ/W-Wing/BigWings/Chute Remote Pairs/Remote Pairs smoke 已有；wing proof roles 已用 `expectedCells` 固定 | 更通用 mutant fish、endofin / overlap fish 没有 finder；fish/wing 真实题面和部分 no-hit guard 不足 | P1 补 corpus/guard；P2 才设计 generalized fish basis/cover |
| ALS / AHS / RCC | `implemented-partial` | ALP/ALT/ALQ、ALS-XZ/XY、AIC-ALS、APE、Death Blossom、Fireworks、Twinned XY、Sue-de-Coq pattern / nodes 已固定，reference smoke 已 pin `expectedNodes` | ALS endpoint proof 的解释压缩、negative guard 和真实题面不足；完整 ALS-chain proof compression 未做 | P1：补 endpoint proof / no-hit / corpus；暂不扩大搜索预算 |
| Uniqueness / UR | `implemented-partial` | UR Type 1、Type 2 shared-extra、Type 3 naked/hidden、Type 4 双方向、保守 Type 5、HUR Type 6 corner、UR-AIC、AR、Rectangle Elimination、Extended Rectangle smoke 已有；AR、Rectangle Elimination、AIC-UR 已进入真实题面 corpus | UR Type 5 仍缺完整 rating-path 真实题面；UR-AIC 与完整 Type 6 边界未拆清；BUG/UR 真实题面仍不足 | P1：补 Type 5 真实题面、继续拆 Type 6 边界和 no-hit |
| BUG family | `implemented-partial` | BUG+1 placement stable；BUG+1 已有 HoDoKu `bug101` 外部候选态 smoke 和 `bug102` no-hit guard，并输出同格等价 elimination targets；BUG+2 common-extra 与 bounded non-common parity-elimination experimental；BUG+n shared-extra common-target experimental；`bug-base` / `bug-extra` / BUG+1 parity / BUG+2 common-extra target / BUG+2 non-common target / BUG+n common-extra target nodes 已有；bounded non-common proof 已固定 proof mode / completion budget 审计输出 | BUG+1 / BUG+2 / BUG+n 完整 rating-path 真实题面仍缺；BUG+2/BUG+n 更通用 non-common 或 multi-extra proof、BUG Lite、真正 broader BUG elimination actions 仍未完成；通用 BUG graph / multi-extra proof summary 未完成 | P1 收集真实题面和更通用 parity proof；P2 在通用 BUG graph 后再考虑扩大 finder |
| Forcing / dynamic / nested | `implemented-partial` | forcing-nets、digit/cell/unit/region/table/dynamic/dynamic-plus/nested forcing 入口已有；branch replay crash 已隔离 | 完整 Dynamic/Nested proof tree、共同结论 reduction、node/time budget、proof compression 和真实题面不足 | P2：先补 branch proof schema、budget、benchmark，不进默认热路径 |
| Templates / exotic patterns | `implemented-partial` | Pattern Overlay、Exocet、Double Exocet、Tridagons、SK Loops 已有 pattern smoke / nodes / 短 proof note；Pattern Overlay 已在 proof note 中暴露 template count / budget | provenance notes、真实题面不足；SK Loop 不映射为 Unique Loop | P2：补 provenance 和 corpus，保持 extension 口径 |
| Full SE / HoDoKu rating clone | `out-of-scope-now` | 只有 compatibility mapping 和 reference smoke | 不复刻完整 SE implication graph、排序和 difficulty clone | P3：如需要只做独立 profile/mapping，不影响 `classic-stable.v1` |

## Current State Inventory

| Bucket | Techniques / Area | Current Read |
| --- | --- | --- |
| Stable core | singles、subsets、fish、wings、ALS basics、coloring、chain、pattern、uniqueness mainline | 当前 `classic-stable` 已覆盖大多数 classic 9x9 human techniques；新增技巧不能抢占更简单稳定技巧 |
| Experimental implemented | direct 技巧、`almost-locked-quad`、`aic-als`、`big-wings`、`remote-pairs`、`larger-fish`、forcing family、`bug-plus-two`、`bug-plus-n` | 可以显式启用或经 galaxy 使用；继续提升时要补 proof/evidence，而不是盲目加预算 |
| Partial but useful | UR / HUR / UR-AIC / rectangle family、BUG+1/+2、X/Y/forcing chain subtype、Dynamic / Nested forcing | 主要差距是 subtype、proof summary、真实题面，不代表没有 finder |
| Missing, proof clear | 部分 HoDoKu-style chain subtype 标签、部分 fish/wings subtype evidence | 可直接实现或校准，风险低于 generalized loop / BUG+n |
| Defer | generalized Unique Loop、broader BUG+n / BUG Lite、full Dynamic / Nested proof tree、完整 SE rating clone | 先写 proof model 和 fixture 设计，不直接扩大实现 |

## Explicit Missing Coverage Plan

这些项目是当前明确未覆盖或不能宣称完整覆盖的范围。所有实现任务必须按“支持能力 -> fixture / negative -> finder / docs -> corpus”的顺序推进；没有前置支持时，不直接新增高风险 finder。

| Priority | Missing / incomplete area | Required support first | Implementation task after support | Acceptance gate |
| --- | --- | --- | --- | --- |
| P0 | Real-board corpus for implemented techniques | 已新增 `scripts/find-reference-rating-candidates.mjs`，可从文本题面、JSON `rows` / `samples` 字符串题面和 81-cell numeric array 题面筛目标技巧、输出 profile、score、hardest、step count、technique counts 和建议 corpus row，并支持 `--target-first` 把目标技巧临时提前用于发现、`--difficulty-first` 优先扫描高分 / 高 grade / 少 clue 候选、`--minimize-hit` 命中后贪心删 clue 并保持唯一解 + 命中、`--compare-normal-profile` 同时输出正常 profile 结果、`--hardest` 只返回指定 hardestTechnique、`--exclude-corpus` 去重和 `--per-candidate-timeout-ms` 隔离网页长尾题面；`scripts/synthesize-reference-rating-candidates.mjs` 可从生成的完整 solution grid 反向删 clue，保持唯一解并在 target-first 下寻找命中，再做保命中的 greedy minimization；`scripts/extract-web-sudoku-candidates.mjs` 可把搜索引擎 URL 列表抽成带 source id 的候选题面，支持 URL 参数、HoDoKu 原题块、裸 81 位字符串和论坛 ASCII grid；不能修改 `scripts/build-learning-samples.mjs` | 为 direct、single-digit pattern、X/Y cycle、uniqueness、ALS/fish/wings 各补正常 rating path rows；发现阶段可用 target-first 和 synthetic construction，但加入 `reference-rating-corpus.json` 前仍必须用 intended normal profile 复核 | `reference-rating-corpus.json` 增量通过；每行 uniqueness、known solution、replay、`verifyStep()` 全过 |
| P0 | Direct technique real-board coverage | direct real-board single-step smoke 和 no-hit guard 已覆盖 4 个 direct 技巧；normal rating path 仍被 singles/基础技巧吸收，需要继续筛选 profile 条件 | 若找到不被提前吸收的题面，再为 `direct-pointing`、`direct-claiming`、`direct-hidden-pair`、`direct-hidden-triplet` 各补 rating corpus | rating corpus 命中对应 direct count；若不可达则 docs 明确 direct 仅做 explicit single-step |
| P0 | Uniqueness real-board coverage | 已新增 AR、Rectangle Elimination、AIC-UR 真实题面 rows；继续收集 BUG+1、UR Type 1、Extended Rectangle、HUR 的正常 rating path 题面；必要时增加 corpus search diagnostics | 为已实现 uniqueness subtype 补真实题面 rows | rating corpus 覆盖 BUG+1、UR Type 1、AR 起步；不误删 solution candidate |
| P1 | AIC continuous / discontinuous loops | continuous loop、discontinuous weak/weak loop 和 discontinuous strong/strong placement loop 已有保守 finder 与 smoke；endpoint-chain 命中仍优先于 loop fallback；closed-loop no-hit 和 endpoint no-target guard 已补 | 后续补更多方向和真实题面 | reference smoke 固定 loop actions、links、placements、pattern；negative 防止无目标 loop 或普通 endpoint chain 被误报 / 误标 loop |
| P1 | X/Y cycle and X-chain real-board coverage | 先找到不被更简单技巧吸收的正常 rating path；若现有样本没有命中，补专门 corpus search | 为 `bidirectional-x-cycle`、`bidirectional-y-cycle`、`forcing-x-chain` 和 `x-chain` 各补真实题面 | rating corpus 至少各 1 行；hardest/score/step count 固定 |
| P1 | Fish / wing subtype evidence | fish smoke 分组和 X-Wing / Swordfish / Jellyfish / Franken / finned / sashimi `pattern` / `expectedCells` 已完成，普通 fish、普通 Franken 和 8 个 fish 入口 no-target negative guard 已有；wing smoke 已覆盖 XY/XYZ/WXYZ/W-Wing/BigWings/Chute Remote Pairs/Remote Pairs，且这些入口均已有 no-target guard；其中 W-Wing 和 Remote Pairs 有 selected link gate，全部 wing rows 有 `expectedCells` proof-role gate；XY-Wing、XYZ-Wing、W-Wing、WXYZ-Wing、Big Wings、Chute Remote Pairs、Finned X-Wing、Swordfish、Franken Swordfish、Jellyfish、Finned Swordfish、Finned Jellyfish、Sashimi X-Wing、Sashimi Swordfish、Finned Franken Swordfish、Finned Franken Jellyfish 已进入真实题面 corpus | fish / wing 已新增 Swordfish、Franken Swordfish、Jellyfish 和 Finned Jellyfish 真实题面；后续继续补更多真实题面 corpus；必要时再补 HoDoKu-style fish/wing subtype negative guard | reference smoke 覆盖代表 subtype + negative guard；presentation 不退化 |
| P1 | ALS / AHS proof evidence | Almost Locked Pair/Triple/Quad、ALS-XZ/XY、AIC-ALS、APE、Death Blossom、Fireworks、Twinned XY、Sue-de-Coq 已固定 `{ family: "als", subtype }`；RCC 类有基础 links；reference smoke 已用 `minNodes` / `expectedNodes` 固定关键 nodes；Almost Locked Pair、Almost Locked Triple、Almost Locked Quad、ALS-XZ、ALS-XY-Wing、AIC-ALS、Death Blossom 已进入真实题面 corpus | APE、Fireworks、Twinned XY、Sue-de-Coq 仍未在当前真实题面搜索中命中；剩余补 endpoint proof 文案压缩、negative guard 和更多真实题面 | smoke + no-hit + `verifyStep()`；真实题面逐步补 |
| P1 | UR Type 2 / 5 / 6 mapping | 基础 UR node evidence 已完成；shared-roof common-extra 已固定为保守 `type-2-shared-extra` 且 row/column roof 方向均有 smoke；HUR strong-link corner 已固定为 `type-6-strong-link-corner` 且 row/column 两个几何方向均有 smoke；UR-AIC floor-roof chain 左右方向均有 smoke，mirrored no-target、single-roof conjugate boundary 和 HUR conjugate boundary guards 已补；仍需拆清 Type 5 与完整 Type 6 边界 | 在现有 `unique-rectangle` / `hidden-unique-rectangle` / `aic-ur` 中补更细 subtype 或新增保守 finder | positive/no-hit smoke；`minNodes` 固定 proof boundary；不把非等价形态宣称为 SE subtype |
| P1 | BUG+2 non common-extra variants | 基础 `bug-base` / `bug-extra` / BUG+1 parity / BUG+2 common-extra target node evidence 已完成；已新增 bounded non-common parity-elimination positive fixture、subtype、proof mode 和 completion budget 审计输出 | 继续把 bounded completion proof 扩展为更通用 parity proof；保持 experimental | positive/no-hit smoke；solution safety audit；真实题面后补 |
| P2 | Broader BUG+n / BUG Lite | 保守 `bug-plus-n` shared-extra common-target 已有 positive/no-hit smoke；仍需实现通用 BUG candidate graph、multi-extra proof summary、multi-extra target rule、negative fixture generator | 默认不进 stable；扩大 BUG+n 前必须先补 solution-safety 和真实题面 | proof summary 可审计；多组 no-hit；性能预算；真实题面 |
| P2 | Generalized Unique Loop | 先设计 loop compression、deadly pattern detection、target proof、`evidence.nodes` loop path；明确和 `extended-rectangle` / `sk-loops` 的边界 | 新增 finder 或扩展 uniqueness family；不得把当前 `extended-rectangle` 直接宣称为完整 Unique Loop | loop positive/no-hit smoke；real-board row；docs 明确 partial/covered |
| P2 | Full Dynamic / Nested Forcing proof tree | 先补 branch proof tree schema、node budget、time budget、truncation semantics、replay-error isolation reporting | 扩展 DFC/DFC+/Nested 的共同结论 reduction 和 proof compression | branch evidence schema 校验；benchmark；真实题面；不进入默认热路径 |
| P2 | Mutant / larger fish | `larger-fish` size 5/6/7 普通 fish 和 conservative `mutant-fish` size-3 mixed-cover fish 已有 positive/no-target smoke；继续设计 fish basis/cover abstraction、box/line mixed cover、fin/sashimi target safety 和 endofin/overlap scope | 扩展更通用 mutant fish 或 endofin / overlap fish 前先补 smoke/no-hit | 不误删；预算稳定；docs 标为 extension 或 mapped subtype |
| P2 | Template / exotic pattern proof summary | Pattern Overlay、Exocet、Double Exocet、Tridagons、SK Loops 已有 reference smoke / node evidence / 短 proof note；Double Exocet 已补 no-hit guard，Pattern Overlay 已补 template count / budget proof note；下一步补 source/provenance notes 和真实题面 | 扩展 `pattern-overlay`、Exocet、Double Exocet、Tridagons、SK Loops evidence | smoke + real-board + presentation |
| P3 | Full SE / HoDoKu rating clone | 先做独立兼容性研究；不能影响 `classic-stable.v1` | 若需要，只能作为单独 policy/mapping 文档，不作为默认行为 | 明确 non-goal；不承诺完全复刻 |

## Implementation Task List

| Order | Task | Files | Acceptance |
| --- | --- | --- | --- |
| 1 | Real-board corpus harness | `tests/fixtures/reference-techniques/reference-rating-corpus.json`, `scripts/audit-reference-rating-corpus.mjs`, `scripts/find-reference-rating-candidates.mjs`, `scripts/synthesize-reference-rating-candidates.mjs`, `scripts/extract-web-sudoku-candidates.mjs` | 已补 `firstTechniqueSteps`、`techniqueCountGaps`、`techniqueCountsAtMost`、候选题面搜索输出、JSON numeric array 输入、learning `samples` 容器输入、target-first 发现模式、difficulty-first 扫描排序、命中后 greedy clue minimization、normal-profile 对照输出、solution-grid 反向构造候选、`--hardest` 过滤、`--exclude-corpus` 去重、`--per-candidate-timeout-ms` 单题 worker 超时和 URL 列表网页题面抽取；网页抽取支持 `bd=` / `playsudoku?p=` / `puzzle=` / `grid=`、HoDoKu 原题块、裸 81 位字符串、论坛 9 行 ASCII grid 和 curl fallback；不改 `scripts/build-learning-samples.mjs`；下一步用 target-first / high-difficulty / minimized / synthetic 候选继续补 direct / uniqueness / chain rows |
| 2 | Direct real-board corpus | `reference-smoke.json`, `reference-rating-corpus.json` | 已补 4 个 direct 技巧的 real-board single-step smoke；继续找正常 rating path，确认是否可被内置 profile 命中 |
| 3 | Uniqueness corpus and guards | `reference-rating-corpus.json`, `reference-smoke.json`, `SE_UNIQUENESS_MATRIX.md` | 已补 AR、Rectangle Elimination、AIC-UR 真实题面；UR Type 5 已有 positive、no-target、非 deadly pair 和 Type 2 边界 smoke；继续补 BUG+1、BUG+2、UR Type 1/2/3/4/5、Extended Rectangle、HUR 的真实 rating-path row，并继续拆 Type 6 no-hit |
| 4 | Chain corpus and no-hit | `reference-rating-corpus.json`, `SE_CHAIN_MATRIX.md`, `reference-smoke.json` | X-cycle、X-Chain open-chain、Y-cycle、XY-Chain open-chain、classic coloring extension、grouped-X-Cycles、forcing-x-chain、AIC loop / endpoint negative guard 各补代表 rows |
| 5 | ALS / fish / wing corpus | `reference-rating-corpus.json`, `reference-smoke.json` | ALS family、fish variants、wing variants 补真实题面；必要时补 no-hit guard |
| 6 | Missing finder design gates | docs + fixtures | BUG+2 更通用 non common-extra、BUG+n、generalized Unique Loop、mutant/larger fish、full Dynamic/Nested proof tree 先补 proof design 和 positive/no-hit fixture，再写 finder |
| 7 | Validate | npm scripts | 跑 `npm run typecheck`、`npm run audit:reference`、`git diff --check`、`npm run smoke:dist`、`npm run examples:typecheck`；`npm test` 当前全量路径有 OOM 风险，需单独跟踪 |

### Recent Corpus Search Notes

- Multi-path completion push, 2026-06-17:
  - Path A search-engine expansion: search outside the already exhausted SudokuWiki / HoDoKu / DailySudoku / first EnjoySudoku batches, prioritizing pages with URL parameters, raw 81-character puzzle strings, `Code:` blocks, ASCII grids, or downloadable puzzle banks.
  - Path B forum pagination sweep: continue relevant EnjoySudoku / SudoCue / DailySudoku threads by page and source group instead of one huge batch; split oversized sources before validation.
  - Path C local-bank continuation: re-run `audit-reference-gaps.mjs` / `find-reference-rating-candidates.mjs` only on not-yet-exhausted or newly generated candidate pools, with explicit start rows and per-candidate timeout.
  - Path D source-format expansion: when pages expose embedded JavaScript, HTML tables, line-prefixed grids, or compressed query strings not handled by the extractor, extend `extract-web-sudoku-candidates.mjs` with a targeted parser before scanning.
  - Path E candidate-state fallback: when original puzzles repeatedly miss but a trusted public page gives a mid-solve candidate grid, document it as candidate-state smoke/provenance only; do not count it toward real-board corpus.
  - Discovery rule: first scan hard candidates with `--difficulty-first --target-first --compare-normal-profile --minimize-hit` so target techniques are not hidden by normal ordering during discovery.
  - Construction rule: when existing banks do not yield target-first or normal-profile hits, run `npm run synthesize:reference-candidates -- --target <id> --target-first --minimize-hit --compare-normal-profile` to synthesize unique candidate puzzles from generated solution grids before manual fixture work.
  - Validation rule: add a row only when puzzle is parseable, unique, `rate()` solves under the intended normal profile, and full original-puzzle or minimized-puzzle rating path has `techniqueCounts[target] > 0`; then pin score, step count, hardest technique and technique counts.

- Completed next suggested task list, 2026-06-17:
  - T1 ALS exotic web sweep: searched non-exhausted forum pages for `aligned-pair-exclusion`, `fireworks`, `sue-de-coq`, `twinned-xy-chains` and `almost-locked-quad`; extracted a new `next-task-web` candidate batch.
  - T2 Chain / fish / wing web sweep: searched `empty-rectangle`, `skyscraper`, `two-string-kite`, `turbot-fish`, `remote-pairs`, `sashimi-jellyfish`, `larger-fish` and `unique-loop`; included text-board candidates in the same batch.
  - T3 UR / BUG web sweep: searched `bug-plus-one`, `bug-plus-two`, `bug-plus-n`, `unique-rectangle`, `hidden-unique-rectangle` and `extended-rectangle` examples outside already exhausted SudokuWiki / HoDoKu pages; included candidates in the same batch.
  - T4 Validate new batches: scanned 47 priority candidates with 0 hits and 4 timeouts; scanned 1006 `fireworks-t39513-45` candidates in seven chunks with 2 `almost-locked-quad` hits and 6 timeouts; added the first solved+unique full-rating-path hit as `classic-galaxy-almost-locked-quad-path`.
  - T5 Record results and run gates: updated notes and implementation status; `npm run audit:reference`, `npm run audit:coverage` and `git diff --check` passed.

- `dist/tmp/learning/game-500-source.json` under `classic-galaxy`, excluding existing corpus rows, has no remaining solved+unique full-rating-path hit for `unique-rectangle`、`hidden-unique-rectangle`、`extended-rectangle`、`bug-plus-one`、`bug-plus-two`.
- 额外扫描 `dist/tmp/all-local-puzzle-candidates.txt`、`dist/tmp/repo-puzzle-candidates.txt`、`dist/tmp/learning/classic9-game-500*.json`、alternatives 和非空 underfilled learning sample JSON 后，`classic-galaxy` 下仍没有新的 solved+unique full-rating-path hit for `bug-plus-one` / `bug-plus-two`。
- 网络复查 SudokuWiki BUG exemplars、Sudopedia BUG+1 practice puzzles 和 HoDoKu `bug101` / `bug102`：公开原题在当前内置 profiles 下会被更早技巧吸收，未形成 BUG full rating-path row；HoDoKu `bug101` 的外部候选态已作为 `reference-smoke.json` trusted BUG+1 row 固定，HoDoKu `bug102` 已作为 trusted no-hit guard 固定单三值但 parity 不成立的边界。
- 批量抓取 HoDoKu `tech_ur.php`、`tech_chains.php`、`tech_col.php` 中 33 个公开 UR / HUR / BUG / X-Chain / XY-Chain / AIC / grouped-chain 示例原题后，`classic-galaxy` 完整 rating path 对 `bug-plus-one`、`bug-plus-two`、`unique-rectangle`、`extended-rectangle`、`hidden-unique-rectangle`、`bidirectional-x-cycle`、`bidirectional-y-cycle`、`forcing-x-chain`、`aic`、`grouped-aic` 仍无新增命中；UR Type 5 finder 加入后复核 HoDoKu u501/u502 原题，u501 完整路径仍无 `unique-rectangle`，u502 当前 galaxy 路径未解且无 `unique-rectangle`；这些示例适合作为候选态 smoke 来源，不适合作为当前 corpus row。
- 定点复查学习样本里出现过的 `hard-011`、`expert-099`、`hard-022`、`expert-086`、`expert-017`、`epic-090` 等 ID 后，UR/HUR/BUG/Extended 命中来自中途候选态或已入 corpus 题面，不适合作为新的 rating corpus row。
- 同一批源题在 `classic-galaxy` 下也没有新的 solved+unique full-rating-path hit for `bidirectional-x-cycle`、`bidirectional-y-cycle`、`forcing-x-chain`、`skyscraper`、`two-string-kite`、`turbot-fish`、`empty-rectangle`.
- 使用 `--hardest` 复筛后，`dist/tmp/learning/game-500-source.json` 在 `classic-galaxy` 下仍没有 hardest 为 `bidirectional-x-cycle`、`bidirectional-y-cycle`、`forcing-x-chain`、`skyscraper`、`two-string-kite`、`turbot-fish`、`empty-rectangle` 的 solved+unique full-rating-path hit。
- 使用 `--hardest` 复筛后，`dist/tmp/learning/game-500-source.json` 和 `dist/tmp/learning/classic9-game-500-alternatives-overused-gt-4/input-filtered-sorted.json` 在 `classic-galaxy` 下没有 hardest 为 `direct-pointing`、`direct-claiming`、`direct-hidden-pair`、`direct-hidden-triplet` 的 solved+unique full-rating-path hit。
- 同一批源题在 `classic-galaxy` 下没有 solved+unique full-rating-path hit for `finned-jellyfish`、`sashimi-jellyfish`、`aligned-pair-exclusion`、`fireworks`、`twinned-xy-chains`、`death-blossom`、`sue-de-coq`; `almost-locked-quad` 也未命中。
- `dist/tmp/learning/classic9-game-500-alternatives-overused-gt-4/input-filtered-sorted.json` 和 hardcap4 镜像源在 `classic-galaxy` 下可命中 `chute-remote-pairs`，但没有命中 `remote-pairs`、`sashimi-jellyfish`、`almost-locked-quad` 或特殊 ALS 目标。
- `dist/tmp/learning/classic9-game-500-underfilled-untried/*/classic9-learning-samples.json` 现可由候选搜索脚本读取 `samples` 容器；`fireworks`、`twinned-xy-chains`、`exocet` 样本的完整原题 rating path 未复现目标命中，SK Loops / Tridagons / Double Exocet underfilled 样本为空，不能直接作为 rating corpus row。
- `dist/tmp/learning/game-500-source.json` 和 alternatives 源在 `classic-galaxy` 下没有 `exocet`、`double-exocet`、`pattern-overlay`、`tridagons`、`sk-loops` 的 solved+unique full-rating-path hit；使用 `--hardest` 复筛同样无命中。
- 网页/搜索引擎扩展扫描已覆盖 SudokuWiki `bd=` 页面、PuzzleMadness `playsudoku?p=` 练习题、HoDoKu `show_example.php` 原题抽取和 EnjoySudoku/SudoCue 等论坛文本题面。已验证批次包括 BUG/UR、X/XY/AIC chains、single-digit chain、APE/Death Blossom/Sue-de-Coq、Fireworks、Exocet/SK Loops/Pattern Overlay/Tridagon、HoDoKu uniqueness、HoDoKu finned/sashimi fish 和 SudokuWiki Jelly Fish Strategy；EnjoySudoku benchmark list 已补到 `death-blossom` solved+unique full-rating-path row。候选脚本现用 `--per-candidate-timeout-ms` 避免 Exocet/SK Loops 等单题长尾阻塞整批搜索，并保留文本候选行中的 source id 以便追踪网页 provenance。
- 更大批量网页复扫：HoDoKu `tech_sdp.php`、`tech_col.php`、`tech_als.php`、`tech_wings.php`、`tech_fishb.php`、`tech_fishc.php`、`tech_fishfs.php`、`tech_chains.php`、`tech_ur.php` 共抽出 108 个清洗后的 original-sudoku 候选，`classic-galaxy` 下对 remaining missing targets 命中 0/108；SudokuWiki Strategy Families 相关 40 页共抽出 353 个候选，按 rows 1、76、151、226、301 分段扫描后命中 0/353，记录 5 个 per-candidate timeout。额外搜索引擎 URL 批次覆盖 `Twinned_XY_Chains`、`Whats_New`、`Version_History`、`Extended_Unique_Rectangles`、`Remote_Pairs`、`Forcing_Nets` 等页面，抽出 71 个候选并命中 0/71，记录 5 个 timeout。DailySudoku 论坛 APE / Death Blossom / Sue-de-Coq / Fireworks-style 搜索结果现可通过 ASCII grid 抽取，已抽出 17 个候选并命中 0/17 ALS exotic target，记录 1 个 timeout；其中已知 APE 论坛题被当前完整路径吸收到 `finned-x-wing`。HoDoKu ALS 页有一个 APE 相关原题在未解 partial path 中出现 `aligned-pair-exclusion`，但因为完整 rating path `solved=false`，只能作为候选态研究线索，不能加入 real-board corpus。
- EnjoySudoku / mixed web 扩展：初始 `enjoysudoku-extra` / `enjoysudoku-http` 批次从 DailySudoku / Ironmonger / EnjoySudoku 搜索 URL 合计抽出 6 条候选，命中 0；`mixed-web-extra` 覆盖 SudoCue、Walter Bislins、gamesudoku、SourceForge 和 Reddit 链接，3/7 URL 可访问但抽出 0 条候选；`enjoysudoku-tech-extra` 覆盖 Fireworks、Sue de Coq 和 APE 相关主题，抽出 47 条候选并命中 0，记录 1 个 timeout；`enjoysudoku-search-extra` 覆盖 Remote Pairs、Unique Loop、Sashimi Jellyfish、Empty Rectangle、Sue de Coq、BUG+3 和 benchmark list 主题，抽出 112 条候选，在 `classic-galaxy` 下命中 1 条 `death-blossom`，已新增 `classic-galaxy-death-blossom-path`。后续 `next-task-web` 批次覆盖 ALS exotic、chain/fish/wing、UR/BUG 目标 URL 20 个，抽出 1053 条候选；47 条 priority 候选命中 0，`fireworks-t39513-45` 的 1006 条候选分段扫描命中 2 条 `almost-locked-quad`，已新增 `classic-galaxy-almost-locked-quad-path`。当时 `audit:reference` 通过 39/39，`audit:coverage` 显示 rating corpus 42、stable missing rating corpus 26、experimental missing rating corpus 22；0.4.0 当前已提升到 90/90。
- Multi-path expansion follow-up：Path A 新增 St. Olaf、Quatrian、Ironmonger、SudokuCoach/Taupier 等来源到 `multipath-extra`，22 个 URL 中 19 个可访问，抽出 16 条 Ironmonger 原题并命中 0；St. Olaf “12000 Method Examples”主要暴露 `MARKS=` 候选态链接，适合作为 candidate-state/provenance 线索，暂不计入 real-board corpus。Path A 另从搜索结果整理 8 条 SudokuWiki `bd=` 直链到 `bd-link-extra`，抽出 8 条并命中 0，记录 1 个 timeout。Path C 专项本地池复扫：`missing-als-pattern-small-candidates` 35 条命中 0、1 timeout；`missing-chain-audit-candidates` 28 条命中 0、2 timeouts；`x-coloring-candidate` 1 条命中 0；`missing-als-pattern-audit-candidates` rows 1-500 命中 0、8 timeouts；`missing-stable-audit-candidates` rows 1-250 命中 0、8 timeouts；`missing-uniqueness-audit-candidates` rows 1-250 命中 0、1 timeout。两个旧临时 JSON (`hidden-quad-audit-candidates`、`current-missing-technique-hit-scan`) 不符合当前候选脚本输入格式，只作为历史调试文件保留。
- Multi-path continuation：Path C 续扫本地专项池后半段，`missing-als-pattern-audit-candidates` rows 501-750 命中 0、2 timeouts；`missing-stable-audit-candidates` rows 251-500 命中 0、1 timeout；`missing-uniqueness-audit-candidates` rows 251-500 命中 0、1 timeout。Path E 复查 St. Olaf 示例页 HTML，`examples.htm` 只列出方法分类，具体 `ex_A1w.htm` / `ex_P.htm` 等页面的链接形态为 `index.htm?puzzle=i520...&MARKS=...`，包含候选态 marks 和解法说明，但没有原始 givens/grid；因此当前只能作为 trusted candidate-state / provenance 来源，不能直接生成 real-board rating corpus row。
- Multi-path continuation 2：Path C 已扫完本地专项池剩余段，`missing-als-pattern-audit-candidates` rows 751-953 命中 0、3 timeouts，`missing-uniqueness-audit-candidates` rows 501-581 命中 0、1 timeout；至此 ALS audit 953 条、stable audit 500 条、uniqueness audit 581 条均已按当前剩余目标复扫完毕，未新增 real-board hit。Path A/B 继续扩展外部原题来源：`uniqueness-chain-extra` 覆盖 SudokuWiki HUR、SudoCue UR/HUR、DailySudoku Extended UR、Sudopedia 和 GitHub/Gitee 教程页，9 个 URL 中 8 个可访问，抽出 9 条候选并命中 0；`chain-medusa-extra` 覆盖 SudoCue / EnjoySudoku 的 AIC、XY-Chain、3D Medusa、Remote Pairs、Nishio 相关页面，抽出 4 条候选并命中 0；`pattern-extra` 覆盖 EnjoySudoku Exocet / SK Loop / Tridagon / Pattern Overlay、SudokuWiki Pattern Overlay、Sudopedia 和 GitHub pattern examples，10 个 URL 中 9 个可访问，抽出 10 条候选并命中 0，记录 1 timeout。以上新来源仍可作为 provenance/candidate-state 线索，但不应加入 `reference-rating-corpus.json`。

## SE 覆盖 Backlog

| Priority | Task | Current Status | Notes |
| --- | --- | --- | --- |
| P0 | Reference real-board corpus | 43 条真实题面 corpus 已建立，并新增 grouped-AIC / forcing-chain / hidden-triple / naked-quad / hidden-quad / x-coloring / mutant-fish / death-blossom / almost-locked-quad，以及 target-first direct / UR-HUR-chain / remote-empty / ALS-pattern-fish rows；audit 已输出 first technique step、technique count gaps 和 coverage matrix，当前 rating coverage 59；覆盖仍不足 | 继续覆盖 BUG、Unique Loop、remaining chain/coloring、remaining pattern/exotic 和 forcing partial 项；不要用人工候选态替代 rating corpus |
| P0 | Direct fixture expansion | finder 首版已完成；4 个 direct 技巧已有 real-board single-step smoke | 继续找不被 singles/subsets 吸收的 rating path；找不到时保留 explicit single-step coverage 口径 |
| P0 | Single subtype evidence | `full-house` / `hidden-single` 已有 `evidence.pattern.subtype` | 后续只需补 reference corpus，暂不拆 public id 或分值 |
| P1 | BUG variant matrix | `bug-plus-one` stable、`bug-plus-two` common-extra / bounded non-common parity-elimination experimental、`bug-plus-n` shared-extra common-target experimental 均已进入 reference smoke | 下一步补 BUG+1 / BUG+2 / BUG+n 真实题面 fixture；broader BUG+n / BUG Lite 先收集样例再扩大 finder |
| P1 | Unique Rectangle / Unique Loop mapping | matrix 已建立，主要已实现 uniqueness finder 已补 reference smoke；UR Type 2 shared-extra 和保守 UR Type 5 已有 subtype；AR、Rectangle Elimination、AIC-UR 已有真实题面 fixture | 下一步补 UR / HUR / Extended Rectangle / UR Type 5 真实题面 fixture；generalized Unique Loop 暂不新增 finder |
| P1 | Chain subtype calibration | X/Y cycle、forcing chain、region forcing chain、single-digit pattern chain 已有入口；当前 smoke 已固定主要入口 pattern、X-cycle 两种基础 subtype、AIC same / different endpoint / continuous loop / weak-weak discontinuous loop / strong-strong discontinuous loop、grouped AIC same / different endpoint、Grouped X-Cycles no-target、Skyscraper row/col、Empty Rectangle row/column、Turbot 8 种 house 序列和 Two-String Kite 9 个 box 方位 | 下一步补长度分值、更多方向、剩余 negative guard 和真实题面 |
| P1 | Fish / wing subtype calibration | finned/sashimi/franken fish、`larger-fish` size 5/6/7、conservative `mutant-fish` 和主要 wing family 已固定 pattern evidence；`w-wing` / `remote-pairs` 有 selected link evidence；XY-Wing、XYZ-Wing、W-Wing、WXYZ-Wing、Big Wings、Chute Remote Pairs、Finned X-Wing、Swordfish、Franken Swordfish、Jellyfish、Finned Swordfish、Finned Jellyfish、Sashimi X-Wing、Sashimi Swordfish、Finned Franken Swordfish、Finned Franken Jellyfish 已有真实题面 | 下一步补 Larger/Mutant Fish 和更多 fish / wing 真实题面和必要 no-hit guard |
| P1 | ALS family expansion | `almost-locked-pair` / `almost-locked-triple` stable，`almost-locked-quad` experimental 已实现；ALS-XZ/XY/AIC-ALS、APE、Death Blossom、Fireworks、Twinned XY、Sue-de-Coq 已固定 subtype evidence 和最小 node evidence；Almost Locked Pair、Almost Locked Triple、Almost Locked Quad、ALS-XZ、ALS-XY-Wing、AIC-ALS、Death Blossom 已有真实题面 | 下一步补 APE、Fireworks、Twinned XY、Sue-de-Coq 和更多 ALS family 真实题面、negative guard 和更完整 endpoint proof |
| P1 | Nishio evidence corpus | `nishio-forcing-chains` 已 stable | 用真实题面校准 contradiction evidence，防止只靠候选态样例 |
| P2 | Explicit missing coverage | 已列入上方 Explicit Missing Coverage Plan | 任何 BUG+n、Generalized Unique Loop、AIC loop、mutant fish、full forcing proof tree 等实现前，必须先完成对应 Required support first |
| P2 | Dynamic Forcing Chains | experimental partial 已实现 | 已有有界动态分支入口；后续补 proof tree、节点预算、时间预算和真实题面 fixture |
| P2 | Dynamic Forcing Chains (+) | experimental partial 已实现 | 已有更深、更宽预算的 DFC+ 入口；后续补 proof tree、节点预算、时间预算和真实题面 fixture |
| P2 | Nested Forcing Chains | experimental partial 已实现 | 已有单候选 contradiction 入口和一层受控 forcing 嵌套；后续补共同结论 reduction、proof tree 压缩、节点预算、时间预算和真实题面 fixture |
| P2 | Full external-reference release audit | smoke gate 已有 | 增加 hardest technique、step count、elapsedMs、mismatch 输出 |

## API / DX Backlog

| Priority | Task | Recommendation |
| --- | --- | --- |
| P1 | `hint()` facade | 直接实现；它是 `nextStep()` 的低门槛入口，不替代高级 API |
| P1 | API decision table | 直接补 README / API 文档 |
| P1 | Migration guide | 直接补文档，降低从 simpler packages 迁移成本 |
| P1/P2 | Compact summaries | 直接实现 helper，不替代 rich result |
| P1 design | `solve` naming | 暂不实现含糊的 `solve()`；如需要，优先讨论 `solveWithLogic()` vs `solveAny()` |
| P2 | Matrix adapters | 已补 `fromMatrix()` / `toMatrix()`；核心仍保留 flat 81-cell board |
| P2 | Nullable adapters | 已补 `fromNullableBoard()` / `toNullableBoard()`，方便 UI 应用 |
| P3 | Hint provider registry | 暂不进 core；等 session companion 或 custom technique 需求明确后再评估 |

## Generation Backlog

| Priority | Task | Recommendation |
| --- | --- | --- |
| P1 design | Fast preset seed metadata | 先设计 seed 格式，必须包含 provenance、license、solution、canonical key、rating policy/version、score、technique counts |
| P1 | Original verified seed set | 只能使用原创或明确许可题库；禁止复制来源不清 seed pool |
| P1 | Transform-based fast generation | 和 `generateOne()` 分开，承诺“快速返回 verified preset transform”，不承诺满足复杂约束 |
| P1/P2 | Generator presets | 可以封装 `generateOnePreset()`，但 difficulty 必须绑定 policy/version |
| P2 | Rejection diagnostics | 补最近 rejection examples、too easy/too hard、uniqueness timing、solver stuck reason |

## Performance / Budget Backlog

| Priority | Task | Recommendation |
| --- | --- | --- |
| P1 | Solution enumeration interface | 先定义内部 benchmark abstraction，不急着公开 |
| P1 | DLX / optimized MRV benchmark | 已补 `benchmark:uniqueness` 固定样例基准入口；后续用它对比 optimized MRV / DLX prototype |
| P1 | Uniqueness budget diagnostics | 已补 `searchDiagnostics`、`exhausted` 和 `solutionCountLowerBound`；后续如要引入 `unknown` status 需要主版本级 API 设计 |
| P2 | Broader benchmark suite | 覆盖 parse、validate、nextStep、walkthrough、rate、generateOne、canonicalizeBoard |
| Guardrail | Candidate representation | human solver 继续使用 bitset；exact-cover 只考虑 solution counting |

## App / Session Backlog

| Priority | Task | Recommendation |
| --- | --- | --- |
| P1 design | Session-layer design note | core 保持 UI-free；session layer 可放 companion package 或 examples |
| P2 | Notes / undo / redo prototype | 应用层维护用户状态，classic9 只提供 state bridge、hint、format、replay |
| P2 | Hint application helper | 如果出现重复需求，可在 companion 中把 `SolveStep` 应用到 session |

## Non-Goals

这些不应进入 `classic9` core：

| Non-goal | Reason |
| --- | --- |
| UI framework dependency | core 应保持 framework-free |
| Killer / X / 16x16 等变体 | 应拆成独立包，不污染 classic 9x9 |
| 用 strategy string 替代 `SolveStep` | 会丢失结构化 evidence 这个核心优势 |
| 用 clue count 作为 difficulty | 容易误导，和 technique policy 无关 |
| 导入未知来源 seed pool | 有 license、质量和 provenance 风险 |
| 暴露含糊的 `solve()` | 必须先明确 human-logic solve 还是 any-solution search |
| 复制 GPL 或许可不清代码 | 只允许独立重实现算法思路 |

## Suggested Sequence

1. 完成当前直接执行项：`hint()`、summary helpers、`-` parser、README/API decision table、migration guide。
2. 建立真实题面 reference rating corpus，覆盖 direct、chain、uniqueness partial 项。
3. 基于已建立的 BUG / Unique Loop matrix 补真实题面 fixtures。
4. 做 uniqueness benchmark，并评估是否需要在下一版引入独立 `unknown` status。
5. 设计 fast preset seed metadata 和小型原创 verified seed set。
6. 在 proof tree 和预算机制成熟后，再评估 Dynamic / Nested Forcing。
