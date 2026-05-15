import type { CandidateMask, Digit, HouseRef } from '../core/types.js';

export type TechniqueId =
  | 'full-house'
  | 'naked-single'
  | 'hidden-single'
  | 'locked-candidates'
  | 'naked-pair'
  | 'hidden-pair'
  | 'naked-triple'
  | 'hidden-triple'
  | 'naked-quad'
  | 'hidden-quad'
  | 'x-wing'
  | 'franken-swordfish'
  | 'swordfish'
  | 'jellyfish'
  | 'finned-x-wing'
  | 'finned-swordfish'
  | 'finned-jellyfish'
  | 'sashimi-swordfish'
  | 'sashimi-jellyfish'
  | 'xy-wing'
  | 'xyz-wing'
  | 'wxyz-wing'
  | 'w-wing'
  | 'chute-remote-pairs'
  | 'almost-locked-pair'
  | 'almost-locked-triple'
  | 'als-xz'
  | 'als-xy-wing'
  | 'aic-als'
  | 'fireworks'
  | 'twinned-xy-chains'
  | 'sue-de-coq'
  | 'death-blossom'
  | 'aligned-pair-exclusion'
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
  | 'bowmans-bingo'
  | 'aic-exotic'
  | 'simple-coloring'
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
  | 'hidden-unique-rectangle'
  | 'aic-ur'
  | 'bug-plus-one';

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

export interface StepBranchEvidence {
  assumption: {
    type: 'place' | 'eliminate';
    cell: number;
    digit: Digit;
  };
  contradiction: boolean;
  exhausted: boolean;
  contradictionAt?: {
    kind: 'cell-empty' | 'house-duplicate' | 'house-missing';
    cell?: number;
    house?: HouseRef;
    digit?: Digit;
  };
  actions?: StepAction[];
}

export interface StepEvidence {
  houses?: HouseRef[];
  cells?: StepCellEvidence[];
  links?: StepLinkEvidence[];
  branches?: StepBranchEvidence[];
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
}

export interface SolveOptions {
  allowedTechniques?: TechniqueId[];
  preferredTechniques?: TechniqueId[];
  maxSteps?: number;
}

export interface SolveAnalysis {
  solved: boolean;
  steps: SolveStep[];
  score: number;
  hardestTechnique: TechniqueId | null;
  candidates: CandidateMask[];
  stuckReason?: 'contradiction' | 'no-technique-match' | 'step-limit';
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
  placeDigit(cell: number, digit: Digit): void;
  removeCandidate(cell: number, digit: Digit): boolean;
  applyStep(step: SolveStep): void;
}
