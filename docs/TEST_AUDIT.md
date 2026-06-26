# 测试必要性审计

审计目标：确认当前快速测试、慢速测试和发布审计是否各有必要，避免把 release 级重任务重新塞回默认 `npm test`，也避免删除必要的安全网。

审计时间：2026-06-23。
审计范围：`tests/run-tests.ts`、`package.json` npm scripts、reference fixture、audit scripts。

## 当前测试分层

| 命令 | 作用 | 当前定位 |
| --- | --- | --- |
| `npm test` | TypeScript 编译后运行 fast profile | 日常开发和 PR 快速反馈 |
| `npm run test:slow` | 只运行 `runSlowTest(...)` 标记的慢测 | release 前慢速回归和审计脚本 smoke |
| `npm run test:full` | fast + slow 同一进程全量运行 | 复现完整 runner 顺序或本地深度验证 |
| `npm run verify` | typecheck、fast test、examples、reference audit、dist/CLI/pack smoke | 常规源码验证 |
| `npm run verify:release -- --input <file>` | fast + slow + examples + smoke + pack + 外部题集 audit | 发布前门禁 |

## slow tests 清单和保留结论

以下耗时来自 2026-06-22 的 profiling 结果，具体数值会随机器负载波动。

| 测试 | 观测耗时 | 覆盖目标 | 结论 |
| --- | ---: | --- | --- |
| `testCanonicalize` | 约 24.7s | canonical 正常题、空盘、稀疏盘、pair 行为 | 保留在 slow；后续 C1/C2 优化后可重评 |
| `testSelectFromCandidates` | 约 12.8s | 候选池筛选、分桶、canonical 去重 | 保留在 slow；C4 后重评 |
| `testSelectCli` | 约 3.9s | `select` CLI 文件读写和结果输出 | 保留在 slow；可在 CI 中按需跑 |
| `testMergeCandidatesCli` | 约 7.8s | `merge-candidates` CLI、dedupe、非法输入 | 保留在 slow；C4 后重评 |
| `testCandidatePoolStatsAndDedupeApi` | 约 12.7s | 候选池 stats/dedupe API | 保留在 slow；C4 后重评 |
| `testCandidatePoolStatsAndDedupeCli` | 约 7.7s | `candidate-stats` / `dedupe-candidates` CLI | 保留在 slow；C4 后重评 |
| `testReferenceAuditScript` | 约 2.4s | reference smoke audit 脚本 JSON / invalid case | 保留在 slow；脚本接口 smoke 必要 |
| `testReferenceRatingCorpus` | 约 150.2s | 68 条真实题面唯一解、评分、replay | 保留在 slow；核心 release 安全网 |
| `testReferenceRatingAuditScript` | 约 397.8s | rating corpus audit 脚本 JSON/human/invalid case | 保留但需后续精简；当前覆盖脚本入口和错误路径 |
| `testReferenceRatingCandidateSearchScript` | 约 6.7s | candidate search 脚本多输入格式和参数 | 保留在 slow；工具链 smoke 必要 |
| `testReferenceRatingCandidateSynthesisScript` | 约 1.0s | synthesis 脚本 smoke | 保留在 slow |
| `testReferenceGapAuditScript` | 约 2.3s | gap audit 脚本参数和输出 | 保留在 slow |
| `testReferenceCoverageAuditScript` | 约 1.0s | coverage audit 脚本 JSON/human | 保留在 slow |
| `testForcingBranchEvidenceAuditScript` | 约 114.6s | forcing branch evidence corpus audit | 保留在 slow；核心 evidence 安全网 |
| `testForcingSmokeEvidenceAuditScript` | 约 1.6s | forcing smoke evidence audit | 保留在 slow |
| `testBugGraphEvidenceAuditScript` | 约 1.0s | BUG graph evidence audit | 保留在 slow |
| `testBowmansBingoRealBoards` | 约 4.6s | 真实题面 Bowman's Bingo 回归 | 保留在 slow；重型 fallback 回归 |

## 重复与后续精简点

当前 slow profile 是保守分层：先保证 release 安全网不丢，再逐步精简。后续可优化的重复点：

1. `testReferenceRatingCorpus` 和 `testReferenceRatingAuditScript` 都会触达真实题面 rating corpus；前者直接验证库 API，后者验证 CLI/script 输出和错误路径。二者覆盖目标不同，但可考虑把 `testReferenceRatingAuditScript` 的 human output 部分改成 tiny input。
2. `testForcingBranchEvidenceAuditScript` 和 `verify:coverage` 中的 `audit:forcing-evidence` 存在 release gate 重叠。当前保留在 slow 是为了脚本接口和 corpus evidence 都可由 `test:slow` 单独验证；后续 CI 可以选择只在 release job 跑。
3. 候选池慢测主要受 canonical 重算影响。C4 完成后应重新 profiling，判断是否能移回 fast 或缩短 slow。
4. `testCanonicalize` 的空盘/稀疏盘退化是已知性能问题。C1/C2/C3 完成后应重新定义 canonical 性能预算。

## 归类规则

新增测试时按以下规则归类：

1. 纯函数单元测试、参数校验、轻量 smoke：放入 fast profile。
2. 真实题面 corpus 全量遍历：放入 slow profile。
3. 会启动 audit 脚本子进程且运行真实 corpus：放入 slow profile。
4. benchmark 不进入 `npm test` 或 `npm run test:slow`，使用独立 `benchmark:*` script。
5. 只验证脚本参数解析时，优先使用 tiny fixture，避免默认跑全 corpus。
6. 新增 slow test 必须在本文件中补一行说明，写明覆盖目标和保留理由。

## 当前结论

1. 当前 17 个 slow tests 都有明确覆盖目标，暂不删除。
2. `testReferenceRatingAuditScript`、`testForcingBranchEvidenceAuditScript` 是后续最值得精简的两个慢点。
3. canonical 和候选池相关慢测应在 C1/C2/C4 完成后重新审计。
4. `npm test` 当前保持 fast profile 是合理的，默认开发循环不应跑真实题面全量审计。

## 验证命令

```bash
npm test
npm run test:slow
```
