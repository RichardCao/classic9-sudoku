#!/usr/bin/env node
import { performance } from 'node:perf_hooks';

import {
  checkUniqueness,
} from '../dist/src/index.js';

const DEFAULT_ITERATIONS = 5;
const CASES = Object.freeze([
  {
    id: 'solved-board',
    group: 'solved',
    puzzle: '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
  },
  {
    id: 'easy-unique',
    group: 'unique',
    puzzle: '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
  },
  {
    id: 'single-missing',
    group: 'unique',
    puzzle: '534678912672195348198342567859761423426853791713924856961537284287419635345286170',
  },
  {
    id: 'sparse-multiple',
    group: 'multiple',
    puzzle: '100000000000000000000000000000000000000000000000000000000000000000000000000000000',
  },
  {
    id: 'invalid-duplicate',
    group: 'invalid',
    puzzle: '553070000600195000098000060800060003400803001700020006060000280000419005000080079',
  },
]);

const options = parseArgs(process.argv.slice(2));
const rows = CASES.map((entry) => benchmarkCase(entry, options));
const summary = {
  benchmarkId: 'uniqueness-benchmark.v1',
  iterations: options.iterations,
  maxElapsedMs: options.maxElapsedMs ?? null,
  rows,
};

if (options.json) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  printHumanSummary(summary);
}

function benchmarkCase(entry, options) {
  const elapsedValues = [];
  const nodeValues = [];
  let lastResult = null;
  for (let index = 0; index < options.iterations; index += 1) {
    const started = performance.now();
    lastResult = checkUniqueness(entry.puzzle, options.maxElapsedMs ? { maxElapsedMs: options.maxElapsedMs } : undefined);
    elapsedValues.push(performance.now() - started);
    nodeValues.push(lastResult.searchDiagnostics.nodesVisited);
  }
  return {
    id: entry.id,
    group: entry.group,
    status: lastResult?.status ?? null,
    solutionCount: lastResult?.solutionCount ?? null,
    solutionCountLowerBound: lastResult?.solutionCountLowerBound ?? null,
    aborted: lastResult?.aborted ?? null,
    exhausted: lastResult?.exhausted ?? null,
    elapsedMsAvg: round(average(elapsedValues), 3),
    elapsedMsMin: round(Math.min(...elapsedValues), 3),
    elapsedMsMax: round(Math.max(...elapsedValues), 3),
    nodesVisitedAvg: round(average(nodeValues), 1),
    nodesVisitedMin: Math.min(...nodeValues),
    nodesVisitedMax: Math.max(...nodeValues),
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
    maxElapsedMs: null,
    json: false,
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
    if (item === '--max-elapsed-ms') {
      parsed.maxElapsedMs = parsePositiveInteger(requireValue(args, index, item), item);
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
  process.stdout.write(`Uniqueness benchmark: iterations=${summary.iterations}, maxElapsedMs=${summary.maxElapsedMs ?? 'none'}\n`);
  for (const row of summary.rows) {
    process.stdout.write([
      `- ${row.id}`,
      `group=${row.group}`,
      `status=${row.status}`,
      `avg=${row.elapsedMsAvg}ms`,
      `nodes=${row.nodesVisitedAvg}`,
      `range=${row.elapsedMsMin}..${row.elapsedMsMax}ms`,
    ].join(', '));
    process.stdout.write('\n');
  }
}
