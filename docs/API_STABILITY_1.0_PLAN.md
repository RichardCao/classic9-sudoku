# 1.0 API 稳定性计划

本文用于说明 `@sudoku-tools/classic9` 在 1.0 前准备冻结哪些 API，哪些仍保持实验状态，以及 breaking change 应如何收口。

## 稳定目标

1. 1.0 之前尽量把常用入口稳定下来。
2. 对仍在演进的生成器、候选池和重型技巧能力保留 experimental 边界。
3. 公开 schema、评分策略、canonical version 和 CLI 输出要能解释升级风险。

## 准备冻结的 API

以下 API 目标是在 1.0 前进入稳定范围：

| 模块 | API | 1.0 前要求 |
| --- | --- | --- |
| parser | `parsePuzzle`、`tryParsePuzzle`、`serializeBoard` | 输入兼容规则固定；错误信息可微调但错误条件不应放宽到误收非法输入 |
| adapters | `fromMatrix`、`toMatrix`、`fromNullableBoard`、`toNullableBoard` | 只做形状和值域转换，不隐式校验数独合法性 |
| validate | `validate`、`normalizeState` | 返回字段可新增；已有字段语义不静默改变 |
| uniqueness | `checkUniqueness` | `status`、`solutionCount`、预算诊断语义固定 |
| solver basics | `nextStep`、`findSteps`、`walkthrough`、`analyzeSolve` | stable 技巧顺序和 `SolveStep` 基本结构保持兼容 |
| hint/presentation | `hint`、`formatStep` | 文本可优化；结构化动作和 step 引用不应破坏 |
| rating | `rate`、`summarizeRating`、`getRatingPolicy` | policy id/version 是兼容边界；评分规则变化必须升级 policy version |
| canonical | `canonicalizeBoard`、`canonicalizePair`、`applyTransformToBoard` | `canonical.classic9.v1` key 不静默改变；算法改变必须升级 version |
| schema | `getJsonSchemas`、CLI `schema` | schema 可新增字段；收紧字段需要 migration note |

## 继续 experimental 的 API

以下 API 在 1.0 前仍允许较快演进：

| 模块 | API | 可能变化 |
| --- | --- | --- |
| generator | `generateOne`、`search`、`analyzeGenerationRequest` | solution source、relaxation、budget、diagnostics、外部 pool |
| candidate pool | `selectFromCandidates`、`dedupeCandidates`、`analyzeCandidatePool` | diagnostics、metadata、严格校验选项 |
| heavy profiles | `classic-galaxy` 和重型 forcing fallback | 技巧顺序、fallback 策略、性能预算 |
| CLI 批处理 | `search`、`parallel-search-plan`、`merge-candidates` | manifest 字段、恢复策略、并行计划格式 |

experimental API 可以新增字段、diagnostics 和选项；删除或重命名仍应通过 deprecation 过渡。

## 允许的兼容变化

1. 返回对象新增可选字段。
2. diagnostics 增加 code、warning 或统计字段。
3. CLI JSON 输出新增字段。
4. schema 增加非必需字段。
5. 文本提示内容优化。
6. experimental 技巧的 evidence 结构增加更细证据。

## 需要版本说明的变化

1. 改变 `canonical.classic9.v1` key 结果。
2. 改变 rating policy 的分数或技巧顺序。
3. 改变 stable profile 默认技巧集合。
4. 改变 `SolveStep.actions` 的动作语义。
5. 改变 `GeneratedPuzzle` 必需字段。
6. 改变 CLI exit code 或默认输出格式。
7. 放宽或收紧输入解析到可能影响已有数据。

## 1.0 前应完成的 breaking changes

1. 确认 Node 版本和 ESM-only 决策，见 [ADR_MODULE_COMPATIBILITY.md](./ADR_MODULE_COMPATIBILITY.md)。
2. 确认 generator solution source API 是否进入公开契约。
3. 确认 candidate pool `canonicalKey` metadata 是否需要 algorithm/version 字段。
4. 确认是否提供 subpath exports；如果提供，应在 1.0 前稳定路径。
5. 清理或标注所有不应稳定承诺的 experimental profile 和重型技巧入口。

## Deprecation 机制

1. 小版本中先保留旧字段或旧参数，文档标记 deprecated。
2. CLI 输出 warning，但 JSON 字段仍保留到下一个 minor。
3. changelog 单独列出迁移方式。
4. 1.0 后删除稳定 API 必须进入 major。

## 1.0 checklist

1. `npm test`、`npm run test:slow`、`npm run verify:release -- --input tests/fixtures/release-smoke-corpus.json` 通过。
2. README、API、GENERATOR、CANDIDATE_POOL、CANONICAL、RATING、SOLVER 文档和实际 API 一致。
3. GitHub issue templates 和 release notes 流程稳定。
4. 至少两次发布后复盘 npm/GitHub 指标。
5. generator experimental 边界明确，不把未成熟能力描述成稳定能力。
