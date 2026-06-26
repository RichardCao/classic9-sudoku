#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  getRatingPolicy,
  parsePuzzle,
  rate,
} from '../dist/src/index.js';

const DEFAULT_INPUT = 'tests/fixtures/reference-techniques/reference-rating-corpus.json';
const FISH_TECHNIQUES = new Set([
  'x-wing',
  'swordfish',
  'franken-swordfish',
  'jellyfish',
  'finned-x-wing',
  'sashimi-x-wing',
  'finned-swordfish',
  'finned-jellyfish',
  'sashimi-swordfish',
  'sashimi-jellyfish',
  'finned-franken-swordfish',
  'finned-franken-jellyfish',
  'larger-fish',
  'mutant-fish',
]);

const options = parseArgs(process.argv.slice(2));
const startedAt = performance.now();
const fixture = loadFixture(options.inputPath);
const selectedRows = fixture.rows.slice(0, options.maxRows ?? fixture.rows.length);
const rows = selectedRows.map((record) => auditRecord(record));
const fishRows = rows.filter((row) => row.fishSteps > 0);
const failed = rows.filter((row) => !row.ok);
const fishSteps = rows.reduce((sum, row) => sum + row.fishSteps, 0);
const payload = {
  summary: {
    auditId: 'fish-evidence.v1',
    input: options.inputPath,
    scannedRows: rows.length,
    rowsWithFish: fishRows.length,
    fishSteps,
    eliminationActions: rows.reduce((sum, row) => sum + row.eliminationActions, 0),
    solutionUnsafeActions: rows.reduce((sum, row) => sum + row.solutionUnsafeActions, 0),
    patternMismatches: rows.reduce((sum, row) => sum + row.patternMismatches, 0),
    missingEvidenceRows: rows.filter((row) => row.missingEvidence).length,
    techniqueCounts: countBy(rows.flatMap((row) => row.techniques)),
    subtypeCounts: countBy(rows.flatMap((row) => row.subtypes)),
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
  const issues = [];
  const solution = parsePuzzle(record.solution);
  const rating = rate(record.puzzle, buildRatingPolicy(record));
  const fishSteps = [];
  for (const [stepIndex, step] of rating.steps.entries()) {
    if (!FISH_TECHNIQUES.has(step.technique)) {
      continue;
    }
    fishSteps.push({ stepIndex: stepIndex + 1, step });
  }

  const techniques = [];
  const subtypes = [];
  let eliminationActions = 0;
  let solutionUnsafeActions = 0;
  let patternMismatches = 0;
  let missingEvidence = false;

  for (const { stepIndex, step } of fishSteps) {
    techniques.push(step.technique);
    if (step.evidence.pattern?.subtype) {
      subtypes.push(step.evidence.pattern.subtype);
    }
    if (step.evidence.pattern?.family !== 'fish') {
      patternMismatches += 1;
      issues.push(`pattern-family-mismatch:${stepIndex}:${step.technique}:${step.evidence.pattern?.family ?? 'missing'}`);
    }
    if ((step.evidence.houses?.length ?? 0) === 0 || step.evidence.cells.length === 0) {
      missingEvidence = true;
      issues.push(`missing-fish-evidence:${stepIndex}:${step.technique}`);
    }
    for (const action of step.actions) {
      if (action.type !== 'eliminate') {
        issues.push(`non-elimination-action:${stepIndex}:${step.technique}:${action.type}`);
        continue;
      }
      eliminationActions += 1;
      if (solution[action.cell] === action.digit) {
        solutionUnsafeActions += 1;
        issues.push(`eliminates-solution:${stepIndex}:${step.technique}:${action.cell}:${action.digit}`);
      }
    }
    if (step.actions.length === 0) {
      issues.push(`empty-actions:${stepIndex}:${step.technique}`);
    }
  }

  return {
    id: record.id,
    ok: issues.length === 0,
    issues,
    fishSteps: fishSteps.length,
    techniques,
    subtypes,
    eliminationActions,
    solutionUnsafeActions,
    patternMismatches,
    missingEvidence,
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
    id: `${policy.id}:fish-evidence`,
    techniqueOrder: [
      ...record.targetFirstTechniques,
      ...primary.filter((technique) => !targetSet.has(technique)),
      ...fallback.filter((technique) => !targetSet.has(technique)),
    ],
    fallbackTechniques: fallback.filter((technique) => !targetSet.has(technique)),
  };
}

function loadFixture(path) {
  const parsed = JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
  if (!isRecord(parsed) || parsed.corpusId !== 'reference-rating-corpus.v1' || parsed.corpusKind !== 'reference-rating' || !Array.isArray(parsed.rows)) {
    throw new Error(`Invalid reference rating corpus file: ${path}`);
  }
  return parsed;
}

function parseArgs(args) {
  const parsed = {
    inputPath: DEFAULT_INPUT,
    outputPath: null,
    maxRows: null,
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
    if (item === '--max-rows') {
      const value = Number(requireValue(args, index, item));
      if (!Number.isInteger(value) || value < 0) {
        throw new Error('--max-rows must be a non-negative integer.');
      }
      parsed.maxRows = value;
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

function countBy(values) {
  const counts = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function printHumanSummary(payload) {
  const summary = payload.summary;
  process.stdout.write(`Fish evidence: ${summary.fishSteps} fish step(s) across ${summary.rowsWithFish}/${summary.scannedRows} row(s)\n`);
  process.stdout.write(`Eliminations: ${summary.eliminationActions}; solutionUnsafe=${summary.solutionUnsafeActions}; patternMismatches=${summary.patternMismatches}; missingEvidenceRows=${summary.missingEvidenceRows}\n`);
  process.stdout.write(`Technique counts: ${Object.entries(summary.techniqueCounts).map(([id, count]) => `${id}=${count}`).join(', ') || 'none'}\n`);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
