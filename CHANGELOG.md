# 更新日志

本文档记录公开库层面的重要变化。

## 0.1.0

第一版公开发布。

已具备：

1. 标准 9x9 数独解析、序列化、校验和唯一解检查。
2. `PuzzleState` 和候选约束标准化。
3. stable 人类逻辑求解器和步骤回放。
4. `classic-stable.v1` 评分规则。
5. `canonical.classic9.v1` 等价变换和最小序表示。
6. 单题生成、批量搜索、续跑 manifest、并行 shard 计划。
7. 候选池统计、去重、筛选和合并。
8. JSON schema、CLI、文档和示例。
9. 公开 `getPackageInfo()`，CLI `version` 和包版本测试保持一致。
10. 示例目录纳入 `examples:typecheck` 和 `verify`。
11. 发布后的 dist CLI 纳入 `smoke:cli` 和 `verify`。

仍未稳定承诺：

1. 任意尺寸数独。
2. 变体数独。
3. 全部高级技巧。
4. 生成器在严格约束下的实时命中率。
