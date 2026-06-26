import {
  parsePuzzle,
  validate,
} from '@sudoku-tools/classic9';

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const board = parsePuzzle(puzzle);
const valid = validate(board);
const invalid = validate('553070000600195000098000060800060003400803001700020006060000280000419005000080079');

console.log(JSON.stringify({
  legal: valid.legal,
  emptyCount: valid.emptyCount,
  invalidLegal: invalid.legal,
  invalidContradictions: invalid.contradictions,
}, null, 2));
