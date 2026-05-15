import { CELL_TO_BOX, CELL_TO_COL, CELL_TO_ROW } from '../core/grid.js';
import type { Digit, HouseRef } from '../core/types.js';
import type { SolverContextLike } from './types.js';

export interface GroupedNodeSeed {
  box: number;
  cells: number[];
  digit: Digit;
  lineIndex: number;
  lineType: 'row' | 'col';
}

function buildCombinations(values: readonly number[], size: number): number[][] {
  const result: number[][] = [];
  const path: number[] = [];

  const visit = (start: number): void => {
    if (path.length === size) {
      result.push([...path]);
      return;
    }
    for (let index = start; index < values.length; index += 1) {
      path.push(values[index]!);
      visit(index + 1);
      path.pop();
    }
  };

  visit(0);
  return result;
}

export function collectGroupedNodeSeeds(
  context: SolverContextLike,
  digit: Digit,
): GroupedNodeSeed[] {
  const result: GroupedNodeSeed[] = [];
  const seen = new Set<string>();

  const pushAlignedSubgroups = (
    cells: number[],
    lineType: 'row' | 'col',
    box: number,
    lineIndex: number,
  ): void => {
    const sortedCells = [...cells].sort((left, right) => left - right);
    const maxSize = Math.min(3, sortedCells.length);
    for (let size = 2; size <= maxSize; size += 1) {
      for (const subset of buildCombinations(sortedCells, size)) {
        const key = `${digit}:${box}:${lineType}:${lineIndex}:${subset.join('-')}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        result.push({
          box,
          cells: subset,
          digit,
          lineIndex,
          lineType,
        });
      }
    }
  };

  for (let box = 0; box < 9; box += 1) {
    const boxCells = context.getHouseCandidateCells({ type: 'box', index: box }, digit);
    for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
      const row = Math.floor(box / 3) * 3 + rowOffset;
      pushAlignedSubgroups(
        boxCells.filter((cell) => CELL_TO_ROW[cell] === row),
        'row',
        box,
        row,
      );
    }
    for (let colOffset = 0; colOffset < 3; colOffset += 1) {
      const col = (box % 3) * 3 + colOffset;
      pushAlignedSubgroups(
        boxCells.filter((cell) => CELL_TO_COL[cell] === col),
        'col',
        box,
        col,
      );
    }
  }

  return result;
}

export function nodeCellsFitHouse(cells: readonly number[], house: HouseRef): boolean {
  return cells.every((cell) => {
    if (house.type === 'row') {
      return CELL_TO_ROW[cell] === house.index;
    }
    if (house.type === 'col') {
      return CELL_TO_COL[cell] === house.index;
    }
    return CELL_TO_BOX[cell] === house.index;
  });
}

export function candidateRef(cell: number, digit: Digit): string {
  return `${cell}:${digit}`;
}
