import { BLOCK_SIZE, BOARD_SIZE, CELL_COUNT } from '../core/constants.js';
import { digitsFromMask, maskForDigit } from '../core/bitset.js';
import { ALL_HOUSES, assertBoardValues, getHouseCells } from '../core/grid.js';
import type { Board, Digit } from '../core/types.js';
import type { PuzzleState, CandidateConstraints, CandidateList, Assumption } from '../state/index.js';
import type { SolveStep, StepAction, StepBranchEvidence, StepCellEvidence, StepLinkEvidence } from '../solver/types.js';

export interface CanonicalTransform {
  transposed: boolean;
  rowOrder: number[];
  colOrder: number[];
  digitMap: number[];
}

export interface CanonicalResult {
  algorithm: 'canonical.classic9';
  version: '1';
  key: string;
  board: Board;
  transform: CanonicalTransform;
}

export interface CanonicalPairResult extends CanonicalResult {
  solution: Board;
}

export function validateCanonicalTransform(transform: CanonicalTransform): void {
  if (typeof transform !== 'object' || transform === null || Array.isArray(transform)) {
    throw new Error('canonical transform must be an object');
  }
  if (typeof transform.transposed !== 'boolean') {
    throw new Error('canonical transform transposed must be boolean');
  }
  validatePermutation(transform.rowOrder, 9, 'canonical transform rowOrder');
  validatePermutation(transform.colOrder, 9, 'canonical transform colOrder');
  validateDigitMap(transform.digitMap);
}

function transpose(board: Board): Board {
  const result = new Array<number>(CELL_COUNT).fill(0);
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      result[col * BOARD_SIZE + row] = board[row * BOARD_SIZE + col] ?? 0;
    }
  }
  return result;
}

function getPermutations(values: number[]): number[][] {
  if (values.length <= 1) {
    return [values];
  }
  const result: number[][] = [];
  for (let index = 0; index < values.length; index += 1) {
    const head = values[index]!;
    const tail = values.filter((_, tailIndex) => tailIndex !== index);
    for (const permutation of getPermutations(tail)) {
      result.push([head, ...permutation]);
    }
  }
  return result;
}

function buildHouseOrders(): number[][] {
  const blockPermutations = getPermutations([0, 1, 2]);
  const innerPermutations = getPermutations([0, 1, 2]);
  const result: number[][] = [];

  for (const blockOrder of blockPermutations) {
    for (const firstInner of innerPermutations) {
      for (const secondInner of innerPermutations) {
        for (const thirdInner of innerPermutations) {
          const innerOrders = [firstInner, secondInner, thirdInner];
          const order: number[] = [];
          for (let targetBlock = 0; targetBlock < BLOCK_SIZE; targetBlock += 1) {
            const sourceBlock = blockOrder[targetBlock]!;
            for (const offset of innerOrders[targetBlock]!) {
              order.push(sourceBlock * BLOCK_SIZE + offset);
            }
          }
          result.push(order);
        }
      }
    }
  }
  return result;
}

const STRUCTURAL_ORDERS = buildHouseOrders();

function buildCanonicalCandidate(
  board: Board,
  rowOrder: readonly number[],
  colOrder: readonly number[],
  bestKey?: string,
): { key: string; digitMap: number[] } {
  const digitMap = new Array<number>(10).fill(0);
  let nextDigit = 1;
  let key = '';
  let relationToBest: 'equal' | 'less' = 'equal';

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const sourceRow = rowOrder[row]!;
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const sourceCol = colOrder[col]!;
      const value = board[sourceRow * BOARD_SIZE + sourceCol] ?? 0;
      if (value === 0) {
        key += '0';
        if (bestKey && relationToBest === 'equal') {
          const bestChar = bestKey[key.length - 1];
          if (bestChar && '0' > bestChar) {
            return { key: '~', digitMap };
          }
          if (bestChar && '0' < bestChar) {
            relationToBest = 'less';
          }
        }
        continue;
      }
      if (digitMap[value] === 0) {
        digitMap[value] = nextDigit;
        nextDigit += 1;
      }
      const mapped = String(digitMap[value]);
      key += mapped;
      if (bestKey && relationToBest === 'equal') {
        const bestChar = bestKey[key.length - 1];
        if (bestChar && mapped > bestChar) {
          return { key: '~', digitMap };
        }
        if (bestChar && mapped < bestChar) {
          relationToBest = 'less';
        }
      }
    }
  }
  fillMissingDigitMapEntries(digitMap, nextDigit);
  return { key, digitMap };
}

function keyToBoard(key: string): Board {
  return Array.from(key, (char) => Number(char));
}

function fillMissingDigitMapEntries(digitMap: number[], nextDigit: number): void {
  const usedTargets = new Set(digitMap.filter((value) => value > 0));
  const unusedTargets: number[] = [];
  for (let digit = 1; digit <= 9; digit += 1) {
    if (!usedTargets.has(digit)) {
      unusedTargets.push(digit);
    }
  }

  let fallbackIndex = 0;
  for (let sourceDigit = 1; sourceDigit <= 9; sourceDigit += 1) {
    if (digitMap[sourceDigit] === 0) {
      digitMap[sourceDigit] = unusedTargets[fallbackIndex] ?? nextDigit;
      fallbackIndex += 1;
    }
  }
}

export function canonicalizeBoard(board: Board): CanonicalResult {
  assertBoardValues(board);

  let bestKey = '';
  let bestDigitMap = new Array<number>(10).fill(0);
  let bestTransposed = false;
  let bestRowOrder = STRUCTURAL_ORDERS[0]!;
  let bestColOrder = STRUCTURAL_ORDERS[0]!;
  let first = true;

  for (const transposed of [false, true]) {
    const source = transposed ? transpose(board) : board;
    for (const rowOrder of STRUCTURAL_ORDERS) {
      for (const colOrder of STRUCTURAL_ORDERS) {
        const candidate = buildCanonicalCandidate(source, rowOrder, colOrder, first ? undefined : bestKey);
        if (first || candidate.key < bestKey) {
          bestKey = candidate.key;
          bestDigitMap = candidate.digitMap;
          bestTransposed = transposed;
          bestRowOrder = rowOrder;
          bestColOrder = colOrder;
          first = false;
        }
      }
    }
  }

  return {
    algorithm: 'canonical.classic9',
    version: '1',
    key: bestKey,
    board: keyToBoard(bestKey),
    transform: {
      transposed: bestTransposed,
      rowOrder: [...bestRowOrder],
      colOrder: [...bestColOrder],
      digitMap: [...bestDigitMap],
    },
  };
}

export function canonicalizePair(puzzle: Board, solution: Board): CanonicalPairResult {
  assertSolutionMatchesPuzzle(puzzle, solution);
  const canonical = canonicalizeBoard(puzzle);
  return {
    ...canonical,
    solution: applyTransformToBoard(solution, canonical.transform),
  };
}

function assertSolutionMatchesPuzzle(puzzle: Board, solution: Board): void {
  assertBoardValues(puzzle, 'Puzzle');
  assertBoardValues(solution, 'Solution');
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    const value = solution[cell] ?? 0;
    if (value === 0) {
      throw new Error('Solution must be complete and cannot contain empty cells');
    }
    const clue = puzzle[cell] ?? 0;
    if (clue !== 0 && clue !== value) {
      throw new Error(`Solution does not match puzzle clue at ${cell}`);
    }
  }
  for (const house of ALL_HOUSES) {
    const seen = new Set<number>();
    for (const cell of getHouseCells(house)) {
      const value = solution[cell] ?? 0;
      if (seen.has(value)) {
        throw new Error(`Solution has duplicate digit in ${house.type} ${house.index}`);
      }
      seen.add(value);
    }
  }
}

export function applyTransformToBoard(board: Board, transform: CanonicalTransform): Board {
  assertBoardValues(board);
  validateCanonicalTransform(transform);
  const source = transform.transposed ? transpose(board) : [...board];
  const result = new Array<number>(CELL_COUNT).fill(0);

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const sourceRow = transform.rowOrder[row]!;
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const sourceCol = transform.colOrder[col]!;
      const value = source[sourceRow * BOARD_SIZE + sourceCol] ?? 0;
      result[row * BOARD_SIZE + col] = value === 0 ? 0 : transform.digitMap[value] ?? value;
    }
  }
  return result;
}

export function invertTransform(transform: CanonicalTransform): CanonicalTransform {
  validateCanonicalTransform(transform);
  const rowOrder = invertOrder(transform.rowOrder);
  const colOrder = invertOrder(transform.colOrder);
  const digitMap = new Array<number>(10).fill(0);
  for (let digit = 1; digit <= 9; digit += 1) {
    const mapped = transform.digitMap[digit] ?? 0;
    if (mapped > 0) {
      digitMap[mapped] = digit;
    }
  }
  return {
    transposed: transform.transposed,
    rowOrder: transform.transposed ? colOrder : rowOrder,
    colOrder: transform.transposed ? rowOrder : colOrder,
    digitMap,
  };
}

export function applyTransformToState(state: PuzzleState, transform: CanonicalTransform): PuzzleState {
  validateCanonicalTransform(transform);
  return {
    ...state,
    board: applyTransformToBoard(state.board, transform),
    ...(state.candidateMasks ? { candidateMasks: applyTransformToCandidateMasks(state.candidateMasks, transform) } : {}),
    ...(state.givens ? { givens: state.givens.map((cell) => transformCell(cell, transform)) } : {}),
    ...(state.constraints ? { constraints: applyTransformToConstraints(state.constraints, transform) } : {}),
    ...(state.assumptions ? { assumptions: state.assumptions.map((item) => applyTransformToAssumption(item, transform)) } : {}),
  };
}

function applyTransformToCandidateMasks(candidateMasks: readonly number[], transform: CanonicalTransform): number[] {
  const result = new Array<number>(CELL_COUNT).fill(0);
  for (let cell = 0; cell < Math.min(candidateMasks.length, CELL_COUNT); cell += 1) {
    const targetCell = transformCell(cell, transform);
    let targetMask = 0;
    for (const digit of digitsFromMask(candidateMasks[cell] ?? 0)) {
      targetMask |= maskForDigit(transformDigit(digit, transform) as Digit);
    }
    result[targetCell] = targetMask;
  }
  return result;
}

export function applyTransformToStep(step: SolveStep, transform: CanonicalTransform): SolveStep {
  validateCanonicalTransform(transform);
  return {
    ...step,
    actions: step.actions.map((action) => applyTransformToAction(action, transform)),
    evidence: {
      ...step.evidence,
      ...(step.evidence.cells ? { cells: step.evidence.cells.map((cell) => applyTransformToEvidenceCell(cell, transform)) } : {}),
      ...(step.evidence.links ? { links: step.evidence.links.map((link) => applyTransformToEvidenceLink(link, transform)) } : {}),
      ...(step.evidence.branches ? { branches: step.evidence.branches.map((branch) => applyTransformToEvidenceBranch(branch, transform)) } : {}),
      // houses 在转置时 row/col 会互换；行列重排会改变 house index。box 在 classic9 合法变换下仍是 box。
      ...(step.evidence.houses ? {
        houses: step.evidence.houses.map((house) => {
          if (house.type === 'row') {
            if (transform.transposed) {
              return { type: 'col' as const, index: transform.colOrder.indexOf(house.index) };
            }
            return { type: 'row' as const, index: transform.rowOrder.indexOf(house.index) };
          }
          if (house.type === 'col') {
            if (transform.transposed) {
              return { type: 'row' as const, index: transform.rowOrder.indexOf(house.index) };
            }
            return { type: 'col' as const, index: transform.colOrder.indexOf(house.index) };
          }
          const row = Math.floor(house.index / BLOCK_SIZE) * BLOCK_SIZE;
          const col = (house.index % BLOCK_SIZE) * BLOCK_SIZE;
          const cell = transformCell(row * BOARD_SIZE + col, transform);
          return {
            type: 'box' as const,
            index: Math.floor(Math.floor(cell / BOARD_SIZE) / BLOCK_SIZE) * BLOCK_SIZE + Math.floor((cell % BOARD_SIZE) / BLOCK_SIZE),
          };
        }),
      } : {}),
    },
  };
}

function invertOrder(order: readonly number[]): number[] {
  const result = new Array<number>(order.length).fill(0);
  for (let index = 0; index < order.length; index += 1) {
    result[order[index]!] = index;
  }
  return result;
}

function validatePermutation(value: readonly number[], expectedLength: number, label: string): void {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    throw new Error(`${label} must contain ${expectedLength} items`);
  }
  const seen = new Set<number>();
  for (const item of value) {
    if (!Number.isInteger(item) || item < 0 || item >= expectedLength) {
      throw new Error(`${label} must be a permutation of 0..${expectedLength - 1}`);
    }
    if (seen.has(item)) {
      throw new Error(`${label} contains duplicate value: ${item}`);
    }
    seen.add(item);
  }
}

function validateDigitMap(value: readonly number[]): void {
  if (!Array.isArray(value) || value.length !== 10) {
    throw new Error('canonical transform digitMap must contain 10 items');
  }
  if (value[0] !== 0) {
    throw new Error('canonical transform digitMap[0] must be 0');
  }
  const seen = new Set<number>();
  for (let digit = 1; digit <= 9; digit += 1) {
    const mapped = value[digit];
    if (!Number.isInteger(mapped) || mapped < 1 || mapped > 9) {
      throw new Error('canonical transform digitMap must map digits 1..9 to 1..9');
    }
    if (seen.has(mapped)) {
      throw new Error(`canonical transform digitMap contains duplicate value: ${mapped}`);
    }
    seen.add(mapped);
  }
}

function transformCell(cell: number, transform: CanonicalTransform): number {
  const sourceRow = Math.floor(cell / BOARD_SIZE);
  const sourceCol = cell % BOARD_SIZE;
  const orientedRow = transform.transposed ? sourceCol : sourceRow;
  const orientedCol = transform.transposed ? sourceRow : sourceCol;
  const targetRow = transform.rowOrder.indexOf(orientedRow);
  const targetCol = transform.colOrder.indexOf(orientedCol);
  if (targetRow < 0 || targetCol < 0) {
    throw new Error(`变换后的格子位置无效：${cell}`);
  }
  return targetRow * BOARD_SIZE + targetCol;
}

function transformDigit(digit: number, transform: CanonicalTransform): number {
  return transform.digitMap[digit] ?? digit;
}

function applyTransformToConstraints(
  constraints: CandidateConstraints,
  transform: CanonicalTransform,
): CandidateConstraints {
  return {
    ...(constraints.exactCandidatesMode ? { exactCandidatesMode: constraints.exactCandidatesMode } : {}),
    ...(constraints.forbidden ? { forbidden: constraints.forbidden.map((item) => applyTransformToCandidateList(item, transform)) } : {}),
    ...(constraints.exactCandidates ? { exactCandidates: constraints.exactCandidates.map((item) => applyTransformToCandidateList(item, transform)) } : {}),
    ...(constraints.pencilMarks ? { pencilMarks: constraints.pencilMarks.map((item) => applyTransformToCandidateList(item, transform)) } : {}),
  };
}

function applyTransformToCandidateList(item: CandidateList, transform: CanonicalTransform): CandidateList {
  return {
    cell: transformCell(item.cell, transform),
    digits: item.digits.map((digit) => transformDigit(digit, transform)).sort((left, right) => left - right),
  };
}

function applyTransformToAssumption(item: Assumption, transform: CanonicalTransform): Assumption {
  return {
    ...item,
    cell: transformCell(item.cell, transform),
    digit: transformDigit(item.digit, transform) as Assumption['digit'],
  };
}

function applyTransformToAction(action: StepAction, transform: CanonicalTransform): StepAction {
  return {
    ...action,
    cell: transformCell(action.cell, transform),
    digit: transformDigit(action.digit, transform) as StepAction['digit'],
  };
}

function applyTransformToEvidenceCell(cell: StepCellEvidence, transform: CanonicalTransform): StepCellEvidence {
  const result: StepCellEvidence = {
    cell: transformCell(cell.cell, transform),
    role: cell.role,
  };
  if (cell.digit !== undefined) {
    result.digit = transformDigit(cell.digit, transform) as Digit;
  }
  return result;
}

function applyTransformToEvidenceLink(link: StepLinkEvidence, transform: CanonicalTransform): StepLinkEvidence {
  const result: StepLinkEvidence = {
    ...link,
    from: transformCell(link.from, transform),
    to: transformCell(link.to, transform),
  };
  if (link.digit !== undefined) {
    result.digit = transformDigit(link.digit, transform) as Digit;
  }
  if (link.house) {
    result.house = transformHouse(link.house, transform);
  }
  return result;
}

function applyTransformToEvidenceBranch(branch: StepBranchEvidence, transform: CanonicalTransform): StepBranchEvidence {
  return {
    ...branch,
    assumption: applyTransformToAction(branch.assumption, transform),
    ...(branch.contradictionAt ? { contradictionAt: applyTransformToBranchContradiction(branch.contradictionAt, transform) } : {}),
    ...(branch.actions ? { actions: branch.actions.map((action) => applyTransformToAction(action, transform)) } : {}),
  };
}

function applyTransformToBranchContradiction(
  contradictionAt: NonNullable<StepBranchEvidence['contradictionAt']>,
  transform: CanonicalTransform,
): NonNullable<StepBranchEvidence['contradictionAt']> {
  return {
    ...contradictionAt,
    ...(contradictionAt.cell !== undefined ? { cell: transformCell(contradictionAt.cell, transform) } : {}),
    ...(contradictionAt.house ? { house: transformHouse(contradictionAt.house, transform) } : {}),
    ...(contradictionAt.digit !== undefined ? { digit: transformDigit(contradictionAt.digit, transform) as Digit } : {}),
  };
}

function transformHouse(house: { type: 'row' | 'col' | 'box'; index: number }, transform: CanonicalTransform): { type: 'row' | 'col' | 'box'; index: number } {
  if (house.type === 'row') {
    if (transform.transposed) {
      return { type: 'col', index: transform.colOrder.indexOf(house.index) };
    }
    return { type: 'row', index: transform.rowOrder.indexOf(house.index) };
  }
  if (house.type === 'col') {
    if (transform.transposed) {
      return { type: 'row', index: transform.rowOrder.indexOf(house.index) };
    }
    return { type: 'col', index: transform.colOrder.indexOf(house.index) };
  }
  const row = Math.floor(house.index / BLOCK_SIZE) * BLOCK_SIZE;
  const col = (house.index % BLOCK_SIZE) * BLOCK_SIZE;
  const cell = transformCell(row * BOARD_SIZE + col, transform);
  return {
    type: 'box',
    index: Math.floor(Math.floor(cell / BOARD_SIZE) / BLOCK_SIZE) * BLOCK_SIZE + Math.floor((cell % BOARD_SIZE) / BLOCK_SIZE),
  };
}
