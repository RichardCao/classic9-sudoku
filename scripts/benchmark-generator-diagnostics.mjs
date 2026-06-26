#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { execFileSync } from 'node:child_process';

import {
  applyTransformToBoard,
  canonicalizePair,
  CELL_TO_BOX,
  CELL_TO_COL,
  CELL_TO_ROW,
  checkUniqueness,
  getRatingPolicy,
  getTechniqueDefinitions,
  parsePuzzle,
  rate,
  serializeBoard,
  validate,
} from '../dist/src/index.js';
import { ClueRemover } from '../dist/src/generator/clue-remover.js';
import { extractGeneratorCandidateFeatures } from '../dist/src/generator/diagnostics.js';
import { PuzzleMinimizer } from '../dist/src/generator/minimizer.js';
import { SolutionGridFactory } from '../dist/src/generator/solution-grid.js';

const DEFAULT_ATTEMPTS = 10;
const DEFAULT_MAX_ELAPSED_MS = 1500;
const DEFAULT_CASE_LIMIT = 4;
const DEFAULT_SEED = 1;
const DEFAULT_RANKED_POOL_SIZE = 4;
const DEFAULT_ADAPTIVE_POOL_SIZE = 4;
const DEFAULT_STAGED_TARGETED_POOL_SIZE = 4;
const DEFAULT_BEAM_WIDTH = 4;
const DEFAULT_BEAM_ROUNDS = 3;
const DEFAULT_MUTATIONS_PER_CANDIDATE = 4;
const CORPUS_PATH = 'tests/fixtures/reference-techniques/reference-rating-corpus.json';
const EMPTY = 0;
const WORKLOAD_PRESETS = Object.freeze({
  smoke: Object.freeze({ attempts: 2, caseLimit: 4, maxElapsedMs: 1000 }),
  baseline: Object.freeze({ attempts: 20, caseLimit: 16, maxElapsedMs: 1500 }),
  extended: Object.freeze({ attempts: 100, caseLimit: 16, maxElapsedMs: 5000 }),
});
const STRATEGY_VERSIONS = Object.freeze({
  default: 'default.v1',
  'ranked-rejection': 'ranked-rejection.v1',
  'staged-removal': 'staged-removal.v1',
  'staged-targeted': 'staged-targeted.v1',
  'adaptive-loss': 'adaptive-loss.v1',
  'adaptive-beam': 'adaptive-beam.v1',
  'preset-transform': 'preset-transform.v1',
});
const LOSS_PROFILES = Object.freeze(['medium', 'hard', 'technique']);
const SCORE_RANGES = Object.freeze([
  { id: 'easy', min: 0, max: 999 },
  { id: 'medium', min: 1000, max: 2499 },
  { id: 'hard', min: 2500, max: 5999 },
  { id: 'expert', min: 6000, max: 20000 },
]);
const CLUE_TARGETS = Object.freeze([40, 34, 30, 26]);
const SOLUTION_SOURCES = Object.freeze(['transform-fixed', 'random-backtracking', 'pool']);
const techniqueFamilies = new Map(getTechniqueDefinitions().map((definition) => [definition.id, definition.family]));

const options = parseArgs(process.argv.slice(2));
const policy = getRatingPolicy(options.profile);
const corpus = loadCorpus(options.corpusPath);
const solutionPool = corpus.rows
  .map((row) => parsePuzzle(row.solution))
  .slice(0, Math.max(1, options.poolSize));
const presetSeeds = options.presetSeedsPath ? loadPresetSeeds(options.presetSeedsPath) : [];
const cases = buildCases(options.caseLimit);

const solutionFactory = new SolutionGridFactory();
const clueRemover = new ClueRemover();
const minimizer = new PuzzleMinimizer();
const rows = [];

for (const source of options.sources) {
  for (const testCase of cases) {
    rows.push(runCase(source, testCase));
  }
}

const summary = {
  benchmarkId: 'generator-diagnostics-benchmark.v1',
  createdAt: new Date().toISOString(),
  git: readGitInfo(),
  node: {
    version: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuCount: cpus().length,
    cpuModel: cpus()[0]?.model ?? null,
  },
  options: {
    workload: options.workload,
    profile: options.profile,
    strategy: options.strategy,
    strategyVersion: STRATEGY_VERSIONS[options.strategy],
    difficulty: options.difficulty,
    presetSeedsPath: options.presetSeedsPath,
    presetSeedCount: presetSeeds.length,
    rankedPoolSize: options.strategy === 'ranked-rejection' ? options.rankedPoolSize : null,
    stagedTargetedPoolSize: options.strategy === 'staged-targeted' ? options.stagedTargetedPoolSize : null,
    adaptivePoolSize: options.strategy === 'adaptive-loss' ? options.adaptivePoolSize : null,
    beamWidth: options.strategy === 'adaptive-beam' ? options.beamWidth : null,
    beamRounds: options.strategy === 'adaptive-beam' ? options.beamRounds : null,
    mutationsPerCandidate: options.strategy === 'adaptive-beam' ? options.mutationsPerCandidate : null,
    lossProfile: options.strategy === 'adaptive-beam' ? options.lossProfile : null,
    requiredTechnique: options.requiredTechnique,
    hardestTechnique: options.hardestTechnique,
    attempts: options.attempts,
    maxElapsedMs: options.maxElapsedMs,
    seed: options.seed,
    minimality: options.minimality,
    canonicalize: options.canonicalize,
    caseLimit: options.caseLimit,
    poolSize: solutionPool.length,
    sources: options.sources,
  },
  rows,
  aggregate: aggregateRows(rows),
  interpretation: buildInterpretation(rows),
};

if (options.outputJson) {
  writeJson(options.outputJson, summary);
}
if (options.outputMarkdown) {
  writeText(options.outputMarkdown, renderMarkdown(summary));
}
if (options.outDir) {
  mkdirSync(options.outDir, { recursive: true });
  writeJson(join(options.outDir, 'summary.json'), summary);
  writeText(join(options.outDir, 'report.md'), renderMarkdown(summary));
}

if (options.json) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  process.stdout.write(renderHuman(summary));
}

function buildCases(limit) {
  const output = [];
  const scoreRanges = options.difficulty
    ? SCORE_RANGES.filter((scoreRange) => scoreRange.id === options.difficulty)
    : SCORE_RANGES;
  for (const clueTarget of CLUE_TARGETS) {
    for (const scoreRange of scoreRanges) {
      output.push({
        id: buildCaseId(clueTarget, scoreRange),
        clueTarget,
        scoreRange,
        requiredTechnique: options.requiredTechnique,
        hardestTechnique: options.hardestTechnique,
      });
    }
  }
  return output.slice(0, limit);
}

function buildCaseId(clueTarget, scoreRange) {
  const suffixes = [];
  if (options.requiredTechnique) {
    suffixes.push(`requires-${options.requiredTechnique}`);
  }
  if (options.hardestTechnique) {
    suffixes.push(`hardest-${options.hardestTechnique}`);
  }
  return [`clues-${clueTarget}-${scoreRange.id}`, ...suffixes].join('-');
}

function runCase(source, testCase) {
  const attempts = [];
  for (let offset = 0; offset < options.attempts; offset += 1) {
    attempts.push(runAttempt(source, testCase, options.seed + offset));
  }
  return {
    id: `${source}:${testCase.id}`,
    source,
    clueTarget: testCase.clueTarget,
    scoreRange: testCase.scoreRange,
    attempts,
    summary: summarizeAttempts(attempts),
  };
}

function runAttempt(source, testCase, seed) {
  if (options.strategy === 'preset-transform') {
    return runPresetTransformAttempt(source, testCase, seed);
  }
  if (options.strategy === 'ranked-rejection') {
    return runRankedAttempt(source, testCase, seed);
  }
  if (options.strategy === 'staged-targeted') {
    return runStagedTargetedAttempt(source, testCase, seed);
  }
  if (options.strategy === 'adaptive-loss') {
    return runAdaptiveLossAttempt(source, testCase, seed);
  }
  if (options.strategy === 'adaptive-beam') {
    return runAdaptiveBeamAttempt(source, testCase, seed);
  }
  return runCandidateAttempt(source, testCase, seed, {
    stagedRemoval: options.strategy === 'staged-removal',
  });
}

function runStagedTargetedAttempt(source, testCase, seed) {
  const startedAt = performance.now();
  const candidates = [];
  for (let index = 0; index < options.stagedTargetedPoolSize; index += 1) {
    const candidateSeed = seed + index * options.attempts;
    const attempt = runCandidateAttempt(source, testCase, candidateSeed, {
      canonicalize: false,
      includeRaw: true,
      stagedRemoval: true,
      targetedCheckpoints: true,
      maxElapsedMs: remainingMs(startedAt),
    });
    candidates.push({
      ...attempt,
      stagedTargetedIndex: index,
      loss: scoreStagedTargetedLoss(attempt, testCase),
    });
  }

  const rankedCandidates = [...candidates].sort(compareStagedTargetedCandidates);
  const selected = rankedCandidates[0] ?? null;
  if (!selected) {
    return {
      seed,
      source,
      status: 'timeout',
      rejectReason: 'staged-targeted-pool-empty',
      timings: { total: round(performance.now() - startedAt, 3) },
      solutionGeneration: null,
      candidate: null,
      features: null,
      strategy: {
        name: options.strategy,
        stagedTargetedPoolSize: options.stagedTargetedPoolSize,
        generatedCandidates: 0,
        selectedIndex: null,
        selectedLoss: null,
      },
    };
  }

  const output = { ...selected };
  output.seed = seed;
  output.strategy = {
    name: options.strategy,
    stagedTargetedPoolSize: options.stagedTargetedPoolSize,
    generatedCandidates: candidates.length,
    selectedIndex: selected.stagedTargetedIndex,
    selectedLoss: selected.loss,
    checkpoints: selected.strategy?.checkpoints ?? [],
    selectedCheckpoints: selected.strategy?.checkpoints ?? [],
    candidates: rankedCandidates.map((candidate) => ({
      seed: candidate.seed,
      status: candidate.status,
      rejectReason: candidate.rejectReason,
      score: candidate.candidate?.score ?? null,
      clueCount: candidate.candidate?.clueCount ?? null,
      hardestTechnique: candidate.candidate?.hardestTechnique ?? null,
      loss: candidate.loss,
      finalDecision: candidate.strategy?.checkpoints?.at(-1)?.decision ?? null,
      checkpointDecisions: (candidate.strategy?.checkpoints ?? []).map((checkpoint) => ({
        targetClues: checkpoint.targetClues,
        actualClues: checkpoint.actualClues,
        score: checkpoint.score,
        decision: checkpoint.decision,
        reason: checkpoint.reason,
      })),
      features: candidate.features ? summarizeHeuristicFeatures(candidate.features) : null,
    })),
  };
  output.timings = {
    ...selected.timings,
    total: round(performance.now() - startedAt, 3),
  };
  if (options.canonicalize && output.candidate?.canonicalKeyPrefix === null && selected.rawPuzzle && selected.rawSolution) {
    const canonicalStarted = performance.now();
    const pair = canonicalizePair(selected.rawPuzzle, selected.rawSolution);
    output.timings.canonicalization = round(performance.now() - canonicalStarted, 3);
    output.candidate = summarizeCandidate({
      ...selected.fullCandidate,
      puzzle: pair.board,
      solution: pair.solution,
      canonicalKey: pair.key,
    });
  }
  delete output.rawPuzzle;
  delete output.rawSolution;
  delete output.fullCandidate;
  delete output.stagedTargetedIndex;
  delete output.loss;
  return output;
}

function runPresetTransformAttempt(source, testCase, seed) {
  const timings = {};
  const startedAt = performance.now();
  const stage = (name, operation) => {
    const stageStarted = performance.now();
    const result = operation();
    timings[name] = round(performance.now() - stageStarted, 3);
    return result;
  };
  const targetDifficulty = options.difficulty ?? testCase.scoreRange.id;
  const selectedSeed = selectPresetSeed(targetDifficulty, seed);
  const output = {
    seed,
    source,
    status: 'unknown',
    rejectReason: null,
    timings,
    solutionGeneration: null,
    candidate: null,
    features: null,
  };
  if (!selectedSeed) {
    output.status = 'rejected';
    output.rejectReason = 'preset-seed-not-found';
    output.strategy = {
      name: options.strategy,
      targetDifficulty,
      selectedSeedId: null,
      validation: null,
    };
    output.timings.total = round(performance.now() - startedAt, 3);
    return output;
  }

  const transform = stage('solutionGeneration', () => buildRandomPresetTransform(seed));
  const transformedPuzzle = stage('clueRemoval', () => applyTransformToBoard(selectedSeed.puzzleBoard, transform));
  const transformedSolution = applyTransformToBoard(selectedSeed.solutionBoard, transform);
  timings.minimization = 0;
  const features = stage('featureExtraction', () => extractGeneratorCandidateFeatures(transformedPuzzle));
  const rated = stage('rating', () => rate(transformedPuzzle, policy));
  const validation = stage('presetValidation', () => validatePresetTransform(selectedSeed, transformedPuzzle, transformedSolution, rated));
  const pair = options.canonicalize
    ? stage('canonicalization', () => canonicalizePair(transformedPuzzle, transformedSolution))
    : null;
  timings.canonicalization = timings.canonicalization ?? 0;
  const candidate = buildCandidate(transformedPuzzle, pair, rated, seed);
  const rejectReason = validation.valid ? matchesConstraints(candidate, testCase) : validation.reason;
  output.status = rejectReason ? 'rejected' : 'success';
  output.rejectReason = rejectReason;
  output.candidate = summarizeCandidate(candidate);
  output.features = features;
  output.strategy = {
    name: options.strategy,
    targetDifficulty,
    selectedSeedId: selectedSeed.id,
    transform,
    validation,
    canonicalBefore: selectedSeed.canonicalKey,
    canonicalAfter: pair?.key ?? null,
    canonicalChecked: Boolean(pair),
    transformedPuzzle: serializeBoard(transformedPuzzle),
  };
  output.timings.total = round(performance.now() - startedAt, 3);
  return output;
}

function runAdaptiveLossAttempt(source, testCase, seed) {
  const startedAt = performance.now();
  const candidates = [];
  for (let index = 0; index < options.adaptivePoolSize; index += 1) {
    const candidateSeed = seed + index * options.attempts;
    const attempt = runCandidateAttempt(source, testCase, candidateSeed, {
      canonicalize: false,
      includeRaw: true,
      stagedRemoval: true,
      maxElapsedMs: remainingMs(startedAt),
    });
    candidates.push({
      ...attempt,
      adaptiveIndex: index,
      loss: scoreLoss(attempt, testCase),
    });
  }

  const rankedCandidates = [...candidates].sort(compareLossCandidates);
  const selected = rankedCandidates[0] ?? null;
  if (!selected) {
    return {
      seed,
      source,
      status: 'timeout',
      rejectReason: 'adaptive-pool-empty',
      timings: { total: round(performance.now() - startedAt, 3) },
      solutionGeneration: null,
      candidate: null,
      features: null,
      strategy: {
        name: options.strategy,
        adaptivePoolSize: options.adaptivePoolSize,
        generatedCandidates: 0,
        selectedIndex: null,
        selectedLoss: null,
      },
    };
  }

  const output = { ...selected };
  output.seed = seed;
  output.strategy = {
    name: options.strategy,
    adaptivePoolSize: options.adaptivePoolSize,
    generatedCandidates: candidates.length,
    selectedIndex: selected.adaptiveIndex,
    selectedLoss: selected.loss,
    candidates: rankedCandidates.map((candidate) => ({
      seed: candidate.seed,
      status: candidate.status,
      rejectReason: candidate.rejectReason,
      score: candidate.candidate?.score ?? null,
      clueCount: candidate.candidate?.clueCount ?? null,
      hardestTechnique: candidate.candidate?.hardestTechnique ?? null,
      loss: candidate.loss,
      features: candidate.features ? summarizeHeuristicFeatures(candidate.features) : null,
    })),
  };
  output.timings = {
    ...selected.timings,
    total: round(performance.now() - startedAt, 3),
  };
  if (options.canonicalize && output.candidate?.canonicalKeyPrefix === null && selected.rawPuzzle && selected.rawSolution) {
    const canonicalStarted = performance.now();
    const pair = canonicalizePair(selected.rawPuzzle, selected.rawSolution);
    output.timings.canonicalization = round(performance.now() - canonicalStarted, 3);
    output.candidate = summarizeCandidate({
      ...selected.fullCandidate,
      puzzle: pair.board,
      solution: pair.solution,
      canonicalKey: pair.key,
    });
  }
  delete output.rawPuzzle;
  delete output.rawSolution;
  delete output.fullCandidate;
  delete output.adaptiveIndex;
  delete output.loss;
  return output;
}

function runAdaptiveBeamAttempt(source, testCase, seed) {
  const startedAt = performance.now();
  const timings = {};
  const initialCandidates = [];
  const trace = [];
  const cache = createBeamCache();
  let generatedCandidates = 0;

  for (let index = 0; index < options.beamWidth; index += 1) {
    if (!hasTimeRemaining(startedAt)) {
      break;
    }
    const candidateSeed = seed + index * options.attempts;
    const attempt = runCandidateAttempt(source, testCase, candidateSeed, {
      canonicalize: false,
      includeRaw: true,
      stagedRemoval: true,
      targetedCheckpoints: true,
      maxElapsedMs: remainingMs(startedAt),
    });
    if (attempt.rawPuzzle && attempt.rawSolution) {
      const candidate = buildBeamCandidate({
        puzzle: attempt.rawPuzzle,
        solution: attempt.rawSolution,
        seed: candidateSeed,
        id: `initial-${index}`,
        parentId: null,
        round: 0,
        mutation: { type: 'initial', cell: null },
        sourceAttempt: attempt,
        history: [],
        startedAt,
        testCase,
        cache,
      });
      initialCandidates.push(candidate);
      trace.push(summarizeBeamTrace(candidate, null));
      generatedCandidates += 1;
    } else {
      trace.push({
        round: 0,
        id: `initial-${index}`,
        parentId: null,
        mutation: { type: 'initial', cell: null },
        status: attempt.status,
        rejectReason: attempt.rejectReason,
        lossBefore: null,
        lossAfter: null,
        scoreBefore: null,
        scoreAfter: attempt.candidate?.score ?? null,
        elapsedMs: attempt.timings.total ?? null,
      });
    }
  }

  let beam = pruneBeamCandidates(initialCandidates, testCase);
  for (let roundIndex = 1; roundIndex <= options.beamRounds; roundIndex += 1) {
    if (beamHasSuccess(beam)) {
      break;
    }
    if (beam.length === 0 || !hasTimeRemaining(startedAt)) {
      break;
    }
    const proposals = [];
    for (let beamIndex = 0; beamIndex < beam.length; beamIndex += 1) {
      const parent = beam[beamIndex];
      const plans = buildBeamMutationPlans(parent, {
        seed: seed + roundIndex * 1000003 + beamIndex * 7919,
        testCase,
        limit: options.mutationsPerCandidate,
        cache,
      });
      for (let mutationIndex = 0; mutationIndex < plans.length; mutationIndex += 1) {
        if (!hasTimeRemaining(startedAt)) {
          break;
        }
        const mutation = plans[mutationIndex];
        const mutatedPuzzle = applyBeamMutation(parent, mutation);
        if (!mutatedPuzzle) {
          continue;
        }
        const candidate = buildBeamCandidate({
          puzzle: mutatedPuzzle,
          solution: parent.solution,
          seed: seed + roundIndex * 1000003 + beamIndex * 7919 + mutationIndex,
          id: `r${roundIndex}-${beamIndex}-${mutationIndex}`,
          parentId: parent.id,
          round: roundIndex,
          mutation,
          sourceAttempt: parent.sourceAttempt,
          history: [...parent.history, {
            round: roundIndex,
            type: mutation.type,
            cell: mutation.cell,
            removeCell: mutation.removeCell ?? null,
            restoreCell: mutation.restoreCell ?? null,
          }],
          startedAt,
          testCase,
          cache,
        });
        proposals.push(candidate);
        trace.push(summarizeBeamTrace(candidate, parent));
        generatedCandidates += 1;
      }
    }
    beam = pruneBeamCandidates([...beam, ...proposals], testCase);
  }

  const selected = [...beam].sort(compareBeamFinalCandidates)[0] ?? null;
  timings.beamSearch = round(performance.now() - startedAt, 3);
  if (!selected) {
    return {
      seed,
      source,
      status: 'timeout',
      rejectReason: 'adaptive-beam-empty',
      timings: { ...timings, total: round(performance.now() - startedAt, 3) },
      solutionGeneration: null,
      candidate: null,
      features: null,
      strategy: {
        name: options.strategy,
        beamWidth: options.beamWidth,
        beamRounds: options.beamRounds,
        mutationsPerCandidate: options.mutationsPerCandidate,
        lossProfile: options.lossProfile,
        generatedCandidates,
        cacheStats: summarizeBeamCache(cache),
        selectedId: null,
        selectedLoss: null,
        selectedRound: null,
        trace,
        candidates: [],
      },
    };
  }

  const output = {
    seed,
    source,
    status: selected.status,
    rejectReason: selected.rejectReason,
    timings: {
      ...selected.timings,
      ...timings,
      total: round(performance.now() - startedAt, 3),
    },
    solutionGeneration: selected.sourceAttempt?.solutionGeneration ?? null,
    candidate: summarizeCandidate(selected.fullCandidate),
    features: selected.features,
    strategy: {
      name: options.strategy,
      beamWidth: options.beamWidth,
      beamRounds: options.beamRounds,
      mutationsPerCandidate: options.mutationsPerCandidate,
      lossProfile: options.lossProfile,
      generatedCandidates,
      cacheStats: summarizeBeamCache(cache),
      selectedId: selected.id,
      selectedLoss: selected.loss,
      selectedRound: selected.round,
      selectedHistory: selected.history,
      selectedUniqueness: selected.uniqueness,
      trace: trace.slice(0, 80),
      traceTruncated: trace.length > 80,
      candidates: beam.map((candidate) => ({
        id: candidate.id,
        parentId: candidate.parentId,
        round: candidate.round,
        status: candidate.status,
        rejectReason: candidate.rejectReason,
        score: candidate.fullCandidate.score,
        clueCount: candidate.fullCandidate.clueCount,
        hardestTechnique: candidate.fullCandidate.hardestTechnique,
        loss: candidate.loss,
        mutation: candidate.mutation,
        uniqueness: candidate.uniqueness,
        features: summarizeHeuristicFeatures(candidate.features),
      })),
    },
  };
  if (options.canonicalize && selected.puzzle && selected.solution) {
    const canonicalStarted = performance.now();
    const pair = canonicalizePair(selected.puzzle, selected.solution);
    output.timings.canonicalization = round(performance.now() - canonicalStarted, 3);
    output.candidate = summarizeCandidate({
      ...selected.fullCandidate,
      puzzle: pair.board,
      solution: pair.solution,
      canonicalKey: pair.key,
    });
  }
  return output;
}

function runRankedAttempt(source, testCase, seed) {
  const startedAt = performance.now();
  const candidates = [];
  for (let index = 0; index < options.rankedPoolSize; index += 1) {
    const candidateSeed = seed + index * options.attempts;
    if (remainingMs(startedAt) <= 0) {
      break;
    }
    const attempt = runCandidateAttempt(source, testCase, candidateSeed, {
      canonicalize: false,
      includeRaw: true,
      maxElapsedMs: remainingMs(startedAt),
    });
    const heuristic = attempt.features
      ? scoreHeuristic(attempt.features, testCase.scoreRange)
      : null;
    candidates.push({
      ...attempt,
      rankedIndex: index,
      heuristic,
    });
  }

  const rankedCandidates = [...candidates].sort(compareRankedCandidates);
  const selected = rankedCandidates[0] ?? null;
  if (!selected) {
    return {
      seed,
      source,
      status: 'timeout',
      rejectReason: 'ranked-pool-empty',
      timings: { total: round(performance.now() - startedAt, 3) },
      solutionGeneration: null,
      candidate: null,
      features: null,
      strategy: {
        name: options.strategy,
        rankedPoolSize: options.rankedPoolSize,
        generatedCandidates: 0,
        selectedRank: null,
        selectedHeuristic: null,
        topHeuristic: null,
      },
    };
  }

  const output = { ...selected };
  output.seed = seed;
  output.strategy = {
    name: options.strategy,
    rankedPoolSize: options.rankedPoolSize,
    generatedCandidates: candidates.length,
    selectedRank: selected.rankedIndex,
    selectedHeuristic: selected.heuristic,
    topHeuristic: rankedCandidates[0]?.heuristic ?? null,
    candidates: rankedCandidates.map((candidate) => ({
      seed: candidate.seed,
      status: candidate.status,
      rejectReason: candidate.rejectReason,
      score: candidate.candidate?.score ?? null,
      clueCount: candidate.candidate?.clueCount ?? null,
      hardestTechnique: candidate.candidate?.hardestTechnique ?? null,
      heuristic: candidate.heuristic,
      features: candidate.features ? summarizeHeuristicFeatures(candidate.features) : null,
    })),
  };
  output.timings = {
    ...selected.timings,
    total: round(performance.now() - startedAt, 3),
  };
  if (options.canonicalize && output.candidate?.canonicalKeyPrefix === null && selected.rawPuzzle && selected.rawSolution) {
    const canonicalStarted = performance.now();
    const pair = canonicalizePair(selected.rawPuzzle, selected.rawSolution);
    output.timings.canonicalization = round(performance.now() - canonicalStarted, 3);
    output.candidate = summarizeCandidate({
      ...selected.fullCandidate,
      puzzle: pair.board,
      solution: pair.solution,
      canonicalKey: pair.key,
    });
  }
  delete output.rawPuzzle;
  delete output.rawSolution;
  delete output.fullCandidate;
  delete output.rankedIndex;
  delete output.heuristic;
  return output;
}

function runCandidateAttempt(source, testCase, seed, overrides = {}) {
  const timings = {};
  const strategyDiagnostics = overrides.stagedRemoval ? {
    name: overrides.targetedCheckpoints ? 'staged-targeted-candidate' : 'staged-removal',
    checkpoints: [],
  } : null;
  const startedAt = performance.now();
  const canonicalize = overrides.canonicalize ?? options.canonicalize;
  const maxElapsedMs = overrides.maxElapsedMs ?? options.maxElapsedMs;
  const stage = (name, operation) => {
    const stageStarted = performance.now();
    const result = operation();
    timings[name] = round(performance.now() - stageStarted, 3);
    return result;
  };
  const output = {
    seed,
    source,
    status: 'unknown',
    rejectReason: null,
    timings,
    solutionGeneration: null,
    candidate: null,
    features: null,
  };

  const solutionResult = stage('solutionGeneration', () => solutionFactory.createWithOptions(seed, {
    source,
    maxElapsedMs,
    ...(source === 'pool' ? { solutionPool } : {}),
  }));
  output.solutionGeneration = solutionResult.diagnostics;
  if (solutionResult.status !== 'success' || !solutionResult.solution) {
    output.status = solutionResult.status === 'invalid-pool' ? 'invalid-request' : 'timeout';
    output.rejectReason = solutionResult.status;
    output.timings.total = round(performance.now() - startedAt, 3);
    return output;
  }

  const remainingBeforeCarve = remainingMs(startedAt, maxElapsedMs);
  if (remainingBeforeCarve <= 0) {
    output.status = 'timeout';
    output.rejectReason = 'before-carve-timeout';
    output.timings.total = round(performance.now() - startedAt, 3);
    return output;
  }
  const carved = stage('clueRemoval', () => overrides.stagedRemoval
    ? carveWithCheckpoints(solutionResult.solution, testCase, seed, remainingBeforeCarve, strategyDiagnostics.checkpoints, {
      targeted: overrides.targetedCheckpoints === true,
    })
    : clueRemover.carve(solutionResult.solution, {
      targetClues: testCase.clueTarget,
      seed,
      symmetry: 'none',
      maxElapsedMs: remainingBeforeCarve,
    }));

  const remainingBeforeMinimize = remainingMs(startedAt, maxElapsedMs);
  if (remainingBeforeMinimize <= 0) {
    output.status = 'timeout';
    output.rejectReason = 'before-minimize-timeout';
    output.timings.total = round(performance.now() - startedAt, 3);
    return output;
  }
  const minimized = options.minimality === 'strict'
    ? stage('minimization', () => minimizer.minimize(carved, { maxElapsedMs: remainingBeforeMinimize }))
    : { puzzle: carved, aborted: false };
  timings.minimization = timings.minimization ?? 0;
  if (minimized.aborted) {
    output.status = 'timeout';
    output.rejectReason = 'minimality-timeout';
    output.timings.total = round(performance.now() - startedAt, 3);
    return output;
  }

  const features = stage('featureExtraction', () => extractGeneratorCandidateFeatures(minimized.puzzle));
  const rated = stage('rating', () => rate(minimized.puzzle, policy));
  const pair = canonicalize
    ? stage('canonicalization', () => canonicalizePair(minimized.puzzle, solutionResult.solution))
    : null;
  timings.canonicalization = timings.canonicalization ?? 0;
  const candidate = buildCandidate(minimized.puzzle, pair, rated, seed);
  const rejectReason = matchesConstraints(candidate, testCase);
  output.status = rejectReason ? 'rejected' : 'success';
  output.rejectReason = rejectReason;
  output.candidate = summarizeCandidate(candidate);
  output.features = features;
  if (strategyDiagnostics) {
    output.strategy = strategyDiagnostics;
  }
  if (overrides.includeRaw) {
    output.rawPuzzle = minimized.puzzle;
    output.rawSolution = solutionResult.solution;
    output.fullCandidate = candidate;
  }
  output.timings.total = round(performance.now() - startedAt, 3);
  return output;
}

function remainingMs(startedAt, maxElapsedMs = options.maxElapsedMs) {
  return Math.max(1, maxElapsedMs - (performance.now() - startedAt));
}

function hasTimeRemaining(startedAt, maxElapsedMs = options.maxElapsedMs) {
  return performance.now() - startedAt < maxElapsedMs;
}

function carveWithCheckpoints(solution, testCase, seed, maxElapsedMs, checkpointDiagnostics, checkpointOptions = {}) {
  const startedAt = performance.now();
  let puzzle = solution;
  const checkpoints = checkpointsFor(testCase.clueTarget);
  for (let index = 0; index < checkpoints.length; index += 1) {
    const targetClues = checkpoints[index];
    const checkpointStarted = performance.now();
    puzzle = clueRemover.carve(puzzle, {
      targetClues,
      seed: seed + (index * 9973),
      symmetry: 'none',
      maxElapsedMs: remainingMs(startedAt, maxElapsedMs),
    });
    const features = extractGeneratorCandidateFeatures(puzzle);
    const rated = rate(puzzle, policy);
    const checkpoint = {
      targetClues,
      actualClues: countClues(puzzle),
      elapsedMs: round(performance.now() - checkpointStarted, 3),
      score: rated.score,
      grade: rated.grade,
      solved: rated.solved,
      hardestTechnique: rated.hardestTechnique,
      candidateTotal: features.candidates.total,
      singlesOnlySolved: features.singlesOnly.solved,
      singlesOnlyRemaining: features.singlesOnly.remainingEmptyCells,
      decision: targetClues === testCase.clueTarget ? 'final-checkpoint' : 'continue',
      reason: null,
    };
    const evaluation = checkpointOptions.targeted
      ? evaluateCheckpoint(testCase, checkpoint, features)
      : null;
    if (evaluation) {
      checkpoint.decision = evaluation.decision;
      checkpoint.reason = evaluation.reason;
      checkpoint.loss = evaluation.loss;
    }
    checkpointDiagnostics.push(checkpoint);
    if (performance.now() - startedAt >= maxElapsedMs) {
      break;
    }
  }
  return puzzle;
}

function checkpointsFor(targetClues) {
  if (targetClues >= 40) {
    return [50, 45, targetClues].filter(uniqueDescendingCheckpoints);
  }
  if (targetClues >= 34) {
    return [50, 42, 38, targetClues].filter(uniqueDescendingCheckpoints);
  }
  if (targetClues >= 30) {
    return [50, 42, 36, targetClues].filter(uniqueDescendingCheckpoints);
  }
  return [50, 40, 33, 29, targetClues].filter(uniqueDescendingCheckpoints);
}

function uniqueDescendingCheckpoints(value, index, values) {
  return value >= values[values.length - 1] && values.indexOf(value) === index;
}

function countClues(board) {
  return board.reduce((count, value) => count + (value === EMPTY ? 0 : 1), 0);
}

function buildCandidate(originalPuzzle, pair, rated, seed) {
  const puzzle = pair?.board ?? originalPuzzle;
  return {
    puzzle,
    solution: pair?.solution ?? null,
    seed,
    clueCount: originalPuzzle.filter((value) => value !== EMPTY).length,
    solved: rated.solved,
    score: rated.score,
    grade: rated.grade,
    hardestTechnique: rated.hardestTechnique,
    techniqueCounts: rated.techniqueCounts,
    canonicalKey: pair?.key ?? null,
    stuckReason: rated.stuckReason ?? null,
  };
}

function summarizeCandidate(candidate) {
  return {
    clueCount: candidate.clueCount,
    solved: candidate.solved,
    score: candidate.score,
    grade: candidate.grade,
    hardestTechnique: candidate.hardestTechnique,
    topTechniqueCounts: topCounts(candidate.techniqueCounts, 8),
    canonicalKeyPrefix: candidate.canonicalKey?.slice(0, 18) ?? null,
    stuckReason: candidate.stuckReason,
  };
}

function matchesConstraints(candidate, testCase) {
  if (!candidate.solved) {
    return 'unsolved-by-rating-policy';
  }
  if (candidate.score < testCase.scoreRange.min) {
    return 'score-too-low';
  }
  if (candidate.score > testCase.scoreRange.max) {
    return 'score-too-high';
  }
  if (candidate.clueCount !== testCase.clueTarget) {
    return 'clue-count-target-mismatch';
  }
  if (testCase.requiredTechnique && !candidateHasTechnique(candidate, testCase.requiredTechnique)) {
    return 'required-technique-missing';
  }
  if (testCase.hardestTechnique && candidate.hardestTechnique !== testCase.hardestTechnique) {
    return 'hardest-technique-mismatch';
  }
  return null;
}

function candidateHasTechnique(candidate, techniqueId) {
  const counts = candidate.techniqueCounts ?? candidate.topTechniqueCounts ?? {};
  return (counts[techniqueId] ?? 0) > 0;
}

function compareRankedCandidates(left, right) {
  const leftScore = left.heuristic?.score ?? Number.NEGATIVE_INFINITY;
  const rightScore = right.heuristic?.score ?? Number.NEGATIVE_INFINITY;
  return rightScore - leftScore || left.rankedIndex - right.rankedIndex;
}

function compareLossCandidates(left, right) {
  const leftLoss = left.loss?.total ?? Number.POSITIVE_INFINITY;
  const rightLoss = right.loss?.total ?? Number.POSITIVE_INFINITY;
  return leftLoss - rightLoss || left.adaptiveIndex - right.adaptiveIndex;
}

function compareStagedTargetedCandidates(left, right) {
  const leftLoss = left.loss?.total ?? Number.POSITIVE_INFINITY;
  const rightLoss = right.loss?.total ?? Number.POSITIVE_INFINITY;
  return leftLoss - rightLoss || left.stagedTargetedIndex - right.stagedTargetedIndex;
}

function compareBeamCandidates(left, right) {
  const leftLoss = left.loss?.total ?? Number.POSITIVE_INFINITY;
  const rightLoss = right.loss?.total ?? Number.POSITIVE_INFINITY;
  const leftSuccess = left.status === 'success' ? 0 : 1;
  const rightSuccess = right.status === 'success' ? 0 : 1;
  return leftSuccess - rightSuccess
    || beamUniquenessRank(left) - beamUniquenessRank(right)
    || leftLoss - rightLoss
    || left.targetClueDistance - right.targetClueDistance
    || right.round - left.round
    || left.id.localeCompare(right.id);
}

function compareBeamFinalCandidates(left, right) {
  const leftLoss = left.loss?.total ?? Number.POSITIVE_INFINITY;
  const rightLoss = right.loss?.total ?? Number.POSITIVE_INFINITY;
  const leftSuccess = left.status === 'success' ? 0 : 1;
  const rightSuccess = right.status === 'success' ? 0 : 1;
  return leftSuccess - rightSuccess
    || left.targetClueDistance - right.targetClueDistance
    || beamUniquenessRank(left) - beamUniquenessRank(right)
    || leftLoss - rightLoss
    || right.round - left.round
    || left.id.localeCompare(right.id);
}

function beamUniquenessRank(candidate) {
  if (candidate.uniqueness?.uniqueSolution === true) {
    return 0;
  }
  if (candidate.uniqueness?.uniqueSolution === false) {
    return 1;
  }
  return 2;
}

function beamHasSuccess(candidates) {
  return candidates.some((candidate) => candidate.status === 'success');
}

function pruneBeamCandidates(candidates, testCase) {
  const unique = uniqueBeamCandidates(candidates);
  const exactTarget = unique
    .filter((candidate) => candidate.fullCandidate.clueCount === testCase.clueTarget)
    .sort(compareBeamCandidates);
  const targetQuota = Math.min(exactTarget.length, Math.ceil(options.beamWidth / 2));
  const output = exactTarget.slice(0, targetQuota);
  const selectedIds = new Set(output.map((candidate) => candidate.id));
  const remaining = unique
    .filter((candidate) => !selectedIds.has(candidate.id))
    .sort(compareBeamCandidates);
  for (const candidate of remaining) {
    if (output.length >= options.beamWidth) {
      break;
    }
    output.push(candidate);
  }
  return output.sort(compareBeamCandidates);
}

function createBeamCache() {
  return {
    features: new Map(),
    ratings: new Map(),
    uniqueness: new Map(),
    hits: { features: 0, ratings: 0, uniqueness: 0 },
    misses: { features: 0, ratings: 0, uniqueness: 0 },
  };
}

function summarizeBeamCache(cache) {
  return {
    featureEntries: cache.features.size,
    ratingEntries: cache.ratings.size,
    uniquenessEntries: cache.uniqueness.size,
    hits: { ...cache.hits },
    misses: { ...cache.misses },
  };
}

function getCachedFeatures(cache, puzzle) {
  const key = serializeBoard(puzzle);
  const cached = cache.features.get(key);
  if (cached) {
    cache.hits.features += 1;
    return cached;
  }
  cache.misses.features += 1;
  const value = extractGeneratorCandidateFeatures(puzzle);
  cache.features.set(key, value);
  return value;
}

function getCachedRating(cache, puzzle) {
  const key = serializeBoard(puzzle);
  const cached = cache.ratings.get(key);
  if (cached) {
    cache.hits.ratings += 1;
    return cached;
  }
  cache.misses.ratings += 1;
  const value = rate(puzzle, policy);
  cache.ratings.set(key, value);
  return value;
}

function getCachedUniqueness(cache, puzzle, maxElapsedMs) {
  const key = serializeBoard(puzzle);
  const cached = cache.uniqueness.get(key);
  if (cached) {
    cache.hits.uniqueness += 1;
    return cached;
  }
  cache.misses.uniqueness += 1;
  const value = checkUniqueness(puzzle, { maxElapsedMs });
  cache.uniqueness.set(key, value);
  return value;
}

function buildBeamCandidate(input) {
  const evaluationStarted = performance.now();
  const timings = {};
  const clueCount = countClues(input.puzzle);
  const shouldCheckUniqueness = clueCount === input.testCase.clueTarget && hasTimeRemaining(input.startedAt);
  const uniquenessStarted = performance.now();
  const uniquenessResult = shouldCheckUniqueness
    ? getCachedUniqueness(input.cache, input.puzzle, Math.max(1, Math.min(40, remainingMs(input.startedAt))))
    : null;
  timings.uniqueness = shouldCheckUniqueness ? round(performance.now() - uniquenessStarted, 3) : 0;
  const featureStarted = performance.now();
  const features = getCachedFeatures(input.cache, input.puzzle);
  timings.featureExtraction = round(performance.now() - featureStarted, 3);
  const ratingStarted = performance.now();
  const rated = getCachedRating(input.cache, input.puzzle);
  timings.rating = round(performance.now() - ratingStarted, 3);
  timings.total = round(performance.now() - evaluationStarted, 3);

  const candidate = buildCandidate(input.puzzle, null, rated, input.seed);
  const uniqueness = summarizeUniqueness(uniquenessResult);
  const uniquenessRejectReason = uniquenessResult === null || uniquenessResult.uniqueSolution
    ? null
    : (uniquenessResult.aborted ? 'adaptive-beam-uniqueness-timeout' : 'adaptive-beam-not-unique');
  const constraintRejectReason = uniquenessRejectReason ?? matchesConstraints(candidate, input.testCase);
  const attemptLike = {
    status: constraintRejectReason ? 'rejected' : 'success',
    rejectReason: constraintRejectReason,
    candidate: summarizeCandidate(candidate),
    features,
  };
  const loss = scoreAdaptiveBeamLoss(attemptLike, input.testCase, uniqueness);

  return {
    id: input.id,
    parentId: input.parentId,
    round: input.round,
    mutation: input.mutation,
    seed: input.seed,
    puzzle: input.puzzle,
    puzzleKey: serializeBoard(input.puzzle),
    solution: input.solution,
    sourceAttempt: input.sourceAttempt,
    history: input.history,
    status: attemptLike.status,
    rejectReason: attemptLike.rejectReason,
    timings,
    fullCandidate: candidate,
    features,
    uniqueness,
    loss,
    targetClueDistance: Math.abs(candidate.clueCount - input.testCase.clueTarget),
  };
}

function summarizeUniqueness(result) {
  if (!result) {
    return {
      status: 'not-checked',
      uniqueSolution: null,
      solutionCount: null,
      aborted: false,
      nodesVisited: null,
    };
  }
  return {
    status: result.status,
    uniqueSolution: result.uniqueSolution,
    solutionCount: result.solutionCount,
    aborted: result.aborted,
    nodesVisited: result.searchDiagnostics?.nodesVisited ?? null,
  };
}

function scoreAdaptiveBeamLoss(attempt, testCase, uniqueness) {
  const baseLoss = scoreLoss(attempt, testCase);
  const wantsNonEasy = testCase.scoreRange.min >= 1000;
  const wantsHard = options.lossProfile === 'hard' || testCase.scoreRange.min >= 2500;
  const uniquenessPenalty = uniqueness?.uniqueSolution === false ? 2500 : 0;
  const targetBandReward = attempt.status === 'success' ? 1000 : 0;
  const singlesRemaining = attempt.features?.singlesOnly.remainingEmptyCells ?? 0;
  const candidateTotal = attempt.features?.candidates.total ?? 0;
  const structureReward = wantsNonEasy
    ? Math.min(350, (singlesRemaining * 20) + Math.min(120, candidateTotal / 2))
    : 0;
  const hardSignalReward = wantsHard
    ? Math.min(250, (attempt.candidate?.score ?? 0) / 20)
    : 0;
  const requiredTechniqueReward = options.lossProfile === 'technique'
    && testCase.requiredTechnique
    && candidateHasTechnique(attempt.candidate ?? {}, testCase.requiredTechnique)
    ? 250
    : 0;
  const hardestTechniqueReward = options.lossProfile === 'technique'
    && testCase.hardestTechnique
    && attempt.candidate?.hardestTechnique === testCase.hardestTechnique
    ? 350
    : 0;
  const techniquePresenceReward = options.lossProfile === 'technique' && attempt.candidate?.hardestTechnique
    ? 100
    : 0;
  const techniqueReward = techniquePresenceReward + requiredTechniqueReward + hardestTechniqueReward;
  const total = Math.max(0, baseLoss.total + uniquenessPenalty - targetBandReward - structureReward - hardSignalReward - techniqueReward);
  return {
    ...baseLoss,
    total: round(total, 3),
    profile: options.lossProfile,
    uniquenessPenalty,
    targetBandReward,
    structureReward: round(structureReward, 3),
    hardSignalReward: round(hardSignalReward, 3),
    techniqueReward,
    requiredTechniqueReward,
    hardestTechniqueReward,
  };
}

function buildBeamMutationPlans(parent, request) {
  const random = createRandom(request.seed);
  const clueCells = [];
  const emptyCells = [];
  for (let cell = 0; cell < parent.puzzle.length; cell += 1) {
    if (parent.puzzle[cell] === EMPTY) {
      emptyCells.push(cell);
    } else {
      clueCells.push(cell);
    }
  }
  const clueCount = clueCells.length;
  const pairedPlans = buildPairedRemoveRestoreMutationPlans({
    parent,
    testCase: request.testCase,
    clueCells: shuffle(clueCells, random),
    emptyCells: shuffle(emptyCells, random),
    random,
    limit: request.limit,
    cache: request.cache,
  });
  const families = clueCount >= request.testCase.clueTarget
    ? [
      { type: 'paired-remove-restore', plans: pairedPlans },
      { type: 'remove-one-clue', cells: shuffle(clueCells, random) },
      { type: 'restore-one-clue', cells: shuffle(emptyCells, random) },
    ]
    : [
      { type: 'restore-one-clue', cells: shuffle(emptyCells, random) },
      { type: 'paired-remove-restore', plans: pairedPlans },
      { type: 'remove-one-clue', cells: shuffle(clueCells, random) },
    ];
  const output = [];
  let cursor = 0;
  while (output.length < request.limit && families.some((family) => cursor < (family.plans?.length ?? family.cells.length))) {
    for (const family of families) {
      if (output.length >= request.limit) {
        break;
      }
      const plan = family.plans?.[cursor];
      if (plan) {
        output.push(plan);
        continue;
      }
      const cell = family.cells?.[cursor];
      if (typeof cell === 'number') {
        output.push({ type: family.type, cell });
      }
    }
    cursor += 1;
  }
  return output;
}

function buildPairedRemoveRestoreMutationPlans(request) {
  if (request.clueCells.length === 0 || request.emptyCells.length === 0) {
    return [];
  }
  const givens = countGivensByHouse(request.parent.puzzle);
  const removeCells = request.clueCells
    .map((cell) => ({ cell, score: scoreRemoveCell(cell, givens) }))
    .sort((left, right) => right.score - left.score || left.cell - right.cell)
    .slice(0, Math.max(request.limit * 3, 8));
  const restoreCells = request.emptyCells
    .map((cell) => ({ cell, score: scoreRestoreCell(cell, givens) }))
    .sort((left, right) => right.score - left.score || left.cell - right.cell)
    .slice(0, Math.max(request.limit * 3, 8));
  const rawPairs = [];
  for (const remove of removeCells) {
    for (const restore of restoreCells) {
      if (remove.cell === restore.cell) {
        continue;
      }
      rawPairs.push({
        remove,
        restore,
        score: remove.score + restore.score,
      });
    }
  }
  const proposalLimit = Math.max(request.limit * 8, 24);
  const proposals = [];
  for (const pair of rawPairs
    .sort((left, right) => right.score - left.score
      || left.remove.cell - right.remove.cell
      || left.restore.cell - right.restore.cell)
    .slice(0, proposalLimit)) {
      const puzzle = applyPairedRemoveRestore(request.parent, pair.remove.cell, pair.restore.cell);
      if (!puzzle) {
        continue;
      }
      const features = getCachedFeatures(request.cache, puzzle);
      const proposal = {
        type: 'paired-remove-restore',
        cell: pair.remove.cell,
        removeCell: pair.remove.cell,
        restoreCell: pair.restore.cell,
        proposalScore: scorePairedProposal({
          parent: request.parent,
          features,
          removeScore: pair.remove.score,
          restoreScore: pair.restore.score,
          testCase: request.testCase,
        }),
      };
      proposals.push(proposal);
  }
  return proposals
    .sort((left, right) => right.proposalScore - left.proposalScore
      || left.removeCell - right.removeCell
      || left.restoreCell - right.restoreCell)
    .slice(0, request.limit);
}

function countGivensByHouse(puzzle) {
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  for (let cell = 0; cell < puzzle.length; cell += 1) {
    if (puzzle[cell] === EMPTY) {
      continue;
    }
    rows[CELL_TO_ROW[cell]] += 1;
    cols[CELL_TO_COL[cell]] += 1;
    boxes[CELL_TO_BOX[cell]] += 1;
  }
  return { rows, cols, boxes };
}

function houseDensity(cell, givens) {
  return givens.rows[CELL_TO_ROW[cell]]
    + givens.cols[CELL_TO_COL[cell]]
    + givens.boxes[CELL_TO_BOX[cell]];
}

function scoreRemoveCell(cell, givens) {
  return houseDensity(cell, givens);
}

function scoreRestoreCell(cell, givens) {
  return 27 - houseDensity(cell, givens);
}

function scorePairedProposal(request) {
  const parentFeatures = request.parent.features;
  const wantsNonEasy = request.testCase.scoreRange.min >= 1000;
  const deltaSinglesRemaining = request.features.singlesOnly.remainingEmptyCells - parentFeatures.singlesOnly.remainingEmptyCells;
  const deltaCandidateTotal = request.features.candidates.total - parentFeatures.candidates.total;
  const deltaBivalueCells = request.features.candidates.bivalueCells - parentFeatures.candidates.bivalueCells;
  const deltaTrivalueCells = request.features.candidates.trivalueCells - parentFeatures.candidates.trivalueCells;
  const givensImbalanceIncrease = Math.max(0, request.features.givens.imbalance - parentFeatures.givens.imbalance);
  const restoreImpactPenalty = Math.max(0, -deltaSinglesRemaining) * (wantsNonEasy ? 50 : 10);
  const structureScore = wantsNonEasy
    ? (deltaSinglesRemaining * 40)
      + deltaCandidateTotal
      + (deltaBivalueCells * 8)
      + (deltaTrivalueCells * 5)
    : (-deltaSinglesRemaining * 20) - Math.max(0, deltaCandidateTotal);
  return round(
    structureScore
      + (request.removeScore * 3)
      + (request.restoreScore * 2)
      - (request.features.candidates.zeroCandidateCells * 500)
      - (givensImbalanceIncrease * 20)
      - restoreImpactPenalty,
    3,
  );
}

function applyPairedRemoveRestore(parent, removeCell, restoreCell) {
  const puzzle = [...parent.puzzle];
  if (puzzle[removeCell] === EMPTY || puzzle[restoreCell] !== EMPTY || parent.solution[restoreCell] === EMPTY) {
    return null;
  }
  puzzle[removeCell] = EMPTY;
  puzzle[restoreCell] = parent.solution[restoreCell];
  return puzzle;
}

function applyBeamMutation(parent, mutation) {
  if (typeof mutation.cell !== 'number') {
    return null;
  }
  const puzzle = [...parent.puzzle];
  if (mutation.type === 'paired-remove-restore') {
    return applyPairedRemoveRestore(parent, mutation.removeCell, mutation.restoreCell);
  }
  if (mutation.type === 'relocate-one-clue') {
    if (typeof mutation.removeCell !== 'number' || typeof mutation.restoreCell !== 'number') {
      return null;
    }
    if (puzzle[mutation.removeCell] === EMPTY || puzzle[mutation.restoreCell] !== EMPTY || parent.solution[mutation.restoreCell] === EMPTY) {
      return null;
    }
    puzzle[mutation.removeCell] = EMPTY;
    puzzle[mutation.restoreCell] = parent.solution[mutation.restoreCell];
    return puzzle;
  }
  if (mutation.type === 'remove-one-clue') {
    if (puzzle[mutation.cell] === EMPTY) {
      return null;
    }
    puzzle[mutation.cell] = EMPTY;
    return puzzle;
  }
  if (mutation.type === 'restore-one-clue') {
    if (puzzle[mutation.cell] !== EMPTY || parent.solution[mutation.cell] === EMPTY) {
      return null;
    }
    puzzle[mutation.cell] = parent.solution[mutation.cell];
    return puzzle;
  }
  return null;
}

function uniqueBeamCandidates(candidates) {
  const seen = new Set();
  const output = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.puzzleKey)) {
      continue;
    }
    seen.add(candidate.puzzleKey);
    output.push(candidate);
  }
  return output;
}

function summarizeBeamTrace(candidate, parent) {
  return {
    round: candidate.round,
    id: candidate.id,
    parentId: candidate.parentId,
    mutation: candidate.mutation,
    status: candidate.status,
    rejectReason: candidate.rejectReason,
    lossBefore: parent?.loss?.total ?? null,
    lossAfter: candidate.loss.total,
    scoreBefore: parent?.fullCandidate?.score ?? null,
    scoreAfter: candidate.fullCandidate.score,
    clueCountBefore: parent?.fullCandidate?.clueCount ?? null,
    clueCountAfter: candidate.fullCandidate.clueCount,
    unique: candidate.uniqueness.uniqueSolution,
    elapsedMs: candidate.timings.total,
  };
}

function scoreStagedTargetedLoss(attempt, testCase) {
  const baseLoss = scoreLoss(attempt, testCase);
  const checkpoints = attempt.strategy?.checkpoints ?? [];
  const finalCheckpoint = checkpoints.at(-1);
  const finalSinglesRemaining = finalCheckpoint?.singlesOnlyRemaining ?? attempt.features?.singlesOnly.remainingEmptyCells ?? 0;
  const wantsNonEasy = testCase.scoreRange.min >= 1000;
  const singlesPenalty = wantsNonEasy && finalSinglesRemaining === 0 ? 500 : 0;
  const checkpointProgressReward = checkpoints.reduce((sum, checkpoint) => {
    return sum + (checkpoint.singlesOnlyRemaining > 0 ? Math.min(200, checkpoint.singlesOnlyRemaining * 10) : 0);
  }, 0);
  const targetBandReward = attempt.status === 'success' ? 1000 : 0;
  const total = Math.max(0, baseLoss.total + singlesPenalty - checkpointProgressReward - targetBandReward);
  return {
    ...baseLoss,
    total: round(total, 3),
    singlesPenalty,
    checkpointProgressReward,
    targetBandReward,
    finalSinglesRemaining,
  };
}

function evaluateCheckpoint(testCase, checkpoint, features) {
  const scoreDistance = distanceToRange(checkpoint.score, testCase.scoreRange.min, testCase.scoreRange.max);
  const clueDistance = Math.abs(checkpoint.actualClues - testCase.clueTarget);
  const wantsEasy = testCase.scoreRange.max <= 999;
  const wantsNonEasy = testCase.scoreRange.min >= 1000;
  const atFinalClueTarget = checkpoint.actualClues === testCase.clueTarget;
  const loss = round(scoreDistance + (clueDistance * 100), 3);

  if (atFinalClueTarget && scoreDistance === 0) {
    return { decision: 'accept-for-final-rating', reason: 'score-in-target-range-at-final-clue-target', loss };
  }
  if (atFinalClueTarget) {
    return { decision: 'final-checkpoint', reason: checkpoint.score < testCase.scoreRange.min ? 'final-score-too-low' : 'final-score-too-high', loss };
  }
  if (wantsEasy && checkpoint.score > testCase.scoreRange.max) {
    return { decision: 'abandon-too-hard', reason: 'easy-target-score-already-too-high', loss };
  }
  if (wantsNonEasy && checkpoint.score < testCase.scoreRange.min && features.singlesOnly.solved && checkpoint.actualClues <= testCase.clueTarget + 6) {
    return { decision: 'restore-and-branch', reason: 'near-target-still-singles-only-too-easy', loss };
  }
  if (wantsNonEasy && checkpoint.singlesOnlyRemaining > 0) {
    return { decision: 'continue', reason: 'non-easy-structure-signal-present', loss };
  }
  return { decision: 'continue', reason: 'checkpoint-needs-more-removal', loss };
}

function scoreLoss(attempt, testCase) {
  const score = attempt.candidate?.score;
  const clueCount = attempt.candidate?.clueCount;
  const scoreDistance = typeof score === 'number'
    ? distanceToRange(score, testCase.scoreRange.min, testCase.scoreRange.max)
    : 20000;
  const clueDistance = typeof clueCount === 'number'
    ? Math.abs(clueCount - testCase.clueTarget)
    : 81;
  const unsolvedPenalty = attempt.candidate?.solved === false ? 5000 : 0;
  const tooEasyPenalty = attempt.rejectReason === 'score-too-low' ? 1000 : 0;
  const tooHardPenalty = attempt.rejectReason === 'score-too-high' ? 500 : 0;
  const timeoutPenalty = attempt.status === 'timeout' ? 10000 : 0;
  const singlesPenalty = testCase.scoreRange.min >= 1000 && attempt.features?.singlesOnly.solved ? 250 : 0;
  const missingTechniquePenalty = testCase.requiredTechnique && !candidateHasTechnique(attempt.candidate ?? {}, testCase.requiredTechnique) ? 800 : 0;
  const hardestTechniquePenalty = testCase.hardestTechnique && attempt.candidate?.hardestTechnique !== testCase.hardestTechnique ? 1200 : 0;
  const total = scoreDistance
    + (clueDistance * 100)
    + unsolvedPenalty
    + tooEasyPenalty
    + tooHardPenalty
    + timeoutPenalty
    + singlesPenalty
    + missingTechniquePenalty
    + hardestTechniquePenalty;
  return {
    total: round(total, 3),
    scoreDistance,
    clueDistance,
    unsolvedPenalty,
    tooEasyPenalty,
    tooHardPenalty,
    timeoutPenalty,
    singlesPenalty,
    missingTechniquePenalty,
    hardestTechniquePenalty,
  };
}

function distanceToRange(value, min, max) {
  if (value < min) {
    return min - value;
  }
  if (value > max) {
    return value - max;
  }
  return 0;
}

function scoreHeuristic(features, scoreRange) {
  const wantsNonEasy = scoreRange.min >= 1000;
  const singlesRemaining = features.singlesOnly.remainingEmptyCells;
  const candidateTotal = features.candidates.total;
  const zeroPenalty = features.candidates.zeroCandidateCells * 100;
  const structureSignal = (features.candidates.bivalueCells * 3)
    + (features.candidates.trivalueCells * 2)
    + (features.givens.imbalance * 4)
    + ((features.givens.max - features.givens.average) * 2);
  const score = wantsNonEasy
    ? (singlesRemaining * 50) + candidateTotal + structureSignal - zeroPenalty
    : ((features.singlesOnly.solved ? 200 : 0) - (singlesRemaining * 25) - zeroPenalty);
  return {
    score: round(score, 3),
    targetBucket: scoreRange.id,
    signals: summarizeHeuristicFeatures(features),
  };
}

function summarizeHeuristicFeatures(features) {
  return {
    candidateTotal: features.candidates.total,
    candidateAverage: features.candidates.average,
    bivalueCells: features.candidates.bivalueCells,
    trivalueCells: features.candidates.trivalueCells,
    zeroCandidateCells: features.candidates.zeroCandidateCells,
    singlesOnlySolved: features.singlesOnly.solved,
    singlesOnlyRemaining: features.singlesOnly.remainingEmptyCells,
    givensEntropy: features.givens.entropy,
    givensImbalance: features.givens.imbalance,
  };
}

function summarizeAttempts(attempts) {
  const successes = attempts.filter((attempt) => attempt.status === 'success').length;
  const rejected = attempts.filter((attempt) => attempt.status === 'rejected').length;
  const elapsed = attempts.map((attempt) => attempt.timings.total ?? 0);
  const totalElapsed = elapsed.reduce((sum, value) => sum + value, 0);
  const scores = attempts.map((attempt) => attempt.candidate?.score).filter((value) => typeof value === 'number');
  const rejectionCounts = {};
  const hardestTechniqueCounts = {};
  const canonicalKeys = new Set();
  const generatedCandidates = [];
  const internalCandidateCounts = [];
  const selectedHeuristicScores = [];
  const selectedRankCounts = {};
  const checkpointCounts = [];
  const finalCheckpointScores = [];
  const finalCheckpointCandidateTotals = [];
  const finalCheckpointSinglesRemaining = [];
  const checkpointDecisionCounts = {};
  const featureSignals = {
    candidateTotalAverage: [],
    singlesOnlyRemainingAverage: [],
    givensImbalanceAverage: [],
  };
  const featureScoreRows = [];
  for (const attempt of attempts) {
    internalCandidateCounts.push(attempt.strategy?.generatedCandidates ?? 1);
    if (attempt.rejectReason) {
      rejectionCounts[attempt.rejectReason] = (rejectionCounts[attempt.rejectReason] ?? 0) + 1;
    }
    if (attempt.candidate?.hardestTechnique) {
      hardestTechniqueCounts[attempt.candidate.hardestTechnique] = (hardestTechniqueCounts[attempt.candidate.hardestTechnique] ?? 0) + 1;
    }
    if (attempt.candidate?.canonicalKeyPrefix) {
      canonicalKeys.add(attempt.candidate.canonicalKeyPrefix);
    }
    if (attempt.features) {
      featureSignals.candidateTotalAverage.push(attempt.features.candidates.total);
      featureSignals.singlesOnlyRemainingAverage.push(attempt.features.singlesOnly.remainingEmptyCells);
      featureSignals.givensImbalanceAverage.push(attempt.features.givens.imbalance);
      if (typeof attempt.candidate?.score === 'number') {
        featureScoreRows.push({
          score: attempt.candidate.score,
          features: summarizeHeuristicFeatures(attempt.features),
        });
      }
    }
    if (attempt.strategy) {
      if (typeof attempt.strategy.generatedCandidates === 'number') {
        generatedCandidates.push(attempt.strategy.generatedCandidates);
      }
      if (typeof attempt.strategy.selectedRank === 'number') {
        const key = String(attempt.strategy.selectedRank);
        selectedRankCounts[key] = (selectedRankCounts[key] ?? 0) + 1;
      }
      if (typeof attempt.strategy.selectedHeuristic?.score === 'number') {
        selectedHeuristicScores.push(attempt.strategy.selectedHeuristic.score);
      }
      for (const rankedCandidate of attempt.strategy.candidates ?? []) {
        if (typeof rankedCandidate.score === 'number' && rankedCandidate.features) {
          featureScoreRows.push({
            score: rankedCandidate.score,
            features: rankedCandidate.features,
          });
        }
      }
      if (Array.isArray(attempt.strategy.checkpoints) && attempt.strategy.checkpoints.length > 0) {
        checkpointCounts.push(attempt.strategy.checkpoints.length);
        const finalCheckpoint = attempt.strategy.checkpoints[attempt.strategy.checkpoints.length - 1];
        finalCheckpointScores.push(finalCheckpoint.score);
        finalCheckpointCandidateTotals.push(finalCheckpoint.candidateTotal);
        finalCheckpointSinglesRemaining.push(finalCheckpoint.singlesOnlyRemaining);
        for (const checkpoint of attempt.strategy.checkpoints) {
          if (checkpoint.decision) {
            checkpointDecisionCounts[checkpoint.decision] = (checkpointDecisionCounts[checkpoint.decision] ?? 0) + 1;
          }
        }
      }
    }
  }
  return {
    attempts: attempts.length,
    successes,
    rejected,
    successRate: round(successes / attempts.length, 4),
    timePerSuccessMs: successes > 0 ? round(totalElapsed / successes, 3) : null,
    rejectionCounts,
    elapsedMs: summarizeNumbers(elapsed),
    score: summarizeNumbers(scores),
    hardestTechniqueCounts: topCounts(hardestTechniqueCounts, 8),
    uniqueCanonicalKeyPrefixes: canonicalKeys.size,
    featureAverages: {
      candidateTotal: summarizeNumbers(featureSignals.candidateTotalAverage).average,
      singlesOnlyRemaining: summarizeNumbers(featureSignals.singlesOnlyRemainingAverage).average,
      givensImbalance: summarizeNumbers(featureSignals.givensImbalanceAverage).average,
    },
    strategy: {
      generatedCandidates: summarizeNumbers(generatedCandidates),
      internalCandidateCount: summarizeNumbers(internalCandidateCounts),
      selectedRankCounts,
      selectedHeuristicScore: summarizeNumbers(selectedHeuristicScores),
      featureScoreCorrelation: correlateFeaturesWithScore(featureScoreRows),
      checkpoints: {
        count: summarizeNumbers(checkpointCounts),
        finalScore: summarizeNumbers(finalCheckpointScores),
        finalCandidateTotal: summarizeNumbers(finalCheckpointCandidateTotals),
        finalSinglesOnlyRemaining: summarizeNumbers(finalCheckpointSinglesRemaining),
        decisionCounts: topCounts(checkpointDecisionCounts, 12),
      },
    },
    stageTimingMs: summarizeStageTimings(attempts),
  };
}

function correlateFeaturesWithScore(rows) {
  const fields = [
    'candidateTotal',
    'candidateAverage',
    'bivalueCells',
    'trivalueCells',
    'singlesOnlyRemaining',
    'givensEntropy',
    'givensImbalance',
  ];
  return Object.fromEntries(fields.map((field) => [
    field,
    round(pearson(rows.map((row) => row.features[field]), rows.map((row) => row.score)), 4),
  ]));
}

function pearson(leftValues, rightValues) {
  const pairs = leftValues
    .map((left, index) => [left, rightValues[index]])
    .filter(([left, right]) => typeof left === 'number' && typeof right === 'number');
  if (pairs.length < 2) {
    return null;
  }
  const leftAverage = average(pairs.map(([left]) => left));
  const rightAverage = average(pairs.map(([, right]) => right));
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (const [left, right] of pairs) {
    const leftDelta = left - leftAverage;
    const rightDelta = right - rightAverage;
    covariance += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  }
  if (leftVariance === 0 || rightVariance === 0) {
    return null;
  }
  return covariance / Math.sqrt(leftVariance * rightVariance);
}

function summarizeStageTimings(attempts) {
  const stages = ['solutionGeneration', 'clueRemoval', 'minimization', 'featureExtraction', 'rating', 'presetValidation', 'uniqueness', 'beamSearch', 'canonicalization', 'total'];
  const output = {};
  for (const stage of stages) {
    output[stage] = summarizeNumbers(attempts.map((attempt) => attempt.timings[stage]).filter((value) => typeof value === 'number'));
  }
  return output;
}

function aggregateRows(rows) {
  const attempts = rows.flatMap((row) => row.attempts);
  return summarizeAttempts(attempts);
}

function buildInterpretation(rows) {
  const targetRows = rows.map((row) => ({
    id: row.id,
    successRate: row.summary.successRate,
    topRejection: Object.entries(row.summary.rejectionCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null,
    scoreAverage: row.summary.score.average,
  }));
  const unreliableTargets = targetRows.filter((row) => row.successRate < 0.5).map((row) => row.id);
  return {
    targetRows,
    unreliableTargets,
    decision: unreliableTargets.length > 0
      ? 'Some target bands remain unreliable under this workload; use this as baseline before staged-removal or ranking changes.'
      : 'All sampled target bands reached at least 50% hit rate under this workload.',
  };
}

function summarizeNumbers(values) {
  if (values.length === 0) {
    return { count: 0, min: null, max: null, average: null, median: null, p95: null };
  }
  const sorted = [...values].sort((left, right) => left - right);
  return {
    count: values.length,
    min: round(sorted[0], 3),
    max: round(sorted[sorted.length - 1], 3),
    average: round(average(values), 3),
    median: round(percentile(sorted, 0.5), 3),
    p95: round(percentile(sorted, 0.95), 3),
  };
}

function percentile(sortedValues, quantile) {
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * quantile) - 1);
  return sortedValues[index] ?? null;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function topCounts(counts, limit) {
  return Object.fromEntries(
    Object.entries(counts)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, limit),
  );
}

function topRejection(rejectionCounts) {
  return Object.entries(rejectionCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'none';
}

function selectPresetSeed(difficulty, seed) {
  const candidates = presetSeeds.filter((item) => scoreRangeForDifficulty(difficulty).id === scoreRangeForScore(item.score).id);
  if (candidates.length === 0) {
    return null;
  }
  return candidates[(seed - 1) % candidates.length] ?? candidates[0];
}

function validatePresetTransform(seed, puzzle, solution, rated) {
  const validation = validate(solution);
  if (!validation.legal) {
    return { valid: false, reason: 'preset-transformed-solution-invalid', details: validation };
  }
  for (let index = 0; index < puzzle.length; index += 1) {
    if (puzzle[index] !== EMPTY && puzzle[index] !== solution[index]) {
      return { valid: false, reason: 'preset-transformed-clue-mismatch', cell: index };
    }
  }
  const uniqueness = checkUniqueness(puzzle);
  if (!uniqueness.uniqueSolution) {
    return {
      valid: false,
      reason: uniqueness.aborted ? 'preset-transformed-uniqueness-aborted' : 'preset-transformed-not-unique',
      status: uniqueness.status,
      solutionCount: uniqueness.solutionCount,
    };
  }
  if (!ratingMetadataMatches(seed, rated)) {
    return {
      valid: false,
      reason: 'preset-transformed-rating-drift',
      expected: ratingSummary(seed),
      actual: ratingSummary(rated),
    };
  }
  return {
    valid: true,
    reason: null,
    uniqueness: {
      status: uniqueness.status,
      solutionCount: uniqueness.solutionCount,
      nodesVisited: uniqueness.searchDiagnostics.nodesVisited,
    },
    rating: ratingSummary(rated),
  };
}

function loadPresetSeeds(path) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error(`Preset seed file ${path} must be an array.`);
  }
  return parsed.map((item, index) => normalizePresetSeed(item, index, path));
}

function normalizePresetSeed(item, index, path) {
  const label = `${path}[${index}]`;
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`${label} must be an object.`);
  }
  const requiredStrings = ['id', 'puzzle', 'solution', 'ratingProfile', 'ratingPolicyVersion', 'canonicalKey'];
  for (const field of requiredStrings) {
    if (typeof item[field] !== 'string' || item[field].length === 0) {
      throw new Error(`${label}.${field} must be a non-empty string.`);
    }
  }
  if (!item.source || typeof item.source !== 'object' || typeof item.source.license !== 'string') {
    throw new Error(`${label}.source.license is required.`);
  }
  const puzzleBoard = parsePuzzle(item.puzzle);
  const solutionBoard = parsePuzzle(item.solution);
  const clueCount = puzzleBoard.filter((value) => value !== EMPTY).length;
  if (clueCount !== item.clueCount) {
    throw new Error(`${label}.clueCount does not match puzzle.`);
  }
  const solutionValidation = validate(solutionBoard);
  if (!solutionValidation.legal) {
    throw new Error(`${label}.solution is invalid.`);
  }
  for (let cell = 0; cell < puzzleBoard.length; cell += 1) {
    if (puzzleBoard[cell] !== EMPTY && puzzleBoard[cell] !== solutionBoard[cell]) {
      throw new Error(`${label}.puzzle clue does not match solution at ${cell}.`);
    }
  }
  const uniqueness = checkUniqueness(puzzleBoard);
  if (!uniqueness.uniqueSolution) {
    throw new Error(`${label}.puzzle must have a unique solution.`);
  }
  const seedPolicy = getRatingPolicy(item.ratingProfile);
  const rated = rate(puzzleBoard, seedPolicy);
  if (!ratingMetadataMatches(item, rated)) {
    throw new Error(`${label}.rating metadata does not match current ${item.ratingProfile} policy.`);
  }
  const pair = canonicalizePair(puzzleBoard, solutionBoard);
  if (pair.key !== item.canonicalKey) {
    throw new Error(`${label}.canonicalKey does not match canonicalizePair result.`);
  }
  return {
    ...item,
    puzzleBoard,
    solutionBoard,
  };
}

function ratingMetadataMatches(expected, actual) {
  if (expected.score !== actual.score) {
    return false;
  }
  if ((expected.grade ?? null) !== (actual.grade ?? null)) {
    return false;
  }
  if ((expected.hardestTechnique ?? null) !== (actual.hardestTechnique ?? null)) {
    return false;
  }
  return JSON.stringify(expected.techniqueCounts ?? {}) === JSON.stringify(actual.techniqueCounts ?? {});
}

function ratingSummary(value) {
  return {
    score: value.score,
    grade: value.grade ?? null,
    hardestTechnique: value.hardestTechnique ?? null,
    techniqueCounts: value.techniqueCounts ?? {},
  };
}

function scoreRangeForDifficulty(difficulty) {
  const range = SCORE_RANGES.find((item) => item.id === difficulty);
  if (!range) {
    throw new Error(`Unknown difficulty: ${difficulty}`);
  }
  return range;
}

function scoreRangeForScore(score) {
  return SCORE_RANGES.find((range) => score >= range.min && score <= range.max) ?? SCORE_RANGES[SCORE_RANGES.length - 1];
}

function buildRandomPresetTransform(seed) {
  const random = createRandom(seed);
  return {
    transposed: false,
    rowOrder: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    colOrder: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    digitMap: buildDigitMap(random),
  };
}

function buildHouseOrder(random) {
  const blockOrder = shuffle([0, 1, 2], random);
  const order = [];
  for (const block of blockOrder) {
    const offsets = shuffle([0, 1, 2], random);
    for (const offset of offsets) {
      order.push(block * 3 + offset);
    }
  }
  return order;
}

function buildDigitMap(random) {
  const targets = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const map = new Array(10).fill(0);
  for (let digit = 1; digit <= 9; digit += 1) {
    map[digit] = targets[digit - 1];
  }
  return map;
}

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

function shuffle(items, random) {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function loadCorpus(path) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(parsed.rows)) {
    throw new Error(`Corpus ${path} must contain rows.`);
  }
  return parsed;
}

function parseArgs(args) {
  const explicitOptions = new Set();
  const parsed = {
    workload: null,
    attempts: DEFAULT_ATTEMPTS,
    maxElapsedMs: DEFAULT_MAX_ELAPSED_MS,
    caseLimit: DEFAULT_CASE_LIMIT,
    seed: DEFAULT_SEED,
    profile: 'classic-stable',
    strategy: 'default',
    difficulty: null,
    presetSeedsPath: null,
    rankedPoolSize: DEFAULT_RANKED_POOL_SIZE,
    stagedTargetedPoolSize: DEFAULT_STAGED_TARGETED_POOL_SIZE,
    adaptivePoolSize: DEFAULT_ADAPTIVE_POOL_SIZE,
    beamWidth: DEFAULT_BEAM_WIDTH,
    beamRounds: DEFAULT_BEAM_ROUNDS,
    mutationsPerCandidate: DEFAULT_MUTATIONS_PER_CANDIDATE,
    lossProfile: 'medium',
    requiredTechnique: null,
    hardestTechnique: null,
    minimality: 'none',
    canonicalize: true,
    corpusPath: CORPUS_PATH,
    poolSize: 12,
    sources: [...SOLUTION_SOURCES],
    json: false,
    outputJson: null,
    outputMarkdown: null,
    outDir: null,
  };
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--json') {
      parsed.json = true;
      continue;
    }
    if (item === '--attempts') {
      parsed.attempts = parsePositiveInteger(requireValue(args, index, item), item);
      explicitOptions.add('attempts');
      index += 1;
      continue;
    }
    if (item === '--max-elapsed-ms') {
      parsed.maxElapsedMs = parsePositiveInteger(requireValue(args, index, item), item);
      explicitOptions.add('maxElapsedMs');
      index += 1;
      continue;
    }
    if (item === '--case-limit') {
      parsed.caseLimit = parsePositiveInteger(requireValue(args, index, item), item);
      explicitOptions.add('caseLimit');
      index += 1;
      continue;
    }
    if (item === '--seed') {
      parsed.seed = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--profile') {
      parsed.profile = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--workload') {
      const value = requireValue(args, index, item);
      if (!Object.hasOwn(WORKLOAD_PRESETS, value)) {
        throw new Error(`--workload must be one of: ${Object.keys(WORKLOAD_PRESETS).join(', ')}.`);
      }
      parsed.workload = value;
      index += 1;
      continue;
    }
    if (item === '--strategy') {
      const value = requireValue(args, index, item);
      if (!Object.hasOwn(STRATEGY_VERSIONS, value)) {
        throw new Error(`--strategy must be one of: ${Object.keys(STRATEGY_VERSIONS).join(', ')}.`);
      }
      parsed.strategy = value;
      index += 1;
      continue;
    }
    if (item === '--difficulty') {
      const value = requireValue(args, index, item);
      if (!SCORE_RANGES.some((range) => range.id === value)) {
        throw new Error(`--difficulty must be one of: ${SCORE_RANGES.map((range) => range.id).join(', ')}.`);
      }
      parsed.difficulty = value;
      index += 1;
      continue;
    }
    if (item === '--preset-seeds') {
      parsed.presetSeedsPath = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--ranked-pool-size') {
      parsed.rankedPoolSize = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--staged-targeted-pool-size') {
      parsed.stagedTargetedPoolSize = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--adaptive-pool-size') {
      parsed.adaptivePoolSize = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--beam-width') {
      parsed.beamWidth = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--beam-rounds') {
      parsed.beamRounds = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--mutations-per-candidate') {
      parsed.mutationsPerCandidate = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--loss-profile') {
      const value = requireValue(args, index, item);
      if (!LOSS_PROFILES.includes(value)) {
        throw new Error(`--loss-profile must be one of: ${LOSS_PROFILES.join(', ')}.`);
      }
      parsed.lossProfile = value;
      index += 1;
      continue;
    }
    if (item === '--required-technique') {
      parsed.requiredTechnique = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--hardest-technique') {
      parsed.hardestTechnique = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--minimality') {
      const value = requireValue(args, index, item);
      if (value !== 'none' && value !== 'strict') {
        throw new Error('--minimality must be none or strict.');
      }
      parsed.minimality = value;
      index += 1;
      continue;
    }
    if (item === '--skip-canonicalize') {
      parsed.canonicalize = false;
      continue;
    }
    if (item === '--corpus') {
      parsed.corpusPath = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--pool-size') {
      parsed.poolSize = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--source') {
      const source = requireValue(args, index, item);
      if (!SOLUTION_SOURCES.includes(source)) {
        throw new Error(`Unknown source: ${source}`);
      }
      parsed.sources = [source];
      index += 1;
      continue;
    }
    if (item === '--output-json') {
      parsed.outputJson = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--output-markdown') {
      parsed.outputMarkdown = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--out-dir') {
      parsed.outDir = requireValue(args, index, item);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${item}`);
  }
  applyWorkloadPreset(parsed, explicitOptions);
  validateParsedOptions(parsed);
  return parsed;
}

function validateParsedOptions(parsed) {
  if (parsed.strategy === 'preset-transform' && !parsed.presetSeedsPath) {
    throw new Error('--strategy preset-transform requires --preset-seeds.');
  }
  if (parsed.requiredTechnique && !techniqueFamilies.has(parsed.requiredTechnique)) {
    throw new Error(`Unknown --required-technique: ${parsed.requiredTechnique}`);
  }
  if (parsed.hardestTechnique && !techniqueFamilies.has(parsed.hardestTechnique)) {
    throw new Error(`Unknown --hardest-technique: ${parsed.hardestTechnique}`);
  }
}

function applyWorkloadPreset(parsed, explicitOptions) {
  if (!parsed.workload) {
    return;
  }
  const preset = WORKLOAD_PRESETS[parsed.workload];
  if (!explicitOptions.has('attempts')) {
    parsed.attempts = preset.attempts;
  }
  if (!explicitOptions.has('caseLimit')) {
    parsed.caseLimit = preset.caseLimit;
  }
  if (!explicitOptions.has('maxElapsedMs')) {
    parsed.maxElapsedMs = preset.maxElapsedMs;
  }
}

function parsePositiveInteger(raw, option) {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return value;
}

function requireValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function readGitInfo() {
  try {
    return {
      sha: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim().length > 0,
    };
  } catch {
    return { sha: null, dirty: null };
  }
}

function writeJson(path, value) {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, 'utf8');
}

function renderHuman(summary) {
  const lines = [
    `Generator diagnostics benchmark: workload=${summary.options.workload ?? 'custom'}, profile=${summary.options.profile}, strategy=${summary.options.strategy}, strategyVersion=${summary.options.strategyVersion}, attempts=${summary.options.attempts}, maxElapsedMs=${summary.options.maxElapsedMs}`,
  ];
  for (const row of summary.rows) {
    lines.push([
      `- ${row.id}`,
      `success=${row.summary.successes}/${row.summary.attempts}`,
      `elapsedP95=${formatMs(row.summary.elapsedMs.p95)}`,
      `timePerSuccess=${formatMs(row.summary.timePerSuccessMs)}`,
      `scoreAvg=${row.summary.score.average ?? 'n/a'}`,
      `topReject=${Object.entries(row.summary.rejectionCounts)[0]?.[0] ?? 'none'}`,
      `internalCandidatesAvg=${row.summary.strategy.internalCandidateCount.average ?? 1}`,
    ].join(', '));
  }
  lines.push(`Decision: ${summary.interpretation.decision}`);
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(summary) {
  const lines = [
    '# Generator Diagnostics Benchmark Report',
    '',
    `- Benchmark: ${summary.benchmarkId}`,
    `- Created at: ${summary.createdAt}`,
    `- Git: ${summary.git.sha ?? 'unknown'}${summary.git.dirty ? ' (dirty)' : ''}`,
    `- Node: ${summary.node.version} ${summary.node.platform}/${summary.node.arch}`,
    `- Workload: ${summary.options.workload ?? 'custom'}`,
    `- Profile: ${summary.options.profile}`,
    `- Strategy: ${summary.options.strategy}`,
    `- Strategy version: ${summary.options.strategyVersion}`,
    `- Ranked pool size: ${summary.options.rankedPoolSize ?? 'n/a'}`,
    `- Staged targeted pool size: ${summary.options.stagedTargetedPoolSize ?? 'n/a'}`,
    `- Adaptive pool size: ${summary.options.adaptivePoolSize ?? 'n/a'}`,
    `- Beam width: ${summary.options.beamWidth ?? 'n/a'}`,
    `- Beam rounds: ${summary.options.beamRounds ?? 'n/a'}`,
    `- Mutations per candidate: ${summary.options.mutationsPerCandidate ?? 'n/a'}`,
    `- Loss profile: ${summary.options.lossProfile ?? 'n/a'}`,
    `- Required technique: ${summary.options.requiredTechnique ?? 'n/a'}`,
    `- Hardest technique: ${summary.options.hardestTechnique ?? 'n/a'}`,
    `- Attempts per case: ${summary.options.attempts}`,
    `- Max elapsed per attempt: ${summary.options.maxElapsedMs}ms`,
    `- Canonicalize: ${summary.options.canonicalize}`,
    '',
    '## Strategy Summary',
    '',
    '| Workload | Strategy | Success Rate | Elapsed p95 ms | Time / Success ms | Internal Candidates Avg | Top Rejection | Next Action |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- | --- |',
    `| ${summary.options.workload ?? 'custom'} | ${summary.options.strategy} | ${summary.aggregate.successRate} | ${summary.aggregate.elapsedMs.p95 ?? 'n/a'} | ${summary.aggregate.timePerSuccessMs ?? 'n/a'} | ${summary.aggregate.strategy.internalCandidateCount.average ?? 1} | ${topRejection(summary.aggregate.rejectionCounts)} | ${summary.interpretation.decision} |`,
    '',
    '## Target Hit Rate',
    '',
    '| Case | Success | Success Rate | Top Rejection | Score Avg | Elapsed p95 | Time / Success | Internal Candidates Avg | Checkpoints Avg | Candidate Total Avg | Singles Remaining Avg | Corr(candidateTotal,score) | Corr(singlesRemaining,score) |',
    '| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const row of summary.rows) {
    lines.push(`| ${row.id} | ${row.summary.successes}/${row.summary.attempts} | ${row.summary.successRate} | ${topRejection(row.summary.rejectionCounts)} | ${row.summary.score.average ?? 'n/a'} | ${row.summary.elapsedMs.p95 ?? 'n/a'} | ${row.summary.timePerSuccessMs ?? 'n/a'} | ${row.summary.strategy.internalCandidateCount.average ?? 1} | ${row.summary.strategy.checkpoints.count.average ?? 'n/a'} | ${row.summary.featureAverages.candidateTotal ?? 'n/a'} | ${row.summary.featureAverages.singlesOnlyRemaining ?? 'n/a'} | ${row.summary.strategy.featureScoreCorrelation.candidateTotal ?? 'n/a'} | ${row.summary.strategy.featureScoreCorrelation.singlesOnlyRemaining ?? 'n/a'} |`);
  }
  lines.push(
    '',
    '## Aggregate',
    '',
    `- Success rate: ${summary.aggregate.successRate}`,
    `- Elapsed p95: ${formatMs(summary.aggregate.elapsedMs.p95)}`,
    `- Time per success: ${formatMs(summary.aggregate.timePerSuccessMs)}`,
    `- Score average: ${summary.aggregate.score.average ?? 'n/a'}`,
    `- Generated candidates average: ${summary.aggregate.strategy.generatedCandidates.average ?? 1}`,
    `- Internal candidates average: ${summary.aggregate.strategy.internalCandidateCount.average ?? 1}`,
    `- Checkpoints average: ${summary.aggregate.strategy.checkpoints.count.average ?? 'n/a'}`,
    `- Final checkpoint score average: ${summary.aggregate.strategy.checkpoints.finalScore.average ?? 'n/a'}`,
    `- Checkpoint decision counts: ${JSON.stringify(summary.aggregate.strategy.checkpoints.decisionCounts)}`,
    `- Feature/score correlation: candidateTotal=${summary.aggregate.strategy.featureScoreCorrelation.candidateTotal ?? 'n/a'}, singlesOnlyRemaining=${summary.aggregate.strategy.featureScoreCorrelation.singlesOnlyRemaining ?? 'n/a'}, givensImbalance=${summary.aggregate.strategy.featureScoreCorrelation.givensImbalance ?? 'n/a'}`,
    `- Decision: ${summary.interpretation.decision}`,
    '',
  );
  return `${lines.join('\n')}\n`;
}

function round(value, digits) {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatMs(value) {
  return typeof value === 'number' ? `${value}ms` : 'n/a';
}
