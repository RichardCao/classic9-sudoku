import { EMPTY_VALUE } from '../core/constants.js';
import { digitsFromMask, removeDigit } from '../core/bitset.js';
import {
  ALL_HOUSES,
  CELL_TO_BOX,
  CELL_TO_COL,
  CELL_TO_PEERS,
  CELL_TO_ROW,
  cloneBoard,
  getHouseCells,
  isBoardFilled,
} from '../core/grid.js';
import type { Board, CandidateMask, Digit, HouseRef } from '../core/types.js';
import { normalizeState, type NormalizedState, type StateInput } from '../state/index.js';
import type { SolveStep, SolverContextLike } from './types.js';

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
    return isBoardFilled(this.board);
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
    return ALL_HOUSES;
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
    for (const action of step.actions) {
      if (action.type === 'eliminate') {
        this.removeCandidate(action.cell, action.digit);
      } else {
        this.placeDigit(action.cell, action.digit);
      }
    }
  }

  public placeDigit(cell: number, digit: Digit): void {
    this.board[cell] = digit;
    this.candidates[cell] = 0;
    for (const peer of CELL_TO_PEERS[cell] ?? []) {
      if (this.board[peer] === EMPTY_VALUE) {
        this.candidates[peer] = removeDigit(this.candidates[peer] ?? 0, digit);
      }
    }
  }

  public removeCandidate(cell: number, digit: Digit): boolean {
    if (this.board[cell] !== EMPTY_VALUE) {
      return false;
    }
    const before = this.candidates[cell] ?? 0;
    const after = removeDigit(before, digit);
    this.candidates[cell] = after;
    return before !== after;
  }
}

function isNormalizedState(input: StateInput | NormalizedState): input is NormalizedState {
  return typeof input === 'object'
    && input !== null
    && 'candidates' in input
    && 'contradictions' in input
    && 'warnings' in input;
}
