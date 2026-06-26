#!/usr/bin/env node
import { performance } from 'node:perf_hooks';

import {
  analyzeCandidatePool,
  canonicalizeBoard,
  dedupeCandidates,
  parsePuzzle,
  selectFromCandidates,
} from '../dist/src/index.js';

const DEFAULT_SIZE = 1000;
const DEFAULT_ITERATIONS = 5;
const BASE_PUZZLES = Object.freeze([
  {
    puzzle: '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
    solution: '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
    score: 640,
    grade: 'basic',
    hardestTechnique: 'hidden-single',
    techniqueCounts: { 'hidden-single': 18, 'naked-single': 22 },
  },
  {
    puzzle: '534678912672195348198342567859761423426853791713924856961537284287419635345286170',
    solution: '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
    score: 120,
    grade: 'basic',
    hardestTechnique: 'full-house',
    techniqueCounts: { 'full-house': 1 },
  },
]);

const options = parseArgs(process.argv.slice(2));
const candidates = buildCandidates(options.size);
const rows = [
  benchmarkOperation('analyzeCandidatePool', options.iterations, () => analyzeCandidatePool(candidates, {
    verifyCanonicalKey: options.verifyCanonicalKey,
  })),
  benchmarkOperation('dedupeCandidates:candidateKey', options.iterations, () => dedupeCandidates(candidates, {
    key: 'canonical',
    verifyCanonicalKey: options.verifyCanonicalKey,
  })),
  benchmarkOperation('selectFromCandidates', options.iterations, () => selectFromCandidates(candidates, {
    maxResults: Math.min(50, options.size),
    dedupeCanonical: true,
    preferredTechniques: ['hidden-single', 'full-house'],
    scoreBuckets: [
      { min: 0, max: 499, limit: 25 },
      { min: 500, max: 999, limit: 25 },
    ],
  }, {
    verifyCanonicalKey: options.verifyCanonicalKey,
  })),
];
const summary = {
  benchmarkId: 'candidate-pool-benchmark.v1',
  candidates: candidates.length,
  iterations: options.iterations,
  verifyCanonicalKey: options.verifyCanonicalKey,
  rows,
};

if (options.json) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  printHumanSummary(summary);
}

function buildCandidates(size) {
  const bases = BASE_PUZZLES.map((base, index) => {
    const puzzle = parsePuzzle(base.puzzle);
    const solution = parsePuzzle(base.solution);
    return {
      puzzle,
      solution,
      seed: index + 1,
      solved: true,
      clueCount: puzzle.filter((value) => value !== 0).length,
      score: base.score,
      grade: base.grade,
      hardestTechnique: base.hardestTechnique,
      techniqueCounts: base.techniqueCounts,
      canonicalKey: canonicalizeBoard(puzzle).key,
    };
  });
  const output = [];
  for (let index = 0; index < size; index += 1) {
    const base = bases[index % bases.length];
    output.push({
      ...base,
      puzzle: [...base.puzzle],
      solution: [...base.solution],
      seed: index + 1,
      score: base.score + (index % 10),
      techniqueCounts: { ...base.techniqueCounts },
    });
  }
  return output;
}

function benchmarkOperation(id, iterations, operation) {
  const elapsed = [];
  let lastResult = null;
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    lastResult = operation();
    elapsed.push(performance.now() - started);
  }
  return {
    id,
    elapsedMsAvg: round(average(elapsed), 3),
    elapsedMsMin: round(Math.min(...elapsed), 3),
    elapsedMsMax: round(Math.max(...elapsed), 3),
    resultSummary: summarizeResult(lastResult),
  };
}

function summarizeResult(result) {
  if (result && typeof result === 'object' && 'total' in result) {
    return {
      total: result.total,
      withCanonicalKey: result.canonical?.withKey,
      duplicateCanonicalKeys: result.canonical?.duplicateKeys,
    };
  }
  if (result && typeof result === 'object' && 'diagnostics' in result) {
    return result.diagnostics;
  }
  return null;
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
    size: DEFAULT_SIZE,
    iterations: DEFAULT_ITERATIONS,
    verifyCanonicalKey: false,
    json: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--json') {
      parsed.json = true;
      continue;
    }
    if (item === '--verify-canonical-key') {
      parsed.verifyCanonicalKey = true;
      continue;
    }
    if (item === '--size') {
      parsed.size = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--iterations') {
      parsed.iterations = parsePositiveInteger(requireValue(args, index, item), item);
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
  process.stdout.write(`Candidate pool benchmark: candidates=${summary.candidates}, iterations=${summary.iterations}, verifyCanonicalKey=${summary.verifyCanonicalKey}\n`);
  for (const row of summary.rows) {
    process.stdout.write([
      `- ${row.id}`,
      `avg=${row.elapsedMsAvg}ms`,
      `range=${row.elapsedMsMin}..${row.elapsedMsMax}ms`,
    ].join(', '));
    process.stdout.write('\n');
  }
}
