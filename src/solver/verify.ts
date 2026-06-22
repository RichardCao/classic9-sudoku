import { EMPTY_VALUE } from '../core/constants.js';
import { hasDigit, isDigit } from '../core/bitset.js';
import { ALL_HOUSES, CELL_TO_PEERS, getHouseCells, isCellIndex, isBoardFilled } from '../core/grid.js';
import type { CandidateMask, Digit, HouseRef } from '../core/types.js';
import { normalizeState, type StateInput } from '../state/index.js';
import { SolverContext } from './context.js';
import { getTechniqueDefinitions } from './techniques.js';
import type {
  SolveStep,
  StepAction,
  StepBranchEvidence,
  StepCellEvidence,
  StepLinkEvidence,
  StepNodeEvidence,
  StepPatternEvidence,
  StepVerificationIssue,
  StepVerificationIssueCode,
  StepVerificationOptions,
  StepVerificationResult,
  WalkthroughVerificationResult,
} from './types.js';

const KNOWN_TECHNIQUES = new Set(getTechniqueDefinitions().map((definition) => definition.id));

export function verifyStep(
  input: StateInput,
  step: SolveStep,
  options: StepVerificationOptions = {},
): StepVerificationResult {
  const mode = options.mode ?? 'evidence';
  const normalized = normalizeState(input);
  const context = new SolverContext(normalized);
  const issues: StepVerificationIssue[] = [];
  const rawStep = isPlainObject(step) ? step as Record<string, unknown> : {};
  const actions = Array.isArray(rawStep.actions) ? rawStep.actions : [];
  const evidence = isPlainObject(rawStep.evidence) ? rawStep.evidence as SolveStep['evidence'] : {};
  const safeStep: SolveStep = {
    technique: (typeof rawStep.technique === 'string' ? rawStep.technique : 'full-house') as SolveStep['technique'],
    actions: actions.filter(isPlainObject).map((action) => action as StepAction),
    evidence,
    score: typeof rawStep.score === 'number' ? rawStep.score : 0,
  };
  const before = {
    board: [...context.board],
    candidates: [...context.candidates],
  };
  const draft = context.clone();

  if (!isPlainObject(step)) {
    addIssue(issues, 'error', 'invalid-step-shape', '解题步骤必须是 object。');
  }
  if (typeof rawStep.technique !== 'string') {
    addIssue(issues, 'error', 'invalid-step-shape', '解题步骤缺少有效 technique。');
  }
  if (!Array.isArray(rawStep.actions)) {
    addIssue(issues, 'error', 'invalid-step-shape', '解题步骤 actions 必须是数组。');
  }
  if (mode !== 'action' && !isPlainObject(rawStep.evidence)) {
    addIssue(issues, 'error', 'invalid-step-shape', '解题步骤 evidence 必须是 object。');
  }

  if (normalized.contradictions.length > 0) {
    for (const contradiction of normalized.contradictions) {
      addIssue(
        issues,
        'error',
        'initial-state-contradiction',
        contradiction.message,
        contradiction.cell === undefined ? {} : { cell: contradiction.cell },
      );
    }
  }

  if (typeof rawStep.technique === 'string' && !KNOWN_TECHNIQUES.has(rawStep.technique as SolveStep['technique'])) {
    addIssue(issues, 'error', 'unknown-technique', `未知技巧：${rawStep.technique}`);
  }

  if (actions.length === 0) {
    addIssue(issues, 'error', 'empty-actions', '解题步骤至少需要一个动作。');
  }

  const seenActions = new Set<string>();
  for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
    const action = actions[actionIndex];
    if (!isPlainObject(action)) {
      addIssue(issues, 'error', 'invalid-action-shape', '动作必须是 object。', { actionIndex });
      continue;
    }
    const typedAction = action as StepAction;
    const actionKey = `${action.type}:${action.cell}:${action.digit}`;
    if (seenActions.has(actionKey)) {
      const cell = typeof action.cell === 'number' ? action.cell : undefined;
      const digit = typeof action.digit === 'number' && isDigit(action.digit) ? action.digit : undefined;
      addIssue(
        issues,
        'warning',
        'duplicate-action',
        `重复动作：${actionKey}`,
        { actionIndex, ...(cell !== undefined ? { cell } : {}), ...(digit !== undefined ? { digit } : {}) },
      );
    }
    seenActions.add(actionKey);
    validateAndApplyAction(draft, typedAction, issues, actionIndex, options);
  }

  if (mode !== 'action') {
    validateEvidence(safeStep, issues, mode);
  }

  collectAfterActionIssues(draft, issues);

  const valid = !issues.some((issue) => issue.severity === 'error');
  if (valid) {
    context.applyStep(safeStep);
  }
  return {
    valid,
    issues,
    before,
    after: {
      board: [...context.board],
      candidates: [...context.candidates],
    },
  };
}

export function verifyWalkthrough(
  input: StateInput,
  steps: readonly SolveStep[],
  options: StepVerificationOptions = {},
): WalkthroughVerificationResult {
  const normalized = normalizeState(input);
  if (normalized.contradictions.length > 0) {
    const issues: StepVerificationIssue[] = [];
    for (const contradiction of normalized.contradictions) {
      addIssue(issues, 'error', 'initial-state-contradiction', contradiction.message, {
        ...(typeof contradiction.cell === 'number' ? { cell: contradiction.cell } : {}),
      });
    }
    return {
      valid: false,
      firstInvalidStepIndex: null,
      stepResults: [{
        valid: false,
        issues,
        before: {
          board: [...normalized.board],
          candidates: [...normalized.candidates],
        },
        after: {
          board: [...normalized.board],
          candidates: [...normalized.candidates],
        },
      }],
      finalBoard: [...normalized.board],
      finalCandidates: [...normalized.candidates],
      solved: false,
      stuckReason: 'contradiction',
    };
  }
  let board = [...normalized.board];
  let candidates = [...normalized.candidates];
  const stepResults: StepVerificationResult[] = [];
  let firstInvalidStepIndex: number | null = null;

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const result = verifyStep({ board, candidateMasks: candidates }, steps[stepIndex]!, options);
    stepResults.push(result);
    if (!result.valid) {
      firstInvalidStepIndex = stepIndex;
      return {
        valid: false,
        firstInvalidStepIndex,
        stepResults,
        finalBoard: result.before.board,
        finalCandidates: result.before.candidates,
        solved: false,
        stuckReason: 'invalid-step',
      };
    }
    board = [...(result.after?.board ?? result.before.board)];
    candidates = [...(result.after?.candidates ?? result.before.candidates)];
  }

  const finalContext = new SolverContext({ board, candidateMasks: candidates });
  const hasContradiction = finalContext.hasContradiction();
  const solved = finalContext.isSolved();
  return {
    valid: !hasContradiction,
    firstInvalidStepIndex,
    stepResults,
    finalBoard: board,
    finalCandidates: candidates,
    solved,
    ...(hasContradiction ? { stuckReason: 'contradiction' as const } : {}),
    ...(!hasContradiction && !solved ? { stuckReason: 'incomplete' as const } : {}),
  };
}

function validateAndApplyAction(
  context: SolverContext,
  action: StepAction,
  issues: StepVerificationIssue[],
  actionIndex: number,
  options: StepVerificationOptions,
): void {
  const actionType = (action as { type?: unknown }).type;
  if (!isCellIndex(action.cell)) {
    addIssue(issues, 'error', 'invalid-cell', `无效格子索引：${action.cell}`, {
      actionIndex,
      cell: action.cell,
      digit: action.digit,
    });
    return;
  }
  if (!isDigit(action.digit)) {
    addIssue(issues, 'error', 'invalid-digit', `无效数字：${action.digit}`, {
      actionIndex,
      cell: action.cell,
      digit: action.digit,
    });
    return;
  }

  if (actionType !== 'place' && actionType !== 'eliminate') {
    addIssue(issues, 'error', 'invalid-action-type', `未知动作类型：${String(actionType)}`, {
      actionIndex,
      actionType: String(actionType),
      cell: action.cell,
      digit: action.digit,
    });
    return;
  }

  if (actionType === 'place') {
    validateAndApplyPlacement(context, action.cell, action.digit, issues, actionIndex);
    return;
  }

  validateAndApplyElimination(context, action.cell, action.digit, issues, actionIndex, options);
}

function validateAndApplyPlacement(
  context: SolverContext,
  cell: number,
  digit: Digit,
  issues: StepVerificationIssue[],
  actionIndex: number,
): void {
  if (context.board[cell] !== EMPTY_VALUE) {
    addIssue(issues, 'error', 'place-on-filled-cell', `格 ${cell} 已有数字，不能填入。`, {
      actionIndex,
      cell,
      digit,
    });
    return;
  }
  if (!hasDigit(context.candidates[cell] ?? 0, digit)) {
    addIssue(issues, 'error', 'place-digit-not-candidate', `数字 ${digit} 不是格 ${cell} 的当前候选数。`, {
      actionIndex,
      cell,
      digit,
    });
    return;
  }
  if ((CELL_TO_PEERS[cell] ?? []).some((peer) => context.board[peer] === digit)) {
    addIssue(issues, 'error', 'place-conflicts-house', `在格 ${cell} 填 ${digit} 会造成同行、同列或同宫冲突。`, {
      actionIndex,
      cell,
      digit,
    });
    return;
  }
  context.placeDigit(cell, digit);
}

function validateAndApplyElimination(
  context: SolverContext,
  cell: number,
  digit: Digit,
  issues: StepVerificationIssue[],
  actionIndex: number,
  options: StepVerificationOptions,
): void {
  if (context.board[cell] !== EMPTY_VALUE) {
    addIssue(issues, 'error', 'eliminate-on-filled-cell', `格 ${cell} 已有数字，不能删除候选数。`, {
      actionIndex,
      cell,
      digit,
    });
    return;
  }
  if (!hasDigit(context.candidates[cell] ?? 0, digit)) {
    addIssue(
      issues,
      'error',
      'eliminate-missing-candidate',
      `格 ${cell} 当前没有候选数 ${digit}。`,
      { actionIndex, cell, digit, ...(options.allowNoopEliminations ? { allowNoopEliminationsIgnored: true } : {}) },
    );
    return;
  }
  context.removeCandidate(cell, digit);
}

function validateEvidence(
  step: SolveStep,
  issues: StepVerificationIssue[],
  mode: StepVerificationOptions['mode'],
): void {
  for (let index = 0; index < (step.evidence.houses ?? []).length; index += 1) {
    const house = step.evidence.houses![index]!;
    if (!isPlainObject(house)) {
      addIssue(issues, 'error', 'invalid-evidence-house', `无效区域引用：evidence.houses.${index}`, { path: `evidence.houses.${index}` });
      continue;
    }
    validateHouse(house as unknown as HouseRef, issues, `evidence.houses.${index}`, 'invalid-evidence-house');
  }
  for (let index = 0; index < (step.evidence.cells ?? []).length; index += 1) {
    const cell = step.evidence.cells![index]!;
    if (!isPlainObject(cell)) {
      addIssue(issues, 'error', 'invalid-evidence-cell', `无效 evidence cell：evidence.cells.${index}`, { path: `evidence.cells.${index}` });
      continue;
    }
    validateEvidenceCell(cell as unknown as StepCellEvidence, issues, `evidence.cells.${index}`);
  }
  for (let index = 0; index < (step.evidence.links ?? []).length; index += 1) {
    const link = step.evidence.links![index]!;
    if (!isPlainObject(link)) {
      addIssue(issues, 'error', 'invalid-evidence-link', `无效 evidence link：evidence.links.${index}`, { path: `evidence.links.${index}` });
      continue;
    }
    validateEvidenceLink(link as unknown as StepLinkEvidence, issues, `evidence.links.${index}`);
  }
  for (let index = 0; index < (step.evidence.nodes ?? []).length; index += 1) {
    const node = step.evidence.nodes![index]!;
    if (!isPlainObject(node)) {
      addIssue(issues, 'error', 'invalid-evidence-node', `无效 evidence node：evidence.nodes.${index}`, { path: `evidence.nodes.${index}` });
      continue;
    }
    validateEvidenceNode(node as unknown as StepNodeEvidence, issues, `evidence.nodes.${index}`);
  }
  if (step.evidence.pattern !== undefined) {
    if (!isPlainObject(step.evidence.pattern)) {
      addIssue(issues, 'error', 'invalid-evidence-pattern', '无效 evidence pattern：evidence.pattern', { path: 'evidence.pattern' });
    } else {
      validateEvidencePattern(step.evidence.pattern as unknown as StepPatternEvidence, issues, 'evidence.pattern');
    }
  }
  for (let index = 0; index < (step.evidence.branches ?? []).length; index += 1) {
    const branch = step.evidence.branches![index]!;
    if (!isPlainObject(branch)) {
      addIssue(issues, 'error', 'invalid-evidence-branch', `无效 evidence branch：evidence.branches.${index}`, { path: `evidence.branches.${index}` });
      continue;
    }
    validateEvidenceBranch(branch as unknown as StepBranchEvidence, issues, `evidence.branches.${index}`);
  }
  validateEvidenceTargets(step, issues, mode);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateHouse(
  house: HouseRef,
  issues: StepVerificationIssue[],
  path: string,
  code: StepVerificationIssueCode,
): void {
  if (!['row', 'col', 'box'].includes(house.type) || !Number.isInteger(house.index) || house.index < 0 || house.index > 8) {
    addIssue(issues, 'error', code, `无效区域引用：${path}`, { path });
  }
}

function validateEvidencePattern(
  pattern: StepPatternEvidence,
  issues: StepVerificationIssue[],
  path: string,
): void {
  if (typeof pattern.family !== 'string' || pattern.family.length === 0) {
    addIssue(issues, 'error', 'invalid-evidence-pattern', `无效 pattern family：${path}.family`, { path: `${path}.family` });
  }
  if (pattern.subtype !== undefined && (typeof pattern.subtype !== 'string' || pattern.subtype.length === 0)) {
    addIssue(issues, 'error', 'invalid-evidence-pattern', `无效 pattern subtype：${path}.subtype`, { path: `${path}.subtype` });
  }
}

function validateEvidenceCell(
  evidence: StepCellEvidence,
  issues: StepVerificationIssue[],
  path: string,
): void {
  if (!isCellIndex(evidence.cell)) {
    addIssue(issues, 'error', 'invalid-evidence-cell', `无效 evidence cell：${path}`, {
      path,
      cell: evidence.cell,
    });
  }
  if (evidence.digit !== undefined && !isDigit(evidence.digit)) {
    addIssue(issues, 'error', 'invalid-evidence-cell', `无效 evidence digit：${path}`, {
      path,
      cell: evidence.cell,
      digit: evidence.digit,
    });
  }
  if (!['target', 'reason', 'link', 'pivot'].includes(evidence.role)) {
    addIssue(issues, 'error', 'invalid-evidence-cell', `无效 evidence role：${path}`, {
      path,
      cell: evidence.cell,
      ...(evidence.digit === undefined ? {} : { digit: evidence.digit }),
    });
  }
}

function validateEvidenceLink(
  link: StepLinkEvidence,
  issues: StepVerificationIssue[],
  path: string,
): void {
  if (!isCellIndex(link.from) || !isCellIndex(link.to)) {
    addIssue(issues, 'error', 'invalid-evidence-link', `无效 evidence link 端点：${path}`, { path });
  }
  if (link.digit !== undefined && !isDigit(link.digit)) {
    addIssue(issues, 'error', 'invalid-evidence-link', `无效 evidence link digit：${path}`, {
      path,
      digit: link.digit,
    });
  }
  if (!['strong', 'weak'].includes(link.type)) {
    addIssue(issues, 'error', 'invalid-evidence-link', `无效 evidence link type：${path}`, { path });
  }
  if (link.house) {
    validateHouse(link.house, issues, `${path}.house`, 'invalid-evidence-link');
  }
}

function validateEvidenceNode(
  node: StepNodeEvidence,
  issues: StepVerificationIssue[],
  path: string,
): void {
  if (typeof node.id !== 'string' || node.id.length === 0) {
    addIssue(issues, 'error', 'invalid-evidence-node', `无效 evidence node id：${path}.id`, { path: `${path}.id` });
  }
  if (!Array.isArray(node.cells) || node.cells.length === 0) {
    addIssue(issues, 'error', 'invalid-evidence-node', `无效 evidence node cells：${path}.cells`, { path: `${path}.cells` });
  } else {
    const seenCells = new Set<number>();
    for (let index = 0; index < node.cells.length; index += 1) {
      const cell = node.cells[index]!;
      if (!isCellIndex(cell) || seenCells.has(cell)) {
        addIssue(issues, 'error', 'invalid-evidence-node', `无效 evidence node cell：${path}.cells.${index}`, {
          path: `${path}.cells.${index}`,
          cell,
        });
      }
      if (isCellIndex(cell)) {
        seenCells.add(cell);
      }
    }
  }
  if (node.digit !== undefined && !isDigit(node.digit)) {
    addIssue(issues, 'error', 'invalid-evidence-node', `无效 evidence node digit：${path}.digit`, {
      path: `${path}.digit`,
      digit: node.digit,
    });
  }
  if (!['reason', 'target', 'link', 'pivot'].includes(node.role)) {
    addIssue(issues, 'error', 'invalid-evidence-node', `无效 evidence node role：${path}.role`, { path: `${path}.role` });
  }
  if (node.grouped !== undefined && typeof node.grouped !== 'boolean') {
    addIssue(issues, 'error', 'invalid-evidence-node', `无效 evidence node grouped：${path}.grouped`, { path: `${path}.grouped` });
  }
}

function validateEvidenceBranch(
  branch: StepBranchEvidence,
  issues: StepVerificationIssue[],
  path: string,
): void {
  if (!isPlainObject(branch.assumption)) {
    addIssue(issues, 'error', 'invalid-evidence-branch', `无效分支假设：${path}.assumption`, {
      path: `${path}.assumption`,
    });
    return;
  }
  if (!['place', 'eliminate'].includes(branch.assumption.type)
    || !isCellIndex(branch.assumption.cell)
    || !isDigit(branch.assumption.digit)) {
    addIssue(issues, 'error', 'invalid-evidence-branch', `无效分支假设：${path}.assumption`, {
      path: `${path}.assumption`,
      cell: branch.assumption.cell,
      digit: branch.assumption.digit,
    });
  }
  if (typeof branch.contradiction !== 'boolean' || typeof branch.exhausted !== 'boolean') {
    addIssue(issues, 'error', 'invalid-evidence-branch', `无效分支状态：${path}`, { path });
  }
  if (branch.steps !== undefined && (!Number.isInteger(branch.steps) || branch.steps < 0)) {
    addIssue(issues, 'error', 'invalid-evidence-branch', `无效分支步数：${path}.steps`, {
      path: `${path}.steps`,
    });
  }
  if (branch.maxSteps !== undefined && (!Number.isInteger(branch.maxSteps) || branch.maxSteps < 0)) {
    addIssue(issues, 'error', 'invalid-evidence-branch', `无效分支预算：${path}.maxSteps`, {
      path: `${path}.maxSteps`,
    });
  }
  if (branch.truncated !== undefined && typeof branch.truncated !== 'boolean') {
    addIssue(issues, 'error', 'invalid-evidence-branch', `无效分支截断状态：${path}.truncated`, {
      path: `${path}.truncated`,
    });
  }
  if (
    branch.stopReason !== undefined
    && !['contradiction', 'no-step', 'step-limit', 'replay-error'].includes(branch.stopReason)
  ) {
    addIssue(issues, 'error', 'invalid-evidence-branch', `无效分支停止原因：${path}.stopReason`, {
      path: `${path}.stopReason`,
    });
  }
  if (branch.contradictionAt !== undefined) {
    if (!isPlainObject(branch.contradictionAt)) {
      addIssue(issues, 'error', 'invalid-evidence-branch', `无效分支矛盾：${path}.contradictionAt`, {
        path: `${path}.contradictionAt`,
      });
    } else if (!['cell-empty', 'house-duplicate', 'house-missing'].includes(branch.contradictionAt.kind)) {
      addIssue(issues, 'error', 'invalid-evidence-branch', `无效分支矛盾类型：${path}.contradictionAt.kind`, {
        path: `${path}.contradictionAt.kind`,
      });
    }
  }
  if (branch.contradictionAt?.cell !== undefined && !isCellIndex(branch.contradictionAt.cell)) {
    addIssue(issues, 'error', 'invalid-evidence-branch', `无效分支矛盾格：${path}.contradictionAt`, {
      path: `${path}.contradictionAt`,
      cell: branch.contradictionAt.cell,
    });
  }
  if (branch.contradictionAt?.digit !== undefined && !isDigit(branch.contradictionAt.digit)) {
    addIssue(issues, 'error', 'invalid-evidence-branch', `无效分支矛盾数字：${path}.contradictionAt`, {
      path: `${path}.contradictionAt`,
      digit: branch.contradictionAt.digit,
    });
  }
  if (branch.contradictionAt?.house) {
    if (!isPlainObject(branch.contradictionAt.house)) {
      addIssue(issues, 'error', 'invalid-evidence-branch', `无效分支矛盾区域：${path}.contradictionAt.house`, {
        path: `${path}.contradictionAt.house`,
      });
    } else {
      validateHouse(branch.contradictionAt.house, issues, `${path}.contradictionAt.house`, 'invalid-evidence-branch');
    }
  }
  for (let index = 0; index < (branch.actions ?? []).length; index += 1) {
    const action = branch.actions![index]!;
    if (!isPlainObject(action)) {
      addIssue(issues, 'error', 'invalid-evidence-branch', `无效分支动作：${path}.actions.${index}`, {
        path: `${path}.actions.${index}`,
      });
      continue;
    }
    if (!['place', 'eliminate'].includes(action.type) || !isCellIndex(action.cell) || !isDigit(action.digit)) {
      addIssue(issues, 'error', 'invalid-evidence-branch', `无效分支动作：${path}.actions.${index}`, {
        path: `${path}.actions.${index}`,
        cell: action.cell,
        digit: action.digit,
      });
    }
  }
}

function validateEvidenceTargets(
  step: SolveStep,
  issues: StepVerificationIssue[],
  mode: StepVerificationOptions['mode'],
): void {
  const targets = new Set((step.evidence.cells ?? [])
    .filter((cell): cell is StepCellEvidence => isPlainObject(cell) && cell.role === 'target')
    .map((cell) => `${cell.cell}:${cell.digit ?? '*'}`));
  if (targets.size === 0 && step.actions.length > 0) {
    addIssue(
      issues,
      'warning',
      'evidence-missing-target',
      'evidence.cells 中没有 target 角色。',
    );
    return;
  }
  for (let actionIndex = 0; actionIndex < step.actions.length; actionIndex += 1) {
    const action = step.actions[actionIndex]!;
    if (!targets.has(`${action.cell}:${action.digit}`) && !targets.has(`${action.cell}:*`)) {
      addIssue(
        issues,
        'warning',
        'evidence-missing-target',
        `动作 ${actionIndex} 没有对应的 target evidence。`,
        { actionIndex, cell: action.cell, digit: action.digit },
      );
    }
  }
}

function collectAfterActionIssues(
  context: SolverContext,
  issues: StepVerificationIssue[],
): void {
  for (let cell = 0; cell < context.board.length; cell += 1) {
    if (context.board[cell] === EMPTY_VALUE && (context.candidates[cell] ?? 0) === 0) {
      addIssue(issues, 'error', 'action-causes-empty-cell', `动作后格 ${cell} 候选数耗尽。`, { cell });
    }
  }

  for (const house of ALL_HOUSES) {
    const cells = getHouseCells(house);
    for (let digit = 1; digit <= 9; digit += 1) {
      let solvedCount = 0;
      let candidateCount = 0;
      for (const cell of cells) {
        if (context.board[cell] === digit) {
          solvedCount += 1;
        } else if (context.board[cell] === EMPTY_VALUE && hasDigit(context.candidates[cell] ?? 0, digit as Digit)) {
          candidateCount += 1;
        }
      }
      if (solvedCount > 1) {
        addIssue(issues, 'error', 'action-causes-duplicate-digit', `动作后 ${house.type}${house.index} 中数字 ${digit} 重复。`, {
          digit: digit as Digit,
        });
      } else if (solvedCount === 0 && candidateCount === 0 && !isBoardFilled(context.board)) {
        addIssue(issues, 'error', 'action-causes-homeless-digit', `动作后 ${house.type}${house.index} 中数字 ${digit} 无位置。`, {
          digit: digit as Digit,
        });
      }
    }
  }
}

function addIssue(
  issues: StepVerificationIssue[],
  severity: 'error' | 'warning',
  code: StepVerificationIssueCode,
  message: string,
  detail: Omit<StepVerificationIssue, 'severity' | 'code' | 'message'> = {},
): void {
  issues.push({
    severity,
    code,
    message,
    ...detail,
  });
}
