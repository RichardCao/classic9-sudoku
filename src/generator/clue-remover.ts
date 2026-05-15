import { CELL_COUNT, EMPTY_VALUE } from '../core/constants.js';
import { cloneBoard } from '../core/grid.js';
import type { Board } from '../core/types.js';
import { checkUniqueness } from '../uniqueness/index.js';
import { SeededRandom, shuffleWithRandom } from './random.js';

export interface ClueRemovalOptions {
  targetClues: number;
  seed: number;
  symmetry?: 'none' | 'central';
  maxElapsedMs?: number;
}

export class ClueRemover {
  public carve(solution: Board, options: ClueRemovalOptions): Board {
    const random = new SeededRandom(options.seed);
    const puzzle = cloneBoard(solution);
    const indexes = shuffleWithRandom(
      new Array(CELL_COUNT).fill(0).map((_, index) => index),
      () => random.next(),
    );
    const startedAt = Date.now();

    for (const index of indexes) {
      if (typeof options.maxElapsedMs === 'number' && options.maxElapsedMs > 0 && Date.now() - startedAt >= options.maxElapsedMs) {
        break;
      }
      if (countClues(puzzle) <= options.targetClues) {
        break;
      }
      if (puzzle[index] === EMPTY_VALUE) {
        continue;
      }

      const pairIndex = options.symmetry === 'central' ? CELL_COUNT - 1 - index : index;
      const removed = new Map<number, number>();
      removed.set(index, puzzle[index]!);
      puzzle[index] = EMPTY_VALUE;

      if (pairIndex !== index && puzzle[pairIndex] !== EMPTY_VALUE) {
        removed.set(pairIndex, puzzle[pairIndex]!);
        puzzle[pairIndex] = EMPTY_VALUE;
      }

      if (countClues(puzzle) < options.targetClues) {
        restoreRemoved(puzzle, removed);
        continue;
      }

      const uniquenessOptions = typeof options.maxElapsedMs === 'number'
        ? { maxElapsedMs: Math.max(1, options.maxElapsedMs - (Date.now() - startedAt)) }
        : undefined;
      const uniqueness = checkUniqueness(puzzle, uniquenessOptions);
      if (!uniqueness.uniqueSolution || uniqueness.aborted) {
        restoreRemoved(puzzle, removed);
        if (uniqueness.aborted) {
          break;
        }
      }
    }

    return puzzle;
  }
}

function restoreRemoved(board: Board, removed: Map<number, number>): void {
  for (const [index, value] of removed.entries()) {
    board[index] = value;
  }
}

function countClues(board: Board): number {
  return board.reduce((count, value) => count + (value === EMPTY_VALUE ? 0 : 1), 0);
}
