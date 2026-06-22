#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ALL_HOUSES,
  CELL_TO_PEERS,
  EMPTY_VALUE,
  SolverContext,
  checkUniqueness,
  countMaskBits,
  digitsFromMask,
  maskForDigit,
  parsePuzzle,
} from '../dist/src/index.js';

const EMPTY_GRID = '0'.repeat(81);
const BUG_COMPLETION_BUDGET = {
  maxCells: 24,
  maxStates: 100000,
  maxCompletions: 256,
};
const options = parseArgs(process.argv.slice(2));
const record = loadRecord(options.inputPath, options);
const state = buildState(record);
const context = new SolverContext(state);
const solution = loadSolution(record);
const rows = inspectBugPlusTwo(context, solution);

const payload = {
  summary: {
    auditId: 'bug-plus-two-candidate-inspection.v1',
    input: options.inputPath,
    section: options.section,
    id: options.id,
    index: options.index,
    triValueCells: rows.triValueCells,
    invalidCells: rows.invalidCells,
    pairCount: rows.pairs.length,
    commonExtraPairs: rows.pairs.filter((pair) => pair.kind === 'common-extra').length,
    nonCommonExtraPairs: rows.pairs.filter((pair) => pair.kind === 'non-common-extra').length,
    hasSolution: solution !== null,
  },
  pairs: rows.pairs,
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

function inspectBugPlusTwo(context, solution) {
  const unsolved = Array.from({ length: context.board.length }, (_, cell) => cell)
    .filter((cell) => context.board[cell] === EMPTY_VALUE);
  const triValueCells = unsolved.filter((cell) => context.getCandidateCount(cell) === 3);
  const invalidCells = unsolved.filter((cell) => {
    const count = context.getCandidateCount(cell);
    return count !== 2 && count !== 3;
  });
  if (triValueCells.length !== 2 || invalidCells.length > 0) {
    return { triValueCells, invalidCells, pairs: [] };
  }

  const [left, right] = triValueCells;
  const pairs = [];
  for (const leftDigit of context.getCandidateDigits(left)) {
    for (const rightDigit of context.getCandidateDigits(right)) {
      const extras = [
        { cell: left, digit: leftDigit },
        { cell: right, digit: rightDigit },
      ];
      const removedExtraDigits = buildRemovedExtraDigitMap(extras);
      const graph = removedExtraDigits ? buildBugBaseGraph(context, unsolved, removedExtraDigits) : null;
      if (!graph) {
        continue;
      }
      const parity = extras.map((extra) => buildExtraParitySummary(context, extra));
      const kind = leftDigit === rightDigit ? 'common-extra' : 'non-common-extra';
      const commonTargets = kind === 'common-extra'
        ? getCommonExtraTargets(context, left, right, leftDigit)
        : [];
      const targetProbes = buildTargetProbes(context, extras, solution);
      const completionProbe = kind === 'non-common-extra'
        ? buildCompletionProbeSummary(probeBugCandidateCompletions(context, unsolved, BUG_COMPLETION_BUDGET), extras)
        : null;
      pairs.push({
        kind,
        extras,
        baseCells: Array.from(graph.baseMasks.keys()),
        baseMasks: Object.fromEntries(Array.from(graph.baseMasks.entries()).map(([cell, mask]) => [
          cell,
          digitsFromMask(mask),
        ])),
        ownHouseOdd: parity.every((summary) =>
          summary.houses.length === 3 && summary.houses.every((house) => house.odd)),
        parity,
        targetProbes,
        safeTargetCandidates: buildSafeTargetCandidates(targetProbes),
        completionProbe,
        commonTargets,
      });
    }
  }
  return { triValueCells, invalidCells, pairs };
}

function buildBugBaseGraph(context, unsolved, removedExtraDigits) {
  const baseMasks = new Map();
  for (const cell of unsolved) {
    const extraDigit = removedExtraDigits.get(cell);
    const mask = context.getCandidateMask(cell);
    const baseMask = extraDigit === undefined ? mask : mask & ~maskForDigit(extraDigit);
    if (countMaskBits(baseMask) !== 2) {
      return null;
    }
    baseMasks.set(cell, baseMask);
  }

  for (const house of ALL_HOUSES) {
    const cells = context.getHouseCells(house).filter((cell) => context.board[cell] === EMPTY_VALUE);
    for (let digit = 1; digit <= 9; digit += 1) {
      const digitMask = maskForDigit(digit);
      const count = cells.reduce((sum, cell) => sum + ((baseMasks.get(cell) & digitMask) !== 0 ? 1 : 0), 0);
      if (count !== 0 && count !== 2) {
        return null;
      }
    }
  }
  return { baseMasks };
}

function buildRemovedExtraDigitMap(extras) {
  const removedExtraDigits = new Map();
  for (const extra of extras) {
    const previous = removedExtraDigits.get(extra.cell);
    if (previous !== undefined && previous !== extra.digit) {
      return null;
    }
    removedExtraDigits.set(extra.cell, extra.digit);
  }
  return removedExtraDigits;
}

function buildExtraParitySummary(context, extra) {
  return {
    extra,
    houses: context.getCellHouses(extra.cell).map((house) => {
      const candidateCells = context.getHouseCandidateCells(house, extra.digit);
      return {
        house,
        candidateCells,
        count: candidateCells.length,
        odd: candidateCells.length % 2 === 1,
      };
    }),
  };
}

function getCommonExtraTargets(context, left, right, digit) {
  return intersectNumbers(CELL_TO_PEERS[left] ?? [], CELL_TO_PEERS[right] ?? [])
    .filter((cell) =>
      cell !== left
      && cell !== right
      && context.board[cell] === EMPTY_VALUE
      && context.isCandidatePresent(cell, digit));
}

function buildTargetProbes(context, extras, solution) {
  const [leftExtra, rightExtra] = extras;
  return extras.map((extra) => ({
    digit: extra.digit,
    sourceCell: extra.cell,
    candidates: Array.from({ length: context.board.length }, (_, cell) => cell)
      .filter((cell) =>
        cell !== leftExtra.cell
        && cell !== rightExtra.cell
        && context.board[cell] === EMPTY_VALUE
        && context.isCandidatePresent(cell, extra.digit))
      .map((cell) => ({
        cell,
        seesLeftExtra: (CELL_TO_PEERS[leftExtra.cell] ?? []).includes(cell),
        seesRightExtra: (CELL_TO_PEERS[rightExtra.cell] ?? []).includes(cell),
        seesSourceExtra: (CELL_TO_PEERS[extra.cell] ?? []).includes(cell),
        seesBothExtras: (CELL_TO_PEERS[leftExtra.cell] ?? []).includes(cell) && (CELL_TO_PEERS[rightExtra.cell] ?? []).includes(cell),
        solutionDigit: solution?.[cell] ?? null,
        isSolutionDigit: solution?.[cell] === extra.digit,
      })),
  }));
}

function buildSafeTargetCandidates(targetProbes) {
  return targetProbes.flatMap((probe) =>
    probe.candidates
      .filter((candidate) => candidate.isSolutionDigit !== true)
      .map((candidate) => ({
        digit: probe.digit,
        cell: candidate.cell,
        seesLeftExtra: candidate.seesLeftExtra,
        seesRightExtra: candidate.seesRightExtra,
        seesSourceExtra: candidate.seesSourceExtra,
        seesBothExtras: candidate.seesBothExtras,
        solutionDigit: candidate.solutionDigit,
      })));
}

function buildCompletionProbeSummary(probe, extras) {
  return {
    proofMode: 'bounded-completion',
    budget: BUG_COMPLETION_BUDGET,
    completed: probe.completed,
    budgetExceeded: !probe.completed,
    solutionCount: probe.solutionCount,
    statesVisited: probe.statesVisited,
    extraCandidateHits: extras.map((extra) => {
      const hitCount = probe.candidateHits.get(buildBugCandidateKey(extra.cell, extra.digit)) ?? 0;
      return {
        ...extra,
        hitCount,
        canEliminateByBoundedCompletion: probe.completed && probe.solutionCount > 0 && hitCount === 0,
      };
    }),
  };
}

function probeBugCandidateCompletions(context, unsolved, budget) {
  const candidateHits = new Map();
  if (unsolved.length > budget.maxCells) {
    return { completed: false, solutionCount: 0, statesVisited: 0, candidateHits };
  }

  let states = 0;
  let solutionCount = 0;
  let completed = true;
  const assignments = new Map();
  const cells = [...unsolved];

  const canPlace = (cell, digit) => {
    for (const [assignedCell, assignedDigit] of assignments.entries()) {
      if (assignedDigit === digit && (CELL_TO_PEERS[cell] ?? []).includes(assignedCell)) {
        return false;
      }
    }
    for (const peer of CELL_TO_PEERS[cell] ?? []) {
      if (context.board[peer] === digit) {
        return false;
      }
    }
    return true;
  };

  const search = (index) => {
    if (!completed || solutionCount >= budget.maxCompletions) {
      completed = false;
      return;
    }
    states += 1;
    if (states > budget.maxStates) {
      completed = false;
      return;
    }
    if (index === cells.length) {
      solutionCount += 1;
      for (const [cell, digit] of assignments.entries()) {
        const key = buildBugCandidateKey(cell, digit);
        candidateHits.set(key, (candidateHits.get(key) ?? 0) + 1);
      }
      return;
    }

    let bestIndex = -1;
    let bestOptions = null;
    for (let candidateIndex = index; candidateIndex < cells.length; candidateIndex += 1) {
      const cell = cells[candidateIndex];
      const options = context.getCandidateDigits(cell).filter((digit) => canPlace(cell, digit));
      if (bestOptions === null || options.length < bestOptions.length) {
        bestIndex = candidateIndex;
        bestOptions = options;
        if (options.length === 0) {
          break;
        }
      }
    }
    if (!bestOptions || bestOptions.length === 0 || bestIndex < 0) {
      return;
    }

    [cells[index], cells[bestIndex]] = [cells[bestIndex], cells[index]];
    const cell = cells[index];
    for (const digit of bestOptions) {
      assignments.set(cell, digit);
      search(index + 1);
      assignments.delete(cell);
      if (!completed) {
        break;
      }
    }
    [cells[index], cells[bestIndex]] = [cells[bestIndex], cells[index]];
  };

  search(0);
  return { completed, solutionCount, statesVisited: states, candidateHits };
}

function buildBugCandidateKey(cell, digit) {
  return `${cell}:${digit}`;
}

function intersectNumbers(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function buildState(record) {
  const puzzle = typeof record.puzzle === 'string' ? record.puzzle : EMPTY_GRID;
  if (record.stateKind === 'trusted') {
    return {
      board: parsePuzzle(puzzle),
      constraints: {
        exactCandidatesMode: 'trusted',
        exactCandidates: record.candidates.map(([cell, digits]) => ({ cell, digits })),
      },
    };
  }

  const byCell = new Map(record.candidates);
  return {
    board: parsePuzzle(puzzle),
    constraints: {
      exactCandidates: Array.from({ length: 81 }, (_, cell) => ({
        cell,
        digits: byCell.get(cell) ?? record.defaultCandidates ?? [8, 9],
      })),
    },
  };
}

function loadSolution(record) {
  if (typeof record.solution === 'string') {
    return parsePuzzle(record.solution);
  }
  if (Array.isArray(record.solution)) {
    return parsePuzzle(record.solution.join(''));
  }
  if (typeof record.puzzle === 'string') {
    const uniqueness = checkUniqueness(record.puzzle);
    if (uniqueness.firstSolution) {
      return uniqueness.firstSolution;
    }
  }
  return null;
}

function loadRecord(path, loadOptions) {
  const parsed = JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
  if (isRecord(parsed) && Array.isArray(parsed.candidates)) {
    return parsed;
  }
  if (isRecord(parsed)) {
    const section = parsed[loadOptions.section];
    if (!Array.isArray(section)) {
      throw new Error(`Input object does not contain array section ${loadOptions.section}.`);
    }
    if (loadOptions.id !== null) {
      const recordIndex = section.findIndex((item) => isRecord(item) && item.id === loadOptions.id);
      const record = recordIndex >= 0 ? section[recordIndex] : null;
      if (isRecord(record) && Array.isArray(record.candidates)) {
        loadOptions.index = recordIndex;
        return record;
      }
      throw new Error(`Input section ${loadOptions.section} does not contain fixture id ${loadOptions.id}.`);
    }
    const record = section[loadOptions.index];
    if (isRecord(record) && Array.isArray(record.candidates)) {
      return record;
    }
  }
  throw new Error('Input must be a fixture record or an object containing the requested fixture section.');
}

function parseArgs(args) {
  const options = {
    inputPath: 'tests/fixtures/reference-techniques/reference-smoke.json',
    section: 'negative',
    id: null,
    index: 0,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--input') {
      options.inputPath = readRequiredValue(args, index);
      index += 1;
    } else if (arg === '--section') {
      options.section = readRequiredValue(args, index);
      index += 1;
    } else if (arg === '--id') {
      options.id = readRequiredValue(args, index);
      index += 1;
    } else if (arg === '--index') {
      options.index = Number.parseInt(readRequiredValue(args, index), 10);
      if (!Number.isInteger(options.index) || options.index < 0) {
        throw new Error('--index must be a non-negative integer.');
      }
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printUsageAndExit();
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function readRequiredValue(args, index) {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${args[index]} requires a value.`);
  }
  return value;
}

function printUsageAndExit() {
  process.stdout.write(`Usage: node scripts/inspect-bug-plus-two-candidates.mjs [--input path] [--section negative] [--id fixture-id] [--index 0]\n`);
  process.exit(0);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
