#!/usr/bin/env node
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';

import { analyzeSolve, parsePuzzle, replaySteps, serializeBoard } from '../dist/src/index.js';

const require = createRequire(import.meta.url);

const options = parseArgs(process.argv.slice(2));
if (!options.inputPath) {
  fail('缺少 --input <path>。');
}

const rows = loadPuzzleRows(options.inputPath).slice(0, options.limit ?? Number.POSITIVE_INFINITY);
if (rows.length === 0) {
  fail(`没有从题集读取到可审计题目：${options.inputPath}`);
}

const startedAt = performance.now();
const audited = [];
const techniqueElapsedMs = new Map();
let solved = 0;
let actionMismatches = 0;
let solutionMismatches = 0;
let slowWarnings = 0;
let hardFailures = 0;

for (const row of rows) {
  const stepAudit = auditPuzzle(row);
  const analysis = stepAudit.analysis;
  const elapsedMs = stepAudit.elapsedMs;

  if (analysis.solved) {
    solved += 1;
  }
  if (!stepAudit.ok) {
    actionMismatches += 1;
  }
  if (stepAudit.solutionMatches === false) {
    solutionMismatches += 1;
  }
  if (elapsedMs > options.warnMs) {
    slowWarnings += 1;
  }
  if (elapsedMs > options.failMs) {
    hardFailures += 1;
  }
  for (const [technique, usage] of Object.entries(analysis.usage?.byTechnique ?? {})) {
    techniqueElapsedMs.set(technique, (techniqueElapsedMs.get(technique) ?? 0) + (usage?.elapsedMs ?? 0));
  }

  audited.push({
    id: row.id,
    solved: analysis.solved,
    solutionMatches: stepAudit.solutionMatches,
    actionAuditOk: stepAudit.ok,
    actionIssues: stepAudit.issues,
    score: analysis.score,
    hardestTechnique: analysis.hardestTechnique,
    stepCount: analysis.steps.length,
    stuckReason: analysis.stuckReason ?? null,
    elapsedMs,
    warning: elapsedMs > options.warnMs,
    failedByTime: elapsedMs > options.failMs,
  });
}

const totalElapsedMs = Math.round(performance.now() - startedAt);
const topSlow = [...audited]
  .sort((left, right) => right.elapsedMs - left.elapsedMs)
  .slice(0, options.top);
const topTechniques = Array.from(techniqueElapsedMs.entries())
  .map(([technique, elapsedMs]) => ({ technique, elapsedMs: Math.round(elapsedMs) }))
  .sort((left, right) => right.elapsedMs - left.elapsedMs)
  .slice(0, options.top);

const summary = {
  profile: 'classic-stable.v1',
  input: options.inputPath,
  total: audited.length,
  solved,
  unsolved: audited.length - solved,
  actionMismatches,
  solutionMismatches,
  slowWarnings,
  hardFailures,
  warnMs: options.warnMs,
  failMs: options.failMs,
  totalElapsedMs,
  techniqueElapsedMs: Object.fromEntries(Array.from(techniqueElapsedMs.entries()).map(([technique, elapsedMs]) => [technique, Math.round(elapsedMs)])),
  overheadMs: Math.max(0, totalElapsedMs - Array.from(techniqueElapsedMs.values()).reduce((sum, value) => sum + value, 0)),
  topSlow,
  topTechniques,
};

const payload = { summary, rows: audited };
if (options.outputPath) {
  writeAtomicJson(options.outputPath, payload);
}

if (options.json) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  printHumanSummary(summary);
}

if (summary.unsolved > 0 || summary.actionMismatches > 0 || summary.solutionMismatches > 0 || summary.hardFailures > 0) {
  process.exitCode = 1;
}

function auditPuzzle(row) {
  const started = performance.now();
  const analysis = analyzeSolve(row.puzzle, {
    includeUsage: true,
    maxSteps: row.maxSteps ?? options.maxSteps,
  });
  const elapsedMs = Math.round(performance.now() - started);
  const solution = row.solution;
  if (!solution) {
    return {
      analysis,
      elapsedMs,
      ok: false,
      solutionMatches: null,
      issues: [{
        type: 'missing-solution',
        message: 'audit:stable requires a full solution board for every puzzle.',
      }],
    };
  }

  const issues = [];
  let replayed = row.puzzle;
  for (const [stepIndex, step] of analysis.steps.entries()) {
    for (const action of step.actions) {
      const truth = solution[action.cell];
      if (action.type === 'place' && action.digit !== truth) {
        issues.push({
          step: stepIndex + 1,
          technique: step.technique,
          cell: action.cell,
          digit: action.digit,
          expected: truth,
          reason: 'place-mismatch',
        });
      }
      if (action.type === 'eliminate' && action.digit === truth) {
        issues.push({
          step: stepIndex + 1,
          technique: step.technique,
          cell: action.cell,
          digit: action.digit,
          expected: truth,
          reason: 'eliminates-solution-digit',
        });
      }
    }
  }

  try {
    replayed = replaySteps(row.puzzle, analysis.steps);
  } catch (error) {
    issues.push({
      reason: 'replay-failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const solutionMatches = serializeBoard(replayed) === serializeBoard(solution);
  if (!solutionMatches) {
    issues.push({
      reason: 'final-board-mismatch',
      message: 'Replayed board does not match solution.',
    });
  }

  return {
    analysis,
    elapsedMs,
    ok: issues.length === 0,
    solutionMatches,
    issues,
  };
}

function parseArgs(args) {
  const parsed = {
    inputPath: null,
    outputPath: null,
    limit: null,
    top: 10,
    warnMs: 10_000,
    failMs: 60_000,
    maxSteps: 512,
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
    if (item === '--limit') {
      parsed.limit = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--top') {
      parsed.top = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--warn-ms') {
      parsed.warnMs = parseNonNegativeInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--fail-ms') {
      parsed.failMs = parseNonNegativeInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--max-steps') {
      parsed.maxSteps = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    fail(`未知参数：${item}`);
  }
  return parsed;
}

function loadPuzzleRows(inputPath) {
  const absolutePath = resolve(inputPath);
  if (!existsSync(absolutePath)) {
    fail(`题集文件不存在：${absolutePath}`);
  }
  const extension = extname(absolutePath).toLowerCase();
  if (extension === '.json') {
    return normalizeRows(JSON.parse(readFileSync(absolutePath, 'utf8')));
  }
  if (extension === '.ndjson' || extension === '.jsonl') {
    return normalizeRows(readFileSync(absolutePath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line)));
  }
  if (extension === '.js' || extension === '.cjs' || extension === '.mjs') {
    return normalizeRows(loadJsModule(absolutePath));
  }
  if (extension === '.ts') {
    return normalizeRows(loadTsModule(absolutePath));
  }
  fail(`不支持的题集格式：${extension || '<none>'}`);
}

function loadJsModule(absolutePath) {
  if (absolutePath.endsWith('.mjs')) {
    throw new Error('请把 .mjs 题集转成 .json/.js/.ts 再运行 audit:stable。');
  }
  return require(absolutePath);
}

function loadTsModule(absolutePath) {
  const source = readFileSync(absolutePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: absolutePath,
  });
  const module = { exports: {} };
  const dirnameValue = dirname(absolutePath);
  const localRequire = createRequire(absolutePath);
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', transpiled.outputText); // eslint-disable-line no-new-func
  fn(module.exports, localRequire, module, absolutePath, dirnameValue);
  return module.exports;
}

function normalizeRows(value) {
  const rawRows = Array.isArray(value) ? value : pickExportedRows(value);
  return rawRows.map((row, index) => normalizeRow(row, index));
}

function pickExportedRows(loaded) {
  if (Array.isArray(loaded)) {
    return loaded;
  }
  for (const value of Object.values(loaded ?? {})) {
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

function normalizeRow(row, index) {
  if (!row || typeof row !== 'object') {
    fail(`第 ${index + 1} 项不是题面对象。`);
  }
  const puzzle = row.puzzle ?? row.grid ?? row.board;
  const solution = row.solution ?? row.answer;
  if (!puzzle) {
    fail(`第 ${index + 1} 项缺少 puzzle/grid/board。`);
  }
  if (!solution) {
    fail(`第 ${index + 1} 项缺少 solution/answer。`);
  }
  return {
    id: String(row.id ?? row.name ?? index + 1),
    puzzle: parsePuzzle(puzzle),
    solution: parsePuzzle(solution),
    ...(row.maxSteps === undefined ? {} : { maxSteps: parsePositiveInteger(row.maxSteps, `第 ${index + 1} 项 maxSteps`) }),
  };
}

function requireValue(args, index, name) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    fail(`${name} 缺少参数值。`);
  }
  return value;
}

function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(`${name} 必须是大于 0 的整数。`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    fail(`${name} 必须是大于等于 0 的整数。`);
  }
  return parsed;
}

function writeAtomicJson(path, value) {
  writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, content, 'utf8');
  try {
    renameSync(tempPath, path);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

function printHumanSummary(summary) {
  process.stdout.write([
    `stable audit: ${summary.solved}/${summary.total} solved`,
    `action mismatches: ${summary.actionMismatches}`,
    `solution mismatches: ${summary.solutionMismatches}`,
    `slow warnings > ${summary.warnMs}ms: ${summary.slowWarnings}`,
    `hard failures > ${summary.failMs}ms: ${summary.hardFailures}`,
    `total elapsed: ${summary.totalElapsedMs}ms`,
    `overhead: ${summary.overheadMs}ms`,
    '',
    'slowest puzzles:',
    ...summary.topSlow.map((row) => [
      `- ${row.id}`,
      `${row.elapsedMs}ms`,
      `solved=${row.solved}`,
      `steps=${row.stepCount}`,
      `score=${row.score}`,
      `hardest=${row.hardestTechnique ?? 'null'}`,
      `stuck=${row.stuckReason ?? 'null'}`,
    ].join(' | ')),
    '',
    'top technique elapsed:',
    ...summary.topTechniques.map((row) => `- ${row.technique}: ${row.elapsedMs}ms`),
  ].join('\n'));
  process.stdout.write('\n');
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
