import {
  summarizeAnalysis,
  walkthrough,
} from '@sudoku-tools/classic9';

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const analysis = walkthrough(puzzle, { maxSteps: 200 });
const summary = summarizeAnalysis(analysis);

console.log(JSON.stringify({
  solved: summary.solved,
  steps: summary.stepCount,
  hardestTechnique: summary.hardestTechnique,
  stuckReason: summary.stuckReason ?? null,
}, null, 2));
