import { EMPTY_VALUE } from '../core/constants.js';
import { digitsFromMask, isDigit, removeDigit } from '../core/bitset.js';
import {
  ALL_HOUSES,
  CELL_TO_BOX,
  CELL_TO_COL,
  CELL_TO_PEERS,
  CELL_TO_ROW,
  cloneBoard,
  getHouseCells,
  isBoardFilled,
  isCellIndex,
} from '../core/grid.js';
import type { Board, CandidateMask, Digit, HouseRef } from '../core/types.js';
import { normalizeState, type NormalizedState, type StateInput } from '../state/index.js';
import type { SolveStep, SolverContextLike, StepAction } from './types.js';

export class SolverContext implements SolverContextLike {
  public readonly board: Board;
  public readonly candidates: CandidateMask[];

  public constructor(input: StateInput | NormalizedState) {
    const normalized = isNormalizedState(input) ? input : normalizeState(input);
    this.board = cloneBoard(normalized.board);
    this.candidates = [...normalized.candidates];
  }

  public clone(): SolverContext {
    return new SolverContext({
      board: cloneBoard(this.board),
      candidates: [...this.candidates],
      givens: new Array<boolean>(this.board.length).fill(false),
      contradictions: [],
      warnings: [],
    });
  }

  public isSolved(): boolean {
    return isBoardFilled(this.board) && !this.hasContradiction();
  }

  public hasContradiction(): boolean {
    for (let index = 0; index < this.board.length; index += 1) {
      if (this.board[index] === EMPTY_VALUE && this.candidates[index] === 0) {
        return true;
      }
    }

    for (const house of ALL_HOUSES) {
      const cells = getHouseCells(house);
      for (let digit = 1; digit <= 9; digit += 1) {
        let solvedCount = 0;
        let candidateCount = 0;
        for (const cell of cells) {
          if (this.board[cell] === digit) {
            solvedCount += 1;
          } else if (this.board[cell] === EMPTY_VALUE && ((this.candidates[cell] ?? 0) & (1 << (digit - 1))) !== 0) {
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

  public getCandidateMask(cell: number): CandidateMask {
    return this.candidates[cell] ?? 0;
  }

  public getCandidateDigits(cell: number): Digit[] {
    return digitsFromMask(this.getCandidateMask(cell));
  }

  public getHouseCells(house: HouseRef): number[] {
    return getHouseCells(house);
  }

  public getAllHouses(): HouseRef[] {
    return ALL_HOUSES.map((house) => ({ ...house }));
  }

  public getCellHouses(cell: number): HouseRef[] {
    return [
      { type: 'row', index: this.getCellRow(cell) },
      { type: 'col', index: this.getCellCol(cell) },
      { type: 'box', index: this.getCellBox(cell) },
    ];
  }

  public getHouseCandidateCells(house: HouseRef, digit: Digit): number[] {
    return getHouseCells(house).filter((cell) => (
      this.board[cell] === EMPTY_VALUE
      && this.isCandidatePresent(cell, digit)
    ));
  }

  public getCandidateCount(cell: number): number {
    return this.getCandidateDigits(cell).length;
  }

  public isCandidatePresent(cell: number, digit: Digit): boolean {
    return ((this.candidates[cell] ?? 0) & (1 << (digit - 1))) !== 0;
  }

  public getCellRow(cell: number): number {
    return CELL_TO_ROW[cell] ?? -1;
  }

  public getCellCol(cell: number): number {
    return CELL_TO_COL[cell] ?? -1;
  }

  public getCellBox(cell: number): number {
    return CELL_TO_BOX[cell] ?? -1;
  }

  public applyStep(step: SolveStep): void {
    const draft = this.clone();
    for (const action of step.actions) {
      assertApplicableStepAction(draft, action);
      applyValidatedStepAction(draft, action);
    }
    this.board.splice(0, this.board.length, ...draft.board);
    this.candidates.splice(0, this.candidates.length, ...draft.candidates);
  }

  public placeDigit(cell: number, digit: Digit, options?: { allowConflict?: boolean }): void {
    assertValidCellDigit(cell, digit);
    if (this.board[cell] !== EMPTY_VALUE) {
      throw new Error(`不能在已填格 ${cell} 放置数字。`);
    }
    if (!options?.allowConflict && this.hasPeerValue(cell, digit)) {
      throw new Error(`不能在格 ${cell} 放置与同行、同列或同宫冲突的数字 ${digit}。`);
    }
    this.board[cell] = digit;
    this.candidates[cell] = 0;
    for (const peer of CELL_TO_PEERS[cell] ?? []) {
      if (this.board[peer] === EMPTY_VALUE) {
        this.candidates[peer] = removeDigit(this.candidates[peer] ?? 0, digit);
      }
    }
  }

  public removeCandidate(cell: number, digit: Digit): boolean {
    assertValidCellDigit(cell, digit);
    if (this.board[cell] !== EMPTY_VALUE) {
      return false;
    }
    const before = this.candidates[cell] ?? 0;
    const after = removeDigit(before, digit);
    this.candidates[cell] = after;
    return before !== after;
  }

  public hasPeerValue(cell: number, digit: Digit): boolean {
    return (CELL_TO_PEERS[cell] ?? []).some((peer) => this.board[peer] === digit);
  }
}

export function applyStepAction(context: SolverContext, action: StepAction): void {
  assertApplicableStepAction(context, action);
  applyValidatedStepAction(context, action);
}

function applyValidatedStepAction(context: SolverContext, action: StepAction): void {
  switch (action.type) {
    case 'place':
      placeDigitUnchecked(context, action.cell, action.digit);
      return;
    case 'eliminate':
      removeCandidateUnchecked(context, action.cell, action.digit);
      return;
    default:
      throw new Error(`未知动作类型：${String((action as { type?: unknown }).type)}`);
  }
}

function placeDigitUnchecked(context: SolverContext, cell: number, digit: Digit): void {
  context.board[cell] = digit;
  context.candidates[cell] = 0;
  for (const peer of CELL_TO_PEERS[cell] ?? []) {
    if (context.board[peer] === EMPTY_VALUE) {
      context.candidates[peer] = removeDigit(context.candidates[peer] ?? 0, digit);
    }
  }
}

function removeCandidateUnchecked(context: SolverContext, cell: number, digit: Digit): void {
  context.candidates[cell] = removeDigit(context.candidates[cell] ?? 0, digit);
}

function assertApplicableStepAction(context: SolverContext, action: StepAction): void {
  assertKnownStepAction(action);
  assertValidCellDigit(action.cell, action.digit);
  if (action.type === 'place') {
    if (context.board[action.cell] !== EMPTY_VALUE) {
      throw new Error(`place 动作不能覆盖已填格：${action.cell}`);
    }
    if (!context.isCandidatePresent(action.cell, action.digit)) {
      throw new Error(`place 动作的数字不是候选：cell=${action.cell}, digit=${action.digit}`);
    }
    if (context.hasPeerValue(action.cell, action.digit)) {
      throw new Error(`place 动作会造成同行、同列或同宫冲突：cell=${action.cell}, digit=${action.digit}`);
    }
    return;
  }
  if (context.board[action.cell] !== EMPTY_VALUE) {
    throw new Error(`eliminate 动作不能作用于已填格：${action.cell}`);
  }
  if (!context.isCandidatePresent(action.cell, action.digit)) {
    throw new Error(`eliminate 动作的数字不是候选：cell=${action.cell}, digit=${action.digit}`);
  }
}

function assertKnownStepAction(action: StepAction): asserts action is StepAction {
  if (typeof action !== 'object' || action === null) {
    throw new Error('动作必须是 object。');
  }
  const actionType = (action as { type?: unknown }).type;
  if (actionType !== 'place' && actionType !== 'eliminate') {
    throw new Error(`未知动作类型：${String(actionType)}`);
  }
}

function assertValidCellDigit(cell: number, digit: number): asserts digit is Digit {
  if (!isCellIndex(cell)) {
    throw new Error(`无效格子索引：${cell}`);
  }
  if (!isDigit(digit)) {
    throw new Error(`无效数字：${digit}`);
  }
}

function isNormalizedState(input: StateInput | NormalizedState): input is NormalizedState {
  return typeof input === 'object'
    && input !== null
    && 'candidates' in input
    && 'contradictions' in input
    && 'warnings' in input;
}
