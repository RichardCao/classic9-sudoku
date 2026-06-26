# 测试分层说明

本项目测试分为快速测试、慢速测试、完整测试和发布验证。目标是让日常开发反馈足够快，同时保留真实题面 corpus 和 evidence audit 的 release 安全网。

## 命令选择

| 命令 | 用途 | 何时运行 |
| --- | --- | --- |
| `npm test` | 快速测试，覆盖核心 API、轻量 CLI、技巧 smoke、schema、生成器最小路径 | 每次开发、每个 PR |
| `npm run test:slow` | 慢速测试，只运行 `runSlowTest(...)` 标记的慢测 | release 前、修改 canonical/候选池/reference/audit 相关代码后 |
| `npm run test:full` | fast + slow 全量 runner | 需要复现完整测试顺序时 |
| `npm run examples:typecheck` | examples 类型检查 | 修改 examples、README 示例或公开 API 后 |
| `npm run verify` | 常规源码验证 | 合并前或发布准备前 |
| `npm run verify:release -- --input <file>` | 发布前门禁，包含 slow tests 和外部题集 audit | 发布前 |

## fast profile

`npm test` 默认运行 fast profile。适合放入 fast 的测试：

1. parser、validate、adapter、state normalization 等纯函数测试。
2. 单个技巧的最小候选态 smoke。
3. 不遍历大 corpus 的 CLI 参数测试。
4. schema、summary、presentation 等轻量测试。
5. 生成器最小 smoke，但预算必须小且可稳定完成。

fast profile 不应包含：

1. 真实题面 corpus 全量遍历。
2. 长时间 canonical 退化用例。
3. 启动 audit 脚本并跑完整 corpus 的测试。
4. benchmark。

## slow profile

`npm run test:slow` 只运行 `runSlowTest(...)` 标记的测试。适合放入 slow 的测试：

1. reference rating corpus 全量验证。
2. reference / coverage / forcing / BUG graph audit script smoke。
3. candidate pool canonical 去重类慢路径。
4. Bowman's Bingo 等真实题面重型 fallback 回归。
5. canonical 空盘、低 clue 等退化路径回归。

新增 slow test 时，需要同步更新 [`TEST_AUDIT.md`](./TEST_AUDIT.md)，说明保留理由和覆盖目标。

## full profile

`npm run test:full` 会在同一个 runner 中运行 fast 和 slow。它主要用于：

1. 排查 fast/slow 之间共享状态导致的问题。
2. 发布前本地深度复核。
3. 对比历史完整测试耗时。

日常开发不推荐默认运行 full profile。

## benchmark

benchmark 不属于测试。性能脚本应使用独立 npm script，例如：

```bash
npm run benchmark:uniqueness
```

后续新增 canonical 或候选池 benchmark，也应使用 `benchmark:*` 命名，不进入 `npm test`。

## 耗时诊断

默认测试输出保持简洁。如果需要定位新增慢点，可以开启计时：

```bash
CLASSIC9_TEST_TIMING=1 npm test
CLASSIC9_TEST_TIMING=1 npm run test:slow
CLASSIC9_TEST_TIMING=1 npm run test:full
```

计时模式会输出耗时前 20 的测试项，并打印 soft budget warning：

1. fast 单项超过 500ms 会 warning。
2. fast / full 总耗时超过 60s 会 warning。
3. slow 单项超过 5min 会 warning。
4. slow / full 总耗时超过 20min 会 warning。

默认只报警不失败。若需要在 release gate 中强制失败，可以设置：

```bash
CLASSIC9_TEST_TIMING=1 CLASSIC9_TEST_TIMING_FAIL_ON_BUDGET=1 npm run test:slow
```

## CI 建议

建议 CI 分层：

1. PR 必跑：`npm ci`、`npm run typecheck`、`npm test`、`npm run examples:typecheck`。
2. main/tag 或手动跑：`npm run test:slow`。
3. 发布前跑：`npm run verify:release -- --input tests/fixtures/release-smoke-corpus.json`。

如果 CI 时间预算不足，优先保证 PR fast job 稳定，slow job 可以放在 main/tag 或手动 workflow。

## 修改测试分层的规则

1. 把测试移出 fast 前，确认 fast 仍覆盖基础行为。
2. 删除 slow test 前，确认 `verify`、`verify:coverage` 或其他 gate 有替代覆盖。
3. 修改测试 runner 后，至少运行：

```bash
npm test
```

4. 修改 slow test 或 reference/audit 逻辑后，运行：

```bash
npm run test:slow
```
