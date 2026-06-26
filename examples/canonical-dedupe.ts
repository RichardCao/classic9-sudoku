import {
  applyTransformToBoard,
  canonicalizeBoard,
  parsePuzzle,
} from '@sudoku-tools/classic9';

const puzzle = parsePuzzle('530070000600195000098000060800060003400803001700020006060000280000419005000080079');
const rowSwapInFirstBand = {
  transposed: false,
  rowOrder: [1, 0, 2, 3, 4, 5, 6, 7, 8],
  colOrder: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  digitMap: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
};

const equivalentPuzzle = applyTransformToBoard(puzzle, rowSwapInFirstBand);
const originalCanonical = canonicalizeBoard(puzzle);
const equivalentCanonical = canonicalizeBoard(equivalentPuzzle);

console.log(JSON.stringify({
  originalKey: originalCanonical.key,
  equivalentKey: equivalentCanonical.key,
  duplicateByCanonicalKey: originalCanonical.key === equivalentCanonical.key,
}, null, 2));
