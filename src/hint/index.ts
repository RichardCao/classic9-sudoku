import { formatStep, type FormatStepOptions } from '../presentation/index.js';
import { nextStep, walkthrough } from '../solver/index.js';
import type { SolveOptions, SolveStep, StepAction, TechniqueId } from '../solver/types.js';
import type { StateInput } from '../state/index.js';

export interface HintOptions extends SolveOptions {
  format?: boolean | FormatStepOptions;
}

export interface HintResult {
  found: boolean;
  step?: SolveStep;
  actions?: StepAction[];
  technique?: TechniqueId;
  text?: string;
  stuckReason?: 'contradiction' | 'no-technique-match' | 'solved' | 'step-limit';
}

export function hint(input: StateInput, options: HintOptions = {}): HintResult {
  const { format, ...solveOptions } = options;
  const step = nextStep(input, solveOptions);
  if (step) {
    return {
      found: true,
      step,
      actions: [...step.actions],
      technique: step.technique,
      ...(format ? { text: formatStep(step, format === true ? {} : format) } : {}),
    };
  }

  const analysis = walkthrough(input, { ...solveOptions, maxSteps: 1 });
  return {
    found: false,
    stuckReason: analysis.solved ? 'solved' : analysis.stuckReason ?? 'no-technique-match',
  };
}
