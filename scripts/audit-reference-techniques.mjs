#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  nextStep,
  parsePuzzle,
  replaySteps,
} from '../dist/src/index.js';

const EMPTY_GRID = '000000000000000000000000000000000000000000000000000000000000000000000000000000000';
const DEFAULT_INPUT = 'tests/fixtures/reference-techniques/reference-smoke.json';
const DIRECT_TECHNIQUES = new Set(['direct-pointing', 'direct-claiming', 'direct-hidden-pair', 'direct-hidden-triplet']);
const CHAIN_TECHNIQUES = new Set(['bidirectional-x-cycle', 'forcing-x-chain', 'bidirectional-y-cycle', 'forcing-chain']);
const REFERENCE_TECHNIQUE_ORDER = Object.freeze([
  ...DIRECT_TECHNIQUES,
  ...CHAIN_TECHNIQUES,
]);

const options = parseArgs(process.argv.slice(2));
const inputPath = resolve(process.cwd(), options.inputPath);
const fixture = loadFixture(inputPath);
const startedAt = performance.now();

const rows = [
  ...fixture.direct.map((record) => auditDirect(record)),
  ...fixture.chains.map((record) => auditChain(record)),
];
const failed = rows.filter((row) => !row.ok);
const payload = {
  summary: {
    auditId: 'reference-techniques.v1',
    corpusKind: 'reference-smoke',
    note: 'Lightweight reference smoke fixtures; not a full external rating corpus.',
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

function auditDirect(record) {
  const started = performance.now();
  const state = buildExactCandidateState(record.candidates);
  const step = nextStepForTechnique(state, record.technique);
  const issues = [];
  if (!step) {
    issues.push('no-step');
  } else {
    if (step.technique !== record.technique) {
      issues.push(`technique-mismatch:${step.technique}`);
    }
    if (!hasAction(step, 'eliminate', record.expectedElimination)) {
      issues.push('missing-expected-elimination');
    }
    if (!hasAction(step, 'place', record.expectedPlacement)) {
      issues.push('missing-expected-placement');
    }
    try {
      const replayed = replaySteps(state, [step]);
      if (replayed[record.expectedPlacement.cell] !== record.expectedPlacement.digit) {
        issues.push('replay-placement-mismatch');
      }
    } catch (error) {
      issues.push(`replay-failed:${formatError(error)}`);
    }
  }
  return {
    technique: record.technique,
    kind: 'direct',
    ok: issues.length === 0,
    issues,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function auditChain(record) {
  const started = performance.now();
  const state = record.stateKind === 'exact'
    ? buildExactCandidateState(record.candidates)
    : buildCandidateMaskState(record.candidates);
  const step = nextStepForTechnique(state, record.technique);
  const issues = [];
  if (!step) {
    issues.push('no-step');
  } else {
    if (step.technique !== record.technique) {
      issues.push(`technique-mismatch:${step.technique}`);
    }
    if ((step.evidence.links?.length ?? 0) < record.minLinks) {
      issues.push('insufficient-links');
    }
    if (step.actions.length === 0) {
      issues.push('empty-actions');
    }
    try {
      replaySteps(state, [step]);
    } catch (error) {
      issues.push(`replay-failed:${formatError(error)}`);
    }
  }
  return {
    technique: record.technique,
    kind: 'chain',
    ok: issues.length === 0,
    issues,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function nextStepForTechnique(state, technique) {
  return nextStep(state, {
    allowedTechniques: REFERENCE_TECHNIQUE_ORDER,
    fallbackTechniques: [],
    allowContradictoryCandidateState: true,
    preferredTechniques: [technique],
  });
}

function buildExactCandidateState(overrides) {
  const byCell = new Map(overrides);
  return {
    board: parsePuzzle(EMPTY_GRID),
    constraints: {
      exactCandidates: Array.from({ length: 81 }, (_, cell) => ({
        cell,
        digits: byCell.get(cell) ?? [8, 9],
      })),
    },
  };
}

function buildCandidateMaskState(overrides) {
  const candidateMasks = new Array(81).fill(0);
  for (const [cell, digits] of overrides) {
    candidateMasks[cell] = digits.reduce((mask, digit) => mask | (1 << (digit - 1)), 0);
  }
  return {
    board: parsePuzzle(EMPTY_GRID),
    candidateMasks,
  };
}

function hasAction(step, type, expected) {
  return step.actions.some((action) =>
    action.type === type
    && action.cell === expected.cell
    && action.digit === expected.digit,
  );
}

function loadFixture(path) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.direct) || !Array.isArray(parsed.chains)) {
    throw new Error(`Invalid reference fixture file: ${path}`);
  }
  for (const record of parsed.direct) {
    assertDirectRecord(record, path);
  }
  for (const record of parsed.chains) {
    assertChainRecord(record, path);
  }
  return parsed;
}

function assertDirectRecord(record, path) {
  if (!isRecord(record)) {
    throw new Error(`Invalid reference direct fixture in ${path}: record must be an object.`);
  }
  if (!DIRECT_TECHNIQUES.has(record.technique)) {
    throw new Error(`Invalid reference direct fixture in ${path}: unknown technique ${String(record.technique)}.`);
  }
  assertCandidateTuples(record.candidates, `${record.technique} candidates`);
  assertCellDigitRef(record.expectedElimination, `${record.technique} expectedElimination`);
  assertCellDigitRef(record.expectedPlacement, `${record.technique} expectedPlacement`);
}

function assertChainRecord(record, path) {
  if (!isRecord(record)) {
    throw new Error(`Invalid reference chain fixture in ${path}: record must be an object.`);
  }
  if (!CHAIN_TECHNIQUES.has(record.technique)) {
    throw new Error(`Invalid reference chain fixture in ${path}: unknown technique ${String(record.technique)}.`);
  }
  if (record.stateKind !== 'exact' && record.stateKind !== 'mask') {
    throw new Error(`Invalid reference chain fixture in ${path}: ${record.technique} stateKind must be exact or mask.`);
  }
  assertCandidateTuples(record.candidates, `${record.technique} candidates`);
  if (!Number.isInteger(record.minLinks) || record.minLinks < 1) {
    throw new Error(`Invalid reference chain fixture in ${path}: ${record.technique} minLinks must be a positive integer.`);
  }
}

function assertCandidateTuples(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid reference fixture: ${label} must be an array.`);
  }
  const seenCells = new Set();
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new Error(`Invalid reference fixture: ${label} entries must be [cell, digits] tuples.`);
    }
    const [cell, digits] = entry;
    if (!Number.isInteger(cell) || cell < 0 || cell >= 81) {
      throw new Error(`Invalid reference fixture: ${label} cell must be 0..80.`);
    }
    if (seenCells.has(cell)) {
      throw new Error(`Invalid reference fixture: ${label} repeats cell ${cell}.`);
    }
    seenCells.add(cell);
    if (!Array.isArray(digits) || digits.length === 0) {
      throw new Error(`Invalid reference fixture: ${label} digits must be a non-empty array.`);
    }
    for (const digit of digits) {
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) {
        throw new Error(`Invalid reference fixture: ${label} digit must be 1..9.`);
      }
    }
  }
}

function assertCellDigitRef(value, label) {
  if (!isRecord(value)) {
    throw new Error(`Invalid reference fixture: ${label} must be an object.`);
  }
  if (!Number.isInteger(value.cell) || value.cell < 0 || value.cell >= 81) {
    throw new Error(`Invalid reference fixture: ${label}.cell must be 0..80.`);
  }
  if (!Number.isInteger(value.digit) || value.digit < 1 || value.digit > 9) {
    throw new Error(`Invalid reference fixture: ${label}.digit must be 1..9.`);
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  process.stdout.write(`Reference technique smoke: ${summary.passed}/${summary.total} passed in ${summary.elapsedMs}ms\n`);
  process.stdout.write(`${summary.note}\n`);
  for (const row of payload.rows) {
    const status = row.ok ? 'ok' : 'failed';
    const detail = row.issues.length > 0 ? ` (${row.issues.join(', ')})` : '';
    process.stdout.write(`- ${row.technique}: ${status}${detail}\n`);
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
