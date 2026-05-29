import { ALL_HOUSES, CELL_TO_PEERS, cloneBoard, getHouseCells } from '../core/grid.js';
import type { Board } from '../core/types.js';
import { normalizeState, type StateInput } from '../state/index.js';
import { SolverContext } from './context.js';
import { buildDefaultTechniques, getTechniqueDefinitions } from './techniques.js';
import type {
  AnalyzeSolveOptions,
  AnalyzeSolveResult,
  FindStepsOptions,
  FindStepsResult,
  SolveAnalysis,
  SolveOptions,
  SolveStep,
  SolveStepScenario,
  SolverUsageReport,
  SolverTechnique,
  TechniqueUsageStats,
  TechniqueId,
} from './types.js';
export { verifyStep, verifyWalkthrough } from './verify.js';

export { applyStepAction, SolverContext } from './context.js';
export { getTechniqueDefinitions } from './techniques.js';
export type {
  AnalyzeSolveOptions,
  AnalyzeSolveResult,
  FindStepsDiagnostics,
  FindStepsOptions,
  FindStepsResult,
  SolveAnalysis,
  SolveOptions,
  SolveStep,
  SolveStepScenario,
  SolverUsageReport,
  SolverTechnique,
  StepAction,
  StepEvidence,
  StepVerificationIssue,
  StepVerificationIssueCode,
  StepVerificationMode,
  StepVerificationOptions,
  StepVerificationResult,
  TechniqueUsageStats,
  TechniqueDefinition,
  TechniqueId,
  WalkthroughVerificationResult,
} from './types.js';

export function nextStep(input: StateInput, options?: SolveOptions): SolveStep | null {
  const normalized = normalizeState(input);
  const context = new SolverContext(normalized);
  if (countBlockingInitialContradictions(normalized, options) > 0) {
    return null;
  }
  return findNextStep(context, buildTechniquePipeline(options));
}

export function findSteps(input: StateInput, options: FindStepsOptions = {}): FindStepsResult {
  const startedAt = Date.now();
  const normalized = normalizeState(input);
  const context = new SolverContext(normalized);
  const initialContradictions = countBlockingInitialContradictions(normalized, options);
  if (initialContradictions > 0) {
    return {
      steps: [],
      ...(options.includeDiagnostics ? {
        diagnostics: {
          techniquesTried: [],
          techniqueCalls: {},
          techniqueHits: {},
          initialContradictions,
          stuckReason: 'contradiction',
          elapsedMs: Date.now() - startedAt,
        },
      } : {}),
    };
  }
  const pipeline = buildTechniquePipeline(options);
  const steps: SolveStep[] = [];
  const techniquesTried: TechniqueId[] = [];
  const techniqueCalls: Partial<Record<TechniqueId, number>> = {};
  const techniqueHits: Partial<Record<TechniqueId, number>> = {};
  const limit = normalizePositiveInteger(options.limit);
  const canShortCircuit = options.sort === undefined || options.sort === 'pipeline';

  scanFindStepsTechniques(pipeline.primary, context, steps, techniquesTried, techniqueCalls, techniqueHits, canShortCircuit, limit);
  if (steps.length === 0) {
    scanFindStepsTechniques(pipeline.fallback, context, steps, techniquesTried, techniqueCalls, techniqueHits, canShortCircuit, limit);
  }

  const sortedSteps = sortFoundSteps(steps, options.sort ?? 'pipeline');
  const limitedSteps = limit === null ? sortedSteps : sortedSteps.slice(0, limit);
  return {
    steps: limitedSteps,
    ...(options.includeDiagnostics ? {
      diagnostics: {
        techniquesTried,
        techniqueCalls,
        techniqueHits,
        elapsedMs: Date.now() - startedAt,
      },
    } : {}),
  };
}

function scanFindStepsTechniques(
  techniques: readonly SolverTechnique[],
  context: SolverContext,
  steps: SolveStep[],
  techniquesTried: TechniqueId[],
  techniqueCalls: Partial<Record<TechniqueId, number>>,
  techniqueHits: Partial<Record<TechniqueId, number>>,
  canShortCircuit: boolean,
  limit: number | null,
): void {
  for (const technique of techniques) {
    techniquesTried.push(technique.id);
    techniqueCalls[technique.id] = (techniqueCalls[technique.id] ?? 0) + 1;
    const step = technique.find(context);
    if (!step || !isApplicableStep(context, step)) {
      continue;
    }
    techniqueHits[technique.id] = (techniqueHits[technique.id] ?? 0) + 1;
    steps.push(step);
    if (canShortCircuit && limit !== null && steps.length >= limit) {
      break;
    }
  }
}

export function walkthrough(input: StateInput, options?: SolveOptions): SolveAnalysis {
  const normalized = normalizeState(input);
  const context = new SolverContext(normalized);
  const techniques = buildTechniquePipeline(options);
  const steps: SolveStep[] = [];
  const maxSteps = normalizeMaxSteps(options?.maxSteps);
  let score = 0;
  let hardestTechnique: TechniqueId | null = null;
  let hardestScore = -1;

  if (countBlockingInitialContradictions(normalized, options) > 0) {
    return {
      solved: false,
      steps,
      score,
      hardestTechnique,
      candidates: [...context.candidates],
      stuckReason: 'contradiction',
    };
  }

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    if (context.isSolved()) {
      return {
        solved: true,
        steps,
        score,
        hardestTechnique,
        candidates: [...context.candidates],
      };
    }
    if (context.hasContradiction()) {
      return {
        solved: false,
        steps,
        score,
        hardestTechnique,
        candidates: [...context.candidates],
        stuckReason: 'contradiction',
      };
    }
    const step = findNextStep(context, techniques);
    if (!step) {
      return {
        solved: false,
        steps,
        score,
        hardestTechnique,
        candidates: [...context.candidates],
        stuckReason: 'no-technique-match',
      };
    }
    steps.push(step);
    score += step.score;
    if (step.score > hardestScore) {
      hardestScore = step.score;
      hardestTechnique = step.technique;
    }
    context.applyStep(step);
  }

  return {
    solved: false,
    steps,
    score,
    hardestTechnique,
    candidates: [...context.candidates],
    stuckReason: 'step-limit',
  };
}

export function analyzeSolve(input: StateInput, options: AnalyzeSolveOptions = {}): AnalyzeSolveResult {
  const startedAt = Date.now();
  const normalized = normalizeState(input);
  const context = new SolverContext(normalized);
  const techniques = buildTechniquePipeline(options);
  const steps: SolveStep[] = [];
  const maxSteps = normalizeMaxSteps(options.maxSteps);
  const usage = createUsageReport();
  let score = 0;
  let hardestTechnique: TechniqueId | null = null;
  let hardestScore = -1;

  if (countBlockingInitialContradictions(normalized, options) > 0) {
    usage.totalElapsedMs = Date.now() - startedAt;
    return attachUsage({
      solved: false,
      steps,
      score,
      hardestTechnique,
      candidates: [...context.candidates],
      stuckReason: 'contradiction',
    }, usage, options);
  }

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    if (context.isSolved()) {
      usage.totalElapsedMs = Date.now() - startedAt;
      return attachUsage({
        solved: true,
        steps,
        score,
        hardestTechnique,
        candidates: [...context.candidates],
      }, usage, options);
    }
    if (context.hasContradiction()) {
      usage.totalElapsedMs = Date.now() - startedAt;
      return attachUsage({
        solved: false,
        steps,
        score,
        hardestTechnique,
        candidates: [...context.candidates],
        stuckReason: 'contradiction',
      }, usage, options);
    }
    const step = findNextStepWithUsage(context, techniques, usage);
    if (!step) {
      usage.totalElapsedMs = Date.now() - startedAt;
      return attachUsage({
        solved: false,
        steps,
        score,
        hardestTechnique,
        candidates: [...context.candidates],
        stuckReason: 'no-technique-match',
      }, usage, options);
    }
    steps.push(step);
    score += step.score;
    if (step.score > hardestScore) {
      hardestScore = step.score;
      hardestTechnique = step.technique;
    }
    context.applyStep(step);
  }

  usage.totalElapsedMs = Date.now() - startedAt;
  return attachUsage({
    solved: false,
    steps,
    score,
    hardestTechnique,
    candidates: [...context.candidates],
    stuckReason: 'step-limit',
  }, usage, options);
}

export function findTechniqueScenario(
  input: StateInput,
  targetTechniques: readonly TechniqueId[],
  options?: SolveOptions,
): SolveStepScenario | null {
  if (targetTechniques.length === 0) {
    return null;
  }

  const normalized = normalizeState(input);
  const context = new SolverContext(normalized);
  if (countBlockingInitialContradictions(normalized, options) > 0) {
    return null;
  }
  const techniques = buildTechniquePipeline(options);
  const targetSet = new Set(targetTechniques);
  const maxSteps = normalizeMaxSteps(options?.maxSteps);

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    if (context.isSolved() || (!options?.allowContradictoryCandidateState && context.hasContradiction())) {
      return null;
    }

    const boardBefore = cloneBoard(context.board);
    const candidateMasksBefore = [...context.candidates];
    const step = findNextStep(context, techniques);
    if (!step) {
      return null;
    }

    context.applyStep(step);

    if (targetSet.has(step.technique)) {
      return {
        stepNumber: stepIndex + 1,
        step,
        boardBefore,
        boardAfter: cloneBoard(context.board),
        candidateMasksBefore,
        candidateMasksAfter: [...context.candidates],
      };
    }
  }

  return null;
}

export function replaySteps(input: StateInput, steps: readonly SolveStep[]): Board {
  const context = new SolverContext(normalizeState(input));
  for (const step of steps) {
    context.applyStep(step);
  }
  return cloneBoard(context.board);
}

interface TechniquePipeline {
  primary: SolverTechnique[];
  fallback: SolverTechnique[];
}

const DEFAULT_FALLBACK_TECHNIQUES: TechniqueId[] = [
  'bowmans-bingo',
  'forcing-nets',
  'digit-forcing-chains',
  'cell-forcing-chains',
  'unit-forcing-chains',
];

function buildTechniquePipeline(options?: SolveOptions): TechniquePipeline {
  const definitionsById = new Map(getTechniqueDefinitions().map((definition) => [definition.id, definition]));
  const allowed = options?.allowedTechniques ? new Set(options.allowedTechniques) : null;
  const techniques = buildDefaultTechniques().filter((technique) => {
    const definition = definitionsById.get(technique.id);
    if (!definition) {
      return false;
    }
    if (allowed) {
      return allowed.has(technique.id);
    }
    return definition.stability === 'stable';
  });
  const explicitlyPreferred = new Set(options?.preferredTechniques ?? []);
  const fallbackOrder = options?.fallbackTechniques ?? DEFAULT_FALLBACK_TECHNIQUES;
  const fallbackIds = new Set(fallbackOrder.filter((technique) => !explicitlyPreferred.has(technique)));
  return {
    primary: reorderTechniques(
      techniques.filter((technique) => !fallbackIds.has(technique.id)),
      options?.preferredTechniques,
    ),
    fallback: reorderTechniques(
      techniques.filter((technique) => fallbackIds.has(technique.id)),
      fallbackOrder,
    ),
  };
}

function reorderTechniques(
  techniques: readonly SolverTechnique[],
  preferredOrder?: readonly TechniqueId[],
): SolverTechnique[] {
  if (!preferredOrder || preferredOrder.length === 0) {
    return [...techniques];
  }
  const preferred = new Map(preferredOrder.map((technique, index) => [technique, index]));
  const preferredTechniques = [...techniques]
    .filter((technique) => preferred.has(technique.id))
    .sort((left, right) => preferred.get(left.id)! - preferred.get(right.id)!);
  const preferredIds = new Set(preferredTechniques.map((technique) => technique.id));
  return [
    ...preferredTechniques,
    ...techniques.filter((technique) => !preferredIds.has(technique.id)),
  ];
}

function findNextStep(context: SolverContext, pipeline: TechniquePipeline): SolveStep | null {
  for (const technique of pipeline.primary) {
    const step = technique.find(context);
    if (step && isApplicableStep(context, step)) {
      return step;
    }
  }
  for (const technique of pipeline.fallback) {
    const step = technique.find(context);
    if (step && isApplicableStep(context, step)) {
      return step;
    }
  }
  return null;
}

function findNextStepWithUsage(
  context: SolverContext,
  pipeline: TechniquePipeline,
  usage: SolverUsageReport,
): SolveStep | null {
  const techniques = [...pipeline.primary, ...pipeline.fallback];
  for (const technique of techniques) {
    const techniqueUsage = getTechniqueUsage(usage, technique.id);
    techniqueUsage.calls += 1;
    usage.totalCalls += 1;
    const startedAt = Date.now();
    const step = technique.find(context);
    techniqueUsage.elapsedMs += Date.now() - startedAt;
    if (!step || !isApplicableStep(context, step)) {
      continue;
    }
    const placements = step.actions.filter((action) => action.type === 'place').length;
    const eliminations = step.actions.filter((action) => action.type === 'eliminate').length;
    techniqueUsage.hits += 1;
    techniqueUsage.placements += placements;
    techniqueUsage.eliminations += eliminations;
    techniqueUsage.actions += step.actions.length;
    techniqueUsage.totalScore += step.score;
    techniqueUsage.maxScore = Math.max(techniqueUsage.maxScore, step.score);
    usage.totalHits += 1;
    usage.totalPlacements += placements;
    usage.totalEliminations += eliminations;
    return step;
  }
  return null;
}

function createUsageReport(): SolverUsageReport {
  return {
    totalElapsedMs: 0,
    totalCalls: 0,
    totalHits: 0,
    totalPlacements: 0,
    totalEliminations: 0,
    byTechnique: {},
  };
}

function isApplicableStep(context: SolverContext, step: SolveStep): boolean {
  try {
    const draft = context.clone();
    draft.applyStep(step);
    return true;
  } catch {
    return false;
  }
}

function getTechniqueUsage(usage: SolverUsageReport, technique: TechniqueId): TechniqueUsageStats {
  const existing = usage.byTechnique[technique];
  if (existing) {
    return existing;
  }
  const created: TechniqueUsageStats = {
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
  usage.byTechnique[technique] = created;
  return created;
}

function attachUsage(
  analysis: SolveAnalysis,
  usage: SolverUsageReport,
  options: AnalyzeSolveOptions,
): AnalyzeSolveResult {
  return {
    ...analysis,
    ...(options.includeUsage ? { usage } : {}),
  };
}

function countBlockingInitialContradictions(normalized: ReturnType<typeof normalizeState>, options?: SolveOptions): number {
  const filledValueConflict = hasFilledValueConflict(normalized.board) ? 1 : 0;
  if (options?.allowContradictoryCandidateState) {
    const structuralContradictions = normalized.contradictions.filter((contradiction) => (
      contradiction.type === 'invalid-board-length'
      || contradiction.type === 'invalid-board-value'
      || contradiction.type === 'invalid-constraint'
      || (
        contradiction.type === 'illegal-candidate'
        && contradiction.source === 'candidateMasks'
        && typeof contradiction.cell === 'number'
        && hasIllegalCandidateConflictingWithFilledPeer(normalized.board, normalized.candidates[contradiction.cell] ?? 0, contradiction.cell)
      )
    )).length;
    return structuralContradictions + filledValueConflict;
  }
  return normalized.contradictions.length + filledValueConflict;
}

function hasIllegalCandidateConflictingWithFilledPeer(board: Board, mask: number, cell: number): boolean {
  for (const peer of CELL_TO_PEERS[cell] ?? []) {
    const value = board[peer] ?? 0;
    if (value > 0 && (mask & (1 << (value - 1))) !== 0) {
      return true;
    }
  }
  return false;
}

function hasFilledValueConflict(board: Board): boolean {
  for (const house of ALL_HOUSES) {
    const seen = new Set<number>();
    for (const cell of getHouseCells(house)) {
      const value = board[cell] ?? 0;
      if (value < 1 || value > 9) {
        continue;
      }
      if (seen.has(value)) {
        return true;
      }
      seen.add(value);
    }
  }
  return false;
}

function normalizePositiveInteger(value: number | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('findSteps limit 必须是正整数。');
  }
  return value;
}

function normalizeMaxSteps(value: number | undefined): number {
  if (value === undefined) {
    return 512;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('maxSteps 必须是正整数。');
  }
  return value;
}

function sortFoundSteps(steps: SolveStep[], sort: FindStepsOptions['sort']): SolveStep[] {
  if (sort === 'score-desc') {
    return [...steps].sort((left, right) => right.score - left.score || compareStepCanonical(left, right));
  }
  if (sort === 'action-count-desc') {
    return [...steps].sort((left, right) => right.actions.length - left.actions.length || compareStepCanonical(left, right));
  }
  if (sort === 'canonical') {
    return [...steps].sort(compareStepCanonical);
  }
  return steps;
}

function compareStepCanonical(left: SolveStep, right: SolveStep): number {
  const byTechnique = left.technique.localeCompare(right.technique);
  if (byTechnique !== 0) {
    return byTechnique;
  }
  return canonicalStepKey(left).localeCompare(canonicalStepKey(right));
}

function canonicalStepKey(step: SolveStep): string {
  return step.actions
    .map((action) => `${action.type}:${action.cell}:${action.digit}`)
    .sort()
    .join('|');
}
