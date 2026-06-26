#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  getRatingPolicy,
  getTechniqueDefinitions,
  rate,
} from '../dist/src/index.js';

const DEFAULT_INPUT = 'tests/fixtures/reference-techniques/reference-rating-corpus.json';
const BRANCH_STOP_REASONS = new Set(['contradiction', 'no-step', 'step-limit', 'replay-error']);

const options = parseArgs(process.argv.slice(2));
const startedAt = performance.now();
const definitions = new Map(getTechniqueDefinitions().map((definition) => [definition.id, definition]));
const fixture = loadFixture(options.inputPath);
const rows = [];
const stopReasonCounts = {};
let forcingSteps = 0;
let stepsWithBranches = 0;
let branchCount = 0;
let truncatedBranches = 0;
let contradictionBranches = 0;
let emptyActionSteps = 0;
let nonForcingPatternSteps = 0;

for (const record of fixture.rows) {
  const rating = rate(record.puzzle, getRatingPolicy(record.profile));
  for (const [stepIndex, step] of rating.steps.entries()) {
    if (!isForcingRelatedStep(step, definitions)) {
      continue;
    }
    const definition = definitions.get(step.technique);
    forcingSteps += 1;
    const branchIssues = [];
    const branches = step.evidence.branches ?? [];
    if (branches.length === 0) {
      branchIssues.push('missing-branches');
    } else {
      stepsWithBranches += 1;
    }
    if (step.actions.length === 0) {
      emptyActionSteps += 1;
      branchIssues.push('empty-actions');
    }
    if (definition?.family === 'forcing' && step.evidence.pattern?.family !== 'forcing') {
      nonForcingPatternSteps += 1;
      branchIssues.push(`pattern-family:${step.evidence.pattern?.family ?? 'missing'}<expected:forcing`);
    }
    for (const [branchIndex, branch] of branches.entries()) {
      branchCount += 1;
      validateBranch(branch, branchIssues, branchIndex);
      if (branch.truncated === true) {
        truncatedBranches += 1;
      }
      if (branch.contradiction === true) {
        contradictionBranches += 1;
      }
      if (typeof branch.stopReason === 'string') {
        stopReasonCounts[branch.stopReason] = (stopReasonCounts[branch.stopReason] ?? 0) + 1;
      }
    }
    rows.push({
      rowId: record.id,
      profile: record.profile,
      stepIndex: stepIndex + 1,
      technique: step.technique,
      ok: branchIssues.length === 0,
      issues: branchIssues,
      branchCount: branches.length,
      truncatedBranches: branches.filter((branch) => branch.truncated === true).length,
      stopReasons: countBy(branches.map((branch) => branch.stopReason ?? 'missing')),
      contradictionAtKinds: branches.map((branch) => branch.contradictionAt?.kind ?? null),
      maxSteps: branches.map((branch) => branch.maxSteps).filter((value) => Number.isInteger(value)),
      actionCount: step.actions.length,
      pattern: step.evidence.pattern ?? null,
    });
  }
}

const failed = rows.filter((row) => !row.ok);
const payload = {
  summary: {
    auditId: 'forcing-branch-evidence.v1',
    input: options.inputPath,
    corpusRows: fixture.rows.length,
    forcingSteps,
    stepsWithBranches,
    branchCount,
    truncatedBranches,
    contradictionBranches,
    emptyActionSteps,
    nonForcingPatternSteps,
    stopReasonCounts,
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

function isForcingRelatedStep(step, definitions) {
  const definition = definitions.get(step.technique);
  return definition?.family === 'forcing' || (step.evidence.branches?.length ?? 0) > 0;
}

function validateBranch(branch, issues, index) {
  if (!isRecord(branch.assumption)) {
    issues.push(`branch-${index + 1}:missing-assumption`);
  }
  if (!Number.isInteger(branch.steps) || branch.steps < 0) {
    issues.push(`branch-${index + 1}:invalid-steps`);
  }
  if (!Number.isInteger(branch.maxSteps) || branch.maxSteps < 0) {
    issues.push(`branch-${index + 1}:invalid-maxSteps`);
  }
  if (typeof branch.truncated !== 'boolean') {
    issues.push(`branch-${index + 1}:invalid-truncated`);
  }
  if (typeof branch.contradiction !== 'boolean') {
    issues.push(`branch-${index + 1}:invalid-contradiction`);
  }
  if (typeof branch.exhausted !== 'boolean') {
    issues.push(`branch-${index + 1}:invalid-exhausted`);
  }
  if (typeof branch.stopReason !== 'string' || !BRANCH_STOP_REASONS.has(branch.stopReason)) {
    issues.push(`branch-${index + 1}:invalid-stopReason`);
  }
  if (branch.truncated === true && branch.stopReason !== 'step-limit') {
    issues.push(`branch-${index + 1}:truncated-without-step-limit`);
  }
  if (branch.contradiction === true && branch.stopReason !== 'contradiction') {
    issues.push(`branch-${index + 1}:contradiction-stop-mismatch`);
  }
  if (branch.contradiction === true && !isRecord(branch.contradictionAt)) {
    issues.push(`branch-${index + 1}:missing-contradictionAt`);
  }
}

function countBy(values) {
  const counts = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function loadFixture(path) {
  const parsed = JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
  if (!isRecord(parsed) || !Array.isArray(parsed.rows)) {
    throw new Error('Input must be a JSON object with a rows array.');
  }
  return parsed;
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
  process.stdout.write(`Forcing branch evidence: ${summary.passed}/${summary.forcingSteps} forcing-related step(s) passed\n`);
  process.stdout.write(`Branches: ${summary.branchCount}; truncated=${summary.truncatedBranches}; contradictions=${summary.contradictionBranches}; emptyActions=${summary.emptyActionSteps}; nonForcingPatterns=${summary.nonForcingPatternSteps}\n`);
  process.stdout.write(`Stop reasons: ${Object.entries(summary.stopReasonCounts).map(([reason, count]) => `${reason}=${count}`).join(', ') || 'none'}\n`);
  for (const row of payload.rows.filter((item) => !item.ok)) {
    process.stdout.write(`- ${row.rowId} step ${row.stepIndex} ${row.technique}: ${row.issues.join(', ')}\n`);
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
