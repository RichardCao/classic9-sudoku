# Migrating From Simple Sudoku Packages

很多 Sudoku npm 包只暴露 `solve()`、`hint()`、`generate()` 这类单函数入口。`@sudoku-tools/classic9` 的核心差异是：它把题面解析、合法性校验、唯一解检查、人类逻辑步骤、评分、生成和候选池搜索分成独立 API。这样做会多几个概念，但可以避免把“回溯求一个答案”和“人类可解释解题过程”混在一起。

## 常见目标

| 如果你想要 | 使用 |
| --- | --- |
| 把字符串变成棋盘 | `parsePuzzle(input)` |
| 把 `number[][]` 转成 classic9 board | `fromMatrix(matrix)` |
| 把 `(number | null)[]` 转成 classic9 board | `fromNullableBoard(cells)` |
| 接受失败而不是抛错 | `tryParsePuzzle(input)` |
| 校验题面是否合法 | `validate(input)` |
| 判断是否唯一解 | `checkUniqueness(input)` |
| 拿一个提示 | `hint(input, options?)` |
| 拿结构化下一步 | `nextStep(input, options?)` |
| 拿完整人类逻辑过程 | `walkthrough(input, options?)` |
| 给题目评分 | `rate(input, policy?)` |
| 给 UI/API 返回摘要 | `summarizeAnalysis()` / `summarizeRating()` |
| 生成标准 9x9 题目 | `generateOne(request)` |
| 搜索一批候选题 | `search(request)` |

## Input Differences

classic9 的核心棋盘是 flat 81-cell board，空格用 `0` 表示。字符串输入可以使用 `0`、`.` 或 `-` 表示空格：

```ts
import { parsePuzzle, serializeBoard } from '@sudoku-tools/classic9';

const board = parsePuzzle('53--7----6--195---098----6-8---6---34--8-3--17---2---6-6----28---419--5----8--79');

console.log(serializeBoard(board));
```

如果你的应用使用 `number[][]`、`null` 或其他 UI 状态结构，建议在应用边界做一次 adapter 转换，核心求解仍传入 flat board 或 `PuzzleState`：

```ts
import {
  fromMatrix,
  fromNullableBoard,
  toMatrix,
  toNullableBoard,
} from '@sudoku-tools/classic9';

const boardFromGrid = fromMatrix([
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
]);

const boardFromNullable = fromNullableBoard(new Array(81).fill(null));
const gridForUi = toMatrix(boardFromGrid);
const nullableForUi = toNullableBoard(boardFromGrid);
```

## Hint vs Next Step

如果你只需要“给用户一个提示”，使用 `hint()`：

```ts
import { hint } from '@sudoku-tools/classic9';

const result = hint(puzzle, {
  format: { locale: 'zh-CN', style: 'teaching' },
});

if (result.found) {
  console.log(result.text);
  console.log(result.actions);
}
```

如果你需要完整 evidence、链、分支或候选态审计，直接使用 `nextStep()`。`hint()` 不替代 `nextStep()`；它只是更容易上手的 facade。

## Solve Naming

很多包里的 `solve()` 是回溯搜索，直接给出答案。classic9 当前公开核心里没有含糊的 `solve()` API：

| classic9 API | 含义 |
| --- | --- |
| `walkthrough()` | 按人类技巧尝试完整求解，可能卡住 |
| `rate()` | 按评分策略运行 walkthrough 并计算分数 |
| `checkUniqueness()` | 数学意义上检查无解、唯一解或多解 |

如果你要的是“任意求一个答案”的 backtracking solver，不要把 `walkthrough()` 当作等价替代。classic9 的重点是人类可解释步骤和评分。

## Difficulty

classic9 不把难度当作题目的绝对属性。`rate()` 的结果总是绑定评分策略：

```ts
import { rate, summarizeRating } from '@sudoku-tools/classic9';

const rating = rate(puzzle);
const summary = summarizeRating(rating);

console.log(summary.score);
console.log(summary.grade);
console.log(summary.ratingPolicyId, summary.ratingPolicyVersion);
```

如果你要构建产品里的 easy / medium / hard，建议把 label 存成“某个 policy/version 下的分数区间”，不要只根据 clue count。

## Generation

`generateOne()` 是约束驱动生成器，会尝试满足 clue、score、技巧、minimality 和 budget 等请求。它不是“固定 seed 池里立刻拿一题”的轻量 preset generator。

如果你只需要浏览器 demo 中快速出题，后续计划会评估 transform-based fast preset 模式。但 seed 必须有 provenance、license、solution、canonical key 和 rating metadata。

## Candidate State

简单包通常只接受当前棋盘。classic9 还接受 `PuzzleState`，可以携带可信候选数、给定数、pencil mark 约束和假设分支。这对复现外部解题器中途状态、教学样例、SE 技巧吸收回归很重要。

常规应用不需要手写候选数；直接传题面字符串或 board 即可。
