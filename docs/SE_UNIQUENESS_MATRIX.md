# SE Uniqueness Matrix

本文档专门收口 Sudoku Explainer / Sukaku Explainer 中和唯一解假设相关的 BUG、Unique Rectangle、Unique Loop 映射。它是 [SE_COMPATIBILITY.md](./SE_COMPATIBILITY.md) 的细分矩阵，不代表公开 API 提供 SE profile；默认评分仍以 `classic-stable.v1` 为准。

## 口径

| Status | Meaning |
| --- | --- |
| `covered` | 当前 finder 有明确入口，能稳定返回可 replay 的 `SolveStep`，并和常见 SE subtype 基本一致。 |
| `partial` | 当前 finder 覆盖主要形态，但 subtype 边界、difficulty、真实题面 fixture 或 proof 结构仍未完全对齐。 |
| `missing` | 当前没有独立 finder，或者不应把现有 finder 宣称为该 SE subtype。 |
| `out-of-scope-now` | 依赖更完整的 uniqueness proof tree、真实题面 corpus 或策略决策，暂不进入当前实现。 |

## Unique Rectangle / Unique Loop

| SE family / subtype | Current `TechniqueId` | Status | Current implementation boundary | Next fixture / work item |
| --- | --- | --- | --- | --- |
| Unique Rectangle Type 1 | `unique-rectangle` | `covered` | 三个 floor cells 为同一 deadly pair，一个 roof cell 有额外候选；删除 roof cell 中 deadly pair；已进入 reference smoke，并输出 `ur-rectangle` / `ur-floor` / `ur-roof` nodes。 | 增加真实题面 rating corpus 行，校准 SE 4.5..5.0 bucket。 |
| Unique Rectangle Type 2, shared extra | `unique-rectangle` | `partial` | 两个 roof cells 共享唯一 extra digit，并从同时可见两个 roof cells 的外部格删除该 extra digit；已用 `type-2-shared-extra` subtype 进入 reference smoke，row/column roof 方向均有 smoke，并输出 UR nodes。 | 补真实题面 fixture；不宣称覆盖 Type 5。 |
| Unique Rectangle Type 5 | `unique-rectangle` | `partial` | 保守覆盖 Type 5 常见形态：extra digit 出现在两个对角 UR cells 或三个 UR cells，且外部 target 同时看见所有 extra cells；删除该 extra digit。已用 `type-5` subtype、`ur-extra` 和 `ur-targets` nodes 进入 reference smoke，并补无 target、非 deadly pair 和 Type 2/Type 5 边界 guard。 | 补完整 rating-path 真实题面；HoDoKu u501/u502 原题当前仍不能作为 full rating-path row。 |
| Unique Rectangle Type 3, naked set | `unique-rectangle` | `partial` | 局部形态已覆盖：两个 roof cells 与同 house 内额外 cells 组成 naked set；从 house 其他格删除 set digits；已进入 reference smoke，并输出 UR nodes。 | 增加真实题面 fixture；记录 set size 3/4 的分值边界。 |
| Unique Rectangle Type 3, hidden set | `unique-rectangle` | `partial` | 局部形态已覆盖：两个 roof cells 的 extra digits 参与 hidden set；删除 hidden-set cells 中外部候选；已进入 reference smoke，并输出 UR nodes。 | 增加真实题面 fixture；校准和普通 hidden subset 的优先级。 |
| Unique Rectangle Type 4 | `unique-rectangle` | `partial` | 局部形态已覆盖：两个 roof cells 在共享 house 内对一个 deadly digit 形成强限制；从 roof cells 删除另一个 deadly digit；row/column 两方向均已进入 reference smoke，并输出 UR nodes。 | 确认 SE Type 4 文案；补真实题面。 |
| Unique Rectangle Type 6 / strong-link variants | `hidden-unique-rectangle`, `aic-ur` | `partial` | HUR 的强链 corner 形态已固定为 `type-6-strong-link-corner`，row/column 两个几何方向均有 reference smoke；UR-AIC 覆盖 single-roof / floor-roof chain 形态，其中 floor-roof 左右方向均有 smoke，mirrored floor-roof no-target、AIC-UR single-roof conjugate boundary 和 HUR conjugate boundary guards 已补；不声明完整 Type 6 覆盖；HUR / UR-AIC 均输出基础 `evidence.links` 和 UR nodes。 | 继续补真实题面，并继续拆 UR-AIC 与完整 Type 6 的 proof 边界。 |
| Unique Rectangle AIC | `aic-ur` | `partial` | 把 UR 结构作为 AIC 节点，覆盖 single-roof 和 floor-roof chain 的保守形态；两个 subtype 均已进入 reference smoke，floor-roof 左右方向均固定，mirrored no-target guard 已补，并输出基础 `evidence.links` 和 UR nodes；已新增 1 条真实题面 rating corpus row。 | 补更完整的 endpoint proof 和更多真实题面。 |
| Avoidable Rectangle | `avoidable-rectangle` | `partial` | 三个角已解、一个角未解时，删除会完成可交换矩形的候选；已补正例 reference smoke。 | 继续补真实题面 rating corpus 行，校准 SE 4.5..5.0 bucket。 |
| Rectangle Elimination | `rectangle-elimination` | `partial` | 单数字强链 + weak wing + 第四宫全覆盖模型；row-strong 与 col-strong 两个方向均已进入 reference smoke；已新增 1 条真实题面 rating corpus row。 | 需要和 SE Rectangle Elimination subtype 对齐，并继续补更多真实题面。 |
| Extended Rectangle / Unique Loop 2x3 or 3x2 | `extended-rectangle` | `partial` | 目前只覆盖 2x3 / 3x2 中五个 pure pair cells、一个 roof cell 的本包扩展矩形模型；两个方向均已进入 reference smoke。 | 不应宣称完整 generalized unique loop；补真实题面。 |
| Generalized Unique Loop | `unique-loop` | `partial` | 已新增 experimental `unique-loop`，当前覆盖 2x3 / 3x2 single-roof、2x3 / 3x2 shared-guardian extra elimination 和最多 14 cell 的有界 generalized single-roof loop；已固定 proof node id：`unique-loop`、`unique-loop:base-pair`、`unique-loop:guardians`、`unique-loop:targets`；已补 broken-loop、target-without-pair、multi-guardian/no-target、shared-guardian extra mismatch / multi-extra no-hit。 | 继续补更大 loop、更多 guardian variants 和真实题面；不得把 `extended-rectangle` 直接宣称为完整 Unique Loop。 |
| SK Loop as uniqueness loop | `sk-loops` | `non-se-extension` | 本包按 pattern family 维护，不作为 SE Unique Loop 映射项。 | 不并入 uniqueness family，避免 difficulty 混淆。 |

## BUG / Bivalue Universal Grave

| SE family / subtype | Current `TechniqueId` | Status | Current implementation boundary | Next fixture / work item |
| --- | --- | --- | --- | --- |
| BUG+1 | `bug-plus-one` | `partial` | 全盘除一个 trivalue cell 外均为 bivalue；根据 house digit parity 在唯一三值格落子；已进入 reference smoke，并输出 `bug-base` / `bug-extra`、同格等价 `bug-elimination-targets` 以及 row/col/box parity nodes；另有 HoDoKu `bug101` 外部候选态 smoke 固定真实来源的 BUG+1 parity shape，HoDoKu `bug102` no-hit guard 固定“单三值但 parity 不成立”边界。 | 增加完整 rating-path 真实题面 corpus 行；校准 SE 5.6..6.0 bucket。 |
| BUG+2 | `bug-plus-two` | `partial` | 保守覆盖两个三值格共享同一个 extra digit、移除 extra 后形成 BUG base，并从同时看见两个 extra cells 的格删除该 extra digit；另有 bounded non-common parity-elimination proof，只在小型 BUG+2 候选态可完整枚举且 extra candidate 不出现在任何 BUG completion 时删除该 extra；已输出 `bug-base` / `bug-extra`、common-extra target node、`bug-extra-group:*` parity nodes、`bug-elimination-targets`，并把 BUG base 的 house/digit 二候选关系暴露为 `evidence.links`。 | 增加真实题面 rating corpus 行；继续把 non-common proof 从 bounded smoke 扩展到更通用的 parity proof。 |
| BUG+n | `bug-plus-n` | `partial` | 保守覆盖 3 个以上三值格共享同一个 extra digit、移除 extra 后形成 BUG base，并从同时看见所有 extra cells 的格删除该 extra digit；已进入 reference smoke，输出 `bug-base` / `bug-extra` / `bug-common-extra-targets` nodes，并把 BUG base 的 house/digit 二候选关系暴露为 `evidence.links`；已补无共同 target no-hit。 | 增加真实题面 rating corpus 行；继续补多 extra digit / 非 common-extra / solution-safety proof。 |
| BUG Lite | 无 | `missing` | 当前未实现 BUG Lite；不把 `bug-plus-n` shared-extra 形态声明为 BUG Lite。 | 需要候选图与 uniqueness proof tree，不建议直接暴力实现。 |
| BUG elimination variants | 无 | `partial-design` | 当前 `bug-plus-one` 仍只返回落子，但已用 `bug-elimination-targets` 标出同格非落子候选的等价删除目标；真正 broader BUG elimination action/finder 仍未覆盖。 | 需要 matrix fixture 后再决定是否拆 TechniqueId。 |
| Reverse BUG / non-unique proof diagnostic | 无 | `out-of-scope-now` | 这更像唯一性诊断或 puzzle validation，不是当前 human step。 | 如要支持，应进入 uniqueness diagnostics，而不是 solver technique。 |

## Current Acceptance Gap

1. 当前 uniqueness family 的 finder 多数有人工候选态测试，但真实题面 rating corpus 覆盖不足。
2. `unique-rectangle` 聚合了多个 subtype；当前已通过 `evidence.pattern.family/subtype` 暴露审计标签，而不是拆 public `TechniqueId`。reference negative 固定 diagonal shared-extra roof cells 不能误标为当前保守的 Type 2 shared-extra subtype，并固定 row/column shared-extra Type 2 shape 不能误标为 Type 5。
3. `extended-rectangle` 只覆盖固定 2x3 / 3x2 形态，不等价于完整 SE Unique Loop。
4. `aic-ur` 已输出基础 `evidence.links` 和 UR rectangle/floor/roof nodes；reference smoke 已用 `expectedNodes` 固定代表性 proof boundary；下一步需要更细 Type 6 / UR-AIC 子分类和真实题面，才能从 `partial` 走向更强覆盖。
5. BUG family 当前有 `bug-plus-one`、保守 `bug-plus-two` common-extra、bounded non-common parity-elimination，以及保守 `bug-plus-n` shared-extra common-target 形态，并已有基础 BUG / parity / target nodes；BUG+2 / BUG+n elimination 已输出 BUG base strong-link evidence；reference smoke 已用 `expectedNodes` 和 `minLinks` 固定这些 proof boundaries；不应宣称覆盖整个 Bivalue Universal Grave family。

## Next Actions

1. 给 `reference-rating-corpus.json` 增加至少一条 BUG+1 真实题面和一条 UR Type 1 真实题面。
2. 补真实题面回归，确认 `evidence.pattern.family/subtype` 和 `expectedNodes` proof boundary 在 rating path 中稳定输出；当前 uniqueness family 主要已实现项已有 reference smoke。
3. 为 `avoidable-rectangle` 补真实题面 fixture，确认 rating path 中可达。
4. 在完整 proof tree 设计前，不新增 generalized Unique Loop finder。
5. 继续收集 BUG+2 非 common-extra subtype、BUG+n 和 BUG Lite 样例；在 proof model 明确前不扩大到更通用 BUG finder。

## Prerequisite Work Before Missing Finders

| Missing finder | Required support before implementation | First implementation gate |
| --- | --- | --- |
| Generalized Unique Loop | 设计 loop node 表达、deadly pair / roof / floor 压缩规则、target proof summary、`evidence.nodes` loop path；补 positive 和 no-hit 人工候选态 | 只能在 docs 中明确和 `extended-rectangle`、`sk-loops` 的边界后实现 |
| Broader BUG+n / BUG Lite | BUG graph node conventions 已在 completion plan 固定：`bug-base`、`bug-extra`、`bug-parity-*`、`bug-common-extra-targets`，并预留 `bug-extra-group:*` / `bug-elimination-targets`；代码侧已有保守 `bug-plus-n` shared-extra common-target finder，并复用 BUG base graph、base graph links、declared-extra map、BUG+2 extra-pair classifier、extra parity summary、parity evidence node helper、elimination target node helper、target parity proof draft helper 和 common-extra helper；下一步补 multi-extra proof summary、extra candidate target rule、反例生成方式和性能预算 | 保守 BUG+n positive/no-hit 已通过；扩大 finder 前仍需 solution-safety regression、更多 no-hit 和真实题面 |
| BUG elimination variants | 基础 BUG nodes 已完成；继续按 conventions 区分 BUG+1 placement、BUG+2 common-extra elimination、non-common-extra parity elimination、broader elimination | 不允许影响当前 `bug-plus-one` stable 行为；必须补 negative fixture |
| UR Type 6 / HUR / UR-AIC full mapping | 基础 UR node evidence 已完成；继续区分 strong-link Type 6、hidden UR 和 UR-AIC chain 的 subtype / proof 边界 | `aic-ur` / `hidden-unique-rectangle` 的 smoke 能固定更细 subtype、UR node、links 和 target |
