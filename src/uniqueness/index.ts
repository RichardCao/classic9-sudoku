import { EMPTY_VALUE } from '../core/constants.js';
import { countMaskBits, digitsFromMask, removeDigit } from '../core/bitset.js';
import { ALL_HOUSES, CELL_TO_PEERS, cloneBoard, getHouseCells } from '../core/grid.js';
import type { Board, CandidateMask, Digit } from '../core/types.js';
import { normalizeState, type StateInput } from '../state/index.js';
import { validate } from '../validate/index.js';

export interface UniquenessCheckOptions {
  maxElapsedMs?: number;
}

export interface UniquenessResult {
  solutionCount: 0 | 1 | 2;
  firstSolution: Board | null;
  aborted: boolean;
  status: 'invalid' | 'no-solution' | 'unique' | 'multiple' | 'aborted';
  hasSolution: boolean;
  uniqueSolution: boolean;
  multipleSolutions: boolean;
  diagnostics: string[];
}

export function checkUniqueness(input: StateInput, options?: UniquenessCheckOptions): UniquenessResult {
  const validation = validate(input);
  if (!validation.legal) {
    return toResult(0, null, false, 'invalid', [
      ...validation.contradictions,
      ...validation.conflictIndexes.map((index) => `Conflict at cell ${index}`),
    ]);
  }

  const normalized = normalizeState(input);
  const board = cloneBoard(normalized.board);
  const candidates = [...normalized.candidates];
  let solutionCount: 0 | 1 | 2 = 0;
  let firstSolution: Board | null = null;
  let aborted = false;
  const startedAt = Date.now();

  if (hasContradiction(board, candidates)) {
    return toResult(0, null, false, 'no-solution', []);
  }

  const timedOut = (): boolean => {
    if (typeof options?.maxElapsedMs !== 'number' || options.maxElapsedMs <= 0) {
      return false;
    }
    if (Date.now() - startedAt < options.maxElapsedMs) {
      return false;
    }
    aborted = true;
    return true;
  };

  const search = (): void => {
    if (timedOut() || solutionCount >= 2) {
      return;
    }

    let bestIndex = -1;
    let bestMask = 0;
    let bestCount = 10;

    for (let index = 0; index < board.length; index += 1) {
      if (board[index] !== EMPTY_VALUE) {
        continue;
      }
      const mask = candidates[index] ?? 0;
      const count = countMaskBits(mask);
      if (count === 0) {
        return;
      }
      if (count < bestCount) {
        bestIndex = index;
        bestMask = mask;
        bestCount = count;
      }
    }

    if (bestIndex === -1) {
      solutionCount = Math.min(2, solutionCount + 1) as 0 | 1 | 2;
      firstSolution ??= cloneBoard(board);
      return;
    }

    const snapshotBoard = cloneBoard(board);
    const snapshotCandidates = [...candidates];
    for (const digit of digitsFromMask(bestMask)) {
      if (timedOut()) {
        return;
      }
      placeDigit(board, candidates, bestIndex, digit);
      search();
      if (solutionCount >= 2 || aborted) {
        return;
      }
      restore(board, candidates, snapshotBoard, snapshotCandidates);
    }
  };

  search();

  if (aborted) {
    return toResult(solutionCount, firstSolution, true, 'aborted', ['Uniqueness check aborted by time budget']);
  }
  return toResult(
    solutionCount,
    firstSolution,
    false,
    solutionCount === 0 ? 'no-solution' : solutionCount === 1 ? 'unique' : 'multiple',
    [],
  );
}

function restore(
  board: Board,
  candidates: CandidateMask[],
  snapshotBoard: Board,
  snapshotCandidates: CandidateMask[],
): void {
  for (let index = 0; index < board.length; index += 1) {
    board[index] = snapshotBoard[index] ?? EMPTY_VALUE;
    candidates[index] = snapshotCandidates[index] ?? 0;
  }
}

function placeDigit(board: Board, candidates: CandidateMask[], index: number, digit: Digit): void {
  board[index] = digit;
  candidates[index] = 0;
  for (const peer of CELL_TO_PEERS[index] ?? []) {
    if (board[peer] === EMPTY_VALUE) {
      candidates[peer] = removeDigit(candidates[peer] ?? 0, digit);
    }
  }
}

function hasContradiction(board: Board, candidates: CandidateMask[]): boolean {
  for (let index = 0; index < board.length; index += 1) {
    if (board[index] === EMPTY_VALUE && candidates[index] === 0) {
      return true;
    }
  }

  for (const house of ALL_HOUSES) {
    const cells = getHouseCells(house);
    for (let digit = 1; digit <= 9; digit += 1) {
      let solvedCount = 0;
      let candidateCount = 0;
      for (const cell of cells) {
        if (board[cell] === digit) {
          solvedCount += 1;
        } else if (board[cell] === EMPTY_VALUE && ((candidates[cell] ?? 0) & (1 << (digit - 1))) !== 0) {
          candidateCount += 1;
        }
      }
      if (solvedCount > 1 || (solvedCount === 0 && candidateCount === 0)) {
        return true;
      }
    }
  }
  return false;
}

function toResult(
  solutionCount: 0 | 1 | 2,
  firstSolution: Board | null,
  aborted: boolean,
  status: UniquenessResult['status'],
  diagnostics: string[],
): UniquenessResult {
  return {
    solutionCount,
    firstSolution,
    aborted,
    status,
    hasSolution: solutionCount > 0,
    uniqueSolution: solutionCount === 1,
    multipleSolutions: solutionCount === 2,
    diagnostics,
  };
}
