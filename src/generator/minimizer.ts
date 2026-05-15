import { EMPTY_VALUE } from '../core/constants.js';
import { cloneBoard } from '../core/grid.js';
import type { Board } from '../core/types.js';
import { checkUniqueness } from '../uniqueness/index.js';

export class PuzzleMinimizer {
  public minimize(puzzle: Board): Board {
    const result = cloneBoard(puzzle);
    for (let index = 0; index < result.length; index += 1) {
      if (result[index] === EMPTY_VALUE) {
        continue;
      }
      const value = result[index]!;
      result[index] = EMPTY_VALUE;
      const uniqueness = checkUniqueness(result);
      if (!uniqueness.uniqueSolution) {
        result[index] = value;
      }
    }
    return result;
  }
}
