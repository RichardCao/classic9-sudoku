#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const DEFAULT_OUTPUT_DIR = 'dist/tmp/reference-gap-audit';
const DEFAULT_EXCLUDE_CORPUS = 'tests/fixtures/reference-techniques/reference-rating-corpus.json';
const BUILT_IN_PROFILES = new Set(['classic-stable', 'classic-extended', 'classic-galaxy']);

const TARGET_GROUPS = {
  direct: [
    'direct-pointing',
    'direct-claiming',
    'direct-hidden-pair',
    'direct-hidden-triplet',
  ],
  uniqueness: [
    'bug-plus-one',
    'bug-plus-two',
    'bug-plus-n',
    'unique-rectangle',
    'hidden-unique-rectangle',
    'extended-rectangle',
    'unique-loop',
  ],
  chain: [
    'bidirectional-x-cycle',
    'bidirectional-y-cycle',
    'forcing-x-chain',
    'skyscraper',
    'two-string-kite',
    'turbot-fish',
    'empty-rectangle',
  ],
  'als-fish-wing': [
    'remote-pairs',
    'almost-locked-quad',
    'finned-franken-swordfish',
    'finned-franken-jellyfish',
    'sashimi-x-wing',
    'larger-fish',
    'mutant-fish',
    'big-wings',
    'aic-als',
  ],
  'hard-gaps': [
    'remote-pairs',
    'almost-locked-quad',
    'larger-fish',
    'mutant-fish',
  ],
  'stable-gaps': [
    'hidden-single',
    'locked-candidates',
    'naked-pair',
    'hidden-pair',
    'naked-triple',
    'hidden-triple',
    'naked-quad',
    'hidden-quad',
    'x-wing',
    'sashimi-jellyfish',
    'skyscraper',
    'two-string-kite',
    'turbot-fish',
    'empty-rectangle',
    'unique-rectangle',
    'hidden-unique-rectangle',
    'extended-rectangle',
    'bug-plus-one',
  ],
};

const DEFAULT_SOURCES = [
  { id: 'bug-external-leads', path: 'docs/BUG_EXTERNAL_LEADS.txt' },
  { id: 'learning-game-500', path: 'dist/tmp/learning/game-500-source.json' },
  {
    id: 'learning-overused-alternatives',
    path: 'dist/tmp/learning/classic9-game-500-alternatives-overused-gt-4/input-filtered-sorted.json',
  },
  { id: 'all-local-puzzle-candidates', path: 'dist/tmp/all-local-puzzle-candidates.txt' },
  { id: 'repo-puzzle-candidates', path: 'dist/tmp/repo-puzzle-candidates.txt' },
];

const options = parseArgs(process.argv.slice(2));
const startedAt = performance.now();
const outputDir = resolve(process.cwd(), options.outputDir);
mkdirSync(outputDir, { recursive: true });

const runs = [];
let executedRuns = 0;
let failedRuns = 0;
let skippedRuns = 0;
let totalMatched = 0;
let totalScanned = 0;
let stoppedEarlyRuns = 0;

for (const groupId of options.groups) {
  const targetTechniques = TARGET_GROUPS[groupId];
  for (const source of options.sources) {
    const inputPath = resolve(process.cwd(), source.path);
    const outputPath = resolve(outputDir, `${sanitizeFileName(groupId)}--${sanitizeFileName(source.id)}.json`);
    if (!existsSync(inputPath)) {
      skippedRuns += 1;
      runs.push({
        group: groupId,
        sourceId: source.id,
        input: source.path,
        output: relativeToCwd(outputPath),
        status: 'skipped',
        reason: 'missing-input',
        targetTechniques,
      });
      continue;
    }

    const result = runCandidateSearch({
      groupId,
      source,
      targetTechniques,
      outputPath,
      options,
    });
    runs.push(result);
    if (result.status === 'failed') {
      failedRuns += 1;
      continue;
    }
    executedRuns += 1;
    totalMatched += result.matched ?? 0;
    totalScanned += result.scanned ?? 0;
    if (result.stoppedEarly) {
      stoppedEarlyRuns += 1;
    }
  }
}

const payload = {
  summary: {
    auditId: 'reference-gap-audit.v1',
    profile: options.profile,
    groups: options.groups,
    sources: options.sources.map((source) => ({ id: source.id, path: source.path })),
    outputDir: options.outputDir,
    totalRuns: options.groups.length * options.sources.length,
    executedRuns,
    failedRuns,
    skippedRuns,
    totalScanned,
    totalMatched,
    stoppedEarlyRuns,
    maxRows: options.maxRows,
    maxMisses: options.maxMisses,
    maxPuzzles: options.maxPuzzles,
    startRow: options.startIndex + 1,
    maxElapsedMs: options.maxElapsedMs,
    includeMisses: options.includeMisses,
    excludeCorpus: options.excludeCorpusPath,
    elapsedMs: Math.round(performance.now() - startedAt),
  },
  runs,
};

const summaryPath = resolve(outputDir, 'summary.json');
writeFileSync(summaryPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

if (options.json) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  printHumanSummary(payload, relativeToCwd(summaryPath));
}

if (failedRuns > 0) {
  process.exitCode = 1;
}

function runCandidateSearch({ groupId, source, targetTechniques, outputPath, options: searchOptions }) {
  const args = [
    'scripts/find-reference-rating-candidates.mjs',
    '--input',
    source.path,
    '--profile',
    searchOptions.profile,
    '--target',
    targetTechniques.join(','),
    '--max-rows',
    String(searchOptions.maxRows),
    '--max-misses',
    String(searchOptions.maxMisses),
    '--output',
    relativeToCwd(outputPath),
    '--json',
  ];
  if (searchOptions.includeMisses) {
    args.push('--include-misses');
  }
  if (searchOptions.maxPuzzles !== null) {
    args.push('--max-puzzles', String(searchOptions.maxPuzzles));
  }
  if (searchOptions.startIndex > 0) {
    args.push('--start-row', String(searchOptions.startIndex + 1));
  }
  if (searchOptions.maxElapsedMs !== null) {
    args.push('--max-elapsed-ms', String(searchOptions.maxElapsedMs));
  }
  if (searchOptions.excludeCorpusPath && existsSync(resolve(process.cwd(), searchOptions.excludeCorpusPath))) {
    args.push('--exclude-corpus', searchOptions.excludeCorpusPath);
  }

  const started = performance.now();
  const child = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16,
  });

  if (child.status !== 0) {
    return {
      group: groupId,
      sourceId: source.id,
      input: source.path,
      output: relativeToCwd(outputPath),
      status: 'failed',
      targetTechniques,
      exitCode: child.status,
      error: trimForSummary(child.stderr || child.stdout || 'candidate search failed'),
      elapsedMs: Math.round(performance.now() - started),
    };
  }

  let payload;
  try {
    payload = JSON.parse(child.stdout || readFileSync(outputPath, 'utf8'));
  } catch (error) {
    return {
      group: groupId,
      sourceId: source.id,
      input: source.path,
      output: relativeToCwd(outputPath),
      status: 'failed',
      targetTechniques,
      error: `invalid-json:${formatError(error)}`,
      elapsedMs: Math.round(performance.now() - started),
    };
  }

  const summary = payload.summary ?? {};
  return {
    group: groupId,
    sourceId: source.id,
    input: source.path,
    output: relativeToCwd(outputPath),
    status: 'ok',
    targetTechniques,
    scanned: summary.scanned ?? 0,
    excluded: summary.excluded ?? 0,
    matched: summary.matched ?? 0,
    misses: summary.misses ?? 0,
    rowCount: Array.isArray(payload.rows) ? payload.rows.length : 0,
    stoppedEarly: summary.stoppedEarly === true,
    stopReason: summary.stopReason ?? null,
    elapsedMs: summary.elapsedMs ?? Math.round(performance.now() - started),
  };
}

function parseArgs(args) {
  const parsed = {
    outputDir: DEFAULT_OUTPUT_DIR,
    profile: 'classic-galaxy',
    groups: Object.keys(TARGET_GROUPS),
    sources: DEFAULT_SOURCES,
    maxRows: 5,
    maxMisses: 3,
    maxPuzzles: null,
    startIndex: 0,
    maxElapsedMs: 5000,
    includeMisses: true,
    excludeCorpusPath: DEFAULT_EXCLUDE_CORPUS,
    json: false,
  };
  const sourceSpecs = [];
  const groupSpecs = [];

  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--json') {
      parsed.json = true;
      continue;
    }
    if (item === '--no-include-misses') {
      parsed.includeMisses = false;
      continue;
    }
    if (item === '--no-exclude-corpus') {
      parsed.excludeCorpusPath = null;
      continue;
    }
    if (item === '--output-dir') {
      parsed.outputDir = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--profile') {
      parsed.profile = normalizeProfile(requireValue(args, index, item));
      index += 1;
      continue;
    }
    if (item === '--group') {
      groupSpecs.push(...parseList(requireValue(args, index, item)));
      index += 1;
      continue;
    }
    if (item === '--source') {
      sourceSpecs.push(...parseList(requireValue(args, index, item)));
      index += 1;
      continue;
    }
    if (item === '--exclude-corpus') {
      parsed.excludeCorpusPath = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--max-rows') {
      parsed.maxRows = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--max-misses') {
      parsed.maxMisses = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--max-puzzles') {
      parsed.maxPuzzles = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--start-row') {
      parsed.startIndex = parsePositiveInteger(requireValue(args, index, item), item) - 1;
      index += 1;
      continue;
    }
    if (item === '--max-elapsed-ms') {
      parsed.maxElapsedMs = parseNonNegativeInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${item}`);
  }

  if (groupSpecs.length > 0) {
    parsed.groups = groupSpecs.map((group) => normalizeGroup(group));
  }
  if (sourceSpecs.length > 0) {
    parsed.sources = sourceSpecs.map((source) => parseSourceSpec(source));
  }
  if (parsed.groups.length === 0) {
    throw new Error('At least one --group is required.');
  }
  if (parsed.sources.length === 0) {
    throw new Error('At least one --source is required.');
  }
  return parsed;
}

function normalizeGroup(value) {
  if (!Object.hasOwn(TARGET_GROUPS, value)) {
    throw new Error(`Unknown target group: ${value}. Known groups: ${Object.keys(TARGET_GROUPS).join(', ')}`);
  }
  return value;
}

function parseSourceSpec(spec) {
  const separator = spec.indexOf('=');
  if (separator > 0) {
    const id = spec.slice(0, separator).trim();
    const path = spec.slice(separator + 1).trim();
    if (!id || !path) {
      throw new Error(`Invalid --source value: ${spec}`);
    }
    return { id, path };
  }
  return {
    id: basename(spec).replace(/\.[^.]+$/, '') || 'source',
    path: spec,
  };
}

function normalizeProfile(value) {
  const id = value.startsWith('classic-') ? value : `classic-${value}`;
  if (!BUILT_IN_PROFILES.has(id)) {
    throw new Error('--profile must be stable, extended or galaxy.');
  }
  return id;
}

function parseList(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parsePositiveInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${option} must be a non-negative integer.`);
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

function sanitizeFileName(value) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'item';
}

function relativeToCwd(path) {
  const cwd = `${process.cwd()}/`;
  return path.startsWith(cwd) ? path.slice(cwd.length) : path;
}

function trimForSummary(text) {
  return text.trim().split(/\r?\n/).slice(0, 12).join('\n');
}

function printHumanSummary(payload, summaryPath) {
  const summary = payload.summary;
  process.stdout.write(`Reference gap audit: ${summary.totalMatched}/${summary.totalScanned} matched across ${summary.executedRuns}/${summary.totalRuns} runs\n`);
  process.stdout.write(`Summary: ${summaryPath}\n`);
  if (summary.skippedRuns > 0) {
    process.stdout.write(`Skipped missing inputs: ${summary.skippedRuns}\n`);
  }
  if (summary.failedRuns > 0) {
    process.stdout.write(`Failed runs: ${summary.failedRuns}\n`);
  }
  if (summary.stoppedEarlyRuns > 0) {
    process.stdout.write(`Stopped early by budget: ${summary.stoppedEarlyRuns}\n`);
  }
  for (const run of payload.runs) {
    if (run.status === 'skipped') {
      process.stdout.write(`- ${run.group}/${run.sourceId}: skipped (${run.reason})\n`);
      continue;
    }
    if (run.status === 'failed') {
      process.stdout.write(`- ${run.group}/${run.sourceId}: failed (${run.error})\n`);
      continue;
    }
    process.stdout.write(`- ${run.group}/${run.sourceId}: matched=${run.matched}/${run.scanned}; misses=${run.misses}; output=${run.output}\n`);
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
