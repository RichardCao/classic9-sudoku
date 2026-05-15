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

1. 当前 key 是版本化的。
2. 以后如果 canonical 算法变化，必须升级 version。
3. 不能静默改变旧 key。

## 当前支持的变换

当前 canonical 会考虑：

1. 转置。
2. 行带交换。
3. 带内行交换。
4. 列栈交换。
5. 栈内列交换。
6. 数字重命名。

当前实现会返回：

1. `key`
2. `board`
3. `transform`

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
