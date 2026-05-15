import { BLOCK_SIZE, BOARD_SIZE, CELL_COUNT, EMPTY_VALUE } from './constants.js';
import type { Board, Digit, HouseRef } from './types.js';

export const ROW_HOUSES: number[][] = [];
export const COL_HOUSES: number[][] = [];
export const BOX_HOUSES: number[][] = [];
export const ALL_HOUSES: HouseRef[] = [];
export const CELL_TO_ROW: number[] = new Array(CELL_COUNT).fill(0);
export const CELL_TO_COL: number[] = new Array(CELL_COUNT).fill(0);
export const CELL_TO_BOX: number[] = new Array(CELL_COUNT).fill(0);
export const CELL_TO_PEERS: number[][] = new Array(CELL_COUNT).fill(null).map(() => []);

export function toIndex(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

export function isCellIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < CELL_COUNT;
}

function buildRowHouse(row: number): number[] {
  return Array.from({ length: BOARD_SIZE }, (_, col) => toIndex(row, col));
}

function buildColHouse(col: number): number[] {
  return Array.from({ length: BOARD_SIZE }, (_, row) => toIndex(row, col));
}

function buildBoxHouse(box: number): number[] {
  const startRow = Math.floor(box / BLOCK_SIZE) * BLOCK_SIZE;
  const startCol = (box % BLOCK_SIZE) * BLOCK_SIZE;
  const cells: number[] = [];
  for (let row = startRow; row < startRow + BLOCK_SIZE; row += 1) {
    for (let col = startCol; col < startCol + BLOCK_SIZE; col += 1) {
      cells.push(toIndex(row, col));
    }
  }
  return cells;
}

for (let row = 0; row < BOARD_SIZE; row += 1) {
  ROW_HOUSES.push(buildRowHouse(row));
  ALL_HOUSES.push({ type: 'row', index: row });
}

for (let col = 0; col < BOARD_SIZE; col += 1) {
  COL_HOUSES.push(buildColHouse(col));
  ALL_HOUSES.push({ type: 'col', index: col });
}

for (let box = 0; box < BOARD_SIZE; box += 1) {
  BOX_HOUSES.push(buildBoxHouse(box));
  ALL_HOUSES.push({ type: 'box', index: box });
}

for (let index = 0; index < CELL_COUNT; index += 1) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const box = Math.floor(row / BLOCK_SIZE) * BLOCK_SIZE + Math.floor(col / BLOCK_SIZE);
  CELL_TO_ROW[index] = row;
  CELL_TO_COL[index] = col;
  CELL_TO_BOX[index] = box;

  const peerFlags = new Array<boolean>(CELL_COUNT).fill(false);
  const peers: number[] = [];
  for (const peer of [...ROW_HOUSES[row]!, ...COL_HOUSES[col]!, ...BOX_HOUSES[box]!]) {
    if (peer !== index && !peerFlags[peer]) {
      peerFlags[peer] = true;
      peers.push(peer);
    }
  }
  CELL_TO_PEERS[index] = peers;
}

export function cloneBoard(board: Board): Board {
  return [...board];
}

export function createEmptyBoard(): Board {
  return new Array(CELL_COUNT).fill(EMPTY_VALUE);
}

export function getHouseCells(house: HouseRef): number[] {
  if (house.index < 0 || house.index >= BOARD_SIZE) {
    return [];
  }
  if (house.type === 'row') {
    return ROW_HOUSES[house.index] ?? [];
  }
  if (house.type === 'col') {
    return COL_HOUSES[house.index] ?? [];
  }
  if (house.type === 'box') {
    return BOX_HOUSES[house.index] ?? [];
  }
  return [];
}

export function isBoardFilled(board: Board): boolean {
  return board.length === CELL_COUNT && board.every((value) => value !== EMPTY_VALUE);
}

export function getMissingDigitForHouse(board: Board, cells: readonly number[]): Digit | null {
  let seenMask = 0;
  let emptyCount = 0;
  for (const index of cells) {
    const value = board[index] ?? EMPTY_VALUE;
    if (value === EMPTY_VALUE) {
      emptyCount += 1;
    } else {
      seenMask |= 1 << (value - 1);
    }
  }
  if (emptyCount !== 1) {
    return null;
  }
  for (let digit = 1; digit <= 9; digit += 1) {
    if ((seenMask & (1 << (digit - 1))) === 0) {
      return digit as Digit;
    }
  }
  return null;
}
