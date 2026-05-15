import {
  canonicalizeBoard,
  formatStep,
  getPackageInfo,
  parsePuzzle,
  rate,
  validate,
  walkthrough,
} from '@sudoku-tools/classic9';

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const board = parsePuzzle(puzzle);
const validation = validate(board);
const analysis = walkthrough(board, { maxSteps: 200 });
const rating = rate(board);
const canonical = canonicalizeBoard(board);
const packageInfo = getPackageInfo();

console.log(JSON.stringify({
  package: packageInfo,
  valid: validation.legal,
  solved: analysis.solved,
  steps: analysis.steps.length,
  score: rating.score,
  ratingPolicy: `${rating.ratingPolicyId}.v${rating.ratingPolicyVersion}`,
  canonicalKey: canonical.key,
}, null, 2));

if (analysis.steps[0]) {
  console.log(formatStep(analysis.steps[0], {
    locale: 'zh-CN',
    style: 'teaching',
    stepNumber: 1,
  }));
}
