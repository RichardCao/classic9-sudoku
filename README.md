# @sudoku-tools/classic9

[![npm version](https://img.shields.io/npm/v/@sudoku-tools/classic9.svg)](https://www.npmjs.com/package/@sudoku-tools/classic9)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-RichardCao%2Fclassic9--sudoku-black.svg)](https://github.com/RichardCao/classic9-sudoku)

标准 9x9 数独工具库，提供题面解析、状态标准化、校验、唯一解检查、人类逻辑求解、评分、生成、canonical 等价变换、候选池筛选和命令行工具。

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

## API 快速示例

```ts
import {
  canonicalizeBoard,
  getPackageInfo,
  parsePuzzle,
  rate,
  validate,
  walkthrough,
} from '@sudoku-tools/classic9';

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const board = parsePuzzle(puzzle);

console.log(getPackageInfo());
console.log(validate(board).legal);
console.log(walkthrough(board).solved);
console.log(rate(board).score);
console.log(canonicalizeBoard(board).key);
```

更多示例见：

1. [examples/basic-api.ts](./examples/basic-api.ts)
2. [examples/generate-and-select.ts](./examples/generate-and-select.ts)
3. [examples/cli.md](./examples/cli.md)

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

`audit:stable` 和 `verify:release` 都是源码仓库开发/发布验证脚本，不会随 npm 包一起发布。它们适合检查 expert 全量可解、慢题 top N，以及稳定技巧是否误删真解候选。

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

## 当前 stable 技巧

当前 stable 技巧包括：

1. `full-house`
2. `naked-single`
3. `hidden-single`
4. `locked-candidates`
5. `naked-pair`
6. `hidden-pair`
7. `naked-triple`
8. `hidden-triple`
9. `naked-quad`
10. `hidden-quad`
11. `x-wing`
12. `swordfish`
13. `franken-swordfish`
14. `jellyfish`
15. `finned-x-wing`
16. `finned-swordfish`
17. `finned-jellyfish`
18. `sashimi-swordfish`
19. `sashimi-jellyfish`
20. `nishio-forcing-chains`
21. `xy-wing`
22. `xyz-wing`
23. `wxyz-wing`
24. `w-wing`
25. `chute-remote-pairs`
26. `almost-locked-pair`
27. `almost-locked-triple`
28. `als-xz`
29. `als-xy-wing`
30. `fireworks`
31. `twinned-xy-chains`
32. `sue-de-coq`
33. `death-blossom`
34. `aligned-pair-exclusion`
35. `exocet`
36. `double-exocet`
37. `pattern-overlay`
38. `tridagons`
39. `sk-loops`
40. `simple-coloring`
41. `x-coloring`
42. `multi-colors`
43. `three-d-medusa`
44. `grouped-x-cycles`
45. `grouped-aic`
46. `x-chain`
47. `xy-chain`
48. `aic`
49. `aic-exotic`
50. `skyscraper`
51. `turbot-fish`
52. `two-string-kite`
53. `empty-rectangle`
54. `unique-rectangle`
55. `avoidable-rectangle`
56. `rectangle-elimination`
57. `extended-rectangle`
58. `hidden-unique-rectangle`
59. `aic-ur`
60. `bug-plus-one`

公开库还吸收了 `big-wings`，但它当前保持 `experimental`，不会进入默认 stable 顺序。

公开库也包含 `aic-als`、`big-wings`、`forcing-nets`、`digit-forcing-chains`、`cell-forcing-chains`、`unit-forcing-chains`、`table-chain`、`bowmans-bingo` 等 experimental 技巧；`nishio-forcing-chains` 已进入 stable。上面这些 experimental 技巧已经可以通过 `allowedTechniques` 显式纳入技巧集合，forcing / 试探类技巧会返回结构化分支证据。`aic-als` 当前保留技巧 ID 和定义，但在按 ALS / RCC 链模型重写前暂不产出步骤。experimental 技巧默认不会进入 `walkthrough()`、`rate()` 或 `classic-stable.v1`。

如果调用方希望在 stable 技巧全部失败后继续尝试更强求解能力，可以显式使用 `classic-extended.v1`。当前 extended 会先完整运行 stable 技巧；只有当前状态 primary 技巧全部无命中时，才把 `bowmans-bingo` 作为 fallback safety net 尝试，不会一次性启用全部 experimental forcing 技巧。

`table-chain` 可能非常慢，不建议默认用于批量评分或生成；它更适合离线审计、人工研究或少量疑难题复核。

## 文档

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

## 参考与致谢

本项目在高级解题技巧覆盖、技巧命名和求解路径验证过程中，参考了开源项目 [Sudoku Explainer](https://sourceforge.net/projects/sudoku-explainer/)。

Sudoku Explainer 是 Keith Corlett 维护的 Java / Swing 数独解释器，项目说明中注明其基于 DIUF Sudoku Explainer，并吸收了 HoDoKu 的 hinters。`@sudoku-tools/classic9` 不包含 Sudoku Explainer 的源码，也不把它作为运行时依赖；相关参考主要用于理解技巧体系、对照实现边界和设计包外审计样本。

## 本地验证

```bash
npm run typecheck
npm test
npm run examples:typecheck
npm run smoke:dist
npm run smoke:cli
npm run pack:dry-run
npm run verify
```

## 许可证

MIT
