import { cloneBoard } from '../core/grid.js';
import type { Board } from '../core/types.js';
import { normalizeState, type StateInput } from '../state/index.js';
import { SolverContext } from './context.js';
import { buildDefaultTechniques, getTechniqueDefinitions } from './techniques.js';
import type { SolveAnalysis, SolveOptions, SolveStep, SolverTechnique, TechniqueId } from './types.js';

export { SolverContext } from './context.js';
export { getTechniqueDefinitions } from './techniques.js';
export type {
  SolveAnalysis,
  SolveOptions,
  SolveStep,
  SolverTechnique,
  StepAction,
  StepEvidence,
  TechniqueDefinition,
  TechniqueId,
} from './types.js';

export function nextStep(input: StateInput, options?: SolveOptions): SolveStep | null {
  const context = new SolverContext(normalizeState(input));
  return findNextStep(context, buildTechniquePipeline(options));
}

export function walkthrough(input: StateInput, options?: SolveOptions): SolveAnalysis {
  const normalized = normalizeState(input);
  const context = new SolverContext(normalized);
  const techniques = buildTechniquePipeline(options);
  const steps: SolveStep[] = [];
  const maxSteps = options?.maxSteps ?? 512;
  let score = 0;
  let hardestTechnique: TechniqueId | null = null;
  let hardestScore = -1;

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

export function replaySteps(input: StateInput, steps: readonly SolveStep[]): Board {
  const context = new SolverContext(normalizeState(input));
  for (const step of steps) {
    context.applyStep(step);
  }
  return cloneBoard(context.board);
}

function buildTechniquePipeline(options?: SolveOptions): SolverTechnique[] {
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
  if (!options?.preferredTechniques) {
    return techniques;
  }
  const preferred = new Map(options.preferredTechniques.map((technique, index) => [technique, index]));
  const preferredTechniques = [...techniques]
    .filter((technique) => preferred.has(technique.id))
    .sort((left, right) => preferred.get(left.id)! - preferred.get(right.id)!);
  const preferredIds = new Set(preferredTechniques.map((technique) => technique.id));
  return [
    ...preferredTechniques,
    ...techniques.filter((technique) => !preferredIds.has(technique.id)),
  ];
}

function findNextStep(context: SolverContext, techniques: SolverTechnique[]): SolveStep | null {
  for (const technique of techniques) {
    const step = technique.find(context);
    if (step) {
      return step;
    }
  }
  return null;
}
