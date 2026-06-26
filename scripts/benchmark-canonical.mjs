#!/usr/bin/env node
import { performance } from 'node:perf_hooks';

import {
  canonicalizeBoard,
  canonicalizePair,
  parsePuzzle,
} from '../dist/src/index.js';

const DEFAULT_ITERATIONS = 10;
const CASES = Object.freeze([
  {
    id: 'empty-board',
    group: 'empty',
    puzzle: '0'.repeat(81),
  },
  {
    id: 'solved-board',
    group: 'solved',
    puzzle: '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
  },
  {
    id: 'single-missing',
    group: 'unique',
    puzzle: '534678912672195348198342567859761423426853791713924856961537284287419635345286170',
    solution: '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
  },
  {
    id: 'easy-unique',
    group: 'unique',
    puzzle: '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
    solution: '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
  },
  {
    id: 'sparse-multiple',
    group: 'sparse',
    puzzle: '100000000000000000000000000000000000000000000000000000000000000000000000000000000',
  },
]);

const options = parseArgs(process.argv.slice(2));
const selectedCases = CASES.filter((entry) => options.caseIds.size === 0 || options.caseIds.has(entry.id));
if (selectedCases.length === 0) {
  throw new Error('No benchmark cases selected.');
}

const rows = selectedCases.map((entry) => benchmarkCase(entry, options));
const summary = {
  benchmarkId: 'canonical-benchmark.v1',
  iterations: options.iterations,
  rows,
};

if (options.json) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  printHumanSummary(summary);
}

function benchmarkCase(entry, options) {
  const puzzle = parsePuzzle(entry.puzzle);
  const solution = entry.solution ? parsePuzzle(entry.solution) : null;
  const boardElapsed = [];
  const pairElapsed = [];
  let lastBoard = null;
  let lastPair = null;

  for (let index = 0; index < options.iterations; index += 1) {
    const boardStarted = performance.now();
    lastBoard = canonicalizeBoard(puzzle);
    boardElapsed.push(performance.now() - boardStarted);

    if (solution) {
      const pairStarted = performance.now();
      lastPair = canonicalizePair(puzzle, solution);
      pairElapsed.push(performance.now() - pairStarted);
    }
  }

  return {
    id: entry.id,
    group: entry.group,
    keyPrefix: lastBoard?.key.slice(0, 18) ?? null,
    boardElapsedMsAvg: round(average(boardElapsed), 3),
    boardElapsedMsMin: round(Math.min(...boardElapsed), 3),
    boardElapsedMsMax: round(Math.max(...boardElapsed), 3),
    pairElapsedMsAvg: pairElapsed.length > 0 ? round(average(pairElapsed), 3) : null,
    pairElapsedMsMin: pairElapsed.length > 0 ? round(Math.min(...pairElapsed), 3) : null,
    pairElapsedMsMax: pairElapsed.length > 0 ? round(Math.max(...pairElapsed), 3) : null,
    transform: {
      transposed: lastBoard?.transform.transposed ?? null,
      rowOrder: lastBoard?.transform.rowOrder ?? null,
      colOrder: lastBoard?.transform.colOrder ?? null,
      digitMap: lastBoard?.transform.digitMap ?? null,
    },
    warnings: lastPair?.warnings ?? [],
  };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseArgs(args) {
  const parsed = {
    iterations: DEFAULT_ITERATIONS,
    json: false,
    caseIds: new Set(),
  };
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--json') {
      parsed.json = true;
      continue;
    }
    if (item === '--iterations') {
      parsed.iterations = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--case') {
      parsed.caseIds.add(requireValue(args, index, item));
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

function requireValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function printHumanSummary(summary) {
  process.stdout.write(`Canonical benchmark: iterations=${summary.iterations}\n`);
  for (const row of summary.rows) {
    const pairPart = row.pairElapsedMsAvg === null ? 'pair=n/a' : `pairAvg=${row.pairElapsedMsAvg}ms`;
    process.stdout.write([
      `- ${row.id}`,
      `group=${row.group}`,
      `boardAvg=${row.boardElapsedMsAvg}ms`,
      `boardRange=${row.boardElapsedMsMin}..${row.boardElapsedMsMax}ms`,
      pairPart,
      `keyPrefix=${row.keyPrefix}`,
    ].join(', '));
    process.stdout.write('\n');
  }
}
