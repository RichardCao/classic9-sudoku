import type { Board, CandidateMask, Digit, HouseRef } from '../core/types.js';

export type TechniqueId =
  | 'full-house'
  | 'naked-single'
  | 'hidden-single'
  | 'direct-pointing'
  | 'direct-claiming'
  | 'direct-hidden-pair'
  | 'locked-candidates'
  | 'naked-pair'
  | 'hidden-pair'
  | 'naked-triple'
  | 'direct-hidden-triplet'
  | 'hidden-triple'
  | 'naked-quad'
  | 'hidden-quad'
  | 'x-wing'
  | 'franken-swordfish'
  | 'finned-franken-swordfish'
  | 'finned-franken-jellyfish'
  | 'swordfish'
  | 'jellyfish'
  | 'finned-x-wing'
  | 'sashimi-x-wing'
  | 'finned-swordfish'
  | 'finned-jellyfish'
  | 'sashimi-swordfish'
  | 'sashimi-jellyfish'
  | 'larger-fish'
  | 'mutant-fish'
  | 'xy-wing'
  | 'xyz-wing'
  | 'wxyz-wing'
  | 'w-wing'
  | 'big-wings'
  | 'chute-remote-pairs'
  | 'remote-pairs'
  | 'almost-locked-pair'
  | 'almost-locked-triple'
  | 'almost-locked-quad'
  | 'als-xz'
  | 'als-xy-wing'
  | 'aic-als'
  | 'fireworks'
  | 'twinned-xy-chains'
  | 'sue-de-coq'
  | 'death-blossom'
  | 'aligned-pair-exclusion'
  | 'bidirectional-x-cycle'
  | 'bidirectional-y-cycle'
  | 'forcing-x-chain'
  | 'forcing-chain'
  | 'exocet'
  | 'double-exocet'
  | 'pattern-overlay'
  | 'tridagons'
  | 'sk-loops'
  | 'forcing-nets'
  | 'digit-forcing-chains'
  | 'nishio-forcing-chains'
  | 'cell-forcing-chains'
  | 'unit-forcing-chains'
  | 'region-forcing-chains'
  | 'table-chain'
  | 'dynamic-forcing-chains'
  | 'dynamic-forcing-chains-plus'
  | 'nested-forcing-chains'
  | 'bowmans-bingo'
  | 'aic-exotic'
  | 'simple-coloring'
  | 'x-coloring'
  | 'multi-colors'
  | 'three-d-medusa'
  | 'grouped-x-cycles'
  | 'grouped-aic'
  | 'x-chain'
  | 'xy-chain'
  | 'aic'
  | 'skyscraper'
  | 'two-string-kite'
  | 'empty-rectangle'
  | 'turbot-fish'
  | 'unique-rectangle'
  | 'avoidable-rectangle'
  | 'rectangle-elimination'
  | 'extended-rectangle'
  | 'unique-loop'
  | 'hidden-unique-rectangle'
  | 'aic-ur'
  | 'bug-plus-one'
  | 'bug-plus-two'
  | 'bug-plus-n';

export interface StepPlacement {
  cell: number;
  digit: Digit;
}

export interface StepElimination {
  cell: number;
  digit: Digit;
}

export type StepAction =
  | { type: 'place'; cell: number; digit: Digit }
  | { type: 'eliminate'; cell: number; digit: Digit };

export interface StepCellEvidence {
  cell: number;
  digit?: Digit;
  role: 'target' | 'reason' | 'link' | 'pivot';
}

export interface StepLinkEvidence {
  from: number;
  to: number;
  digit?: Digit;
  type: 'strong' | 'weak';
  house?: HouseRef;
}

export interface StepNodeEvidence {
  id: string;
  cells: number[];
  digit?: Digit;
  role: 'reason' | 'target' | 'link' | 'pivot';
  grouped?: boolean;
}

export interface StepBranchEvidence {
  assumption: {
    type: 'place' | 'eliminate';
    cell: number;
    digit: Digit;
  };
  contradiction: boolean;
  exhausted: boolean;
  steps?: number;
  maxSteps?: number;
  truncated?: boolean;
  stopReason?: 'contradiction' | 'no-step' | 'step-limit' | 'replay-error';
  contradictionAt?: {
    kind: 'cell-empty' | 'house-duplicate' | 'house-missing';
    cell?: number;
    house?: HouseRef;
    digit?: Digit;
  };
  actions?: StepAction[];
}

export interface StepPatternEvidence {
  family: string;
  subtype?: string;
}

export interface StepEvidence {
  houses?: HouseRef[];
  cells?: StepCellEvidence[];
  links?: StepLinkEvidence[];
  nodes?: StepNodeEvidence[];
  branches?: StepBranchEvidence[];
  pattern?: StepPatternEvidence;
  note?: string;
}

export interface SolveStep {
  technique: TechniqueId;
  actions: StepAction[];
  evidence: StepEvidence;
  score: number;
}

export interface TechniqueDefinition {
  id: TechniqueId;
  nameZh: string;
  nameEn: string;
  family: string;
  defaultScore: number;
  stability: 'stable' | 'experimental';
  aliases?: readonly string[];
  seDifficulty?: string;
  seStatus?: 'covered' | 'covered-as-variant' | 'partial' | 'non-se-extension';
}

export interface SolveOptions {
  allowedTechniques?: TechniqueId[];
  preferredTechniques?: TechniqueId[];
  fallbackTechniques?: TechniqueId[];
  maxSteps?: number;
  allowContradictoryCandidateState?: boolean;
}

export interface FindStepsOptions extends SolveOptions {
  sort?: 'pipeline' | 'score-desc' | 'action-count-desc' | 'canonical';
  limit?: number;
  includeDiagnostics?: boolean;
}

export interface FindStepsDiagnostics {
  techniquesTried: TechniqueId[];
  techniqueCalls: Partial<Record<TechniqueId, number>>;
  techniqueHits: Partial<Record<TechniqueId, number>>;
  initialContradictions?: number;
  stuckReason?: 'contradiction';
  elapsedMs?: number;
}

export interface FindStepsResult {
  steps: SolveStep[];
  diagnostics?: FindStepsDiagnostics;
}

export interface TechniqueUsageStats {
  technique: TechniqueId;
  calls: number;
  hits: number;
  placements: number;
  eliminations: number;
  actions: number;
  totalScore: number;
  maxScore: number;
  elapsedMs: number;
}

export interface SolverUsageReport {
  totalElapsedMs: number;
  totalCalls: number;
  totalHits: number;
  totalPlacements: number;
  totalEliminations: number;
  byTechnique: Partial<Record<TechniqueId, TechniqueUsageStats>>;
}

export interface SolveAnalysis {
  solved: boolean;
  steps: SolveStep[];
  score: number;
  hardestTechnique: TechniqueId | null;
  candidates: CandidateMask[];
  stuckReason?: 'contradiction' | 'no-technique-match' | 'step-limit';
}

export interface SolveStepScenario {
  stepNumber: number;
  step: SolveStep;
  boardBefore: Board;
  boardAfter: Board;
  candidateMasksBefore: CandidateMask[];
  candidateMasksAfter: CandidateMask[];
}

export interface AnalyzeSolveOptions extends SolveOptions {
  includeUsage?: boolean;
}

export interface AnalyzeSolveResult extends SolveAnalysis {
  usage?: SolverUsageReport;
}

export type StepVerificationMode = 'action' | 'evidence';

export interface StepVerificationOptions {
  mode?: StepVerificationMode;
  allowNoopEliminations?: boolean;
}

export type StepVerificationIssueCode =
  | 'unknown-technique'
  | 'invalid-step-shape'
  | 'invalid-action-shape'
  | 'empty-actions'
  | 'invalid-action-type'
  | 'invalid-cell'
  | 'invalid-digit'
  | 'place-on-filled-cell'
  | 'place-digit-not-candidate'
  | 'place-conflicts-house'
  | 'eliminate-on-filled-cell'
  | 'eliminate-missing-candidate'
  | 'duplicate-action'
  | 'action-causes-empty-cell'
  | 'action-causes-homeless-digit'
  | 'action-causes-duplicate-digit'
  | 'invalid-evidence-house'
  | 'invalid-evidence-cell'
  | 'invalid-evidence-link'
  | 'invalid-evidence-node'
  | 'invalid-evidence-pattern'
  | 'invalid-evidence-branch'
  | 'evidence-missing-target'
  | 'initial-state-contradiction';

export interface StepVerificationIssue {
  severity: 'error' | 'warning';
  code: StepVerificationIssueCode;
  message: string;
  actionIndex?: number;
  actionType?: string;
  path?: string;
  cell?: number;
  digit?: Digit;
}

export interface StepVerificationResult {
  valid: boolean;
  issues: StepVerificationIssue[];
  before: {
    board: number[];
    candidates: CandidateMask[];
  };
  after?: {
    board: number[];
    candidates: CandidateMask[];
  };
}

export interface WalkthroughVerificationResult {
  valid: boolean;
  firstInvalidStepIndex: number | null;
  stepResults: StepVerificationResult[];
  finalBoard: number[];
  finalCandidates: CandidateMask[];
  solved: boolean;
  stuckReason?: 'contradiction' | 'incomplete' | 'invalid-step';
}

export interface SolverTechnique {
  readonly id: TechniqueId;
  readonly score: number;
  find(context: SolverContextLike): SolveStep | null;
}

export interface SolverContextLike {
  readonly board: number[];
  readonly candidates: CandidateMask[];
  clone(): SolverContextLike;
  isSolved(): boolean;
  hasContradiction(): boolean;
  getCandidateMask(cell: number): CandidateMask;
  getCandidateDigits(cell: number): Digit[];
  getHouseCells(house: HouseRef): number[];
  getAllHouses(): HouseRef[];
  getCellHouses(cell: number): HouseRef[];
  getHouseCandidateCells(house: HouseRef, digit: Digit): number[];
  getCandidateCount(cell: number): number;
  isCandidatePresent(cell: number, digit: Digit): boolean;
  getCellRow(cell: number): number;
  getCellCol(cell: number): number;
  getCellBox(cell: number): number;
  placeDigit(cell: number, digit: Digit, options?: { allowConflict?: boolean }): void;
  removeCandidate(cell: number, digit: Digit): boolean;
  applyStep(step: SolveStep): void;
}
