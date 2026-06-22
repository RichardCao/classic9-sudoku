#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  checkUniqueness,
  getRatingPolicy,
  parsePuzzle,
  rate,
  replaySteps,
  serializeBoard,
  SolverContext,
  verifyStep,
} from '../dist/src/index.js';

const DEFAULT_INPUT = 'tests/fixtures/reference-techniques/reference-rating-corpus.json';
const BUILT_IN_PROFILES = new Set(['classic-stable', 'classic-extended', 'classic-galaxy']);

const options = parseArgs(process.argv.slice(2));
const inputPath = resolve(process.cwd(), options.inputPath);
const fixture = loadFixture(inputPath);
const startedAt = performance.now();
const rows = fixture.rows.map((record) => auditRecord(record));
const failed = rows.filter((row) => !row.ok);
const payload = {
  summary: {
    auditId: 'reference-rating-corpus.v1',
    corpusKind: 'reference-rating',
    note: fixture.note,
    input: options.inputPath,
    total: rows.length,
    passed: rows.length - failed.length,
    failed: failed.length,
    elapsedMs: Math.round(performance.now() - startedAt),
  },
  rows,
};

if (options.outputPath) {
  writeFileSync(resolve(process.cwd(), options.outputPath), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

if (options.json) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  printHumanSummary(payload);
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function auditRecord(record) {
  const started = performance.now();
  const issues = [];
  let uniqueness = null;
  let rating = null;
  let finalBoard = null;
  let verifiedSteps = 0;

  try {
    uniqueness = checkUniqueness(record.puzzle);
    rating = rate(record.puzzle, buildRatingPolicy(record));
    verifiedSteps = auditRatingSteps(record, rating.steps, issues);
    finalBoard = replaySteps(parsePuzzle(record.puzzle), rating.steps);
  } catch (error) {
    issues.push(`runtime:${formatError(error)}`);
  }

  if (uniqueness && record.expected.unique === true && uniqueness.status !== 'unique') {
    issues.push(`uniqueness-mismatch:${uniqueness.status}`);
  }
  if (rating) {
    if (rating.solved !== record.expected.solved) {
      issues.push(`solved-mismatch:${rating.solved}`);
    }
    if (record.expected.hardestTechnique && rating.hardestTechnique !== record.expected.hardestTechnique) {
      issues.push(`hardest-mismatch:${String(rating.hardestTechnique)}`);
    }
    if (typeof record.expected.score === 'number' && rating.score !== record.expected.score) {
      issues.push(`score-mismatch:${rating.score}`);
    }
    if (typeof record.expected.scoreMin === 'number' && rating.score < record.expected.scoreMin) {
      issues.push(`score-below-min:${rating.score}`);
    }
    if (typeof record.expected.scoreMax === 'number' && rating.score > record.expected.scoreMax) {
      issues.push(`score-above-max:${rating.score}`);
    }
    if (typeof record.expected.stepCount === 'number' && rating.steps.length !== record.expected.stepCount) {
      issues.push(`step-count-mismatch:${rating.steps.length}`);
    }
    for (const [technique, count] of Object.entries(record.expected.techniqueCountsAtLeast ?? {})) {
      const actual = rating.techniqueCounts[technique] ?? 0;
      if (actual < count) {
        issues.push(`technique-count-below:${technique}:${actual}<${count}`);
      }
    }
    for (const [technique, count] of Object.entries(record.expected.techniqueCountsAtMost ?? {})) {
      const actual = rating.techniqueCounts[technique] ?? 0;
      if (actual > count) {
        issues.push(`technique-count-above:${technique}:${actual}>${count}`);
      }
    }
  }
  if (finalBoard && record.solution && serializeBoard(finalBoard) !== record.solution) {
    issues.push('solution-mismatch');
  }
  if (uniqueness?.firstSolution && record.solution && serializeBoard(uniqueness.firstSolution) !== record.solution) {
    issues.push('first-solution-mismatch');
  }

  return {
    id: record.id,
    profile: record.profile,
    targetFirstTechniques: record.targetFirstTechniques ?? [],
    externalBucket: record.externalBucket,
    ok: issues.length === 0,
    issues,
    uniquenessStatus: uniqueness?.status ?? null,
    solved: rating?.solved ?? null,
    score: rating?.score ?? null,
    grade: rating?.grade ?? null,
    hardestTechnique: rating?.hardestTechnique ?? null,
    stepCount: rating?.steps.length ?? null,
    verifiedSteps,
    firstTechniqueSteps: rating ? collectFirstTechniqueSteps(rating.steps) : {},
    techniqueCountGaps: rating ? collectTechniqueCountGaps(record, rating.techniqueCounts) : [],
    techniqueCounts: rating?.techniqueCounts ?? {},
    elapsedMs: Math.round(performance.now() - started),
  };
}

function buildRatingPolicy(record) {
  const policy = getRatingPolicy(record.profile);
  if (!Array.isArray(record.targetFirstTechniques) || record.targetFirstTechniques.length === 0) {
    return policy;
  }
  const targetSet = new Set(record.targetFirstTechniques);
  const primary = [...policy.techniqueOrder];
  const fallback = [...(policy.fallbackTechniques ?? [])];
  return {
    ...policy,
    id: `${policy.id}:target-first-reference`,
    techniqueOrder: [
      ...record.targetFirstTechniques,
      ...primary.filter((technique) => !targetSet.has(technique)),
      ...fallback.filter((technique) => !targetSet.has(technique)),
    ],
    fallbackTechniques: fallback.filter((technique) => !targetSet.has(technique)),
  };
}

function collectFirstTechniqueSteps(steps) {
  const firstSteps = {};
  for (const [index, step] of steps.entries()) {
    if (firstSteps[step.technique] === undefined) {
      firstSteps[step.technique] = index + 1;
    }
  }
  return firstSteps;
}

function collectTechniqueCountGaps(record, techniqueCounts) {
  const gaps = [];
  for (const [technique, expected] of Object.entries(record.expected.techniqueCountsAtLeast ?? {})) {
    const actual = techniqueCounts[technique] ?? 0;
    if (actual < expected) {
      gaps.push({ technique, kind: 'below-min', expected, actual });
    }
  }
  for (const [technique, expected] of Object.entries(record.expected.techniqueCountsAtMost ?? {})) {
    const actual = techniqueCounts[technique] ?? 0;
    if (actual > expected) {
      gaps.push({ technique, kind: 'above-max', expected, actual });
    }
  }
  return gaps;
}

function auditRatingSteps(record, steps, issues) {
  const context = new SolverContext(parsePuzzle(record.puzzle));
  const solution = parsePuzzle(record.solution);
  let verified = 0;
  for (const [index, step] of steps.entries()) {
    const verification = verifyStep({
      board: context.board,
      candidateMasks: context.candidates,
    }, step, { mode: 'evidence' });
    if (!verification.valid) {
      issues.push(`step-verify-failed:${index + 1}:${summarizeIssueCodes(verification.issues
        .filter((issue) => issue.severity === 'error')
        .map((issue) => issue.code))}`);
    }
    for (const action of step.actions) {
      const truth = solution[action.cell];
      if (action.type === 'place' && action.digit !== truth) {
        issues.push(`step-place-mismatch:${index + 1}:${action.cell}:${action.digit}<${truth}`);
      }
      if (action.type === 'eliminate' && action.digit === truth) {
        issues.push(`step-eliminates-solution:${index + 1}:${action.cell}:${action.digit}`);
      }
    }
    context.applyStep(step);
    verified += 1;
  }
  return verified;
}

function summarizeIssueCodes(codes) {
  const counts = new Map();
  for (const code of codes) {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, count]) => count === 1 ? code : `${code}x${count}`)
    .join('|') || 'unknown';
}

function loadFixture(path) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!isRecord(parsed) || parsed.corpusId !== 'reference-rating-corpus.v1' || parsed.corpusKind !== 'reference-rating' || !Array.isArray(parsed.rows)) {
    throw new Error(`Invalid reference rating corpus file: ${path}`);
  }
  for (const record of parsed.rows) {
    assertRecord(record, path);
  }
  return parsed;
}

function assertRecord(record, path) {
  if (!isRecord(record)) {
    throw new Error(`Invalid reference rating row in ${path}: record must be an object.`);
  }
  assertNonEmptyString(record.id, 'id', path);
  assertNonEmptyString(record.externalBucket, `${record.id}.externalBucket`, path);
  assertNonEmptyString(record.puzzle, `${record.id}.puzzle`, path);
  assertNonEmptyString(record.solution, `${record.id}.solution`, path);
  if (!BUILT_IN_PROFILES.has(record.profile)) {
    throw new Error(`Invalid reference rating row in ${path}: ${record.id}.profile must be a built-in profile.`);
  }
  if ('targetFirstTechniques' in record) {
    if (!Array.isArray(record.targetFirstTechniques) || record.targetFirstTechniques.length === 0 || record.targetFirstTechniques.some((technique) => typeof technique !== 'string' || technique.length === 0)) {
      throw new Error(`Invalid reference rating row in ${path}: ${record.id}.targetFirstTechniques must be a non-empty string array.`);
    }
  }
  if (!isRecord(record.expected)) {
    throw new Error(`Invalid reference rating row in ${path}: ${record.id}.expected must be an object.`);
  }
  if (typeof record.expected.solved !== 'boolean') {
    throw new Error(`Invalid reference rating row in ${path}: ${record.id}.expected.solved must be boolean.`);
  }
  if ('unique' in record.expected && typeof record.expected.unique !== 'boolean') {
    throw new Error(`Invalid reference rating row in ${path}: ${record.id}.expected.unique must be boolean.`);
  }
  for (const field of ['score', 'scoreMin', 'scoreMax', 'stepCount']) {
    if (field in record.expected && (!Number.isInteger(record.expected[field]) || record.expected[field] < 0)) {
      throw new Error(`Invalid reference rating row in ${path}: ${record.id}.expected.${field} must be a non-negative integer.`);
    }
  }
  if ('techniqueCountsAtLeast' in record.expected) {
    if (!isRecord(record.expected.techniqueCountsAtLeast)) {
      throw new Error(`Invalid reference rating row in ${path}: ${record.id}.expected.techniqueCountsAtLeast must be an object.`);
    }
    for (const [technique, count] of Object.entries(record.expected.techniqueCountsAtLeast)) {
      if (!technique || !Number.isInteger(count) || count < 0) {
        throw new Error(`Invalid reference rating row in ${path}: ${record.id}.expected.techniqueCountsAtLeast has an invalid count.`);
      }
    }
  }
  if ('techniqueCountsAtMost' in record.expected) {
    if (!isRecord(record.expected.techniqueCountsAtMost)) {
      throw new Error(`Invalid reference rating row in ${path}: ${record.id}.expected.techniqueCountsAtMost must be an object.`);
    }
    for (const [technique, count] of Object.entries(record.expected.techniqueCountsAtMost)) {
      if (!technique || !Number.isInteger(count) || count < 0) {
        throw new Error(`Invalid reference rating row in ${path}: ${record.id}.expected.techniqueCountsAtMost has an invalid count.`);
      }
    }
  }
}

function assertNonEmptyString(value, label, path) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid reference rating row in ${path}: ${label} must be a non-empty string.`);
  }
}

function parseArgs(args) {
  const parsed = {
    inputPath: DEFAULT_INPUT,
    outputPath: null,
    json: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--json') {
      parsed.json = true;
      continue;
    }
    if (item === '--input') {
      parsed.inputPath = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--output') {
      parsed.outputPath = requireValue(args, index, item);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${item}`);
  }
  return parsed;
}

function requireValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function printHumanSummary(payload) {
  const summary = payload.summary;
  process.stdout.write(`Reference rating corpus: ${summary.passed}/${summary.total} passed in ${summary.elapsedMs}ms\n`);
  process.stdout.write(`${summary.note}\n`);
  for (const row of payload.rows) {
    const status = row.ok ? 'ok' : 'failed';
    const detail = row.issues.length > 0 ? ` (${row.issues.join(', ')})` : '';
    process.stdout.write(`- ${row.id}: ${status}, score=${row.score}, hardest=${row.hardestTechnique}, verified=${row.verifiedSteps}/${row.stepCount}${detail}\n`);
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
