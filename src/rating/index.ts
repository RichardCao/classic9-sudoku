import { walkthrough } from '../solver/index.js';
import { buildDefaultTechniques, getTechniqueDefinitions } from '../solver/techniques.js';
import type { SolveAnalysis, SolveOptions, TechniqueId } from '../solver/types.js';
import type { StateInput } from '../state/index.js';

export interface GradeRule {
  grade: string;
  minScore?: number;
  maxScore?: number;
  allowedTechniques?: readonly TechniqueId[];
}

export interface RatingPolicy {
  id: string;
  version: string;
  techniqueOrder: readonly TechniqueId[];
  fallbackTechniques?: readonly TechniqueId[];
  techniqueScores: Readonly<Record<TechniqueId, number>>;
  maxSteps?: number;
  gradeRules?: readonly GradeRule[];
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

export interface RatingPolicyValidationIssue {
  code:
    | 'invalid-rating-policy'
    | 'unknown-rating-policy-field'
    | 'invalid-rating-policy-id'
    | 'invalid-rating-policy-version'
    | 'invalid-rating-policy-technique-order'
    | 'unknown-rating-policy-technique'
    | 'invalid-rating-policy-fallback-techniques'
    | 'invalid-rating-policy-technique-scores'
    | 'invalid-rating-policy-score-coverage'
    | 'unknown-rating-policy-score-technique'
    | 'invalid-rating-policy-max-steps'
    | 'invalid-rating-policy-grade-rules'
    | 'invalid-rating-policy-grade-rule'
    | 'unknown-rating-policy-grade-rule-field'
    | 'invalid-rating-policy-grade'
    | 'invalid-rating-policy-grade-score'
    | 'invalid-rating-policy-grade-range'
    | 'invalid-rating-policy-grade-techniques';
  message: string;
  details?: Record<string, unknown>;
}

export type BuiltInRatingPolicyId = 'classic-stable' | 'classic-extended' | 'classic-galaxy';

const definitionScores = Object.fromEntries(
  getTechniqueDefinitions().map((definition) => [definition.id, definition.defaultScore]),
) as Record<TechniqueId, number>;

const definitionById = new Map(getTechniqueDefinitions().map((definition) => [definition.id, definition]));
const KNOWN_TECHNIQUE_IDS = new Set<TechniqueId>(getTechniqueDefinitions().map((definition) => definition.id));
const RATING_POLICY_FIELDS = new Set([
  'id',
  'version',
  'techniqueOrder',
  'fallbackTechniques',
  'techniqueScores',
  'maxSteps',
  'gradeRules',
]);
const GRADE_RULE_FIELDS = new Set(['grade', 'minScore', 'maxScore', 'allowedTechniques']);

export const CLASSIC_STABLE_TECHNIQUE_ORDER: readonly TechniqueId[] = Object.freeze(buildDefaultTechniques()
  .map((technique) => technique.id)
  .filter((id) => definitionById.get(id)?.stability === 'stable'));

export const CLASSIC_EXTENDED_TECHNIQUE_ORDER: readonly TechniqueId[] = Object.freeze([
  ...CLASSIC_STABLE_TECHNIQUE_ORDER,
]);

const CLASSIC_GALAXY_FALLBACK_TECHNIQUES: readonly TechniqueId[] = [
  'forcing-nets',
  'digit-forcing-chains',
  'cell-forcing-chains',
  'unit-forcing-chains',
  'table-chain',
  'bowmans-bingo',
];

export const CLASSIC_GALAXY_TECHNIQUE_ORDER: readonly TechniqueId[] = Object.freeze(buildDefaultTechniques()
  .map((technique) => technique.id)
  .filter((id) => !CLASSIC_GALAXY_FALLBACK_TECHNIQUES.includes(id)));

const CLASSIC_STABLE_POLICY_SOURCE: RatingPolicy = {
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
        'x-coloring',
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

const CLASSIC_EXTENDED_POLICY_SOURCE: RatingPolicy = {
  id: 'classic-extended',
  version: '1',
  techniqueOrder: CLASSIC_EXTENDED_TECHNIQUE_ORDER,
  fallbackTechniques: ['bowmans-bingo'],
  techniqueScores: definitionScores,
  maxSteps: 512,
  ...(CLASSIC_STABLE_POLICY_SOURCE.gradeRules ? { gradeRules: CLASSIC_STABLE_POLICY_SOURCE.gradeRules } : {}),
};

const CLASSIC_GALAXY_POLICY_SOURCE: RatingPolicy = {
  id: 'classic-galaxy',
  version: '1',
  techniqueOrder: CLASSIC_GALAXY_TECHNIQUE_ORDER,
  fallbackTechniques: CLASSIC_GALAXY_FALLBACK_TECHNIQUES,
  techniqueScores: definitionScores,
  maxSteps: 1024,
  ...(CLASSIC_STABLE_POLICY_SOURCE.gradeRules ? { gradeRules: CLASSIC_STABLE_POLICY_SOURCE.gradeRules } : {}),
};

export const CLASSIC_STABLE_POLICY: Readonly<RatingPolicy> = deepFreezePolicy(CLASSIC_STABLE_POLICY_SOURCE);
export const CLASSIC_EXTENDED_POLICY: Readonly<RatingPolicy> = deepFreezePolicy(CLASSIC_EXTENDED_POLICY_SOURCE);
export const CLASSIC_GALAXY_POLICY: Readonly<RatingPolicy> = deepFreezePolicy(CLASSIC_GALAXY_POLICY_SOURCE);

export function getDefaultRatingPolicy(): RatingPolicy {
  return clonePolicy(CLASSIC_STABLE_POLICY);
}

export function getRatingPolicy(id: BuiltInRatingPolicyId = 'classic-stable'): RatingPolicy {
  switch (id) {
    case 'classic-stable':
      return clonePolicy(CLASSIC_STABLE_POLICY);
    case 'classic-extended':
      return clonePolicy(CLASSIC_EXTENDED_POLICY);
    case 'classic-galaxy':
      return clonePolicy(CLASSIC_GALAXY_POLICY);
    default:
      throw new Error(`未知评分策略：${String(id)}`);
  }
}

export function buildSolveOptionsFromRatingPolicy(policy: RatingPolicy): SolveOptions {
  assertValidRatingPolicy(policy);
  return {
    allowedTechniques: [...policy.techniqueOrder, ...(policy.fallbackTechniques ?? [])],
    preferredTechniques: [...policy.techniqueOrder],
    ...(policy.fallbackTechniques ? { fallbackTechniques: [...policy.fallbackTechniques] } : {}),
    ...(typeof policy.maxSteps === 'number' ? { maxSteps: policy.maxSteps } : {}),
  };
}

export function rate(input: StateInput, policy: RatingPolicy = getDefaultRatingPolicy()): RatingResult {
  assertValidRatingPolicy(policy);
  const solveOptions = buildSolveOptionsFromRatingPolicy(policy);
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
    grade: analysis.solved ? resolveGrade(score, techniqueCounts, policy) : null,
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

export function validateRatingPolicy(policy: RatingPolicy | undefined): RatingPolicyValidationIssue[] {
  const errors: RatingPolicyValidationIssue[] = [];
  if (typeof policy === 'undefined') {
    errors.push({
      code: 'invalid-rating-policy',
      message: 'ratingPolicy 必须是 object。',
      details: { value: policy },
    });
    return errors;
  }
  if (!isPlainObject(policy)) {
    errors.push({
      code: 'invalid-rating-policy',
      message: 'ratingPolicy 必须是 object。',
      details: { value: policy },
    });
    return errors;
  }

  collectUnknownFields(policy, RATING_POLICY_FIELDS, 'unknown-rating-policy-field', 'ratingPolicy 包含未知字段。', errors);
  if (typeof policy.id !== 'string' || policy.id.length === 0) {
    errors.push({
      code: 'invalid-rating-policy-id',
      message: 'ratingPolicy.id 必须是非空字符串。',
      details: { id: policy.id },
    });
  }
  if (typeof policy.version !== 'string' || policy.version.length === 0) {
    errors.push({
      code: 'invalid-rating-policy-version',
      message: 'ratingPolicy.version 必须是非空字符串。',
      details: { version: policy.version },
    });
  }
  if (!Array.isArray(policy.techniqueOrder) || policy.techniqueOrder.length === 0 || policy.techniqueOrder.some((technique) => typeof technique !== 'string')) {
    errors.push({
      code: 'invalid-rating-policy-technique-order',
      message: 'ratingPolicy.techniqueOrder 必须是非空技巧 ID 字符串数组。',
      details: { techniqueOrder: policy.techniqueOrder },
    });
  } else {
    validateRatingPolicyTechniqueIds('techniqueOrder', policy.techniqueOrder, errors);
  }
  if (typeof policy.fallbackTechniques !== 'undefined' && (!Array.isArray(policy.fallbackTechniques) || policy.fallbackTechniques.some((technique) => typeof technique !== 'string'))) {
    errors.push({
      code: 'invalid-rating-policy-fallback-techniques',
      message: 'ratingPolicy.fallbackTechniques 必须是技巧 ID 字符串数组。',
      details: { fallbackTechniques: policy.fallbackTechniques },
    });
  } else if (Array.isArray(policy.fallbackTechniques)) {
    validateRatingPolicyTechniqueIds('fallbackTechniques', policy.fallbackTechniques, errors);
  }
  const techniqueScores = policy.techniqueScores as unknown;
  if (!isPlainObject(techniqueScores) || Object.values(techniqueScores).some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    errors.push({
      code: 'invalid-rating-policy-technique-scores',
      message: 'ratingPolicy.techniqueScores 必须是有限数字映射。',
      details: { techniqueScores: policy.techniqueScores },
    });
  } else {
    validateRatingPolicyTechniqueIds('techniqueScores', Object.keys(techniqueScores), errors, 'unknown-rating-policy-score-technique');
    validateRatingPolicyScoreCoverage(policy, techniqueScores, errors);
  }
  if (typeof policy.maxSteps !== 'undefined' && (!Number.isInteger(policy.maxSteps) || policy.maxSteps < 1)) {
    errors.push({
      code: 'invalid-rating-policy-max-steps',
      message: 'ratingPolicy.maxSteps 必须是大于等于 1 的整数。',
      details: { maxSteps: policy.maxSteps },
    });
  }
  if (typeof policy.gradeRules !== 'undefined') {
    validateRatingPolicyGradeRules(policy.gradeRules, errors);
  }
  return errors;
}

export function assertValidRatingPolicy(policy: RatingPolicy | undefined): void {
  const errors = validateRatingPolicy(policy);
  if (errors.length === 0) {
    return;
  }
  throw new Error(errors.map((error) => error.message).join('；'));
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
  if (policy.fallbackTechniques) {
    clone.fallbackTechniques = [...policy.fallbackTechniques];
  }
  if (policy.gradeRules) {
    clone.gradeRules = policy.gradeRules.map((rule) => ({
      ...rule,
      ...(rule.allowedTechniques ? { allowedTechniques: [...rule.allowedTechniques] } : {}),
    }));
  }
  return clone;
}

function deepFreezePolicy(policy: RatingPolicy): Readonly<RatingPolicy> {
  const frozen: RatingPolicy = {
    ...policy,
    techniqueOrder: Object.freeze([...policy.techniqueOrder]),
    ...(policy.fallbackTechniques ? { fallbackTechniques: Object.freeze([...policy.fallbackTechniques]) } : {}),
    techniqueScores: Object.freeze({ ...policy.techniqueScores }) as Record<TechniqueId, number>,
    ...(policy.gradeRules ? {
      gradeRules: Object.freeze(policy.gradeRules.map((rule) => Object.freeze({
        ...rule,
        ...(rule.allowedTechniques ? { allowedTechniques: Object.freeze([...rule.allowedTechniques]) } : {}),
      }))),
    } : {}),
  };
  return Object.freeze(frozen);
}

function validateRatingPolicyGradeRules(
  gradeRules: RatingPolicy['gradeRules'],
  errors: RatingPolicyValidationIssue[],
): void {
  if (!Array.isArray(gradeRules)) {
    errors.push({
      code: 'invalid-rating-policy-grade-rules',
      message: 'ratingPolicy.gradeRules 必须是数组。',
      details: { gradeRules },
    });
    return;
  }
  for (const [index, rule] of gradeRules.entries()) {
    if (!isPlainObject(rule)) {
      errors.push({
        code: 'invalid-rating-policy-grade-rule',
        message: 'ratingPolicy.gradeRules 中的规则必须是 object。',
        details: { index, rule },
      });
      continue;
    }
    collectUnknownFields(rule, GRADE_RULE_FIELDS, 'unknown-rating-policy-grade-rule-field', 'ratingPolicy.gradeRules 规则包含未知字段。', errors, { index });
    if (typeof rule.grade !== 'string' || rule.grade.length === 0) {
      errors.push({
        code: 'invalid-rating-policy-grade',
        message: 'ratingPolicy.gradeRules[].grade 必须是非空字符串。',
        details: { index, grade: rule.grade },
      });
    }
    for (const field of ['minScore', 'maxScore'] as const) {
      const value = rule[field];
      if (typeof value !== 'undefined' && (typeof value !== 'number' || !Number.isFinite(value))) {
        errors.push({
          code: 'invalid-rating-policy-grade-score',
          message: 'ratingPolicy.gradeRules 的分数字段必须是有限数字。',
          details: { index, field, value },
        });
      }
    }
    if (
      typeof rule.minScore === 'number'
      && Number.isFinite(rule.minScore)
      && typeof rule.maxScore === 'number'
      && Number.isFinite(rule.maxScore)
      && rule.minScore > rule.maxScore
    ) {
      errors.push({
        code: 'invalid-rating-policy-grade-range',
        message: 'ratingPolicy.gradeRules[].minScore 不能大于 maxScore。',
        details: { index, minScore: rule.minScore, maxScore: rule.maxScore },
      });
    }
    if (typeof rule.allowedTechniques !== 'undefined' && (!Array.isArray(rule.allowedTechniques) || rule.allowedTechniques.some((technique) => typeof technique !== 'string'))) {
      errors.push({
        code: 'invalid-rating-policy-grade-techniques',
        message: 'ratingPolicy.gradeRules[].allowedTechniques 必须是技巧 ID 字符串数组。',
        details: { index, allowedTechniques: rule.allowedTechniques },
      });
    } else if (Array.isArray(rule.allowedTechniques)) {
      validateRatingPolicyTechniqueIds('gradeRules.allowedTechniques', rule.allowedTechniques, errors, 'unknown-rating-policy-technique', { index });
    }
  }
}

function validateRatingPolicyScoreCoverage(
  policy: RatingPolicy,
  techniqueScores: Record<string, unknown>,
  errors: RatingPolicyValidationIssue[],
): void {
  const enabledTechniques = [
    ...(Array.isArray(policy.techniqueOrder) ? policy.techniqueOrder : []),
    ...(Array.isArray(policy.fallbackTechniques) ? policy.fallbackTechniques : []),
  ];
  for (const technique of enabledTechniques) {
    if (typeof technique === 'string' && !(technique in techniqueScores)) {
      errors.push({
        code: 'invalid-rating-policy-score-coverage',
        message: `ratingPolicy.techniqueScores 缺少已启用技巧分值：${technique}`,
        details: { technique },
      });
    }
  }
}

function validateRatingPolicyTechniqueIds(
  field: string,
  techniques: readonly string[],
  errors: RatingPolicyValidationIssue[],
  code: RatingPolicyValidationIssue['code'] = 'unknown-rating-policy-technique',
  details: Record<string, unknown> = {},
): void {
  for (const technique of techniques) {
    if (!KNOWN_TECHNIQUE_IDS.has(technique as TechniqueId)) {
      errors.push({
        code,
        message: `ratingPolicy.${field} 包含未知技巧：${technique}`,
        details: { ...details, field, technique },
      });
    }
  }
}

function collectUnknownFields(
  value: object,
  allowedFields: ReadonlySet<string>,
  code: RatingPolicyValidationIssue['code'],
  message: string,
  errors: RatingPolicyValidationIssue[],
  details: Record<string, unknown> = {},
): void {
  for (const field of Object.keys(value as Record<string, unknown>)) {
    if (!allowedFields.has(field)) {
      errors.push({
        code,
        message,
        details: { ...details, field },
      });
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
