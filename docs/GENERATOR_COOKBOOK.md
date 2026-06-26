# 生成器 Cookbook

本文给出可复制的生成器请求模板。所有示例都应遵守同一原则：只有 `status === "success"` 且存在 `puzzle` 时，结果才满足请求约束并可入库。`bestCandidate` 只用于诊断和调参。

## 在线生成一题

```json
{
  "seed": 1,
  "minimality": "none",
  "constraints": {
    "clues": { "target": 40 }
  },
  "budget": {
    "maxAttempts": 1,
    "maxElapsedMs": 3000
  }
}
```

判断：

1. `success`：可以展示。
2. `timeout`：提高 `maxElapsedMs` 或放宽约束。
3. `attempt-limit` / `no-match`：提高 `maxAttempts` 或放宽目标。

## 离线构建候选池

```json
{
  "seed": 1000,
  "maxResults": 50,
  "scoreBucketSize": 100,
  "canonicalize": true,
  "minimality": "none",
  "constraints": {
    "clues": { "min": 30, "max": 45 }
  },
  "budget": {
    "maxAttempts": 200,
    "maxElapsedMs": 5000
  }
}
```

CLI：

```bash
sudoku search request.json --summary-only --write-candidates candidates.json --write-summary summary.json
```

## Medium / Hard 优先使用候选池

在线同步请求 medium / hard / expert 或很窄的 score range，命中率通常不稳定。推荐先离线构建候选池，再用分桶计划筛选。

生成候选：

```bash
node dist/src/cli/index.js search request.json --summary-only --write-candidates dist/tmp/pool/candidates.json --write-manifest dist/tmp/pool/manifest.json --overwrite-manifest
```

查看覆盖：

```bash
node dist/src/cli/index.js candidate-stats dist/tmp/pool/candidates.json --score-bucket-size 250 --clue-bucket-size 5
```

筛选计划示例：

```json
{
  "maxResults": 10,
  "dedupeCanonical": true,
  "scoreBuckets": [
    { "min": 0, "max": 999, "limit": 3 },
    { "min": 1000, "max": 2499, "limit": 4 },
    { "min": 2500, "max": 5999, "limit": 3 }
  ],
  "clueBuckets": [
    { "min": 26, "max": 40, "limit": 10 }
  ],
  "hardestTechniqueBuckets": [
    { "techniques": ["naked-single", "hidden-single"], "limit": 5 }
  ],
  "requiredTechniqueBuckets": [
    { "techniques": ["full-house"], "minCount": 1, "limit": 10 }
  ]
}
```

执行筛选：

```bash
node dist/src/cli/index.js select dist/tmp/pool/candidates.json selection-plan.json --write-selected dist/tmp/pool/selected.json --write-rejected dist/tmp/pool/rejected.json --verify-canonical-key
```

注意：

1. `select` 不会把 `solved: false` 的候选选为 accepted。
2. `scoreBuckets`、`clueBuckets` 和 technique buckets 都是筛选约束，不是生成承诺。
3. 如果 medium / hard bucket 填不满，应增加离线 `search` 尝试量，或使用后续 staged / adaptive benchmark 策略生产更多候选。
4. hard / expert 不应作为在线实时稳定能力宣传。

## 固定 clue target

```json
{
  "seed": 2,
  "minimality": "none",
  "constraints": {
    "clues": { "target": 36 }
  },
  "budget": {
    "maxAttempts": 10,
    "maxElapsedMs": 5000
  }
}
```

`clues.target` 是硬约束。严格最小化可能让线索数低于 target，因此固定 clue target 时通常先用 `minimality: "none"`。

## strict minimality

```json
{
  "seed": 3,
  "minimality": "strict",
  "constraints": {
    "clues": { "min": 24, "max": 35 }
  },
  "budget": {
    "maxAttempts": 20,
    "maxElapsedMs": 10000
  }
}
```

strict minimality 更适合离线构建。它会增加唯一解检查成本，也可能让线索数低于原挖洞目标。

## 目标分数范围

```json
{
  "seed": 4,
  "canonicalize": true,
  "minimality": "none",
  "constraints": {
    "score": { "min": 800, "max": 1600 },
    "clues": { "min": 28, "max": 42 }
  },
  "budget": {
    "maxAttempts": 100,
    "maxElapsedMs": 5000
  }
}
```

分数约束越窄，命中率越低。失败时可以查看 `diagnostics.rejectedByReason` 和 `bestCandidate.score`。

## 要求出现某技巧

```json
{
  "seed": 5,
  "canonicalize": true,
  "constraints": {
    "requiredTechniques": [
      { "type": "appears", "techniques": ["x-wing"], "minCount": 1 }
    ],
    "preferredTechniques": ["x-wing"],
    "clues": { "min": 24, "max": 40 }
  },
  "budget": {
    "maxAttempts": 500,
    "maxElapsedMs": 8000
  }
}
```

目标技巧越高阶，越适合离线搜索。不要在在线请求中使用很窄的高阶技巧条件。

## 失败诊断

失败结果可能包含：

1. `status`
2. `requestAnalysis`
3. `diagnostics.rejectedByReason`
4. `bestCandidate`
5. `relaxationsApplied`

`bestCandidate` 不满足请求约束，只能帮助判断下一次如何放宽条件。

## 高分 + 窄技巧范围为什么难

高分题通常需要更复杂的技巧路径。如果同时把 `allowedTechniques` 限得很窄，生成器可能很难找到既高分又可被指定技巧集合解出的题。建议：

1. 先放宽分数范围。
2. 先把目标技巧放入 `preferredTechniques`，不要直接作为硬约束。
3. 增加 `maxAttempts`。
4. 使用候选池离线筛选，而不是在线同步生成。
