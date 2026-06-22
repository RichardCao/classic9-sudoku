# SE Chain Matrix

本文档固定当前 chain / cycle 相关技巧与 Sudoku Explainer / Sukaku Explainer 术语之间的映射边界。它是 `SE_COMPATIBILITY.md` 的补充，不表示已经复刻 SE 的完整 implication graph、排序或 difficulty 细分。

## Scope

当前目标是先把已实现入口的行为锁住：

1. public `TechniqueId` 到外部名称的映射。
2. 当前 finder 复用关系。
3. `evidence.links` 的基本形状。
4. reference smoke 中已经固定的 action / link 下限。
5. 后续仍需补齐的 subtype 和真实题面。

## Current Mapping

| External area | Public entry | Internal model | Status | Evidence boundary |
| --- | --- | --- | --- | --- |
| Bidirectional X-Cycle | `bidirectional-x-cycle` | 复用 `simple-coloring` 的 single-digit strong-link coloring | `covered-as-variant` | reference smoke 固定 two-color trap 和 same-color contradiction 两种 subtype 的 target elimination、strong link 下限和 pattern。 |
| Classic coloring extensions | `simple-coloring`, `multi-colors`, `three-d-medusa` | classic9 coloring / Medusa finders | `non-se-extension` | 当前保留为 classic9 public entries；reference negative smoke 固定有 coloring / Medusa 结构但没有可用 target candidate 时不返回步骤。 |
| Grouped X-Cycles | `grouped-x-cycles` | grouped single-digit node path | `non-se-extension` | 当前保留为 classic9 grouped-chain entry；reference negative smoke 固定 grouped path 没有 common-seen target 时不返回步骤。 |
| Forcing X-Chain | `forcing-x-chain` | 复用 `x-chain` 的 single-digit strong-link path | `covered-as-variant` | reference smoke 固定 target elimination、至少 3 条 strong links，并要求 `{ family: "forcing-x-chain", subtype: "even-strong-link-chain" }`。 |
| X-Chain | `x-chain` | single-digit strong-link path | `partial` | `evidence.pattern` 使用 `{ family: "x-chain", subtype: "even-strong-link-chain" }`；open-chain no-target guard 已补；仍需更多方向和真实题面。 |
| Single-digit pattern chains | `skyscraper`, `two-string-kite`, `turbot-fish`, `empty-rectangle` | 独立 single-digit strong-link pattern finder | `covered-as-classic-pattern` | reference smoke 固定各自 target elimination、pattern subtype、最小 strong/weak link 下限和 `expectedCells` reason / target roles；Skyscraper 已覆盖 row/col base，Two-String Kite 已覆盖 9 个 box 方位，Turbot 已覆盖 8 种 strong-weak-strong house 序列，Empty Rectangle 已覆盖 row/column conjugate；这些技巧仍作为独立 classic9 技巧，不并入 SE `forcing-x-chain` 入口。 |
| Bidirectional Y-Cycle | `bidirectional-y-cycle` | 复用 `xy-chain` 的 bivalue path | `covered-as-variant` | `evidence.pattern` 使用 `{ family: "xy-chain", subtype: "bidirectional-y-cycle" }`；reference smoke 固定 target elimination、mirror direction 和 strong/weak link 下限；no-target guard 已补。 |
| XY-Chain | `xy-chain` | bivalue path | `partial` | `evidence.pattern` 使用 `{ family: "xy-chain", subtype: "open-chain" }`；open-chain no-target guard 已补；仍需更多 subtype 和真实题面。 |
| Forcing Chain / Bidirectional Cycle | `forcing-chain` | 复用 `aic` 的 alternating inference chain | `covered-as-variant` | reference smoke 固定 target elimination、至少 2 条 strong links、1 条 weak link，并要求 `{ family: "forcing-chain", subtype: "same-digit-endpoints" }`。 |
| AIC | `aic` | alternating inference chain | `partial` | 输出 strong/weak `evidence.links`；reference smoke 已固定 `same-digit-endpoints`、`different-digit-endpoints`、`continuous-loop`、`discontinuous-loop-weak-weak` 和 `discontinuous-loop-strong-strong`，并用 `expectedCells` 固定代表性 reason / target roles；same-endpoint 镜像方向、different-endpoint transpose 方向、continuous-loop column 方向、weak/weak column loop、strong/strong shifted loop 和 closed-loop no-hit 已补；仍需更多方向和真实题面。 |
| Grouped AIC | `grouped-aic` | grouped candidate node AIC | `partial` | 输出 strong/weak `evidence.links`；同时用 `evidence.nodes` 标出 grouped candidate node 的完整 cell set，避免只看代表 cell；reference smoke 已固定 `same-digit-endpoints` / `different-digit-endpoints` 及其代表镜像方向，并用 `expectedNodes` / `expectedCells` 固定 grouped node 和 reason / target roles；ordinary AIC no-hit guard 固定必须包含 grouped node。 |
| AIC with Exotic Links | `aic-exotic` | AIC graph extension | `non-se-extension` | 本包扩展入口，不声明为 SE subtype 覆盖。 |

## Reference Smoke Coverage

`tests/fixtures/reference-techniques/reference-smoke.json` 的 `chains` 分组当前固定：

| Technique | Expected action | Link checks |
| --- | --- | --- |
| `bidirectional-x-cycle` | two-color trap: eliminate `r2c2` digit `1`; same-color contradiction: eliminate `r1c1` and `r2c2` digit `1` | trap `minLinks: 1`; contradiction `minLinks: 4`; both require only strong links |
| `forcing-x-chain` | eliminate `r1c3` digit `1` | `minLinks: 3`, `minStrongLinks: 3`, `minWeakLinks: 0` |
| `skyscraper` | col-base: eliminate `r1c4` digit `1`; row-base: eliminate `r4c1` digit `1` | `minLinks: 2`, `minStrongLinks: 2`, expected pattern `col-base` / `row-base` |
| `two-string-kite` | box `0..8` 方位均固定 target；基础样例 eliminate `r4c6` digit `1` | `minLinks: 3`, `minStrongLinks: 3`, expected pattern `box-linked-row-column-b0` through `b8` |
| `turbot-fish` | 8 个 house 序列均固定 target：`row-box-row`, `col-box-col`, `col-row-col`, `row-col-row`, `col-row-box`, `row-col-box`, `box-row-box`, `row-box-col` | `minLinks: 3`, `minStrongLinks: 2`, `minWeakLinks: 1`, expected pattern 为对应 house 序列 |
| `empty-rectangle` | column-conjugate: eliminate `r5c1` digit `1`; row-conjugate: eliminate `r1c5` digit `1` | `minLinks: 1`, `minStrongLinks: 1`, expected pattern `column-conjugate` / `row-conjugate` |
| `bidirectional-y-cycle` | eliminate `r1c2` digit `1` and mirrored `r1c8` digit `1` | `minLinks: 3`, `minStrongLinks: 3`, `minWeakLinks: 2`; no-target guard |
| `forcing-chain` | eliminate `r1c5` digit `4` | `minLinks: 3`, `minStrongLinks: 2`, `minWeakLinks: 1` |
| `aic` | same-digit endpoint: eliminate `r1c5` digit `4` and mirrored mini-chain `r2c2` digit `1`; different endpoint: eliminate `r3c9` digit `4` and transpose mirror `r9c3` digit `4`; continuous loop: loop weak links produce eliminations in row and column forms; weak/weak discontinuous loop: eliminate breakpoint candidate in row and column forms; strong/strong discontinuous loop: place breakpoint candidate in base and shifted forms | endpoint rows require expected pattern subtype and link minimums; loop rows require expected pattern, links and action shape, including placement for strong/strong |
| `grouped-aic` | different endpoint: eliminate `r3c3` digit `4` and mirrored `r3c7` digit `4`; same endpoint: eliminate `r3c3` digit `1` and transpose mirror `r3c3` digit `1` | different endpoint `minLinks: 5`; same endpoint `minLinks: 3`; both require grouped node, expected grouped `expectedNodes`, and expected pattern subtype |

这些 smoke rows 使用人工候选态，只固定 finder 可达性、动作形状、link evidence 和 replayability。部分 single-digit pattern 的双向/中心代表 rows 还通过 `expectedLinks` 固定 exact link endpoints、link type 和 house。它们不是真实题面 rating corpus。

## Known Gaps

| Gap | Risk | Next action |
| --- | --- | --- |
| X-cycle subtype labels | 已为 `bidirectional-x-cycle` smoke 固定 `two-color-trap` 和 `same-color-contradiction` 两种当前 finder subtype。 | 后续补真实题面和更细 SE difficulty bucket。 |
| X-chain subtype labels | 已为当前 `forcing-x-chain` smoke 和 `x-chain` no-target guard 固定 `even-strong-link-chain` / open-chain 边界。 | 后续补 chain length / endpoint relation 真实题面，再考虑更细 difficulty bucket。 |
| Single-digit pattern subtype labels | 已为 `skyscraper` 固定 row/col base，为 `empty-rectangle` 固定 row/column conjugate，为 `turbot-fish` 固定 8 种主要 house 序列，并为 `two-string-kite` 固定 9 个 box 方位和 link 下限。 | 后续补真实题面和更细 difficulty bucket。 |
| AIC subtype split | `aic` / `forcing-chain` 现在输出 endpoint / loop subtype；当前 smoke 固定 `forcing-chain` same-digit endpoint，以及 `aic` same / different endpoint、continuous loop、weak/weak discontinuous loop、strong/strong discontinuous loop；same-endpoint、different-endpoint、continuous-loop 和 discontinuous loops 已补代表镜像方向。 | closed-loop no-hit 和 endpoint no-target guard 已补；后续补更多方向和真实题面。 |
| Grouped node presentation | `grouped-aic` 已用 `evidence.nodes` 表达 grouped node cell set，并用 `pattern.subtype` 区分 same / different endpoint 类型；reference smoke 已用 `expectedNodes` 固定 grouped node 的完整 cell set和代表镜像方向；普通 `formatStep()` 仍主要按 actions / cells / links 生成短文案。 | 若 UI 需要完整 grouped proof，可读取 `evidence.nodes`；后续再考虑专门的 grouped-chain renderer。 |
| Real-board chain corpus | 当前 reference rating corpus 已有 grouped-AIC 和 forcing-chain 真实题面路径，但还没有 X/Y-cycle 真实题面行。 | 为 X-cycle、Y-cycle 各补至少 1 条真实题面，再讨论 stable/promotion。 |

## Negative Guards

当前 negative smoke 已包含 `grouped-aic` 的 target visibility guard 和 mirror / transpose variants：当 grouped path 类似但没有可用 endpoint cross-candidate target 时，`grouped-aic` 不应返回步骤。这防止 finder 只因为找到 grouped path 就产生空动作或 noop 动作。另有 ordinary AIC no-hit guards 固定 grouped-AIC 必须包含 grouped node，不能把普通 AIC endpoint / loop path 误报为 grouped-AIC。AIC 已补 continuous closed-loop no-hit、same / different endpoint no-target guard，并使用 `forbiddenPattern` guard 固定普通 endpoint chain 不应被误标为 continuous / discontinuous loop subtype。`bidirectional-x-cycle`、`simple-coloring`、`forcing-x-chain`、`x-chain`、`xy-chain`、`bidirectional-y-cycle`、`multi-colors`、`three-d-medusa`、`grouped-x-cycles`、`skyscraper`、`two-string-kite`、`turbot-fish` 和 `empty-rectangle` 也已补 no-target guard，固定“有链形但目标候选不存在”时不返回步骤。

## Implementation Guardrails

1. 不为了贴合 SE 名称改变 `classic-stable.v1` 的默认排序。
2. 不新增不可 replay 的 proof note；所有 chain action 必须可通过 `replaySteps()`。
3. 新增 subtype 前先补 positive 和 no-hit fixture。
4. 对 grouped chain，`evidence.nodes` 只表达 proof node 的候选集合，不等同于完整 SE proof tree。
5. 高阶 forcing chain 与 `forcing-nets` / dynamic forcing 保持分离，避免把 branch proof 和 AIC proof 混在同一 subtype。
