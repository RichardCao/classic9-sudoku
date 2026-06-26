#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  nextStep,
  parsePuzzle,
  replaySteps,
  verifyStep,
} from '../dist/src/index.js';

const EMPTY_GRID = '000000000000000000000000000000000000000000000000000000000000000000000000000000000';
const DEFAULT_INPUT = 'tests/fixtures/reference-techniques/reference-smoke.json';
const DIRECT_TECHNIQUES = new Set(['direct-pointing', 'direct-claiming', 'direct-hidden-pair', 'direct-hidden-triplet']);
const BASIC_TECHNIQUES = new Set([
  'full-house',
  'naked-single',
  'hidden-single',
  'locked-candidates',
  'naked-pair',
  'hidden-pair',
  'naked-triple',
  'hidden-triple',
  'naked-quad',
  'hidden-quad',
]);
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
const CHAIN_TECHNIQUES = new Set([
  'bidirectional-x-cycle',
  'simple-coloring',
  'forcing-x-chain',
  'x-chain',
  'x-coloring',
  'bidirectional-y-cycle',
  'xy-chain',
  'multi-colors',
  'three-d-medusa',
  'grouped-x-cycles',
  'forcing-chain',
  'aic',
  'aic-exotic',
  'grouped-aic',
  'skyscraper',
  'two-string-kite',
  'turbot-fish',
  'empty-rectangle',
]);
const FORCING_TECHNIQUES = new Set([
  'forcing-nets',
  'digit-forcing-chains',
  'nishio-forcing-chains',
  'cell-forcing-chains',
  'unit-forcing-chains',
  'region-forcing-chains',
  'table-chain',
  'dynamic-forcing-chains',
  'dynamic-forcing-chains-plus',
  'bowmans-bingo',
  'nested-forcing-chains',
]);
const WING_TECHNIQUES = new Set([
  'xy-wing',
  'xyz-wing',
  'wxyz-wing',
  'w-wing',
  'big-wings',
  'chute-remote-pairs',
  'remote-pairs',
]);
const ALS_TECHNIQUES = new Set([
  'almost-locked-pair',
  'almost-locked-triple',
  'almost-locked-quad',
  'als-xz',
  'als-xy-wing',
  'aic-als',
  'fireworks',
  'twinned-xy-chains',
  'aligned-pair-exclusion',
  'death-blossom',
  'sue-de-coq',
]);
const PATTERN_TECHNIQUES = new Set([
  'exocet',
  'double-exocet',
  'pattern-overlay',
  'tridagons',
  'sk-loops',
]);
const UNIQUENESS_TECHNIQUES = new Set([
  'unique-rectangle',
  'avoidable-rectangle',
  'rectangle-elimination',
  'extended-rectangle',
  'unique-loop',
  'hidden-unique-rectangle',
  'aic-ur',
  'bug-plus-one',
  'bug-plus-two',
  'bug-plus-n',
]);
const REFERENCE_TECHNIQUE_ORDER = Object.freeze([
  ...BASIC_TECHNIQUES,
  ...DIRECT_TECHNIQUES,
  ...FISH_TECHNIQUES,
  ...CHAIN_TECHNIQUES,
  ...FORCING_TECHNIQUES,
  ...WING_TECHNIQUES,
  ...ALS_TECHNIQUES,
  ...PATTERN_TECHNIQUES,
  ...UNIQUENESS_TECHNIQUES,
]);
const CONTEXT_DEPENDENT_VERIFICATION_CODES = new Set([
  'initial-state-contradiction',
  'action-causes-empty-cell',
  'action-causes-homeless-digit',
  'action-causes-duplicate-digit',
]);

const options = parseArgs(process.argv.slice(2));
const inputPath = resolve(process.cwd(), options.inputPath);
const fixture = loadFixture(inputPath);
const startedAt = performance.now();

const rows = [
  ...(fixture.basics ?? []).map((record) => auditBasic(record)),
  ...fixture.direct.map((record) => auditDirect(record)),
  ...(fixture.fish ?? []).map((record) => auditFish(record)),
  ...fixture.chains.map((record) => auditChain(record)),
  ...(fixture.forcing ?? []).map((record) => auditForcing(record)),
  ...(fixture.wings ?? []).map((record) => auditWing(record)),
  ...(fixture.als ?? []).map((record) => auditAls(record)),
  ...(fixture.patterns ?? []).map((record) => auditPattern(record)),
  ...fixture.uniqueness.map((record) => auditUniqueness(record)),
  ...(fixture.negative ?? []).map((record) => auditNegative(record)),
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
  const state = buildDirectState(record);
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
    auditStepVerification(state, step, issues);
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

function auditBasic(record) {
  const started = performance.now();
  const state = buildBasicState(record);
  const step = nextStepForTechnique(state, record.technique);
  const issues = [];
  if (!step) {
    issues.push('no-step');
  } else {
    if (step.technique !== record.technique) {
      issues.push(`technique-mismatch:${step.technique}`);
    }
    for (const expected of record.expectedEliminations ?? []) {
      if (!hasAction(step, 'eliminate', expected)) {
        issues.push(`missing-expected-elimination:${expected.cell}:${expected.digit}`);
      }
    }
    for (const expected of record.expectedPlacements ?? []) {
      if (!hasAction(step, 'place', expected)) {
        issues.push(`missing-expected-placement:${expected.cell}:${expected.digit}`);
      }
    }
    if (record.expectedPattern) {
      const pattern = step.evidence.pattern;
      if (!pattern || pattern.family !== record.expectedPattern.family || pattern.subtype !== record.expectedPattern.subtype) {
        issues.push('pattern-mismatch');
      }
    }
    for (const expected of record.expectedCells ?? []) {
      if (!hasExpectedCell(step, expected)) {
        issues.push(`missing-expected-cell:${expected.cell}`);
      }
    }
    for (const expected of record.expectedHouses ?? []) {
      if (!hasExpectedHouse(step, expected)) {
        issues.push(`missing-expected-house:${expected.type}:${expected.index}`);
      }
    }
    if (step.actions.length === 0) {
      issues.push('empty-actions');
    }
    auditStepVerification(state, step, issues);
    try {
      replaySteps(state, [step]);
    } catch (error) {
      issues.push(`replay-failed:${formatError(error)}`);
    }
  }
  return {
    technique: record.technique,
    kind: 'basic',
    ok: issues.length === 0,
    issues,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function buildDirectState(record) {
  if (record.stateKind === 'puzzle') {
    return parsePuzzle(record.puzzle);
  }
  return buildExactCandidateState(record.candidates);
}

function buildBasicState(record) {
  if (record.stateKind === 'puzzle') {
    return parsePuzzle(record.puzzle);
  }
  if (record.stateKind === 'mask') {
    return buildCandidateMaskState(record.candidates);
  }
  return buildExactCandidateState(record.candidates);
}

function auditFish(record) {
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
    for (const expected of record.expectedEliminations) {
      if (!hasAction(step, 'eliminate', expected)) {
        issues.push(`missing-expected-elimination:${expected.cell}:${expected.digit}`);
      }
    }
    if (record.expectedPattern) {
      const pattern = step.evidence.pattern;
      if (!pattern || pattern.family !== record.expectedPattern.family || pattern.subtype !== record.expectedPattern.subtype) {
        issues.push('pattern-mismatch');
      }
    }
    if (record.minLinks !== undefined && (step.evidence.links?.length ?? 0) < record.minLinks) {
      issues.push(`insufficient-links:${step.evidence.links?.length ?? 0}<${record.minLinks}`);
    }
    if (record.minNodes !== undefined && (step.evidence.nodes?.length ?? 0) < record.minNodes) {
      issues.push(`insufficient-nodes:${step.evidence.nodes?.length ?? 0}<${record.minNodes}`);
    }
    for (const expected of record.expectedLinks ?? []) {
      if (!hasExpectedLink(step, expected)) {
        issues.push(`missing-expected-link:${expected.from}:${expected.to}`);
      }
    }
    for (const expected of record.expectedCells ?? []) {
      if (!hasExpectedCell(step, expected)) {
        issues.push(`missing-expected-cell:${expected.cell}`);
      }
    }
    for (const expected of record.expectedHouses ?? []) {
      if (!hasExpectedHouse(step, expected)) {
        issues.push(`missing-expected-house:${expected.type}:${expected.index}`);
      }
    }
    if (step.actions.length === 0) {
      issues.push('empty-actions');
    }
    auditStepVerification(state, step, issues);
    try {
      replaySteps(state, [step]);
    } catch (error) {
      issues.push(`replay-failed:${formatError(error)}`);
    }
  }
  return {
    technique: record.technique,
    kind: 'fish',
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
    if (record.minLinks !== undefined && (step.evidence.links?.length ?? 0) < record.minLinks) {
      issues.push(`insufficient-links:${step.evidence.links?.length ?? 0}<${record.minLinks}`);
    }
    for (const expected of record.expectedEliminations ?? []) {
      if (!hasAction(step, 'eliminate', expected)) {
        issues.push(`missing-expected-elimination:${expected.cell}:${expected.digit}`);
      }
    }
    for (const expected of record.expectedPlacements ?? []) {
      if (!hasAction(step, 'place', expected)) {
        issues.push(`missing-expected-placement:${expected.cell}:${expected.digit}`);
      }
    }
    if (record.minStrongLinks !== undefined && countLinksByType(step, 'strong') < record.minStrongLinks) {
      issues.push(`insufficient-strong-links:${countLinksByType(step, 'strong')}<${record.minStrongLinks}`);
    }
    if (record.minWeakLinks !== undefined && countLinksByType(step, 'weak') < record.minWeakLinks) {
      issues.push(`insufficient-weak-links:${countLinksByType(step, 'weak')}<${record.minWeakLinks}`);
    }
    if (record.minGroupedNodes !== undefined && countGroupedNodes(step) < record.minGroupedNodes) {
      issues.push(`insufficient-grouped-nodes:${countGroupedNodes(step)}<${record.minGroupedNodes}`);
    }
    if (record.expectedPattern) {
      const pattern = step.evidence.pattern;
      if (!pattern || pattern.family !== record.expectedPattern.family) {
        issues.push('pattern-mismatch');
      }
      if (record.expectedPattern.subtype !== undefined && pattern?.subtype !== record.expectedPattern.subtype) {
        issues.push('pattern-mismatch');
      }
    }
    for (const expected of record.expectedLinks ?? []) {
      if (!hasExpectedLink(step, expected)) {
        issues.push(`missing-expected-link:${expected.from}:${expected.to}`);
      }
    }
    for (const expected of record.expectedNodes ?? []) {
      if (!hasExpectedNode(step, expected)) {
        issues.push(`missing-expected-node:${expected.id}`);
      }
    }
    for (const expected of record.expectedCells ?? []) {
      if (!hasExpectedCell(step, expected)) {
        issues.push(`missing-expected-cell:${expected.cell}`);
      }
    }
    if (step.actions.length === 0) {
      issues.push('empty-actions');
    }
    auditStepVerification(state, step, issues);
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

function auditWing(record) {
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
    for (const expected of record.expectedEliminations) {
      if (!hasAction(step, 'eliminate', expected)) {
        issues.push(`missing-expected-elimination:${expected.cell}:${expected.digit}`);
      }
    }
    if (record.expectedPattern) {
      const pattern = step.evidence.pattern;
      if (!pattern || pattern.family !== record.expectedPattern.family) {
        issues.push('pattern-mismatch');
      }
      if (record.expectedPattern.subtype !== undefined && pattern?.subtype !== record.expectedPattern.subtype) {
        issues.push('pattern-mismatch');
      }
    }
    if (record.minLinks !== undefined && (step.evidence.links?.length ?? 0) < record.minLinks) {
      issues.push(`insufficient-links:${step.evidence.links?.length ?? 0}<${record.minLinks}`);
    }
    for (const expected of record.expectedLinks ?? []) {
      if (!hasExpectedLink(step, expected)) {
        issues.push(`missing-expected-link:${expected.from}:${expected.to}`);
      }
    }
    for (const expected of record.expectedCells ?? []) {
      if (!hasExpectedCell(step, expected)) {
        issues.push(`missing-expected-cell:${expected.cell}`);
      }
    }
    auditStepVerification(state, step, issues);
    try {
      replaySteps(state, [step]);
    } catch (error) {
      issues.push(`replay-failed:${formatError(error)}`);
    }
  }
  return {
    technique: record.technique,
    kind: 'wing',
    ok: issues.length === 0,
    issues,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function auditAls(record) {
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
    for (const expected of record.expectedEliminations) {
      if (!hasAction(step, 'eliminate', expected)) {
        issues.push(`missing-expected-elimination:${expected.cell}:${expected.digit}`);
      }
    }
    if (record.expectedPattern) {
      const pattern = step.evidence.pattern;
      if (!pattern || pattern.family !== record.expectedPattern.family || pattern.subtype !== record.expectedPattern.subtype) {
        issues.push('pattern-mismatch');
      }
    }
    if (record.minLinks !== undefined && (step.evidence.links?.length ?? 0) < record.minLinks) {
      issues.push(`insufficient-links:${step.evidence.links?.length ?? 0}<${record.minLinks}`);
    }
    if (record.minNodes !== undefined && (step.evidence.nodes?.length ?? 0) < record.minNodes) {
      issues.push(`insufficient-nodes:${step.evidence.nodes?.length ?? 0}<${record.minNodes}`);
    }
    for (const expected of record.expectedLinks ?? []) {
      if (!hasExpectedLink(step, expected)) {
        issues.push(`missing-expected-link:${expected.from}:${expected.to}`);
      }
    }
    for (const expected of record.expectedNodes ?? []) {
      if (!hasExpectedNode(step, expected)) {
        issues.push(`missing-expected-node:${expected.id}`);
      }
    }
    for (const expected of record.expectedNoteIncludes ?? []) {
      if (!step.evidence.note?.includes(expected)) {
        issues.push(`missing-expected-note:${expected}`);
      }
    }
    if (step.actions.length === 0) {
      issues.push('empty-actions');
    }
    auditStepVerification(state, step, issues);
    try {
      replaySteps(state, [step]);
    } catch (error) {
      issues.push(`replay-failed:${formatError(error)}`);
    }
  }
  return {
    technique: record.technique,
    kind: 'als',
    ok: issues.length === 0,
    issues,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function auditPattern(record) {
  const started = performance.now();
  const state = buildPatternState(record);
  const step = nextStepForTechnique(state, record.technique);
  const issues = [];
  if (!step) {
    issues.push('no-step');
  } else {
    if (step.technique !== record.technique) {
      issues.push(`technique-mismatch:${step.technique}`);
    }
    for (const expected of record.expectedEliminations ?? []) {
      if (!hasAction(step, 'eliminate', expected)) {
        issues.push(`missing-expected-elimination:${expected.cell}:${expected.digit}`);
      }
    }
    for (const expected of record.expectedPlacements ?? []) {
      if (!hasAction(step, 'place', expected)) {
        issues.push(`missing-expected-placement:${expected.cell}:${expected.digit}`);
      }
    }
    if (record.expectedPattern) {
      const pattern = step.evidence.pattern;
      if (!pattern || pattern.family !== record.expectedPattern.family) {
        issues.push('pattern-mismatch');
      }
      if (record.expectedPattern.subtype !== undefined && pattern?.subtype !== record.expectedPattern.subtype) {
        issues.push('pattern-mismatch');
      }
    }
    if (record.minNodes !== undefined && (step.evidence.nodes?.length ?? 0) < record.minNodes) {
      issues.push(`insufficient-nodes:${step.evidence.nodes?.length ?? 0}<${record.minNodes}`);
    }
    for (const expected of record.expectedNodes ?? []) {
      if (!hasExpectedNode(step, expected)) {
        issues.push(`missing-expected-node:${expected.id}`);
      }
    }
    if (step.actions.length === 0) {
      issues.push('empty-actions');
    }
    auditStepVerification(state, step, issues);
    try {
      replaySteps(state, [step]);
    } catch (error) {
      issues.push(`replay-failed:${formatError(error)}`);
    }
  }
  return {
    technique: record.technique,
    kind: 'pattern',
    ok: issues.length === 0,
    issues,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function buildPatternState(record) {
  if (record.stateKind === 'exact') {
    return buildExactCandidateState(record.candidates);
  }
  if (record.stateKind === 'mask') {
    return buildCandidateMaskState(record.candidates);
  }
  return buildTrustedCandidateState(record.puzzle, record.candidates);
}

function auditUniqueness(record) {
  const started = performance.now();
  const state = buildUniquenessState(record);
  const step = nextStepForTechnique(state, record.technique);
  const issues = [];
  if (!step) {
    issues.push('no-step');
  } else {
    if (step.technique !== record.technique) {
      issues.push(`technique-mismatch:${step.technique}`);
    }
    for (const expected of record.expectedEliminations ?? []) {
      if (!hasAction(step, 'eliminate', expected)) {
        issues.push(`missing-expected-elimination:${expected.cell}:${expected.digit}`);
      }
    }
    for (const expected of record.expectedPlacements ?? []) {
      if (!hasAction(step, 'place', expected)) {
        issues.push(`missing-expected-placement:${expected.cell}:${expected.digit}`);
      }
    }
    if (record.expectedPattern) {
      const pattern = step.evidence.pattern;
      if (!pattern || pattern.family !== record.expectedPattern.family) {
        issues.push('pattern-mismatch');
      }
      if (record.expectedPattern.subtype !== undefined && pattern?.subtype !== record.expectedPattern.subtype) {
        issues.push('pattern-mismatch');
      }
    }
    if (record.minLinks !== undefined && (step.evidence.links?.length ?? 0) < record.minLinks) {
      issues.push(`insufficient-links:${step.evidence.links?.length ?? 0}<${record.minLinks}`);
    }
    if (record.minNodes !== undefined && (step.evidence.nodes?.length ?? 0) < record.minNodes) {
      issues.push(`insufficient-nodes:${step.evidence.nodes?.length ?? 0}<${record.minNodes}`);
    }
    for (const expected of record.expectedNodes ?? []) {
      if (!hasExpectedNode(step, expected)) {
        issues.push(`missing-expected-node:${expected.id}`);
      }
    }
    auditStepVerification(state, step, issues);
    try {
      replaySteps(state, [step]);
    } catch (error) {
      issues.push(`replay-failed:${formatError(error)}`);
    }
  }
  return {
    technique: record.technique,
    kind: 'uniqueness',
    ok: issues.length === 0,
    issues,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function auditForcing(record) {
  const started = performance.now();
  const state = buildForcingState(record);
  const step = nextStepForTechnique(state, record.technique);
  const issues = [];
  if (!step) {
    issues.push('no-step');
  } else {
    if (step.technique !== record.technique) {
      issues.push(`technique-mismatch:${step.technique}`);
    }
    for (const expected of record.expectedEliminations ?? []) {
      if (!hasAction(step, 'eliminate', expected)) {
        issues.push(`missing-expected-elimination:${expected.cell}:${expected.digit}`);
      }
    }
    for (const expected of record.expectedPlacements ?? []) {
      if (!hasAction(step, 'place', expected)) {
        issues.push(`missing-expected-placement:${expected.cell}:${expected.digit}`);
      }
    }
    if (record.expectedPattern) {
      const pattern = step.evidence.pattern;
      if (!pattern || pattern.family !== record.expectedPattern.family) {
        issues.push('pattern-mismatch');
      }
      if (record.expectedPattern.subtype !== undefined && pattern?.subtype !== record.expectedPattern.subtype) {
        issues.push('pattern-mismatch');
      }
    }
    if (record.minBranches !== undefined && (step.evidence.branches?.length ?? 0) < record.minBranches) {
      issues.push(`insufficient-branches:${step.evidence.branches?.length ?? 0}<${record.minBranches}`);
    }
    if (record.minContradictionBranches !== undefined && countBranchesByFlag(step, 'contradiction') < record.minContradictionBranches) {
      issues.push(`insufficient-contradiction-branches:${countBranchesByFlag(step, 'contradiction')}<${record.minContradictionBranches}`);
    }
    if (record.expectedMaxSteps !== undefined) {
      for (const branch of step.evidence.branches ?? []) {
        if (branch.maxSteps !== record.expectedMaxSteps) {
          issues.push(`max-steps-mismatch:${branch.maxSteps}<${record.expectedMaxSteps}`);
        }
      }
    }
    if (step.actions.length === 0) {
      issues.push('empty-actions');
    }
    auditStepVerification(state, step, issues);
    try {
      replaySteps(state, [step]);
    } catch (error) {
      issues.push(`replay-failed:${formatError(error)}`);
    }
  }
  return {
    technique: record.technique,
    kind: 'forcing',
    ok: issues.length === 0,
    issues,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function auditNegative(record) {
  const started = performance.now();
  const state = buildNegativeState(record);
  const step = nextStepForSingleTechnique(state, record.technique);
  const issues = [];
  if (step && record.forbiddenPattern) {
    const pattern = step.evidence.pattern;
    const sameFamily = pattern?.family === record.forbiddenPattern.family;
    const sameSubtype = record.forbiddenPattern.subtype === undefined || pattern?.subtype === record.forbiddenPattern.subtype;
    if (sameFamily && sameSubtype) {
      issues.push(`forbidden-pattern:${pattern?.family ?? 'no-pattern'}:${pattern?.subtype ?? 'no-subtype'}`);
    }
  }
  for (const forbidden of record.forbiddenEliminations ?? []) {
    if (step && hasAction(step, 'eliminate', forbidden)) {
      issues.push(`forbidden-elimination:${forbidden.cell}:${forbidden.digit}`);
    }
  }
  for (const forbidden of record.forbiddenPlacements ?? []) {
    if (step && hasAction(step, 'place', forbidden)) {
      issues.push(`forbidden-placement:${forbidden.cell}:${forbidden.digit}`);
    }
  }
  if (
    step
    && record.forbiddenPattern === undefined
    && (record.forbiddenEliminations?.length ?? 0) === 0
    && (record.forbiddenPlacements?.length ?? 0) === 0
  ) {
    issues.push(`unexpected-step:${step.technique}:${step.evidence.pattern?.family ?? 'no-pattern'}:${step.evidence.pattern?.subtype ?? 'no-subtype'}`);
  }
  return {
    technique: record.technique,
    kind: 'negative',
    ok: issues.length === 0,
    issues,
    reason: record.reason,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function auditStepVerification(state, step, issues) {
  const verification = verifyStep(state, step, { mode: 'evidence' });
  const structuralErrors = verification.issues
    .filter((issue) =>
      issue.severity === 'error'
      && !CONTEXT_DEPENDENT_VERIFICATION_CODES.has(issue.code));
  if (structuralErrors.length > 0) {
    const codes = summarizeIssueCodes(structuralErrors.map((issue) => issue.code));
    issues.push(`verify-step-failed:${codes || 'unknown'}`);
  }
}

function countLinksByType(step, type) {
  return (step.evidence.links ?? []).filter((link) => link.type === type).length;
}

function countGroupedNodes(step) {
  return (step.evidence.nodes ?? []).filter((node) => node.grouped === true && Array.isArray(node.cells) && node.cells.length > 1).length;
}

function countBranchesByFlag(step, field) {
  return (step.evidence.branches ?? []).filter((branch) => branch[field] === true).length;
}

function hasExpectedLink(step, expected) {
  return (step.evidence.links ?? []).some((link) => {
    const sameEndpoints = (link.from === expected.from && link.to === expected.to)
      || (link.from === expected.to && link.to === expected.from);
    if (!sameEndpoints) {
      return false;
    }
    if (expected.digit !== undefined && link.digit !== expected.digit) {
      return false;
    }
    if (expected.type !== undefined && link.type !== expected.type) {
      return false;
    }
    if (expected.house !== undefined && !sameHouse(link.house, expected.house)) {
      return false;
    }
    return true;
  });
}

function hasExpectedNode(step, expected) {
  return (step.evidence.nodes ?? []).some((node) => {
    if (node.id !== expected.id) {
      return false;
    }
    if (expected.digit !== undefined && node.digit !== expected.digit) {
      return false;
    }
    if (expected.cells !== undefined && !expected.cells.every((cell) => node.cells.includes(cell))) {
      return false;
    }
    return true;
  });
}

function hasExpectedCell(step, expected) {
  return (step.evidence.cells ?? []).some((cell) => {
    if (cell.cell !== expected.cell) {
      return false;
    }
    if (expected.digit !== undefined && cell.digit !== expected.digit) {
      return false;
    }
    if (expected.role !== undefined && cell.role !== expected.role) {
      return false;
    }
    return true;
  });
}

function hasExpectedHouse(step, expected) {
  return (step.evidence.houses ?? []).some((house) =>
    house.type === expected.type && house.index === expected.index);
}

function sameHouse(left, right) {
  return left?.type === right.type && left.index === right.index;
}

function summarizeIssueCodes(codes) {
  const counts = new Map();
  for (const code of codes) {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, count]) => count === 1 ? code : `${code}x${count}`)
    .join('|');
}

function nextStepForSingleTechnique(state, technique) {
  return nextStep(state, {
    allowedTechniques: [technique],
    fallbackTechniques: [],
    allowContradictoryCandidateState: true,
    preferredTechniques: [technique],
  });
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

function buildExactCandidateStateWithDefault(overrides, defaultCandidates) {
  const byCell = new Map(overrides);
  return {
    board: parsePuzzle(EMPTY_GRID),
    constraints: {
      exactCandidates: Array.from({ length: 81 }, (_, cell) => ({
        cell,
        digits: byCell.get(cell) ?? defaultCandidates,
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

function buildTrustedCandidateState(puzzle, overrides) {
  return {
    board: parsePuzzle(puzzle),
    constraints: {
      exactCandidatesMode: 'trusted',
      exactCandidates: overrides.map(([cell, digits]) => ({ cell, digits })),
    },
  };
}

function buildUniquenessState(record) {
  if (record.stateKind === 'exact') {
    return buildExactCandidateState(record.candidates);
  }
  if (record.stateKind === 'mask') {
    return buildCandidateMaskState(record.candidates);
  }
  return buildTrustedCandidateState(record.puzzle, record.candidates);
}

function buildForcingState(record) {
  if (record.stateKind === 'exact') {
    return buildExactCandidateState(record.candidates);
  }
  if (record.stateKind === 'mask') {
    return buildCandidateMaskState(record.candidates);
  }
  return buildTrustedCandidateState(record.puzzle, record.candidates);
}

function buildNegativeState(record) {
  if (record.stateKind === 'exact') {
    return Array.isArray(record.defaultCandidates)
      ? buildExactCandidateStateWithDefault(record.candidates, record.defaultCandidates)
      : buildExactCandidateState(record.candidates);
  }
  if (record.stateKind === 'mask') {
    return buildCandidateMaskState(record.candidates);
  }
  return buildTrustedCandidateState(record.puzzle, record.candidates);
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
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.direct) || !Array.isArray(parsed.chains) || !Array.isArray(parsed.uniqueness)) {
    throw new Error(`Invalid reference fixture file: ${path}`);
  }
  if (parsed.basics !== undefined && !Array.isArray(parsed.basics)) {
    throw new Error(`Invalid reference fixture file: ${path}: basics must be an array when present.`);
  }
  for (const record of parsed.basics ?? []) {
    assertBasicRecord(record, path);
  }
  for (const record of parsed.direct) {
    assertDirectRecord(record, path);
  }
  for (const record of parsed.chains) {
    assertChainRecord(record, path);
  }
  if (parsed.forcing !== undefined && !Array.isArray(parsed.forcing)) {
    throw new Error(`Invalid reference fixture file: ${path}: forcing must be an array when present.`);
  }
  for (const record of parsed.forcing ?? []) {
    assertForcingRecord(record, path);
  }
  if (parsed.fish !== undefined && !Array.isArray(parsed.fish)) {
    throw new Error(`Invalid reference fixture file: ${path}: fish must be an array when present.`);
  }
  for (const record of parsed.fish ?? []) {
    assertFishRecord(record, path);
  }
  if (parsed.wings !== undefined && !Array.isArray(parsed.wings)) {
    throw new Error(`Invalid reference fixture file: ${path}: wings must be an array when present.`);
  }
  for (const record of parsed.wings ?? []) {
    assertWingRecord(record, path);
  }
  if (parsed.als !== undefined && !Array.isArray(parsed.als)) {
    throw new Error(`Invalid reference fixture file: ${path}: als must be an array when present.`);
  }
  for (const record of parsed.als ?? []) {
    assertAlsRecord(record, path);
  }
  if (parsed.patterns !== undefined && !Array.isArray(parsed.patterns)) {
    throw new Error(`Invalid reference fixture file: ${path}: patterns must be an array when present.`);
  }
  for (const record of parsed.patterns ?? []) {
    assertPatternRecord(record, path);
  }
  for (const record of parsed.uniqueness) {
    assertUniquenessRecord(record, path);
  }
  if (parsed.negative !== undefined && !Array.isArray(parsed.negative)) {
    throw new Error(`Invalid reference fixture file: ${path}: negative must be an array when present.`);
  }
  for (const record of parsed.negative ?? []) {
    assertNegativeRecord(record, path);
  }
  return parsed;
}

function assertBasicRecord(record, path) {
  if (!isRecord(record)) {
    throw new Error(`Invalid reference basic fixture in ${path}: record must be an object.`);
  }
  if (!BASIC_TECHNIQUES.has(record.technique)) {
    throw new Error(`Invalid reference basic fixture in ${path}: unknown technique ${String(record.technique)}.`);
  }
  if (record.stateKind !== 'exact' && record.stateKind !== 'mask' && record.stateKind !== 'puzzle') {
    throw new Error(`Invalid reference basic fixture in ${path}: ${record.technique} stateKind must be exact, mask or puzzle.`);
  }
  if (record.stateKind === 'puzzle') {
    if (typeof record.puzzle !== 'string') {
      throw new Error(`Invalid reference basic fixture in ${path}: ${record.technique}.puzzle must be a string for puzzle state.`);
    }
    parsePuzzle(record.puzzle);
  } else {
    assertCandidateTuples(record.candidates, `${record.technique} candidates`);
  }
  if (record.expectedEliminations !== undefined && !Array.isArray(record.expectedEliminations)) {
    throw new Error(`Invalid reference basic fixture in ${path}: ${record.technique}.expectedEliminations must be an array.`);
  }
  for (const expected of record.expectedEliminations ?? []) {
    assertCellDigitRef(expected, `${record.technique} expectedEliminations`);
  }
  if (record.expectedPlacements !== undefined && !Array.isArray(record.expectedPlacements)) {
    throw new Error(`Invalid reference basic fixture in ${path}: ${record.technique}.expectedPlacements must be an array.`);
  }
  for (const expected of record.expectedPlacements ?? []) {
    assertCellDigitRef(expected, `${record.technique} expectedPlacements`);
  }
  if ((record.expectedEliminations?.length ?? 0) === 0 && (record.expectedPlacements?.length ?? 0) === 0) {
    throw new Error(`Invalid reference basic fixture in ${path}: ${record.technique} should declare expectedEliminations or expectedPlacements.`);
  }
  if (record.expectedPattern !== undefined) {
    if (!isRecord(record.expectedPattern) || typeof record.expectedPattern.family !== 'string' || record.expectedPattern.family.length === 0) {
      throw new Error(`Invalid reference basic fixture in ${path}: ${record.technique}.expectedPattern.family must be a non-empty string.`);
    }
    if (record.expectedPattern.subtype !== undefined && (typeof record.expectedPattern.subtype !== 'string' || record.expectedPattern.subtype.length === 0)) {
      throw new Error(`Invalid reference basic fixture in ${path}: ${record.technique}.expectedPattern.subtype must be a non-empty string.`);
    }
  }
  if (record.expectedCells !== undefined && !Array.isArray(record.expectedCells)) {
    throw new Error(`Invalid reference basic fixture in ${path}: ${record.technique}.expectedCells must be an array.`);
  }
  for (const expected of record.expectedCells ?? []) {
    assertExpectedCellRef(expected, `${record.technique} expectedCells`);
  }
  if (record.expectedHouses !== undefined && !Array.isArray(record.expectedHouses)) {
    throw new Error(`Invalid reference basic fixture in ${path}: ${record.technique}.expectedHouses must be an array.`);
  }
  for (const expected of record.expectedHouses ?? []) {
    assertExpectedHouseRef(expected, `${record.technique} expectedHouses`);
  }
}

function assertDirectRecord(record, path) {
  if (!isRecord(record)) {
    throw new Error(`Invalid reference direct fixture in ${path}: record must be an object.`);
  }
  if (!DIRECT_TECHNIQUES.has(record.technique)) {
    throw new Error(`Invalid reference direct fixture in ${path}: unknown technique ${String(record.technique)}.`);
  }
  if (record.stateKind !== undefined && record.stateKind !== 'exact' && record.stateKind !== 'puzzle') {
    throw new Error(`Invalid reference direct fixture in ${path}: ${record.technique}.stateKind must be exact or puzzle.`);
  }
  if (record.stateKind === 'puzzle') {
    if (typeof record.puzzle !== 'string') {
      throw new Error(`Invalid reference direct fixture in ${path}: ${record.technique}.puzzle must be a string for puzzle state.`);
    }
    parsePuzzle(record.puzzle);
  } else {
    assertCandidateTuples(record.candidates, `${record.technique} candidates`);
  }
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
  if (!Number.isInteger(record.minLinks) || record.minLinks < 0) {
    throw new Error(`Invalid reference chain fixture in ${path}: ${record.technique} minLinks must be a non-negative integer.`);
  }
  if (record.minLinks === 0 && record.minGroupedNodes === undefined && record.expectedNodes === undefined && record.expectedCells === undefined) {
    throw new Error(`Invalid reference chain fixture in ${path}: ${record.technique} minLinks 0 requires expected evidence nodes or cells.`);
  }
  if (record.expectedEliminations !== undefined && !Array.isArray(record.expectedEliminations)) {
    throw new Error(`Invalid reference chain fixture in ${path}: ${record.technique}.expectedEliminations must be an array.`);
  }
  for (const expected of record.expectedEliminations ?? []) {
    assertCellDigitRef(expected, `${record.technique} expectedEliminations`);
  }
  if (record.expectedPlacements !== undefined && !Array.isArray(record.expectedPlacements)) {
    throw new Error(`Invalid reference chain fixture in ${path}: ${record.technique}.expectedPlacements must be an array.`);
  }
  for (const expected of record.expectedPlacements ?? []) {
    assertCellDigitRef(expected, `${record.technique} expectedPlacements`);
  }
  for (const field of ['minStrongLinks', 'minWeakLinks', 'minGroupedNodes']) {
    if (record[field] !== undefined && (!Number.isInteger(record[field]) || record[field] < 0)) {
      throw new Error(`Invalid reference chain fixture in ${path}: ${record.technique}.${field} must be a non-negative integer.`);
    }
  }
  if (record.expectedPattern !== undefined) {
    if (!isRecord(record.expectedPattern) || typeof record.expectedPattern.family !== 'string' || record.expectedPattern.family.length === 0) {
      throw new Error(`Invalid reference chain fixture in ${path}: ${record.technique}.expectedPattern.family must be a non-empty string.`);
    }
    if (record.expectedPattern.subtype !== undefined && (typeof record.expectedPattern.subtype !== 'string' || record.expectedPattern.subtype.length === 0)) {
      throw new Error(`Invalid reference chain fixture in ${path}: ${record.technique}.expectedPattern.subtype must be a non-empty string.`);
    }
  }
  if (record.expectedNodes !== undefined && !Array.isArray(record.expectedNodes)) {
    throw new Error(`Invalid reference chain fixture in ${path}: ${record.technique}.expectedNodes must be an array.`);
  }
  for (const expected of record.expectedNodes ?? []) {
    assertExpectedNodeRef(expected, `${record.technique} expectedNodes`);
  }
  if (record.expectedCells !== undefined && !Array.isArray(record.expectedCells)) {
    throw new Error(`Invalid reference chain fixture in ${path}: ${record.technique}.expectedCells must be an array.`);
  }
  for (const expected of record.expectedCells ?? []) {
    assertExpectedCellRef(expected, `${record.technique} expectedCells`);
  }
}

function assertFishRecord(record, path) {
  if (!isRecord(record)) {
    throw new Error(`Invalid reference fish fixture in ${path}: record must be an object.`);
  }
  if (!FISH_TECHNIQUES.has(record.technique)) {
    throw new Error(`Invalid reference fish fixture in ${path}: unknown technique ${String(record.technique)}.`);
  }
  if (record.stateKind !== 'exact' && record.stateKind !== 'mask') {
    throw new Error(`Invalid reference fish fixture in ${path}: ${record.technique} stateKind must be exact or mask.`);
  }
  assertCandidateTuples(record.candidates, `${record.technique} candidates`);
  if (!Array.isArray(record.expectedEliminations) || record.expectedEliminations.length === 0) {
    throw new Error(`Invalid reference fish fixture in ${path}: ${record.technique}.expectedEliminations must be a non-empty array.`);
  }
  for (const expected of record.expectedEliminations) {
    assertCellDigitRef(expected, `${record.technique} expectedEliminations`);
  }
  if (record.expectedPattern === undefined || !isRecord(record.expectedPattern) || typeof record.expectedPattern.family !== 'string' || typeof record.expectedPattern.subtype !== 'string') {
    throw new Error(`Invalid reference fish fixture in ${path}: ${record.technique}.expectedPattern must include family and subtype.`);
  }
  if (record.expectedCells !== undefined && !Array.isArray(record.expectedCells)) {
    throw new Error(`Invalid reference fish fixture in ${path}: ${record.technique}.expectedCells must be an array.`);
  }
  for (const expected of record.expectedCells ?? []) {
    assertExpectedCellRef(expected, `${record.technique} expectedCells`);
  }
  if (record.expectedHouses !== undefined && !Array.isArray(record.expectedHouses)) {
    throw new Error(`Invalid reference fish fixture in ${path}: ${record.technique}.expectedHouses must be an array.`);
  }
  for (const expected of record.expectedHouses ?? []) {
    assertExpectedHouseRef(expected, `${record.technique} expectedHouses`);
  }
}

function assertWingRecord(record, path) {
  if (!isRecord(record)) {
    throw new Error(`Invalid reference wing fixture in ${path}: record must be an object.`);
  }
  if (!WING_TECHNIQUES.has(record.technique)) {
    throw new Error(`Invalid reference wing fixture in ${path}: unknown technique ${String(record.technique)}.`);
  }
  if (record.stateKind !== 'exact' && record.stateKind !== 'mask') {
    throw new Error(`Invalid reference wing fixture in ${path}: ${record.technique} stateKind must be exact or mask.`);
  }
  assertCandidateTuples(record.candidates, `${record.technique} candidates`);
  if (!Array.isArray(record.expectedEliminations) || record.expectedEliminations.length === 0) {
    throw new Error(`Invalid reference wing fixture in ${path}: ${record.technique}.expectedEliminations must be a non-empty array.`);
  }
  for (const expected of record.expectedEliminations) {
    assertCellDigitRef(expected, `${record.technique} expectedEliminations`);
  }
  if (record.minLinks !== undefined && (!Number.isInteger(record.minLinks) || record.minLinks < 0)) {
    throw new Error(`Invalid reference wing fixture in ${path}: ${record.technique} minLinks must be a non-negative integer.`);
  }
  if (record.expectedPattern !== undefined) {
    if (!isRecord(record.expectedPattern) || typeof record.expectedPattern.family !== 'string' || record.expectedPattern.family.length === 0) {
      throw new Error(`Invalid reference wing fixture in ${path}: ${record.technique}.expectedPattern.family must be a non-empty string.`);
    }
    if (record.expectedPattern.subtype !== undefined && (typeof record.expectedPattern.subtype !== 'string' || record.expectedPattern.subtype.length === 0)) {
      throw new Error(`Invalid reference wing fixture in ${path}: ${record.technique}.expectedPattern.subtype must be a non-empty string.`);
    }
  }
  if (record.expectedLinks !== undefined && !Array.isArray(record.expectedLinks)) {
    throw new Error(`Invalid reference wing fixture in ${path}: ${record.technique}.expectedLinks must be an array.`);
  }
  for (const expected of record.expectedLinks ?? []) {
    assertExpectedLinkRef(expected, `${record.technique} expectedLinks`);
  }
  if (record.expectedCells !== undefined && !Array.isArray(record.expectedCells)) {
    throw new Error(`Invalid reference wing fixture in ${path}: ${record.technique}.expectedCells must be an array.`);
  }
  for (const expected of record.expectedCells ?? []) {
    assertExpectedCellRef(expected, `${record.technique} expectedCells`);
  }
}

function assertAlsRecord(record, path) {
  if (!isRecord(record)) {
    throw new Error(`Invalid reference ALS fixture in ${path}: record must be an object.`);
  }
  if (!ALS_TECHNIQUES.has(record.technique)) {
    throw new Error(`Invalid reference ALS fixture in ${path}: unknown technique ${String(record.technique)}.`);
  }
  if (record.stateKind !== 'exact' && record.stateKind !== 'mask') {
    throw new Error(`Invalid reference ALS fixture in ${path}: ${record.technique} stateKind must be exact or mask.`);
  }
  assertCandidateTuples(record.candidates, `${record.technique} candidates`);
  if (!Array.isArray(record.expectedEliminations) || record.expectedEliminations.length === 0) {
    throw new Error(`Invalid reference ALS fixture in ${path}: ${record.technique}.expectedEliminations must be a non-empty array.`);
  }
  for (const expected of record.expectedEliminations) {
    assertCellDigitRef(expected, `${record.technique} expectedEliminations`);
  }
  if (record.expectedPattern !== undefined) {
    if (!isRecord(record.expectedPattern) || typeof record.expectedPattern.family !== 'string' || record.expectedPattern.family.length === 0) {
      throw new Error(`Invalid reference ALS fixture in ${path}: ${record.technique}.expectedPattern.family must be a non-empty string.`);
    }
    if (record.expectedPattern.subtype !== undefined && (typeof record.expectedPattern.subtype !== 'string' || record.expectedPattern.subtype.length === 0)) {
      throw new Error(`Invalid reference ALS fixture in ${path}: ${record.technique}.expectedPattern.subtype must be a non-empty string.`);
    }
  }
  if (record.minLinks !== undefined && (!Number.isInteger(record.minLinks) || record.minLinks < 0)) {
    throw new Error(`Invalid reference ALS fixture in ${path}: ${record.technique}.minLinks must be a non-negative integer.`);
  }
  if (record.minNodes !== undefined && (!Number.isInteger(record.minNodes) || record.minNodes < 0)) {
    throw new Error(`Invalid reference ALS fixture in ${path}: ${record.technique}.minNodes must be a non-negative integer.`);
  }
  if (record.expectedLinks !== undefined && !Array.isArray(record.expectedLinks)) {
    throw new Error(`Invalid reference ALS fixture in ${path}: ${record.technique}.expectedLinks must be an array.`);
  }
  for (const expected of record.expectedLinks ?? []) {
    assertExpectedLinkRef(expected, `${record.technique} expectedLinks`);
  }
  if (record.expectedNodes !== undefined && !Array.isArray(record.expectedNodes)) {
    throw new Error(`Invalid reference ALS fixture in ${path}: ${record.technique}.expectedNodes must be an array.`);
  }
  for (const expected of record.expectedNodes ?? []) {
    assertExpectedNodeRef(expected, `${record.technique} expectedNodes`);
  }
}

function assertPatternRecord(record, path) {
  if (!isRecord(record)) {
    throw new Error(`Invalid reference pattern fixture in ${path}: record must be an object.`);
  }
  if (!PATTERN_TECHNIQUES.has(record.technique)) {
    throw new Error(`Invalid reference pattern fixture in ${path}: unknown technique ${String(record.technique)}.`);
  }
  if (record.stateKind !== 'exact' && record.stateKind !== 'mask' && record.stateKind !== 'trusted') {
    throw new Error(`Invalid reference pattern fixture in ${path}: ${record.technique} stateKind must be exact, mask or trusted.`);
  }
  if (record.stateKind === 'trusted' && typeof record.puzzle !== 'string') {
    throw new Error(`Invalid reference pattern fixture in ${path}: ${record.technique}.puzzle must be a string for trusted state.`);
  }
  if (typeof record.puzzle === 'string') {
    parsePuzzle(record.puzzle);
  }
  assertCandidateTuples(record.candidates, `${record.technique} candidates`);
  if (record.expectedEliminations !== undefined && !Array.isArray(record.expectedEliminations)) {
    throw new Error(`Invalid reference pattern fixture in ${path}: ${record.technique}.expectedEliminations must be an array.`);
  }
  if (record.expectedPlacements !== undefined && !Array.isArray(record.expectedPlacements)) {
    throw new Error(`Invalid reference pattern fixture in ${path}: ${record.technique}.expectedPlacements must be an array.`);
  }
  if ((record.expectedEliminations?.length ?? 0) === 0 && (record.expectedPlacements?.length ?? 0) === 0) {
    throw new Error(`Invalid reference pattern fixture in ${path}: ${record.technique} must declare at least one expected elimination or placement.`);
  }
  for (const expected of record.expectedEliminations ?? []) {
    assertCellDigitRef(expected, `${record.technique} expectedEliminations`);
  }
  for (const expected of record.expectedPlacements ?? []) {
    assertCellDigitRef(expected, `${record.technique} expectedPlacements`);
  }
  if (record.expectedPattern !== undefined) {
    if (!isRecord(record.expectedPattern) || typeof record.expectedPattern.family !== 'string' || record.expectedPattern.family.length === 0) {
      throw new Error(`Invalid reference pattern fixture in ${path}: ${record.technique}.expectedPattern.family must be a non-empty string.`);
    }
    if (record.expectedPattern.subtype !== undefined && (typeof record.expectedPattern.subtype !== 'string' || record.expectedPattern.subtype.length === 0)) {
      throw new Error(`Invalid reference pattern fixture in ${path}: ${record.technique}.expectedPattern.subtype must be a non-empty string.`);
    }
  }
  if (record.minNodes !== undefined && (!Number.isInteger(record.minNodes) || record.minNodes < 1)) {
    throw new Error(`Invalid reference pattern fixture in ${path}: ${record.technique}.minNodes must be a positive integer.`);
  }
  if (record.expectedNodes !== undefined && !Array.isArray(record.expectedNodes)) {
    throw new Error(`Invalid reference pattern fixture in ${path}: ${record.technique}.expectedNodes must be an array.`);
  }
  for (const expected of record.expectedNodes ?? []) {
    assertExpectedNodeRef(expected, `${record.technique} expectedNodes`);
  }
  if (record.expectedNoteIncludes !== undefined && !Array.isArray(record.expectedNoteIncludes)) {
    throw new Error(`Invalid reference pattern fixture in ${path}: ${record.technique}.expectedNoteIncludes must be an array.`);
  }
  for (const expected of record.expectedNoteIncludes ?? []) {
    if (typeof expected !== 'string' || expected.length === 0) {
      throw new Error(`Invalid reference pattern fixture in ${path}: ${record.technique}.expectedNoteIncludes entries must be non-empty strings.`);
    }
  }
}

function assertUniquenessRecord(record, path) {
  if (!isRecord(record)) {
    throw new Error(`Invalid reference uniqueness fixture in ${path}: record must be an object.`);
  }
  if (!UNIQUENESS_TECHNIQUES.has(record.technique)) {
    throw new Error(`Invalid reference uniqueness fixture in ${path}: unknown technique ${String(record.technique)}.`);
  }
  if (record.stateKind !== 'exact' && record.stateKind !== 'mask' && record.stateKind !== 'trusted') {
    throw new Error(`Invalid reference uniqueness fixture in ${path}: ${record.technique}.stateKind must be exact, mask or trusted.`);
  }
  if (record.stateKind === 'trusted' && typeof record.puzzle !== 'string') {
    throw new Error(`Invalid reference uniqueness fixture in ${path}: ${record.technique}.puzzle must be a string for trusted state.`);
  }
  if (typeof record.puzzle === 'string') {
    parsePuzzle(record.puzzle);
  }
  assertCandidateTuples(record.candidates, `${record.technique} candidates`);
  if (record.expectedEliminations !== undefined && !Array.isArray(record.expectedEliminations)) {
    throw new Error(`Invalid reference uniqueness fixture in ${path}: ${record.technique}.expectedEliminations must be an array.`);
  }
  if (record.expectedPlacements !== undefined && !Array.isArray(record.expectedPlacements)) {
    throw new Error(`Invalid reference uniqueness fixture in ${path}: ${record.technique}.expectedPlacements must be an array.`);
  }
  if ((record.expectedEliminations?.length ?? 0) === 0 && (record.expectedPlacements?.length ?? 0) === 0) {
    throw new Error(`Invalid reference uniqueness fixture in ${path}: ${record.technique} must declare at least one expected elimination or placement.`);
  }
  for (const expected of record.expectedEliminations ?? []) {
    assertCellDigitRef(expected, `${record.technique} expectedEliminations`);
  }
  for (const expected of record.expectedPlacements ?? []) {
    assertCellDigitRef(expected, `${record.technique} expectedPlacements`);
  }
  if (record.expectedPattern !== undefined) {
    if (!isRecord(record.expectedPattern) || typeof record.expectedPattern.family !== 'string' || record.expectedPattern.family.length === 0) {
      throw new Error(`Invalid reference uniqueness fixture in ${path}: ${record.technique}.expectedPattern.family must be a non-empty string.`);
    }
    if (record.expectedPattern.subtype !== undefined && (typeof record.expectedPattern.subtype !== 'string' || record.expectedPattern.subtype.length === 0)) {
      throw new Error(`Invalid reference uniqueness fixture in ${path}: ${record.technique}.expectedPattern.subtype must be a non-empty string.`);
    }
  }
  if (record.minLinks !== undefined && (!Number.isInteger(record.minLinks) || record.minLinks < 1)) {
    throw new Error(`Invalid reference uniqueness fixture in ${path}: ${record.technique}.minLinks must be a positive integer.`);
  }
  if (record.minNodes !== undefined && (!Number.isInteger(record.minNodes) || record.minNodes < 1)) {
    throw new Error(`Invalid reference uniqueness fixture in ${path}: ${record.technique}.minNodes must be a positive integer.`);
  }
  if (record.expectedNodes !== undefined && !Array.isArray(record.expectedNodes)) {
    throw new Error(`Invalid reference uniqueness fixture in ${path}: ${record.technique}.expectedNodes must be an array.`);
  }
  for (const expected of record.expectedNodes ?? []) {
    assertExpectedNodeRef(expected, `${record.technique} expectedNodes`);
  }
}

function assertForcingRecord(record, path) {
  if (!isRecord(record)) {
    throw new Error(`Invalid reference forcing fixture in ${path}: record must be an object.`);
  }
  if (!FORCING_TECHNIQUES.has(record.technique)) {
    throw new Error(`Invalid reference forcing fixture in ${path}: unknown technique ${String(record.technique)}.`);
  }
  if (record.stateKind !== 'exact' && record.stateKind !== 'mask' && record.stateKind !== 'trusted') {
    throw new Error(`Invalid reference forcing fixture in ${path}: ${record.technique}.stateKind must be exact, mask or trusted.`);
  }
  if (record.stateKind === 'trusted' && typeof record.puzzle !== 'string') {
    throw new Error(`Invalid reference forcing fixture in ${path}: ${record.technique}.puzzle must be a string for trusted state.`);
  }
  if (typeof record.puzzle === 'string') {
    parsePuzzle(record.puzzle);
  }
  assertCandidateTuples(record.candidates, `${record.technique} candidates`);
  if (record.expectedEliminations !== undefined && !Array.isArray(record.expectedEliminations)) {
    throw new Error(`Invalid reference forcing fixture in ${path}: ${record.technique}.expectedEliminations must be an array.`);
  }
  for (const expected of record.expectedEliminations ?? []) {
    assertCellDigitRef(expected, `${record.technique} expectedEliminations`);
  }
  if (record.expectedPlacements !== undefined && !Array.isArray(record.expectedPlacements)) {
    throw new Error(`Invalid reference forcing fixture in ${path}: ${record.technique}.expectedPlacements must be an array.`);
  }
  for (const expected of record.expectedPlacements ?? []) {
    assertCellDigitRef(expected, `${record.technique} expectedPlacements`);
  }
  if ((record.expectedEliminations?.length ?? 0) === 0 && (record.expectedPlacements?.length ?? 0) === 0) {
    throw new Error(`Invalid reference forcing fixture in ${path}: ${record.technique} must declare expected eliminations or placements.`);
  }
  for (const field of ['minBranches', 'minContradictionBranches', 'expectedMaxSteps']) {
    if (record[field] !== undefined && (!Number.isInteger(record[field]) || record[field] < 0)) {
      throw new Error(`Invalid reference forcing fixture in ${path}: ${record.technique}.${field} must be a non-negative integer.`);
    }
  }
  if (record.expectedPattern !== undefined) {
    if (!isRecord(record.expectedPattern) || typeof record.expectedPattern.family !== 'string' || record.expectedPattern.family.length === 0) {
      throw new Error(`Invalid reference forcing fixture in ${path}: ${record.technique}.expectedPattern.family must be a non-empty string.`);
    }
    if (record.expectedPattern.subtype !== undefined && (typeof record.expectedPattern.subtype !== 'string' || record.expectedPattern.subtype.length === 0)) {
      throw new Error(`Invalid reference forcing fixture in ${path}: ${record.technique}.expectedPattern.subtype must be a non-empty string.`);
    }
  }
}

function assertNegativeRecord(record, path) {
  if (!isRecord(record)) {
    throw new Error(`Invalid reference negative fixture in ${path}: record must be an object.`);
  }
  if (!REFERENCE_TECHNIQUE_ORDER.includes(record.technique)) {
    throw new Error(`Invalid reference negative fixture in ${path}: unknown technique ${String(record.technique)}.`);
  }
  if (record.stateKind !== 'exact' && record.stateKind !== 'mask' && record.stateKind !== 'trusted') {
    throw new Error(`Invalid reference negative fixture in ${path}: ${record.technique}.stateKind must be exact, mask or trusted.`);
  }
  if (typeof record.reason !== 'string' || record.reason.length === 0) {
    throw new Error(`Invalid reference negative fixture in ${path}: ${record.technique}.reason must be a non-empty string.`);
  }
  if (record.stateKind === 'trusted' && typeof record.puzzle !== 'string') {
    throw new Error(`Invalid reference negative fixture in ${path}: ${record.technique}.puzzle must be a string for trusted state.`);
  }
  if (typeof record.puzzle === 'string') {
    parsePuzzle(record.puzzle);
  }
  assertCandidateTuples(record.candidates, `${record.technique} negative candidates`);
  if (record.defaultCandidates !== undefined) {
    assertDigitList(record.defaultCandidates, `${record.technique} defaultCandidates`);
  }
  if (record.forbiddenPattern !== undefined) {
    if (!isRecord(record.forbiddenPattern) || typeof record.forbiddenPattern.family !== 'string' || record.forbiddenPattern.family.length === 0) {
      throw new Error(`Invalid reference negative fixture in ${path}: ${record.technique}.forbiddenPattern.family must be a non-empty string.`);
    }
    if (record.forbiddenPattern.subtype !== undefined && (typeof record.forbiddenPattern.subtype !== 'string' || record.forbiddenPattern.subtype.length === 0)) {
      throw new Error(`Invalid reference negative fixture in ${path}: ${record.technique}.forbiddenPattern.subtype must be a non-empty string.`);
    }
  }
  if (record.forbiddenEliminations !== undefined) {
    if (!Array.isArray(record.forbiddenEliminations)) {
      throw new Error(`Invalid reference negative fixture in ${path}: ${record.technique}.forbiddenEliminations must be an array.`);
    }
    for (const forbidden of record.forbiddenEliminations) {
      assertCellDigitRef(forbidden, `${record.technique} forbiddenEliminations`);
    }
  }
  if (record.forbiddenPlacements !== undefined) {
    if (!Array.isArray(record.forbiddenPlacements)) {
      throw new Error(`Invalid reference negative fixture in ${path}: ${record.technique}.forbiddenPlacements must be an array.`);
    }
    for (const forbidden of record.forbiddenPlacements) {
      assertCellDigitRef(forbidden, `${record.technique} forbiddenPlacements`);
    }
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

function assertDigitList(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid reference fixture: ${label} must be a non-empty digit array.`);
  }
  for (const digit of value) {
    if (!Number.isInteger(digit) || digit < 1 || digit > 9) {
      throw new Error(`Invalid reference fixture: ${label} digit must be 1..9.`);
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

function assertExpectedLinkRef(value, label) {
  if (!isRecord(value)) {
    throw new Error(`Invalid reference fixture: ${label} must be an object.`);
  }
  if (!Number.isInteger(value.from) || value.from < 0 || value.from >= 81) {
    throw new Error(`Invalid reference fixture: ${label}.from must be 0..80.`);
  }
  if (!Number.isInteger(value.to) || value.to < 0 || value.to >= 81) {
    throw new Error(`Invalid reference fixture: ${label}.to must be 0..80.`);
  }
  if (value.digit !== undefined && (!Number.isInteger(value.digit) || value.digit < 1 || value.digit > 9)) {
    throw new Error(`Invalid reference fixture: ${label}.digit must be 1..9.`);
  }
  if (value.type !== undefined && value.type !== 'strong' && value.type !== 'weak') {
    throw new Error(`Invalid reference fixture: ${label}.type must be strong or weak.`);
  }
  if (value.house !== undefined) {
    if (!isRecord(value.house) || !['row', 'col', 'box'].includes(value.house.type) || !Number.isInteger(value.house.index) || value.house.index < 0 || value.house.index > 8) {
      throw new Error(`Invalid reference fixture: ${label}.house must be row/col/box with index 0..8.`);
    }
  }
}

function assertExpectedHouseRef(value, label) {
  if (!isRecord(value) || !['row', 'col', 'box'].includes(value.type) || !Number.isInteger(value.index) || value.index < 0 || value.index > 8) {
    throw new Error(`Invalid reference fixture: ${label} must be row/col/box with index 0..8.`);
  }
}

function assertExpectedCellRef(value, label) {
  if (!isRecord(value)) {
    throw new Error(`Invalid reference fixture: ${label} must be an object.`);
  }
  if (!Number.isInteger(value.cell) || value.cell < 0 || value.cell >= 81) {
    throw new Error(`Invalid reference fixture: ${label}.cell must be 0..80.`);
  }
  if (value.digit !== undefined && (!Number.isInteger(value.digit) || value.digit < 1 || value.digit > 9)) {
    throw new Error(`Invalid reference fixture: ${label}.digit must be 1..9.`);
  }
  if (value.role !== undefined && !['reason', 'target', 'link', 'pivot'].includes(value.role)) {
    throw new Error(`Invalid reference fixture: ${label}.role must be reason, target, link or pivot.`);
  }
}

function assertExpectedNodeRef(value, label) {
  if (!isRecord(value)) {
    throw new Error(`Invalid reference fixture: ${label} must be an object.`);
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new Error(`Invalid reference fixture: ${label}.id must be a non-empty string.`);
  }
  if (value.cells !== undefined) {
    if (!Array.isArray(value.cells)) {
      throw new Error(`Invalid reference fixture: ${label}.cells must be an array.`);
    }
    for (const cell of value.cells) {
      if (!Number.isInteger(cell) || cell < 0 || cell >= 81) {
        throw new Error(`Invalid reference fixture: ${label}.cells entries must be 0..80.`);
      }
    }
  }
  if (value.digit !== undefined && (!Number.isInteger(value.digit) || value.digit < 1 || value.digit > 9)) {
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
    process.stdout.write(`- ${row.kind}:${row.technique}: ${status}${detail}\n`);
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
