# 后续里程碑

本文把 0.4 后任务队列整理成发布节奏视角。实际发布时间仍以功能完成度和验证结果为准。

## 0.4.1 patch

目标：低风险修复和采用门槛改善。

候选范围：

1. README 和 npm metadata 改善。
2. GitHub Release、topics、issue backlog。
3. 测试分层和计时诊断。
4. canonical 空盘 / 单线索 fast path。
5. 候选池 `canonicalKey` 复用。
6. 文档补齐：迁移、minimal use、reference corpus、browser usage、generator cookbook。

门禁：

1. `npm test`。
2. `npm run test:slow`。
3. `npm run examples:typecheck`。
4. `npm pack --dry-run --json`。
5. `npm run verify:release -- --input tests/fixtures/release-smoke-corpus.json`。

## 0.5.0 minor

目标：生成器成熟度、性能和模块边界。

候选范围：

1. 随机 backtracking 终盘生成。
2. 外部 solution pool。
3. canonical 低 clue 进一步剪枝。
4. `solver/techniques.ts` 机械拆分。
5. subpath exports 是否进入实验入口。
6. package size 和 browser bundle 复盘。

门禁：

1. 所有 patch 门禁。
2. `npm run benchmark:canonical` 对比记录。
3. `npm run benchmark:candidate-pool` 对比记录。
4. 生成器 100 seed 多样性测试。
5. 包体报告不出现未解释的大幅膨胀。

## 1.0.0 readiness

目标：明确稳定承诺，而不是追求所有实验能力完成。

前置条件：

1. [API_STABILITY_1.0_PLAN.md](./API_STABILITY_1.0_PLAN.md) 完成并复核。
2. 运行环境和模块格式 ADR 明确。
3. generator experimental 边界清楚。
4. canonical version、rating policy version 和 schema 兼容规则清楚。
5. GitHub issue templates、release notes 和 changelog 流程稳定。
6. 至少两次发布后指标复盘记录。

非前置条件：

1. subpath exports 可以不作为 1.0 前置条件。
2. 所有 experimental 技巧不需要全部升为 stable。
3. CommonJS 支持不是当前 1.0 前置条件。
