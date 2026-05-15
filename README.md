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
sudoku techniques
sudoku schema
```

没有安装时，也可以用 npx：

```bash
npx -p @sudoku-tools/classic9 sudoku version
```

本地源码构建后也可以直接运行 `node dist/src/cli/index.js ...`。

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
20. `xy-wing`
21. `xyz-wing`
22. `wxyz-wing`
23. `w-wing`
24. `chute-remote-pairs`
25. `almost-locked-pair`
26. `almost-locked-triple`
27. `als-xz`
28. `als-xy-wing`
29. `aic-als`
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
41. `multi-colors`
42. `three-d-medusa`
43. `grouped-x-cycles`
44. `grouped-aic`
45. `x-chain`
46. `xy-chain`
47. `aic`
48. `aic-exotic`
49. `skyscraper`
50. `turbot-fish`
51. `two-string-kite`
52. `empty-rectangle`
53. `unique-rectangle`
54. `avoidable-rectangle`
55. `rectangle-elimination`
56. `extended-rectangle`
57. `hidden-unique-rectangle`
58. `aic-ur`
59. `bug-plus-one`

公开库也包含 `forcing-nets`、`digit-forcing-chains`、`nishio-forcing-chains`、`cell-forcing-chains`、`unit-forcing-chains`、`bowmans-bingo` 六个 experimental forcing 技巧。它们已经可以通过 `allowedTechniques` 显式调用，并返回结构化分支证据，但默认不会进入 `walkthrough()`、`rate()` 或 `classic-stable.v1`。

高级技巧迁移计划见 [ADVANCED_TECHNIQUE_MIGRATION.md](./docs/ADVANCED_TECHNIQUE_MIGRATION.md)。

## 文档

1. [API.md](./docs/API.md)
2. [STATE.md](./docs/STATE.md)
3. [SCHEMA.md](./docs/SCHEMA.md)
4. [SOLVER.md](./docs/SOLVER.md)
5. [TECHNIQUES.md](./docs/TECHNIQUES.md)
6. [ADVANCED_TECHNIQUE_MIGRATION.md](./docs/ADVANCED_TECHNIQUE_MIGRATION.md)
7. [RATING.md](./docs/RATING.md)
8. [CANONICAL.md](./docs/CANONICAL.md)
9. [GENERATOR.md](./docs/GENERATOR.md)
10. [CANDIDATE_POOL.md](./docs/CANDIDATE_POOL.md)
11. [PRESETS.md](./docs/PRESETS.md)
12. [COMPATIBILITY.md](./docs/COMPATIBILITY.md)
13. [CI.md](./docs/CI.md)
14. [PUBLISHING.md](./docs/PUBLISHING.md)

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
