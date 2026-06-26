# 随机终盘生成方案

当前生成器的默认终盘来源是 `transform-fixed`：从固定合法终盘出发做等价变换。该模式可复现、速度快、适合 smoke 和候选池任务，但不覆盖所有终盘等价类。

## 目标

1. 增加真正随机的完整终盘生成能力。
2. 保持相同 seed 可复现。
3. 不改变现有默认行为。
4. 为后续外部 solution pool 留出接口边界。

## 方案对比

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| transform-fixed | 快、稳定、可复现 | 多样性受固定终盘等价类限制 | 保持默认 |
| random-backtracking | 实现成本中等，多样性更好，可 seed | 极端 seed 可能慢，需要预算保护 | 推荐新增 |
| DLX 随机精确覆盖 | 理论清晰，适合大规模枚举 | 实现和验证成本高 | 暂不做 |
| 外部 solution pool | 用户可控制 provenance 和质量 | 需要校验格式、抽样和 license 文档 | 支持轻量输入 |

## API 草案

```ts
generateOne({
  seed: 1,
  solutionSource: 'transform-fixed',
});
```

候选值：

1. `transform-fixed`：默认值，保持现有行为。
2. `random-backtracking`：用 seeded RNG 随机填充完整终盘。
3. `pool`：从调用方提供的 solution pool 中按 seed 抽取。

外部 pool 草案：

```ts
generateOne({
  seed: 1,
  solutionSource: 'pool',
  solutionPool: [
    [5, 3, 4, 6, 7, 8, 9, 1, 2]
  ],
});
```

## 质量指标

1. 完整合法终盘率：必须 100%。
2. seed 稳定性：相同 seed 输出一致。
3. 多样性：100 个 seed 的 serialized solution 不重复率应达到 90% 以上。
4. 性能：常规 seed 应在毫秒到低十毫秒级生成。
5. 预算：随机 backtracking 应有 node / elapsed guard，避免极端慢。

## 不做的事

1. 不直接复制其他开源项目代码。
2. 不把外部 solution pool 随 npm 包发布。
3. 不改变当前默认生成结果。
4. 不把终盘随机性等同于题目难度质量。

## 迁移风险

1. 用户依赖 seed 生成稳定题目，因此默认必须保持 `transform-fixed`。
2. `random-backtracking` 只改变终盘来源，后续挖洞、唯一解、评分和 constraints 流程不变。
3. `pool` 模式需要明确 provenance；调用方应自行负责 pool 的 license 和质量。
