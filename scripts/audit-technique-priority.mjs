#!/usr/bin/env node
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';

import {
  analyzeSolve,
  buildSolveOptionsFromRatingPolicy,
  getRatingPolicy,
  getTechniqueDefinitions,
  parsePuzzle,
  replaySteps,
  serializeBoard,
} from '../dist/src/index.js';

const require = createRequire(import.meta.url);
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultInputPaths = [
  '../../../temp/audit/epic-expert-rebalance-preview-full-consolidated/expert.ts',
  '../../../temp/audit/epic-expert-rebalance-preview-full-consolidated/epic.ts',
].map((path) => resolve(root, path));

const DEFAULT_TARGET_TECHNIQUES = [
  'direct-pointing',
  'direct-claiming',
  'direct-hidden-pair',
  'direct-hidden-triplet',
  'bidirectional-x-cycle',
  'bidirectional-y-cycle',
  'forcing-x-chain',
  'forcing-chain',
];
const techniqueDefinitions = getTechniqueDefinitions();
const KNOWN_TECHNIQUES = techniqueDefinitions.map((definition) => definition.id);
const EXPERIMENTAL_TECHNIQUES = techniqueDefinitions
  .filter((definition) => definition.stability === 'experimental')
  .map((definition) => definition.id);

const options = parseArgs(process.argv.slice(2));
const inputPaths = options.inputPaths.length > 0 ? options.inputPaths : defaultInputPaths.filter((path) => existsSync(path));
if (inputPaths.length === 0) {
  fail('没有可用输入。请用 --input <expert.ts|epic.ts|json|jsonl> 指定题库。');
}

const rows = inputPaths.flatMap((inputPath) => loadPuzzleRows(inputPath))
  .slice(0, options.limit ?? Number.POSITIVE_INFINITY);
if (rows.length === 0) {
  fail(`没有从题集读取到可审计题目：${inputPaths.join(', ')}`);
}

const galaxyPolicy = getRatingPolicy('classic-galaxy');
const galaxyOptions = buildSolveOptionsFromRatingPolicy(galaxyPolicy);
const startedAt = performance.now();
const techniqueResults = [];
const learningSamples = [];

writeProgressSnapshot(techniqueResults);
for (const technique of options.techniques) {
  printTechniqueStart(technique);
  const result = auditTechnique(technique, rows);
  techniqueResults.push(result);
  writeProgressSnapshot(techniqueResults);
}

const payload = buildOutputPayload(techniqueResults);
const summary = payload.summary;
writeAtomicJson(options.outputPath, payload);
writeExamplesSnapshot();

if (options.json) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  printHumanSummary(summary);
  process.stdout.write(`\nfull audit written to ${options.outputPath}\n`);
  if (options.examplesOutputPath) {
    process.stdout.write(`learning samples written to ${options.examplesOutputPath}\n`);
  }
}

if (summary.techniques.some((result) => result.errors > 0)) {
  process.exitCode = 1;
}

function auditTechnique(technique, puzzleRows) {
  const started = performance.now();
  const allowedTechniques = uniqueStrings([
    ...(galaxyOptions.allowedTechniques ?? []),
    technique,
  ]);
  const preferredTechniques = [
    technique,
    ...galaxyPolicy.techniqueOrder.filter((id) => id !== technique),
    ...(galaxyPolicy.fallbackTechniques ?? []).filter((id) => id !== technique),
  ];
  const samples = [];
  const result = {
    technique,
    scanned: 0,
    hits: 0,
    errors: 0,
    solved: 0,
    elapsedMs: 0,
    firstHit: null,
    learningSamples: samples,
    rows: [],
  };

  for (const row of puzzleRows) {
    const rowResult = auditTechniqueOnPuzzle(technique, row, preferredTechniques, allowedTechniques);
    result.rows.push(rowResult);
    result.scanned = result.rows.length;
    if (rowResult.solved) {
      result.solved += 1;
    }
    if (rowResult.error || rowResult.actionIssues.length > 0 || rowResult.replayError) {
      result.errors += 1;
    }
    if (rowResult.hit) {
      result.hits += 1;
      if (!result.firstHit) {
        result.firstHit = {
          source: row.source,
          id: row.id,
          difficulty: row.difficulty,
          stepIndex: rowResult.firstHitStepIndex,
          puzzle: rowResult.puzzle,
        };
      }
      if (samples.length < options.maxExamplesPerTechnique) {
        const sample = buildLearningSample(technique, row, rowResult);
        samples.push(sample);
        learningSamples.push(sample);
      }
    }
    result.elapsedMs = Math.round(performance.now() - started);
    printPuzzleProgress(result, rowResult, puzzleRows.length);
    writeProgressSnapshot([...techniqueResults, result]);
  }

  result.elapsedMs = Math.round(performance.now() - started);
  return result;
}

function auditTechniqueOnPuzzle(technique, row, preferredTechniques, allowedTechniques) {
  const started = performance.now();
  try {
    const analysis = analyzeSolve(row.puzzle, {
      ...galaxyOptions,
      allowedTechniques,
      preferredTechniques,
      fallbackTechniques: [],
      maxSteps: row.maxSteps ?? options.maxSteps,
      includeUsage: true,
    });
    const hitStepIndexes = analysis.steps
      .map((step, index) => step.technique === technique ? index + 1 : null)
      .filter((index) => index !== null);
    const actionIssues = auditActionsAgainstSolution(analysis.steps, row.solution);
    let replayError = null;
    let finalMatchesSolution = null;
    if (analysis.solved && row.solution) {
      try {
        finalMatchesSolution = serializeBoard(replaySteps(row.puzzle, analysis.steps)) === serializeBoard(row.solution);
        if (!finalMatchesSolution) {
          actionIssues.push({ reason: 'final-board-mismatch', message: 'Replayed solved board does not match known solution.' });
        }
      } catch (error) {
        replayError = error instanceof Error ? error.message : String(error);
      }
    }
    return {
      source: row.source,
      id: row.id,
      difficulty: row.difficulty,
      puzzle: serializeBoard(row.puzzle),
      hit: hitStepIndexes.length > 0,
      hitStepIndexes,
      firstHitStepIndex: hitStepIndexes[0] ?? null,
      solved: analysis.solved,
      score: analysis.score,
      hardestTechnique: analysis.hardestTechnique,
      stepCount: analysis.steps.length,
      stuckReason: analysis.stuckReason ?? null,
      elapsedMs: Math.round(performance.now() - started),
      actionIssues,
      replayError,
      finalMatchesSolution,
      targetStep: hitStepIndexes.length > 0 ? analysis.steps[hitStepIndexes[0] - 1] : null,
      error: null,
    };
  } catch (error) {
    return {
      source: row.source,
      id: row.id,
      difficulty: row.difficulty,
      puzzle: serializeBoard(row.puzzle),
      hit: false,
      hitStepIndexes: [],
      firstHitStepIndex: null,
      solved: false,
      score: 0,
      hardestTechnique: null,
      stepCount: 0,
      stuckReason: null,
      elapsedMs: Math.round(performance.now() - started),
      actionIssues: [],
      replayError: null,
      finalMatchesSolution: null,
      targetStep: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function auditActionsAgainstSolution(steps, solution) {
  if (!solution) {
    return [];
  }
  const issues = [];
  for (const [stepIndex, step] of steps.entries()) {
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
  return issues;
}

function buildLearningSample(technique, row, rowResult) {
  return {
    technique,
    source: row.source,
    id: row.id,
    difficulty: row.difficulty,
    puzzle: rowResult.puzzle,
    solution: row.solution ? serializeBoard(row.solution) : null,
    score: row.score ?? null,
    hardestTechnique: row.hardestTechnique ?? null,
    hitStepIndex: rowResult.firstHitStepIndex,
    targetStep: rowResult.targetStep,
  };
}

function buildOutputPayload(results) {
  const summary = {
    profile: 'classic-galaxy.v1',
    mode: 'target-technique-first',
    inputs: inputPaths,
    totalPuzzles: rows.length,
    targetTechniques: options.techniques,
    maxSteps: options.maxSteps,
    totalElapsedMs: Math.round(performance.now() - startedAt),
    updatedAt: new Date().toISOString(),
    complete: results.length === options.techniques.length && results.every((result) => result.scanned === rows.length),
    techniques: results.map((result) => ({
      technique: result.technique,
      scanned: result.scanned,
      hits: result.hits,
      errors: result.errors,
      solved: result.solved,
      elapsedMs: result.elapsedMs,
      firstHit: result.firstHit,
    })),
  };
  return {
    summary,
    learningSamples,
    techniques: results.map(({ learningSamples: _learningSamples, ...result }) => result),
  };
}

function writeProgressSnapshot(results) {
  if (!options.flushEach) {
    return;
  }
  writeAtomicJson(options.outputPath, buildOutputPayload(results));
  writeExamplesSnapshot();
}

function writeExamplesSnapshot() {
  if (!options.examplesOutputPath) {
    return;
  }
  writeAtomicJson(options.examplesOutputPath, {
    generatedAt: new Date().toISOString(),
    sourceAudit: options.outputPath,
    samples: learningSamples,
  });
}

function printTechniqueStart(technique) {
  if (!options.progress) {
    return;
  }
  process.stdout.write(`\n[technique] ${technique} started, puzzles=${rows.length}\n`);
}

function printPuzzleProgress(result, rowResult, total) {
  if (!options.progress) {
    return;
  }
  const status = rowResult.error
    ? 'ERROR'
    : rowResult.replayError || rowResult.actionIssues.length > 0
      ? 'ISSUE'
      : rowResult.hit
        ? 'HIT'
        : 'miss';
  const hitAt = rowResult.firstHitStepIndex === null ? '-' : String(rowResult.firstHitStepIndex);
  process.stdout.write([
    `[${new Date().toISOString()}]`,
    result.technique,
    `${result.scanned}/${total}`,
    rowResult.id,
    status,
    `hitStep=${hitAt}`,
    `solved=${rowResult.solved}`,
    `steps=${rowResult.stepCount}`,
    `elapsed=${rowResult.elapsedMs}ms`,
    `hits=${result.hits}`,
    `errors=${result.errors}`,
    `out=${options.outputPath}`,
  ].join(' '));
  process.stdout.write('\n');
}

function parseArgs(args) {
  const parsed = {
    inputPaths: [],
    outputPath: resolve(root, 'dist/tmp/technique-priority-audit.json'),
    examplesOutputPath: resolve(root, 'dist/tmp/technique-priority-learning-samples.json'),
    limit: null,
    maxSteps: 1024,
    maxExamplesPerTechnique: 20,
    techniques: null,
    json: false,
    progress: true,
    flushEach: true,
  };
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--json') {
      parsed.json = true;
      parsed.progress = false;
      continue;
    }
    if (item === '--no-progress') {
      parsed.progress = false;
      continue;
    }
    if (item === '--no-flush-each') {
      parsed.flushEach = false;
      continue;
    }
    if (item === '--experimental') {
      parsed.techniques = EXPERIMENTAL_TECHNIQUES;
      continue;
    }
    if (item === '--default-reference') {
      parsed.techniques = DEFAULT_TARGET_TECHNIQUES;
      continue;
    }
    if (item === '--input') {
      parsed.inputPaths.push(resolve(requireValue(args, index, item)));
      index += 1;
      continue;
    }
    if (item === '--output') {
      parsed.outputPath = resolve(requireValue(args, index, item));
      index += 1;
      continue;
    }
    if (item === '--examples-output') {
      parsed.examplesOutputPath = resolve(requireValue(args, index, item));
      index += 1;
      continue;
    }
    if (item === '--no-examples-output') {
      parsed.examplesOutputPath = null;
      continue;
    }
    if (item === '--limit') {
      parsed.limit = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--max-steps') {
      parsed.maxSteps = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--max-examples-per-technique') {
      parsed.maxExamplesPerTechnique = parseNonNegativeInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--technique') {
      const technique = requireValue(args, index, item);
      if (!KNOWN_TECHNIQUES.includes(technique)) {
        fail(`未知技巧：${technique}`);
      }
      parsed.techniques = uniqueStrings([...(parsed.techniques ?? []), technique]);
      index += 1;
      continue;
    }
    fail(`未知参数：${item}`);
  }
  parsed.techniques = parsed.techniques ?? DEFAULT_TARGET_TECHNIQUES;
  return parsed;
}

function loadPuzzleRows(inputPath) {
  const absolutePath = resolve(inputPath);
  if (!existsSync(absolutePath)) {
    fail(`题集文件不存在：${absolutePath}`);
  }
  const extension = extname(absolutePath).toLowerCase();
  let raw;
  if (extension === '.json') {
    raw = JSON.parse(readFileSync(absolutePath, 'utf8'));
  } else if (extension === '.ndjson' || extension === '.jsonl') {
    raw = readFileSync(absolutePath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
  } else if (extension === '.js' || extension === '.cjs') {
    raw = require(absolutePath);
  } else if (extension === '.ts') {
    raw = loadTsModule(absolutePath);
  } else {
    fail(`不支持的题集格式：${extension || '<none>'}`);
  }
  return normalizeRows(raw, absolutePath);
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
  const localRequire = createRequire(absolutePath);
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', transpiled.outputText); // eslint-disable-line no-new-func
  fn(module.exports, localRequire, module, absolutePath, dirname(absolutePath));
  return module.exports;
}

function normalizeRows(value, source) {
  const rawRows = Array.isArray(value) ? value : pickExportedRows(value);
  return rawRows.map((row, index) => normalizeRow(row, index, source));
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

function normalizeRow(row, index, source) {
  if (!row || typeof row !== 'object') {
    fail(`第 ${index + 1} 项不是题面对象：${source}`);
  }
  const puzzle = row.puzzle ?? row.grid ?? row.board;
  const solution = row.solution ?? row.answer;
  if (!puzzle) {
    fail(`第 ${index + 1} 项缺少 puzzle/grid/board：${source}`);
  }
  return {
    source,
    id: String(row.id ?? row.name ?? index + 1),
    difficulty: typeof row.difficulty === 'string' ? row.difficulty : inferDifficulty(source),
    puzzle: parsePuzzle(puzzle),
    ...(solution ? { solution: parsePuzzle(solution) } : {}),
    ...(row.score === undefined ? {} : { score: row.score }),
    ...(row.hardestTechnique === undefined ? {} : { hardestTechnique: row.hardestTechnique }),
    ...(row.maxSteps === undefined ? {} : { maxSteps: parsePositiveInteger(row.maxSteps, `第 ${index + 1} 项 maxSteps`) }),
  };
}

function inferDifficulty(source) {
  const lower = source.toLowerCase();
  if (lower.includes('epic')) {
    return 'epic';
  }
  if (lower.includes('expert')) {
    return 'expert';
  }
  return null;
}

function requireValue(args, index, name) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    fail(`${name} 缺少参数值。`);
  }
  return value;
}

function uniqueStrings(values) {
  return Array.from(new Set(values));
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
    `technique priority audit: ${summary.totalPuzzles} puzzles, ${summary.targetTechniques.length} target techniques`,
    `inputs: ${summary.inputs.join(', ')}`,
    `total elapsed: ${summary.totalElapsedMs}ms`,
    '',
    'per technique:',
    ...summary.techniques.map((row) => [
      `- ${row.technique}`,
      `hits=${row.hits}/${row.scanned}`,
      `errors=${row.errors}`,
      `solved=${row.solved}`,
      `${row.elapsedMs}ms`,
      `firstHit=${row.firstHit ? `${row.firstHit.id}@${row.firstHit.stepIndex}` : 'none'}`,
    ].join(' | ')),
  ].join('\n'));
  process.stdout.write('\n');
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
