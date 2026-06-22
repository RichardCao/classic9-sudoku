#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  checkUniqueness,
  getRatingPolicy,
  parsePuzzle,
  rate,
  serializeBoard,
} from '../dist/src/index.js';
import { SolutionGridFactory } from '../dist/src/generator/solution-grid.js';

const BUILT_IN_PROFILES = new Set(['classic-stable', 'classic-extended', 'classic-galaxy']);
const ALL_CELLS = Array.from({ length: 81 }, (_, index) => index);

await main();

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = performance.now();
  const rows = [];
  const diagnostics = {
    seedsTried: 0,
    uniquenessChecks: 0,
    ratingChecks: 0,
    acceptedRemovals: 0,
    rejectedRemovals: 0,
  };
  const solutionFactory = new SolutionGridFactory();

  for (let offset = 0; offset < options.maxSeeds; offset += 1) {
    if (hasElapsedBudgetExpired(options, startedAt)) {
      break;
    }
    const seed = options.seedStart + offset;
    diagnostics.seedsTried += 1;
    const solution = serializeBoard(solutionFactory.create(seed));
    const row = synthesizeFromSolution(solution, seed, options, diagnostics);
    if (row) {
      rows.push(row);
      if (rows.length >= options.maxRows) {
        break;
      }
    }
  }

  const payload = {
    summary: {
      auditId: 'reference-rating-candidate-synthesis.v1',
      profile: options.profile,
      targetTechniques: options.targetTechniques,
      targetFirst: options.targetFirst,
      compareNormalProfile: options.compareNormalProfile,
      minimizeHit: options.minimizeHit,
      requireAllTargets: options.requireAllTargets,
      seedStart: options.seedStart,
      maxSeeds: options.maxSeeds,
      maxRows: options.maxRows,
      minClues: options.minClues,
      checkAfterClues: options.checkAfterClues,
      maxElapsedMs: options.maxElapsedMs,
      matched: rows.length,
      elapsedMs: Math.round(performance.now() - startedAt),
      diagnostics,
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

function synthesizeFromSolution(solution, seed, options, diagnostics) {
  const ratingPolicy = buildSearchRatingPolicy(options);
  let current = solution;
  const order = buildRemovalOrder(seed, options.orderSalt);
  const removals = [];

  for (const cell of order) {
    if (countClues(current) <= options.minClues || hasElapsedBudgetExpired(options, options.startedAt)) {
      break;
    }
    const cells = current.split('');
    if (cells[cell] === '0') {
      continue;
    }
    const removedDigit = Number(cells[cell]);
    cells[cell] = '0';
    const candidate = cells.join('');
    diagnostics.uniquenessChecks += 1;
    const uniqueness = checkUniqueness(candidate);
    if (uniqueness.status !== 'unique' || !uniqueness.firstSolution) {
      diagnostics.rejectedRemovals += 1;
      continue;
    }
    current = candidate;
    removals.push({ cell, digit: removedDigit });
    diagnostics.acceptedRemovals += 1;

    if (countClues(current) > options.checkAfterClues) {
      continue;
    }
    diagnostics.ratingChecks += 1;
    const hit = inspectHit(current, serializeBoard(uniqueness.firstSolution), ratingPolicy, options);
    if (!hit.ok) {
      continue;
    }
    const minimized = options.minimizeHit
      ? minimizeHitPuzzle(current, ratingPolicy, options, hit.matchedTechniques)
      : null;
    return buildHitRow({
      sourceId: `synthetic-seed-${seed}`,
      seed,
      puzzle: current,
      solution: serializeBoard(uniqueness.firstSolution),
      removals,
      rating: hit.rating,
      matchedTechniques: hit.matchedTechniques,
      normalProfileRating: options.compareNormalProfile ? summarizeRating(rate(current, getRatingPolicy(options.profile))) : null,
      minimized,
      profile: options.profile,
    });
  }

  return null;
}

function inspectHit(puzzle, solution, ratingPolicy, options) {
  try {
    const normalizedPuzzle = serializeBoard(parsePuzzle(puzzle));
    const normalizedSolution = serializeBoard(parsePuzzle(solution));
    const uniqueness = checkUniqueness(normalizedPuzzle);
    if (uniqueness.status !== 'unique' || serializeBoard(uniqueness.firstSolution) !== normalizedSolution) {
      return { ok: false };
    }
    const rating = rate(normalizedPuzzle, ratingPolicy);
    if (!rating.solved) {
      return { ok: false };
    }
    const matchedTechniques = options.targetTechniques.filter((technique) => (rating.techniqueCounts[technique] ?? 0) > 0);
    const hit = options.requireAllTargets
      ? matchedTechniques.length === options.targetTechniques.length
      : matchedTechniques.length > 0;
    return { ok: hit, rating, matchedTechniques };
  } catch {
    return { ok: false };
  }
}

function minimizeHitPuzzle(puzzle, ratingPolicy, options, matchedTechniques) {
  const requiredTechniques = matchedTechniques.length > 0 ? matchedTechniques : options.targetTechniques;
  const original = serializeBoard(parsePuzzle(puzzle));
  let current = original;
  let bestRating = null;
  let bestSolution = null;
  const removedClues = [];
  const clueCells = original
    .split('')
    .map((value, cell) => ({ cell, value }))
    .filter((entry) => entry.value !== '0')
    .sort((left, right) => right.cell - left.cell);

  for (const clue of clueCells) {
    const cells = current.split('');
    if (cells[clue.cell] === '0') {
      continue;
    }
    cells[clue.cell] = '0';
    const candidate = cells.join('');
    const check = validateHitPuzzle(candidate, ratingPolicy, requiredTechniques);
    if (!check.ok) {
      continue;
    }
    current = candidate;
    bestRating = check.rating;
    bestSolution = check.solution;
    removedClues.push({ cell: clue.cell, digit: Number(clue.value) });
  }

  if (!bestRating || !bestSolution) {
    return {
      puzzle: original,
      clueCount: countClues(original),
      removedClues: [],
      keptOriginal: true,
    };
  }

  return {
    puzzle: current,
    solution: bestSolution,
    clueCount: countClues(current),
    removedClues,
    rating: summarizeRating(bestRating),
    suggestedCorpusRow: buildSuggestedCorpusRow(
      `synthetic-minimized-${requiredTechniques[0]}`,
      current,
      bestSolution,
      bestRating,
      options.profile,
      requiredTechniques,
    ),
  };
}

function validateHitPuzzle(puzzle, ratingPolicy, requiredTechniques) {
  try {
    const uniqueness = checkUniqueness(puzzle);
    if (uniqueness.status !== 'unique' || !uniqueness.firstSolution) {
      return { ok: false };
    }
    const rating = rate(puzzle, ratingPolicy);
    if (!rating.solved || requiredTechniques.some((technique) => (rating.techniqueCounts[technique] ?? 0) === 0)) {
      return { ok: false };
    }
    return { ok: true, rating, solution: serializeBoard(uniqueness.firstSolution) };
  } catch {
    return { ok: false };
  }
}

function buildHitRow({ sourceId, seed, puzzle, solution, removals, rating, matchedTechniques, normalProfileRating, minimized, profile }) {
  return {
    sourceId,
    seed,
    ok: true,
    matchedTechniques,
    puzzle,
    solution,
    clueCount: countClues(puzzle),
    removedClues: removals,
    profile,
    solved: rating.solved,
    score: rating.score,
    grade: rating.grade,
    hardestTechnique: rating.hardestTechnique,
    stepCount: rating.steps.length,
    firstTechniqueSteps: collectFirstTechniqueSteps(rating.steps),
    techniqueCounts: rating.techniqueCounts,
    normalProfileRating,
    minimized,
    suggestedCorpusRow: buildSuggestedCorpusRow(sourceId, puzzle, solution, rating, profile, matchedTechniques),
  };
}

function buildSuggestedCorpusRow(id, puzzle, solution, rating, profile, matchedTechniques) {
  const primaryTechnique = matchedTechniques[0] ?? rating.hardestTechnique ?? 'unknown';
  return {
    id: `candidate-${id}`,
    externalBucket: `Synthetic ${primaryTechnique} real-board path`,
    profile,
    puzzle,
    solution,
    expected: {
      solved: rating.solved,
      unique: true,
      hardestTechnique: rating.hardestTechnique,
      score: rating.score,
      stepCount: rating.steps.length,
      techniqueCountsAtLeast: Object.fromEntries(matchedTechniques.map((technique) => [technique, rating.techniqueCounts[technique] ?? 1])),
    },
  };
}

function buildSearchRatingPolicy(options) {
  const policy = getRatingPolicy(options.profile);
  if (!options.targetFirst) {
    return policy;
  }
  const targetSet = new Set(options.targetTechniques);
  const currentPrimary = [...policy.techniqueOrder];
  const currentFallback = [...(policy.fallbackTechniques ?? [])];
  return {
    ...policy,
    id: `${policy.id}:target-first-synthesis`,
    techniqueOrder: [
      ...options.targetTechniques,
      ...currentPrimary.filter((technique) => !targetSet.has(technique)),
      ...currentFallback.filter((technique) => !targetSet.has(technique)),
    ],
    fallbackTechniques: currentFallback.filter((technique) => !targetSet.has(technique)),
  };
}

function buildRemovalOrder(seed, salt) {
  let state = (seed ^ salt) >>> 0;
  const items = [...ALL_CELLS];
  for (let index = items.length - 1; index > 0; index -= 1) {
    state = nextState(state);
    const swapIndex = state % (index + 1);
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function nextState(state) {
  let next = state || 1;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
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

function collectFirstTechniqueSteps(steps) {
  const firstSteps = {};
  for (const [index, step] of steps.entries()) {
    if (firstSteps[step.technique] === undefined) {
      firstSteps[step.technique] = index + 1;
    }
  }
  return firstSteps;
}

function countClues(puzzle) {
  return puzzle.split('').filter((value) => value !== '0').length;
}

function parseArgs(args) {
  const parsed = {
    profile: 'classic-galaxy',
    targetTechniques: [],
    seedStart: 1,
    maxSeeds: 20,
    maxRows: 5,
    minClues: 22,
    checkAfterClues: 32,
    orderSalt: 0x9e3779b9,
    maxElapsedMs: null,
    targetFirst: true,
    compareNormalProfile: false,
    minimizeHit: false,
    requireAllTargets: false,
    outputPath: null,
    json: false,
    startedAt: performance.now(),
  };

  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--json') {
      parsed.json = true;
      continue;
    }
    if (item === '--normal-order') {
      parsed.targetFirst = false;
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
    if (item === '--require-all-targets') {
      parsed.requireAllTargets = true;
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
    if (item === '--seed-start') {
      parsed.seedStart = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--max-seeds') {
      parsed.maxSeeds = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--max-rows') {
      parsed.maxRows = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--min-clues') {
      parsed.minClues = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--check-after-clues') {
      parsed.checkAfterClues = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--order-salt') {
      parsed.orderSalt = parseNonNegativeInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--max-elapsed-ms') {
      parsed.maxElapsedMs = parseNonNegativeInteger(requireValue(args, index, item), item);
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

  if (parsed.targetTechniques.length === 0) {
    throw new Error('--target is required.');
  }
  if (parsed.minClues > 80) {
    throw new Error('--min-clues must be at most 80.');
  }
  if (parsed.checkAfterClues > 80) {
    throw new Error('--check-after-clues must be at most 80.');
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
  process.stdout.write(`Reference rating candidate synthesis: ${summary.matched}/${summary.maxSeeds} seed(s) matched in ${summary.elapsedMs}ms\n`);
  process.stdout.write(`Profile: ${summary.profile}\n`);
  process.stdout.write(`Targets: ${summary.targetTechniques.join(', ')}\n`);
  process.stdout.write(`Target-first rating: ${summary.targetFirst ? 'enabled' : 'disabled'}\n`);
  if (summary.minimizeHit) {
    process.stdout.write('Greedy minimization: enabled\n');
  }
  for (const row of payload.rows) {
    process.stdout.write(`- ${row.sourceId}: matched=${row.matchedTechniques.join(', ')}; clues=${row.clueCount}; score=${row.score}; hardest=${row.hardestTechnique}; steps=${row.stepCount}\n`);
  }
}
