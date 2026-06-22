import { BOARD_SIZE, CELL_COUNT, EMPTY_VALUE } from '../core/constants.js';
import { assertBoardValues } from '../core/grid.js';
import type { Board } from '../core/types.js';

export type BoardMatrix = readonly (readonly number[])[];
export type NullableBoard = readonly (number | null)[];

export function fromMatrix(matrix: BoardMatrix): Board {
  if (!Array.isArray(matrix) || matrix.length !== BOARD_SIZE) {
    throw new Error(`matrix must contain ${BOARD_SIZE} rows`);
  }
  const board: Board = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const values = matrix[row];
    if (!Array.isArray(values) || values.length !== BOARD_SIZE) {
      throw new Error(`matrix row ${row} must contain ${BOARD_SIZE} cells`);
    }
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      board.push(normalizeCellValue(values[col], `matrix[${row}][${col}]`));
    }
  }
  return board;
}

export function toMatrix(board: Board): number[][] {
  assertBoardValues(board);
  return Array.from({ length: BOARD_SIZE }, (_, row) =>
    board.slice(row * BOARD_SIZE, row * BOARD_SIZE + BOARD_SIZE));
}

export function fromNullableBoard(cells: NullableBoard): Board {
  if (!Array.isArray(cells) || cells.length !== CELL_COUNT) {
    throw new Error(`nullable board must contain ${CELL_COUNT} cells`);
  }
  return cells.map((value, index) => (
    value === null ? EMPTY_VALUE : normalizeCellValue(value, `cells[${index}]`)
  ));
}

export function toNullableBoard(board: Board): Array<number | null> {
  assertBoardValues(board);
  return board.map((value) => value === EMPTY_VALUE ? null : value);
}

function normalizeCellValue(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 9) {
    throw new Error(`${label} must be an integer 0..9`);
  }
  return value as number;
}
