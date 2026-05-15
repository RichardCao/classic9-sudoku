# 技巧定义

本文档说明当前公开库已经稳定支持的解题技巧。这里的“稳定”表示：

1. 技巧已经接入 `nextStep`、`walkthrough` 和 `rate`。
2. 技巧会返回结构化 `SolveStep`。
3. 技巧有测试覆盖。
4. 技巧可以用于生成器的 `allowedTechniques`、`forbiddenTechniques`、`requiredTechniques` 和 `preferredTechniques`。

同时，公开库也包含一组 `experimental` 技巧。它们已经可以通过 `allowedTechniques` 显式调用，但默认不会进入 `walkthrough()`、`rate()` 或 `classic-stable.v1`。

## 查看方式

代码中可以调用：

```ts
import { getTechniqueDefinitions } from '@sudoku-tools/classic9';

const techniques = getTechniqueDefinitions();
```

命令行可以调用：

```bash
node dist/src/cli/index.js techniques
```

## 当前稳定技巧

| id | 中文名 | 技巧族 | 默认单步分 |
| --- | --- | --- | --- |
| `full-house` | 满屋法 | `single` | 10 |
| `naked-single` | 显性单数 | `single` | 20 |
| `hidden-single` | 隐性单数 | `single` | 30 |
| `locked-candidates` | 区块摒除 | `intersection` | 50 |
| `naked-pair` | 显性数对 | `subset` | 60 |
| `hidden-pair` | 隐性数对 | `subset` | 70 |
| `naked-triple` | 显性三数组 | `subset` | 80 |
| `hidden-triple` | 隐性三数组 | `subset` | 90 |
| `naked-quad` | 显性四数组 | `subset` | 95 |
| `hidden-quad` | 隐性四数组 | `subset` | 105 |
| `x-wing` | X-Wing | `fish` | 100 |
| `swordfish` | 剑鱼 | `fish` | 140 |
| `franken-swordfish` | Franken Swordfish | `fish` | 152 |
| `jellyfish` | 水母 | `fish` | 180 |
| `finned-x-wing` | 带鳍 X-Wing | `fish` | 110 |
| `finned-swordfish` | 带鳍剑鱼 | `fish` | 170 |
| `finned-jellyfish` | 带鳍水母 | `fish` | 210 |
| `sashimi-swordfish` | 刺身剑鱼 | `fish` | 176 |
| `sashimi-jellyfish` | 刺身水母 | `fish` | 218 |
| `xy-wing` | XY-Wing | `wing` | 115 |
| `xyz-wing` | XYZ-Wing | `wing` | 165 |
| `wxyz-wing` | WXYZ-Wing | `wing` | 174 |
| `w-wing` | W-Wing | `wing` | 168 |
| `chute-remote-pairs` | 宫带远程数对 | `wing` | 166 |
| `almost-locked-pair` | 准锁定数对 | `als` | 126 |
| `almost-locked-triple` | 准锁定三数组 | `als` | 144 |
| `als-xz` | ALS-XZ | `als` | 182 |
| `als-xy-wing` | ALS-XY-Wing | `als` | 188 |
| `aic-als` | ALS-AIC | `als` | 214 |
| `fireworks` | Fireworks | `als` | 211 |
| `twinned-xy-chains` | 双生 XY-Chains | `als` | 213 |
| `sue-de-coq` | Sue-de-Coq | `als` | 207 |
| `death-blossom` | Death Blossom | `als` | 196 |
| `aligned-pair-exclusion` | 对齐数对排除 | `als` | 209 |
| `exocet` | Exocet | `pattern` | 226 |
| `double-exocet` | 双 Exocet | `pattern` | 228 |
| `pattern-overlay` | Pattern Overlay | `pattern` | 228 |
| `tridagons` | Tridagons | `pattern` | 232 |
| `sk-loops` | SK Loops | `pattern` | 236 |
| `simple-coloring` | 简单染色 | `coloring` | 170 |
| `multi-colors` | 多重染色 | `coloring` | 178 |
| `three-d-medusa` | 3D Medusa | `coloring` | 202 |
| `grouped-x-cycles` | 分组 X-Cycles | `single-digit-chain` | 168 |
| `grouped-aic` | 分组 AIC | `chain` | 212 |
| `x-chain` | X-Chain | `chain` | 176 |
| `xy-chain` | XY-Chain | `chain` | 184 |
| `aic` | 交替推理链 | `chain` | 205 |
| `aic-exotic` | AIC with Exotic Links | `chain` | 222 |
| `skyscraper` | 摩天楼 | `single-digit-chain` | 175 |
| `turbot-fish` | 涡轮鱼 | `single-digit-chain` | 174 |
| `two-string-kite` | 双线风筝 | `single-digit-chain` | 180 |
| `empty-rectangle` | 空矩形 | `single-digit-chain` | 186 |
| `unique-rectangle` | 唯一矩形 | `uniqueness` | 190 |
| `avoidable-rectangle` | 可避免矩形 | `uniqueness` | 176 |
| `rectangle-elimination` | 矩形删减 | `uniqueness` | 160 |
| `extended-rectangle` | 扩展矩形 | `uniqueness` | 198 |
| `hidden-unique-rectangle` | 隐藏唯一矩形 | `uniqueness` | 201 |
| `aic-ur` | UR-AIC | `uniqueness` | 216 |
| `bug-plus-one` | BUG+1 | `uniqueness` | 210 |

## 当前 experimental 技巧

这些技巧已经吸收到公开库代码中，并具备 definition 与显式调用能力，但默认不进入 stable 管线：

| id | 中文名 | 技巧族 | 默认单步分 |
| --- | --- | --- | --- |
| `forcing-nets` | Forcing Nets | `forcing` | 220 |
| `digit-forcing-chains` | 数字强制链 | `forcing` | 221 |
| `nishio-forcing-chains` | Nishio 强制链 | `forcing` | 222 |
| `cell-forcing-chains` | 单元格强制链 | `forcing` | 223 |
| `unit-forcing-chains` | 区域强制链 | `forcing` | 224 |
| `bowmans-bingo` | Bowman's Bingo | `forcing` | 248 |
## 技巧族

`single` 表示直接确定某个格子的数字，例如满屋法、显性单数、隐性单数。

`intersection` 表示利用宫与行列交叉关系删候选数。

`subset` 表示同一区域内的数组技巧，包括显性数组和隐性数组。

`fish` 表示鱼类结构，目前稳定支持 X-Wing、Swordfish、Franken Swordfish、Jellyfish、带鳍鱼和刺身鱼。

`wing` 表示翼类结构，目前稳定支持 XY-Wing、XYZ-Wing、WXYZ-Wing、W-Wing 和宫带远程数对。

`als` 表示 Almost Locked Set 相关技巧，目前稳定支持准锁定数对、准锁定三数组、ALS-XZ、ALS-XY-Wing、ALS-AIC、Fireworks、双生 XY-Chains、Sue-de-Coq、Death Blossom 和对齐数对排除。

`pattern` 表示更高阶的结构型模式，目前稳定支持 Exocet、Double Exocet、Pattern Overlay、Tridagons 和 SK Loops。

`forcing` 表示显式分支、试探或多分支共同结论类技巧。当前这组技巧以 experimental 形式提供。

`coloring` 表示基于强链分色的技巧，目前稳定支持简单染色、多重染色和 3D Medusa。

`chain` 表示一般链式技巧，目前稳定支持 X-Chain、XY-Chain、AIC、AIC with Exotic Links 和分组 AIC。

`single-digit-chain` 表示单数字链类结构，目前稳定支持分组 X-Cycles、摩天楼、涡轮鱼、双线风筝和空矩形。

`uniqueness` 表示依赖唯一解假设的技巧，目前稳定支持唯一矩形、可避免矩形、矩形删减、扩展矩形、隐藏唯一矩形、UR-AIC 和 BUG+1。

## 分数说明

默认单步分不是题目的绝对难度，只是 `classic-stable.v1` 评分策略下的基准权重。

题目总分由完整解题过程中的步骤累加而来。因此同一个最高技巧可能对应很不同的总分：

1. 一个只出现一次高阶技巧、其余步骤很少的题，总分可能不高。
2. 一个只使用基础技巧但步骤很多的题，总分也可能较高。
3. 如果指定很高的分数范围，同时又限制只能使用基础技巧，生成命中率会明显下降。

生成前可以用：

```bash
node dist/src/cli/index.js generator-analyze request.json
```

来检查分数范围和技巧范围是否明显冲突。

## 生成器约束建议

如果目标是“必须出现某些技巧”，使用 `requiredTechniques`。

如果目标是“优先保留某些技巧，但不要让生成器过早失败”，使用 `preferredTechniques`。

如果目标是“完全不允许某些技巧”，使用 `forbiddenTechniques`。

如果指定 `allowedTechniques`，它会限制评分和求解器实际可用的技巧范围，但不改变默认由易到难的技巧顺序。这个约束会显著影响生成命中率，尤其是在分数范围较高时。

如果需要让某些技巧优先命中，使用 `preferredTechniques`。它不会放宽 `allowedTechniques`，只会把已经允许的技巧提前尝试。

## SolveStep 证据结构

当前 stable 技巧都返回同一种外层结构：

1. `technique`：技巧 id。
2. `actions`：实际动作，可能是 `place` 或 `eliminate`。
3. `evidence.houses`：相关区域，可能为空数组。
4. `evidence.cells`：相关格子，使用 `target`、`reason`、`pivot`、`link` 等角色。
5. `evidence.links`：链式或染色技巧中的强链/弱链证据。
6. `evidence.branches`：forcing / 试探类技巧的分支证据，记录每个分支的假设、是否矛盾、是否穷尽，以及分支内推出的动作摘要。
7. `score`：当前评分规则下的单步分。

当前证据约定按技巧族说明如下。

| 技巧族 | 适用技巧 | actions | evidence.houses | evidence.cells / links |
| --- | --- | --- | --- | --- |
| `single` | `full-house`、`naked-single`、`hidden-single` | `place` | 满屋法和隐性单数会标出相关 house；显性单数可能没有 house | `target` 表示落子的格子和数字 |
| `intersection` | `locked-candidates` | `eliminate` | 标出发生锁定的宫、行或列 | `reason` 表示形成锁定的候选格；`target` 表示被删候选 |
| `subset` | `naked-pair`、`hidden-pair`、`naked-triple`、`hidden-triple`、`naked-quad`、`hidden-quad` | `eliminate` | 标出数组所在 house | `reason` 表示数组格；`target` 表示被删候选 |
| `fish` | `x-wing`、`swordfish`、`franken-swordfish`、`jellyfish`、带鳍鱼、刺身鱼 | `eliminate` | 标出 basis line、cover line；Franken Swordfish 会混合标出 line basis 和 box basis；带鳍/刺身鱼还会标出 fin 所在宫 | `reason` 表示鱼形结构候选格；`target` 表示被删候选 |
| `wing` | `xy-wing`、`xyz-wing`、`w-wing`、`chute-remote-pairs` | `eliminate` | 当前为空数组或只标出强链 house | `reason` 表示 pivot、wing 或远程数对端点；`link` 表示第三宫 yellow cells；`target` 表示被删候选 |
| `als` | `almost-locked-pair`、`almost-locked-triple`、`als-xz`、`als-xy-wing`、`aic-als`、`fireworks`、`twinned-xy-chains`、`sue-de-coq`、`death-blossom`、`aligned-pair-exclusion` | `eliminate` | 标出 ALS 所在 house、交叉区域或 ALS-AIC/Fireworks/双生 XY-Chains/Sue-de-Coq/Death Blossom/Aligned Pair Exclusion 相关区域 | `reason` 表示 ALS/AHS 格、Fireworks 三格、双生 XY-Chains 六格、Sue-de-Coq 交集与翼格、Death Blossom 的 pivot 与花瓣、对齐基础对或链端候选；`link` 表示交叉、限制公共候选或 ALS 单元；`target` 表示被删候选 |
| `pattern` | `exocet`、`double-exocet`、`pattern-overlay`、`tridagons`、`sk-loops` | `place` 或 `eliminate` | 标出 base cells、target cells、模板支撑格、guardian 或 loop houses | `reason` 表示结构支撑格；`pivot` 表示 target cells 或模板结点；`target` 表示落子或被删候选 |
| `coloring` | `simple-coloring`、`multi-colors`、`three-d-medusa` | `eliminate` | 标出强链所在 house | `reason` 表示染色链格子；`target` 表示被删候选；`links` 表示强链和跨组件弱链 |
| `chain` | `x-chain`、`xy-chain`、`aic`、`aic-exotic`、`grouped-aic` | `eliminate` | 标出链经过的相关 house | `reason` 表示链上的格子；`target` 表示被删候选；`links` 表示链上的强弱关系 |
| `forcing` | `forcing-nets`、`digit-forcing-chains`、`nishio-forcing-chains`、`cell-forcing-chains`、`unit-forcing-chains`、`bowmans-bingo` | `place` 或 `eliminate` | 标出分支来源或结论相关区域 | `reason` 表示分支起点；`target` 表示最终结论；`branches` 表示每条分支的假设、矛盾状态、穷尽状态和分支内动作摘要 |
| `single-digit-chain` | `grouped-x-cycles`、`skyscraper`、`turbot-fish`、`two-string-kite`、`empty-rectangle` | `eliminate` | 标出强链所在行列、相关宫或 cover line | `reason` 表示链结构候选格；`target` 表示被删候选 |
| `uniqueness` | `unique-rectangle`、`avoidable-rectangle`、`rectangle-elimination`、`extended-rectangle`、`hidden-unique-rectangle`、`aic-ur`、`bug-plus-one` | `place` 或 `eliminate` | 标出矩形、强链或 BUG 相关区域 | `reason` 表示唯一性结构；`link` 表示 UR-AIC 中的链节点；`target` 表示落子或被删候选 |

`evidence.note` 当前只用于调试和内部说明，不建议调用方直接展示。面向用户的文案应使用 `formatStep` 生成。

`evidence.branches` 主要用于公开库调用方解释 experimental forcing 技巧。`assumption` 是分支入口动作；`contradiction` 表示该分支是否导向矛盾；`contradictionAt` 在可定位时记录矛盾点，包括某格候选耗尽、某区域内数字重复、某区域内数字无处可放；`exhausted` 表示当前分支是否已经在步数上限内无法继续推出稳定步骤；`actions` 是分支内推导动作的有限摘要，不承诺包含完整证明树。forcing 技巧仍默认保持 `experimental`，调用方需要通过 `allowedTechniques` 显式启用。

## Golden 覆盖

当前测试为每个 stable 技巧保留一个最小候选态样例，并验证：

1. `nextStep` 能命中指定技巧。
2. 返回的 `actions` 包含预期落子或删候选。
3. stable 技巧清单和 golden 覆盖清单一致。

如果后续新增 stable 技巧，需要同时补：

1. `TECHNIQUE_DEFINITIONS`。
2. `formatStep` 展示逻辑。
3. 对应技巧样例测试。
4. 本文档的证据结构说明。

experimental 技巧当前至少要求：

1. `getTechniqueDefinitions()` 中可见。
2. `nextStep(..., { allowedTechniques: [...] })` 可显式命中。
3. 默认 `walkthrough()` 不会自动运行它们。
4. 如果技巧来自外部教学来源，必须区分“原题面可复现”和“依赖中途候选态”的样例；forcing / 试探类更适合把后者保存为 `trusted` 候选态 golden。

## 公开稳定性

当前公开库不把任何产品的难度档位作为核心事实。难度档位应该由调用方根据评分策略、分数区间、技巧约束和题库筛选目标自行定义。

后续新增高级技巧时，只有满足以下条件才会进入本文档的稳定表：

1. 结构化证据能表达清楚。
2. `formatStep` 能给出可理解的中文说明。
3. 有针对性测试。
4. 评分策略中有明确权重。
