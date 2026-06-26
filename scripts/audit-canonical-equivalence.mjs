#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import {
  applyTransformToBoard,
  canonicalizeBoard,
  canonicalizePair,
  parsePuzzle,
  validate,
} from '../dist/src/index.js';

const DEFAULT_TRANSFORMS_PER_ROW = 6;
const DEFAULT_MAX_ROWS = 68;
const CORPUS_PATH = 'tests/fixtures/reference-techniques/reference-rating-corpus.json';

const options = parseArgs(process.argv.slice(2));
const corpus = JSON.parse(readFileSync(options.corpusPath, 'utf8'));
if (!Array.isArray(corpus.rows)) {
  throw new Error(`Corpus ${options.corpusPath} must contain rows.`);
}

const rows = corpus.rows.slice(0, options.maxRows);
const failures = [];
const warnings = [];
let checkedPuzzles = 0;
let checkedTransforms = 0;
let checkedGeometryTransforms = 0;
let checkedSingleClueBoards = 0;

checkEmptyBoard();
checkSingleClueBoards();

for (const [rowIndex, row] of rows.entries()) {
  if (typeof row.puzzle !== 'string' || typeof row.solution !== 'string') {
    continue;
  }
  const puzzle = parsePuzzle(row.puzzle);
  const solution = parsePuzzle(row.solution);
  const canonical = canonicalizeBoard(puzzle);
  const pair = canonicalizePair(puzzle, solution);
  checkedPuzzles += 1;
  if (pair.warnings && pair.warnings.length > 0) {
    failures.push({
      row: row.id ?? rowIndex,
      type: 'pair-warning',
      warnings: pair.warnings,
    });
    continue;
  }
  if (pair.key !== canonical.key) {
    failures.push({
      row: row.id ?? rowIndex,
      type: 'pair-key-mismatch',
      key: canonical.key,
      pairKey: pair.key,
    });
  }

  for (const transformName of ['identity', 'rotate90', 'rotate180', 'rotate270', 'mirror-horizontal', 'mirror-vertical']) {
    const transformedPuzzle = applyGeometryTransform(puzzle, transformName);
    const transformedSolution = applyGeometryTransform(solution, transformName);
    assertEquivalent(row, canonical, transformedPuzzle, transformedSolution, transformName, failures);
    checkedGeometryTransforms += 1;
  }

  for (let offset = 0; offset < options.transformsPerRow; offset += 1) {
    const seed = (rowIndex + 1) * 10_000 + offset + 1;
    const transform = buildRandomCanonicalTransform(seed);
    const transformedPuzzle = applyTransformToBoard(puzzle, transform);
    const transformedSolution = applyTransformToBoard(solution, transform);
    assertEquivalent(row, canonical, transformedPuzzle, transformedSolution, `random-${offset + 1}`, failures);
    checkedTransforms += 1;
  }
}

const summary = {
  auditId: 'canonical-equivalence-audit.v1',
  corpusPath: options.corpusPath,
  rowsChecked: checkedPuzzles,
  randomTransformsPerRow: options.transformsPerRow,
  randomTransformsChecked: checkedTransforms,
  geometryTransformsChecked: checkedGeometryTransforms,
  singleClueBoardsChecked: checkedSingleClueBoards,
  failures,
  warnings,
  passed: failures.length === 0,
  decision: failures.length === 0
    ? 'canonical.classic9.v1 remained stable for sampled equivalent unique-solution puzzles.'
    : 'canonical.classic9.v1 equivalence audit found mismatches; do not publish without fixing or versioning canonical.',
};

if (options.json) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  printHumanSummary(summary);
}

if (failures.length > 0) {
  process.exitCode = 1;
}

function assertEquivalent(row, canonical, transformedPuzzle, transformedSolution, label, outputFailures) {
  const transformedCanonical = canonicalizeBoard(transformedPuzzle);
  if (transformedCanonical.key !== canonical.key) {
    outputFailures.push({
      row: row.id,
      type: 'canonical-key-mismatch',
      transform: label,
      expected: canonical.key,
      actual: transformedCanonical.key,
    });
  }
  const transformedPair = canonicalizePair(transformedPuzzle, transformedSolution);
  if (transformedPair.warnings && transformedPair.warnings.length > 0) {
    outputFailures.push({
      row: row.id,
      type: 'transformed-pair-warning',
      transform: label,
      warnings: transformedPair.warnings,
    });
  }
  if (transformedPair.key !== canonical.key) {
    outputFailures.push({
      row: row.id,
      type: 'transformed-pair-key-mismatch',
      transform: label,
      expected: canonical.key,
      actual: transformedPair.key,
    });
  }
  const solutionValidation = validate(transformedPair.solution);
  if (!solutionValidation.legal) {
    outputFailures.push({
      row: row.id,
      type: 'transformed-pair-solution-illegal',
      transform: label,
      validation: solutionValidation,
    });
  }
}

function checkEmptyBoard() {
  const board = new Array(81).fill(0);
  const canonical = canonicalizeBoard(board);
  if (canonical.key !== '0'.repeat(81)) {
    failures.push({ type: 'empty-board-key', actual: canonical.key });
  }
  if (
    canonical.transform.transposed !== false
    || canonical.transform.rowOrder.join(',') !== '0,1,2,3,4,5,6,7,8'
    || canonical.transform.colOrder.join(',') !== '0,1,2,3,4,5,6,7,8'
    || canonical.transform.digitMap.join(',') !== '0,1,2,3,4,5,6,7,8,9'
  ) {
    failures.push({ type: 'empty-board-transform', transform: canonical.transform });
  }
}

function checkSingleClueBoards() {
  const expectedKey = `${'0'.repeat(80)}1`;
  for (let cell = 0; cell < 81; cell += 1) {
    for (let digit = 1; digit <= 9; digit += 1) {
      const board = new Array(81).fill(0);
      board[cell] = digit;
      const canonical = canonicalizeBoard(board);
      checkedSingleClueBoards += 1;
      if (canonical.key !== expectedKey) {
        failures.push({
          type: 'single-clue-key',
          cell,
          digit,
          expected: expectedKey,
          actual: canonical.key,
        });
      }
    }
  }
}

function applyGeometryTransform(board, name) {
  const output = new Array(81).fill(0);
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const source = row * 9 + col;
      const [targetRow, targetCol] = mapGeometry(row, col, name);
      output[targetRow * 9 + targetCol] = board[source];
    }
  }
  return output;
}

function mapGeometry(row, col, name) {
  switch (name) {
    case 'identity':
      return [row, col];
    case 'rotate90':
      return [col, 8 - row];
    case 'rotate180':
      return [8 - row, 8 - col];
    case 'rotate270':
      return [8 - col, row];
    case 'mirror-horizontal':
      return [8 - row, col];
    case 'mirror-vertical':
      return [row, 8 - col];
    default:
      throw new Error(`Unknown geometry transform: ${name}`);
  }
}

function buildRandomCanonicalTransform(seed) {
  const random = createRandom(seed);
  const rowOrder = buildHouseOrder(random);
  const colOrder = buildHouseOrder(random);
  return {
    transposed: random() > 0.5,
    rowOrder,
    colOrder,
    digitMap: buildDigitMap(random),
  };
}

function buildHouseOrder(random) {
  const blockOrder = shuffle([0, 1, 2], random);
  const order = [];
  for (const block of blockOrder) {
    const offsets = shuffle([0, 1, 2], random);
    for (const offset of offsets) {
      order.push(block * 3 + offset);
    }
  }
  return order;
}

function buildDigitMap(random) {
  const targets = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const map = new Array(10).fill(0);
  for (let digit = 1; digit <= 9; digit += 1) {
    map[digit] = targets[digit - 1];
  }
  return map;
}

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

function shuffle(items, random) {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function parseArgs(args) {
  const parsed = {
    corpusPath: CORPUS_PATH,
    transformsPerRow: DEFAULT_TRANSFORMS_PER_ROW,
    maxRows: DEFAULT_MAX_ROWS,
    json: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--json') {
      parsed.json = true;
      continue;
    }
    if (item === '--corpus') {
      parsed.corpusPath = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--transforms-per-row') {
      parsed.transformsPerRow = parseNonNegativeInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--max-rows') {
      parsed.maxRows = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${item}`);
  }
  return parsed;
}

function parsePositiveInteger(raw, option) {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return value;
}

function parseNonNegativeInteger(raw, option) {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${option} must be a non-negative integer.`);
  }
  return value;
}

function requireValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function printHumanSummary(summary) {
  process.stdout.write(`Canonical equivalence audit: rows=${summary.rowsChecked}, randomTransforms=${summary.randomTransformsChecked}, geometryTransforms=${summary.geometryTransformsChecked}, singleClue=${summary.singleClueBoardsChecked}\n`);
  process.stdout.write(`Result: ${summary.passed ? 'passed' : 'failed'}\n`);
  if (summary.failures.length > 0) {
    for (const failure of summary.failures.slice(0, 10)) {
      process.stdout.write(`- ${JSON.stringify(failure)}\n`);
    }
  }
  process.stdout.write(`${summary.decision}\n`);
}
