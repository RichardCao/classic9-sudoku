# @sudoku-tools/classic9

[![npm version](https://img.shields.io/npm/v/@sudoku-tools/classic9.svg)](https://www.npmjs.com/package/@sudoku-tools/classic9)
[![npm downloads](https://img.shields.io/npm/dm/@sudoku-tools/classic9.svg)](https://www.npmjs.com/package/@sudoku-tools/classic9)
[![CI](https://github.com/RichardCao/classic9-sudoku/actions/workflows/ci.yml/badge.svg)](https://github.com/RichardCao/classic9-sudoku/actions/workflows/ci.yml)
[![types: included](https://img.shields.io/badge/types-included-brightgreen.svg)](./dist/src/index.d.ts)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-RichardCao%2Fclassic9--sudoku-black.svg)](https://github.com/RichardCao/classic9-sudoku)

标准 9x9 数独工具库，提供题面解析、状态标准化、校验、唯一解检查、人类逻辑求解、评分、生成、canonical 等价变换、候选池筛选和命令行工具。

面向标准 9x9 数独的可解释求解、评分、生成、canonical 去重、候选池和 CLI 工具链。

## 为什么用这个包

1. 结构化解题步骤：`SolveStep` 保留落子、删候选、区域、格子、链、分支和 pattern evidence。
2. 版本化评分策略：评分结果带 `ratingPolicyId` 和 `ratingPolicyVersion`，适合题库长期入库和重评。
3. canonical 去重：可把等价题面归一成稳定 key，用于候选池和题库去重。
4. 候选池和批量 CLI：支持搜索、统计、去重、筛选、合并、批量求解和批量评分。

当前版本定位：

1. 只支持标准 9x9 数独。
2. 核心库不依赖任何 UI 或业务应用框架。
3. 难度档位不是核心真理，调用方可以用自己的评分规则和题库分组。
4. 生成器和高级题库工具仍按实验能力持续改进。

stable 技巧指的是默认启用、输出结构稳定、并且已经有回归测试覆盖的技巧集合；它不等于“形式化证明已经完成”。

## 安装

运行环境：

1. Node.js `>=20`。
2. 包类型为 ESM-only，推荐使用 `import`。

```bash
npm install @sudoku-tools/classic9
```

本地开发：

```bash
npm run build
npm test
```

`npm test` 默认运行快速测试集。慢速测试集包含真实题面 corpus、reference audit 和 forcing evidence 审计，可以运行：

```bash
npm run test:slow
npm run test:full
```

## 最短示例

```ts
import {
  generateOne,
  hint,
  parsePuzzle,
  rate,
  summarizeRating,
  validate,
} from '@sudoku-tools/classic9';

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const board = parsePuzzle(puzzle);

console.log(validate(board).legal);
console.log(hint(board, { format: { locale: 'zh-CN' } }).text);
console.log(summarizeRating(rate(board)));

const generated = generateOne({
  seed: 1,
  canonicalize: true,
  minimality: 'none',
  constraints: { clues: { target: 40 } },
  budget: { maxAttempts: 1, maxElapsedMs: 3000 },
});

if (generated.status === 'success') {
  console.log(generated.puzzle?.canonicalKey);
}
```

## API 快速示例

```ts
import {
  canonicalizeBoard,
  getPackageInfo,
  hint,
  parsePuzzle,
  rate,
  summarizeRating,
  validate,
  walkthrough,
} from '@sudoku-tools/classic9';

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const board = parsePuzzle(puzzle);

console.log(getPackageInfo());
console.log(validate(board).legal);
console.log(hint(board, { format: { locale: 'zh-CN' } }).text);
console.log(walkthrough(board).solved);
console.log(summarizeRating(rate(board)));
console.log(canonicalizeBoard(board).key);
```

## API 选择表

| 目标 | 推荐 API |
| --- | --- |
| 解析题面 | `parsePuzzle` / `tryParsePuzzle` |
| 转换二维数组或 nullable board | `fromMatrix` / `fromNullableBoard` |
| 校验格式和冲突 | `validate` |
| 检查唯一解 | `checkUniqueness` |
| 获取一个人类逻辑提示 | `hint`，高级场景用 `nextStep` |
| 获取完整人类逻辑过程 | `walkthrough` / `analyzeSolve` |
| 评分和难度摘要 | `rate` + `summarizeRating` |
| 生成题目 | `generateOne` |
| 批量搜索候选池 | `search` |
| canonical 去重 | `canonicalizeBoard` |

更多示例见：

1. [examples/basic-api.ts](./examples/basic-api.ts)
2. [examples/generate-and-select.ts](./examples/generate-and-select.ts)
3. [examples/cli.md](./examples/cli.md)
4. [examples/validate.ts](./examples/validate.ts)
5. [examples/solve.ts](./examples/solve.ts)
6. [examples/hint.ts](./examples/hint.ts)
7. [examples/rate.ts](./examples/rate.ts)
8. [examples/generate.ts](./examples/generate.ts)
9. [examples/canonical-dedupe.ts](./examples/canonical-dedupe.ts)

## CLI 快速示例

安装为依赖或全局包后，可以通过 `sudoku` 命令调用：

```bash
sudoku validate "530070000600195000098000060800060003400803001700020006060000280000419005000080079"
sudoku version
sudoku solve "534678912672195348198342567859761423426853791713924856961537284287419635345286170" --format text --locale zh-CN
sudoku rate "534678912672195348198342567859761423426853791713924856961537284287419635345286170"
sudoku rate "530070000600195000098000060800060003400803001700020006060000280000419005000080079" --profile extended
sudoku techniques
sudoku schema
```

批量求解和批量评分：

```bash
sudoku batch-solve --input puzzles.txt --output solve.jsonl --format jsonl --summary solve-summary.json --usage solve-usage.json
sudoku batch-rate --input puzzles.txt --output rating.csv --format csv --summary rating-summary.json
```

没有安装时，也可以用 npx：

```bash
npx -p @sudoku-tools/classic9 sudoku version
```

本地源码构建后也可以直接运行 `node dist/src/cli/index.js ...`。

## 源码仓库发布前验证

发布前如果需要对外部 expert 题集做 stable 可解和真解动作审计，可以在源码仓库里运行：

```bash
npm run verify:release -- --input /path/to/expert.ts
```

仓库内提供一个最小可复现 smoke 题集，可用于本地和 CI 的 release gate 冒烟检查：

```bash
npm run verify:release -- --input tests/fixtures/release-smoke-corpus.json
```

参考技巧也有一组源码仓库审计，用于确认 smoke fixture、真实题面评分路径、目标技巧优先级、evidence 引用和可回放步骤仍然同步：

```bash
npm run audit:reference
npm run audit:coverage
npm run verify:coverage
```

`audit:reference` 会同时运行人工候选态 reference smoke 和真实题面 `reference-rating-corpus.json` 审计，后者会校验唯一解、完整评分路径、步骤 evidence 和是否误删真解候选，因此属于慢速审计。`audit:coverage` 检查 90 个技巧定义是否都具备 smoke / rating corpus 覆盖。`verify:coverage` 额外汇总 forcing evidence、forcing smoke 和 BUG graph evidence 审计。

`audit:reference`、`audit:coverage`、`audit:stable`、`verify:coverage` 和 `verify:release` 都是源码仓库开发/发布验证脚本，不会随 npm 包一起发布。它们适合检查参考技巧可达性、真实题面评分路径、expert 全量可解、慢题 top N，以及稳定技巧是否误删真解候选。

## 生成和候选池

生成一道题：

```bash
sudoku generate '{"seed":1,"canonicalize":true,"minimality":"none","constraints":{"clues":{"target":40,"min":35,"max":45}},"budget":{"maxAttempts":1,"maxElapsedMs":3000}}'
```

批量搜索并保存候选池：

```bash
sudoku search '{"seed":1,"maxResults":5,"scoreBucketSize":100,"canonicalize":true,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":10,"maxElapsedMs":5000}}' --summary-only --write-candidates ./dist/tmp/candidates.json --write-manifest ./dist/tmp/search-manifest.json
```

续跑同一任务：

```bash
sudoku search '{"seed":1,"maxResults":5,"scoreBucketSize":100,"canonicalize":true,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":10,"maxElapsedMs":5000}}' --summary-only --resume-manifest ./dist/tmp/search-manifest.json --write-candidates ./dist/tmp/candidates.json --append-candidates
```

候选池统计、去重和筛选：

```bash
sudoku candidate-stats ./dist/tmp/candidates.json
sudoku dedupe-candidates ./dist/tmp/candidates.json --out ./dist/tmp/candidates-deduped.json
sudoku select ./dist/tmp/candidates-deduped.json ./selection-plan.json --write-selected ./dist/tmp/selected.json --write-rejected ./dist/tmp/rejected.json
```

并行 shard 计划和合并：

```bash
sudoku parallel-search-plan request.json --out-dir ./dist/tmp/shards --workers 5 --attempts-per-worker 100
sudoku merge-candidates ./dist/tmp/shards/worker-01-candidates.json ./dist/tmp/shards/worker-02-candidates.json --out ./dist/tmp/candidates-merged.json --dedupe-canonical
sudoku manifest-summary ./dist/tmp/shards/worker-01-manifest.json ./dist/tmp/shards/worker-02-manifest.json
```

## 技巧覆盖概览

当前公开定义包含 90 个技巧，其中 60 个为 stable、30 个为 experimental。stable 技巧默认进入 `walkthrough()`、`rate()` 和 `classic-stable.v1`；experimental 技巧需要通过 `allowedTechniques`、内置 profile 或 fallback 显式启用。

stable 技巧族覆盖 single、intersection、subset、fish、wing、ALS、pattern、coloring、chain、single-digit-chain、forcing 和 uniqueness。完整技巧列表、分数、证据结构和 experimental 边界见 [TECHNIQUES.md](./docs/TECHNIQUES.md)。

如果调用方希望在 stable 技巧全部失败后继续尝试更强求解能力，可以显式使用 `classic-extended.v1`。当前 extended 会先完整运行 stable 技巧；只有当前状态 primary 技巧全部无命中时，才把 `bowmans-bingo` 作为 fallback safety net 尝试，不会一次性启用全部 experimental forcing 技巧。

如果调用方希望使用本包自己的高覆盖入口，可以显式使用 `classic-galaxy.v1` 或 CLI `--profile galaxy`。galaxy 会启用除 `nested-forcing-chains` 外的已实现技巧，并把 `forcing-nets`、`digit-forcing-chains`、`cell-forcing-chains`、`unit-forcing-chains`、`region-forcing-chains`、`table-chain`、`dynamic-forcing-chains`、`dynamic-forcing-chains-plus` 和 `bowmans-bingo` 放入 fallback 管线，避免重型试探技巧参与每步常规扫描。`nested-forcing-chains` 比 galaxy fallback 更重，当前仅建议显式启用做离线审计。

`table-chain`、`dynamic-forcing-chains`、`dynamic-forcing-chains-plus` 和 `nested-forcing-chains` 可能非常慢，不建议默认用于批量评分或生成；它们更适合离线审计、人工研究或少量疑难题复核。

## 文档

以下文档随 npm 包发布，适合调用方离线查看：

1. [API.md](./docs/API.md)
2. [STATE.md](./docs/STATE.md)
3. [SCHEMA.md](./docs/SCHEMA.md)
4. [SOLVER.md](./docs/SOLVER.md)
5. [TECHNIQUES.md](./docs/TECHNIQUES.md)
6. [RATING.md](./docs/RATING.md)
7. [CANONICAL.md](./docs/CANONICAL.md)
8. [GENERATOR.md](./docs/GENERATOR.md)
9. [CANDIDATE_POOL.md](./docs/CANDIDATE_POOL.md)
10. [PRESETS.md](./docs/PRESETS.md)
11. [COMPATIBILITY.md](./docs/COMPATIBILITY.md)
12. [SE_COMPATIBILITY.md](./docs/SE_COMPATIBILITY.md)
13. [MINIMAL_USE.md](./docs/MINIMAL_USE.md)
14. [MIGRATING_FROM_POPULAR_PACKAGES.md](./docs/MIGRATING_FROM_POPULAR_PACKAGES.md)
15. [MIGRATING_FROM_SIMPLE_SUDOKU_PACKAGES.md](./docs/MIGRATING_FROM_SIMPLE_SUDOKU_PACKAGES.md)
16. [GENERATOR_COOKBOOK.md](./docs/GENERATOR_COOKBOOK.md)
17. [BROWSER_USAGE.md](./docs/BROWSER_USAGE.md)

GitHub 仓库内还保留路线图、ADR、发布准备、benchmark/audit 记录、issue backlog、市场指标和测试审计等开发协作文档。这些文件用于项目维护和发布决策，不随 npm 包发布。

## 参考与致谢

本项目在高级解题技巧覆盖、技巧命名和求解路径验证过程中，参考了开源项目 [Sudoku Explainer](https://sourceforge.net/projects/sudoku-explainer/)。

Sudoku Explainer 是 Keith Corlett 维护的 Java / Swing 数独解释器，项目说明中注明其基于 DIUF Sudoku Explainer，并吸收了 HoDoKu 的 hinters。`@sudoku-tools/classic9` 不包含 Sudoku Explainer 的源码，也不把它作为运行时依赖；相关参考主要用于理解技巧体系、对照实现边界和设计包外审计样本。

## 本地验证

```bash
npm run typecheck
npm test
npm run test:slow
npm run test:full
npm run examples:typecheck
npm run audit:reference
npm run audit:coverage
npm run verify:coverage
npm run smoke:dist
npm run smoke:cli
npm run pack:dry-run
npm run verify
```

## 许可证

MIT
