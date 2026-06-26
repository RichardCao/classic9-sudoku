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
const UNIQUENESS_TECHNIQUES = new Set([
  'unique-rectangle',
  'avoidable-rectangle',
  'rectangle-elimination',
  'extended-rectangle',
  'unique-loop',
  'hidden-unique-rectangle',
  'aic-ur',
]);

const options = parseArgs(process.argv.slice(2));
const startedAt = performance.now();
const fixture = loadFixture(options.inputPath);
const uniquenessRecords = (fixture.uniqueness ?? [])
  .filter((record) => UNIQUENESS_TECHNIQUES.has(record.technique));

const rows = uniquenessRecords.map((record, index) => auditUniquenessRecord(record, index));
const failed = rows.filter((row) => !row.ok);
const payload = {
  summary: {
    auditId: 'uniqueness-evidence.v1',
    input: options.inputPath,
    uniquenessRows: rows.length,
    rowsWithUrNodes: rows.filter((row) => row.hasUrRectangle && row.hasUrFloor && row.hasUrRoof).length,
    rowsWithUniqueLoopNodes: rows.filter((row) => row.hasUniqueLoopNode && row.hasUniqueLoopBasePair && row.hasUniqueLoopGuardians && row.hasUniqueLoopTargets).length,
    rowsWithLinks: rows.filter((row) => row.linkCount > 0).length,
    maxUniqueLoopCells: Math.max(0, ...rows.map((row) => row.uniqueLoopCellCount)),
    subtypeCounts: countBy(rows.map((row) => row.pattern ? `${row.pattern.family}:${row.pattern.subtype ?? 'missing'}` : 'missing')),
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

function auditUniquenessRecord(record, index) {
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
  if (step.actions.length === 0) {
    issues.push('empty-actions');
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
  if (record.minLinks !== undefined && (step.evidence.links?.length ?? 0) < record.minLinks) {
    issues.push(`insufficient-links:${step.evidence.links?.length ?? 0}<${record.minLinks}`);
  }
  if (record.minNodes !== undefined && (step.evidence.nodes?.length ?? 0) < record.minNodes) {
    issues.push(`insufficient-nodes:${step.evidence.nodes?.length ?? 0}<${record.minNodes}`);
  }

  const pattern = step.evidence.pattern;
  if (record.technique === 'unique-rectangle' || record.technique === 'hidden-unique-rectangle' || record.technique === 'aic-ur') {
    for (const id of ['ur-rectangle', 'ur-floor', 'ur-roof']) {
      if (!hasNode(step, id)) {
        issues.push(`missing-${id}`);
      }
    }
  }
  if (pattern?.family === 'unique-rectangle' && pattern.subtype === 'type-5') {
    for (const id of ['ur-extra', 'ur-targets']) {
      if (!hasNode(step, id)) {
        issues.push(`missing-${id}`);
      }
    }
  }
  if (record.technique === 'unique-loop') {
    for (const id of ['unique-loop', 'unique-loop:base-pair', 'unique-loop:guardians', 'unique-loop:targets']) {
      if (!hasNode(step, id)) {
        issues.push(`missing-${id}`);
      }
    }
    const loopNode = getNode(step, 'unique-loop');
    if ((loopNode?.cells.length ?? 0) < 6) {
      issues.push(`unique-loop-too-short:${loopNode?.cells.length ?? 0}`);
    }
    const basePairNode = getNode(step, 'unique-loop:base-pair');
    if ((basePairNode?.cells.length ?? 0) >= (loopNode?.cells.length ?? 0)) {
      issues.push('unique-loop-base-pair-not-smaller-than-loop');
    }
    const targetNode = getNode(step, 'unique-loop:targets');
    if (pattern?.subtype === '2x3-or-3x2-shared-guardian' && !Number.isInteger(targetNode?.digit)) {
      issues.push('unique-loop-shared-guardian-target-missing-digit');
    }
  }
  if ((record.technique === 'hidden-unique-rectangle' || record.technique === 'aic-ur') && (step.evidence.links?.length ?? 0) === 0) {
    issues.push(`${record.technique}-missing-links`);
  }

  return buildRow(record, rowId, step, issues);
}

function buildRow(record, rowId, step, issues) {
  const nodeIds = Array.from(new Set((step?.evidence.nodes ?? []).map((node) => node.id))).sort();
  return {
    rowId,
    technique: record.technique,
    pattern: step?.evidence.pattern ?? record.expectedPattern ?? null,
    ok: issues.length === 0,
    issues,
    actionTypes: Array.from(new Set((step?.actions ?? []).map((action) => action.type))),
    actionCount: step?.actions.length ?? 0,
    linkCount: step?.evidence.links?.length ?? 0,
    nodeIds,
    hasUrRectangle: nodeIds.includes('ur-rectangle'),
    hasUrFloor: nodeIds.includes('ur-floor'),
    hasUrRoof: nodeIds.includes('ur-roof'),
    hasUniqueLoopNode: nodeIds.includes('unique-loop'),
    hasUniqueLoopBasePair: nodeIds.includes('unique-loop:base-pair'),
    hasUniqueLoopGuardians: nodeIds.includes('unique-loop:guardians'),
    hasUniqueLoopTargets: nodeIds.includes('unique-loop:targets'),
    uniqueLoopCellCount: getNode(step, 'unique-loop')?.cells.length ?? 0,
  };
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

function getNode(step, id) {
  return (step?.evidence.nodes ?? []).find((node) => node.id === id);
}

function hasNode(step, id) {
  return Boolean(getNode(step, id));
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
  process.stdout.write(`Uniqueness evidence: ${summary.passed}/${summary.uniquenessRows} uniqueness smoke row(s) passed\n`);
  process.stdout.write(`Rows: urNodes=${summary.rowsWithUrNodes}; uniqueLoopNodes=${summary.rowsWithUniqueLoopNodes}; links=${summary.rowsWithLinks}; maxUniqueLoopCells=${summary.maxUniqueLoopCells}\n`);
  for (const row of payload.rows.filter((item) => !item.ok)) {
    process.stdout.write(`- ${row.rowId} ${row.technique}: ${row.issues.join(', ')}\n`);
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
