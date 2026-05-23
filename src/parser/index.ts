import { CELL_COUNT, EMPTY_VALUE } from '../core/constants.js';
import { assertBoardValues } from '../core/grid.js';
import type { Board } from '../core/types.js';

export type PuzzleInput = string | readonly number[];

export interface ParsePuzzleResult {
  ok: boolean;
  board: Board | null;
  errors: string[];
  invalidIndexes: number[];
}

export function parsePuzzle(input: PuzzleInput): Board {
  const result = tryParsePuzzle(input);
  if (!result.ok || !result.board) {
    throw new Error(result.errors.join('; ') || 'Invalid puzzle input');
  }
  return result.board;
}

export function tryParsePuzzle(input: PuzzleInput): ParsePuzzleResult {
  if (typeof input === 'string') {
    return parsePuzzleString(input);
  }
  return parsePuzzleArray(input);
}

export function serializeBoard(board: Board, emptyChar = '0'): string {
  assertBoardValues(board);
  if (emptyChar.length !== 1) {
    throw new Error('emptyChar must be exactly one character');
  }
  return board.map((value) => value === EMPTY_VALUE ? emptyChar : String(value)).join('');
}

function parsePuzzleString(input: string): ParsePuzzleResult {
  const chars = input.replace(/\s/g, '').split('');
  const errors: string[] = [];
  const invalidIndexes: number[] = [];
  if (chars.length !== CELL_COUNT) {
    errors.push(`Puzzle string must contain ${CELL_COUNT} cells, got ${chars.length}`);
  }

  const board: Board = [];
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index]!;
    if (char === '.' || char === '0') {
      board.push(EMPTY_VALUE);
      continue;
    }
    if (/^[1-9]$/.test(char)) {
      board.push(Number(char));
      continue;
    }
    errors.push(`Invalid character at ${index}: ${char}`);
    invalidIndexes.push(index);
    board.push(EMPTY_VALUE);
  }

  return {
    ok: errors.length === 0,
    board,
    errors,
    invalidIndexes,
  };
}

function parsePuzzleArray(input: readonly number[]): ParsePuzzleResult {
  const errors: string[] = [];
  const invalidIndexes: number[] = [];
  if (input.length !== CELL_COUNT) {
    errors.push(`Puzzle array must contain ${CELL_COUNT} cells, got ${input.length}`);
  }

  const board = input.map((value, index) => {
    if (!Number.isInteger(value) || value < 0 || value > 9) {
      errors.push(`Invalid value at ${index}: ${value}`);
      invalidIndexes.push(index);
      return EMPTY_VALUE;
    }
    return value;
  });

  return {
    ok: errors.length === 0,
    board,
    errors,
    invalidIndexes,
  };
}
