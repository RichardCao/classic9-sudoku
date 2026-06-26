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
  "solved": true,
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

`solution` 必须是完整无冲突解盘，并且必须与 `puzzle` 中所有给定数一致。

`solved: true` 表示该候选已经能被生成时使用的评分策略解出。`search` 和 `generateOne` 只有在满足当前约束且 `solved === true` 时才会把候选作为成功结果输出；失败时的 `bestCandidate` 只用于诊断。

如果候选包含 `canonicalKey`，候选池 API 默认只校验它是 81 位数字字符串，并直接复用这个 key 做统计、筛选或去重。这是性能优先策略，适合内部生成器产出的可信候选池。

外部导入候选池时，不要手工伪造或复用其他题面的 key。如果需要严格审计，可以使用 API 的 `verifyCanonicalKey: true` 或 CLI 的 `--verify-canonical-key`，此时会重新计算 `puzzle` 的 canonical key 并比对。

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
  ],
  "clueBuckets": [
    { "min": 30, "max": 40, "limit": 10 }
  ],
  "hardestTechniqueBuckets": [
    { "techniques": ["naked-single", "hidden-single"], "limit": 5 }
  ],
  "requiredTechniqueBuckets": [
    { "techniques": ["full-house"], "minCount": 1, "limit": 10 }
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
   优先按 `canonicalKey` 去重；没有 `canonicalKey` 的候选会退回题面字符串去重。

3. `preferredTechniques`
   不是硬约束，只用于排序。命中这些技巧越多，越优先。

4. `scoreBuckets`
   按分数分桶控制数量。

5. `clueBuckets`
   按线索数分桶控制数量。

6. `hardestTechniqueBuckets`
   按 `hardestTechnique` 分桶控制数量。

7. `requiredTechniqueBuckets`
   按 techniqueCounts 中出现的技巧分桶控制数量。`minCount` 默认是 `1`。

选择计划会做基础校验：

1. `maxResults` 必须是大于 0 的整数。
2. 每个分数桶和线索桶必须满足 `min <= max`。
3. 分数桶和线索桶不能互相重叠。
4. bucket 的 `limit` 如果存在，必须是大于 0 的整数。
5. 技巧 bucket 只能使用已知 `TechniqueId`。
6. `requiredTechniqueBuckets.minCount` 如果存在，必须是大于 0 的整数。

## 命令行

```bash
node dist/src/cli/index.js select candidates.json plan.json
```

也可以直接写出筛选结果：

```bash
node dist/src/cli/index.js select candidates.json plan.json --write-selected selected.json --write-rejected rejected.json
```

严格校验导入池中的 `canonicalKey`：

```bash
node dist/src/cli/index.js select candidates.json plan.json --verify-canonical-key
```

输出：

1. `selected`
2. `rejected`
3. `diagnostics.canonicalKeyUsage`

`rejected` 会包含原因，例如：

1. `selection-limit`
2. `canonical-duplicate`
3. `score-out-of-buckets`
4. `score-bucket-full`
5. `clue-out-of-buckets`
6. `clue-bucket-full`
7. `hardest-technique-out-of-buckets`
8. `hardest-technique-bucket-full`
9. `required-technique-out-of-buckets`
10. `required-technique-bucket-full`
11. `unsolved-candidate`

`diagnostics.canonicalKeyUsage` 会记录：

1. `reused`：直接复用已有合法 `canonicalKey` 的次数。
2. `computed`：候选缺少合法 `canonicalKey` 时重新计算的次数。
3. `invalid`：候选带了非法格式 `canonicalKey` 的次数；常规校验会优先报错，因此正常情况下应为 0。

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

严格校验 `canonicalKey`：

```bash
node dist/src/cli/index.js candidate-stats candidates.json --verify-canonical-key
```

输出包括：

1. 总题数。
2. 分数最小值、最大值、平均值和分桶。
3. 线索数最小值、最大值、平均值和分桶。
4. `grade` 分布。
5. 最高技巧分布。
6. 技巧总命中次数。
7. `solved` true / false 分布。
8. `sourceCounts` 来源分布；没有来源字段的候选记为 `unknown`。
9. canonical key 覆盖和重复情况。
10. seed 范围和重复 seed 数。

统计命令不会为缺少 `canonicalKey` 的候选自动计算 key；它只统计已有 key 的覆盖和重复情况。

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

严格校验 `canonicalKey`：

```bash
node dist/src/cli/index.js dedupe-candidates candidates.json --out deduped.json --verify-canonical-key
```

对应 schema：

```bash
node dist/src/cli/index.js schema candidateDedupeResult
```
