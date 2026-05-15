# 候选池格式

候选池用于离线批量生成和后续筛题。

典型流程：

1. 用 `search` 生成一批候选。
2. 保存其中的 `puzzle` 对象数组。
3. 用 `selectFromCandidates` 或 CLI `select` 做分桶、去重、偏好技巧排序。

如果需要分批生成，可以使用 `search --write-candidates <file> --append-candidates` 追加写入同一个候选池文件。

## 候选题数组

候选池文件是一个 JSON array。

每个元素对应 `GeneratedPuzzle`：

```json
{
  "puzzle": [0, 0, 0],
  "solution": [1, 2, 3],
  "seed": 1,
  "clueCount": 40,
  "score": 610,
  "grade": "basic",
  "hardestTechnique": "naked-single",
  "techniqueCounts": {
    "naked-single": 20,
    "full-house": 21
  },
  "canonicalKey": "..."
}
```

实际 `puzzle` 和 `solution` 必须是 81 长度数组。

## 选择计划

选择计划示例：

```json
{
  "maxResults": 10,
  "dedupeCanonical": true,
  "preferredTechniques": ["x-wing", "xy-wing"],
  "scoreBuckets": [
    { "min": 0, "max": 1300, "limit": 3 },
    { "min": 1301, "max": 2200, "limit": 3 },
    { "min": 2201, "max": 3200, "limit": 4 }
  ]
}
```

选择计划对应 schema：

```bash
node dist/src/cli/index.js schema candidateSelectionPlan
```

选择结果对应 schema：

```bash
node dist/src/cli/index.js schema candidateSelectionResult
```

字段说明：

1. `maxResults`
   最多选择多少题。

2. `dedupeCanonical`
   如果候选题带 `canonicalKey`，则按 canonical key 去重。

3. `preferredTechniques`
   不是硬约束，只用于排序。命中这些技巧越多，越优先。

4. `scoreBuckets`
   按分数分桶控制数量。

选择计划会做基础校验：

1. `maxResults` 必须是大于 0 的整数。
2. 每个分数桶必须满足 `min <= max`。
3. 分数桶的 `limit` 如果存在，必须是大于 0 的整数。

## 命令行

```bash
node dist/src/cli/index.js select candidates.json plan.json
```

也可以直接写出筛选结果：

```bash
node dist/src/cli/index.js select candidates.json plan.json --write-selected selected.json --write-rejected rejected.json
```

输出：

1. `selected`
2. `rejected`

`rejected` 会包含原因，例如：

1. `selection-limit`
2. `canonical-duplicate`
3. `score-out-of-buckets`
4. `score-bucket-full`

写出文件时：

1. `--write-selected` 只写入被选中的候选题数组。
2. `--write-rejected` 写入未选中的候选题和拒绝原因。

## 候选池统计

`candidate-stats` 用于观察候选池是否覆盖了目标范围。

```bash
node dist/src/cli/index.js candidate-stats candidates.json
```

可以调整分桶大小：

```bash
node dist/src/cli/index.js candidate-stats candidates.json --score-bucket-size 100 --clue-bucket-size 5
```

输出包括：

1. 总题数。
2. 分数最小值、最大值、平均值和分桶。
3. 线索数最小值、最大值、平均值和分桶。
4. `grade` 分布。
5. 最高技巧分布。
6. 技巧总命中次数。
7. canonical key 覆盖和重复情况。
8. seed 范围和重复 seed 数。

对应 schema：

```bash
node dist/src/cli/index.js schema candidatePoolStats
```

## 独立去重

`dedupe-candidates` 用于对已有候选池做去重，并写出新的候选池。

默认优先按 `canonicalKey` 去重；如果某题没有 `canonicalKey`，会退回题面字符串。

```bash
node dist/src/cli/index.js dedupe-candidates candidates.json --out deduped.json
```

也可以强制按题面字符串去重：

```bash
node dist/src/cli/index.js dedupe-candidates candidates.json --out deduped.json --key puzzle
```

写出被去掉的重复项：

```bash
node dist/src/cli/index.js dedupe-candidates candidates.json --out deduped.json --write-rejected duplicated.json
```

对应 schema：

```bash
node dist/src/cli/index.js schema candidateDedupeResult
```
