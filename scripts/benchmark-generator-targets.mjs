#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

import {
  generateOne,
  getRatingPolicy,
  parsePuzzle,
} from '../dist/src/index.js';

const DEFAULT_ATTEMPTS = 10;
const DEFAULT_ELAPSED_MS = 1500;
const DEFAULT_CASE_LIMIT = 3;
const DEFAULT_SEED = 1;
const CORPUS_PATH = 'tests/fixtures/reference-techniques/reference-rating-corpus.json';

const SCORE_RANGES = Object.freeze([
  { id: 'easy', min: 0, max: 999 },
  { id: 'medium', min: 1000, max: 2499 },
  { id: 'hard', min: 2500, max: 5999 },
  { id: 'expert', min: 6000, max: 20000 },
]);
const CLUE_TARGETS = Object.freeze([40, 34, 30, 26]);
const SOLUTION_SOURCES = Object.freeze(['transform-fixed', 'random-backtracking', 'pool']);

const options = parseArgs(process.argv.slice(2));
const corpus = loadCorpus(options.corpusPath);
const pool = corpus.rows
  .map((row) => parsePuzzle(row.solution))
  .slice(0, Math.max(1, options.poolSize));
const policy = getRatingPolicy(options.profile);
const cases = buildCases(options.caseLimit);

const rows = [];
for (const source of options.sources) {
  for (const testCase of cases) {
    rows.push(runCase(source, testCase, policy, pool, options));
  }
}

const summary = {
  benchmarkId: 'generator-target-benchmark.v1',
  profile: options.profile,
  attemptsPerCase: options.attempts,
  maxElapsedMsPerAttempt: options.maxElapsedMs,
  seedStart: options.seed,
  corpusPath: options.corpusPath,
  poolSize: pool.length,
  rows,
  decision: buildDecision(rows),
};

if (options.json) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  printHumanSummary(summary);
}

function buildCases(limit) {
  const output = [];
  for (const clueTarget of CLUE_TARGETS) {
    for (const range of SCORE_RANGES) {
      output.push({
        id: `clues-${clueTarget}-${range.id}`,
        clueTarget,
        scoreRange: range,
      });
    }
  }
  return output.slice(0, limit);
}

function runCase(source, testCase, policy, pool, options) {
  const elapsed = [];
  const statuses = {};
  const rejectedByReason = {};
  const scores = [];
  const hardestTechniqueCounts = {};
  const canonicalKeys = new Set();
  let successes = 0;
  let bestDistance = null;
  let bestStatus = null;

  for (let offset = 0; offset < options.attempts; offset += 1) {
    const request = {
      seed: options.seed + offset,
      ratingPolicy: policy,
      canonicalize: true,
      minimality: 'none',
      solutionSource: source,
      constraints: {
        clues: { target: testCase.clueTarget },
        score: {
          min: testCase.scoreRange.min,
          max: testCase.scoreRange.max,
        },
      },
      budget: {
        maxAttempts: 1,
        maxElapsedMs: options.maxElapsedMs,
      },
      ...(source === 'pool' ? { solutionPool: pool } : {}),
    };
    const startedAt = performance.now();
    const result = generateOne(request);
    elapsed.push(performance.now() - startedAt);
    statuses[result.status] = (statuses[result.status] ?? 0) + 1;
    for (const [reason, count] of Object.entries(result.diagnostics.rejectedByReason ?? {})) {
      rejectedByReason[reason] = (rejectedByReason[reason] ?? 0) + count;
    }
    const candidate = result.puzzle ?? result.bestCandidate;
    if (candidate) {
      scores.push(candidate.score);
      if (candidate.hardestTechnique) {
        hardestTechniqueCounts[candidate.hardestTechnique] = (hardestTechniqueCounts[candidate.hardestTechnique] ?? 0) + 1;
      }
      if (candidate.canonicalKey) {
        canonicalKeys.add(candidate.canonicalKey);
      }
      const distance = scoreDistance(candidate.score, testCase.scoreRange);
      if (bestDistance === null || distance < bestDistance) {
        bestDistance = distance;
        bestStatus = result.status;
      }
    }
    if (result.status === 'success') {
      successes += 1;
    }
  }

  return {
    id: `${source}:${testCase.id}`,
    source,
    clueTarget: testCase.clueTarget,
    scoreRange: testCase.scoreRange,
    attempts: options.attempts,
    successes,
    successRate: round(successes / options.attempts, 4),
    statuses,
    rejectedByReason,
    elapsedMs: summarizeNumbers(elapsed),
    score: summarizeNumbers(scores),
    uniqueCanonicalKeys: canonicalKeys.size,
    hardestTechniqueCounts: topCounts(hardestTechniqueCounts, 8),
    bestDistance,
    bestStatus,
  };
}

function scoreDistance(score, range) {
  if (score >= range.min && score <= range.max) {
    return 0;
  }
  if (score < range.min) {
    return range.min - score;
  }
  return score - range.max;
}

function buildDecision(rows) {
  const anySuccess = rows.some((row) => row.successes > 0);
  const bySource = {};
  for (const row of rows) {
    const bucket = bySource[row.source] ?? { attempts: 0, successes: 0, uniqueCanonicalKeys: 0 };
    bucket.attempts += row.attempts;
    bucket.successes += row.successes;
    bucket.uniqueCanonicalKeys += row.uniqueCanonicalKeys;
    bySource[row.source] = bucket;
  }
  for (const bucket of Object.values(bySource)) {
    bucket.successRate = round(bucket.successes / bucket.attempts, 4);
  }
  return {
    anySuccess,
    bySource,
    releaseBlocking: false,
    note: anySuccess
      ? 'Small sample produced at least one target hit; keep treating narrow score targeting as best-effort.'
      : 'Small sample produced no target hits; this supports documenting score targeting as best-effort and recommending search/candidate pools.',
  };
}

function summarizeNumbers(values) {
  if (values.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      average: null,
      median: null,
      p95: null,
    };
  }
  const sorted = [...values].sort((left, right) => left - right);
  return {
    count: values.length,
    min: round(sorted[0], 3),
    max: round(sorted[sorted.length - 1], 3),
    average: round(values.reduce((sum, value) => sum + value, 0) / values.length, 3),
    median: round(percentile(sorted, 0.5), 3),
    p95: round(percentile(sorted, 0.95), 3),
  };
}

function percentile(sortedValues, quantile) {
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * quantile) - 1);
  return sortedValues[index];
}

function topCounts(counts, limit) {
  return Object.fromEntries(
    Object.entries(counts)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, limit),
  );
}

function loadCorpus(path) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(parsed.rows)) {
    throw new Error(`Corpus ${path} must contain rows.`);
  }
  return parsed;
}

function parseArgs(args) {
  const parsed = {
    attempts: DEFAULT_ATTEMPTS,
    maxElapsedMs: DEFAULT_ELAPSED_MS,
    caseLimit: DEFAULT_CASE_LIMIT,
    seed: DEFAULT_SEED,
    profile: 'classic-stable',
    corpusPath: CORPUS_PATH,
    poolSize: 12,
    sources: [...SOLUTION_SOURCES],
    json: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--json') {
      parsed.json = true;
      continue;
    }
    if (item === '--attempts') {
      parsed.attempts = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--max-elapsed-ms') {
      parsed.maxElapsedMs = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--case-limit') {
      parsed.caseLimit = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--seed') {
      parsed.seed = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--profile') {
      parsed.profile = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--corpus') {
      parsed.corpusPath = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--pool-size') {
      parsed.poolSize = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--source') {
      const source = requireValue(args, index, item);
      if (!SOLUTION_SOURCES.includes(source)) {
        throw new Error(`Unknown source: ${source}`);
      }
      parsed.sources = [source];
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

function round(value, digits) {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function printHumanSummary(summary) {
  process.stdout.write(`Generator target benchmark: profile=${summary.profile}, attemptsPerCase=${summary.attemptsPerCase}, maxElapsedMs=${summary.maxElapsedMsPerAttempt}\n`);
  for (const row of summary.rows) {
    process.stdout.write([
      `- ${row.id}`,
      `success=${row.successes}/${row.attempts}`,
      `elapsedAvg=${row.elapsedMs.average}ms`,
      `scoreAvg=${row.score.average ?? 'n/a'}`,
      `uniqueKeys=${row.uniqueCanonicalKeys}`,
      `status=${JSON.stringify(row.statuses)}`,
    ].join(', '));
    process.stdout.write('\n');
  }
  process.stdout.write(`Decision: ${summary.decision.note}\n`);
}
