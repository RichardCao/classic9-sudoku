import { walkthrough } from '../solver/index.js';
import { buildDefaultTechniques, getTechniqueDefinitions } from '../solver/techniques.js';
import type { SolveAnalysis, TechniqueId } from '../solver/types.js';
import type { StateInput } from '../state/index.js';

export interface GradeRule {
  grade: string;
  minScore?: number;
  maxScore?: number;
  allowedTechniques?: TechniqueId[];
}

export interface RatingPolicy {
  id: string;
  version: string;
  techniqueOrder: TechniqueId[];
  techniqueScores: Record<TechniqueId, number>;
  maxSteps?: number;
  gradeRules?: GradeRule[];
}

export interface RatingResult {
  solved: boolean;
  score: number;
  grade: string | null;
  hardestTechnique: TechniqueId | null;
  hardestScore: number;
  techniqueCounts: Partial<Record<TechniqueId, number>>;
  steps: SolveAnalysis['steps'];
  stuckReason?: SolveAnalysis['stuckReason'];
  ratingPolicyId: string;
  ratingPolicyVersion: string;
}

const definitionScores = Object.fromEntries(
  getTechniqueDefinitions().map((definition) => [definition.id, definition.defaultScore]),
) as Record<TechniqueId, number>;

const definitionById = new Map(getTechniqueDefinitions().map((definition) => [definition.id, definition]));

export const CLASSIC_STABLE_TECHNIQUE_ORDER: TechniqueId[] = buildDefaultTechniques()
  .map((technique) => technique.id)
  .filter((id) => definitionById.get(id)?.stability === 'stable');

export const CLASSIC_STABLE_POLICY: RatingPolicy = {
  id: 'classic-stable',
  version: '1',
  techniqueOrder: CLASSIC_STABLE_TECHNIQUE_ORDER,
  techniqueScores: definitionScores,
  maxSteps: 512,
  gradeRules: [
    {
      grade: 'basic',
      maxScore: 1300,
      allowedTechniques: ['full-house', 'naked-single', 'hidden-single'],
    },
    {
      grade: 'normal',
      minScore: 0,
      maxScore: 2200,
      allowedTechniques: [
        'full-house',
        'naked-single',
        'hidden-single',
        'locked-candidates',
        'naked-pair',
        'hidden-pair',
        'naked-triple',
        'hidden-triple',
      ],
    },
    {
      grade: 'hard',
      minScore: 0,
      maxScore: 3200,
      allowedTechniques: [
        'full-house',
        'naked-single',
        'hidden-single',
        'locked-candidates',
        'naked-pair',
        'hidden-pair',
        'naked-triple',
        'hidden-triple',
        'naked-quad',
        'hidden-quad',
        'x-wing',
        'swordfish',
        'franken-swordfish',
        'jellyfish',
        'finned-x-wing',
        'finned-swordfish',
        'finned-jellyfish',
        'sashimi-swordfish',
        'sashimi-jellyfish',
        'xy-wing',
        'xyz-wing',
        'wxyz-wing',
        'w-wing',
        'chute-remote-pairs',
        'almost-locked-pair',
        'almost-locked-triple',
        'als-xz',
        'als-xy-wing',
        'aic-als',
        'fireworks',
        'twinned-xy-chains',
        'sue-de-coq',
        'death-blossom',
        'aligned-pair-exclusion',
        'exocet',
        'double-exocet',
        'pattern-overlay',
        'tridagons',
        'sk-loops',
        'simple-coloring',
        'three-d-medusa',
        'grouped-x-cycles',
        'grouped-aic',
        'x-chain',
        'multi-colors',
        'xy-chain',
        'aic',
        'aic-exotic',
        'skyscraper',
        'two-string-kite',
        'turbot-fish',
        'empty-rectangle',
        'unique-rectangle',
        'avoidable-rectangle',
        'rectangle-elimination',
        'extended-rectangle',
        'hidden-unique-rectangle',
        'aic-ur',
        'bug-plus-one',
      ],
    },
  ],
};

export function getDefaultRatingPolicy(): RatingPolicy {
  return clonePolicy(CLASSIC_STABLE_POLICY);
}

export function rate(input: StateInput, policy: RatingPolicy = CLASSIC_STABLE_POLICY): RatingResult {
  const solveOptions = {
    allowedTechniques: policy.techniqueOrder,
    preferredTechniques: policy.techniqueOrder,
    ...(typeof policy.maxSteps === 'number' ? { maxSteps: policy.maxSteps } : {}),
  };
  const analysis = walkthrough(input, solveOptions);
  const techniqueCounts: Partial<Record<TechniqueId, number>> = {};
  let score = 0;
  let hardestTechnique: TechniqueId | null = null;
  let hardestScore = -1;

  for (const step of analysis.steps) {
    const stepScore = policy.techniqueScores[step.technique] ?? step.score;
    score += stepScore;
    techniqueCounts[step.technique] = (techniqueCounts[step.technique] ?? 0) + 1;
    if (stepScore > hardestScore) {
      hardestScore = stepScore;
      hardestTechnique = step.technique;
    }
  }

  return {
    solved: analysis.solved,
    score,
    grade: resolveGrade(score, techniqueCounts, policy),
    hardestTechnique,
    hardestScore: hardestScore < 0 ? 0 : hardestScore,
    techniqueCounts,
    steps: analysis.steps.map((step) => ({
      ...step,
      score: policy.techniqueScores[step.technique] ?? step.score,
    })),
    stuckReason: analysis.stuckReason,
    ratingPolicyId: policy.id,
    ratingPolicyVersion: policy.version,
  };
}

function resolveGrade(
  score: number,
  techniqueCounts: Partial<Record<TechniqueId, number>>,
  policy: RatingPolicy,
): string | null {
  for (const rule of policy.gradeRules ?? []) {
    if (typeof rule.minScore === 'number' && score < rule.minScore) {
      continue;
    }
    if (typeof rule.maxScore === 'number' && score > rule.maxScore) {
      continue;
    }
    if (rule.allowedTechniques) {
      const allowed = new Set(rule.allowedTechniques);
      const usesOnlyAllowed = Object.keys(techniqueCounts)
        .every((technique) => allowed.has(technique as TechniqueId));
      if (!usesOnlyAllowed) {
        continue;
      }
    }
    return rule.grade;
  }
  return null;
}

function clonePolicy(policy: RatingPolicy): RatingPolicy {
  const clone: RatingPolicy = {
    ...policy,
    techniqueOrder: [...policy.techniqueOrder],
    techniqueScores: { ...policy.techniqueScores },
  };
  if (policy.gradeRules) {
    clone.gradeRules = policy.gradeRules.map((rule) => ({
      ...rule,
      ...(rule.allowedTechniques ? { allowedTechniques: [...rule.allowedTechniques] } : {}),
    }));
  }
  return clone;
}
