#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  nextStep,
  parsePuzzle,
} from '../dist/src/index.js';

const BASE_PUZZLE = '534678912672195348198342567859761423426853791713924856961537284287419600345286100';
const BASE_CANDIDATES = [
  [79, [7, 9]],
  [80, [8, 9]],
];
const BRANCH_STOP_REASONS = new Set(['contradiction', 'no-step', 'step-limit', 'replay-error']);
const DEFAULT_FIXTURES = [
  { technique: 'forcing-nets', expectedAction: { type: 'place', cell: 80, digit: 9 }, minBranches: 2, expectedMaxSteps: 12, expectedSubtype: 'forcing-nets-shared-placement' },
  { technique: 'digit-forcing-chains', expectedAction: { type: 'place', cell: 80, digit: 9 }, minBranches: 2, expectedMaxSteps: 12, expectedSubtype: 'digit-forcing-chains-shared-placement' },
  { technique: 'nishio-forcing-chains', expectedAction: { type: 'eliminate', cell: 79, digit: 9 }, minBranches: 1, expectedMaxSteps: 0, expectedSubtype: 'nishio-forcing-chains-exact-contradiction' },
  { technique: 'cell-forcing-chains', expectedAction: { type: 'place', cell: 80, digit: 9 }, minBranches: 2, expectedMaxSteps: 12, expectedSubtype: 'cell-forcing-chains-shared-placement' },
  { technique: 'unit-forcing-chains', expectedAction: { type: 'place', cell: 79, digit: 7 }, minBranches: 2, expectedMaxSteps: 12, expectedSubtype: 'unit-forcing-chains-shared-placement' },
  { technique: 'region-forcing-chains', expectedAction: { type: 'place', cell: 79, digit: 7 }, minBranches: 2, expectedMaxSteps: 12, expectedSubtype: 'region-forcing-chains-shared-placement' },
  { technique: 'table-chain', expectedAction: { type: 'eliminate', cell: 79, digit: 9 }, minBranches: 1, expectedMaxSteps: 20, expectedSubtype: 'table-chain-candidate-contradiction' },
  { technique: 'dynamic-forcing-chains', expectedAction: { type: 'eliminate', cell: 79, digit: 9 }, minBranches: 1, expectedMaxSteps: 28, expectedSubtype: 'dynamic-forcing-chains-candidate-contradiction' },
  { technique: 'dynamic-forcing-chains-plus', expectedAction: { type: 'eliminate', cell: 79, digit: 9 }, minBranches: 1, expectedMaxSteps: 40, expectedSubtype: 'dynamic-forcing-chains-plus-candidate-contradiction' },
  { technique: 'bowmans-bingo', expectedAction: { type: 'eliminate', cell: 79, digit: 9 }, minBranches: 1, expectedMaxSteps: 16, expectedSubtype: 'bowmans-bingo-candidate-contradiction' },
  { technique: 'nested-forcing-chains', expectedAction: { type: 'eliminate', cell: 79, digit: 9 }, minBranches: 1, expectedMaxSteps: 18, expectedSubtype: 'nested-forcing-chains-candidate-contradiction' },
];

const options = parseArgs(process.argv.slice(2));
const startedAt = performance.now();
const state = buildTrustedState();
const rows = DEFAULT_FIXTURES.map((fixture) => auditFixture(state, fixture));
const failed = rows.filter((row) => !row.ok);
const stopReasonCounts = {};
let totalBranches = 0;
let truncatedBranches = 0;
let contradictionBranches = 0;
for (const row of rows) {
  totalBranches += row.branchCount;
  truncatedBranches += row.truncatedBranches;
  contradictionBranches += row.contradictionBranches;
  for (const [reason, count] of Object.entries(row.stopReasons)) {
    stopReasonCounts[reason] = (stopReasonCounts[reason] ?? 0) + count;
  }
}

const payload = {
  summary: {
    auditId: 'forcing-smoke-evidence.v1',
    fixtures: rows.length,
    passed: rows.length - failed.length,
    failed: failed.length,
    totalBranches,
    truncatedBranches,
    contradictionBranches,
    stopReasonCounts,
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

function auditFixture(state, fixture) {
  const issues = [];
  const step = nextStep(state, {
    allowContradictoryCandidateState: true,
    allowedTechniques: [fixture.technique],
  });

  if (!step) {
    issues.push('no-step');
    return buildRow(fixture, null, issues);
  }
  if (step.technique !== fixture.technique) {
    issues.push(`technique-mismatch:${step.technique}`);
  }
  if (step.evidence.pattern?.family !== 'forcing') {
    issues.push(`pattern-family:${step.evidence.pattern?.family ?? 'missing'}<expected:forcing`);
  }
  if (step.evidence.pattern?.subtype !== fixture.expectedSubtype) {
    issues.push(`pattern-subtype:${step.evidence.pattern?.subtype ?? 'missing'}<expected:${fixture.expectedSubtype}`);
  }
  if (!step.actions.some((action) =>
    action.type === fixture.expectedAction.type
    && action.cell === fixture.expectedAction.cell
    && action.digit === fixture.expectedAction.digit)) {
    issues.push(`missing-expected-action:${fixture.expectedAction.type}:${fixture.expectedAction.cell}:${fixture.expectedAction.digit}`);
  }

  const branches = step.evidence.branches ?? [];
  if (branches.length < fixture.minBranches) {
    issues.push(`insufficient-branches:${branches.length}<${fixture.minBranches}`);
  }

  for (const [index, branch] of branches.entries()) {
    validateBranch(branch, fixture, issues, index);
  }

  if (!branches.some((branch) => branch.contradiction === true || branch.exhausted === true)) {
    issues.push('missing-terminal-branch');
  }

  return buildRow(fixture, step, issues);
}

function validateBranch(branch, fixture, issues, index) {
  if (!isRecord(branch.assumption)) {
    issues.push(`branch-${index + 1}:missing-assumption`);
  }
  if (!Number.isInteger(branch.steps) || branch.steps < 0) {
    issues.push(`branch-${index + 1}:invalid-steps`);
  }
  if (branch.maxSteps !== fixture.expectedMaxSteps) {
    issues.push(`branch-${index + 1}:maxSteps:${branch.maxSteps}<expected:${fixture.expectedMaxSteps}`);
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

function buildRow(fixture, step, issues) {
  const branches = step?.evidence.branches ?? [];
  return {
    technique: fixture.technique,
    ok: issues.length === 0,
    issues,
    actionTypes: Array.from(new Set((step?.actions ?? []).map((action) => action.type))),
    pattern: step?.evidence.pattern ?? null,
    branchCount: branches.length,
    truncatedBranches: branches.filter((branch) => branch.truncated === true).length,
    contradictionBranches: branches.filter((branch) => branch.contradiction === true).length,
    stopReasons: countBy(branches.map((branch) => branch.stopReason ?? 'missing')),
    maxSteps: Array.from(new Set(branches.map((branch) => branch.maxSteps))).sort((left, right) => left - right),
    contradictionAtKinds: branches.map((branch) => branch.contradictionAt?.kind ?? null),
    actionCounts: branches.map((branch) => branch.actions?.length ?? 0),
  };
}

function buildTrustedState() {
  return {
    board: parsePuzzle(BASE_PUZZLE),
    constraints: {
      exactCandidatesMode: 'trusted',
      exactCandidates: BASE_CANDIDATES.map(([cell, digits]) => ({ cell, digits })),
    },
  };
}

function countBy(values) {
  const counts = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function parseArgs(args) {
  const parsed = {
    outputPath: null,
    json: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--json') {
      parsed.json = true;
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
  process.stdout.write(`Forcing smoke evidence: ${summary.passed}/${summary.fixtures} fixture(s) passed\n`);
  process.stdout.write(`Branches: ${summary.totalBranches}; truncated=${summary.truncatedBranches}; contradictions=${summary.contradictionBranches}\n`);
  process.stdout.write(`Stop reasons: ${Object.entries(summary.stopReasonCounts).map(([reason, count]) => `${reason}=${count}`).join(', ') || 'none'}\n`);
  for (const row of payload.rows.filter((item) => !item.ok)) {
    process.stdout.write(`- ${row.technique}: ${row.issues.join(', ')}\n`);
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
