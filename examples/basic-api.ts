import {
  canonicalizeBoard,
  formatStep,
  fromMatrix,
  getPackageInfo,
  hint,
  parsePuzzle,
  rate,
  summarizeRating,
  toNullableBoard,
  validate,
  walkthrough,
} from '@sudoku-tools/classic9';

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const board = parsePuzzle(puzzle);
const validation = validate(board);
const analysis = walkthrough(board, { maxSteps: 200 });
const rating = rate(board);
const ratingSummary = summarizeRating(rating);
const canonical = canonicalizeBoard(board);
const packageInfo = getPackageInfo();
const boardFromMatrix = fromMatrix([
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
const firstHint = hint(board, { format: { locale: 'zh-CN' } });

console.log(JSON.stringify({
  package: packageInfo,
  valid: validation.legal,
  solved: analysis.solved,
  steps: analysis.steps.length,
  rating: ratingSummary,
  canonicalKey: canonical.key,
  matrixInputMatches: canonicalizeBoard(boardFromMatrix).key === canonical.key,
  nullableEmptyCells: toNullableBoard(board).filter((value) => value === null).length,
  hint: firstHint.text,
}, null, 2));

if (analysis.steps[0]) {
  console.log(formatStep(analysis.steps[0], {
    locale: 'zh-CN',
    style: 'teaching',
    stepNumber: 1,
  }));
}
