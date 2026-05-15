#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeGenerationRequest,
  analyzeCandidatePool,
  canonicalizeBoard,
  dedupeCandidates,
  formatStep,
  generateOne,
  getTechniqueDefinitions,
  search,
  selectFromCandidates,
  getJsonSchemas,
  parsePuzzle,
  rate,
  walkthrough,
  validate,
  getPackageInfo,
} from '../index.js';
import type { GenerationRequest } from '../generator/index.js';
import type { CandidateSelectionPlan, GeneratedPuzzle, SearchSummary } from '../generator/index.js';

interface CliResult {
  exitCode: number;
  output: unknown;
}

interface SearchRunRecord {
  startedAt: string;
  finishedAt: string;
  seedStart: number;
  seedEndExclusive: number;
  attempts: number;
  accepted: number;
  rejected: number;
  summary: SearchSummary;
}

interface SearchRunManifest {
  format: 'sudoku.search-manifest';
  version: 1;
  requestHash: string;
  requestIdentity: unknown;
  nextSeed: number;
  runs: SearchRunRecord[];
  createdAt: string;
  updatedAt: string;
}

interface SearchManifestSummary {
  manifests: number;
  requestHashes: Record<string, number>;
  runs: number;
  accepted: number;
  rejected: number;
  attempts: number;
  seedRanges: Array<{
    seedStart: number;
    seedEndExclusive: number;
    attempts: number;
  }>;
  overlaps: Array<{
    left: { seedStart: number; seedEndExclusive: number };
    right: { seedStart: number; seedEndExclusive: number };
  }>;
  gaps: Array<{
    seedStart: number;
    seedEndExclusive: number;
  }>;
  rejectedByReason: Record<string, number>;
  scoreBuckets: Record<string, number>;
  techniqueHits: Record<string, number>;
  bestScore: number | null;
  worstScore: number | null;
}

export function runCli(argv: readonly string[]): CliResult {
  const [command, ...args] = argv;
  try {
    if (!command || command === 'help' || command === '--help' || command === '-h') {
      return {
        exitCode: 0,
        output: buildHelp(),
      };
    }

    if (command === 'version' || command === '--version' || command === '-v') {
      return {
        exitCode: 0,
        output: buildVersion(),
      };
    }

    if (command === 'validate') {
      const puzzle = args[0];
      if (!puzzle) {
        return errorResult('Missing puzzle argument');
      }
      return {
        exitCode: 0,
        output: validate(puzzle),
      };
    }

    if (command === 'canonicalize') {
      const puzzle = args[0];
      if (!puzzle) {
        return errorResult('Missing puzzle argument');
      }
      return {
        exitCode: 0,
        output: canonicalizeBoard(parsePuzzle(puzzle)),
      };
    }

    if (command === 'solve') {
      const puzzle = args[0];
      if (!puzzle) {
        return errorResult('Missing puzzle argument');
      }
      const analysis = walkthrough(puzzle);
      if (getOption(args, '--format') === 'text') {
        const locale = getOption(args, '--locale') === 'zh-CN' ? 'zh-CN' : 'en-US';
        return {
          exitCode: 0,
          output: analysis.steps.map((step, index) => formatStep(step, {
            locale,
            style: 'teaching',
            stepNumber: index + 1,
          })).join('\n'),
        };
      }
      return {
        exitCode: 0,
        output: analysis,
      };
    }

    if (command === 'rate') {
      const puzzle = args[0];
      if (!puzzle) {
        return errorResult('Missing puzzle argument');
      }
      return {
        exitCode: 0,
        output: rate(puzzle),
      };
    }

    if (command === 'schema') {
      const name = args[0];
      const schemas = getJsonSchemas();
      if (!name) {
        return {
          exitCode: 0,
          output: Object.keys(schemas),
        };
      }
      const schema = schemas[name];
      if (!schema) {
        return errorResult(`未知 schema：${name}`);
      }
      return {
        exitCode: 0,
        output: schema,
      };
    }

    if (command === 'techniques') {
      return {
        exitCode: 0,
        output: getTechniqueDefinitions(),
      };
    }

    if (command === 'generator-analyze') {
      const source = args[0];
      if (!source) {
        return errorResult('缺少生成请求 JSON 或文件路径。');
      }
      const request = parseJsonArgument(source);
      return {
        exitCode: 0,
        output: analyzeGenerationRequest(asGenerationRequest(request)),
      };
    }

    if (command === 'generate') {
      const source = args[0];
      if (!source) {
        return errorResult('缺少生成请求 JSON 或文件路径。');
      }
      const request = asGenerationRequest(parseJsonArgument(source));
      return {
        exitCode: 0,
        output: generateOne(request),
      };
    }

    if (command === 'search') {
      const source = args[0];
      if (!source) {
        return errorResult('缺少搜索请求 JSON 或文件路径。');
      }
      let request = asGenerationRequest(parseJsonArgument(source));
      const resumeManifestPath = getOption(args, '--resume-manifest');
      const writeManifestPath = getOption(args, '--write-manifest') ?? resumeManifestPath;
      const startedAt = new Date().toISOString();
      const requestHash = hashSearchRequest(request);
      let existingManifest: SearchRunManifest | null = null;
      if (resumeManifestPath) {
        existingManifest = readSearchManifest(resumeManifestPath);
        assertManifestMatchesRequest(existingManifest, requestHash);
        request = {
          ...request,
          seed: existingManifest.nextSeed,
        };
      } else if (writeManifestPath && existsSync(writeManifestPath) && !args.includes('--overwrite-manifest')) {
        return errorResult(`manifest 已存在，为避免覆盖或重复 seed 段，请使用 --resume-manifest 或 --overwrite-manifest：${writeManifestPath}`);
      }
      const seedStart = request.seed ?? Date.now();
      const events = [...search(request)];
      const doneEvent = events.find((event) => event.type === 'done');
      const writeCandidatesPath = getOption(args, '--write-candidates');
      if (writeCandidatesPath) {
        const candidates = events.flatMap((event) => event.type === 'accepted' ? [event.puzzle] : []);
        const outputCandidates = args.includes('--append-candidates')
          ? [...readJsonArrayIfExists(writeCandidatesPath), ...candidates]
          : candidates;
        mkdirSync(dirname(writeCandidatesPath), { recursive: true });
        writeFileSync(writeCandidatesPath, JSON.stringify(outputCandidates, null, 2), 'utf8');
      }
      const writeSummaryPath = getOption(args, '--write-summary');
      if (writeSummaryPath) {
        const summary = doneEvent?.type === 'done' ? doneEvent.summary : null;
        mkdirSync(dirname(writeSummaryPath), { recursive: true });
        writeFileSync(writeSummaryPath, JSON.stringify(summary, null, 2), 'utf8');
      }
      if (writeManifestPath) {
        const manifest = buildSearchManifest(
          existingManifest,
          request,
          requestHash,
          seedStart,
          startedAt,
          doneEvent?.type === 'done' ? doneEvent.summary : null,
        );
        mkdirSync(dirname(writeManifestPath), { recursive: true });
        writeFileSync(writeManifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      }
      if (args.includes('--summary-only')) {
        return {
          exitCode: 0,
          output: doneEvent ?? null,
        };
      }
      const eventFilter = getOption(args, '--events');
      if (eventFilter) {
        const allowedEvents = new Set(eventFilter.split(',').map((item) => item.trim()).filter(Boolean));
        return {
          exitCode: 0,
          output: events.filter((event) => allowedEvents.has(event.type)),
        };
      }
      return {
        exitCode: 0,
        output: events,
      };
    }

    if (command === 'select') {
      const candidatesSource = args[0];
      const planSource = args[1];
      if (!candidatesSource || !planSource) {
        return errorResult('缺少候选题列表 JSON 文件或选择计划 JSON。');
      }
      const candidates = parseJsonArgument(candidatesSource);
      const plan = parseJsonArgument(planSource);
      if (!Array.isArray(candidates)) {
        return errorResult('候选题列表必须是 JSON array。');
      }
      if (typeof plan !== 'object' || plan === null || Array.isArray(plan)) {
        return errorResult('选择计划必须是 JSON object。');
      }
      const selection = selectFromCandidates(candidates as GeneratedPuzzle[], plan as CandidateSelectionPlan);
      const selectedPath = getOption(args, '--write-selected');
      if (selectedPath) {
        mkdirSync(dirname(selectedPath), { recursive: true });
        writeFileSync(selectedPath, JSON.stringify(selection.selected, null, 2), 'utf8');
      }
      const rejectedPath = getOption(args, '--write-rejected');
      if (rejectedPath) {
        mkdirSync(dirname(rejectedPath), { recursive: true });
        writeFileSync(rejectedPath, JSON.stringify(selection.rejected, null, 2), 'utf8');
      }
      return {
        exitCode: 0,
        output: selection,
      };
    }

    if (command === 'parallel-search-plan') {
      const source = args[0];
      const outputDir = getOption(args, '--out-dir');
      if (!source || !outputDir) {
        return errorResult('缺少搜索请求 JSON 或 --out-dir。');
      }
      const request = asGenerationRequest(parseJsonArgument(source));
      const workers = parsePositiveIntegerOption(args, '--workers', 1);
      const attemptsPerWorker = parsePositiveIntegerOption(args, '--attempts-per-worker', Math.max(1, Number((request as Record<string, unknown>).maxResults ?? 1)));
      const seedStart = parsePositiveIntegerOption(args, '--seed-start', request.seed ?? Date.now());
      const plan = buildParallelSearchPlan(request, outputDir, workers, attemptsPerWorker, seedStart);
      return {
        exitCode: 0,
        output: plan,
      };
    }

    if (command === 'merge-candidates') {
      const outputPath = getOption(args, '--out');
      if (!outputPath) {
        return errorResult('缺少 --out 输出文件。');
      }
      const inputPaths = collectPositionalArgs(args, new Set(['--out']));
      if (inputPaths.length === 0) {
        return errorResult('缺少待合并候选池 JSON 文件。');
      }
      const merged = mergeCandidateFiles(inputPaths, args.includes('--dedupe-canonical'));
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, JSON.stringify(merged.candidates, null, 2), 'utf8');
      return {
        exitCode: 0,
        output: {
          inputFiles: inputPaths.length,
          written: merged.candidates.length,
          duplicatesSkipped: merged.duplicatesSkipped,
          outputPath,
        },
      };
    }

    if (command === 'candidate-stats') {
      const candidatesSource = args[0];
      if (!candidatesSource) {
        return errorResult('缺少候选池 JSON 文件。');
      }
      const candidates = parseJsonArgument(candidatesSource);
      if (!Array.isArray(candidates)) {
        return errorResult('候选池必须是 JSON array。');
      }
      return {
        exitCode: 0,
        output: analyzeCandidatePool(candidates as GeneratedPuzzle[], {
          scoreBucketSize: parsePositiveIntegerOption(args, '--score-bucket-size', 100),
          clueBucketSize: parsePositiveIntegerOption(args, '--clue-bucket-size', 5),
        }),
      };
    }

    if (command === 'dedupe-candidates') {
      const candidatesSource = args[0];
      const outputPath = getOption(args, '--out');
      if (!candidatesSource || !outputPath) {
        return errorResult('缺少候选池 JSON 文件或 --out 输出文件。');
      }
      const candidates = parseJsonArgument(candidatesSource);
      if (!Array.isArray(candidates)) {
        return errorResult('候选池必须是 JSON array。');
      }
      const key = getOption(args, '--key');
      if (key !== null && key !== 'canonical' && key !== 'puzzle') {
        return errorResult('--key 只能是 canonical 或 puzzle。');
      }
      const result = dedupeCandidates(candidates as GeneratedPuzzle[], {
        key: key === 'puzzle' ? 'puzzle' : 'canonical',
      });
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, JSON.stringify(result.candidates, null, 2), 'utf8');
      const rejectedPath = getOption(args, '--write-rejected');
      if (rejectedPath) {
        mkdirSync(dirname(rejectedPath), { recursive: true });
        writeFileSync(rejectedPath, JSON.stringify(result.rejected, null, 2), 'utf8');
      }
      return {
        exitCode: 0,
        output: result,
      };
    }

    if (command === 'manifest-summary') {
      const inputPaths = collectPositionalArgs(args, new Set(['--write-summary']));
      if (inputPaths.length === 0) {
        return errorResult('缺少 search manifest JSON 文件。');
      }
      const summary = summarizeSearchManifests(inputPaths.map((path) => readSearchManifest(path)));
      const outputPath = getOption(args, '--write-summary');
      if (outputPath) {
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf8');
      }
      return {
        exitCode: 0,
        output: summary,
      };
    }

    return errorResult(`Unknown command: ${command}`);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

function buildHelp(): Record<string, unknown> {
  const packageInfo = getPackageInfo();
  return {
    name: 'sudoku',
    package: packageInfo.name,
    version: packageInfo.version,
    commands: [
      {
        command: 'version',
        description: '输出当前 CLI 对应的包名和版本。',
      },
      {
        command: 'validate <puzzle>',
        description: '校验一个标准 9x9 数独题目。',
      },
      {
        command: 'canonicalize <puzzle>',
        description: '输出 canonical.classic9.v1 的 key 和标准化题面。',
      },
      {
        command: 'solve <puzzle>',
        description: '运行当前稳定的人类逻辑求解器。支持 --format text --locale zh-CN。',
      },
      {
        command: 'rate <puzzle>',
        description: '按 classic-stable.v1 评分规则给题目打分。',
      },
      {
        command: 'schema [name]',
        description: '列出或输出当前公开 JSON schema。',
      },
      {
        command: 'techniques',
        description: '列出全部技巧定义及 stability 字段，可用于生成器 allowedTechniques、requiredTechniques 和 preferredTechniques。',
      },
      {
        command: 'generator-analyze <json-or-file>',
        description: '分析生成请求是否存在分数范围和技巧范围冲突。',
      },
      {
        command: 'generate <json-or-file>',
        description: '按生成请求尝试生成一道题，并返回 diagnostics。',
      },
      {
        command: 'search <json-or-file>',
        description: '按搜索请求批量尝试生成。支持 --summary-only、--events、--write-candidates、--append-candidates、--write-summary、--write-manifest 和 --resume-manifest。',
      },
      {
        command: 'select <candidates-json-file> <plan-json-or-file>',
        description: '从候选题列表中按计划筛选结果。支持 --write-selected 和 --write-rejected。',
      },
      {
        command: 'parallel-search-plan <json-or-file> --out-dir <dir> --workers <n> --attempts-per-worker <n>',
        description: '生成互不重叠 seed 段的 search shard 命令，供外部 shell 并行运行。',
      },
      {
        command: 'merge-candidates <file...> --out <file> [--dedupe-canonical]',
        description: '合并多个 shard 候选池文件，可按 canonicalKey 去重。',
      },
      {
        command: 'candidate-stats <candidates-json-file>',
        description: '统计候选池的分数、线索数、技巧、canonical key 和 seed 分布。',
      },
      {
        command: 'dedupe-candidates <candidates-json-file> --out <file> [--key canonical|puzzle]',
        description: '对候选池做独立去重，支持 canonicalKey 或题面字符串作为去重键。',
      },
      {
        command: 'manifest-summary <manifest...>',
        description: '汇总多个 search manifest 的 seed 区间、accepted/rejected、拒绝原因、分桶和技巧覆盖。',
      },
    ],
  };
}

function buildVersion(): Record<string, string> {
  return getPackageInfo();
}

function errorResult(message: string): CliResult {
  return {
    exitCode: 1,
    output: {
      error: message,
    },
  };
}

function getOption(args: readonly string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index < 0) {
    return null;
  }
  return args[index + 1] ?? null;
}

function parsePositiveIntegerOption(args: readonly string[], name: string, fallback: number): number {
  const raw = getOption(args, name);
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} 必须是大于 0 的整数。`);
  }
  return value;
}

function collectPositionalArgs(args: readonly string[], optionsWithValue: Set<string>): string[] {
  const result: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index]!;
    if (optionsWithValue.has(item)) {
      index += 1;
      continue;
    }
    if (item.startsWith('--')) {
      continue;
    }
    result.push(item);
  }
  return result;
}

function parseJsonArgument(source: string): unknown {
  const text = source.trim().startsWith('{')
    ? source
    : readFileSync(source, 'utf8');
  return JSON.parse(text);
}

function readJsonArrayIfExists(path: string): unknown[] {
  if (!existsSync(path)) {
    return [];
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`追加候选题失败，目标文件不是 JSON array：${path}`);
  }
  return parsed;
}

function readSearchManifest(path: string): SearchRunManifest {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!isSearchManifest(parsed)) {
    throw new Error(`续跑 manifest 格式无效：${path}`);
  }
  return parsed;
}

function isSearchManifest(value: unknown): value is SearchRunManifest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const manifest = value as Partial<SearchRunManifest>;
  return manifest.format === 'sudoku.search-manifest'
    && manifest.version === 1
    && typeof manifest.requestHash === 'string'
    && typeof manifest.nextSeed === 'number'
    && Array.isArray(manifest.runs);
}

function assertManifestMatchesRequest(manifest: SearchRunManifest, requestHash: string): void {
  if (manifest.requestHash !== requestHash) {
    throw new Error('续跑 manifest 与当前搜索请求不匹配。请确认分数范围、技巧约束、canonicalize、minimality 和时间预算没有变化。');
  }
}

function buildSearchManifest(
  existing: SearchRunManifest | null,
  request: GenerationRequest,
  requestHash: string,
  seedStart: number,
  startedAt: string,
  summary: SearchSummary | null,
): SearchRunManifest {
  const finishedAt = new Date().toISOString();
  const accepted = summary?.accepted ?? 0;
  const rejected = summary?.rejected ?? 0;
  const attempts = accepted + rejected;
  const seedEndExclusive = seedStart + attempts;
  const run: SearchRunRecord = {
    startedAt,
    finishedAt,
    seedStart,
    seedEndExclusive,
    attempts,
    accepted,
    rejected,
    summary: summary ?? emptySearchSummary(),
  };
  const createdAt = existing?.createdAt ?? startedAt;
  return {
    format: 'sudoku.search-manifest',
    version: 1,
    requestHash,
    requestIdentity: buildSearchRequestIdentity(request),
    nextSeed: Math.max(existing?.nextSeed ?? seedStart, seedEndExclusive),
    runs: [...(existing?.runs ?? []), run],
    createdAt,
    updatedAt: finishedAt,
  };
}

function summarizeSearchManifests(manifests: readonly SearchRunManifest[]): SearchManifestSummary {
  const summary: SearchManifestSummary = {
    manifests: manifests.length,
    requestHashes: {},
    runs: 0,
    accepted: 0,
    rejected: 0,
    attempts: 0,
    seedRanges: [],
    overlaps: [],
    gaps: [],
    rejectedByReason: {},
    scoreBuckets: {},
    techniqueHits: {},
    bestScore: null,
    worstScore: null,
  };

  for (const manifest of manifests) {
    summary.requestHashes[manifest.requestHash] = (summary.requestHashes[manifest.requestHash] ?? 0) + 1;
    for (const run of manifest.runs) {
      summary.runs += 1;
      summary.accepted += run.accepted;
      summary.rejected += run.rejected;
      summary.attempts += run.attempts;
      summary.seedRanges.push({
        seedStart: run.seedStart,
        seedEndExclusive: run.seedEndExclusive,
        attempts: run.attempts,
      });
      mergeCountRecord(summary.rejectedByReason, run.summary.rejectedByReason);
      mergeCountRecord(summary.scoreBuckets, run.summary.scoreBuckets);
      mergeCountRecord(summary.techniqueHits, run.summary.techniqueHits as Record<string, number>);
      if (run.summary.bestScore !== null) {
        summary.bestScore = summary.bestScore === null ? run.summary.bestScore : Math.max(summary.bestScore, run.summary.bestScore);
      }
      if (run.summary.worstScore !== null) {
        summary.worstScore = summary.worstScore === null ? run.summary.worstScore : Math.min(summary.worstScore, run.summary.worstScore);
      }
    }
  }

  summary.seedRanges.sort((left, right) => left.seedStart - right.seedStart || left.seedEndExclusive - right.seedEndExclusive);
  for (let index = 1; index < summary.seedRanges.length; index += 1) {
    const previous = summary.seedRanges[index - 1]!;
    const current = summary.seedRanges[index]!;
    if (current.seedStart < previous.seedEndExclusive) {
      summary.overlaps.push({
        left: {
          seedStart: previous.seedStart,
          seedEndExclusive: previous.seedEndExclusive,
        },
        right: {
          seedStart: current.seedStart,
          seedEndExclusive: current.seedEndExclusive,
        },
      });
    } else if (current.seedStart > previous.seedEndExclusive) {
      summary.gaps.push({
        seedStart: previous.seedEndExclusive,
        seedEndExclusive: current.seedStart,
      });
    }
  }
  return summary;
}

function mergeCountRecord(output: Record<string, number>, input: Record<string, number>): void {
  for (const [key, count] of Object.entries(input)) {
    output[key] = (output[key] ?? 0) + count;
  }
}

function emptySearchSummary(): SearchSummary {
  return {
    accepted: 0,
    rejected: 0,
    rejectedByReason: {},
    scoreBuckets: {},
    techniqueHits: {},
    bestScore: null,
    worstScore: null,
  };
}

function hashSearchRequest(request: GenerationRequest): string {
  return createHash('sha256')
    .update(stableStringify(buildSearchRequestIdentity(request)))
    .digest('hex');
}

function buildSearchRequestIdentity(request: GenerationRequest): unknown {
  const input = request as Record<string, unknown>;
  const budget = typeof input.budget === 'object' && input.budget !== null && !Array.isArray(input.budget)
    ? { ...(input.budget as Record<string, unknown>) }
    : undefined;
  if (budget) {
    delete budget.maxAttempts;
  }
  return {
    ...input,
    seed: undefined,
    maxResults: undefined,
    budget,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

function buildParallelSearchPlan(
  request: GenerationRequest,
  outputDir: string,
  workers: number,
  attemptsPerWorker: number,
  seedStart: number,
): Array<{
  worker: number;
  seedStart: number;
  seedEndExclusive: number;
  request: GenerationRequest;
  candidatesPath: string;
  summaryPath: string;
  manifestPath: string;
  command: string;
}> {
  const cliPath = process.argv[1]?.endsWith('index.js')
    ? process.argv[1]
    : 'dist/src/cli/index.js';
  return Array.from({ length: workers }, (_, index) => {
    const worker = index + 1;
    const workerSeedStart = seedStart + index * attemptsPerWorker;
    const shardRequest: GenerationRequest = {
      ...request,
      seed: workerSeedStart,
      budget: {
        ...request.budget,
        maxAttempts: attemptsPerWorker,
      },
    };
    const prefix = `worker-${String(worker).padStart(2, '0')}`;
    const candidatesPath = join(outputDir, `${prefix}-candidates.json`);
    const summaryPath = join(outputDir, `${prefix}-summary.json`);
    const manifestPath = join(outputDir, `${prefix}-manifest.json`);
    const requestJson = JSON.stringify(shardRequest);
    const command = [
      'node',
      shellQuote(cliPath),
      'search',
      shellQuote(requestJson),
      '--summary-only',
      '--write-candidates',
      shellQuote(candidatesPath),
      '--write-summary',
      shellQuote(summaryPath),
      '--write-manifest',
      shellQuote(manifestPath),
      '--overwrite-manifest',
    ].join(' ');
    return {
      worker,
      seedStart: workerSeedStart,
      seedEndExclusive: workerSeedStart + attemptsPerWorker,
      request: shardRequest,
      candidatesPath,
      summaryPath,
      manifestPath,
      command,
    };
  });
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function mergeCandidateFiles(paths: readonly string[], dedupeCanonical: boolean): {
  candidates: GeneratedPuzzle[];
  duplicatesSkipped: number;
} {
  const rawCandidates: GeneratedPuzzle[] = [];
  for (const path of paths) {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`候选池文件必须是 JSON array：${path}`);
    }
    rawCandidates.push(...parsed as GeneratedPuzzle[]);
  }
  if (!dedupeCanonical) {
    return { candidates: rawCandidates, duplicatesSkipped: 0 };
  }
  const deduped = dedupeCandidates(rawCandidates, { key: 'canonical' });
  return {
    candidates: deduped.candidates,
    duplicatesSkipped: deduped.diagnostics.removed,
  };
}

function asGenerationRequest(value: unknown): GenerationRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('生成请求必须是 JSON object。');
  }
  return value as GenerationRequest;
}

if (isMainModule()) {
  const result = runCli(process.argv.slice(2));
  process.stdout.write(typeof result.output === 'string'
    ? `${result.output}\n`
    : `${JSON.stringify(result.output, null, 2)}\n`);
  process.exitCode = result.exitCode;
}

function isMainModule(): boolean {
  if (!process.argv[1]) {
    return false;
  }
  return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
}
