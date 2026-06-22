import type { RatingResult } from '../rating/index.js';
import type { SolveAnalysis, SolveStep, TechniqueId } from '../solver/types.js';

export interface CompactAnalysis {
  solved: boolean;
  score: number;
  grade?: string | null;
  hardestTechnique: TechniqueId | null;
  hardestScore?: number;
  stepCount: number;
  actionCount: number;
  placementCount: number;
  eliminationCount: number;
  techniqueCounts: Partial<Record<TechniqueId, number>>;
  stuckReason?: SolveAnalysis['stuckReason'];
  ratingPolicyId?: string;
  ratingPolicyVersion?: string;
}

export function summarizeAnalysis(analysis: SolveAnalysis): CompactAnalysis {
  const steps = summarizeSteps(analysis.steps, analysis.hardestTechnique);
  return {
    solved: analysis.solved,
    score: analysis.score,
    hardestTechnique: steps.hardestTechnique,
    ...(steps.hardestScore !== null ? { hardestScore: steps.hardestScore } : {}),
    stepCount: analysis.steps.length,
    actionCount: steps.actionCount,
    placementCount: steps.placementCount,
    eliminationCount: steps.eliminationCount,
    techniqueCounts: steps.techniqueCounts,
    ...(analysis.stuckReason ? { stuckReason: analysis.stuckReason } : {}),
  };
}

export function summarizeRating(result: RatingResult): CompactAnalysis {
  const steps = summarizeSteps(result.steps, result.hardestTechnique);
  return {
    solved: result.solved,
    score: result.score,
    grade: result.grade,
    hardestTechnique: result.hardestTechnique,
    hardestScore: result.hardestScore,
    stepCount: result.steps.length,
    actionCount: steps.actionCount,
    placementCount: steps.placementCount,
    eliminationCount: steps.eliminationCount,
    techniqueCounts: { ...result.techniqueCounts },
    ...(result.stuckReason ? { stuckReason: result.stuckReason } : {}),
    ratingPolicyId: result.ratingPolicyId,
    ratingPolicyVersion: result.ratingPolicyVersion,
  };
}

function summarizeSteps(
  steps: readonly SolveStep[],
  initialHardestTechnique: TechniqueId | null,
): {
  hardestTechnique: TechniqueId | null;
  hardestScore: number | null;
  actionCount: number;
  placementCount: number;
  eliminationCount: number;
  techniqueCounts: Partial<Record<TechniqueId, number>>;
} {
  const techniqueCounts: Partial<Record<TechniqueId, number>> = {};
  let actionCount = 0;
  let placementCount = 0;
  let eliminationCount = 0;
  let hardestScore = -1;
  let hardestTechnique: TechniqueId | null = initialHardestTechnique;

  for (const step of steps) {
    techniqueCounts[step.technique] = (techniqueCounts[step.technique] ?? 0) + 1;
    actionCount += step.actions.length;
    placementCount += step.actions.filter((action) => action.type === 'place').length;
    eliminationCount += step.actions.filter((action) => action.type === 'eliminate').length;
    if (step.score > hardestScore) {
      hardestScore = step.score;
      hardestTechnique = step.technique;
    }
  }

  return {
    hardestTechnique,
    hardestScore: hardestScore >= 0 ? hardestScore : null,
    actionCount,
    placementCount,
    eliminationCount,
    techniqueCounts,
  };
}
