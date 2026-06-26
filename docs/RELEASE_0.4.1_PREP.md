# 0.4.1 Patch 发布准备

当前不强制立即发布 0.4.1。本文只记录如果需要 patch 发布，应包含哪些低风险变更和发布前检查。

## 建议纳入范围

1. README 首屏中文定位、Quick Start、徽章和示例入口。
2. 新增 minimal examples。
3. 测试分层和慢测计时。
4. GitHub Release / topics / issue backlog。
5. canonical 空盘 identity fast path。
6. 单线索 canonical fast path。
7. 候选池 canonicalKey 默认复用和严格审计开关。
8. 主流包迁移文档、minimal use、reference corpus、browser usage、generator cookbook。

## 不建议纳入范围

1. 大规模拆分 `solver/techniques.ts`。
2. subpath exports 正式发布。
3. CommonJS / Node 18 兼容。
4. 改变默认 generator solution source。
5. 改变 stable 技巧顺序或 rating policy。

## 发布前命令

```bash
npm test
npm run test:slow
npm run examples:typecheck
npm run audit:canonical-equivalence:release
npm run benchmark:canonical -- --iterations 1 --case empty-board --json
npm run benchmark:canonical -- --iterations 1 --case sparse-multiple --json
npm run benchmark:candidate-pool -- --size 20 --iterations 1 --json
npm run analyze:package-size -- --json --limit 5
npm pack --dry-run --json --cache ./.npm-cache
npm run verify:release -- --input tests/fixtures/release-smoke-corpus.json
```

如需把完整 canonical 等价审计也纳入发布验证，额外运行：

```bash
npm run verify:release:canonical-full
```

## 发布说明要点

1. 这是 patch 版本，重点是包装、文档、测试分层和低风险性能修复。
2. 默认 generator 行为不变；`solutionSource` 新增能力是向后兼容扩展。
3. canonical version 不变；空盘和单线索 fast path 只跳过可直接推导的等价枚举。
4. 候选池默认复用合法 `canonicalKey`，严格重算需显式开启。
5. 包体 unpacked 已超过 1MB，后续 0.5 继续处理模块边界和技巧拆分。
