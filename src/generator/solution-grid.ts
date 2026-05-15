import { createEmptyBoard } from '../core/grid.js';
import type { Board } from '../core/types.js';
import { SeededRandom, shuffleWithRandom } from './random.js';

const BASE_SOLUTION: Board = createEmptyBoard().map((_, index) => {
  const row = Math.floor(index / 9);
  const col = index % 9;
  return ((row * 3 + Math.floor(row / 3) + col) % 9) + 1;
});

function permuteDigits(board: Board, random: SeededRandom): Board {
  const digits = shuffleWithRandom([1, 2, 3, 4, 5, 6, 7, 8, 9], () => random.next());
  return board.map((value) => digits[value - 1]!);
}

function permuteRows(board: Board, random: SeededRandom): Board {
  const bandOrder = shuffleWithRandom([0, 1, 2], () => random.next());
  const rowOrder: number[] = [];
  for (const band of bandOrder) {
    const rows = shuffleWithRandom([0, 1, 2], () => random.next()).map((offset) => band * 3 + offset);
    rowOrder.push(...rows);
  }

  const result = createEmptyBoard();
  for (let targetRow = 0; targetRow < 9; targetRow += 1) {
    const sourceRow = rowOrder[targetRow]!;
    for (let col = 0; col < 9; col += 1) {
      result[targetRow * 9 + col] = board[sourceRow * 9 + col]!;
    }
  }
  return result;
}

function permuteCols(board: Board, random: SeededRandom): Board {
  const stackOrder = shuffleWithRandom([0, 1, 2], () => random.next());
  const colOrder: number[] = [];
  for (const stack of stackOrder) {
    const cols = shuffleWithRandom([0, 1, 2], () => random.next()).map((offset) => stack * 3 + offset);
    colOrder.push(...cols);
  }

  const result = createEmptyBoard();
  for (let row = 0; row < 9; row += 1) {
    for (let targetCol = 0; targetCol < 9; targetCol += 1) {
      const sourceCol = colOrder[targetCol]!;
      result[row * 9 + targetCol] = board[row * 9 + sourceCol]!;
    }
  }
  return result;
}

function transpose(board: Board): Board {
  const result = createEmptyBoard();
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      result[col * 9 + row] = board[row * 9 + col]!;
    }
  }
  return result;
}

export class SolutionGridFactory {
  public create(seed: number): Board {
    const random = new SeededRandom(seed);
    let board = [...BASE_SOLUTION];
    board = permuteDigits(board, random);
    board = permuteRows(board, random);
    board = permuteCols(board, random);
    if (random.next() > 0.5) {
      board = transpose(board);
    }
    return board;
  }
}
