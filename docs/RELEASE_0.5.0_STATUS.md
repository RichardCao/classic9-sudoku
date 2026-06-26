# 0.5.0 发布状态

本文记录当前是否适合准备 `0.5.0`，以及 npm 包和 GitHub 仓库的内容边界。

## 当前结论

当前 `0.5.0` release candidate 已通过本地发布门禁。代码和文档层面已经具备发布条件，剩余是人工执行 npm publish、GitHub release/tag 和发布后公告/检查。

原因：

1. 生成器、candidate pool、canonical 和发布验证已经形成了明确边界。
2. `generateOne()` 默认行为没有被实验策略改变。
3. `adaptive-beam`、`preset-transform`、generator diagnostics 和 deep canonical audit 都保留为 GitHub 开发/评估工具，不作为 npm 公开 API 承诺。
4. npm 包内容需要保持面向调用方使用，不携带开发过程、benchmark 过程、路线图、issue backlog 和发布准备文档。
5. `package.json`、`package-lock.json`、`src/version.ts`、CLI/version 测试期望和 GitHub bug report 版本占位已经同步到 `0.5.0`。
6. `CHANGELOG.md` 已增加 `0.5.0` 条目，明确新增能力、行为边界和仍不承诺的公开 API。
7. `npm run verify:release -- --input tests/fixtures/release-smoke-corpus.json` 已通过。

## 0.5.0 可包含的用户可见能力

适合进入 0.5.0 的内容：

1. `solutionSource` 的 `random-backtracking` 和 `pool` 能力，前提是文档继续说明它们不改变默认行为。
2. 候选池 workflow：离线 search、canonical 去重、stats、bucket selection、technique bucket selection。
3. canonical 空盘和单线索 fast path，以及 release canonical equivalence audit。
4. `GENERATOR.md` 中对 hard / expert / narrow score / technique target 的 best-effort 和 pool-first 边界。
5. Browser、migration、minimal use、generator cookbook、candidate pool、canonical 等用户文档。

不适合进入 0.5.0 公开 API 的内容：

1. Public `generationStrategy`。
2. Public `adaptive-beam`。
3. Public `preset-transform` 或内置 preset puzzle database。
4. 在线实时稳定命中 hard / expert / 指定 hardest technique 的承诺。
5. Subpath exports 的正式稳定承诺。

## npm 包内容边界

npm 包应包含：

1. `dist/src`。
2. `README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`LICENSE`、`SECURITY.md`。
3. 面向调用方的 docs：
   - API
   - state / schema / solver / techniques / rating
   - canonical
   - generator / generator cookbook / candidate pool / presets
   - browser usage
   - compatibility / SE compatibility
   - migration / minimal use
4. `examples`。

npm 包不应包含：

1. `scripts`。
2. `tests` 和 fixtures。
3. benchmark / audit 工具源码。
4. route map、ADR、issue backlog、release prep、market metrics、implementation notes。
5. generator strategy experiment logs。
6. package status comparison 和 post-release task queue。

当前 `package.json.files` 已按这个边界收敛。后续应以 `npm pack --dry-run --json` 结果确认。

版本同步前 dry-run 证据：

1. `npm pack --dry-run --json --cache ./.npm-cache` 已通过。
2. 当前包 `entryCount` 为 `96`，tarball size 约 `197 KB`，unpacked size 约 `1.02 MB`。
3. dry-run files 中没有 `scripts/`、`tests/`、`src/`、`dist/tests/` 或 `dist/tmp/`。
4. dry-run files 中没有 `docs/ADR_*`、`docs/RELEASE_*`、`docs/MILESTONES.md`、`docs/GITHUB_ISSUE_BACKLOG.md`、`docs/MARKET_METRICS.md`、`docs/GENERATOR_STRATEGY_UPDATE_STEPS.md` 等 GitHub-only 文档。
5. 正式版本同步到 `0.5.0` 后仍需重新运行 pack dry-run，因为 tarball metadata 和版本号会变化。
6. `npm run smoke:pack` 已通过，并会显式拒绝 `scripts/`、`tests/` 和 GitHub-only docs 进入发布包。
7. `npm test` 已通过。注意不要和 `smoke:pack` 并行运行，因为 `prepack` 会执行 `clean` 并重建 `dist`。

版本同步后 dry-run 证据：

1. `npm pack --dry-run --json --cache ./.npm-cache` 已通过。
2. 包版本为 `@sudoku-tools/classic9@0.5.0`。
3. `entryCount = 96`，tarball size `198246` bytes，unpacked size `1020087` bytes。
4. dry-run files 中没有 `scripts/`、`tests/`、`src/`、`dist/tests/` 或 `dist/tmp/`。
5. dry-run files 中没有 GitHub-only docs，例如 `docs/ADR_*`、`docs/RELEASE_*`、`docs/MILESTONES.md`、`docs/GITHUB_ISSUE_BACKLOG.md`、`docs/MARKET_METRICS.md`、`docs/GENERATOR_STRATEGY_UPDATE_STEPS.md`。
6. `npm run smoke:pack` 已通过，安装后的包可导入并通过 forbidden 文件断言。

## GitHub 仓库内容边界

GitHub 仓库应包含 npm 包不包含的开发资产：

1. audit / benchmark / synthesis scripts。
2. tests、fixtures、reference corpus 和 release smoke corpus。
3. ADR、roadmap、milestones、issue backlog、release prep。
4. generator strategy 实验文档和输出命令。
5. canonical / generator review plan。
6. market metrics、package status comparison、测试审计文档。
7. GitHub issue templates 和 CI workflow。

这些内容用于维护、发布决策和可复现工程过程，不作为 npm runtime 或 npm docs 的一部分。

## 发布前必须补齐

正式发布 `0.5.0` 前检查项：

1. 版本同步：已完成。
2. `CHANGELOG.md` 增加 `0.5.0` 条目：已完成。
3. `README.md` 中 release / verification 命令确认不引用 npm 包外断链文档：已完成。
4. 版本同步后重新运行 `npm pack --dry-run --json`，确认没有 `scripts/`、`tests/`、GitHub-only docs：已完成。
5. `npm run smoke:pack` 验证打包后安装可用：已完成。
6. `npm run verify:release -- --input tests/fixtures/release-smoke-corpus.json` 通过：已完成。
7. 如需深度 canonical gate，手动运行 `npm run verify:release:canonical-full -- --input tests/fixtures/release-smoke-corpus.json`，但不要把 full audit 作为默认快速发布 gate：单独 full canonical audit 已完成。

本地最终验证结果：

1. `npm run typecheck`：通过。
2. `npm test`：通过，快速测试集通过，按预期跳过 slow tests。
3. `npm run test:slow`：通过，slow profile 通过，按预期跳过 fast tests。
4. `npm run examples:typecheck`：通过。
5. `npm run audit:canonical-equivalence:release`：通过，`rowsChecked = 8`、`randomTransformsChecked = 16`、`geometryTransformsChecked = 48`、`singleClueBoardsChecked = 729`、`failures = []`、`warnings = []`。
6. `npm run smoke:dist`：通过。
7. `npm run smoke:cli`：通过。
8. `npm pack --dry-run --json --cache ./.npm-cache`：通过，`entryCount = 96`。
9. `npm run smoke:pack`：通过。
10. `npm run verify:release -- --input tests/fixtures/release-smoke-corpus.json`：通过。
11. release smoke corpus audit：`stable audit: 1/1 solved`，`action mismatches = 0`，`solution mismatches = 0`，`slow warnings > 10000ms = 0`，`hard failures > 60000ms = 0`。

## 建议发布前命令

基础发布门禁：

```bash
npm run verify:release -- --input tests/fixtures/release-smoke-corpus.json
```

包内容复核：

```bash
npm pack --dry-run --json --cache ./.npm-cache
```

可选深度 canonical 复核：

```bash
npm run verify:release:canonical-full -- --input tests/fixtures/release-smoke-corpus.json
```

已完成的深度 canonical 证据：

1. 用户已运行 `npm run audit:canonical-equivalence:full`。
2. 结果：`rowsChecked = 68`、`randomTransformsChecked = 408`、`geometryTransformsChecked = 408`、`singleClueBoardsChecked = 729`。
3. `failures = []`、`warnings = []`、`passed = true`。
4. 结论：`canonical.classic9.v1` 对抽样的唯一解题面等价变换保持稳定。
5. 该命令输出中的 npm 包版本仍显示 `0.4.0`，因为它是在版本同步前运行；后续改动没有修改 canonical 实现，最终发布判断已以 `0.5.0` 版本下通过的 `verify:release` 作为默认门禁。

## 当前建议

按 `0.5.0` 继续准备，而不是 `0.4.1`。

理由：

1. 当前变更已经超出 patch 范围，包含 generator source、candidate pool schema/selection、canonical gate、docs 和 release workflow 边界。
2. 默认 runtime 行为保持兼容，但新增能力和文档边界更接近 minor release。
3. 版本同步、changelog、pack 内容审计、smoke pack 和 `verify:release` 已完成。
4. 当前剩余工作不是代码阻塞项，而是手动发布动作：确认 git diff、提交、打 tag、`npm publish`、GitHub release 和发布后安装 smoke。
