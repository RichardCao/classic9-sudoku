import {
  getRatingPolicy,
  rate,
  summarizeRating,
} from '@sudoku-tools/classic9';

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';

const stable = summarizeRating(rate(puzzle, getRatingPolicy('classic-stable')));
const extended = summarizeRating(rate(puzzle, getRatingPolicy('classic-extended')));

console.log(JSON.stringify({
  stable,
  extended,
}, null, 2));
