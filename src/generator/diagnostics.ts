import { EMPTY_VALUE } from '../core/constants.js';
import { ALL_HOUSES, getHouseCells } from '../core/grid.js';
import type { Board } from '../core/types.js';
import { computeCandidates } from '../state/index.js';
import { walkthrough } from '../solver/index.js';

export interface GeneratorCandidateFeatures {
  clueCount: number;
  emptyCells: number;
  givens: {
    rows: number[];
    cols: number[];
    boxes: number[];
    min: number;
    max: number;
    average: number;
    entropy: number;
    imbalance: number;
  };
  candidates: {
    total: number;
    min: number;
    max: number;
    average: number;
    bivalueCells: number;
    trivalueCells: number;
    zeroCandidateCells: number;
  };
  singlesOnly: {
    solved: boolean;
    steps: number;
    score: number;
    placements: number;
    remainingEmptyCells: number;
    stuckReason: string | null;
  };
}

export function extractGeneratorCandidateFeatures(board: Board): GeneratorCandidateFeatures {
  const clueCount = board.filter((value) => value !== EMPTY_VALUE).length;
  const candidates = computeCandidates(board);
  const emptyCells = board.length - clueCount;
  const candidateCounts = candidates.map(popcount);
  const emptyCandidateCounts = candidateCounts.filter((_, index) => board[index] === EMPTY_VALUE);
  const houseClues = summarizeHouseClues(board);
  const singlesOnly = runSinglesOnly(board);
  return {
    clueCount,
    emptyCells,
    givens: {
      rows: houseClues.rows,
      cols: houseClues.cols,
      boxes: houseClues.boxes,
      min: Math.min(...houseClues.all),
      max: Math.max(...houseClues.all),
      average: round(average(houseClues.all), 3),
      entropy: round(entropy(houseClues.all), 3),
      imbalance: Math.max(...houseClues.all) - Math.min(...houseClues.all),
    },
    candidates: {
      total: emptyCandidateCounts.reduce((sum, count) => sum + count, 0),
      min: emptyCandidateCounts.length > 0 ? Math.min(...emptyCandidateCounts) : 0,
      max: emptyCandidateCounts.length > 0 ? Math.max(...emptyCandidateCounts) : 0,
      average: emptyCandidateCounts.length > 0 ? round(average(emptyCandidateCounts), 3) : 0,
      bivalueCells: emptyCandidateCounts.filter((count) => count === 2).length,
      trivalueCells: emptyCandidateCounts.filter((count) => count === 3).length,
      zeroCandidateCells: emptyCandidateCounts.filter((count) => count === 0).length,
    },
    singlesOnly,
  };
}

function summarizeHouseClues(board: Board): { rows: number[]; cols: number[]; boxes: number[]; all: number[] } {
  const rows: number[] = [];
  const cols: number[] = [];
  const boxes: number[] = [];
  for (const house of ALL_HOUSES) {
    const count = getHouseCells(house).filter((cell) => board[cell] !== EMPTY_VALUE).length;
    if (house.type === 'row') {
      rows.push(count);
    } else if (house.type === 'col') {
      cols.push(count);
    } else {
      boxes.push(count);
    }
  }
  return {
    rows,
    cols,
    boxes,
    all: [...rows, ...cols, ...boxes],
  };
}

function runSinglesOnly(board: Board): GeneratorCandidateFeatures['singlesOnly'] {
  const analysis = walkthrough(board, {
    allowedTechniques: ['full-house', 'naked-single', 'hidden-single'],
    maxSteps: 200,
  });
  const initialEmptyCells = board.filter((value) => value === EMPTY_VALUE).length;
  const placements = analysis.steps.reduce((count, step) => {
    return count + step.actions.filter((action) => action.type === 'place').length;
  }, 0);
  return {
    solved: analysis.solved,
    steps: analysis.steps.length,
    score: analysis.score,
    placements,
    remainingEmptyCells: Math.max(0, initialEmptyCells - placements),
    stuckReason: analysis.stuckReason ?? null,
  };
}

function popcount(mask: number): number {
  let value = mask;
  let count = 0;
  while (value > 0) {
    count += value & 1;
    value >>>= 1;
  }
  return count;
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function entropy(values: readonly number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return 0;
  }
  return -values.reduce((sum, value) => {
    if (value <= 0) {
      return sum;
    }
    const probability = value / total;
    return sum + probability * Math.log2(probability);
  }, 0);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
