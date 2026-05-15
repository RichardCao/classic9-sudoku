import { CELL_COUNT, EMPTY_VALUE } from '../core/constants.js';
import { ALL_HOUSES, getHouseCells } from '../core/grid.js';
import type { Board } from '../core/types.js';
import { tryParsePuzzle, type PuzzleInput } from '../parser/index.js';
import { normalizeState, type StateInput } from '../state/index.js';

export interface ValidationResult {
  boardLengthValid: boolean;
  invalidValueIndexes: number[];
  hasConflict: boolean;
  conflictIndexes: number[];
  legal: boolean;
  emptyCount: number;
  clueCount: number;
  contradictions: string[];
  warnings: string[];
}

export function validate(input: StateInput): ValidationResult {
  if (typeof input === 'string' || Array.isArray(input)) {
    const parsed = tryParsePuzzle(input as PuzzleInput);
    if (!parsed.ok || !parsed.board) {
      const board = Array.isArray(input) ? [...input] : [];
      return buildValidationResult(board, parsed.errors);
    }
    return buildValidationResult(parsed.board, []);
  }

  const normalized = normalizeState(input);
  return buildValidationResult(
    normalized.board,
    normalized.contradictions.map((item) => item.message),
    normalized.warnings.map((item) => item.message),
  );
}

function buildValidationResult(
  board: readonly number[],
  contradictions: string[],
  warnings: string[] = [],
): ValidationResult {
  const boardLengthValid = board.length === CELL_COUNT;
  const invalidValueIndexes = collectInvalidValueIndexes(board as Board);
  const conflictIndexes = boardLengthValid && invalidValueIndexes.length === 0
    ? collectConflictIndexes(board as Board)
    : [];
  const emptyCount = board.filter((value) => value === EMPTY_VALUE).length;
  const clueCount = board.filter((value) => value !== EMPTY_VALUE).length;

  return {
    boardLengthValid,
    invalidValueIndexes,
    hasConflict: conflictIndexes.length > 0,
    conflictIndexes,
    legal: boardLengthValid
      && invalidValueIndexes.length === 0
      && conflictIndexes.length === 0
      && contradictions.length === 0,
    emptyCount,
    clueCount,
    contradictions,
    warnings,
  };
}

function collectInvalidValueIndexes(board: Board): number[] {
  const indexes: number[] = [];
  for (let index = 0; index < board.length; index += 1) {
    const value = board[index] ?? EMPTY_VALUE;
    if (!Number.isInteger(value) || value < 0 || value > 9) {
      indexes.push(index);
    }
  }
  return indexes;
}

function collectConflictIndexes(board: Board): number[] {
  const flagged = new Array<boolean>(CELL_COUNT).fill(false);
  for (const house of ALL_HOUSES) {
    const seen = new Map<number, number[]>();
    for (const cell of getHouseCells(house)) {
      const value = board[cell] ?? EMPTY_VALUE;
      if (value === EMPTY_VALUE) {
        continue;
      }
      const cells = seen.get(value) ?? [];
      cells.push(cell);
      seen.set(value, cells);
    }
    for (const cells of seen.values()) {
      if (cells.length > 1) {
        for (const cell of cells) {
          flagged[cell] = true;
        }
      }
    }
  }
  return flagged.flatMap((value, index) => value ? [index] : []);
}
