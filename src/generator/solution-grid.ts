import { ALL_HOUSES, createEmptyBoard, getHouseCells, assertBoardValues } from '../core/grid.js';
import type { Board } from '../core/types.js';
import { SeededRandom, shuffleWithRandom } from './random.js';

export type SolutionSource = 'transform-fixed' | 'random-backtracking' | 'pool';

export interface SolutionGridCreateOptions {
  source?: SolutionSource;
  solutionPool?: readonly Board[];
  maxElapsedMs?: number;
  maxNodes?: number;
}

export interface SolutionGridCreateResult {
  status: 'success' | 'timeout' | 'invalid-pool';
  solution?: Board;
  diagnostics: {
    source: SolutionSource;
    nodesVisited: number;
    elapsedMs: number;
    poolSize?: number;
    message?: string;
  };
}

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
    return this.createTransformFixed(seed);
  }

  public createWithOptions(seed: number, options: SolutionGridCreateOptions = {}): SolutionGridCreateResult {
    const source = options.source ?? 'transform-fixed';
    const startedAt = Date.now();
    if (source === 'transform-fixed') {
      return {
        status: 'success',
        solution: this.createTransformFixed(seed),
        diagnostics: {
          source,
          nodesVisited: 0,
          elapsedMs: Date.now() - startedAt,
        },
      };
    }
    if (source === 'pool') {
      return this.createFromPool(seed, options.solutionPool, startedAt);
    }
    return this.createRandomBacktracking(seed, options, startedAt);
  }

  private createTransformFixed(seed: number): Board {
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

  private createFromPool(
    seed: number,
    solutionPool: readonly Board[] | undefined,
    startedAt: number,
  ): SolutionGridCreateResult {
    if (!Array.isArray(solutionPool) || solutionPool.length === 0) {
      return {
        status: 'invalid-pool',
        diagnostics: {
          source: 'pool',
          nodesVisited: 0,
          elapsedMs: Date.now() - startedAt,
          ...(Array.isArray(solutionPool) ? { poolSize: solutionPool.length } : {}),
          message: 'solutionPool must contain at least one complete valid solution.',
        },
      };
    }
    const random = new SeededRandom(seed);
    const index = Math.floor(random.next() * solutionPool.length);
    const solution = solutionPool[index];
    if (!solution || !isCompleteValidSolution(solution)) {
      return {
        status: 'invalid-pool',
        diagnostics: {
          source: 'pool',
          nodesVisited: 0,
          elapsedMs: Date.now() - startedAt,
          poolSize: solutionPool.length,
          message: `solutionPool item ${index} is not a complete valid solution.`,
        },
      };
    }
    return {
      status: 'success',
      solution: [...solution],
      diagnostics: {
        source: 'pool',
        nodesVisited: 0,
        elapsedMs: Date.now() - startedAt,
        poolSize: solutionPool.length,
      },
    };
  }

  private createRandomBacktracking(
    seed: number,
    options: SolutionGridCreateOptions,
    startedAt: number,
  ): SolutionGridCreateResult {
    const random = new SeededRandom(seed);
    const maxElapsedMs = options.maxElapsedMs ?? 1000;
    const maxNodes = options.maxNodes ?? 100_000;
    const board = createEmptyBoard();
    const rowMasks = new Array<number>(9).fill(0);
    const colMasks = new Array<number>(9).fill(0);
    const boxMasks = new Array<number>(9).fill(0);
    const cells = shuffleWithRandom(Array.from({ length: 81 }, (_, index) => index), () => random.next());
    let nodesVisited = 0;

    const search = (): boolean => {
      nodesVisited += 1;
      if (nodesVisited > maxNodes || Date.now() - startedAt > maxElapsedMs) {
        return false;
      }
      let bestCell = -1;
      let bestDigits: number[] | null = null;
      for (const cell of cells) {
        if (board[cell] !== 0) {
          continue;
        }
        const row = Math.floor(cell / 9);
        const col = cell % 9;
        const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
        const usedMask = rowMasks[row]! | colMasks[col]! | boxMasks[box]!;
        const digits: number[] = [];
        for (let digit = 1; digit <= 9; digit += 1) {
          if ((usedMask & (1 << (digit - 1))) === 0) {
            digits.push(digit);
          }
        }
        if (digits.length === 0) {
          return false;
        }
        if (!bestDigits || digits.length < bestDigits.length) {
          bestCell = cell;
          bestDigits = digits;
          if (digits.length === 1) {
            break;
          }
        }
      }
      if (bestCell < 0 || !bestDigits) {
        return true;
      }
      const row = Math.floor(bestCell / 9);
      const col = bestCell % 9;
      const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
      for (const digit of shuffleWithRandom(bestDigits, () => random.next())) {
        const bit = 1 << (digit - 1);
        board[bestCell] = digit;
        rowMasks[row] = (rowMasks[row] ?? 0) | bit;
        colMasks[col] = (colMasks[col] ?? 0) | bit;
        boxMasks[box] = (boxMasks[box] ?? 0) | bit;
        if (search()) {
          return true;
        }
        board[bestCell] = 0;
        rowMasks[row] = (rowMasks[row] ?? 0) & ~bit;
        colMasks[col] = (colMasks[col] ?? 0) & ~bit;
        boxMasks[box] = (boxMasks[box] ?? 0) & ~bit;
      }
      return false;
    };

    const solved = search();
    return {
      status: solved ? 'success' : 'timeout',
      ...(solved ? { solution: board } : {}),
      diagnostics: {
        source: 'random-backtracking',
        nodesVisited,
        elapsedMs: Date.now() - startedAt,
        ...(solved ? {} : { message: 'random backtracking solution generation exceeded its budget.' }),
      },
    };
  }
}

export function isCompleteValidSolution(board: Board): boolean {
  try {
    assertBoardValues(board, 'Solution');
  } catch {
    return false;
  }
  if (board.some((value) => value === 0)) {
    return false;
  }
  for (const house of ALL_HOUSES) {
    const seen = new Set<number>();
    for (const cell of getHouseCells(house)) {
      const value = board[cell] ?? 0;
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
    }
  }
  return true;
}
