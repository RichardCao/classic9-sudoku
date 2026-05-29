import { getDefaultRatingPolicy, validateRatingPolicy, type RatingPolicy } from '../rating/index.js';
import { rate } from '../rating/index.js';
import { getTechniqueDefinitions } from '../solver/techniques.js';
import type { SolveAnalysis, TechniqueId } from '../solver/types.js';
import type { Board } from '../core/types.js';
import { ALL_HOUSES, assertBoardValues, getHouseCells } from '../core/grid.js';
import { canonicalizeBoard, canonicalizePair } from '../canonical/index.js';
import { SolutionGridFactory } from './solution-grid.js';
import { ClueRemover } from './clue-remover.js';
import { PuzzleMinimizer } from './minimizer.js';
import { MAX_SEED, defaultSeed } from './random.js';

export interface ScoreConstraint {
  min?: number;
  max?: number;
  target?: number;
  tolerance?: number;
}

export interface ClueConstraint {
  min?: number;
  max?: number;
  target?: number;
}

export type RequiredTechniqueRule =
  | { type: 'appears'; techniques: TechniqueId[]; minCount?: number }
  | { type: 'hardest-in'; techniques: TechniqueId[] }
  | { type: 'family-coverage'; families: string[] };

export interface GenerationConstraint {
  score?: ScoreConstraint;
  clues?: ClueConstraint;
  allowedTechniques?: TechniqueId[];
  forbiddenTechniques?: TechniqueId[];
  requiredTechniques?: RequiredTechniqueRule[];
  preferredTechniques?: TechniqueId[];
  symmetry?: 'none' | 'central';
  uniqueness?: 'required';
}

export interface GenerationBudget {
  maxAttempts?: number;
  maxElapsedMs?: number;
}

export interface GenerationRelaxation {
  enabled: boolean;
  maxRounds?: number;
  scoreExpansionPerRound?: number;
  clueExpansionPerRound?: number;
  attemptMultiplierPerRound?: number;
}

export interface GenerationRelaxationApplied {
  round: number;
  type: 'score-range-expanded' | 'clue-range-expanded' | 'attempt-budget-increased';
  message: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface GenerationRequest {
  seed?: number;
  ratingPolicy?: RatingPolicy;
  constraints?: GenerationConstraint;
  budget?: GenerationBudget;
  canonicalize?: boolean;
  minimality?: 'none' | 'strict';
  relaxation?: GenerationRelaxation;
  /** Search-only field. generateOne accepts and validates it for request reuse, then ignores it. */
  maxResults?: number;
  /** Search-only field. generateOne accepts and validates it for request reuse, then ignores it. */
  scoreBucketSize?: number;
}

export interface GeneratedPuzzle {
  puzzle: Board;
  solution: Board;
  seed: number;
  solved: boolean;
  stuckReason?: SolveAnalysis['stuckReason'];
  clueCount: number;
  score: number;
  grade: string | null;
  hardestTechnique: TechniqueId | null;
  techniqueCounts: Partial<Record<TechniqueId, number>>;
  canonicalKey?: string;
}

export interface GenerationDiagnostics {
  attempts: number;
  elapsedMs: number;
  rejectedByReason: Record<string, number>;
  warnings: string[];
}

export interface GenerationResult {
  status: 'success' | 'invalid-request' | 'timeout' | 'attempt-limit' | 'no-match';
  requestAnalysis: GenerationRequestAnalysis;
  /**
   * 只有 success 状态下的 puzzle 才保证满足请求约束。
   * 失败状态如果有接近目标的候选，会放在 bestCandidate，避免调用方误入库。
   */
  puzzle?: GeneratedPuzzle;
  bestCandidate?: GeneratedPuzzle;
  diagnostics: GenerationDiagnostics;
  relaxationsApplied?: GenerationRelaxationApplied[];
}

export type GenerationEvent =
  | {
      type: 'accepted';
      index: number;
      result: GenerationResult;
      puzzle: GeneratedPuzzle;
    }
  | {
      type: 'rejected';
      index: number;
      result: GenerationResult;
      reason: string;
    }
  | {
      type: 'done';
      accepted: number;
      rejected: number;
      summary: SearchSummary;
    };

export interface SearchRequest extends GenerationRequest {
  /**
   * Number of accepted puzzles to return. `budget.maxAttempts` remains the
   * outer attempt limit, while `budget.maxElapsedMs` is passed to each
   * individual generateOne call rather than used as a global search deadline.
   */
  maxResults?: number;
  scoreBucketSize?: number;
}

export interface SearchSummary {
  accepted: number;
  rejected: number;
  rejectedByReason: Record<string, number>;
  scoreBuckets: Record<string, number>;
  techniqueHits: Partial<Record<TechniqueId, number>>;
  bestScore: number | null;
  worstScore: number | null;
}

export interface CandidateSelectionPlan {
  maxResults: number;
  scoreBuckets?: Array<{ min: number; max: number; limit?: number }>;
  preferredTechniques?: TechniqueId[];
  dedupeCanonical?: boolean;
}

export interface CandidateSelectionResult {
  selected: GeneratedPuzzle[];
  rejected: Array<{
    puzzle: GeneratedPuzzle;
    reason: string;
  }>;
  diagnostics: CandidateSelectionDiagnostics;
}

export interface CandidateSelectionDiagnostics {
  selected: number;
  rejected: number;
  rejectedByReason: Record<string, number>;
  scoreBucketCounts: Array<{
    min: number;
    max: number;
    limit?: number;
    selected: number;
  }>;
  preferredTechniqueHits: Partial<Record<TechniqueId, number>>;
}

export interface CandidatePoolStatsOptions {
  scoreBucketSize?: number;
  clueBucketSize?: number;
}

export interface CandidatePoolStats {
  total: number;
  score: {
    min: number | null;
    max: number | null;
    average: number | null;
    buckets: Record<string, number>;
  };
  clues: {
    min: number | null;
    max: number | null;
    average: number | null;
    buckets: Record<string, number>;
  };
  gradeCounts: Record<string, number>;
  hardestTechniqueCounts: Partial<Record<TechniqueId, number>>;
  techniqueHits: Partial<Record<TechniqueId, number>>;
  canonical: {
    withKey: number;
    withoutKey: number;
    uniqueKeys: number;
    duplicateKeys: number;
  };
  seeds: {
    min: number | null;
    max: number | null;
    duplicates: number;
  };
}

export interface CandidateDedupeOptions {
  key?: 'canonical' | 'puzzle';
}

export interface CandidateDedupeResult {
  candidates: GeneratedPuzzle[];
  rejected: Array<{
    puzzle: GeneratedPuzzle;
    reason: 'canonical-duplicate' | 'puzzle-duplicate';
    key: string;
  }>;
  diagnostics: {
    input: number;
    kept: number;
    removed: number;
    key: 'canonical' | 'puzzle';
  };
}

export interface GenerationRequestIssue {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface GenerationSuggestion {
  type:
    | 'expand-score-range'
    | 'lower-score-min'
    | 'raise-score-max'
    | 'expand-techniques'
    | 'increase-budget'
    | 'move-to-preferred-techniques'
    | 'review-required-technique-alternatives';
  message: string;
  details?: Record<string, unknown>;
}

export interface GenerationRequestAnalysis {
  status: 'valid' | 'unlikely' | 'invalid';
  errors: GenerationRequestIssue[];
  warnings: GenerationRequestIssue[];
  suggestions: GenerationSuggestion[];
  estimatedDifficulty: 'low' | 'medium' | 'high' | 'very-high';
  feasibility: GenerationFeasibilityEstimate;
}

export interface GenerationFeasibilityEstimate {
  allowedTechniqueCount: number;
  maxSingleStepScore: number;
  averagePositiveStepScore: number;
  scoreRangeWidth: number | null;
  clueRangeWidth: number | null;
  estimatedMinStepsForScoreMin: number | null;
  estimatedTypicalStepsForScoreMin: number | null;
  budgetMaxAttempts: number | null;
  budgetMaxElapsedMs: number | null;
}

const techniqueDefinitions = getTechniqueDefinitions();
const techniqueFamilies = new Map<TechniqueId, string>(
  techniqueDefinitions.map((definition) => [definition.id, definition.family]),
);
const knownTechniqueIds = new Set<TechniqueId>(
  techniqueDefinitions.map((definition) => definition.id),
);
const solutionFactory = new SolutionGridFactory();
const clueRemover = new ClueRemover();
const puzzleMinimizer = new PuzzleMinimizer();

const GENERATION_REQUEST_FIELDS = new Set([
  'seed',
  'ratingPolicy',
  'constraints',
  'budget',
  'canonicalize',
  'minimality',
  'relaxation',
  'maxResults',
  'scoreBucketSize',
]);
const SEARCH_REQUEST_FIELDS = new Set(Array.from(GENERATION_REQUEST_FIELDS));
const GENERATION_CONSTRAINT_FIELDS = new Set([
  'score',
  'clues',
  'allowedTechniques',
  'forbiddenTechniques',
  'requiredTechniques',
  'preferredTechniques',
  'symmetry',
  'uniqueness',
]);
const SCORE_CONSTRAINT_FIELDS = new Set(['min', 'max', 'target', 'tolerance']);
const CLUE_CONSTRAINT_FIELDS = new Set(['min', 'max', 'target']);
const GENERATION_BUDGET_FIELDS = new Set(['maxAttempts', 'maxElapsedMs']);
const GENERATION_RELAXATION_FIELDS = new Set([
  'enabled',
  'maxRounds',
  'scoreExpansionPerRound',
  'clueExpansionPerRound',
  'attemptMultiplierPerRound',
]);
const REQUIRED_TECHNIQUE_FIELDS: Record<RequiredTechniqueRule['type'], Set<string>> = {
  appears: new Set(['type', 'techniques', 'minCount']),
  'hardest-in': new Set(['type', 'techniques']),
  'family-coverage': new Set(['type', 'families']),
};

export function analyzeGenerationRequest(request: GenerationRequest): GenerationRequestAnalysis {
  const errors: GenerationRequestIssue[] = [];
  const warnings: GenerationRequestIssue[] = [];
  const suggestions: GenerationSuggestion[] = [];
  if (!isPlainObject(request)) {
    errors.push({
      code: 'invalid-generation-request',
      message: '生成请求必须是 object。',
      details: { value: request },
    });
    const policy = getDefaultRatingPolicy();
    const allowed = new Set<TechniqueId>([...policy.techniqueOrder, ...(policy.fallbackTechniques ?? [])]);
    return {
      status: 'invalid',
      errors,
      warnings,
      suggestions,
      estimatedDifficulty: estimateDifficulty(undefined, allowed, policy),
      feasibility: estimateFeasibility({} as GenerationRequest, allowed, new Set<TechniqueId>(), policy),
    };
  }
  const constraints = isPlainObject(request.constraints) ? request.constraints as GenerationConstraint : {};
  validateGenerationRequestShape(request, errors);
  const ratingPolicy = (request as GenerationRequest).ratingPolicy;
  const ratingPolicyErrors = typeof ratingPolicy === 'undefined'
    ? []
    : validateRatingPolicy(ratingPolicy);
  const policy = isRatingPolicyLike(ratingPolicy) && ratingPolicyErrors.length === 0
    ? ratingPolicy
    : getDefaultRatingPolicy();
  const defaultAllowedTechniques = [...policy.techniqueOrder, ...(policy.fallbackTechniques ?? [])];
  const knownTechniques = new Set(policy.techniqueOrder);
  for (const technique of policy.fallbackTechniques ?? []) {
    knownTechniques.add(technique);
  }
  const allowedTechniques = readTechniqueArray(constraints.allowedTechniques, defaultAllowedTechniques);
  const forbiddenTechniques = readTechniqueArray(constraints.forbiddenTechniques, []);
  const preferredTechniques = readTechniqueArray(constraints.preferredTechniques, []);
  const allowed = new Set(allowedTechniques);
  const forbidden = new Set(forbiddenTechniques);
  const available = new Set(allowedTechniques.filter((technique) => !forbidden.has(technique)));
  const score = constraints.score;
  const feasibility = estimateFeasibility(request, allowed, forbidden, policy);

  validateScoreRange(score, errors);
  validateClueRange(constraints.clues, errors, warnings);
  validateTechniqueSet('allowedTechniques', allowedTechniques, knownTechniques, errors);
  validateTechniqueSet('forbiddenTechniques', forbiddenTechniques, knownTechniques, errors);
  validateTechniqueSet('preferredTechniques', preferredTechniques, knownTechniques, errors);
  if (Array.isArray(constraints.allowedTechniques)) {
    validateAllowedForbiddenOverlap(new Set(allowedTechniques), forbidden, errors);
  }
  validateAvailableTechniques(available, errors);
  validateRequiredTechniques(constraints.requiredTechniques, knownTechniques, allowed, forbidden, policy, score, errors, warnings, suggestions);
  analyzeScoreTechniqueFit(request, feasibility, warnings, suggestions);

  const status = errors.length > 0 ? 'invalid' : warnings.length > 0 ? 'unlikely' : 'valid';
  return {
    status,
    errors,
    warnings,
    suggestions,
    estimatedDifficulty: estimateDifficulty(score, available, policy),
    feasibility,
  };
}

export function generateOne(request: GenerationRequest): GenerationResult {
  if (isPlainObject(request) && (request as GenerationRequest).relaxation?.enabled) {
    return generateOneWithRelaxation(request);
  }
  return generateOneStrict(request);
}

function generateOneStrict(request: GenerationRequest, relaxationsApplied?: GenerationRelaxationApplied[]): GenerationResult {
  const startedAt = Date.now();
  const requestAnalysis = analyzeGenerationRequest(request);
  const diagnostics: GenerationDiagnostics = {
    attempts: 0,
    elapsedMs: 0,
    rejectedByReason: {},
    warnings: requestAnalysis.warnings.map((item) => item.message),
  };

  if (requestAnalysis.status === 'invalid') {
    diagnostics.elapsedMs = Date.now() - startedAt;
    return {
      status: 'invalid-request',
      requestAnalysis,
      diagnostics,
      ...(relaxationsApplied ? { relaxationsApplied } : {}),
    };
  }

  const policy = request.ratingPolicy ?? getDefaultRatingPolicy();
  const constraints = request.constraints ?? {};
  const baseSeed = request.seed ?? defaultSeed();
  const targetClues = constraints.clues?.target
    ?? constraints.clues?.max
    ?? constraints.clues?.min
    ?? 28;
  const maxAttempts = request.budget?.maxAttempts ?? (requestAnalysis.status === 'unlikely' ? 500 : 200);
  const maxElapsedMs = request.budget?.maxElapsedMs ?? (requestAnalysis.status === 'unlikely' ? 4000 : 2000);
  if (baseSeed + maxAttempts - 1 > MAX_SEED) {
    diagnostics.elapsedMs = Date.now() - startedAt;
    return {
      status: 'invalid-request',
      requestAnalysis: addGenerationRequestError(requestAnalysis, {
        code: 'invalid-seed',
        message: 'seed 范围超过 32-bit 上限。',
        details: { seed: baseSeed, maxAttempts },
      }),
      diagnostics,
      ...(relaxationsApplied ? { relaxationsApplied } : {}),
    };
  }
  let bestCandidate: GeneratedPuzzle | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    diagnostics.attempts = attempt + 1;
    if (Date.now() - startedAt >= maxElapsedMs) {
      diagnostics.elapsedMs = Date.now() - startedAt;
      return withBestCandidate({
        status: 'timeout',
        requestAnalysis,
        diagnostics,
        ...(relaxationsApplied ? { relaxationsApplied } : {}),
      }, bestCandidate);
    }

    const seed = baseSeed + attempt;
    const solution = solutionFactory.create(seed);
    const remainingBeforeCarve = maxElapsedMs - (Date.now() - startedAt);
    if (remainingBeforeCarve <= 0) {
      diagnostics.elapsedMs = Date.now() - startedAt;
      return withBestCandidate({
        status: 'timeout',
        requestAnalysis,
        diagnostics,
        ...(relaxationsApplied ? { relaxationsApplied } : {}),
      }, bestCandidate);
    }
    const carved = clueRemover.carve(solution, {
      targetClues: Math.max(17, Math.min(81, targetClues)),
      seed,
      symmetry: constraints.symmetry ?? 'none',
      maxElapsedMs: remainingBeforeCarve,
    });
    const remainingBeforeMinimize = maxElapsedMs - (Date.now() - startedAt);
    if (remainingBeforeMinimize <= 0) {
      diagnostics.elapsedMs = Date.now() - startedAt;
      return withBestCandidate({
        status: 'timeout',
        requestAnalysis,
        diagnostics,
        ...(relaxationsApplied ? { relaxationsApplied } : {}),
      }, bestCandidate);
    }
    const minimized = request.minimality === 'strict'
      ? puzzleMinimizer.minimize(carved, { maxElapsedMs: remainingBeforeMinimize })
      : { puzzle: carved, aborted: false };
    if (minimized.aborted) {
      diagnostics.rejectedByReason['minimality-timeout'] = (diagnostics.rejectedByReason['minimality-timeout'] ?? 0) + 1;
      diagnostics.elapsedMs = Date.now() - startedAt;
      return withBestCandidate({
        status: 'timeout',
        requestAnalysis,
        diagnostics,
        ...(relaxationsApplied ? { relaxationsApplied } : {}),
      }, bestCandidate);
    }
    const puzzle = minimized.puzzle;
    const rated = rate(puzzle, buildPolicyForConstraints(policy, constraints));
    const candidate = buildGeneratedPuzzle(puzzle, solution, seed, rated, request.canonicalize === true);

    const rejectReason = matchesConstraints(candidate, constraints);
    if (rejectReason) {
      diagnostics.rejectedByReason[rejectReason] = (diagnostics.rejectedByReason[rejectReason] ?? 0) + 1;
      bestCandidate = chooseBetterCandidate(bestCandidate, candidate, constraints);
      continue;
    }

    diagnostics.elapsedMs = Date.now() - startedAt;
    return {
      status: 'success',
      requestAnalysis,
      diagnostics,
      puzzle: candidate,
      ...(relaxationsApplied ? { relaxationsApplied } : {}),
    };
  }

  diagnostics.elapsedMs = Date.now() - startedAt;
  return withBestCandidate({
    status: bestCandidate ? 'no-match' : 'attempt-limit',
    requestAnalysis,
    diagnostics,
    ...(relaxationsApplied ? { relaxationsApplied } : {}),
  }, bestCandidate);
}

function generateOneWithRelaxation(request: GenerationRequest): GenerationResult {
  const relaxation = request.relaxation;
  const maxRounds = relaxation?.maxRounds ?? 2;
  const applied: GenerationRelaxationApplied[] = [];
  let currentRequest: GenerationRequest = {
    ...request,
    relaxation: {
      ...request.relaxation,
      enabled: false,
    },
  };

  let result = generateOneStrict(currentRequest, [...applied]);
  if (result.status === 'success' || result.status === 'invalid-request') {
    return result;
  }

  for (let round = 1; round <= maxRounds; round += 1) {
    currentRequest = relaxRequest(currentRequest, relaxation, round, applied);
    result = generateOneStrict(currentRequest, [...applied]);
    if (result.status === 'success' || result.status === 'invalid-request') {
      return result.status === 'success'
        ? { ...result, status: 'success', relaxationsApplied: [...applied] }
        : result;
    }
  }

  return {
    ...result,
    relaxationsApplied: [...applied],
  };
}

function addGenerationRequestError(
  analysis: GenerationRequestAnalysis,
  issue: GenerationRequestIssue,
): GenerationRequestAnalysis {
  return {
    ...analysis,
    status: 'invalid',
    errors: [...analysis.errors, issue],
  };
}

function relaxRequest(
  request: GenerationRequest,
  relaxation: GenerationRelaxation | undefined,
  round: number,
  applied: GenerationRelaxationApplied[],
): GenerationRequest {
  const scoreExpansion = relaxation?.scoreExpansionPerRound ?? 100;
  const clueExpansion = relaxation?.clueExpansionPerRound ?? 1;
  const attemptMultiplier = relaxation?.attemptMultiplierPerRound ?? 2;
  const constraints: GenerationConstraint = { ...(request.constraints ?? {}) };
  if (request.constraints?.score) {
    constraints.score = { ...request.constraints.score };
  }
  if (request.constraints?.clues) {
    constraints.clues = { ...request.constraints.clues };
  }
  const budget: GenerationBudget = { ...(request.budget ?? {}) };

  if (constraints.score) {
    const before = { ...constraints.score };
    let changed = false;
    if (typeof constraints.score.min === 'number') {
      const nextMin = Math.max(0, constraints.score.min - scoreExpansion);
      changed = changed || nextMin !== constraints.score.min;
      constraints.score.min = nextMin;
    }
    if (typeof constraints.score.max === 'number') {
      const nextMax = constraints.score.max + scoreExpansion;
      changed = changed || nextMax !== constraints.score.max;
      constraints.score.max = nextMax;
    }
    if (changed) {
      applied.push({
        round,
        type: 'score-range-expanded',
        message: '扩大分数范围。',
        before,
        after: { ...constraints.score },
      });
    }
  }

  if (constraints.clues) {
    const before = { ...constraints.clues };
    let changed = false;
    if (typeof constraints.clues.min === 'number') {
      const nextMin = Math.max(0, constraints.clues.min - clueExpansion);
      changed = changed || nextMin !== constraints.clues.min;
      constraints.clues.min = nextMin;
    }
    if (typeof constraints.clues.max === 'number') {
      const nextMax = Math.min(81, constraints.clues.max + clueExpansion);
      changed = changed || nextMax !== constraints.clues.max;
      constraints.clues.max = nextMax;
    }
    if (changed) {
      applied.push({
        round,
        type: 'clue-range-expanded',
        message: '扩大线索数范围。',
        before,
        after: { ...constraints.clues },
      });
    }
  }

  if (typeof budget.maxAttempts === 'number') {
    const before = { maxAttempts: budget.maxAttempts };
    budget.maxAttempts = Math.max(budget.maxAttempts + 1, Math.ceil(budget.maxAttempts * attemptMultiplier));
    applied.push({
      round,
      type: 'attempt-budget-increased',
      message: '增加尝试次数预算。',
      before,
      after: { maxAttempts: budget.maxAttempts },
    });
  }

  return {
    ...request,
    constraints,
    budget,
  };
}

export function* search(request: SearchRequest): Iterable<GenerationEvent> {
  assertValidSearchRequest(request);
  if (request.relaxation?.enabled) {
    throw new Error('search does not support relaxation because it would break seed range accounting.');
  }
  const maxResults = request.maxResults ?? 10;
  const budgetAttempts = request.budget?.maxAttempts ?? maxResults;
  const baseSeed = request.seed ?? defaultSeed();
  if (baseSeed + budgetAttempts - 1 > MAX_SEED) {
    throw new Error('search seed range exceeds 32-bit seed limit.');
  }
  const { maxResults: _maxResults, scoreBucketSize: _scoreBucketSize, ...generationRequest } = request;
  void _maxResults;
  void _scoreBucketSize;
  let accepted = 0;
  let rejected = 0;
  const summary: SearchSummary = {
    accepted: 0,
    rejected: 0,
    rejectedByReason: {},
    scoreBuckets: {},
    techniqueHits: {},
    bestScore: null,
    worstScore: null,
  };

  for (let index = 0; index < budgetAttempts && accepted < maxResults; index += 1) {
    const result = generateOne({
      ...generationRequest,
      seed: baseSeed + index,
      budget: {
        ...request.budget,
        maxAttempts: 1,
      },
    });
    if (result.status === 'success' && result.puzzle) {
      accepted += 1;
      recordAccepted(summary, result.puzzle, request.scoreBucketSize ?? 100);
      yield {
        type: 'accepted',
        index,
        result,
        puzzle: result.puzzle,
      };
    } else {
      rejected += 1;
      const reason = firstRejectReason(result);
      recordRejected(summary, reason);
      yield {
        type: 'rejected',
        index,
        result,
        reason,
      };
    }
  }

  summary.accepted = accepted;
  summary.rejected = rejected;
  yield {
    type: 'done',
    accepted,
    rejected,
    summary,
  };
}

export function selectFromCandidates(
  candidates: readonly GeneratedPuzzle[],
  plan: CandidateSelectionPlan,
): CandidateSelectionResult {
  validateCandidatePool(candidates);
  validateCandidateSelectionPlan(plan);

  const selected: GeneratedPuzzle[] = [];
  const rejected: CandidateSelectionResult['rejected'] = [];
  const rejectedByReason: Record<string, number> = {};
  const preferredTechniqueHits: Partial<Record<TechniqueId, number>> = {};
  const seenCanonical = new Set<string>();
  const bucketCounts = new Map<number, number>();
  const sorted = [...candidates].sort((left, right) => (
    countPreferredTechniqueHits(left, plan.preferredTechniques) - countPreferredTechniqueHits(right, plan.preferredTechniques)
  ) * -1 || right.score - left.score);

  for (const puzzle of sorted) {
    if (selected.length >= plan.maxResults) {
      rejectCandidate(rejected, rejectedByReason, puzzle, 'selection-limit');
      continue;
    }

    const bucketIndex = findScoreBucket(plan.scoreBuckets, puzzle.score);
    if (plan.scoreBuckets && bucketIndex < 0) {
      rejectCandidate(rejected, rejectedByReason, puzzle, 'score-out-of-buckets');
      continue;
    }
    if (bucketIndex >= 0) {
      const bucket = plan.scoreBuckets![bucketIndex]!;
      const currentCount = bucketCounts.get(bucketIndex) ?? 0;
      if (typeof bucket.limit === 'number' && currentCount >= bucket.limit) {
        rejectCandidate(rejected, rejectedByReason, puzzle, 'score-bucket-full');
        continue;
      }
    }

    if (plan.dedupeCanonical) {
      const dedupeKey = puzzle.canonicalKey ?? puzzleKey(puzzle);
      if (seenCanonical.has(dedupeKey)) {
        rejectCandidate(rejected, rejectedByReason, puzzle, 'canonical-duplicate');
        continue;
      }
      seenCanonical.add(dedupeKey);
    }

    if (bucketIndex >= 0) {
      bucketCounts.set(bucketIndex, (bucketCounts.get(bucketIndex) ?? 0) + 1);
    }
    selected.push(cloneGeneratedPuzzle(puzzle));
    recordPreferredTechniqueHits(preferredTechniqueHits, puzzle, plan.preferredTechniques);
  }

  return {
    selected,
    rejected,
    diagnostics: {
      selected: selected.length,
      rejected: rejected.length,
      rejectedByReason,
      scoreBucketCounts: buildScoreBucketCounts(plan, bucketCounts),
      preferredTechniqueHits,
    },
  };
}

export function analyzeCandidatePool(
  candidates: readonly GeneratedPuzzle[],
  options: CandidatePoolStatsOptions = {},
): CandidatePoolStats {
  validateCandidatePool(candidates);
  const scoreBucketSize = options.scoreBucketSize ?? 100;
  const clueBucketSize = options.clueBucketSize ?? 5;
  validatePositiveIntegerOption('scoreBucketSize', scoreBucketSize);
  validatePositiveIntegerOption('clueBucketSize', clueBucketSize);
  const stats: CandidatePoolStats = {
    total: candidates.length,
    score: {
      min: null,
      max: null,
      average: null,
      buckets: {},
    },
    clues: {
      min: null,
      max: null,
      average: null,
      buckets: {},
    },
    gradeCounts: {},
    hardestTechniqueCounts: {},
    techniqueHits: {},
    canonical: {
      withKey: 0,
      withoutKey: 0,
      uniqueKeys: 0,
      duplicateKeys: 0,
    },
    seeds: {
      min: null,
      max: null,
      duplicates: 0,
    },
  };

  let scoreTotal = 0;
  let clueTotal = 0;
  const canonicalKeys = new Set<string>();
  const duplicateCanonicalKeys = new Set<string>();
  const seeds = new Set<number>();
  const duplicateSeeds = new Set<number>();

  for (const candidate of candidates) {
    scoreTotal += candidate.score;
    clueTotal += candidate.clueCount;
    stats.score.min = stats.score.min === null ? candidate.score : Math.min(stats.score.min, candidate.score);
    stats.score.max = stats.score.max === null ? candidate.score : Math.max(stats.score.max, candidate.score);
    stats.clues.min = stats.clues.min === null ? candidate.clueCount : Math.min(stats.clues.min, candidate.clueCount);
    stats.clues.max = stats.clues.max === null ? candidate.clueCount : Math.max(stats.clues.max, candidate.clueCount);
    recordNumberBucket(stats.score.buckets, candidate.score, scoreBucketSize);
    recordNumberBucket(stats.clues.buckets, candidate.clueCount, clueBucketSize);

    const grade = candidate.grade ?? 'null';
    stats.gradeCounts[grade] = (stats.gradeCounts[grade] ?? 0) + 1;
    if (candidate.hardestTechnique) {
      stats.hardestTechniqueCounts[candidate.hardestTechnique] = (stats.hardestTechniqueCounts[candidate.hardestTechnique] ?? 0) + 1;
    }
    for (const [technique, count] of Object.entries(candidate.techniqueCounts)) {
      const id = technique as TechniqueId;
      stats.techniqueHits[id] = (stats.techniqueHits[id] ?? 0) + count;
    }

    if (candidate.canonicalKey) {
      stats.canonical.withKey += 1;
      if (canonicalKeys.has(candidate.canonicalKey)) {
        duplicateCanonicalKeys.add(candidate.canonicalKey);
      }
      canonicalKeys.add(candidate.canonicalKey);
    } else {
      stats.canonical.withoutKey += 1;
    }

    stats.seeds.min = stats.seeds.min === null ? candidate.seed : Math.min(stats.seeds.min, candidate.seed);
    stats.seeds.max = stats.seeds.max === null ? candidate.seed : Math.max(stats.seeds.max, candidate.seed);
    if (seeds.has(candidate.seed)) {
      duplicateSeeds.add(candidate.seed);
    }
    seeds.add(candidate.seed);
  }

  stats.score.average = candidates.length === 0 ? null : scoreTotal / candidates.length;
  stats.clues.average = candidates.length === 0 ? null : clueTotal / candidates.length;
  stats.canonical.uniqueKeys = canonicalKeys.size;
  stats.canonical.duplicateKeys = duplicateCanonicalKeys.size;
  stats.seeds.duplicates = duplicateSeeds.size;
  return stats;
}

export function dedupeCandidates(
  candidates: readonly GeneratedPuzzle[],
  options: CandidateDedupeOptions = {},
): CandidateDedupeResult {
  validateCandidatePool(candidates);
  const keyMode = options.key ?? 'canonical';
  const kept: GeneratedPuzzle[] = [];
  const rejected: CandidateDedupeResult['rejected'] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const key = keyMode === 'canonical'
      ? candidate.canonicalKey ?? puzzleKey(candidate)
      : puzzleKey(candidate);
    if (seen.has(key)) {
      rejected.push({
        puzzle: cloneGeneratedPuzzle(candidate),
        reason: keyMode === 'canonical' && candidate.canonicalKey ? 'canonical-duplicate' : 'puzzle-duplicate',
        key,
      });
      continue;
    }
    seen.add(key);
    kept.push(cloneGeneratedPuzzle(candidate));
  }

  return {
    candidates: kept,
    rejected,
    diagnostics: {
      input: candidates.length,
      kept: kept.length,
      removed: rejected.length,
      key: keyMode,
    },
  };
}

export function validateCandidatePool(candidates: readonly GeneratedPuzzle[]): void {
  if (!Array.isArray(candidates)) {
    throw new Error('候选池必须是 GeneratedPuzzle JSON array。');
  }
  for (const [index, candidate] of candidates.entries()) {
    validateGeneratedPuzzle(candidate, index);
  }
}

export function validateGeneratedPuzzle(candidate: GeneratedPuzzle, index?: number): void {
  const label = typeof index === 'number' ? `候选题第 ${index + 1} 项` : '候选题';
  if (!isPlainObject(candidate)) {
    throw new Error(`${label} 必须是 object。`);
  }
  validateCandidateBoard(candidate.puzzle, `${label}.puzzle`);
  validateCandidateBoard(candidate.solution, `${label}.solution`);
  validateCandidateSolution(candidate.puzzle, candidate.solution, label);
  if (!Number.isInteger(candidate.seed) || candidate.seed < 1 || candidate.seed > MAX_SEED) {
    throw new Error(`${label}.seed 必须是 1 到 0xffffffff 之间的整数。`);
  }
  if (typeof candidate.solved !== 'boolean') {
    throw new Error(`${label}.solved 必须是 boolean。`);
  }
  if (
    typeof candidate.stuckReason !== 'undefined'
    && candidate.stuckReason !== 'contradiction'
    && candidate.stuckReason !== 'no-technique-match'
    && candidate.stuckReason !== 'step-limit'
  ) {
    throw new Error(`${label}.stuckReason 无效。`);
  }
  if (!Number.isInteger(candidate.clueCount) || candidate.clueCount < 0 || candidate.clueCount > 81) {
    throw new Error(`${label}.clueCount 必须是 0 到 81 之间的整数。`);
  }
  const actualClueCount = candidate.puzzle.filter((value) => value !== 0).length;
  if (candidate.clueCount !== actualClueCount) {
    throw new Error(`${label}.clueCount 与 puzzle 中的线索数不一致。`);
  }
  if (typeof candidate.score !== 'number' || !Number.isFinite(candidate.score)) {
    throw new Error(`${label}.score 必须是有限数字。`);
  }
  if (candidate.grade !== null && typeof candidate.grade !== 'string') {
    throw new Error(`${label}.grade 必须是 string 或 null。`);
  }
  if (candidate.hardestTechnique !== null && !knownTechniqueIds.has(candidate.hardestTechnique)) {
    throw new Error(`${label}.hardestTechnique 包含未知技巧：${String(candidate.hardestTechnique)}`);
  }
  validateTechniqueCounts(candidate.techniqueCounts, `${label}.techniqueCounts`);
  if (
    typeof candidate.canonicalKey !== 'undefined'
    && (typeof candidate.canonicalKey !== 'string' || !/^[0-9]{81}$/.test(candidate.canonicalKey))
  ) {
    throw new Error(`${label}.canonicalKey 必须是 81 位数字字符串。`);
  }
  if (typeof candidate.canonicalKey === 'string') {
    const expectedKey = canonicalizeBoard(candidate.puzzle).key;
    if (candidate.canonicalKey !== expectedKey) {
      throw new Error(`${label}.canonicalKey 与 puzzle 的 canonical key 不一致。`);
    }
  }
}

function validateCandidateBoard(value: unknown, label: string): asserts value is Board {
  if (!Array.isArray(value)) {
    throw new Error(`${label} 必须是 board array。`);
  }
  assertBoardValues(value, label);
}

function validateCandidateSolution(puzzle: Board, solution: Board, label: string): void {
  for (let cell = 0; cell < solution.length; cell += 1) {
    const value = solution[cell] ?? 0;
    if (value === 0) {
      throw new Error(`${label}.solution 必须是完整解盘，不能包含空格。`);
    }
    const clue = puzzle[cell] ?? 0;
    if (clue !== 0 && clue !== value) {
      throw new Error(`${label}.solution 与 puzzle 给定数不一致。`);
    }
  }

  for (const house of ALL_HOUSES) {
    const seen = new Set<number>();
    for (const cell of getHouseCells(house)) {
      const value = solution[cell] ?? 0;
      if (seen.has(value)) {
        throw new Error(`${label}.solution 存在行列宫冲突。`);
      }
      seen.add(value);
    }
  }
}

function validateTechniqueCounts(value: unknown, label: string): void {
  if (!isPlainObject(value)) {
    throw new Error(`${label} 必须是 object。`);
  }
  for (const [technique, count] of Object.entries(value)) {
    if (!knownTechniqueIds.has(technique as TechniqueId)) {
      throw new Error(`${label} 包含未知技巧：${technique}`);
    }
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      throw new Error(`${label}.${technique} 必须是非负整数。`);
    }
  }
}

function validateCandidateSelectionPlan(plan: CandidateSelectionPlan): void {
  const knownTechniques = new Set(techniqueDefinitions.map((definition) => definition.id));
  if (!Number.isInteger(plan.maxResults) || plan.maxResults <= 0) {
    throw new Error('选择计划的 maxResults 必须是大于 0 的整数。');
  }

  for (const technique of plan.preferredTechniques ?? []) {
    if (!knownTechniques.has(technique)) {
      throw new Error(`选择计划包含未知 preferredTechniques：${technique}`);
    }
  }

  for (const [index, bucket] of (plan.scoreBuckets ?? []).entries()) {
    if (typeof bucket.min !== 'number' || !Number.isFinite(bucket.min) || typeof bucket.max !== 'number' || !Number.isFinite(bucket.max)) {
      throw new Error(`选择计划第 ${index + 1} 个分数桶必须包含有限数字 min 和 max。`);
    }
    if (bucket.min > bucket.max) {
      throw new Error(`选择计划第 ${index + 1} 个分数桶的 min 不能大于 max。`);
    }
    if (bucket.limit !== undefined && (!Number.isInteger(bucket.limit) || bucket.limit <= 0)) {
      throw new Error(`选择计划第 ${index + 1} 个分数桶的 limit 必须是大于 0 的整数。`);
    }
    for (const [previousIndex, previous] of (plan.scoreBuckets ?? []).slice(0, index).entries()) {
      if (rangesOverlap(previous.min, previous.max, bucket.min, bucket.max)) {
        throw new Error(`选择计划第 ${previousIndex + 1} 个和第 ${index + 1} 个分数桶不能重叠。`);
      }
    }
  }
}

function validatePositiveIntegerOption(field: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} 必须是大于 0 的整数。`);
  }
}

function assertValidSearchGenerationRequest(request: GenerationRequest): void {
  const analysis = analyzeGenerationRequest(request);
  if (analysis.status !== 'invalid') {
    return;
  }
  const codes = analysis.errors.map((error) => error.code).join(', ');
  throw new Error(`search generation request invalid: ${codes}`);
}

export function assertValidSearchRequest(request: SearchRequest): void {
  validateSearchRequest(request);
  const { maxResults: _maxResults, scoreBucketSize: _scoreBucketSize, ...generationRequest } = request;
  void _maxResults;
  void _scoreBucketSize;
  assertValidSearchGenerationRequest(generationRequest);
}

function validateSearchRequest(request: SearchRequest): void {
  if (!isPlainObject(request)) {
    throw new Error('search request 必须是 object。');
  }
  for (const field of Object.keys(request as Record<string, unknown>)) {
    if (!SEARCH_REQUEST_FIELDS.has(field)) {
      throw new Error(`search request 包含未知字段：${field}`);
    }
  }
  const maxResults = (request as SearchRequest).maxResults;
  if (typeof maxResults !== 'undefined' && (!Number.isInteger(maxResults) || maxResults < 1)) {
    throw new Error('search.maxResults 必须是大于等于 1 的整数。');
  }
  const scoreBucketSize = (request as SearchRequest).scoreBucketSize;
  if (typeof scoreBucketSize !== 'undefined' && (!Number.isInteger(scoreBucketSize) || scoreBucketSize < 1)) {
    throw new Error('search.scoreBucketSize 必须是大于等于 1 的整数。');
  }
}

function recordNumberBucket(output: Record<string, number>, value: number, bucketSize: number): void {
  const normalizedBucketSize = Math.max(1, Math.trunc(bucketSize));
  const start = Math.floor(value / normalizedBucketSize) * normalizedBucketSize;
  const end = start + normalizedBucketSize - 1;
  const key = `${start}-${end}`;
  output[key] = (output[key] ?? 0) + 1;
}

function puzzleKey(candidate: GeneratedPuzzle): string {
  return candidate.puzzle.join('');
}

function rejectCandidate(
  rejected: CandidateSelectionResult['rejected'],
  rejectedByReason: Record<string, number>,
  puzzle: GeneratedPuzzle,
  reason: string,
): void {
  rejected.push({ puzzle: cloneGeneratedPuzzle(puzzle), reason });
  rejectedByReason[reason] = (rejectedByReason[reason] ?? 0) + 1;
}

function cloneGeneratedPuzzle(puzzle: GeneratedPuzzle): GeneratedPuzzle {
  return {
    ...puzzle,
    puzzle: [...puzzle.puzzle],
    solution: [...puzzle.solution],
    techniqueCounts: { ...puzzle.techniqueCounts },
  };
}

function rangesOverlap(leftMin: number, leftMax: number, rightMin: number, rightMax: number): boolean {
  return leftMin <= rightMax && rightMin <= leftMax;
}

function buildScoreBucketCounts(
  plan: CandidateSelectionPlan,
  bucketCounts: Map<number, number>,
): CandidateSelectionDiagnostics['scoreBucketCounts'] {
  return (plan.scoreBuckets ?? []).map((bucket, index) => ({
    min: bucket.min,
    max: bucket.max,
    ...(bucket.limit !== undefined ? { limit: bucket.limit } : {}),
    selected: bucketCounts.get(index) ?? 0,
  }));
}

function recordPreferredTechniqueHits(
  output: Partial<Record<TechniqueId, number>>,
  puzzle: GeneratedPuzzle,
  preferredTechniques: TechniqueId[] | undefined,
): void {
  for (const technique of preferredTechniques ?? []) {
    const count = puzzle.techniqueCounts?.[technique] ?? 0;
    if (count > 0) {
      output[technique] = (output[technique] ?? 0) + count;
    }
  }
}

function validateScoreRange(score: ScoreConstraint | undefined, errors: GenerationRequestIssue[]): void {
  if (typeof score === 'undefined') {
    return;
  }
  if (!isPlainObject(score)) {
    errors.push({
      code: 'invalid-score-constraint',
      message: 'score 必须是 object。',
      details: { score },
    });
    return;
  }
  collectUnknownFields(score, SCORE_CONSTRAINT_FIELDS, 'unknown-generation-score-field', '分数约束包含未知字段。', errors);
  for (const [key, value] of Object.entries(score)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push({
        code: 'invalid-score-field',
        message: '分数字段必须是有限数字。',
        details: { field: key, value },
      });
    }
  }
  if (typeof score.min === 'number' && typeof score.max === 'number' && score.min > score.max) {
    errors.push({
      code: 'score-min-greater-than-max',
      message: '分数下限不能高于分数上限。',
      details: { min: score.min, max: score.max },
    });
  }
  if (typeof score.tolerance === 'number' && score.tolerance < 0) {
    errors.push({
      code: 'negative-score-tolerance',
      message: '分数容差不能为负数。',
      details: { tolerance: score.tolerance },
    });
  }
}

function validateClueRange(
  clues: ClueConstraint | undefined,
  errors: GenerationRequestIssue[],
  warnings: GenerationRequestIssue[],
): void {
  if (typeof clues === 'undefined') {
    return;
  }
  if (!isPlainObject(clues)) {
    errors.push({
      code: 'invalid-clue-constraint',
      message: 'clues 必须是 object。',
      details: { clues },
    });
    return;
  }
  collectUnknownFields(clues, CLUE_CONSTRAINT_FIELDS, 'unknown-generation-clue-field', '线索数约束包含未知字段。', errors);
  for (const [key, value] of Object.entries(clues)) {
    if (!Number.isInteger(value)) {
      errors.push({
        code: 'invalid-clue-field',
        message: '线索数字段必须是整数。',
        details: { field: key, value },
      });
    }
  }
  if (typeof clues.min === 'number' && typeof clues.max === 'number' && clues.min > clues.max) {
    errors.push({
      code: 'clue-min-greater-than-max',
      message: '线索数下限不能高于线索数上限。',
      details: { min: clues.min, max: clues.max },
    });
  }
  for (const [key, value] of Object.entries(clues)) {
    if (typeof value === 'number' && (value < 0 || value > 81)) {
      errors.push({
        code: 'clue-count-out-of-range',
        message: '线索数必须在 0 到 81 之间。',
        details: { field: key, value },
      });
    }
  }
  if (typeof clues.max === 'number' && clues.max < 17) {
    errors.push({
      code: 'clue-max-below-unique-minimum',
      message: '当前生成器始终保证唯一解，线索数上限不能低于 17。',
      details: { max: clues.max },
    });
  }
  if (typeof clues.min === 'number' && clues.min < 17) {
    warnings.push({
      code: 'clue-min-below-unique-minimum-clamped',
      message: '当前生成器始终保证唯一解，线索数下限低于 17 时实际候选仍不会低于唯一题常见下界。',
      details: { min: clues.min },
    });
  }
  if (typeof clues.target === 'number' && clues.target < 17) {
    errors.push({
      code: 'clue-target-below-unique-minimum',
      message: '当前生成器始终保证唯一解，线索数目标不能低于 17。',
      details: { target: clues.target },
    });
  }
}

function validateTechniqueSet(
  field: string,
  techniques: TechniqueId[] | undefined,
  knownTechniques: Set<TechniqueId>,
  errors: GenerationRequestIssue[],
): void {
  for (const technique of techniques ?? []) {
    if (!knownTechniques.has(technique)) {
      errors.push({
        code: 'unknown-technique',
        message: `未知技巧：${technique}`,
        details: { field, technique },
      });
    }
  }
}

function validateGenerationRequestShape(request: GenerationRequest, errors: GenerationRequestIssue[]): void {
  if (!isPlainObject(request)) {
    errors.push({
      code: 'invalid-generation-request',
      message: '生成请求必须是 object。',
      details: { value: request },
    });
    return;
  }
  const rawRequest = request as Record<string, unknown>;
  collectUnknownFields(rawRequest, GENERATION_REQUEST_FIELDS, 'unknown-generation-field', '生成请求包含未知字段。', errors);
  const rawSeed = rawRequest.seed;
  if (typeof rawSeed !== 'undefined' && (
    typeof rawSeed !== 'number'
    || !Number.isInteger(rawSeed)
    || rawSeed < 1
    || rawSeed > MAX_SEED
  )) {
    errors.push({
      code: 'invalid-seed',
      message: 'seed 必须是 1 到 0xffffffff 之间的整数。',
      details: { seed: rawSeed },
    });
  }
  if (typeof rawRequest.canonicalize !== 'undefined' && typeof rawRequest.canonicalize !== 'boolean') {
    errors.push({
      code: 'invalid-canonicalize',
      message: 'canonicalize 必须是 boolean。',
      details: { canonicalize: rawRequest.canonicalize },
    });
  }
  if (
    typeof rawRequest.minimality !== 'undefined'
    && rawRequest.minimality !== 'none'
    && rawRequest.minimality !== 'strict'
  ) {
    errors.push({
      code: 'invalid-minimality',
      message: 'minimality 只能是 none 或 strict。',
      details: { minimality: rawRequest.minimality },
    });
  }

  validateBudget(rawRequest.budget as GenerationBudget | undefined, errors);
  validateRelaxation(rawRequest.relaxation as GenerationRelaxation | undefined, errors);
  validateRatingPolicyForGeneration(rawRequest.ratingPolicy as RatingPolicy | undefined, errors);
  validateSearchOnlyRequestFields(request, errors);
  validateGenerationConstraintShape(rawRequest.constraints as GenerationConstraint | undefined, errors);
}

function validateSearchOnlyRequestFields(request: GenerationRequest, errors: GenerationRequestIssue[]): void {
  const rawRequest = request as Record<string, unknown>;
  const maxResults = rawRequest.maxResults;
  if (typeof maxResults !== 'undefined' && (!Number.isInteger(maxResults) || (maxResults as number) < 1)) {
    errors.push({
      code: 'invalid-search-max-results',
      message: 'maxResults 必须是大于等于 1 的整数。',
      details: { maxResults },
    });
  }
  const scoreBucketSize = rawRequest.scoreBucketSize;
  if (typeof scoreBucketSize !== 'undefined' && (!Number.isInteger(scoreBucketSize) || (scoreBucketSize as number) < 1)) {
    errors.push({
      code: 'invalid-search-score-bucket-size',
      message: 'scoreBucketSize 必须是大于等于 1 的整数。',
      details: { scoreBucketSize },
    });
  }
}

function collectUnknownFields(
  value: object,
  allowedFields: ReadonlySet<string>,
  code: string,
  message: string,
  errors: GenerationRequestIssue[],
  details: Record<string, unknown> = {},
  ignoredFields: ReadonlySet<string> = new Set(),
): void {
  for (const field of Object.keys(value as Record<string, unknown>)) {
    if (ignoredFields.has(field)) {
      continue;
    }
    if (!allowedFields.has(field)) {
      errors.push({
        code,
        message,
        details: { ...details, field },
      });
    }
  }
}

function validateGenerationConstraintShape(
  constraints: GenerationConstraint | undefined,
  errors: GenerationRequestIssue[],
): void {
  if (typeof constraints === 'undefined') {
    return;
  }
  if (!isPlainObject(constraints)) {
    errors.push({
      code: 'invalid-generation-constraints',
      message: 'constraints 必须是 object。',
      details: { constraints },
    });
    return;
  }
  collectUnknownFields(constraints, GENERATION_CONSTRAINT_FIELDS, 'unknown-generation-constraint-field', '生成约束包含未知字段。', errors);
  if (
    typeof constraints.symmetry !== 'undefined'
    && constraints.symmetry !== 'none'
    && constraints.symmetry !== 'central'
  ) {
    errors.push({
      code: 'invalid-symmetry',
      message: 'symmetry 只能是 none 或 central。',
      details: { symmetry: constraints.symmetry },
    });
  }
  if (typeof constraints.uniqueness !== 'undefined' && constraints.uniqueness !== 'required') {
    errors.push({
      code: 'invalid-uniqueness',
      message: '当前版本只支持 uniqueness: required。',
      details: { uniqueness: constraints.uniqueness },
    });
  }
  const rawConstraints = constraints as Record<string, unknown>;
  validateTechniqueArrayShape('allowedTechniques', rawConstraints.allowedTechniques as TechniqueId[] | undefined, errors);
  validateTechniqueArrayShape('forbiddenTechniques', rawConstraints.forbiddenTechniques as TechniqueId[] | undefined, errors);
  validateTechniqueArrayShape('preferredTechniques', rawConstraints.preferredTechniques as TechniqueId[] | undefined, errors);
  validateRequiredTechniqueRuleShape(rawConstraints.requiredTechniques as RequiredTechniqueRule[] | undefined, errors);
}

function validateBudget(budget: GenerationBudget | undefined, errors: GenerationRequestIssue[]): void {
  if (typeof budget === 'undefined') {
    return;
  }
  if (!isPlainObject(budget)) {
    errors.push({
      code: 'invalid-generation-budget',
      message: 'budget 必须是 object。',
      details: { budget },
    });
    return;
  }
  const rawBudget = budget as Record<string, unknown>;
  collectUnknownFields(rawBudget, GENERATION_BUDGET_FIELDS, 'unknown-generation-budget-field', '生成预算包含未知字段。', errors);
  const maxAttempts = rawBudget.maxAttempts;
  if (typeof maxAttempts !== 'undefined' && (typeof maxAttempts !== 'number' || !Number.isInteger(maxAttempts) || maxAttempts < 1)) {
    errors.push({
      code: 'invalid-budget-max-attempts',
      message: 'budget.maxAttempts 必须是大于等于 1 的整数。',
      details: { maxAttempts },
    });
  }
  const maxElapsedMs = rawBudget.maxElapsedMs;
  if (typeof maxElapsedMs !== 'undefined' && (typeof maxElapsedMs !== 'number' || !Number.isInteger(maxElapsedMs) || maxElapsedMs < 1)) {
    errors.push({
      code: 'invalid-budget-max-elapsed-ms',
      message: 'budget.maxElapsedMs 必须是大于等于 1 的整数。',
      details: { maxElapsedMs },
    });
  }
}

function validateRelaxation(relaxation: GenerationRelaxation | undefined, errors: GenerationRequestIssue[]): void {
  if (typeof relaxation === 'undefined') {
    return;
  }
  if (!isPlainObject(relaxation)) {
    errors.push({
      code: 'invalid-generation-relaxation',
      message: 'relaxation 必须是 object。',
      details: { relaxation },
    });
    return;
  }
  collectUnknownFields(relaxation, GENERATION_RELAXATION_FIELDS, 'unknown-generation-relaxation-field', '生成 relaxation 包含未知字段。', errors);
  if (typeof relaxation.enabled !== 'boolean') {
    errors.push({
      code: 'invalid-relaxation-enabled',
      message: 'relaxation.enabled 必须是 boolean。',
      details: { enabled: relaxation.enabled },
    });
  }
  if (typeof relaxation.maxRounds !== 'undefined' && (!Number.isInteger(relaxation.maxRounds) || relaxation.maxRounds < 0)) {
    errors.push({
      code: 'invalid-relaxation-max-rounds',
      message: 'relaxation.maxRounds 必须是大于等于 0 的整数。',
      details: { maxRounds: relaxation.maxRounds },
    });
  }
  if (
    typeof relaxation.scoreExpansionPerRound !== 'undefined'
    && (typeof relaxation.scoreExpansionPerRound !== 'number' || !Number.isFinite(relaxation.scoreExpansionPerRound) || relaxation.scoreExpansionPerRound < 0)
  ) {
    errors.push({
      code: 'invalid-relaxation-score-expansion',
      message: 'relaxation.scoreExpansionPerRound 必须是非负有限数字。',
      details: { scoreExpansionPerRound: relaxation.scoreExpansionPerRound },
    });
  }
  if (
    typeof relaxation.clueExpansionPerRound !== 'undefined'
    && (!Number.isInteger(relaxation.clueExpansionPerRound) || relaxation.clueExpansionPerRound < 0 || relaxation.clueExpansionPerRound > 81)
  ) {
    errors.push({
      code: 'invalid-relaxation-clue-expansion',
      message: 'relaxation.clueExpansionPerRound 必须是 0 到 81 之间的整数。',
      details: { clueExpansionPerRound: relaxation.clueExpansionPerRound },
    });
  }
  if (
    typeof relaxation.attemptMultiplierPerRound !== 'undefined'
    && (typeof relaxation.attemptMultiplierPerRound !== 'number' || !Number.isFinite(relaxation.attemptMultiplierPerRound) || relaxation.attemptMultiplierPerRound < 1)
  ) {
    errors.push({
      code: 'invalid-relaxation-attempt-multiplier',
      message: 'relaxation.attemptMultiplierPerRound 必须是大于等于 1 的有限数字。',
      details: { attemptMultiplierPerRound: relaxation.attemptMultiplierPerRound },
    });
  }
}

function validateRatingPolicyForGeneration(policy: RatingPolicy | undefined, errors: GenerationRequestIssue[]): void {
  if (typeof policy === 'undefined') {
    return;
  }
  errors.push(...validateRatingPolicy(policy));
}

function isRatingPolicyLike(value: RatingPolicy | undefined): value is RatingPolicy {
  return isPlainObject(value)
    && typeof value.id === 'string'
    && typeof value.version === 'string'
    && Array.isArray(value.techniqueOrder)
    && isPlainObject(value.techniqueScores);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateTechniqueArrayShape(
  field: string,
  techniques: TechniqueId[] | undefined,
  errors: GenerationRequestIssue[],
): void {
  if (typeof techniques === 'undefined') {
    return;
  }
  if (!Array.isArray(techniques)) {
    errors.push({
      code: 'invalid-technique-array',
      message: `${field} 必须是技巧 ID 数组。`,
      details: { field, value: techniques },
    });
    return;
  }
  if (field === 'allowedTechniques' && techniques.length === 0) {
    errors.push({
      code: 'empty-allowed-techniques',
      message: 'allowedTechniques 不能为空；生成器至少需要一个可用技巧。',
      details: { field },
    });
  }
  for (const [index, technique] of techniques.entries()) {
    if (typeof technique !== 'string') {
      errors.push({
        code: 'invalid-technique-id',
        message: `${field} 中的技巧 ID 必须是字符串。`,
        details: { field, index, value: technique },
      });
    }
  }
}

function validateRequiredTechniqueRuleShape(
  rules: RequiredTechniqueRule[] | undefined,
  errors: GenerationRequestIssue[],
): void {
  if (typeof rules === 'undefined') {
    return;
  }
  if (!Array.isArray(rules)) {
    errors.push({
      code: 'invalid-required-techniques',
      message: 'requiredTechniques 必须是数组。',
      details: { value: rules },
    });
    return;
  }
  for (const [index, rule] of rules.entries()) {
    if (typeof rule !== 'object' || rule === null || Array.isArray(rule)) {
      errors.push({
        code: 'invalid-required-technique-rule',
        message: 'requiredTechniques 中的规则必须是 object。',
        details: { index, value: rule },
      });
      continue;
    }
    const ruleType = (rule as { type?: unknown }).type;
    if (ruleType !== 'appears' && ruleType !== 'hardest-in' && ruleType !== 'family-coverage') {
      errors.push({
        code: 'invalid-required-technique-rule-type',
        message: 'requiredTechniques 规则 type 只能是 appears、hardest-in 或 family-coverage。',
        details: { index, type: ruleType },
      });
      continue;
    }
    collectUnknownFields(
      rule as Record<string, unknown>,
      REQUIRED_TECHNIQUE_FIELDS[ruleType],
      'unknown-required-technique-field',
      'requiredTechniques 规则包含未知字段。',
      errors,
      { index },
    );
    if (rule.type === 'family-coverage') {
      if (!Array.isArray(rule.families) || rule.families.some((family) => typeof family !== 'string')) {
        errors.push({
          code: 'invalid-required-family-list',
          message: 'family-coverage 规则必须提供字符串 families 数组。',
          details: { index, families: rule.families },
        });
      } else if (rule.families.length === 0) {
        errors.push({
          code: 'empty-required-family-list',
          message: 'family-coverage 规则的 families 不能为空。',
          details: { index },
        });
      }
      continue;
    }
    if (!Array.isArray(rule.techniques) || rule.techniques.some((technique) => typeof technique !== 'string')) {
      errors.push({
        code: 'invalid-required-technique-list',
        message: 'requiredTechniques 规则必须提供字符串 techniques 数组。',
        details: { index, techniques: rule.techniques },
      });
    } else if (rule.techniques.length === 0) {
      errors.push({
        code: 'empty-required-technique-list',
        message: 'requiredTechniques 规则的 techniques 不能为空。',
        details: { index },
      });
    }
    if (rule.type === 'appears' && typeof rule.minCount !== 'undefined' && (!Number.isInteger(rule.minCount) || rule.minCount < 1)) {
      errors.push({
        code: 'invalid-required-min-count',
        message: 'appears 规则的 minCount 必须是大于等于 1 的整数。',
        details: { index, minCount: rule.minCount },
      });
    }
  }
}

function readTechniqueArray(value: TechniqueId[] | undefined, fallback: readonly TechniqueId[]): TechniqueId[] {
  return Array.isArray(value) ? value.filter((item): item is TechniqueId => typeof item === 'string') : [...fallback];
}

function validateAllowedForbiddenOverlap(
  allowed: Set<TechniqueId>,
  forbidden: Set<TechniqueId>,
  errors: GenerationRequestIssue[],
): void {
  for (const technique of forbidden) {
    if (allowed.has(technique)) {
      errors.push({
        code: 'technique-both-allowed-and-forbidden',
        message: `技巧不能同时被允许和禁止：${technique}`,
        details: { technique },
      });
    }
  }
}

function validateAvailableTechniques(
  available: Set<TechniqueId>,
  errors: GenerationRequestIssue[],
): void {
  if (available.size > 0) {
    return;
  }
  errors.push({
    code: 'no-available-techniques',
    message: '过滤 allowedTechniques / forbiddenTechniques 后没有可用技巧，生成器至少需要一个可执行技巧。',
  });
}

function validateRequiredTechniques(
  rules: RequiredTechniqueRule[] | undefined,
  knownTechniques: Set<TechniqueId>,
  allowed: Set<TechniqueId>,
  forbidden: Set<TechniqueId>,
  policy: RatingPolicy,
  score: ScoreConstraint | undefined,
  errors: GenerationRequestIssue[],
  warnings: GenerationRequestIssue[],
  suggestions: GenerationSuggestion[],
): void {
  if (!Array.isArray(rules)) {
    return;
  }
  for (const rule of rules ?? []) {
    if (!isRequiredTechniqueRuleLike(rule)) {
      continue;
    }
    if (rule.type === 'family-coverage') {
      if (rule.families.length === 0) {
        continue;
      }
      for (const family of rule.families) {
        const hasFamily = Array.from(allowed).some((technique) => techniqueFamilies.get(technique) === family);
        if (!hasFamily) {
          errors.push({
            code: 'required-family-not-allowed',
            message: `要求覆盖的技巧族不在允许技巧范围内：${family}`,
            details: { family },
          });
        }
      }
      continue;
    }
    if (rule.techniques.length === 0) {
      continue;
    }

    if (rule.type === 'appears') {
      const availableTechniques = getAvailableAppearsTechniques(rule, knownTechniques, allowed, forbidden, policy, score);
      if (availableTechniques.length === 0) {
        errors.push({
          code: 'required-technique-not-available',
          message: 'appears 规则中没有任何可用技巧。',
          details: { techniques: rule.techniques },
        });
      } else {
        const unavailableAlternatives = rule.techniques.filter((technique) => !availableTechniques.includes(technique));
        if (unavailableAlternatives.length > 0) {
          suggestions.push({
            type: 'review-required-technique-alternatives',
            message: 'appears 规则中有备选技巧当前不可用；如果不是故意的，请检查拼写、allowedTechniques、forbiddenTechniques 或 score.max。',
            details: { techniques: unavailableAlternatives },
          });
        }
      }
      continue;
    }

    validateRequiredTechniqueList(rule.techniques, knownTechniques, allowed, forbidden, policy, score, errors);
  }

  const requiredCount = (rules ?? []).filter((rule) => rule.type !== 'family-coverage').length;
  if (
    requiredCount > 0
    && typeof score?.max === 'number'
    && score.max < estimateRequiredMinimumScore(rules ?? [], policy, knownTechniques, allowed, forbidden, score)
  ) {
    warnings.push({
      code: 'score-max-low-for-required-techniques',
      message: '分数上限可能过低，难以容纳要求出现的技巧。',
      details: { scoreMax: score.max },
    });
    suggestions.push({
      type: 'raise-score-max',
      message: '提高分数上限，或把部分技巧从 requiredTechniques 移到 preferredTechniques。',
    });
  }
}

function getAvailableAppearsTechniques(
  rule: Extract<RequiredTechniqueRule, { type: 'appears' }>,
  knownTechniques: Set<TechniqueId>,
  allowed: Set<TechniqueId>,
  forbidden: Set<TechniqueId>,
  policy: RatingPolicy,
  score: ScoreConstraint | undefined,
): TechniqueId[] {
  return rule.techniques.filter((technique) => (
    knownTechniques.has(technique)
    && allowed.has(technique)
    && !forbidden.has(technique)
    && (typeof score?.max !== 'number' || (policy.techniqueScores[technique] ?? 0) <= score.max)
  ));
}

function validateRequiredTechniqueList(
  techniques: readonly TechniqueId[],
  knownTechniques: Set<TechniqueId>,
  allowed: Set<TechniqueId>,
  forbidden: Set<TechniqueId>,
  policy: RatingPolicy,
  score: ScoreConstraint | undefined,
  errors: GenerationRequestIssue[],
): void {
  for (const technique of techniques) {
    if (!knownTechniques.has(technique)) {
      errors.push({
        code: 'unknown-required-technique',
        message: `要求出现未知技巧：${technique}`,
        details: { technique },
      });
      continue;
    }
    if (!allowed.has(technique)) {
      errors.push({
        code: 'required-technique-not-allowed',
        message: `要求出现的技巧不在允许技巧范围内：${technique}`,
        details: { technique },
      });
    }
    if (forbidden.has(technique)) {
      errors.push({
        code: 'required-technique-forbidden',
        message: `要求出现的技巧被禁止：${technique}`,
        details: { technique },
      });
    }
    const techniqueScore = policy.techniqueScores[technique] ?? 0;
    if (typeof score?.max === 'number' && techniqueScore > score.max) {
      errors.push({
        code: 'required-technique-score-above-max',
        message: `要求出现的技巧单步分值高于分数上限：${technique}`,
        details: { technique, techniqueScore, scoreMax: score.max },
      });
    }
  }
}

function isRequiredTechniqueRuleLike(rule: RequiredTechniqueRule): rule is RequiredTechniqueRule {
  if (typeof rule !== 'object' || rule === null || Array.isArray(rule)) {
    return false;
  }
  if (rule.type === 'family-coverage') {
    return Array.isArray(rule.families) && rule.families.every((family) => typeof family === 'string');
  }
  if (rule.type === 'appears') {
    return Array.isArray(rule.techniques)
      && rule.techniques.every((technique) => typeof technique === 'string')
      && (typeof rule.minCount === 'undefined' || (Number.isInteger(rule.minCount) && rule.minCount >= 1));
  }
  if (rule.type === 'hardest-in') {
    return Array.isArray(rule.techniques) && rule.techniques.every((technique) => typeof technique === 'string');
  }
  return false;
}

function analyzeScoreTechniqueFit(
  request: GenerationRequest,
  feasibility: GenerationFeasibilityEstimate,
  warnings: GenerationRequestIssue[],
  suggestions: GenerationSuggestion[],
): void {
  const score = request.constraints?.score;
  const clues = request.constraints?.clues;
  const allowedCount = feasibility.allowedTechniqueCount;
  const maxSingleStepScore = feasibility.maxSingleStepScore;

  if (typeof score?.min === 'number' && allowedCount <= 3 && score.min >= 1500) {
    warnings.push({
      code: 'score-range-too-high-for-narrow-techniques',
      message: '允许技巧范围很窄，但分数下限较高，生成可能非常慢。',
      details: { scoreMin: score.min, allowedCount },
    });
    suggestions.push({
      type: 'expand-techniques',
      message: '扩大 allowedTechniques，或降低分数下限。',
    });
  }

  if (typeof score?.min === 'number' && maxSingleStepScore <= 30 && score.min >= 1000) {
    warnings.push({
      code: 'score-range-too-high-for-basic-techniques',
      message: '当前允许技巧接近基础单数技巧，但分数要求较高，可能需要大量步骤才能满足。',
      details: { scoreMin: score.min, maxSingleStepScore },
    });
    suggestions.push({
      type: 'lower-score-min',
      message: '降低分数下限，或允许更高分值技巧。',
    });
  }

  if (typeof score?.min === 'number' && typeof score.max === 'number' && score.max - score.min < 100) {
    warnings.push({
      code: 'score-range-too-narrow',
      message: '分数范围过窄，生成命中率可能很低。',
      details: { min: score.min, max: score.max },
    });
    suggestions.push({
      type: 'expand-score-range',
      message: '扩大分数范围，或使用 target/tolerance 表达软目标。',
    });
  }

  if ((feasibility.estimatedMinStepsForScoreMin ?? 0) >= 30 && allowedCount <= 5) {
    warnings.push({
      code: 'score-min-requires-many-steps-with-narrow-techniques',
      message: '在当前允许技巧范围下，达到分数下限至少需要很多步骤，生成命中率可能很低。',
      details: {
        estimatedMinStepsForScoreMin: feasibility.estimatedMinStepsForScoreMin,
        allowedTechniqueCount: allowedCount,
      },
    });
    suggestions.push({
      type: 'expand-techniques',
      message: '扩大 allowedTechniques，或把部分技巧改成 preferredTechniques，让生成器先积累候选池再筛选。',
    });
  }

  if (typeof score?.min === 'number' && typeof clues?.min === 'number' && clues.min >= 40 && score.min >= 1500) {
    warnings.push({
      code: 'high-clue-count-with-high-score',
      message: '线索数下限较高且分数下限也较高，题目通常会偏简单，生成命中率可能很低。',
      details: {
        scoreMin: score.min,
        clueMin: clues.min,
      },
    });
    suggestions.push({
      type: 'expand-score-range',
      message: '降低线索数下限、降低分数下限，或允许更复杂技巧来提高命中率。',
    });
  }

  if (
    typeof feasibility.budgetMaxAttempts === 'number'
    && feasibility.budgetMaxAttempts <= 5
    && (
      (typeof score?.min === 'number' && score.min >= 1500)
      || allowedCount <= 5
      || (feasibility.scoreRangeWidth !== null && feasibility.scoreRangeWidth < 100)
    )
  ) {
    warnings.push({
      code: 'budget-too-small-for-constrained-request',
      message: '当前尝试次数预算较小，而请求约束较严格，建议先增加预算或改用 search 离线积累候选。',
      details: {
        budgetMaxAttempts: feasibility.budgetMaxAttempts,
        scoreRangeWidth: feasibility.scoreRangeWidth,
        allowedTechniqueCount: allowedCount,
      },
    });
    suggestions.push({
      type: 'increase-budget',
      message: '增加 budget.maxAttempts，或使用 search 配合候选池筛选。',
    });
  }
}

function estimateFeasibility(
  request: GenerationRequest,
  allowed: Set<TechniqueId>,
  forbidden: Set<TechniqueId>,
  policy: RatingPolicy,
): GenerationFeasibilityEstimate {
  const constraints = request.constraints ?? {};
  const allowedScores = Array.from(allowed)
    .filter((technique) => !forbidden.has(technique))
    .map((technique) => policy.techniqueScores[technique] ?? 0);
  const positiveScores = allowedScores.filter((score) => score > 0);
  const maxSingleStepScore = Math.max(0, ...allowedScores);
  const averagePositiveStepScore = positiveScores.length === 0
    ? 0
    : positiveScores.reduce((total, score) => total + score, 0) / positiveScores.length;
  const scoreMin = constraints.score?.min ?? (
    typeof constraints.score?.target === 'number' && typeof constraints.score?.tolerance === 'number'
      ? Math.max(0, constraints.score.target - constraints.score.tolerance)
      : undefined
  );
  const estimatedMinSteps = typeof scoreMin === 'number' && maxSingleStepScore > 0
    ? Math.ceil(scoreMin / maxSingleStepScore)
    : null;
  const estimatedTypicalSteps = typeof scoreMin === 'number' && averagePositiveStepScore > 0
    ? Math.ceil(scoreMin / averagePositiveStepScore)
    : null;
  return {
    allowedTechniqueCount: allowedScores.length,
    maxSingleStepScore,
    averagePositiveStepScore,
    scoreRangeWidth: typeof constraints.score?.min === 'number' && typeof constraints.score.max === 'number'
      ? constraints.score.max - constraints.score.min
      : null,
    clueRangeWidth: typeof constraints.clues?.min === 'number' && typeof constraints.clues.max === 'number'
      ? constraints.clues.max - constraints.clues.min
      : null,
    estimatedMinStepsForScoreMin: estimatedMinSteps,
    estimatedTypicalStepsForScoreMin: estimatedTypicalSteps,
    budgetMaxAttempts: request.budget?.maxAttempts ?? null,
    budgetMaxElapsedMs: request.budget?.maxElapsedMs ?? null,
  };
}

function estimateRequiredMinimumScore(
  rules: RequiredTechniqueRule[],
  policy: RatingPolicy,
  knownTechniques: Set<TechniqueId>,
  allowed: Set<TechniqueId>,
  forbidden: Set<TechniqueId>,
  score: ScoreConstraint | undefined,
): number {
  let total = 0;
  for (const rule of rules) {
    if (rule.type === 'family-coverage') {
      continue;
    }
    const minCount = rule.type === 'appears' ? rule.minCount ?? 1 : 1;
    const techniques = rule.type === 'appears'
      ? getAvailableAppearsTechniques(rule, knownTechniques, allowed, forbidden, policy, score)
      : rule.techniques.filter((technique) => knownTechniques.has(technique) && allowed.has(technique) && !forbidden.has(technique));
    if (techniques.length === 0) {
      continue;
    }
    const minTechniqueScore = Math.min(...techniques.map((technique) => policy.techniqueScores[technique] ?? 0));
    total += minTechniqueScore * minCount;
  }
  return total;
}

function estimateDifficulty(
  score: ScoreConstraint | undefined,
  allowed: Set<TechniqueId>,
  policy: RatingPolicy,
): GenerationRequestAnalysis['estimatedDifficulty'] {
  if (allowed.size === 0) {
    return 'very-high';
  }
  const scoreMin = score?.min ?? score?.target ?? 0;
  const maxAllowedScore = Math.max(...Array.from(allowed).map((technique) => policy.techniqueScores[technique] ?? 0));
  if (scoreMin >= 3000 || maxAllowedScore >= 150) {
    return 'very-high';
  }
  if (scoreMin >= 1800 || maxAllowedScore >= 100) {
    return 'high';
  }
  if (scoreMin >= 800 || maxAllowedScore >= 50) {
    return 'medium';
  }
  return 'low';
}

function buildGeneratedPuzzle(
  puzzle: Board,
  solution: Board,
  seed: number,
  rated: ReturnType<typeof rate>,
  canonicalize: boolean,
): GeneratedPuzzle {
  const pair = canonicalize ? canonicalizePair(puzzle, solution) : null;
  const generated: GeneratedPuzzle = {
    puzzle: pair?.board ?? puzzle,
    solution: pair?.solution ?? solution,
    seed,
    clueCount: puzzle.filter((value) => value !== 0).length,
    solved: rated.solved,
    score: rated.score,
    grade: rated.grade,
    hardestTechnique: rated.hardestTechnique,
    techniqueCounts: rated.techniqueCounts,
  };
  if (rated.stuckReason) {
    generated.stuckReason = rated.stuckReason;
  }
  if (pair) {
    generated.canonicalKey = pair.key;
  }
  return generated;
}

function withBestCandidate(
  result: Omit<GenerationResult, 'puzzle' | 'bestCandidate'>,
  puzzle: GeneratedPuzzle | undefined,
): GenerationResult {
  if (!puzzle) {
    return result;
  }
  return {
    ...result,
    bestCandidate: puzzle,
  };
}

function matchesConstraints(candidate: GeneratedPuzzle, constraints: GenerationConstraint): string | null {
  if (!candidate.solved) {
    return 'unsolved-by-rating-policy';
  }
  if (
    typeof constraints.score?.target === 'number'
    && typeof constraints.score?.tolerance === 'number'
    && candidate.score < Math.max(0, constraints.score.target - constraints.score.tolerance)
  ) {
    return 'score-too-low';
  }
  if (
    typeof constraints.score?.target === 'number'
    && typeof constraints.score?.tolerance === 'number'
    && candidate.score > constraints.score.target + constraints.score.tolerance
  ) {
    return 'score-too-high';
  }
  if (typeof constraints.score?.min === 'number' && candidate.score < constraints.score.min) {
    return 'score-too-low';
  }
  if (typeof constraints.score?.max === 'number' && candidate.score > constraints.score.max) {
    return 'score-too-high';
  }
  if (typeof constraints.clues?.min === 'number' && candidate.clueCount < constraints.clues.min) {
    return 'clue-count-too-low';
  }
  if (typeof constraints.clues?.max === 'number' && candidate.clueCount > constraints.clues.max) {
    return 'clue-count-too-high';
  }
  if (typeof constraints.clues?.target === 'number' && candidate.clueCount !== constraints.clues.target) {
    return 'clue-count-target-mismatch';
  }
  const techniqueCounts = candidate.techniqueCounts ?? {};
  for (const technique of constraints.forbiddenTechniques ?? []) {
    if ((techniqueCounts[technique] ?? 0) > 0) {
      return 'uses-forbidden-technique';
    }
  }
  for (const rule of constraints.requiredTechniques ?? []) {
    if (rule.type === 'appears') {
      const minCount = rule.minCount ?? 1;
      const matched = rule.techniques.some((technique) => (techniqueCounts[technique] ?? 0) >= minCount);
      if (!matched) {
        return 'missing-required-technique';
      }
    }
    if (rule.type === 'hardest-in') {
      if (!candidate.hardestTechnique || !rule.techniques.includes(candidate.hardestTechnique)) {
        return 'hardest-technique-not-allowed';
      }
    }
    if (rule.type === 'family-coverage') {
      const usedFamilies = new Set(
        Object.keys(techniqueCounts)
          .filter((technique) => (techniqueCounts[technique as TechniqueId] ?? 0) > 0)
          .map((technique) => techniqueFamilies.get(technique as TechniqueId)),
      );
      const matched = rule.families.every((family) => usedFamilies.has(family));
      if (!matched) {
        return 'missing-required-family';
      }
    }
  }
  return null;
}

function chooseBetterCandidate(
  current: GeneratedPuzzle | undefined,
  next: GeneratedPuzzle,
  constraints: GenerationConstraint,
): GeneratedPuzzle {
  if (!current) {
    return next;
  }

  if (current.solved !== next.solved) {
    return next.solved ? next : current;
  }

  const targetScore = constraints.score?.target ?? constraints.score?.min ?? constraints.score?.max ?? next.score;
  const currentDistance = Math.abs(current.score - targetScore);
  const nextDistance = Math.abs(next.score - targetScore);
  if (nextDistance !== currentDistance) {
    return nextDistance < currentDistance ? next : current;
  }

  const targetClues = constraints.clues?.target ?? constraints.clues?.min ?? constraints.clues?.max ?? next.clueCount;
  const currentClueDistance = Math.abs(current.clueCount - targetClues);
  const nextClueDistance = Math.abs(next.clueCount - targetClues);
  if (nextClueDistance !== currentClueDistance) {
    return nextClueDistance < currentClueDistance ? next : current;
  }

  const currentPreferredHits = countPreferredHits(current, constraints);
  const nextPreferredHits = countPreferredHits(next, constraints);
  if (nextPreferredHits !== currentPreferredHits) {
    return nextPreferredHits > currentPreferredHits ? next : current;
  }

  return next.score > current.score ? next : current;
}

function firstRejectReason(result: GenerationResult): string {
  const first = Object.entries(result.diagnostics.rejectedByReason)[0];
  if (first) {
    return first[0];
  }
  return result.status;
}

function findScoreBucket(
  buckets: CandidateSelectionPlan['scoreBuckets'],
  score: number,
): number {
  if (!buckets) {
    return -1;
  }
  return buckets.findIndex((bucket) => score >= bucket.min && score <= bucket.max);
}

function recordAccepted(summary: SearchSummary, puzzle: GeneratedPuzzle, bucketSize: number): void {
  const normalizedBucketSize = Math.max(1, Math.trunc(bucketSize));
  const bucketStart = Math.floor(puzzle.score / normalizedBucketSize) * normalizedBucketSize;
  const bucketEnd = bucketStart + normalizedBucketSize - 1;
  const bucketKey = `${bucketStart}-${bucketEnd}`;
  summary.scoreBuckets[bucketKey] = (summary.scoreBuckets[bucketKey] ?? 0) + 1;
  summary.bestScore = summary.bestScore === null ? puzzle.score : Math.max(summary.bestScore, puzzle.score);
  summary.worstScore = summary.worstScore === null ? puzzle.score : Math.min(summary.worstScore, puzzle.score);

  for (const [technique, count] of Object.entries(puzzle.techniqueCounts)) {
    const id = technique as TechniqueId;
    summary.techniqueHits[id] = (summary.techniqueHits[id] ?? 0) + count;
  }
}

function recordRejected(summary: SearchSummary, reason: string): void {
  summary.rejectedByReason[reason] = (summary.rejectedByReason[reason] ?? 0) + 1;
}

function buildPolicyForConstraints(policy: RatingPolicy, constraints: GenerationConstraint): RatingPolicy {
  const forbidden = new Set(constraints.forbiddenTechniques ?? []);
  const allowedFilter = (technique: TechniqueId): boolean => (
    !forbidden.has(technique)
    && (!constraints.allowedTechniques || constraints.allowedTechniques.includes(technique))
  );
  const allowedPrimary = policy.techniqueOrder.filter(allowedFilter);
  const allowedFallback = (policy.fallbackTechniques ?? []).filter(allowedFilter);
  const allowed = [...allowedPrimary, ...allowedFallback];
  const preferred = constraints.preferredTechniques
    ? constraints.preferredTechniques.filter((technique) => allowed.includes(technique))
    : [];
  const preferredPrimary = preferred.filter((technique) => allowedPrimary.includes(technique));
  const preferredFallback = preferred.filter((technique) => allowedFallback.includes(technique));
  const remainingFallback = allowedFallback.filter((technique) => !preferredFallback.includes(technique));
  const techniqueOrder = allowedPrimary.length > 0
    ? [
      ...preferredPrimary,
      ...preferredFallback,
      ...allowedPrimary.filter((technique) => !preferredPrimary.includes(technique)),
    ]
    : [...preferredFallback, ...remainingFallback];
  const constrainedPolicy: RatingPolicy = {
    ...policy,
    techniqueOrder,
    techniqueScores: { ...policy.techniqueScores },
  };
  if (policy.gradeRules) {
    constrainedPolicy.gradeRules = policy.gradeRules.map((rule) => ({
      ...rule,
      ...(rule.allowedTechniques ? { allowedTechniques: rule.allowedTechniques.filter((technique) => allowed.includes(technique)) } : {}),
    }));
  }
  if (allowedPrimary.length > 0 && remainingFallback.length > 0) {
    constrainedPolicy.fallbackTechniques = remainingFallback;
  } else {
    delete constrainedPolicy.fallbackTechniques;
  }
  return constrainedPolicy;
}

function countPreferredHits(candidate: GeneratedPuzzle, constraints: GenerationConstraint): number {
  return countPreferredTechniqueHits(candidate, constraints.preferredTechniques);
}

function countPreferredTechniqueHits(candidate: GeneratedPuzzle, preferredTechniques: TechniqueId[] | undefined): number {
  let count = 0;
  for (const technique of preferredTechniques ?? []) {
    count += candidate.techniqueCounts?.[technique] ?? 0;
  }
  return count;
}
