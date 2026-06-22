#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

import {
  checkUniqueness,
  getRatingPolicy,
  parsePuzzle,
  rate,
  serializeBoard,
} from '../dist/src/index.js';

const BUILT_IN_PROFILES = new Set(['classic-stable', 'classic-extended', 'classic-galaxy']);
const GRADE_RANK = new Map([
  ['basic', 1],
  ['normal', 2],
  ['hard', 3],
  ['expert', 4],
  ['epic', 5],
]);

if (isMainThread) {
  await main();
} else {
  runWorker();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = performance.now();
  const candidates = orderCandidatePuzzles(loadCandidatePuzzles(options.inputPath), options);
  const excludedPuzzles = options.excludeCorpusPath ? loadExcludedCorpusPuzzles(options.excludeCorpusPath) : new Set();
  const rows = [];
  let matched = 0;
  let misses = 0;
  let excluded = 0;
  let scanned = 0;
  let timeouts = 0;
  let stoppedEarly = false;
  let stopReason = null;

  for (const candidate of candidates.slice(options.startIndex, options.startIndex + options.maxPuzzles)) {
    if (hasElapsedBudgetExpired(options, startedAt)) {
      stoppedEarly = true;
      stopReason = 'elapsed-budget';
      break;
    }
    scanned += 1;
    if (isExcludedCandidate(candidate, excludedPuzzles)) {
      excluded += 1;
      continue;
    }
    const row = await inspectCandidateWithOptionalTimeout(candidate, options);
    if (!row) {
      continue;
    }
    if (row.missReason === 'candidate-timeout') {
      timeouts += 1;
    }
    if (row.searchMatched === false) {
      if (options.includeMisses && misses < options.maxMisses) {
        rows.push(row);
        misses += 1;
      }
      continue;
    }
    matched += 1;
    rows.push(row);
    if (matched >= options.maxRows) {
      break;
    }
  }

  const payload = {
    summary: {
      auditId: 'reference-rating-candidate-search.v1',
      input: options.inputPath,
      profile: options.profile,
      targetTechniques: options.targetTechniques,
      hardestTechniques: options.hardestTechniques,
      targetFirst: options.targetFirst,
      compareNormalProfile: options.compareNormalProfile,
      minimizeHit: options.minimizeHit,
      candidateOrder: options.candidateOrder,
      scanned,
      excluded,
      matched,
      misses,
      timeouts,
      missesIncluded: options.includeMisses,
      maxRows: options.maxRows,
      maxMisses: options.maxMisses,
      startRow: options.startIndex + 1,
      maxElapsedMs: options.maxElapsedMs,
      perCandidateTimeoutMs: options.perCandidateTimeoutMs,
      stoppedEarly,
      stopReason,
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
}

function runWorker() {
  try {
    const row = inspectCandidate(workerData.candidate, workerData.searchOptions);
    parentPort.postMessage({ row });
  } catch (error) {
    parentPort.postMessage({
      row: {
        sourceId: workerData.candidate.id,
        ok: false,
        issues: [`runtime:${formatError(error)}`],
        puzzle: workerData.candidate.puzzle,
      },
    });
  }
}

function inspectCandidateWithOptionalTimeout(candidate, searchOptions) {
  if (searchOptions.perCandidateTimeoutMs === null) {
    return Promise.resolve(inspectCandidate(candidate, searchOptions));
  }
  return inspectCandidateInWorker(candidate, searchOptions);
}

function inspectCandidateInWorker(candidate, searchOptions) {
  return new Promise((resolveInspect) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { candidate, searchOptions },
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      worker.terminate();
      resolveInspect(buildTimeoutMissRow(candidate, searchOptions));
    }, searchOptions.perCandidateTimeoutMs);

    worker.once('message', (message) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolveInspect(message.row ?? null);
    });
    worker.once('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolveInspect({
        sourceId: candidate.id,
        ok: false,
        issues: [`runtime:${formatError(error)}`],
        puzzle: candidate.puzzle,
      });
    });
    worker.once('exit', (code) => {
      if (settled || code === 0) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolveInspect({
        sourceId: candidate.id,
        ok: false,
        issues: [`runtime:worker exited with code ${code}`],
        puzzle: candidate.puzzle,
      });
    });
  });
}

function inspectCandidate(candidate, searchOptions) {
  const issues = [];
  let puzzle;
  let uniqueness;
  let solution = candidate.solution ?? null;
  let rating;
  let normalProfileRating = null;
  const ratingPolicy = buildSearchRatingPolicy(searchOptions);

  try {
    puzzle = serializeBoard(parsePuzzle(candidate.puzzle));
    uniqueness = checkUniqueness(puzzle);
    if (!solution && uniqueness.firstSolution) {
      solution = serializeBoard(uniqueness.firstSolution);
    }
    if (solution) {
      solution = serializeBoard(parsePuzzle(solution));
    }
    rating = rate(puzzle, ratingPolicy);
    if (searchOptions.compareNormalProfile) {
      normalProfileRating = summarizeRating(rate(puzzle, getRatingPolicy(searchOptions.profile)));
    }
  } catch (error) {
    return {
      sourceId: candidate.id,
      ok: false,
      issues: [`runtime:${formatError(error)}`],
      puzzle: candidate.puzzle,
    };
  }

  if (searchOptions.uniqueOnly && uniqueness.status !== 'unique') {
    return buildMissRow(candidate, puzzle, solution, uniqueness, rating, searchOptions, 'non-unique');
  }
  if (searchOptions.solvedOnly && !rating.solved) {
    return buildMissRow(candidate, puzzle, solution, uniqueness, rating, searchOptions, 'not-solved');
  }
  if (searchOptions.hardestTechniques.length > 0 && !searchOptions.hardestTechniques.includes(rating.hardestTechnique)) {
    return buildMissRow(candidate, puzzle, solution, uniqueness, rating, searchOptions, 'hardest-technique-mismatch');
  }

  const matchedTechniques = searchOptions.targetTechniques.length === 0
    ? Object.keys(rating.techniqueCounts)
    : searchOptions.targetTechniques.filter((technique) => (rating.techniqueCounts[technique] ?? 0) > 0);
  if (searchOptions.targetTechniques.length > 0 && matchedTechniques.length === 0) {
    return buildMissRow(candidate, puzzle, solution, uniqueness, rating, searchOptions, 'target-technique-missing');
  }
  if (searchOptions.targetTechniques.length === 0 && matchedTechniques.length === 0 && !searchOptions.includeZeroStep) {
    return buildMissRow(candidate, puzzle, solution, uniqueness, rating, searchOptions, 'zero-step');
  }
  if (!solution) {
    issues.push('missing-solution');
  }

  const minimized = searchOptions.minimizeHit && solution
    ? minimizeHitPuzzle(puzzle, ratingPolicy, searchOptions, matchedTechniques)
    : null;

  return {
    sourceId: candidate.id,
    ok: issues.length === 0,
    issues,
    matchedTechniques,
    puzzle,
    solution,
    uniquenessStatus: uniqueness.status,
    profile: searchOptions.profile,
    solved: rating.solved,
    score: rating.score,
    grade: rating.grade,
    hardestTechnique: rating.hardestTechnique,
    stepCount: rating.steps.length,
    firstTechniqueSteps: collectFirstTechniqueSteps(rating.steps),
    techniqueCounts: rating.techniqueCounts,
    normalProfileRating,
    minimized,
    suggestedCorpusRow: solution ? buildSuggestedCorpusRow(candidate, puzzle, solution, rating, uniqueness, searchOptions.profile, matchedTechniques) : null,
  };
}

function buildMissRow(candidate, puzzle, solution, uniqueness, rating, searchOptions, missReason) {
  if (!searchOptions.includeMisses) {
    return null;
  }
  return {
    sourceId: candidate.id,
    ok: false,
    searchMatched: false,
    missReason,
    matchedTechniques: [],
    puzzle,
    solution,
    uniquenessStatus: uniqueness.status,
    profile: searchOptions.profile,
    solved: rating.solved,
    score: rating.score,
    grade: rating.grade,
    hardestTechnique: rating.hardestTechnique,
    stepCount: rating.steps.length,
    firstTechniqueSteps: collectFirstTechniqueSteps(rating.steps),
    techniqueCounts: rating.techniqueCounts,
    normalProfileRating: searchOptions.compareNormalProfile ? summarizeRating(rate(puzzle, getRatingPolicy(searchOptions.profile))) : null,
  };
}

function buildTimeoutMissRow(candidate, searchOptions) {
  return {
    sourceId: candidate.id,
    ok: false,
    searchMatched: false,
    missReason: 'candidate-timeout',
    issues: [`timeout:${searchOptions.perCandidateTimeoutMs}ms`],
    matchedTechniques: [],
    puzzle: candidate.puzzle,
    profile: searchOptions.profile,
  };
}

function buildSuggestedCorpusRow(candidate, puzzle, solution, rating, uniqueness, profile, matchedTechniques) {
  const primaryTechnique = matchedTechniques[0] ?? rating.hardestTechnique ?? 'unknown';
  return {
    id: candidate.id ? `candidate-${candidate.id}` : `candidate-${primaryTechnique}`,
    externalBucket: `Candidate ${primaryTechnique} real-board path`,
    profile,
    puzzle,
    solution,
    expected: {
      solved: rating.solved,
      unique: uniqueness.status === 'unique',
      hardestTechnique: rating.hardestTechnique,
      score: rating.score,
      stepCount: rating.steps.length,
      techniqueCountsAtLeast: Object.fromEntries(matchedTechniques.map((technique) => [technique, rating.techniqueCounts[technique] ?? 1])),
    },
  };
}

function buildSearchRatingPolicy(searchOptions) {
  const policy = getRatingPolicy(searchOptions.profile);
  if (!searchOptions.targetFirst || searchOptions.targetTechniques.length === 0) {
    return policy;
  }
  const targetSet = new Set(searchOptions.targetTechniques);
  const currentPrimary = [...policy.techniqueOrder];
  const currentFallback = [...(policy.fallbackTechniques ?? [])];
  const targetOrder = searchOptions.targetTechniques;
  return {
    ...policy,
    id: `${policy.id}:target-first`,
    techniqueOrder: [
      ...targetOrder,
      ...currentPrimary.filter((technique) => !targetSet.has(technique)),
      ...currentFallback.filter((technique) => !targetSet.has(technique)),
    ],
    fallbackTechniques: currentFallback.filter((technique) => !targetSet.has(technique)),
  };
}

function summarizeRating(rating) {
  return {
    solved: rating.solved,
    score: rating.score,
    grade: rating.grade,
    hardestTechnique: rating.hardestTechnique,
    stepCount: rating.steps.length,
    firstTechniqueSteps: collectFirstTechniqueSteps(rating.steps),
    techniqueCounts: rating.techniqueCounts,
  };
}

function minimizeHitPuzzle(puzzle, ratingPolicy, searchOptions, matchedTechniques) {
  const requiredTechniques = matchedTechniques.length > 0 ? matchedTechniques : searchOptions.targetTechniques;
  if (requiredTechniques.length === 0) {
    return null;
  }
  const original = serializeBoard(parsePuzzle(puzzle));
  const cells = original.split('');
  const clueCells = cells
    .map((value, cell) => ({ cell, value }))
    .filter((entry) => entry.value !== '0')
    .sort((left, right) => right.cell - left.cell);
  const removedClues = [];
  let current = original;
  let bestRating = null;
  let bestSolution = null;

  for (const clue of clueCells) {
    const candidateCells = current.split('');
    if (candidateCells[clue.cell] === '0') {
      continue;
    }
    candidateCells[clue.cell] = '0';
    const candidate = candidateCells.join('');
    const check = validateHitPuzzle(candidate, ratingPolicy, searchOptions, requiredTechniques);
    if (!check.ok) {
      continue;
    }
    current = candidate;
    bestRating = check.rating;
    bestSolution = check.solution;
    removedClues.push({ cell: clue.cell, digit: Number(clue.value) });
  }

  if (removedClues.length === 0 || !bestRating || !bestSolution) {
    return {
      puzzle: original,
      clueCount: countClues(original),
      removedClues: [],
      keptOriginal: true,
    };
  }
  const minimizedUniqueness = { status: 'unique' };
  return {
    puzzle: current,
    solution: bestSolution,
    clueCount: countClues(current),
    removedClues,
    rating: summarizeRating(bestRating),
    suggestedCorpusRow: buildSuggestedCorpusRow(
      { id: `minimized-${requiredTechniques[0]}` },
      current,
      bestSolution,
      bestRating,
      minimizedUniqueness,
      searchOptions.profile,
      requiredTechniques,
    ),
  };
}

function validateHitPuzzle(puzzle, ratingPolicy, searchOptions, requiredTechniques) {
  try {
    const uniqueness = checkUniqueness(puzzle);
    if (uniqueness.status !== 'unique' || !uniqueness.firstSolution) {
      return { ok: false };
    }
    const rating = rate(puzzle, ratingPolicy);
    if (searchOptions.solvedOnly && !rating.solved) {
      return { ok: false };
    }
    if (requiredTechniques.some((technique) => (rating.techniqueCounts[technique] ?? 0) === 0)) {
      return { ok: false };
    }
    return { ok: true, rating, solution: serializeBoard(uniqueness.firstSolution) };
  } catch {
    return { ok: false };
  }
}

function countClues(puzzle) {
  return puzzle.split('').filter((value) => value !== '0').length;
}

function collectFirstTechniqueSteps(steps) {
  const firstSteps = {};
  for (const [index, step] of steps.entries()) {
    if (firstSteps[step.technique] === undefined) {
      firstSteps[step.technique] = index + 1;
    }
  }
  return firstSteps;
}

function loadCandidatePuzzles(path) {
  const text = readFileSync(resolve(process.cwd(), path), 'utf8');
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return loadJsonCandidatePuzzles(JSON.parse(trimmed));
  }
  return text
    .split(/\r?\n/)
    .map((line, index) => parseCandidateLine(line, index + 1))
    .filter((candidate) => candidate !== null);
}

function loadExcludedCorpusPuzzles(path) {
  const parsed = JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
  if (!isRecord(parsed) || !Array.isArray(parsed.rows)) {
    throw new Error('--exclude-corpus must point to a JSON object with a rows array.');
  }
  const puzzles = new Set();
  for (const [index, row] of parsed.rows.entries()) {
    if (!isRecord(row) || typeof row.puzzle !== 'string') {
      throw new Error(`Excluded corpus row ${index + 1} must include a puzzle string.`);
    }
    puzzles.add(serializeBoard(parsePuzzle(row.puzzle)));
  }
  return puzzles;
}

function isExcludedCandidate(candidate, excludedPuzzles) {
  if (excludedPuzzles.size === 0) {
    return false;
  }
  try {
    return excludedPuzzles.has(serializeBoard(parsePuzzle(candidate.puzzle)));
  } catch {
    return false;
  }
}

function loadJsonCandidatePuzzles(parsed) {
  const rows = Array.isArray(parsed) ? parsed : parsed.rows ?? parsed.samples;
  if (!Array.isArray(rows)) {
    throw new Error('JSON input must be an array or an object with a rows or samples array.');
  }
  return rows.map((row, index) => {
    if (!isRecord(row) || !isPuzzleValue(row.puzzle)) {
      throw new Error(`JSON row ${index + 1} must include a puzzle string or 81-cell numeric array.`);
    }
    const solution = isPuzzleValue(row.solution) ? normalizePuzzleValue(row.solution, `JSON row ${index + 1} solution`) : null;
    return {
      id: typeof row.id === 'string' ? row.id : typeof row.sampleId === 'string' ? row.sampleId : `row-${index + 1}`,
      puzzle: normalizePuzzleValue(row.puzzle, `JSON row ${index + 1} puzzle`),
      solution,
      metadata: collectCandidateMetadata(row),
    };
  });
}

function collectCandidateMetadata(row) {
  const expected = isRecord(row.expected) ? row.expected : {};
  return {
    score: firstNumber(row.score, row.ratingScore, row.difficultyScore, expected.score),
    grade: firstString(row.grade, row.difficulty, expected.grade),
    hardestTechnique: firstString(row.hardestTechnique, expected.hardestTechnique),
    stepCount: firstNumber(row.stepCount, expected.stepCount),
  };
}

function isPuzzleValue(value) {
  return typeof value === 'string' || Array.isArray(value);
}

function normalizePuzzleValue(value, label) {
  if (typeof value === 'string') {
    return value;
  }
  if (!Array.isArray(value) || value.length !== 81) {
    throw new Error(`${label} must be an 81-cell numeric array.`);
  }
  return value.map((cell, index) => {
    if (!Number.isInteger(cell) || cell < 0 || cell > 9) {
      throw new Error(`${label}[${index}] must be an integer from 0 to 9.`);
    }
    return String(cell);
  }).join('');
}

function parseCandidateLine(line, lineNumber) {
  const body = line.replace(/#.*/, '').trim();
  if (!body) {
    return null;
  }
  const tokens = body.split(/\s+/);
  const puzzle = tokens.find((token) => /^[0-9.-]{81}$/.test(token));
  if (!puzzle) {
    throw new Error(`Line ${lineNumber} does not contain an 81-character puzzle.`);
  }
  const solution = tokens.find((token) => token !== puzzle && /^[1-9]{81}$/.test(token)) ?? null;
  const id = tokens.find((token) => token !== puzzle && token !== solution && /^[A-Za-z0-9][A-Za-z0-9._:/=-]*$/.test(token));
  return {
    id: id ?? `line-${lineNumber}`,
    puzzle,
    solution,
    metadata: {},
  };
}

function orderCandidatePuzzles(candidates, options) {
  const indexed = candidates.map((candidate, index) => ({ candidate, index }));
  if (options.candidateOrder === 'input') {
    return candidates;
  }
  indexed.sort((left, right) => {
    const leftScore = candidateDifficultyScore(left.candidate);
    const rightScore = candidateDifficultyScore(right.candidate);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    return left.index - right.index;
  });
  return indexed.map((entry) => entry.candidate);
}

function candidateDifficultyScore(candidate) {
  const metadata = candidate.metadata ?? {};
  if (typeof metadata.score === 'number') {
    return 1_000_000 + metadata.score;
  }
  const grade = typeof metadata.grade === 'string' ? metadata.grade.toLowerCase() : null;
  if (grade && GRADE_RANK.has(grade)) {
    return 100_000 + (GRADE_RANK.get(grade) ?? 0) * 10_000 + (metadata.stepCount ?? 0);
  }
  return 81 - countClues(candidate.puzzle);
}

function parseArgs(args) {
  const parsed = {
    inputPath: null,
    outputPath: null,
    excludeCorpusPath: null,
    profile: 'classic-galaxy',
    targetTechniques: [],
    hardestTechniques: [],
    targetFirst: false,
    compareNormalProfile: false,
    minimizeHit: false,
    candidateOrder: 'input',
    maxPuzzles: Number.MAX_SAFE_INTEGER,
    startIndex: 0,
    maxRows: 20,
    maxMisses: 20,
    maxElapsedMs: null,
    perCandidateTimeoutMs: null,
    uniqueOnly: true,
    solvedOnly: true,
    includeZeroStep: false,
    includeMisses: false,
    json: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--json') {
      parsed.json = true;
      continue;
    }
    if (item === '--allow-non-unique') {
      parsed.uniqueOnly = false;
      continue;
    }
    if (item === '--allow-unsolved') {
      parsed.solvedOnly = false;
      continue;
    }
    if (item === '--include-zero-step') {
      parsed.includeZeroStep = true;
      continue;
    }
    if (item === '--include-misses') {
      parsed.includeMisses = true;
      continue;
    }
    if (item === '--target-first') {
      parsed.targetFirst = true;
      continue;
    }
    if (item === '--compare-normal-profile') {
      parsed.compareNormalProfile = true;
      continue;
    }
    if (item === '--minimize-hit') {
      parsed.minimizeHit = true;
      continue;
    }
    if (item === '--difficulty-first') {
      parsed.candidateOrder = 'difficulty-desc';
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
    if (item === '--exclude-corpus') {
      parsed.excludeCorpusPath = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--profile') {
      parsed.profile = normalizeProfile(requireValue(args, index, item));
      index += 1;
      continue;
    }
    if (item === '--target' || item === '--technique') {
      parsed.targetTechniques = parseTechniqueList(requireValue(args, index, item));
      index += 1;
      continue;
    }
    if (item === '--hardest') {
      parsed.hardestTechniques = parseTechniqueList(requireValue(args, index, item));
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
    if (item === '--max-elapsed-ms') {
      parsed.maxElapsedMs = parseNonNegativeInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--per-candidate-timeout-ms') {
      parsed.perCandidateTimeoutMs = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${item}`);
  }
  if (!parsed.inputPath) {
    throw new Error('--input is required.');
  }
  if (parsed.targetFirst && parsed.targetTechniques.length === 0) {
    throw new Error('--target-first requires --target.');
  }
  if (parsed.minimizeHit && parsed.targetTechniques.length === 0) {
    throw new Error('--minimize-hit requires --target.');
  }
  return parsed;
}

function hasElapsedBudgetExpired(options, startedAt) {
  return options.maxElapsedMs !== null && performance.now() - startedAt >= options.maxElapsedMs;
}

function normalizeProfile(value) {
  const id = value.startsWith('classic-') ? value : `classic-${value}`;
  if (!BUILT_IN_PROFILES.has(id)) {
    throw new Error('--profile must be stable, extended or galaxy.');
  }
  return id;
}

function parseTechniqueList(value) {
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

function printHumanSummary(payload) {
  const summary = payload.summary;
  process.stdout.write(`Reference rating candidate search: ${summary.matched}/${summary.scanned} matched in ${summary.elapsedMs}ms\n`);
  process.stdout.write(`Profile: ${summary.profile}\n`);
  if (summary.candidateOrder !== 'input') {
    process.stdout.write(`Candidate order: ${summary.candidateOrder}\n`);
  }
  if (summary.targetFirst) {
    process.stdout.write('Target-first rating: enabled\n');
  }
  if (summary.compareNormalProfile) {
    process.stdout.write('Normal-profile comparison: enabled\n');
  }
  if (summary.minimizeHit) {
    process.stdout.write('Greedy minimization: enabled\n');
  }
  if (summary.missesIncluded) {
    process.stdout.write(`Included misses: ${summary.misses}/${summary.maxMisses}\n`);
  }
  if (summary.perCandidateTimeoutMs !== null) {
    process.stdout.write(`Per-candidate timeout: ${summary.perCandidateTimeoutMs}ms; timed out: ${summary.timeouts}\n`);
  }
  if (summary.stoppedEarly) {
    process.stdout.write(`Stopped early: ${summary.stopReason}\n`);
  }
  if (summary.excluded > 0) {
    process.stdout.write(`Excluded existing corpus puzzles: ${summary.excluded}\n`);
  }
  if (summary.targetTechniques.length > 0) {
    process.stdout.write(`Targets: ${summary.targetTechniques.join(', ')}\n`);
  }
  if (summary.hardestTechniques.length > 0) {
    process.stdout.write(`Hardest filter: ${summary.hardestTechniques.join(', ')}\n`);
  }
  for (const row of payload.rows) {
    const techniques = row.matchedTechniques.join(', ') || 'none';
    process.stdout.write(`- ${row.sourceId}: ${row.ok ? 'ok' : 'issues'}; matched=${techniques}; score=${row.score}; hardest=${row.hardestTechnique}; steps=${row.stepCount}\n`);
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstNumber(...values) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return null;
}
