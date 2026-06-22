#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  nextStep,
  parsePuzzle,
} from '../dist/src/index.js';

const EMPTY_GRID = '000000000000000000000000000000000000000000000000000000000000000000000000000000000';
const DEFAULT_INPUT = 'tests/fixtures/reference-techniques/reference-smoke.json';
const BUG_TECHNIQUES = new Set(['bug-plus-one', 'bug-plus-two', 'bug-plus-n']);

const options = parseArgs(process.argv.slice(2));
const startedAt = performance.now();
const fixture = loadFixture(options.inputPath);
const bugRecords = (fixture.uniqueness ?? [])
  .filter((record) => BUG_TECHNIQUES.has(record.technique));

const rows = bugRecords.map((record, index) => auditBugRecord(record, index));
const failed = rows.filter((row) => !row.ok);
const payload = {
  summary: {
    auditId: 'bug-graph-evidence.v1',
    input: options.inputPath,
    bugRows: rows.length,
    placementRows: rows.filter((row) => row.actionTypes.includes('place')).length,
    eliminationRows: rows.filter((row) => row.actionTypes.includes('eliminate')).length,
    rowsWithBaseLinks: rows.filter((row) => row.baseStrongLinks > 0).length,
    totalBaseStrongLinks: rows.reduce((sum, row) => sum + row.baseStrongLinks, 0),
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

function auditBugRecord(record, index) {
  const rowId = record.id ?? `${record.technique}-${index + 1}`;
  const issues = [];
  const state = buildState(record);
  const step = nextStep(state, {
    allowContradictoryCandidateState: true,
    allowedTechniques: [record.technique],
  });

  if (!step) {
    issues.push('no-step');
    return buildRow(record, rowId, null, issues);
  }

  if (step.technique !== record.technique) {
    issues.push(`technique-mismatch:${step.technique}`);
  }
  if (record.expectedPattern) {
    const pattern = step.evidence.pattern;
    if (pattern?.family !== record.expectedPattern.family) {
      issues.push(`family-mismatch:${pattern?.family ?? 'missing'}`);
    }
    if (record.expectedPattern.subtype !== undefined && pattern?.subtype !== record.expectedPattern.subtype) {
      issues.push(`subtype-mismatch:${pattern?.subtype ?? 'missing'}`);
    }
  }

  if (!hasNode(step, 'bug-base')) {
    issues.push('missing-bug-base-node');
  }
  if (!hasNode(step, 'bug-extra')) {
    issues.push('missing-bug-extra-node');
  }

  const hasPlacement = step.actions.some((action) => action.type === 'place');
  const hasElimination = step.actions.some((action) => action.type === 'eliminate');
  if (record.technique === 'bug-plus-one') {
    if (!hasPlacement) {
      issues.push('bug-plus-one-missing-placement');
    }
    for (const id of ['bug-parity-row', 'bug-parity-col', 'bug-parity-box']) {
      if (!hasNode(step, id)) {
        issues.push(`missing-${id}`);
      }
    }
  } else {
    if (!hasElimination) {
      issues.push(`${record.technique}-missing-elimination`);
    }
    if (!hasNode(step, 'bug-common-extra-targets') && !hasNode(step, 'bug-elimination-targets')) {
      issues.push('missing-bug-target-node');
    }
    if (countBaseStrongLinks(step) === 0) {
      issues.push('missing-bug-base-strong-links');
    }
    if (record.minLinks !== undefined && countBaseStrongLinks(step) < record.minLinks) {
      issues.push(`insufficient-bug-base-strong-links:${countBaseStrongLinks(step)}<${record.minLinks}`);
    }
  }

  for (const expected of record.expectedEliminations ?? []) {
    if (!step.actions.some((action) => action.type === 'eliminate' && action.cell === expected.cell && action.digit === expected.digit)) {
      issues.push(`missing-expected-elimination:${expected.cell}:${expected.digit}`);
    }
  }
  for (const expected of record.expectedPlacements ?? []) {
    if (!step.actions.some((action) => action.type === 'place' && action.cell === expected.cell && action.digit === expected.digit)) {
      issues.push(`missing-expected-placement:${expected.cell}:${expected.digit}`);
    }
  }

  return buildRow(record, rowId, step, issues);
}

function buildRow(record, rowId, step, issues) {
  return {
    rowId,
    technique: record.technique,
    subtype: step?.evidence.pattern?.subtype ?? record.expectedPattern?.subtype ?? null,
    ok: issues.length === 0,
    issues,
    actionTypes: Array.from(new Set((step?.actions ?? []).map((action) => action.type))),
    baseStrongLinks: step ? countBaseStrongLinks(step) : 0,
    nodeIds: Array.from(new Set((step?.evidence.nodes ?? []).map((node) => node.id))).sort(),
  };
}

function countBaseStrongLinks(step) {
  return (step.evidence.links ?? [])
    .filter((link) =>
      link.type === 'strong'
      && Number.isInteger(link.from)
      && Number.isInteger(link.to)
      && Number.isInteger(link.digit)
      && isHouse(link.house))
    .length;
}

function hasNode(step, id) {
  return (step.evidence.nodes ?? []).some((node) => node.id === id);
}

function buildState(record) {
  if (record.stateKind === 'trusted') {
    return {
      board: parsePuzzle(record.puzzle),
      constraints: {
        exactCandidatesMode: 'trusted',
        exactCandidates: record.candidates.map(([cell, digits]) => ({ cell, digits })),
      },
    };
  }
  if (record.stateKind === 'mask') {
    const board = parsePuzzle(EMPTY_GRID);
    const candidateMasks = new Array(81).fill(0);
    for (const [cell, digits] of record.candidates) {
      candidateMasks[cell] = digits.reduce((mask, digit) => mask | (1 << (digit - 1)), 0);
    }
    return { board, candidateMasks };
  }
  const board = parsePuzzle(EMPTY_GRID);
  const byCell = new Map(record.candidates);
  const defaultCandidates = record.defaultCandidates ?? [8, 9];
  return {
    board,
    constraints: {
      exactCandidates: Array.from({ length: 81 }, (_, cell) => ({
        cell,
        digits: byCell.get(cell) ?? defaultCandidates,
      })),
    },
  };
}

function loadFixture(path) {
  const parsed = JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
  if (!isRecord(parsed) || !Array.isArray(parsed.uniqueness)) {
    throw new Error('Input must be a JSON object with a uniqueness array.');
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
  process.stdout.write(`BUG graph evidence: ${summary.passed}/${summary.bugRows} BUG smoke row(s) passed\n`);
  process.stdout.write(`Rows: placement=${summary.placementRows}; elimination=${summary.eliminationRows}; withBaseLinks=${summary.rowsWithBaseLinks}; baseStrongLinks=${summary.totalBaseStrongLinks}\n`);
  for (const row of payload.rows.filter((item) => !item.ok)) {
    process.stdout.write(`- ${row.rowId} ${row.technique}: ${row.issues.join(', ')}\n`);
  }
}

function isHouse(value) {
  return isRecord(value)
    && ['row', 'col', 'box'].includes(value.type)
    && Number.isInteger(value.index)
    && value.index >= 0
    && value.index <= 8;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
