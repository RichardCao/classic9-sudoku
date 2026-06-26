# 从主流 Sudoku 包迁移到 classic9

本文面向已经使用过其他 Sudoku npm 包的调用方，说明迁移到 `@sudoku-tools/classic9` 时 API 应该怎么替换，哪些能力会增强，哪些场景反而不建议迁移。

复核来源：

1. [`sudoku-gen`](https://www.npmjs.com/package/sudoku-gen)：`getSudoku(difficulty?)`，返回 `puzzle`、`solution` 和 `difficulty`。
2. [`sudoku-core`](https://www.npmjs.com/package/sudoku-core)：`generate`、`solve`、`hint`、`analyze`，使用 81 长度 `number | null` board。
3. [`@algorithm.ts/sudoku`](https://www.npmjs.com/package/@algorithm.ts/sudoku)：`SudokuSolver`、`SudokuCreator` 和 board utility，支持 `childMatrixSize`。
4. [`sudoku`](https://www.npmjs.com/package/sudoku)：`makepuzzle`、`solvepuzzle`、`ratepuzzle`，老牌 Node/Web 生成和求解包。

## 先看迁移边界

classic9 的定位不是“最小体积生成器”或“最快回溯求解器”。它更适合以下场景：

1. 需要结构化、人类可解释的解题步骤。
2. 需要稳定的评分策略和可重评题库。
3. 需要 canonical key 做等价题去重。
4. 需要候选池、批量 CLI、reference corpus 或教学材料审计。

以下场景不建议迁移，或者只建议把 classic9 作为离线审计工具：

1. 只要浏览器里瞬时生成一题，且不关心评分、唯一解证据和解题步骤。
2. 只要数学意义上快速求一个答案，不需要人类逻辑路径。
3. 需要 16x16 或非标准宫形；classic9 当前只支持标准 9x9。
4. 需要 CommonJS-first 或 Node 18；classic9 当前是 ESM-only，要求 Node `>=20`。

## 统一输入适配

classic9 内部使用 81 长度 flat board，空格为 `0`。迁移时建议在应用边界做一次转换，不要让 UI 状态、外部包状态和 solver 状态混在一起。

```ts
import {
  fromMatrix,
  fromNullableBoard,
  parsePuzzle,
  toMatrix,
  toNullableBoard,
} from '@sudoku-tools/classic9';

const fromString = parsePuzzle('530070000600195000098000060800060003400803001700020006060000280000419005000080079');

const fromNullCells = fromNullableBoard([
  5, 3, null, null, 7, null, null, null, null,
  6, null, null, 1, 9, 5, null, null, null,
  null, 9, 8, null, null, null, null, 6, null,
  8, null, null, null, 6, null, null, null, 3,
  4, null, null, 8, null, 3, null, null, 1,
  7, null, null, null, 2, null, null, null, 6,
  null, 6, null, null, null, null, 2, 8, null,
  null, null, null, 4, 1, 9, null, null, 5,
  null, null, null, null, 8, null, null, 7, 9,
]);

const uiMatrix = toMatrix(fromString);
const uiNullable = toNullableBoard(fromNullCells);

console.log(uiMatrix.length, uiNullable.length);
```

相关文档：

1. [API.md](./API.md)
2. [RATING.md](./RATING.md)
3. [GENERATOR.md](./GENERATOR.md)
4. [CANONICAL.md](./CANONICAL.md)
5. [CANDIDATE_POOL.md](./CANDIDATE_POOL.md)

## 从 sudoku-gen 迁移

原包常见用法：

```ts
import { getSudoku } from 'sudoku-gen';

const sudoku = getSudoku('easy');
console.log(sudoku.puzzle);
console.log(sudoku.solution);
console.log(sudoku.difficulty);
```

classic9 对应 API：

```ts
import { generateOne, serializeBoard } from '@sudoku-tools/classic9';

const result = generateOne({
  seed: 1,
  canonicalize: true,
  minimality: 'none',
  constraints: {
    clues: { target: 40, min: 36, max: 45 },
    score: { min: 0, max: 900 },
  },
  budget: { maxAttempts: 5, maxElapsedMs: 5000 },
});

if (result.status === 'success' && result.puzzle) {
  console.log(serializeBoard(result.puzzle.puzzle));
  console.log(serializeBoard(result.puzzle.solution));
  console.log(result.puzzle.grade);
  console.log(result.puzzle.score);
  console.log(result.puzzle.canonicalKey);
}
```

注意事项：

1. `sudoku-gen` 的优势是极快生成和简单难度标签；classic9 的优势是评分、canonical key、唯一解和后续候选池处理。
2. `sudoku-gen` 使用 `-` 表示空格；classic9 的 `parsePuzzle()` 可以接受 `-`、`.` 和 `0`，但 `serializeBoard()` 默认输出数字字符串，空格为 `0`。
3. classic9 的 `grade` 来自评分策略，不等价于 `easy | medium | hard | expert` 这类固定标签。
4. 如果只需要前端快速出题且不需要入库审计，保留 `sudoku-gen` 可能更合适。

## 从 sudoku-core 迁移

原包常见用法：

```ts
import { analyze, generate, hint, solve } from 'sudoku-core';

const board = generate('hard');
const next = hint(board);
const solved = solve(board);
const analysis = analyze(board);
```

classic9 对应 API：

```ts
import {
  fromNullableBoard,
  hint,
  rate,
  summarizeRating,
  toNullableBoard,
  validate,
  walkthrough,
} from '@sudoku-tools/classic9';

const board = fromNullableBoard([
  5, 3, null, null, 7, null, null, null, null,
  6, null, null, 1, 9, 5, null, null, null,
  null, 9, 8, null, null, null, null, 6, null,
  8, null, null, null, 6, null, null, null, 3,
  4, null, null, 8, null, 3, null, null, 1,
  7, null, null, null, 2, null, null, null, 6,
  null, 6, null, null, null, null, 2, 8, null,
  null, null, null, 4, 1, 9, null, null, 5,
  null, null, null, null, 8, null, null, 7, 9,
]);

const legality = validate(board);
const nextHint = hint(board, { format: { locale: 'zh-CN', style: 'teaching' } });
const solvePath = walkthrough(board);
const rating = summarizeRating(rate(board));

console.log(legality.legal);
console.log(nextHint.text);
console.log(solvePath.solved);
console.log(rating.score, rating.grade);
console.log(toNullableBoard(solvePath.board));
```

注意事项：

1. `sudoku-core` 的 `solve()` 更像“给出完整解和步骤摘要”；classic9 把 `hint()`、`walkthrough()`、`rate()` 和 `checkUniqueness()` 分开，避免一个入口承担太多语义。
2. classic9 的步骤证据更细：动作、格子、区域、链、分支、候选数都尽量结构化输出。
3. classic9 默认只启用 stable 技巧；如果要使用更强 profile，需要显式传 rating policy 或 solve options。
4. 如果你只需要非常小的 bundle 和简单 `solve/hint/analyze`，迁移收益可能不抵包体成本。

## 从 @algorithm.ts/sudoku 迁移

原包常见用法：

```ts
import { SudokuCreator, SudokuSolver, createSudokuBoardData } from '@algorithm.ts/sudoku';

const solver = new SudokuSolver({ childMatrixSize: 3 });
const solution = createSudokuBoardData(9);
solver.solve(puzzle, solution);

const creator = new SudokuCreator({ childMatrixSize: 3 });
const game = creator.createSudoku(0.8);
```

classic9 对应 API：

```ts
import {
  generateOne,
  parsePuzzle,
  rate,
  serializeBoard,
  summarizeRating,
  walkthrough,
} from '@sudoku-tools/classic9';

const puzzle = parsePuzzle('530070000600195000098000060800060003400803001700020006060000280000419005000080079');
const path = walkthrough(puzzle);
const rating = summarizeRating(rate(puzzle));

const generated = generateOne({
  seed: 42,
  canonicalize: true,
  constraints: { clues: { min: 28, max: 42 } },
  budget: { maxAttempts: 10, maxElapsedMs: 10000 },
});

console.log(path.solved, rating.score);
if (generated.status === 'success' && generated.puzzle) {
  console.log(serializeBoard(generated.puzzle.puzzle));
}
```

注意事项：

1. `@algorithm.ts/sudoku` 更偏通用 solver/creator，并支持 `childMatrixSize`，例如 16x16；classic9 只做标准 9x9。
2. 如果你的核心诉求是 DLX/精确覆盖式快速求解或多尺寸数独，不应迁移到 classic9。
3. 如果你的核心诉求是 9x9 人类逻辑、教学 evidence、评分版本化和候选池审计，classic9 更贴近需求。
4. `@algorithm.ts/sudoku` 使用 `-1` 表示空格，数字范围也和 classic9 不同；迁移时必须显式转换。

## 从 sudoku 老包迁移

原包常见用法：

```ts
import { makepuzzle, ratepuzzle, solvepuzzle } from 'sudoku';

const puzzle = makepuzzle();
const solution = solvepuzzle(puzzle);
const difficulty = ratepuzzle(puzzle, 4);
```

classic9 对应 API：

```ts
import {
  checkUniqueness,
  generateOne,
  rate,
  summarizeRating,
  validate,
  walkthrough,
} from '@sudoku-tools/classic9';

const generated = generateOne({
  seed: 7,
  constraints: { clues: { target: 38 } },
  budget: { maxAttempts: 3, maxElapsedMs: 5000 },
});

if (generated.status === 'success' && generated.puzzle) {
  const puzzle = generated.puzzle.puzzle;
  console.log(validate(puzzle).legal);
  console.log(checkUniqueness(puzzle).status);
  console.log(walkthrough(puzzle).solved);
  console.log(summarizeRating(rate(puzzle)));
}
```

注意事项：

1. `sudoku` 是老牌包，API 很短，适合旧 CommonJS/Node/Web 项目；classic9 是现代 TypeScript + ESM-only 包。
2. `sudoku` 的输出结构和空格表示需要 adapter；不要直接把它的数组状态当作 classic9 board。
3. classic9 的评分结果不是 `ratepuzzle(puzzle, 4)` 的替代值，而是版本化 rating policy 的结果。
4. 如果项目仍必须兼容老 CommonJS 或 GPL 依赖策略已经固定，需要先评估迁移成本。

## 迁移检查清单

1. 把所有外部输入先转成 classic9 flat board。
2. 用 `validate()` 固定格式、值域和冲突错误。
3. 用 `checkUniqueness()` 判断入库题是否唯一解。
4. 用 `hint()` 做 UI 单步提示，用 `walkthrough()` 做完整路径。
5. 用 `rate()` + `summarizeRating()` 存储 `score`、`grade`、`ratingPolicyId`、`ratingPolicyVersion`。
6. 用 `canonicalizeBoard()` 或生成结果里的 `canonicalKey` 做去重。
7. 批量生成时保存 `seed`、`solution`、`canonicalKey`、`score`、`grade` 和技巧统计。
8. 不要把 experimental 技巧或重型 forcing 技巧默认放进在线请求路径。
