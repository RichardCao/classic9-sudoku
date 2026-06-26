#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  analyzeSolve,
  analyzeGenerationRequest,
  assertValidSearchRequest,
  analyzeCandidatePool,
  buildSolveOptionsFromRatingPolicy,
  canonicalizeBoard,
  dedupeCandidates,
  findSteps,
  formatStep,
  generateOne,
  getRatingPolicy,
  getTechniqueDefinitions,
  search,
  selectFromCandidates,
  getJsonSchemas,
  nextStep,
  parsePuzzle,
  rate,
  verifyStep,
  verifyWalkthrough,
  walkthrough,
  validate,
  validateCandidatePool,
  getPackageInfo,
} from '../index.js';
import type { GenerationEvent, GenerationRequest, SearchRequest } from '../generator/index.js';
import type { CandidateSelectionPlan, GeneratedPuzzle, SearchSummary } from '../generator/index.js';
import type { Board } from '../core/types.js';
import type { RatingPolicy } from '../rating/index.js';
import { buildDefaultTechniques } from '../solver/techniques.js';
import { MAX_SEED, defaultSeed } from '../generator/random.js';
import type {
  FindStepsOptions,
  SolveOptions,
  SolveStep,
  SolverUsageReport,
  StepVerificationOptions,
  TechniqueId,
} from '../solver/index.js';

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

const SEARCH_EVENT_TYPES = new Set(['accepted', 'rejected', 'done']);

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

interface BatchPuzzleInput {
  puzzleId: string;
  puzzle: string;
  sourceIndex: number;
}

interface BatchPuzzleResult {
  puzzleId: string;
  puzzle: string;
  sourceIndex?: number;
  ok?: boolean;
  solved: boolean;
  score?: number;
  hardestTechnique?: TechniqueId | null;
  hardestScore?: number;
  stepCount: number;
  placementCount: number;
  eliminationCount: number;
  stuckReason?: string;
  elapsedMs: number;
  grade?: string | null;
  steps?: unknown[];
  error?: string;
}

interface BatchSummary {
  puzzles: number;
  solved: number;
  unsolved: number;
  failed: number;
  solveRate: number;
  totalElapsedMs: number;
  avgElapsedMs: number;
  scoreMin?: number;
  scoreMax?: number;
  scoreAvg?: number;
  hardestTechniqueCounts: Partial<Record<TechniqueId, number>>;
  stuckReasonCounts: Record<string, number>;
}

interface BatchCliConfig {
  includeSteps: boolean;
  includeUsage: boolean;
  format: 'json' | 'jsonl' | 'csv' | 'text';
  inputPath: string;
  outputPath: string | null;
  summaryPath: string | null;
  usagePath: string | null;
  failFast: boolean;
  puzzles: BatchPuzzleInput[];
  solveOptions: SolveOptions;
  ratingPolicy: RatingPolicy;
}

const CLI_DEFAULT_FALLBACK_TECHNIQUES: readonly TechniqueId[] = [
  'bowmans-bingo',
  'forcing-nets',
  'digit-forcing-chains',
  'cell-forcing-chains',
  'unit-forcing-chains',
  'region-forcing-chains',
  'dynamic-forcing-chains',
  'dynamic-forcing-chains-plus',
];

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
      const analysis = walkthrough(puzzle, buildCliSolveOptions(args));
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
        output: rate(puzzle, buildCliRatingPolicy(args)),
      };
    }

    if (command === 'batch-solve' || command === 'batch-rate') {
      const config = buildBatchCliConfig(args);
      const startedAt = Date.now();
      const usageReports: SolverUsageReport[] = [];
      const results = config.puzzles.map((puzzle) => runBatchPuzzle(
        command,
        puzzle,
        config,
        usageReports,
      ));
      const summary = buildBatchSummary(results, Date.now() - startedAt);
      const usage = config.includeUsage ? aggregateBatchUsage(usageReports) : null;
      if (config.outputPath) {
        writeBatchOutput(config.outputPath, results, config.format);
      }
      if (config.summaryPath) {
        writeJsonAtomic(config.summaryPath, summary);
      }
      if (config.usagePath) {
        writeJsonAtomic(config.usagePath, usage);
      }
      return {
        exitCode: 0,
        output: config.outputPath ? summary : formatBatchOutput(results, config.format),
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
      const request = withSolutionPool(asGenerationRequest(parseJsonArgument(source)), args);
      return {
        exitCode: 0,
        output: analyzeGenerationRequest(request),
      };
    }

    if (command === 'generate') {
      const source = args[0];
      if (!source) {
        return errorResult('缺少生成请求 JSON 或文件路径。');
      }
      const request = withSolutionPool(asGenerationRequest(parseJsonArgument(source)), args);
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
      let request = withSolutionPool(asGenerationRequest(parseJsonArgument(source)), args);
      const resumeManifestPath = getOption(args, '--resume-manifest');
      const writeManifestPath = getOption(args, '--write-manifest') ?? resumeManifestPath;
      const writeCandidatesPath = getOption(args, '--write-candidates');
      const writeSummaryPath = getOption(args, '--write-summary');
      assertUniqueOutputPaths([writeCandidatesPath, writeSummaryPath, writeManifestPath]);
      const eventFilter = getOption(args, '--events');
      const allowedEvents = eventFilter ? parseSearchEventFilter(eventFilter) : null;
      const appendCandidates = args.includes('--append-candidates');
      let existingCandidates: GeneratedPuzzle[] = [];
      const releaseLock = acquireLocks([writeCandidatesPath, writeSummaryPath, writeManifestPath]);
      try {
        existingCandidates = appendCandidates && writeCandidatesPath
          ? readCandidateArrayIfExists(writeCandidatesPath)
          : [];
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
      const seedStart = request.seed ?? defaultSeed();
      request = {
        ...request,
        seed: seedStart,
      };
      const collectEvents = !args.includes('--summary-only');
      const events: GenerationEvent[] = [];
      const candidates: GeneratedPuzzle[] = writeCandidatesPath ? [] : [];
      let doneEvent: GenerationEvent | null = null;
      for (const event of search(request)) {
        if (writeCandidatesPath && event.type === 'accepted') {
          candidates.push(event.puzzle);
        }
        if (event.type === 'done') {
          doneEvent = event;
        }
        if (collectEvents && (!allowedEvents || allowedEvents.has(event.type))) {
          events.push(event);
        }
      }
      if (writeCandidatesPath) {
        const outputCandidates = appendCandidates
          ? [...existingCandidates, ...candidates]
          : candidates;
        mkdirSync(dirname(writeCandidatesPath), { recursive: true });
        writeJsonAtomic(writeCandidatesPath, outputCandidates);
      }
      if (writeSummaryPath) {
        const summary = doneEvent?.type === 'done' ? doneEvent.summary : null;
        mkdirSync(dirname(writeSummaryPath), { recursive: true });
        writeJsonAtomic(writeSummaryPath, summary);
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
        writeJsonAtomic(writeManifestPath, manifest);
      }
      if (args.includes('--summary-only')) {
        return {
          exitCode: 0,
          output: doneEvent ?? null,
        };
      }
      if (allowedEvents) {
        return {
          exitCode: 0,
          output: events,
        };
      }
      return {
        exitCode: 0,
        output: events,
      };
      } finally {
        releaseLock();
      }
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
      const selection = selectFromCandidates(candidates as GeneratedPuzzle[], plan as CandidateSelectionPlan, {
        verifyCanonicalKey: args.includes('--verify-canonical-key'),
      });
      const selectedPath = getOption(args, '--write-selected');
      const rejectedPath = getOption(args, '--write-rejected');
      assertUniqueOutputPaths([selectedPath, rejectedPath]);
      if (selectedPath) {
        mkdirSync(dirname(selectedPath), { recursive: true });
        writeJsonAtomic(selectedPath, selection.selected);
      }
      if (rejectedPath) {
        mkdirSync(dirname(rejectedPath), { recursive: true });
        writeJsonAtomic(rejectedPath, selection.rejected);
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
      const request = asGenerationRequest(parseJsonArgument(source)) as SearchRequest;
      assertValidSearchRequest(request);
      const workers = parsePositiveIntegerOption(args, '--workers', 1);
      const attemptsPerWorker = parsePositiveIntegerOption(args, '--attempts-per-worker', request.maxResults ?? 1);
      const seedStart = parsePositiveIntegerOption(args, '--seed-start', request.seed ?? defaultSeed());
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
      const merged = mergeCandidateFiles(
        inputPaths,
        args.includes('--dedupe-canonical'),
        args.includes('--verify-canonical-key'),
      );
      mkdirSync(dirname(outputPath), { recursive: true });
      writeJsonAtomic(outputPath, merged.candidates);
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
          verifyCanonicalKey: args.includes('--verify-canonical-key'),
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
      const rejectedPath = getOption(args, '--write-rejected');
      assertUniqueOutputPaths([outputPath, rejectedPath]);
      const result = dedupeCandidates(candidates as GeneratedPuzzle[], {
        key: key === 'puzzle' ? 'puzzle' : 'canonical',
        verifyCanonicalKey: args.includes('--verify-canonical-key'),
      });
      mkdirSync(dirname(outputPath), { recursive: true });
      writeJsonAtomic(outputPath, result.candidates);
      if (rejectedPath) {
        mkdirSync(dirname(rejectedPath), { recursive: true });
        writeJsonAtomic(rejectedPath, result.rejected);
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
        writeJsonAtomic(outputPath, summary);
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
        description: '运行人类逻辑求解器。支持 --profile stable|extended|galaxy、--allow、--prefer、--max-steps、--format text 和 --locale zh-CN。--allow 可显式启用 profile 外 experimental 技巧。',
      },
      {
        command: 'rate <puzzle>',
        description: '按内置评分规则给题目打分。支持 --profile stable|extended|galaxy、--allow、--prefer 和 --max-steps。--allow 可显式启用 profile 外 experimental 技巧。',
      },
      {
        command: 'batch-solve --input <file>',
        description: '批量求解题集。支持 --output、--format json|jsonl|csv|text、--summary、--usage、--only、--start-line、--end-line、--profile、--allow、--prefer、--max-steps、--include-steps 和 --include-usage。',
      },
      {
        command: 'batch-rate --input <file>',
        description: '批量评分题集。支持 --output、--format json|jsonl|csv|text、--summary、--only、--start-line、--end-line、--profile、--allow、--prefer、--max-steps 和 --include-steps。',
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
        description: '分析生成请求是否存在分数范围和技巧范围冲突。支持 --solution-pool。',
      },
      {
        command: 'generate <json-or-file>',
        description: '按生成请求尝试生成一道题，并返回 diagnostics。支持 --solution-pool。',
      },
      {
        command: 'search <json-or-file>',
        description: '按搜索请求批量尝试生成。支持 --summary-only、--events、--write-candidates、--append-candidates、--write-summary、--write-manifest、--resume-manifest 和 --solution-pool。',
      },
      {
        command: 'select <candidates-json-file> <plan-json-or-file> [--verify-canonical-key]',
        description: '从候选题列表中按计划筛选结果。支持 --write-selected 和 --write-rejected；默认只校验 canonicalKey 格式。',
      },
      {
        command: 'parallel-search-plan <json-or-file> --out-dir <dir> --workers <n> --attempts-per-worker <n>',
        description: '生成互不重叠 seed 段的 search shard 命令，供外部 shell 并行运行。',
      },
      {
        command: 'merge-candidates <file...> --out <file> [--dedupe-canonical] [--verify-canonical-key]',
        description: '合并多个 shard 候选池文件，可按 canonicalKey 去重；默认只校验 canonicalKey 格式。',
      },
      {
        command: 'candidate-stats <candidates-json-file> [--verify-canonical-key]',
        description: '统计候选池的分数、线索数、技巧、canonical key 和 seed 分布；默认只校验 canonicalKey 格式。',
      },
      {
        command: 'dedupe-candidates <candidates-json-file> --out <file> [--key canonical|puzzle] [--verify-canonical-key]',
        description: '对候选池做独立去重，支持 canonicalKey 或题面字符串；默认复用合法格式的 canonicalKey。',
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
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} 缺少参数值。`);
  }
  return value;
}

function parsePositiveIntegerOption(args: readonly string[], name: string, fallback: number): number {
  if (!Number.isInteger(fallback) || fallback <= 0) {
    throw new Error(`${name} 默认值必须是大于 0 的整数。`);
  }
  const raw = getOption(args, name);
  if (raw === null) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} 必须是大于 0 的整数。`);
  }
  return value;
}

function parseNonNegativeIntegerOption(args: readonly string[], name: string, fallback: number): number {
  if (!Number.isInteger(fallback) || fallback < 0) {
    throw new Error(`${name} 默认值必须是大于等于 0 的整数。`);
  }
  const raw = getOption(args, name);
  if (raw === null) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} 必须是大于等于 0 的整数。`);
  }
  return value;
}

function parseOptionalPositiveIntegerOption(args: readonly string[], name: string): number | null {
  const raw = getOption(args, name);
  if (raw === null) {
    return null;
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

function readBatchInputs(path: string): BatchPuzzleInput[] {
  const text = readFileSync(path, 'utf8');
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('批量输入 JSON 必须是 array。');
    }
    return parsed.map((item, index) => normalizeBatchInputItem(item, index + 1));
  }
  return text.split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter((item) => item.line.length > 0 && !item.line.startsWith('#'))
    .map(({ line, lineNumber }) => {
      const parts = line.split(/\t+/);
      if (parts.length >= 2) {
        return {
          puzzleId: parts[0] || String(lineNumber),
          puzzle: parts[1]!,
          sourceIndex: lineNumber,
        };
      }
      return {
        puzzleId: String(lineNumber),
        puzzle: line,
        sourceIndex: lineNumber,
      };
    });
}

function normalizeBatchInputItem(item: unknown, index: number): BatchPuzzleInput {
  if (typeof item === 'string') {
    return {
      puzzleId: String(index),
      puzzle: item,
      sourceIndex: index,
    };
  }
  if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
    const record = item as Record<string, unknown>;
    const puzzle = typeof record.puzzle === 'string'
      ? record.puzzle
      : typeof record.grid === 'string'
        ? record.grid
        : null;
    if (!puzzle) {
      throw new Error(`批量输入第 ${index} 项缺少 puzzle 字符串。`);
    }
    return {
      puzzleId: String(record.id ?? record.puzzleId ?? index),
      puzzle,
      sourceIndex: index,
    };
  }
  throw new Error(`批量输入第 ${index} 项格式无效。`);
}

function filterBatchInputs(inputs: BatchPuzzleInput[], args: readonly string[]): BatchPuzzleInput[] {
  const only = getOption(args, '--only');
  const startLine = parseOptionalPositiveIntegerOption(args, '--start-line');
  const endLine = parseOptionalPositiveIntegerOption(args, '--end-line');
  if (startLine !== null && endLine !== null && startLine > endLine) {
    throw new Error('--start-line 不能大于 --end-line。');
  }
  const wanted = only
    ? new Set(only.split(',').map((item) => item.trim()).filter(Boolean))
    : null;
  return inputs.filter((input, index) => {
    if (startLine !== null && input.sourceIndex < startLine) {
      return false;
    }
    if (endLine !== null && input.sourceIndex > endLine) {
      return false;
    }
    if (!wanted) {
      return true;
    }
    return wanted.has(input.puzzleId) || wanted.has(String(index + 1)) || wanted.has(String(input.sourceIndex));
  });
}

function buildBatchCliConfig(args: readonly string[]): BatchCliConfig {
  const inputPath = getOption(args, '--input') ?? args[0];
  if (!inputPath) {
    throw new Error('缺少 --input。');
  }
  const outputPath = getOption(args, '--output');
  const summaryPath = getOption(args, '--summary');
  const usagePath = getOption(args, '--usage');
  assertUniqueOutputPaths([outputPath, summaryPath, usagePath]);
  const format = normalizeBatchFormat(getOption(args, '--format'));
  return {
    includeSteps: args.includes('--include-steps'),
    includeUsage: args.includes('--include-usage') || Boolean(usagePath),
    format,
    inputPath,
    outputPath,
    summaryPath,
    usagePath,
    failFast: args.includes('--fail-fast'),
    puzzles: filterBatchInputs(readBatchInputs(inputPath), args),
    solveOptions: buildCliSolveOptions(args),
    ratingPolicy: buildCliRatingPolicy(args),
  };
}

function buildCliSolveOptions(args: readonly string[]): SolveOptions {
  return buildSolveOptionsFromRatingPolicy(buildCliRatingPolicy(args));
}

function buildCliRatingPolicy(args: readonly string[]): RatingPolicy {
  const policy = getRatingPolicy(parseProfileOption(args));
  const allowedTechniques = parseTechniqueListOption(args, '--allow');
  const preferredTechniques = parseTechniqueListOption(args, '--prefer');
  const maxSteps = parseOptionalPositiveIntegerOption(args, '--max-steps');
  let techniqueOrder = [...policy.techniqueOrder];
  let fallbackTechniques = [...(policy.fallbackTechniques ?? [])];
  let enabledTechniques = new Set([...techniqueOrder, ...fallbackTechniques]);
  if (allowedTechniques) {
    const allowed = new Set(allowedTechniques);
    const preferred = new Set(preferredTechniques ?? []);
    const profileFallback = policy.fallbackTechniques ?? [];
    const fallbackCandidates = [...profileFallback, ...CLI_DEFAULT_FALLBACK_TECHNIQUES];
    const fallbackSet = new Set(fallbackCandidates.filter((technique) => allowed.has(technique) && !preferred.has(technique)));
    techniqueOrder = buildDefaultTechniques()
      .map((technique) => technique.id)
      .filter((technique) => allowed.has(technique) && !fallbackSet.has(technique));
    fallbackTechniques = buildDefaultTechniques()
      .map((technique) => technique.id)
      .filter((technique) => fallbackSet.has(technique));
    if (techniqueOrder.length === 0 && fallbackTechniques.length === 0) {
      throw new Error('--allow 过滤后没有可用技巧。');
    }
    if (techniqueOrder.length === 0 && fallbackTechniques.length > 0) {
      techniqueOrder = [...fallbackTechniques];
      fallbackTechniques = [];
    }
    enabledTechniques = new Set([...techniqueOrder, ...fallbackTechniques]);
  }
  if (preferredTechniques) {
    const invalidPreferred = preferredTechniques.filter((technique) => !enabledTechniques.has(technique));
    if (invalidPreferred.length > 0) {
      throw new Error(`--prefer 包含未启用技巧：${invalidPreferred.join(', ')}`);
    }
    techniqueOrder = applyPreferredTechniqueOrder(techniqueOrder, preferredTechniques);
    fallbackTechniques = applyPreferredTechniqueOrder(fallbackTechniques, preferredTechniques);
  }
  return {
    id: policy.id,
    version: policy.version,
    techniqueOrder,
    techniqueScores: { ...policy.techniqueScores },
    ...(policy.gradeRules ? {
      gradeRules: policy.gradeRules.map((rule) => ({
        ...rule,
        ...(rule.allowedTechniques ? { allowedTechniques: [...rule.allowedTechniques] } : {}),
      })),
    } : {}),
    ...(fallbackTechniques.length > 0 ? { fallbackTechniques } : {}),
    ...(maxSteps !== null ? { maxSteps } : {}),
    ...(maxSteps === null && typeof policy.maxSteps === 'number' ? { maxSteps: policy.maxSteps } : {}),
  };
}

function parseProfileOption(args: readonly string[]): 'classic-stable' | 'classic-extended' | 'classic-galaxy' {
  const raw = getOption(args, '--profile');
  if (raw === null || raw === 'stable' || raw === 'classic-stable' || raw === 'classic-stable.v1') {
    return 'classic-stable';
  }
  if (raw === 'extended' || raw === 'classic-extended' || raw === 'classic-extended.v1') {
    return 'classic-extended';
  }
  if (raw === 'galaxy' || raw === 'classic-galaxy' || raw === 'classic-galaxy.v1') {
    return 'classic-galaxy';
  }
  throw new Error('--profile 只能是 stable、extended 或 galaxy。');
}

function parseTechniqueListOption(args: readonly string[], name: string): TechniqueId[] | null {
  const raw = getOption(args, name);
  if (raw === null) {
    return null;
  }
  const known = new Set(getTechniqueDefinitions().map((definition) => definition.id));
  const parsed = raw.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (parsed.length === 0) {
    throw new Error(`${name} 不能为空。`);
  }
  const unknown = parsed.filter((technique) => !known.has(technique as TechniqueId));
  if (unknown.length > 0) {
    throw new Error(`${name} 包含未知技巧：${unknown.join(', ')}`);
  }
  return Array.from(new Set(parsed)) as TechniqueId[];
}

function applyPreferredTechniqueOrder(
  techniques: readonly TechniqueId[],
  preferredTechniques: readonly TechniqueId[],
): TechniqueId[] {
  const preferred = preferredTechniques.filter((technique) => techniques.includes(technique));
  const preferredSet = new Set(preferred);
  return [
    ...preferred,
    ...techniques.filter((technique) => !preferredSet.has(technique)),
  ];
}

function runBatchPuzzle(
  command: 'batch-solve' | 'batch-rate',
  input: BatchPuzzleInput,
  config: BatchCliConfig,
  usageReports: SolverUsageReport[],
): BatchPuzzleResult {
  try {
    return command === 'batch-rate'
      ? runBatchRatePuzzle(input, config.includeSteps, config.ratingPolicy)
      : runBatchSolvePuzzle(input, config.includeSteps, config.includeUsage, usageReports, config.solveOptions);
  } catch (error) {
    if (config.failFast) {
      throw error;
    }
    return buildBatchErrorResult(input, error);
  }
}

function runBatchSolvePuzzle(
  input: BatchPuzzleInput,
  includeSteps: boolean,
  includeUsage: boolean,
  usageReports: SolverUsageReport[],
  solveOptions: SolveOptions,
): BatchPuzzleResult {
  const startedAt = Date.now();
  const analysis = includeUsage
    ? analyzeSolve(input.puzzle, { ...solveOptions, includeUsage: true })
    : walkthrough(input.puzzle, solveOptions);
  const maybeAnalysis = analysis as { usage?: SolverUsageReport };
  if (maybeAnalysis.usage) {
    usageReports.push(maybeAnalysis.usage);
  }
  const placementCount = analysis.steps.reduce((sum, step) => sum + step.actions.filter((action) => action.type === 'place').length, 0);
  const eliminationCount = analysis.steps.reduce((sum, step) => sum + step.actions.filter((action) => action.type === 'eliminate').length, 0);
  return {
    puzzleId: input.puzzleId,
    puzzle: input.puzzle,
    sourceIndex: input.sourceIndex,
    ok: true,
    solved: analysis.solved,
    score: analysis.score,
    hardestTechnique: analysis.hardestTechnique,
    stepCount: analysis.steps.length,
    placementCount,
    eliminationCount,
    elapsedMs: Date.now() - startedAt,
    ...(analysis.stuckReason === undefined ? {} : { stuckReason: analysis.stuckReason }),
    ...(includeSteps ? { steps: analysis.steps } : {}),
  };
}

function runBatchRatePuzzle(input: BatchPuzzleInput, includeSteps: boolean, policy: RatingPolicy): BatchPuzzleResult {
  const startedAt = Date.now();
  const result = rate(input.puzzle, policy);
  const placementCount = result.steps.reduce((sum, step) => sum + step.actions.filter((action) => action.type === 'place').length, 0);
  const eliminationCount = result.steps.reduce((sum, step) => sum + step.actions.filter((action) => action.type === 'eliminate').length, 0);
  return {
    puzzleId: input.puzzleId,
    puzzle: input.puzzle,
    sourceIndex: input.sourceIndex,
    ok: true,
    solved: result.solved,
    score: result.score,
    hardestTechnique: result.hardestTechnique,
    hardestScore: result.hardestScore,
    stepCount: result.steps.length,
    placementCount,
    eliminationCount,
    elapsedMs: Date.now() - startedAt,
    grade: result.grade,
    ...(result.stuckReason === undefined ? {} : { stuckReason: result.stuckReason }),
    ...(includeSteps ? { steps: result.steps } : {}),
  };
}

function buildBatchErrorResult(input: BatchPuzzleInput, error: unknown): BatchPuzzleResult {
  return {
    puzzleId: input.puzzleId,
    puzzle: input.puzzle,
    sourceIndex: input.sourceIndex,
    ok: false,
    solved: false,
    stepCount: 0,
    placementCount: 0,
    eliminationCount: 0,
    elapsedMs: 0,
    error: error instanceof Error ? error.message : String(error),
  };
}

function buildBatchSummary(results: readonly BatchPuzzleResult[], totalElapsedMs: number): BatchSummary {
  const solved = results.filter((result) => result.solved).length;
  const failed = results.filter((result) => result.ok === false).length;
  const scores = results
    .filter((result) => result.solved)
    .map((result) => result.score)
    .filter((score): score is number => typeof score === 'number');
  const hardestTechniqueCounts: Partial<Record<TechniqueId, number>> = {};
  const stuckReasonCounts: Record<string, number> = {};
  for (const result of results) {
    if (result.hardestTechnique) {
      hardestTechniqueCounts[result.hardestTechnique] = (hardestTechniqueCounts[result.hardestTechnique] ?? 0) + 1;
    }
    if (result.stuckReason) {
      stuckReasonCounts[result.stuckReason] = (stuckReasonCounts[result.stuckReason] ?? 0) + 1;
    }
  }
  return {
    puzzles: results.length,
    solved,
    unsolved: results.length - solved,
    failed,
    solveRate: results.length === 0 ? 0 : solved / results.length,
    totalElapsedMs,
    avgElapsedMs: results.length === 0 ? 0 : totalElapsedMs / results.length,
    ...(scores.length > 0 ? {
      scoreMin: Math.min(...scores),
      scoreMax: Math.max(...scores),
      scoreAvg: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    } : {}),
    hardestTechniqueCounts,
    stuckReasonCounts,
  };
}

function normalizeBatchFormat(raw: string | null): 'json' | 'jsonl' | 'csv' | 'text' {
  if (raw === null) {
    return 'json';
  }
  if (raw === 'json' || raw === 'jsonl' || raw === 'csv' || raw === 'text') {
    return raw;
  }
  throw new Error('--format 只能是 json、jsonl、csv 或 text。');
}

function writeBatchOutput(path: string, results: readonly BatchPuzzleResult[], format: 'json' | 'jsonl' | 'csv' | 'text'): void {
  const output = formatBatchOutput(results, format);
  if (typeof output === 'string') {
    writeTextAtomic(path, output);
    return;
  }
  writeJsonAtomic(path, output);
}

function writeJsonAtomic(path: string, value: unknown): void {
  writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeTextAtomic(path: string, value: string): void {
  writeAtomic(path, value.endsWith('\n') ? value : `${value}\n`);
}

function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const fd = openSync(tempPath, 'wx', 0o600);
  try {
    writeFileSync(fd, content, 'utf8');
    closeSync(fd);
    renameSync(tempPath, path);
  } catch (error) {
    try {
      closeSync(fd);
    } catch {
      // fd may already be closed after a successful write.
    }
    rmSync(tempPath, { force: true });
    throw error;
  }
}

function assertUniqueOutputPaths(paths: Array<string | null>): void {
  const seen = new Map<string, string>();
  for (const path of paths) {
    if (!path) {
      continue;
    }
    const normalized = resolve(path);
    const previous = seen.get(normalized);
    if (previous) {
      throw new Error(`输出路径不能重复：${previous} 和 ${path}`);
    }
    seen.set(normalized, path);
  }
}

function acquireLock(path: string): () => void {
  const lockPath = `${resolve(path)}.lock`;
  mkdirSync(dirname(lockPath), { recursive: true });
  let fd: number;
  try {
    fd = openSync(lockPath, 'wx');
  } catch {
    throw new Error(`输出文件正在被另一个进程使用：${path}`);
  }
  return () => {
    closeSync(fd);
    rmSync(lockPath, { force: true });
  };
}

function acquireLocks(paths: Array<string | null>): () => void {
  const normalizedPaths = Array.from(new Set(paths.filter((path): path is string => Boolean(path)).map((path) => resolve(path))))
    .sort();
  const releases: Array<() => void> = [];
  try {
    for (const path of normalizedPaths) {
      releases.push(acquireLock(path));
    }
  } catch (error) {
    for (const release of releases.reverse()) {
      release();
    }
    throw error;
  }
  return () => {
    for (const release of releases.reverse()) {
      release();
    }
  };
}

function formatBatchOutput(results: readonly BatchPuzzleResult[], format: 'json' | 'jsonl' | 'csv' | 'text'): unknown {
  if (format === 'json') {
    return results;
  }
  if (format === 'jsonl') {
    return `${results.map((result) => JSON.stringify(result)).join('\n')}\n`;
  }
  if (format === 'csv') {
    return formatBatchCsv(results);
  }
  return formatBatchText(results);
}

function formatBatchCsv(results: readonly BatchPuzzleResult[]): string {
  const header = [
    'puzzleId',
    'solved',
    'score',
    'grade',
    'hardestTechnique',
    'hardestScore',
    'stepCount',
    'placementCount',
    'eliminationCount',
    'stuckReason',
    'elapsedMs',
    'puzzle',
    'sourceIndex',
    'ok',
    'error',
  ];
  const rows = results.map((result) => [
    result.puzzleId,
    String(result.solved),
    result.score ?? '',
    result.grade ?? '',
    result.hardestTechnique ?? '',
    result.hardestScore ?? '',
    result.stepCount,
    result.placementCount,
    result.eliminationCount,
    result.stuckReason ?? '',
    result.elapsedMs,
    result.puzzle,
    result.sourceIndex ?? '',
    result.ok === false ? 'false' : 'true',
    result.error ?? '',
  ].map((value) => csvEscape(String(value))).join(','));
  return `${header.join(',')}\n${rows.join('\n')}\n`;
}

function csvEscape(value: string): string {
  const dangerous = /^[\t\r\n =+\-@]/.test(value);
  const hardened = dangerous ? `'${value}` : value;
  return dangerous || /[",\n\r\t]/.test(hardened) ? `"${hardened.replaceAll('"', '""')}"` : hardened;
}

function formatBatchText(results: readonly BatchPuzzleResult[]): string {
  return `${results.map((result) => [
    result.puzzleId,
    result.solved ? 'solved' : 'unsolved',
    `score=${result.score ?? ''}`,
    `hardest=${result.hardestTechnique ?? ''}`,
    `steps=${result.stepCount}`,
    `elapsedMs=${result.elapsedMs}`,
  ].join('\t')).join('\n')}\n`;
}

function aggregateBatchUsage(reports: readonly SolverUsageReport[]): SolverUsageReport {
  const output: SolverUsageReport = {
    totalElapsedMs: 0,
    totalCalls: 0,
    totalHits: 0,
    totalPlacements: 0,
    totalEliminations: 0,
    byTechnique: {},
  };
  for (const report of reports) {
    output.totalElapsedMs += report.totalElapsedMs;
    output.totalCalls += report.totalCalls;
    output.totalHits += report.totalHits;
    output.totalPlacements += report.totalPlacements;
    output.totalEliminations += report.totalEliminations;
    for (const [technique, stats] of Object.entries(report.byTechnique) as Array<[TechniqueId, NonNullable<SolverUsageReport['byTechnique'][TechniqueId]>]>) {
      const current = output.byTechnique[technique] ?? {
        technique,
        calls: 0,
        hits: 0,
        placements: 0,
        eliminations: 0,
        actions: 0,
        totalScore: 0,
        maxScore: 0,
        elapsedMs: 0,
      };
      current.calls += stats.calls;
      current.hits += stats.hits;
      current.placements += stats.placements;
      current.eliminations += stats.eliminations;
      current.actions += stats.actions;
      current.totalScore += stats.totalScore;
      current.maxScore = Math.max(current.maxScore, stats.maxScore);
      current.elapsedMs += stats.elapsedMs;
      output.byTechnique[technique] = current;
    }
  }
  return output;
}

function parseJsonArgument(source: string): unknown {
  if (existsSync(source)) {
    return JSON.parse(readFileSync(source, 'utf8'));
  }
  const trimmed = source.trim();
  const text = trimmed.startsWith('{') || trimmed.startsWith('[') ? source : readFileSync(source, 'utf8');
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

function readCandidateArrayIfExists(path: string): GeneratedPuzzle[] {
  const parsed = readJsonArrayIfExists(path);
  validateCandidatePool(parsed as GeneratedPuzzle[]);
  return parsed as GeneratedPuzzle[];
}

function parseSearchEventFilter(value: string): Set<string> {
  const events = value.split(',').map((item) => item.trim()).filter(Boolean);
  if (events.length === 0) {
    throw new Error('--events 至少需要一个事件类型。');
  }
  const invalid = events.filter((event) => !SEARCH_EVENT_TYPES.has(event));
  if (invalid.length > 0) {
    throw new Error(`--events 包含未知事件类型：${invalid.join(', ')}`);
  }
  return new Set(events);
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
    throw new Error('续跑 manifest 与当前搜索请求的生成身份字段不匹配。seed、maxResults、scoreBucketSize 和 budget.maxAttempts 不参与身份；其他生成约束、minimality、canonicalize、ratingPolicy、relaxation 和 budget.maxElapsedMs 变化会拒绝续跑。');
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
    scoreBucketSize: undefined,
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
  argv: string[];
  command: string;
}> {
  const cliCommandPrefix = buildCliCommandPrefix();
  const totalAttempts = workers * attemptsPerWorker;
  if (!Number.isSafeInteger(totalAttempts) || seedStart < 1 || seedStart + totalAttempts - 1 > MAX_SEED) {
    throw new Error('parallel-search-plan seed range exceeds 32-bit seed limit.');
  }
  return Array.from({ length: workers }, (_, index) => {
    const worker = index + 1;
    const workerSeedStart = seedStart + index * attemptsPerWorker;
    const shardRequest: GenerationRequest = {
      ...request,
      maxResults: attemptsPerWorker,
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
    const argv = [
      ...cliCommandPrefix,
      'search',
      requestJson,
      '--summary-only',
      '--write-candidates',
      candidatesPath,
      '--write-summary',
      summaryPath,
      '--write-manifest',
      manifestPath,
      '--overwrite-manifest',
    ];
    const command = argv.map(shellQuote).join(' ');
    return {
      worker,
      seedStart: workerSeedStart,
      seedEndExclusive: workerSeedStart + attemptsPerWorker,
      request: shardRequest,
      candidatesPath,
      summaryPath,
      manifestPath,
      argv,
      command,
    };
  });
}

function buildCliCommandPrefix(): string[] {
  const argvEntry = process.argv[1];
  if (!argvEntry) {
    return ['sudoku'];
  }
  try {
    const realEntry = realpathSync(argvEntry);
    const normalizedEntry = realEntry.replaceAll('\\', '/');
    if (normalizedEntry.endsWith('/dist/src/cli/index.js') || normalizedEntry.endsWith('/src/cli/index.js')) {
      return [process.execPath, realEntry];
    }
    const normalizedArgvEntry = argvEntry.replaceAll('\\', '/');
    if (normalizedEntry.endsWith('/node_modules/.bin/sudoku') || normalizedArgvEntry.endsWith('/sudoku') || argvEntry === 'sudoku') {
      return ['sudoku'];
    }
  } catch {
    const normalizedArgvEntry = argvEntry.replaceAll('\\', '/');
    if (normalizedArgvEntry.endsWith('/sudoku') || argvEntry === 'sudoku') {
      return ['sudoku'];
    }
  }
  return ['sudoku'];
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function mergeCandidateFiles(
  paths: readonly string[],
  dedupeCanonical: boolean,
  verifyCanonicalKey: boolean,
): {
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
  validateCandidatePool(rawCandidates, { verifyCanonicalKey });
  if (!dedupeCanonical) {
    return { candidates: rawCandidates, duplicatesSkipped: 0 };
  }
  const deduped = dedupeCandidates(rawCandidates, { key: 'canonical', verifyCanonicalKey });
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

function withSolutionPool(request: GenerationRequest, args: readonly string[]): GenerationRequest {
  const solutionPoolPath = getOption(args, '--solution-pool');
  if (!solutionPoolPath) {
    return request;
  }
  const parsed = JSON.parse(readFileSync(solutionPoolPath, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('--solution-pool 文件必须是 JSON array。');
  }
  const output: GenerationRequest = {
    ...request,
    solutionSource: request.solutionSource ?? 'pool',
  };
  output.solutionPool = parsed as Board[];
  return output;
}

if (isMainModule()) {
  const result = runCli(process.argv.slice(2));
  const stream = result.exitCode === 0 ? process.stdout : process.stderr;
  stream.write(typeof result.output === 'string'
    ? `${result.output}\n`
    : `${JSON.stringify(result.output, null, 2)}\n`);
  process.exitCode = result.exitCode;
}

function isMainModule(): boolean {
  const argvEntry = process.argv[1];
  if (!argvEntry || argvEntry === '-' || argvEntry === '[eval]') {
    return false;
  }
  try {
    return pathToFileURL(realpathSync(argvEntry)).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch {
    return false;
  }
}
