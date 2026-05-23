import { EMPTY_VALUE } from '../core/constants.js';
import { cloneBoard } from '../core/grid.js';
import type { Board } from '../core/types.js';
import { checkUniqueness } from '../uniqueness/index.js';

export interface PuzzleMinimizerOptions {
  maxElapsedMs?: number;
}

export interface PuzzleMinimizerResult {
  puzzle: Board;
  aborted: boolean;
}

export class PuzzleMinimizer {
  public minimize(puzzle: Board, options: PuzzleMinimizerOptions = {}): PuzzleMinimizerResult {
    const result = cloneBoard(puzzle);
    const startedAt = Date.now();
    for (let index = 0; index < result.length; index += 1) {
      if (hasTimedOut(startedAt, options.maxElapsedMs)) {
        return { puzzle: result, aborted: true };
      }
      if (result[index] === EMPTY_VALUE) {
        continue;
      }
      const value = result[index]!;
      result[index] = EMPTY_VALUE;
      const uniquenessOptions = typeof options.maxElapsedMs === 'number'
        ? { maxElapsedMs: Math.max(1, options.maxElapsedMs - (Date.now() - startedAt)) }
        : undefined;
      const uniqueness = checkUniqueness(result, uniquenessOptions);
      if (!uniqueness.uniqueSolution) {
        result[index] = value;
      }
      if (uniqueness.aborted || hasTimedOut(startedAt, options.maxElapsedMs)) {
        return { puzzle: result, aborted: true };
      }
    }
    return { puzzle: result, aborted: false };
  }
}

function hasTimedOut(startedAt: number, maxElapsedMs: number | undefined): boolean {
  return typeof maxElapsedMs === 'number' && Date.now() - startedAt >= maxElapsedMs;
}
