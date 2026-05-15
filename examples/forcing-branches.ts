import {
  formatStep,
  nextStep,
} from '@sudoku-tools/classic9';

const puzzle = '006000400000050070070100030800079006060301050700620004090007020030060000008000900';

const step = nextStep(puzzle, {
  allowedTechniques: ['bowmans-bingo'],
});

if (!step) {
  throw new Error('当前题面未命中 Bowmans Bingo。');
}

console.log(formatStep(step, {
  locale: 'zh-CN',
  style: 'teaching',
}));

console.log(JSON.stringify({
  action: step.actions[0],
  branches: step.evidence.branches?.map((branch) => ({
    assumption: branch.assumption,
    contradiction: branch.contradiction,
    contradictionAt: branch.contradictionAt,
    summarizedActionCount: branch.actions?.length ?? 0,
  })),
}, null, 2));
