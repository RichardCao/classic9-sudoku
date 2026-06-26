# 等价变换和最小序

## 目标

`canonical` 模块用于把标准 9x9 数独题面转换成一个稳定的最小序表示，方便：

1. 去重。
2. 题库存储。
3. 批量筛选。
4. 对题面和答案做一致变换。

## 当前算法版本

当前固定为：

```text
algorithm = canonical.classic9
version = 1
```

这意味着：

1. 当前返回值中的 `algorithm` 和 `version` 是版本化信息。
2. 当前 `key` 字段本身是裸 81 位 canonical key，不带 `canonical.classic9.v1:` 前缀。
2. 以后如果 canonical 算法变化，必须升级 version。
3. 不能静默改变旧 key。
4. `canonicalizeBoard()` 返回的 `transform.digitMap` 保持为完整双射，便于直接回放和反向还原。
5. 空盘 `canonicalizeBoard()` 的 transform 固定为 identity，即不转置、行列顺序为 `0..8`、数字映射为 `0..9`。

## 当前支持的变换

当前 canonical 会考虑：

1. 转置。
2. 行带交换。
3. 带内行交换。
4. 列栈交换。
5. 栈内列交换。
6. 数字重命名。

对标准 9x9、3x3 宫 classic Sudoku，这组生成元覆盖保结构等价变换：

1. 任意合法行变换都可拆成 band 交换和 band 内 row 交换。
2. 任意合法列变换都可拆成 stack 交换和 stack 内 column 交换。
3. 主对角线镜像就是转置。
4. 90、180、270 度旋转，以及水平、垂直、副对角线镜像，都可由转置加合法行列变换组合得到。
5. 数字重命名对题面结构独立，当前通过每个结构变换下的最小首次出现映射处理，不需要显式枚举 `9!`。

因此当前结构枚举规模是：

```text
2 * (3! * (3!)^3) * (3! * (3!)^3)
```

其中第一个 `2` 是是否转置，两个 `3! * (3!)^3` 分别是行侧和列侧合法结构顺序。

空盘是例外：为了避免在无信息题面上浪费资源，空盘不会枚举等价变换，直接返回 81 个 `0` 的 key 和 identity transform。

当前实现会返回：

1. `key`
2. `board`
3. `transform`

## 不属于 classic9 等价变换的操作

下面这些操作有时容易被误认为遗漏，但它们不是当前 `canonical.classic9.v1` 的等价变换：

1. 任意两行交换。只有同一 band 内 row 交换，或整个 band 交换，才保持 3x3 宫结构。
2. 任意两列交换。只有同一 stack 内 column 交换，或整个 stack 交换，才保持 3x3 宫结构。
3. 任意 3x3 box 交换。box 的位置必须由合法 band/stack 交换诱导，不能任意打乱 9 个 box。
4. 增加 clue、删除 clue、移动 clue。即使解相同，这也改变了题面信息量，不应 canonical 成同一个 key。
5. 同一个 solution 下的不同 puzzle。当前 canonical 是题面等价去重，不是 solution 去重。
6. diagonal、jigsaw、killer、anti-knight、thermo 等变体规则。它们有额外约束或不同 house 结构，不属于 classic9 范围。

如果未来要支持非 classic9 变体，应定义新的算法名或 version，不能静默改变 `canonical.classic9.v1` key。

## transform 字段

`transform` 当前包含：

1. `transposed`
2. `rowOrder`
3. `colOrder`
4. `digitMap`

这允许外部系统：

1. 把原题映射到 canonical 题面。
2. 同步变换答案盘面。
3. 同步变换状态、候选约束和步骤。

## 当前公开 schema

当前已经导出：

1. `canonicalTransform`
2. `canonicalResult`
3. `canonicalPairResult`

可以通过命令行查看：

```bash
node dist/src/cli/index.js schema canonicalResult
node dist/src/cli/index.js schema canonicalPairResult
```

## 发布前等价审计

发布前 gate 固定运行 release canonical 等价审计：

```bash
npm run audit:canonical-equivalence:release
```

该命令等价于：

```bash
npm run audit:canonical-equivalence -- --max-rows 8 --transforms-per-row 2 --json
```

审计覆盖：

1. 空盘 identity fast path。
2. 全部 729 个单线索题面。
3. reference rating corpus 中的唯一解题面。
4. 随机 digit relabel、band/row、stack/column 和 transpose 组合。
5. 显式 `rotate90`、`rotate180`、`rotate270`、horizontal mirror 和 vertical mirror。
6. `canonicalizePair()` 对变换后的 puzzle/solution 不产生 warning，且 canonical 后 solution 仍是合法完整终盘。

`verify:release` 已包含该 release 审计。更重的深度审计命令保留为：

```bash
npm run audit:canonical-equivalence:full
```

它等价于：

```bash
npm run audit:canonical-equivalence -- --max-rows 68 --transforms-per-row 6 --json
```

完整审计会枚举更多 reference corpus rows 和随机等价变换，耗时显著高于 release gate。若 release 或 full 审计发现 key 不一致，应先修复或引入新的 canonical version，不得静默改变 v1 key。

需要把完整 canonical 审计也纳入发布验证时，使用：

```bash
npm run verify:release:canonical-full -- --input tests/fixtures/release-smoke-corpus.json
```

## 当前边界

当前只覆盖：

1. `canonicalizeBoard`
2. `canonicalizePair`
3. `applyTransformToBoard`
4. `invertTransform`
5. `applyTransformToState`
6. `applyTransformToStep`

`applyTransformToState` 会同步变换：

1. `board`
2. `givens`
3. `constraints.forbidden`
4. `constraints.exactCandidates`
5. `constraints.pencilMarks`
6. `assumptions`

`applyTransformToStep` 会同步变换：

1. `actions`
2. `evidence.cells`
3. `evidence.houses`

## 非唯一解和 best-effort 约定

canonical 主要服务于有唯一解的 9x9 题面。对于无解、非唯一解或信息不足的题面，当前策略是尽量减少资源浪费，并返回可复用的稳定结构。

1. `canonicalizeBoard(emptyBoard)` 固定返回 identity transform。
2. `canonicalizeBoard()` 不主动做唯一解检查；调用方如果需要强约束，应先运行 `checkUniqueness()`。
3. `canonicalizePair(puzzle, solution)` 会先按 `puzzle` 计算 transform，再把同一个 transform 应用到 `solution`。
4. 如果 `solution` 不完整、与题面给定数不匹配或自身有重复数字，`canonicalizePair()` 会在 `warnings` 中说明，并返回 best-effort 结果。
5. best-effort 结果只保证变换结构和值域合法，不保证 `solution` 是题面的正确唯一解。
