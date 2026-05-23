import { BLOCK_SIZE, BOARD_SIZE, CELL_COUNT, EMPTY_VALUE } from './constants.js';
import type { Board, Digit, HouseRef } from './types.js';

const rowHouses: number[][] = [];
const colHouses: number[][] = [];
const boxHouses: number[][] = [];
const allHouses: HouseRef[] = [];
const cellToRow: number[] = new Array(CELL_COUNT).fill(0);
const cellToCol: number[] = new Array(CELL_COUNT).fill(0);
const cellToBox: number[] = new Array(CELL_COUNT).fill(0);
const cellToPeers: number[][] = new Array(CELL_COUNT).fill(null).map(() => []);
const cellToPeerSet: Set<number>[] = new Array(CELL_COUNT).fill(null).map(() => new Set<number>());

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
  rowHouses.push(buildRowHouse(row));
  allHouses.push({ type: 'row', index: row });
}

for (let col = 0; col < BOARD_SIZE; col += 1) {
  colHouses.push(buildColHouse(col));
  allHouses.push({ type: 'col', index: col });
}

for (let box = 0; box < BOARD_SIZE; box += 1) {
  boxHouses.push(buildBoxHouse(box));
  allHouses.push({ type: 'box', index: box });
}

for (let index = 0; index < CELL_COUNT; index += 1) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const box = Math.floor(row / BLOCK_SIZE) * BLOCK_SIZE + Math.floor(col / BLOCK_SIZE);
  cellToRow[index] = row;
  cellToCol[index] = col;
  cellToBox[index] = box;

  const peerFlags = new Array<boolean>(CELL_COUNT).fill(false);
  const peers: number[] = [];
  for (const peer of [...rowHouses[row]!, ...colHouses[col]!, ...boxHouses[box]!]) {
    if (peer !== index && !peerFlags[peer]) {
      peerFlags[peer] = true;
      peers.push(peer);
      cellToPeerSet[index]!.add(peer);
    }
  }
  cellToPeers[index] = peers;
}

export const ROW_HOUSES: readonly (readonly number[])[] = Object.freeze(rowHouses.map((house) => Object.freeze([...house])));
export const COL_HOUSES: readonly (readonly number[])[] = Object.freeze(colHouses.map((house) => Object.freeze([...house])));
export const BOX_HOUSES: readonly (readonly number[])[] = Object.freeze(boxHouses.map((house) => Object.freeze([...house])));
export const ALL_HOUSES: readonly Readonly<HouseRef>[] = Object.freeze(allHouses.map((house) => Object.freeze({ ...house })));
export const CELL_TO_ROW: readonly number[] = Object.freeze([...cellToRow]);
export const CELL_TO_COL: readonly number[] = Object.freeze([...cellToCol]);
export const CELL_TO_BOX: readonly number[] = Object.freeze([...cellToBox]);
export const CELL_TO_PEERS: readonly (readonly number[])[] = Object.freeze(cellToPeers.map((peers) => Object.freeze([...peers])));
export const CELL_TO_PEER_SET: readonly ReadonlySet<number>[] = Object.freeze(cellToPeerSet.map((peers) => createReadonlySetView(peers)));

function createReadonlySetView<T>(source: ReadonlySet<T>): ReadonlySet<T> {
  return Object.freeze({
    get size(): number {
      return source.size;
    },
    has(value: T): boolean {
      return source.has(value);
    },
    forEach(callbackfn: (value: T, value2: T, set: ReadonlySet<T>) => void, thisArg?: unknown): void {
      for (const value of source) {
        callbackfn.call(thisArg, value, value, this);
      }
    },
    entries(): SetIterator<[T, T]> {
      return source.entries();
    },
    keys(): SetIterator<T> {
      return source.keys();
    },
    values(): SetIterator<T> {
      return source.values();
    },
    [Symbol.iterator](): SetIterator<T> {
      return source[Symbol.iterator]();
    },
  });
}

export function cloneBoard(board: Board): Board {
  return [...board];
}

export function assertBoardShape(board: readonly number[], label = 'Board'): void {
  if (board.length !== CELL_COUNT) {
    throw new Error(`${label} must contain ${CELL_COUNT} cells`);
  }
}

export function assertBoardValues(board: readonly number[], label = 'Board'): void {
  assertBoardShape(board, label);
  for (let index = 0; index < board.length; index += 1) {
    const value = board[index] ?? Number.NaN;
    if (!Number.isInteger(value) || value < 0 || value > 9) {
      throw new Error(`${label} contains invalid value at ${index}: ${value}`);
    }
  }
}

export function createEmptyBoard(): Board {
  return new Array(CELL_COUNT).fill(EMPTY_VALUE);
}

export function getHouseCells(house: HouseRef): number[] {
  if (house.index < 0 || house.index >= BOARD_SIZE) {
    return [];
  }
  if (house.type === 'row') {
    return [...(ROW_HOUSES[house.index] ?? [])];
  }
  if (house.type === 'col') {
    return [...(COL_HOUSES[house.index] ?? [])];
  }
  if (house.type === 'box') {
    return [...(BOX_HOUSES[house.index] ?? [])];
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
