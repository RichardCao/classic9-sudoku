import { CELL_COUNT, EMPTY_VALUE } from '../core/constants.js';
import { ALL_DIGITS_MASK, isDigit, maskFromDigits, removeDigit } from '../core/bitset.js';
import { CELL_TO_PEERS, isCellIndex } from '../core/grid.js';
import type { Board, CandidateMask, Digit } from '../core/types.js';
import { parsePuzzle, type PuzzleInput } from '../parser/index.js';

export interface CandidateList {
  cell: number;
  digits: number[];
}

export interface CandidateConstraints {
  forbidden?: CandidateList[];
  exactCandidates?: CandidateList[];
  exactCandidatesMode?: 'legal' | 'trusted';
  pencilMarks?: CandidateList[];
}

export interface Assumption {
  cell: number;
  digit: Digit;
  reason?: string;
}

export interface PuzzleState {
  board: Board;
  candidateMasks?: CandidateMask[];
  givens?: number[];
  constraints?: CandidateConstraints;
  assumptions?: Assumption[];
  metadata?: Record<string, unknown>;
}

export type StateInput = PuzzleInput | PuzzleState;

export interface StateContradiction {
  type:
    | 'invalid-board-length'
    | 'invalid-board-value'
    | 'duplicate-given'
    | 'empty-cell-without-candidate'
    | 'missing-house-candidate'
    | 'invalid-constraint';
  cell?: number;
  message: string;
}

export interface StateWarning {
  type:
    | 'constraint-on-filled-cell'
    | 'pencilmarks-ignored'
    | 'duplicate-given-index';
  cell?: number;
  message: string;
}

export interface NormalizedState {
  board: Board;
  candidates: CandidateMask[];
  givens: boolean[];
  contradictions: StateContradiction[];
  warnings: StateWarning[];
}

export function normalizeState(input: StateInput): NormalizedState {
  const state = toPuzzleState(input);
  const board = [...state.board];
  const contradictions: StateContradiction[] = [];
  const warnings: StateWarning[] = [];
  const givens = normalizeGivens(state, warnings);

  validateBoardShape(board, contradictions);
  const candidates = state.candidateMasks
    ? normalizeCandidateMasks(board, state.candidateMasks, contradictions, warnings)
    : computeCandidates(board);

  applyExactCandidates(board, candidates, state.constraints?.exactCandidates, state.constraints?.exactCandidatesMode, contradictions, warnings);
  applyForbiddenCandidates(board, candidates, state.constraints?.forbidden, contradictions, warnings);
  notePencilMarks(state.constraints?.pencilMarks, warnings);
  collectCandidateContradictions(board, candidates, contradictions);

  return {
    board,
    candidates,
    givens,
    contradictions,
    warnings,
  };
}

function normalizeCandidateMasks(
  board: Board,
  candidateMasks: CandidateMask[],
  contradictions: StateContradiction[],
  warnings: StateWarning[],
): CandidateMask[] {
  const candidates = new Array<CandidateMask>(CELL_COUNT).fill(0);
  if (candidateMasks.length !== CELL_COUNT) {
    contradictions.push({
      type: 'invalid-constraint',
      message: `candidateMasks must contain ${CELL_COUNT} masks, got ${candidateMasks.length}`,
    });
    return computeCandidates(board);
  }
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const value = candidateMasks[index] ?? 0;
    if (!Number.isInteger(value) || value < 0 || value > ALL_DIGITS_MASK) {
      contradictions.push({
        type: 'invalid-constraint',
        cell: index,
        message: `Invalid candidate mask at ${index}: ${value}`,
      });
      candidates[index] = 0;
      continue;
    }
    if (board[index] !== EMPTY_VALUE && value !== 0) {
      warnings.push({
        type: 'constraint-on-filled-cell',
        cell: index,
        message: `Ignoring candidate mask on filled cell ${index}`,
      });
      candidates[index] = 0;
      continue;
    }
    candidates[index] = value;
  }
  return candidates;
}

function toPuzzleState(input: StateInput): PuzzleState {
  if (typeof input === 'string' || Array.isArray(input)) {
    return { board: parsePuzzle(input) };
  }
  return input as PuzzleState;
}

function validateBoardShape(board: Board, contradictions: StateContradiction[]): void {
  if (board.length !== CELL_COUNT) {
    contradictions.push({
      type: 'invalid-board-length',
      message: `Board must contain ${CELL_COUNT} cells, got ${board.length}`,
    });
    return;
  }
  for (let index = 0; index < board.length; index += 1) {
    const value = board[index] ?? EMPTY_VALUE;
    if (!Number.isInteger(value) || value < 0 || value > 9) {
      contradictions.push({
        type: 'invalid-board-value',
        cell: index,
        message: `Invalid board value at ${index}: ${value}`,
      });
    }
  }
}

function normalizeGivens(state: PuzzleState, warnings: StateWarning[]): boolean[] {
  const givens = new Array<boolean>(CELL_COUNT).fill(false);
  if (!state.givens) {
  for (let index = 0; index < Math.min(state.board.length, CELL_COUNT); index += 1) {
      givens[index] = (state.board[index] ?? EMPTY_VALUE) !== EMPTY_VALUE;
    }
    return givens;
  }

  for (const index of state.givens) {
    if (!isCellIndex(index)) {
      warnings.push({
        type: 'duplicate-given-index',
        message: `Ignoring invalid given index: ${index}`,
      });
      continue;
    }
    if (givens[index]) {
      warnings.push({
        type: 'duplicate-given-index',
        cell: index,
        message: `Duplicate given index: ${index}`,
      });
    }
    givens[index] = true;
  }
  return givens;
}

export function computeCandidates(board: Board): CandidateMask[] {
  const candidates = new Array<CandidateMask>(CELL_COUNT).fill(0);
  for (let index = 0; index < Math.min(board.length, CELL_COUNT); index += 1) {
    if (board[index] !== EMPTY_VALUE) {
      candidates[index] = 0;
      continue;
    }
    let mask = ALL_DIGITS_MASK;
    for (const peer of CELL_TO_PEERS[index] ?? []) {
      const value = board[peer];
      if (isDigit(value ?? 0)) {
        mask = removeDigit(mask, value as Digit);
      }
    }
    candidates[index] = mask;
  }
  return candidates;
}

function applyExactCandidates(
  board: Board,
  candidates: CandidateMask[],
  exactCandidates: CandidateList[] | undefined,
  mode: 'legal' | 'trusted' | undefined,
  contradictions: StateContradiction[],
  warnings: StateWarning[],
): void {
  const trusted = mode === 'trusted';
  for (const item of exactCandidates ?? []) {
    if (!isValidCandidateList(item, contradictions)) {
      continue;
    }
    if (board[item.cell] !== EMPTY_VALUE) {
      warnings.push({
        type: 'constraint-on-filled-cell',
        cell: item.cell,
        message: `Ignoring exact candidates on filled cell ${item.cell}`,
      });
      continue;
    }
    const exactMask = maskFromDigits(item.digits);
    const legalMask = candidates[item.cell] ?? 0;
    const illegalMask = exactMask & ~legalMask;
    if (!trusted && illegalMask !== 0) {
      contradictions.push({
        type: 'invalid-constraint',
        cell: item.cell,
        message: `Exact candidates for cell ${item.cell} include illegal digits`,
      });
      continue;
    }
    candidates[item.cell] = exactMask;
  }
}

function applyForbiddenCandidates(
  board: Board,
  candidates: CandidateMask[],
  forbidden: CandidateList[] | undefined,
  contradictions: StateContradiction[],
  warnings: StateWarning[],
): void {
  for (const item of forbidden ?? []) {
    if (!isValidCandidateList(item, contradictions)) {
      continue;
    }
    if (board[item.cell] !== EMPTY_VALUE) {
      warnings.push({
        type: 'constraint-on-filled-cell',
        cell: item.cell,
        message: `Ignoring forbidden candidates on filled cell ${item.cell}`,
      });
      continue;
    }
    let mask = candidates[item.cell] ?? 0;
    for (const digit of item.digits) {
      mask = removeDigit(mask, digit as Digit);
    }
    candidates[item.cell] = mask;
  }
}

function notePencilMarks(pencilMarks: CandidateList[] | undefined, warnings: StateWarning[]): void {
  if (!pencilMarks || pencilMarks.length === 0) {
    return;
  }
  warnings.push({
    type: 'pencilmarks-ignored',
    message: 'pencilMarks are preserved as input metadata but do not affect solving by default',
  });
}

function isValidCandidateList(item: CandidateList, contradictions: StateContradiction[]): boolean {
  if (!isCellIndex(item.cell)) {
    contradictions.push({
      type: 'invalid-constraint',
      message: `Invalid constraint cell: ${item.cell}`,
    });
    return false;
  }
  for (const digit of item.digits) {
    if (!isDigit(digit)) {
      contradictions.push({
        type: 'invalid-constraint',
        cell: item.cell,
        message: `Invalid constraint digit for cell ${item.cell}: ${digit}`,
      });
      return false;
    }
  }
  return true;
}

function collectCandidateContradictions(
  board: Board,
  candidates: CandidateMask[],
  contradictions: StateContradiction[],
): void {
  for (let index = 0; index < Math.min(board.length, CELL_COUNT); index += 1) {
    if (board[index] === EMPTY_VALUE && candidates[index] === 0) {
      contradictions.push({
        type: 'empty-cell-without-candidate',
        cell: index,
        message: `Empty cell ${index} has no candidates`,
      });
    }
  }
}
