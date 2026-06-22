import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  canonicalizeBoard,
  canonicalizePair,
  checkUniqueness,
  buildSolveOptionsFromRatingPolicy,
  CLASSIC_EXTENDED_TECHNIQUE_ORDER,
  CLASSIC_GALAXY_TECHNIQUE_ORDER,
  CLASSIC_STABLE_POLICY,
  CLASSIC_STABLE_TECHNIQUE_ORDER,
  ALL_HOUSES,
  CELL_TO_PEERS,
  CELL_TO_PEER_SET,
  CELL_TO_COL,
  CELL_TO_ROW,
  applyTransformToBoard,
  applyTransformToState,
  applyTransformToStep,
  analyzeCandidatePool,
  analyzeSolve,
  analyzeGenerationRequest,
  dedupeCandidates,
  findSteps,
  findTechniqueScenario,
  formatStep,
  generateOne,
  getDefaultRatingPolicy,
  getRatingPolicy,
  getHouseCells,
  getPackageInfo,
  getJsonSchemas,
  getTechniqueDefinitions,
  fromMatrix,
  fromNullableBoard,
  hint,
  normalizeState,
  nextStep,
  parsePuzzle,
  rate,
  replaySteps,
  invertTransform,
  search,
  selectFromCandidates,
  serializeBoard,
  SolverContext,
  summarizeAnalysis,
  summarizeRating,
  toMatrix,
  toNullableBoard,
  validate,
  validateCanonicalTransform,
  validateRatingPolicy,
  verifyStep,
  verifyWalkthrough,
  walkthrough,
} from '../src/index.js';
import type { HouseRef, RatingPolicy, StateInput, TechniqueId } from '../src/index.js';
import { runCli } from '../src/cli/index.js';
import { PuzzleMinimizer } from '../src/generator/minimizer.js';
import { SolutionGridFactory } from '../src/generator/solution-grid.js';
import { buildDefaultTechniques } from '../src/solver/techniques.js';

const STABLE_TECHNIQUE_GOLDEN_IDS = [
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
  'nishio-forcing-chains',
  'simple-coloring',
  'x-coloring',
  'multi-colors',
  'three-d-medusa',
  'grouped-x-cycles',
  'grouped-aic',
  'x-chain',
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
] as const;

const EXPERIMENTAL_TECHNIQUE_GOLDEN_IDS = [
  'aic-als',
  'big-wings',
  'remote-pairs',
  'almost-locked-quad',
  'finned-franken-swordfish',
  'finned-franken-jellyfish',
  'sashimi-x-wing',
  'larger-fish',
  'mutant-fish',
  'direct-pointing',
  'direct-claiming',
  'direct-hidden-pair',
  'direct-hidden-triplet',
  'bidirectional-x-cycle',
  'bidirectional-y-cycle',
  'forcing-x-chain',
  'forcing-chain',
  'forcing-nets',
  'digit-forcing-chains',
  'cell-forcing-chains',
  'unit-forcing-chains',
  'region-forcing-chains',
  'table-chain',
  'dynamic-forcing-chains',
  'dynamic-forcing-chains-plus',
  'nested-forcing-chains',
  'bowmans-bingo',
  'bug-plus-two',
  'bug-plus-n',
  'unique-loop',
] as const;

type TestHouse = { type: 'row' | 'col' | 'box'; index: number };

function testParseAndSerialize(): void {
  const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
  const board = parsePuzzle(puzzle);
  assert.equal(board.length, 81);
  assert.equal(serializeBoard(board), puzzle);
  assert.equal(serializeBoard(parsePuzzle(puzzle.replaceAll('0', '-'))), puzzle);
}

function testBoardAdapters(): void {
  const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
  const board = parsePuzzle(puzzle);
  const matrix = toMatrix(board);
  assert.equal(matrix.length, 9);
  assert.deepEqual(matrix[0], [5, 3, 0, 0, 7, 0, 0, 0, 0]);
  assert.equal(serializeBoard(fromMatrix(matrix)), puzzle);
  assert.equal(serializeBoard(fromMatrix(matrix.map((row) => [...row]))), puzzle);
  assert.throws(() => fromMatrix(matrix.slice(0, 8)), /9 rows/);
  assert.throws(() => fromMatrix(matrix.map((row, index) => index === 0 ? row.slice(0, 8) : row)), /row 0/);
  assert.throws(() => fromMatrix(matrix.map((row, index) => index === 0 ? [10, ...row.slice(1)] : row)), /matrix\[0\]\[0\]/);

  const nullable = toNullableBoard(board);
  assert.equal(nullable[2], null);
  assert.equal(nullable[0], 5);
  assert.equal(serializeBoard(fromNullableBoard(nullable)), puzzle);
  assert.throws(() => fromNullableBoard(nullable.slice(0, 80)), /81 cells/);
  const invalidNullable = [...nullable];
  invalidNullable[1] = 12;
  assert.throws(() => fromNullableBoard(invalidNullable), /cells\[1\]/);
}

function testPublicSourceImportGuard(): void {
  const sourceRoot = join(process.cwd(), 'src');
  const examplesRoot = join(process.cwd(), 'examples');
  const bannedPatterns = [
    /assets\//,
    /from\s+['"]cc['"]/,
    /from\s+['"](?:\/|[A-Za-z]:\\)/,
    /from\s+['"].*\.\.\/\.\./,
  ];
  for (const filePath of [...listSourceFiles(sourceRoot), ...listSourceFiles(examplesRoot)]) {
    const content = readFileSync(filePath, 'utf8');
    for (const pattern of bannedPatterns) {
      assert.equal(pattern.test(content), false, `${filePath} 不应引用外部应用框架相关路径。`);
    }
  }
}

function listSourceFiles(root: string): string[] {
  const result: string[] = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      result.push(...listSourceFiles(path));
      continue;
    }
    if (path.endsWith('.ts')) {
      result.push(path);
    }
  }
  return result;
}

function testPackageExportsDist(): void {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
    main?: string;
    types?: string;
    sideEffects?: boolean;
    exports?: { '.'?: { types?: string; default?: string } };
    files?: string[];
    keywords?: string[];
    engines?: { node?: string };
    scripts?: Record<string, string>;
    private?: boolean;
    license?: string;
    version?: string;
    author?: string;
    publishConfig?: { access?: string };
    devDependencies?: Record<string, string>;
  };
  assert.equal(packageJson.private, false);
  assert.equal(packageJson.license, 'MIT');
  assert.equal(packageJson.author, 'Cao Ruichuang');
  assert.equal(packageJson.version, '0.4.0');
  assert.equal(packageJson.publishConfig?.access, 'public');
  assert.equal(packageJson.main, './dist/src/index.js');
  assert.equal(packageJson.types, './dist/src/index.d.ts');
  assert.equal(packageJson.sideEffects, false);
  assert.equal(packageJson.exports?.['.']?.types, './dist/src/index.d.ts');
  assert.equal(packageJson.exports?.['.']?.default, './dist/src/index.js');
  assert.ok(packageJson.files?.includes('examples'));
  assert.ok(packageJson.files?.includes('CHANGELOG.md'));
  assert.ok(packageJson.files?.includes('CONTRIBUTING.md'));
  assert.ok(packageJson.files?.includes('SECURITY.md'));
  assert.equal(packageJson.files?.includes('tests/fixtures/release-smoke-corpus.json'), false);
  assert.equal(packageJson.files?.includes('scripts'), false);
  assert.ok(packageJson.keywords?.includes('sudoku'));
  assert.equal(packageJson.engines?.node, '>=20');
  assert.equal(typeof packageJson.devDependencies?.typescript, 'string');
  assert.equal(typeof packageJson.devDependencies?.['@types/node'], 'string');
  assert.equal(packageJson.scripts?.['pack:dry-run'], 'npm pack --dry-run --cache ./.npm-cache');
  assert.equal(packageJson.scripts?.prepack, 'npm run clean && npm run build');
  assert.equal(packageJson.scripts?.prepublishOnly, 'npm run verify');
  assert.equal(packageJson.scripts?.['examples:typecheck'], 'tsc -p tsconfig.examples.json --noEmit --pretty false');
  assert.equal(packageJson.scripts?.['smoke:cli'], 'npm run build && node scripts/smoke-cli.mjs');
  assert.ok(packageJson.scripts?.['smoke:dist']?.includes("import('./dist/src/index.js')"));
  assert.equal(packageJson.scripts?.['smoke:pack'], 'npm run build && node scripts/smoke-packed-package.mjs');
  assert.ok(packageJson.scripts?.verify?.includes('npm run typecheck'));
  assert.ok(packageJson.scripts?.verify?.includes('npm run audit:reference'));
  assert.ok(packageJson.scripts?.verify?.includes('npm run smoke:pack'));
  assert.ok(packageJson.scripts?.['verify:coverage']?.includes('npm run audit:coverage'));
  assert.ok(packageJson.scripts?.['verify:coverage']?.includes('npm run audit:bug-evidence'));
  assert.ok(packageJson.scripts?.['audit:reference']?.includes('scripts/audit-reference-techniques.mjs'));
  assert.ok(packageJson.scripts?.['audit:technique-priority']?.includes('scripts/audit-technique-priority.mjs'));
  assert.ok(packageJson.scripts?.['audit:stable']?.includes('scripts/audit-stable-puzzles.mjs'));
  assert.ok(packageJson.scripts?.['verify:release']?.includes('npm run verify:coverage'));
  assert.ok(packageJson.scripts?.['verify:release']?.includes('scripts/verify-release.mjs'));
  for (const scriptName of Object.keys(packageJson.scripts ?? {})) {
    assert.equal(scriptName.startsWith('internal:'), false);
  }
  assert.equal('benchmark:smoke' in (packageJson.scripts ?? {}), false);
  assert.equal('benchmark:through-rate' in (packageJson.scripts ?? {}), false);
  assert.equal('benchmark:timing' in (packageJson.scripts ?? {}), false);
  assert.deepEqual(getPackageInfo(), {
    name: '@sudoku-tools/classic9',
    version: packageJson.version,
  });
}

function testPublicRepoMaintenanceFiles(): void {
  for (const file of ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', '.gitignore', 'tsconfig.examples.json', '.github/workflows/ci.yml', 'tests/fixtures/release-smoke-corpus.json', 'scripts/smoke-cli.mjs', 'scripts/smoke-packed-package.mjs']) {
    assert.equal(existsSync(join(process.cwd(), file)), true, `${file} should exist`);
  }
  const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');
  assert.match(readme, /@sudoku-tools\/classic9/);
  assert.match(readme, /标准 9x9 数独工具库/);
  assert.match(readme, /release-smoke-corpus\.json/);
  const contributing = readFileSync(join(process.cwd(), 'CONTRIBUTING.md'), 'utf8');
  assert.doesNotMatch(contributing, /ADVANCED_TECHNIQUE_MIGRATION/);
  const ci = readFileSync(join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
  assert.match(ci, /Reference Technique Smoke Audit/);
  assert.match(ci, /npm run audit:reference/);
}

function testForbiddenCandidates(): void {
  const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
  const normalized = normalizeState({
    board: parsePuzzle(puzzle),
    constraints: {
      exactCandidatesMode: 'trusted' as const,
      forbidden: [{ cell: 2, digits: [1, 2] }],
    },
  });
  assert.equal(normalized.contradictions.length, 0);
  assert.equal(normalized.warnings.length, 0);
}

function testTrustedCandidateState(): void {
  const board = parsePuzzle('100000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const legal = normalizeState({
    board,
    constraints: {
      exactCandidates: [{ cell: 1, digits: [1] }],
    },
  });
  assert.ok(legal.contradictions.some((item) => item.type === 'invalid-constraint'));

  const trusted = normalizeState({
    board,
    constraints: {
      exactCandidatesMode: 'trusted',
      exactCandidates: [{ cell: 1, digits: [1] }],
    },
  });
  assert.equal(trusted.candidates[1], 1);
  assert.equal(trusted.contradictions.some((item) => item.type === 'invalid-constraint'), false);

  const candidateMasks = new Array<number>(81).fill(0);
  candidateMasks[1] = 1;
  const fromMasks = normalizeState({ board, candidateMasks });
  assert.equal(fromMasks.candidates[1], 1);
  assert.ok(fromMasks.contradictions.some((item) => item.type === 'illegal-candidate' && item.cell === 1));
  assert.equal(nextStep({ board, candidateMasks }), null);
}

function testStateCandidateContradictionsAndAssumptions(): void {
  const board = parsePuzzle('100000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const candidateMasks = new Array<number>(81).fill(0);
  candidateMasks[1] = 0b10;
  const missing = normalizeState({ board, candidateMasks });
  assert.ok(missing.contradictions.some((item) => item.type === 'missing-house-candidate'));

  const assumed = normalizeState({
    board,
    assumptions: [{ cell: 1, digit: 2, reason: 'branch' }],
  });
  assert.equal(assumed.candidates[1], 0b10);
  assert.equal(assumed.contradictions.some((item) => item.type === 'invalid-constraint'), false);

  const conflicting = normalizeState({
    board,
    assumptions: [{ cell: 0, digit: 2, reason: 'branch' }],
  });
  assert.ok(conflicting.contradictions.some((item) => item.type === 'invalid-constraint'));

  const peerConflict = normalizeState({
    board,
    assumptions: [{ cell: 1, digit: 1, reason: 'branch' }],
  });
  assert.ok(peerConflict.contradictions.some((item) => item.type === 'invalid-constraint'));

  const allCandidatesMask = (1 << 9) - 1;
  const conflictingCandidateMasks = new Array<number>(81).fill(allCandidatesMask);
  conflictingCandidateMasks[0] = 0b10;
  const candidateConflict = normalizeState({
    board: parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000'),
    candidateMasks: conflictingCandidateMasks,
    assumptions: [{ cell: 0, digit: 1, reason: 'branch' }],
  });
  assert.ok(candidateConflict.contradictions.some((item) => item.type === 'invalid-constraint'));

  const propagated = normalizeState({
    board: parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000'),
    assumptions: [{ cell: 0, digit: 1, reason: 'branch' }],
  });
  assert.equal(propagated.candidates[0], 1);
  assert.equal((propagated.candidates[1]! & 1), 0);
  assert.equal((propagated.candidates[9]! & 1), 0);
  assert.equal((propagated.candidates[10]! & 1), 0);
  assert.equal(propagated.contradictions.some((item) => item.type === 'invalid-constraint'), false);

  const duplicateAssumption = normalizeState({
    board: parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000'),
    assumptions: [
      { cell: 0, digit: 1, reason: 'branch' },
      { cell: 0, digit: 1, reason: 'branch' },
    ],
  });
  assert.equal(duplicateAssumption.contradictions.some((item) => item.type === 'invalid-constraint'), false);

  const sameCellAssumptionConflict = normalizeState({
    board: parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000'),
    assumptions: [
      { cell: 0, digit: 1, reason: 'branch' },
      { cell: 0, digit: 2, reason: 'branch' },
    ],
  });
  assert.ok(sameCellAssumptionConflict.contradictions.some((item) => item.type === 'invalid-constraint'));

  for (const peerCell of [1, 9, 10]) {
    const peerAssumptionConflict = normalizeState({
      board: parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000'),
      assumptions: [
        { cell: 0, digit: 1, reason: 'branch' },
        { cell: peerCell, digit: 1, reason: 'branch' },
      ],
    });
    assert.ok(peerAssumptionConflict.contradictions.some((item) => item.type === 'invalid-constraint'));
  }

  const givens = normalizeState({ board, givens: [-1, 1] });
  assert.ok(givens.warnings.some((item) => item.type === 'invalid-given-index'));
  assert.ok(givens.warnings.some((item) => item.type === 'given-index-not-filled'));
}

function testValidationConflict(): void {
  const invalid = '553070000600195000098000060800060003400803001700020006060000280000419005000080079';
  const result = validate(invalid);
  assert.equal(result.legal, false);
  assert.equal(result.hasConflict, true);

  const malformed = validate('123');
  assert.equal(malformed.legal, false);
  assert.equal(malformed.boardLengthValid, false);
  assert.ok(malformed.contradictions.some((message) => /81/.test(message)));

  const invalidChar = validate(`${'0'.repeat(80)}x`);
  assert.equal(invalidChar.legal, false);
  assert.equal(invalidChar.boardLengthValid, true);
  assert.deepEqual(invalidChar.invalidValueIndexes, [80]);
  assert.equal(invalidChar.emptyCount, 81);
  assert.ok(invalidChar.contradictions.some((message) => /Invalid character/.test(message)));

  const invalidRuntimeInput = validate(null as never);
  assert.equal(invalidRuntimeInput.legal, false);
  assert.ok(invalidRuntimeInput.contradictions.some((message) => /State input/.test(message)));
}

function testUniqueness(): void {
  const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
  const uniqueness = checkUniqueness(puzzle);
  assert.equal(uniqueness.uniqueSolution, true);
  assert.equal(uniqueness.exhausted, false);
  assert.equal(uniqueness.solutionCountLowerBound, 1);
  assert.equal(uniqueness.searchDiagnostics.nodesVisited > 0, true);
  assert.equal(uniqueness.searchDiagnostics.elapsedMs >= 0, true);
  assert.ok(uniqueness.firstSolution);

  const invalid = checkUniqueness('553070000600195000098000060800060003400803001700020006060000280000419005000080079');
  assert.equal(invalid.status, 'invalid');
  assert.equal(invalid.exhausted, false);
  assert.equal(invalid.searchDiagnostics.nodesVisited, 0);

  const aborted = checkUniqueness('000000000000000000000000000000000000000000000000000000000000000000000000000000000', { maxElapsedMs: 1 });
  assert.equal(aborted.searchDiagnostics.maxElapsedMs, 1);
  assert.equal(aborted.solutionCountLowerBound, aborted.solutionCount);
  if (aborted.status === 'aborted') {
    assert.equal(aborted.aborted, true);
    assert.equal(aborted.exhausted, true);
    assert.ok(aborted.diagnostics.some((message) => /time budget/.test(message)));
  } else {
    assert.equal(aborted.aborted, false);
    assert.equal(aborted.exhausted, false);
    assert.ok(['no-solution', 'unique', 'multiple'].includes(aborted.status));
  }
}

function testCanonicalize(): void {
  const puzzle = parsePuzzle('530070000600195000098000060800060003400803001700020006060000280000419005000080079');
  const solution = parsePuzzle('534678912672195348198342567859761423426853791713924856961537284287419635345286179');
  const canonicalPuzzle = canonicalizeBoard(puzzle);
  const canonicalPair = canonicalizePair(puzzle, solution);
  assert.equal(canonicalPuzzle.key, canonicalPair.key);
  assert.equal(canonicalPair.solution.length, 81);
  const restored = applyTransformToBoard(canonicalPuzzle.board, invertTransform(canonicalPuzzle.transform));
  assert.equal(serializeBoard(restored), serializeBoard(puzzle));
  assert.doesNotThrow(() => validateCanonicalTransform(canonicalPuzzle.transform));
  assert.throws(() => validateCanonicalTransform({
    ...canonicalPuzzle.transform,
    rowOrder: [0, 0, 2, 3, 4, 5, 6, 7, 8],
  }), /rowOrder/);
  assert.throws(() => applyTransformToBoard(puzzle, {
    ...canonicalPuzzle.transform,
    digitMap: [0, 1, 1, 3, 4, 5, 6, 7, 8, 9],
  }), /digitMap/);

  const emptyPuzzle = new Array<number>(81).fill(0);
  const sparsePuzzle = parsePuzzle('100000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const emptyPair = canonicalizePair(emptyPuzzle, solution);
  assert.equal(emptyPair.solution.length, 81);
  assert.throws(() => canonicalizePair(puzzle, parsePuzzle('034678912672195348198342567859761423426853791713924856961537284287419635345286179')), /complete/);
  assert.throws(() => canonicalizePair(puzzle, parsePuzzle('634678912672195348198342567859761423426853791713924856961537284287419635345286179')), /clue/);
  assert.throws(() => canonicalizePair(emptyPuzzle, parsePuzzle('554678912672195348198342567859761423426853791713924856961537284287419635345286179')), /duplicate/);
  assert.doesNotThrow(() => validateCanonicalTransform(canonicalizeBoard(emptyPuzzle).transform));
  assert.doesNotThrow(() => validateCanonicalTransform(canonicalizeBoard(sparsePuzzle).transform));
  assert.doesNotThrow(() => validateCanonicalTransform(emptyPair.transform));
}

function testPublicBoardValueValidation(): void {
  const invalidValues = [-1, 10, 12, NaN, 1.5];
  const emptyTransform = canonicalizeBoard(new Array<number>(81).fill(0)).transform;
  for (const value of invalidValues) {
    const board = new Array<number>(81).fill(0);
    board[0] = value;
    assert.throws(() => serializeBoard(board), /invalid value/i);
    assert.throws(() => canonicalizeBoard(board), /invalid value/i);
    assert.throws(() => applyTransformToBoard(board, emptyTransform), /invalid value/i);
  }
}

function testPublicGridTablesAreImmutable(): void {
  assert.ok(Object.isFrozen(ALL_HOUSES));
  assert.ok(Object.isFrozen(CELL_TO_PEERS));
  assert.ok(Object.isFrozen(CELL_TO_PEERS[0]));
  const rowCells = getHouseCells({ type: 'row', index: 0 });
  rowCells.length = 0;
  assert.equal(getHouseCells({ type: 'row', index: 0 }).length, 9);
  assert.equal(CELL_TO_PEER_SET[0]?.has(1), true);
  assert.equal(typeof (CELL_TO_PEER_SET[0] as { clear?: unknown } | undefined)?.clear, 'undefined');
}

function testCanonicalTransformStateAndStep(): void {
  const puzzle = parsePuzzle('530070000600195000098000060800060003400803001700020006060000280000419005000080079');
  const canonical = canonicalizeBoard(puzzle);
  const state = {
    board: puzzle,
    candidateMasks: puzzle.map((value, cell) => (value === 0 && cell === 2 ? 0b11 : 0)),
    givens: [0, 1],
    constraints: {
      exactCandidatesMode: 'trusted' as const,
      forbidden: [{ cell: 2, digits: [1, 2] }],
      exactCandidates: [{ cell: 3, digits: [4, 6] }],
      pencilMarks: [{ cell: 4, digits: [7] }],
    },
    assumptions: [{ cell: 2, digit: 1 as const, reason: '测试' }],
  };
  const transformed = applyTransformToState(state, canonical.transform);
  const restored = applyTransformToState(transformed, invertTransform(canonical.transform));
  assert.equal(serializeBoard(restored.board), serializeBoard(state.board));
  assert.deepEqual(restored.givens, state.givens);
  assert.deepEqual(restored.candidateMasks, state.candidateMasks);
  assert.deepEqual(restored.constraints?.forbidden, state.constraints.forbidden);
  assert.equal(restored.constraints?.exactCandidatesMode, state.constraints.exactCandidatesMode);
  assert.deepEqual(restored.constraints?.exactCandidates, state.constraints.exactCandidates);
  assert.deepEqual(restored.constraints?.pencilMarks, state.constraints.pencilMarks);
  assert.deepEqual(restored.assumptions, state.assumptions);

  const step = nextStep({
    board: puzzle,
    constraints: {
      exactCandidates: [{ cell: 2, digits: [1] }],
    },
  }, { allowContradictoryCandidateState: true, allowedTechniques: ['naked-single'] });
  assert.ok(step);
  const transformedStep = applyTransformToStep(step, canonical.transform);
  const restoredStep = applyTransformToStep(transformedStep, invertTransform(canonical.transform));
  assert.deepEqual(restoredStep.actions, step.actions);
  assert.deepEqual(restoredStep.evidence.cells, step.evidence.cells);

  const branchStep = {
    technique: 'forcing-nets' as const,
    score: 220,
    actions: [{ type: 'place' as const, cell: 2, digit: 1 as const }],
    evidence: {
      branches: [
        {
          assumption: { type: 'eliminate' as const, cell: 3, digit: 4 as const },
          contradiction: false,
          exhausted: true,
          actions: [
            { type: 'place' as const, cell: 4, digit: 7 as const },
            { type: 'eliminate' as const, cell: 5, digit: 8 as const },
          ],
        },
      ],
    },
  };
  const transformedBranchStep = applyTransformToStep(branchStep, canonical.transform);
  const restoredBranchStep = applyTransformToStep(transformedBranchStep, invertTransform(canonical.transform));
  assert.deepEqual(restoredBranchStep.evidence.branches, branchStep.evidence.branches);

  const contradictionBranchStep = {
    technique: 'bowmans-bingo' as const,
    score: 248,
    actions: [{ type: 'eliminate' as const, cell: 8, digit: 9 as const }],
    evidence: {
      branches: [
        {
          assumption: { type: 'place' as const, cell: 0, digit: 5 as const },
          contradiction: true,
          exhausted: true,
          contradictionAt: {
            kind: 'house-missing' as const,
            house: { type: 'row' as const, index: 1 },
            digit: 6 as const,
          },
        },
      ],
    },
  };
  const transformedContradictionBranchStep = applyTransformToStep(contradictionBranchStep, canonical.transform);
  const restoredContradictionBranchStep = applyTransformToStep(
    transformedContradictionBranchStep,
    invertTransform(canonical.transform),
  );
  assert.deepEqual(restoredContradictionBranchStep.evidence.branches, contradictionBranchStep.evidence.branches);
}

function testCli(): void {
  const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
  const validateResult = runCli(['validate', puzzle]);
  assert.equal(validateResult.exitCode, 0);
  assert.equal(typeof validateResult.output, 'object');

  const canonicalResult = runCli(['canonicalize', puzzle]);
  assert.equal(canonicalResult.exitCode, 0);
  assert.equal(typeof canonicalResult.output, 'object');

  const missingArg = runCli(['validate']);
  assert.equal(missingArg.exitCode, 1);

  const malformedValidate = runCli(['validate', '123']);
  assert.equal(malformedValidate.exitCode, 0);
  assert.equal((malformedValidate.output as { legal?: boolean }).legal, false);

  const helpResult = runCli(['help']);
  assert.equal(helpResult.exitCode, 0);
  assert.equal((helpResult.output as { package?: string }).package, '@sudoku-tools/classic9');
  assert.equal((helpResult.output as { version?: string }).version, '0.4.0');

  const versionResult = runCli(['version']);
  assert.equal(versionResult.exitCode, 0);
  assert.deepEqual(versionResult.output, {
    name: '@sudoku-tools/classic9',
    version: '0.4.0',
  });
}

function testTechniquesCli(): void {
  const result = runCli(['techniques']);
  assert.equal(result.exitCode, 0);
  assert.ok(Array.isArray(result.output));
  const techniques = result.output as Array<{ id?: string; aliases?: string[]; seStatus?: string; seDifficulty?: string }>;
  const fullHouse = techniques.find((item) => item.id === 'full-house');
  assert.ok(fullHouse);
  assert.ok(fullHouse.aliases?.includes('Last value'));
  assert.equal(fullHouse.seStatus, 'covered');
  assert.equal(fullHouse.seDifficulty, '1.0');
}

function testStableTechniqueGoldenCoverage(): void {
  const stableIds = getTechniqueDefinitions()
    .filter((definition) => definition.stability === 'stable')
    .map((definition) => definition.id)
    .sort();
  assert.deepEqual(stableIds, [...STABLE_TECHNIQUE_GOLDEN_IDS].sort());
}

function testExperimentalTechniqueDefinitions(): void {
  const experimentalIds = getTechniqueDefinitions()
    .filter((definition) => definition.stability === 'experimental')
    .map((definition) => definition.id)
    .sort();
  assert.deepEqual(experimentalIds, [...EXPERIMENTAL_TECHNIQUE_GOLDEN_IDS].sort());

  const patternState = buildExactCandidateState([
    [0, [1, 8]],
    [12, [1, 8]],
    [24, [1, 8]],
    [28, [1, 8]],
    [40, [1, 8]],
    [52, [1, 8]],
    [56, [1, 8]],
    [68, [1, 8]],
    [80, [1, 8]],
  ]);
  assert.equal(nextStep(patternState, { allowContradictoryCandidateState: true, allowedTechniques: ['pattern-overlay'] })?.technique, 'pattern-overlay');

  const forcingState = buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  );
  assert.equal(nextStep(forcingState)?.technique === 'forcing-nets', false);
  assert.equal(nextStep(forcingState, { allowContradictoryCandidateState: true, allowedTechniques: ['forcing-nets'] })?.technique, 'forcing-nets');
}

function testTechniqueDefinitionBoundaryIntegrity(): void {
  const allDefinitionIds = getTechniqueDefinitions()
    .map((definition) => definition.id)
    .sort();
  const goldenIds = [
    ...STABLE_TECHNIQUE_GOLDEN_IDS,
    ...EXPERIMENTAL_TECHNIQUE_GOLDEN_IDS,
  ].sort();
  assert.deepEqual(allDefinitionIds, goldenIds);

  const stableSet = new Set<TechniqueId>(STABLE_TECHNIQUE_GOLDEN_IDS);
  const experimentalSet = new Set<TechniqueId>(EXPERIMENTAL_TECHNIQUE_GOLDEN_IDS);
  for (const definition of getTechniqueDefinitions()) {
    assert.ok(definition.seStatus, `${definition.id} 应声明 SE 兼容状态。`);
    if (definition.seStatus !== 'non-se-extension') {
      assert.ok(definition.aliases?.length, `${definition.id} 应声明 SE alias。`);
    }
  }
  for (const id of stableSet) {
    assert.equal(experimentalSet.has(id), false, `${id} 不应同时属于 stable 和 experimental。`);
  }

  const stablePolicy = getDefaultRatingPolicy();
  assert.equal(
    stablePolicy.techniqueOrder.every((id) => stableSet.has(id)),
    true,
    'classic-stable 不应包含 experimental 技巧。',
  );

  const extendedPolicy = getRatingPolicy('classic-extended');
  assert.equal(
    extendedPolicy.techniqueOrder.every((id) => stableSet.has(id)),
    true,
    'classic-extended 的主顺序不应包含 experimental 技巧。',
  );
  assert.equal(
    (extendedPolicy.fallbackTechniques ?? []).every((id) => experimentalSet.has(id)),
    true,
    'classic-extended fallback 只能包含 experimental 技巧。',
  );

  const galaxyPolicy = getRatingPolicy('classic-galaxy');
  assert.deepEqual(galaxyPolicy.techniqueOrder, CLASSIC_GALAXY_TECHNIQUE_ORDER);
  assert.equal(galaxyPolicy.techniqueOrder.includes('nested-forcing-chains'), false);
  assert.equal(galaxyPolicy.fallbackTechniques?.includes('nested-forcing-chains') ?? false, false);
  assert.equal(galaxyPolicy.techniqueOrder.includes('bowmans-bingo'), false);
  assert.equal(galaxyPolicy.fallbackTechniques?.includes('bowmans-bingo'), true);
  assert.equal(galaxyPolicy.fallbackTechniques?.includes('table-chain'), true);
  assert.equal(galaxyPolicy.fallbackTechniques?.includes('dynamic-forcing-chains'), true);
  assert.equal(galaxyPolicy.fallbackTechniques?.includes('dynamic-forcing-chains-plus'), true);
  assertTechniqueBefore(galaxyPolicy.techniqueOrder, 'direct-pointing', 'naked-pair');
  assertTechniqueBefore(galaxyPolicy.techniqueOrder, 'bidirectional-x-cycle', 'exocet');
}

function testSolverFullHouse(): void {
  const almostSolved = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';
  const analysis = walkthrough(almostSolved);
  assert.equal(analysis.solved, true);
  assert.equal(analysis.steps.length, 1);
  assert.equal(analysis.steps[0]?.technique, 'full-house');
  assert.deepEqual(analysis.steps[0]?.evidence.pattern, { family: 'full-house', subtype: 'row' });
  const replayed = replaySteps(almostSolved, analysis.steps);
  assert.equal(serializeBoard(replayed), '534678912672195348198342567859761423426853791713924856961537284287419635345286179');
}

function testHiddenSinglePatternEvidence(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [1, [2, 8]],
    [2, [3, 8]],
    [3, [4, 8]],
    [4, [5, 8]],
    [5, [6, 8]],
    [6, [7, 8]],
    [7, [8, 9]],
    [8, [8, 9]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['hidden-single'] });
  assert.equal(step?.technique, 'hidden-single');
  assert.deepEqual(step?.evidence.pattern, { family: 'hidden-single', subtype: 'row' });
}

function testInvalidFilledBoardNotSolved(): void {
  const invalidFilled = '554678912672195348198342567859761423426853791713924856961537284287419635345286179';
  assert.equal(validate(invalidFilled).legal, false);

  const analysis = walkthrough(invalidFilled);
  assert.equal(analysis.solved, false);
  assert.equal(analysis.stuckReason, 'contradiction');

  const rating = rate(invalidFilled);
  assert.equal(rating.solved, false);
  assert.equal(rating.grade, null);
  assert.equal(rating.stuckReason, 'contradiction');
}

function testVerifyStepAndWalkthrough(): void {
  const almostSolved = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';
  const analysis = walkthrough(almostSolved);
  const step = analysis.steps[0]!;
  const stepVerification = verifyStep(almostSolved, step);
  assert.equal(stepVerification.valid, true);
  assert.equal(stepVerification.after?.board[80], 9);

  const walkthroughVerification = verifyWalkthrough(almostSolved, analysis.steps);
  assert.equal(walkthroughVerification.valid, true);
  assert.equal(walkthroughVerification.solved, true);
  assert.equal(serializeBoard(walkthroughVerification.finalBoard), '534678912672195348198342567859761423426853791713924856961537284287419635345286179');

  const invalidPlacement = verifyStep(almostSolved, {
    ...step,
    actions: [{ type: 'place', cell: 80, digit: 8 }],
  });
  assert.equal(invalidPlacement.valid, false);
  assert.ok(invalidPlacement.issues.some((issue) => issue.code === 'place-digit-not-candidate'));

  const invalidEvidence = verifyStep(almostSolved, {
    ...step,
    evidence: {
      houses: [{ type: 'row', index: 10 }],
    },
  } as never);
  assert.equal(invalidEvidence.valid, false);
  assert.ok(invalidEvidence.issues.some((issue) => issue.code === 'invalid-evidence-house'));

  const actionOnly = verifyStep(almostSolved, {
    ...step,
    evidence: {
      houses: [{ type: 'row', index: 10 }],
    },
  } as never, { mode: 'action' });
  assert.equal(actionOnly.valid, true);

  const actionOnlyWithoutEvidence = verifyStep(almostSolved, {
    ...step,
    evidence: undefined,
  } as never, { mode: 'action' });
  assert.equal(actionOnlyWithoutEvidence.valid, true);

  const invalidActionType = verifyStep(almostSolved, {
    ...step,
    actions: [{ type: 'noop', cell: 80, digit: 9 }],
  } as never);
  assert.equal(invalidActionType.valid, false);
  assert.ok(invalidActionType.issues.some((issue) => issue.code === 'invalid-action-type'));
  assert.deepEqual(invalidActionType.after?.board, invalidActionType.before.board);
  assert.deepEqual(invalidActionType.after?.candidates, invalidActionType.before.candidates);

  const invalidMultiAction = verifyStep({
    board: parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000'),
    candidateMasks: new Array<number>(81).fill(0).map((_, index) => (index === 0 || index === 1) ? 1 : 0),
  }, {
    ...step,
    actions: [
      { type: 'place', cell: 0, digit: 1 },
      { type: 'place', cell: 1, digit: 1 },
    ],
  } as never, { mode: 'action' });
  assert.equal(invalidMultiAction.valid, false);
  assert.equal(invalidMultiAction.after?.board[0], 0);
  assert.equal(invalidMultiAction.after?.board[1], 0);

  const noopElimination = verifyStep(almostSolved, {
    ...step,
    actions: [{ type: 'eliminate', cell: 80, digit: 8 }],
  }, { mode: 'action', allowNoopEliminations: true });
  assert.equal(noopElimination.valid, false);
  assert.ok(noopElimination.issues.some((issue) => issue.code === 'eliminate-missing-candidate'));

  const invalidWalkthroughActionType = verifyWalkthrough(almostSolved, [{
    ...step,
    actions: [{ type: 'noop', cell: 80, digit: 9 }],
  } as never]);
  assert.equal(invalidWalkthroughActionType.valid, false);
  assert.equal(invalidWalkthroughActionType.firstInvalidStepIndex, 0);
  assert.equal(serializeBoard(invalidWalkthroughActionType.finalBoard), almostSolved);

  const invalidActionContext = new SolverContext(almostSolved);
  const boardBeforeInvalidApply = [...invalidActionContext.board];
  const candidatesBeforeInvalidApply = [...invalidActionContext.candidates];
  assert.throws(() => invalidActionContext.applyStep({
    ...step,
    actions: [{ type: 'noop', cell: 80, digit: 9 }],
  } as never), /未知动作类型/);
  assert.deepEqual(invalidActionContext.board, boardBeforeInvalidApply);
  assert.deepEqual(invalidActionContext.candidates, candidatesBeforeInvalidApply);

  assert.throws(() => replaySteps(almostSolved, [{
    ...step,
    actions: [{ type: 'noop', cell: 80, digit: 9 }],
  } as never]), /未知动作类型/);

  assert.throws(() => replaySteps(almostSolved, [{
    ...step,
    actions: [{ type: 'place', cell: -1, digit: 9 }],
  } as never]), /无效格子索引/);
  assert.throws(() => replaySteps(almostSolved, [{
    ...step,
    actions: [{ type: 'place', cell: 80, digit: 10 }],
  } as never]), /无效数字/);
  assert.throws(() => replaySteps(almostSolved, [{
    ...step,
    actions: [{ type: 'place', cell: 0, digit: 5 }],
  } as never]), /已填格/);
  assert.throws(() => replaySteps(almostSolved, [{
    ...step,
    actions: [{ type: 'eliminate', cell: 80, digit: 8 }],
  } as never]), /不是候选/);
  const conflictingPlaceContext = new SolverContext({
    board: parsePuzzle('100000000000000000000000000000000000000000000000000000000000000000000000000000000'),
    candidates: new Array<number>(81).fill(0).map((_, index) => index === 1 ? 1 : 0),
    givens: new Array<boolean>(81).fill(false),
    contradictions: [],
    warnings: [],
  });
  assert.throws(() => conflictingPlaceContext.applyStep({
    ...step,
    actions: [{ type: 'place', cell: 1, digit: 1 }],
  } as never), /冲突/);
  assert.throws(() => conflictingPlaceContext.placeDigit(1, 1), /冲突/);

  const multiActionContext = new SolverContext({
    board: parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000'),
    candidates: new Array<number>(81).fill(0).map((_, index) => (index === 0 || index === 1) ? 1 : 0),
    givens: new Array<boolean>(81).fill(false),
    contradictions: [],
    warnings: [],
  });
  assert.throws(() => multiActionContext.applyStep({
    ...step,
    actions: [
      { type: 'place', cell: 0, digit: 1 },
      { type: 'place', cell: 1, digit: 1 },
    ],
  } as never), /候选|冲突|已填格/);
  assert.equal(multiActionContext.board[0], 0);
  assert.equal(multiActionContext.board[1], 0);

  const malformedAction = verifyStep(almostSolved, {
    ...step,
    actions: [null],
  } as never);
  assert.equal(malformedAction.valid, false);
  assert.ok(malformedAction.issues.some((issue) => issue.code === 'invalid-action-shape'));

  const malformedStep = verifyStep(almostSolved, {
    technique: 'full-house',
    score: 10,
    actions: [{ type: 'place', cell: 80, digit: 9 }],
  } as never);
  assert.equal(malformedStep.valid, false);
  assert.ok(malformedStep.issues.some((issue) => issue.code === 'invalid-step-shape'));

  const malformedEvidence = verifyStep(almostSolved, {
    ...step,
    evidence: {
      houses: [null],
      cells: [null],
      links: [null],
      nodes: [null],
      pattern: { family: '' },
      branches: [{}],
    },
  } as never);
  assert.equal(malformedEvidence.valid, false);
  assert.ok(malformedEvidence.issues.some((issue) => issue.code === 'invalid-evidence-house'));
  assert.ok(malformedEvidence.issues.some((issue) => issue.code === 'invalid-evidence-cell'));
  assert.ok(malformedEvidence.issues.some((issue) => issue.code === 'invalid-evidence-link'));
  assert.ok(malformedEvidence.issues.some((issue) => issue.code === 'invalid-evidence-node'));
  assert.ok(malformedEvidence.issues.some((issue) => issue.code === 'invalid-evidence-pattern'));
  assert.ok(malformedEvidence.issues.some((issue) => issue.code === 'invalid-evidence-branch'));

  const invalidBranchKind = verifyStep(almostSolved, {
    ...step,
    evidence: {
      branches: [{
        assumption: { type: 'place', cell: 80, digit: 9 },
        contradiction: true,
        exhausted: true,
        contradictionAt: { kind: 'nonsense', cell: 80 },
      }],
    },
  } as never);
  assert.equal(invalidBranchKind.valid, false);
  assert.ok(invalidBranchKind.issues.some((issue) => issue.code === 'invalid-evidence-branch'));

  const invalidInitialWalkthrough = verifyWalkthrough({
    board: new Array<number>(80).fill(0),
  }, []);
  assert.equal(invalidInitialWalkthrough.valid, false);
  assert.equal(invalidInitialWalkthrough.stuckReason, 'contradiction');
  assert.ok(invalidInitialWalkthrough.stepResults[0]?.issues.some((issue) => issue.code === 'initial-state-contradiction'));
}

function testAnalyzeSolveUsage(): void {
  const almostSolved = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';
  const walkthroughAnalysis = walkthrough(almostSolved);
  const analyzed = analyzeSolve(almostSolved, { includeUsage: true });
  assert.equal(analyzed.solved, walkthroughAnalysis.solved);
  assert.deepEqual(analyzed.steps, walkthroughAnalysis.steps);
  assert.equal(analyzed.score, walkthroughAnalysis.score);
  assert.equal(analyzed.hardestTechnique, walkthroughAnalysis.hardestTechnique);
  assert.ok(analyzed.usage);
  assert.equal(analyzed.usage?.totalHits, 1);
  assert.equal(analyzed.usage?.totalPlacements, 1);
  assert.equal(analyzed.usage?.totalEliminations, 0);
  assert.equal(analyzed.usage?.byTechnique['full-house']?.hits, 1);
  assert.equal(analyzed.usage?.byTechnique['full-house']?.placements, 1);
  assert.ok((analyzed.usage?.totalCalls ?? 0) >= 1);
  assert.ok((analyzed.usage?.totalElapsedMs ?? 0) >= 0);

  const noUsage = analyzeSolve(almostSolved);
  assert.equal('usage' in noUsage, false);

  const invalidCandidateState = {
    board: parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000'),
    candidateMasks: new Array<number>(81).fill(0),
  };
  const invalidWalkthrough = walkthrough(invalidCandidateState);
  assert.equal(invalidWalkthrough.solved, false);
  assert.equal(invalidWalkthrough.stuckReason, 'contradiction');
  const invalidAnalyze = analyzeSolve(invalidCandidateState, { includeUsage: true });
  assert.equal(invalidAnalyze.solved, false);
  assert.equal(invalidAnalyze.stuckReason, 'contradiction');
  assert.equal(invalidAnalyze.usage?.totalCalls, 0);
}

function testIllegalCandidateStateBlocksContradictoryScan(): void {
  const state = {
    board: parsePuzzle('100000000000000000000000000000000000000000000000000000000000000000000000000000000'),
    candidateMasks: new Array<number>(81).fill(0).map((_, index) => index === 1 ? 1 : 0),
  };
  assert.equal(nextStep(state, { allowContradictoryCandidateState: true, allowedTechniques: ['naked-single'] }), null);
  const analysis = walkthrough(state, { allowContradictoryCandidateState: true, allowedTechniques: ['naked-single'] });
  assert.equal(analysis.solved, false);
  assert.equal(analysis.stuckReason, 'contradiction');
}

function testSolverNakedSingleWithForbiddenCandidate(): void {
  const state = {
    board: parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000'),
    constraints: {
      exactCandidates: [{ cell: 0, digits: [1] }],
    },
  };
  const analysis = walkthrough(state, { maxSteps: 1 });
  assert.equal(analysis.steps[0]?.technique, 'naked-single');
  assert.deepEqual(analysis.steps[0]?.actions, [{ type: 'place', cell: 0, digit: 1 }]);
}

function testSolveCli(): void {
  const almostSolved = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';
  const result = runCli(['solve', almostSolved]);
  assert.equal(result.exitCode, 0);
  assert.equal(typeof result.output, 'object');
}

function testExtendedSolveProfile(): void {
  const puzzle = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';
  const analysis = walkthrough(puzzle, buildSolveOptionsFromRatingPolicy(getRatingPolicy('classic-extended')));
  assert.equal(analysis.solved, true);
}

function testExtendedGeneratorPolicyIncludesFallback(): void {
  const analysis = analyzeGenerationRequest({
    ratingPolicy: getRatingPolicy('classic-extended'),
    constraints: {
      allowedTechniques: ['bowmans-bingo'],
      requiredTechniques: [{ type: 'appears', techniques: ['bowmans-bingo'] }],
    },
  });
  assert.equal(analysis.status === 'invalid', false);
  assert.equal(analysis.feasibility.allowedTechniqueCount, 1);

  const result = generateOne({
    ratingPolicy: getRatingPolicy('classic-extended'),
    seed: 1,
    minimality: 'none',
    constraints: {
      allowedTechniques: ['bowmans-bingo'],
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  });
  assert.notEqual(result.status, 'invalid-request');
  const policy = result.requestAnalysis.feasibility.allowedTechniqueCount;
  assert.equal(policy, 1);

  const solveOptions = buildSolveOptionsFromRatingPolicy(getRatingPolicy('classic-extended'));
  assert.equal(solveOptions.preferredTechniques?.includes('bowmans-bingo') ?? false, false);
  assert.equal(solveOptions.fallbackTechniques?.includes('bowmans-bingo') ?? false, true);

  const allowFullHouseOnly = runCli(['solve',
    '006000400000050070070100030800079006060301050700620004090007020030060000008000900',
    '--profile',
    'extended',
    '--allow',
    'full-house',
  ]);
  assert.equal(allowFullHouseOnly.exitCode, 0);
  assert.equal((allowFullHouseOnly.output as { steps?: Array<{ technique?: string }> }).steps?.some((item) => item.technique === 'bowmans-bingo'), false);
  assert.equal((allowFullHouseOnly.output as { steps?: Array<{ technique?: string }> }).steps?.some((item) => item.technique === 'forcing-nets'), false);
  assert.equal((allowFullHouseOnly.output as { steps?: Array<{ technique?: string }> }).steps?.length ?? 0, 0);
}

function testFindTechniqueScenario(): void {
  const puzzle = '006000400000050070070100030800079006060301050700620004090007020030060000008000900';
  const scenario = findTechniqueScenario(
    puzzle,
    ['bowmans-bingo'],
    { allowContradictoryCandidateState: true, allowedTechniques: ['bowmans-bingo'] },
  );
  assert.ok(scenario);
  assert.equal(scenario?.step.technique, 'bowmans-bingo');
  assert.ok(scenario?.step.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 8));
}

function testRate(): void {
  const almostSolved = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';
  const result = rate(almostSolved);
  assert.equal(result.solved, true);
  assert.equal(result.score, 10);
  assert.equal(result.grade, 'basic');
  assert.equal(result.hardestTechnique, 'full-house');
  assert.equal(result.ratingPolicyId, 'classic-stable');
  assert.equal(result.ratingPolicyVersion, '1');
  assert.equal(result.techniqueCounts['full-house'], 1);

  const badPolicy = {
    id: 'bad',
    version: '1',
    techniqueOrder: ['not-a-technique'],
    techniqueScores: { 'not-a-technique': 100 },
    maxSteps: 10,
  };
  assert.throws(() => rate(almostSolved, badPolicy as never), /未知技巧/);
  assert.throws(() => buildSolveOptionsFromRatingPolicy(badPolicy as never), /未知技巧/);
  assert.throws(() => getRatingPolicy('typo' as never), /未知评分策略/);
  assert.throws(() => buildSolveOptionsFromRatingPolicy(undefined as never), /ratingPolicy 必须是 object/);
  assert.deepEqual(validateRatingPolicy(undefined as never).map((issue) => issue.code), ['invalid-rating-policy']);

  const missingScorePolicy = {
    id: 'missing-score',
    version: '1',
    techniqueOrder: ['full-house'],
    techniqueScores: {},
  };
  assert.throws(() => rate(almostSolved, missingScorePolicy as never), /缺少已启用技巧分值/);

  const badGradePolicy = {
    id: 'bad-grade',
    version: '1',
    techniqueOrder: ['full-house'],
    techniqueScores: { 'full-house': 10 },
    gradeRules: [{ grade: 'bad', minScore: 100, maxScore: 10 }],
  };
  assert.throws(() => rate(almostSolved, badGradePolicy as never), /minScore 不能大于 maxScore/);
}

function testHintAndSummaries(): void {
  const puzzle = parsePuzzle('534678912672195348198342567859761423426853791713924856961537284287419635345286170');
  const directStep = nextStep(puzzle);
  const result = hint(puzzle, { format: { locale: 'zh-CN' } });
  assert.equal(result.found, true);
  assert.equal(result.step?.technique, directStep?.technique);
  assert.equal(result.technique, directStep?.technique);
  assert.equal(result.actions?.length, directStep?.actions.length);
  assert.match(result.text ?? '', /满屋法/);

  const solved = hint(parsePuzzle('534678912672195348198342567859761423426853791713924856961537284287419635345286179'));
  assert.equal(solved.found, false);
  assert.equal(solved.stuckReason, 'solved');

  const invalid = hint(parsePuzzle('554678912672195348198342567859761423426853791713924856961537284287419635345286179'));
  assert.equal(invalid.found, false);
  assert.equal(invalid.stuckReason, 'contradiction');

  const noMatch = hint(parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000'), {
    allowedTechniques: ['x-wing'],
  });
  assert.equal(noMatch.found, false);
  assert.equal(noMatch.stuckReason, 'no-technique-match');

  const analysis = walkthrough(puzzle);
  const analysisSummary = summarizeAnalysis(analysis);
  assert.equal(analysisSummary.solved, true);
  assert.equal(analysisSummary.stepCount, analysis.steps.length);
  assert.equal(analysisSummary.techniqueCounts['full-house'], 1);
  assert.equal(analysisSummary.placementCount, 1);

  const rating = rate(puzzle);
  const ratingSummary = summarizeRating(rating);
  assert.equal(ratingSummary.ratingPolicyId, 'classic-stable');
  assert.equal(ratingSummary.ratingPolicyVersion, '1');
  assert.equal(ratingSummary.grade, rating.grade);
  assert.equal(ratingSummary.techniqueCounts['full-house'], 1);
}

function testExtendedRate(): void {
  const puzzle = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';
  const result = rate(puzzle, getRatingPolicy('classic-extended'));
  assert.equal(result.solved, true);
  assert.equal(result.ratingPolicyId, 'classic-extended');
  assert.equal(result.ratingPolicyVersion, '1');
}

function testAllowedTechniqueOrder(): void {
  const state = {
    board: parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000'),
    constraints: {
      exactCandidates: [
        { cell: 0, digits: [1, 2] },
        { cell: 1, digits: [1, 2] },
        { cell: 2, digits: [1, 2, 3] },
      ],
    },
  };
  const allowedKeepsDefaultOrder = nextStep(state, { allowContradictoryCandidateState: true, allowedTechniques: ['naked-triple', 'naked-pair'] });
  assert.equal(allowedKeepsDefaultOrder?.technique, 'naked-pair');

  const preferredTriple = nextStep(state, {
    allowedTechniques: ['naked-pair', 'naked-triple'],
    preferredTechniques: ['naked-triple'],
  });
  assert.equal(preferredTriple?.technique, 'naked-triple');

  const rated = rate(state, {
    id: 'order-test',
    version: '1',
    techniqueOrder: ['naked-triple', 'naked-pair'],
    techniqueScores: {
      'naked-triple': 31,
      'naked-pair': 17,
    } as never,
    maxSteps: 1,
  });
  assert.equal(rated.steps[0]?.technique, 'naked-triple');
  assert.equal(rated.score, 31);
}

function testExperimentalForcingDefaultsToFallback(): void {
  const forcingState = buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  );
  assert.equal(nextStep(forcingState)?.technique === 'forcing-nets', false);
  assert.equal(nextStep(forcingState, { allowContradictoryCandidateState: true, allowedTechniques: ['forcing-nets'] })?.technique, 'forcing-nets');
  assert.equal(nextStep(forcingState, {
    allowContradictoryCandidateState: true,
    allowedTechniques: ['forcing-nets', 'full-house'],
    preferredTechniques: ['forcing-nets'],
  })?.technique, 'forcing-nets');

  const primaryFindSteps = findSteps(forcingState, {
    allowContradictoryCandidateState: true,
    allowedTechniques: ['full-house', 'naked-single', 'hidden-single', 'forcing-nets'],
    includeDiagnostics: true,
    sort: 'score-desc',
  });
  assert.equal(primaryFindSteps.steps.some((step) => step.technique === 'forcing-nets'), false);
  assert.equal(primaryFindSteps.diagnostics?.techniqueCalls['forcing-nets'], undefined);

  const fallbackFindSteps = findSteps(forcingState, {
    allowContradictoryCandidateState: true,
    allowedTechniques: ['forcing-nets'],
    includeDiagnostics: true,
  });
  assert.equal(fallbackFindSteps.steps[0]?.technique, 'forcing-nets');
  assert.equal(fallbackFindSteps.diagnostics?.techniqueCalls['forcing-nets'], 1);
}

function testForcingBranchInvalidInternalStepDoesNotEscape(): void {
  const state = buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  );
  assert.doesNotThrow(() => findSteps(state, {
    allowContradictoryCandidateState: true,
    allowedTechniques: ['forcing-nets'],
    preferredTechniques: ['forcing-nets'],
    fallbackTechniques: [],
    limit: 1,
    includeDiagnostics: true,
  }));
}

function testSolverMaxStepsAndScenarioContradictionGuards(): void {
  const solvedPuzzle = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
  assert.throws(() => walkthrough(solvedPuzzle, { maxSteps: 0 }), /maxSteps 必须是正整数/);
  assert.throws(() => analyzeSolve(solvedPuzzle, { maxSteps: 0 }), /maxSteps 必须是正整数/);
  assert.throws(() => findTechniqueScenario(solvedPuzzle, ['full-house'], { maxSteps: 0 }), /maxSteps 必须是正整数/);

  const invalidCandidateState = {
    board: parsePuzzle('534678912672195348198342567859761423426853791713924856961537284287419600345286100'),
    candidateMasks: new Array<number>(80).fill(0),
  };
  assert.equal(nextStep(invalidCandidateState), null);
  assert.equal(findTechniqueScenario(invalidCandidateState, ['full-house']), null);

  const patternState = buildExactCandidateState([
    [0, [1, 8]],
    [12, [1, 8]],
    [24, [1, 8]],
    [28, [1, 8]],
    [40, [1, 8]],
    [52, [1, 8]],
    [56, [1, 8]],
    [68, [1, 8]],
    [80, [1, 8]],
  ]);
  const scenario = findTechniqueScenario(patternState, ['pattern-overlay'], {
    allowContradictoryCandidateState: true,
    allowedTechniques: ['pattern-overlay'],
  });
  assert.equal(scenario?.step.technique, 'pattern-overlay');

  const duplicateFilled = '534678912672195348198342567859761423426853791713924856961537284287419635345286176';
  assert.equal(nextStep(duplicateFilled, { allowContradictoryCandidateState: true }), null);
}

function testFindSteps(): void {
  const state = {
    board: parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000'),
    constraints: {
      exactCandidates: [
        { cell: 0, digits: [1, 2] },
        { cell: 1, digits: [1, 2] },
        { cell: 2, digits: [1, 2, 3] },
      ],
    },
  };
  const defaultOrder = findSteps(state, {
    allowedTechniques: ['naked-triple', 'naked-pair'],
    allowContradictoryCandidateState: true,
    includeDiagnostics: true,
  });
  assert.equal(defaultOrder.steps[0]?.technique, 'naked-pair');
  assert.ok(defaultOrder.diagnostics?.techniquesTried.includes('naked-pair'));
  assert.equal(defaultOrder.diagnostics?.techniqueHits['naked-pair'], 1);

  const preferredTriple = findSteps(state, {
    allowedTechniques: ['naked-pair', 'naked-triple'],
    preferredTechniques: ['naked-triple'],
    allowContradictoryCandidateState: true,
    limit: 1,
  });
  assert.equal(preferredTriple.steps.length, 1);
  assert.equal(preferredTriple.steps[0]?.technique, 'naked-triple');

  const scoreSorted = findSteps(state, {
    allowedTechniques: ['naked-pair', 'naked-triple'],
    allowContradictoryCandidateState: true,
    sort: 'score-desc',
  });
  assert.equal(scoreSorted.steps[0]?.technique, 'naked-triple');

  const contradictionState = {
    board: parsePuzzle('554678912672195348198342567859761423426853791713924856961537284287419635345286179'),
  };
  assert.equal(nextStep(contradictionState), null);

  const contradictionFindSteps = findSteps(contradictionState, { includeDiagnostics: true });
  assert.deepEqual(contradictionFindSteps.steps, []);
  assert.equal(contradictionFindSteps.diagnostics?.stuckReason, 'contradiction');
  assert.ok((contradictionFindSteps.diagnostics?.initialContradictions ?? 0) > 0);

  const wrappedContradiction = {
    ...contradictionState,
    constraints: { pencilMarks: [] },
  };
  assert.equal(nextStep(wrappedContradiction), null);
  const wrappedContradictionFindSteps = findSteps(wrappedContradiction, { includeDiagnostics: true });
  assert.equal(wrappedContradictionFindSteps.diagnostics?.stuckReason, 'contradiction');

  assert.throws(() => findSteps(state, { allowContradictoryCandidateState: true, limit: 0 }), /正整数/);
}

function testRateCli(): void {
  const almostSolved = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';
  const result = runCli(['rate', almostSolved]);
  assert.equal(result.exitCode, 0);
  assert.equal(typeof result.output, 'object');
}

function testProfileCli(): void {
  const puzzle = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';
  const solveResult = runCli(['solve', puzzle, '--profile', 'extended']);
  assert.equal(solveResult.exitCode, 0);
  assert.equal((solveResult.output as { solved?: boolean }).solved, true);

  const rateResult = runCli(['rate', puzzle, '--profile', 'extended']);
  assert.equal(rateResult.exitCode, 0);
  assert.equal((rateResult.output as { solved?: boolean }).solved, true);
  assert.equal((rateResult.output as { ratingPolicyId?: string }).ratingPolicyId, 'classic-extended');

  const galaxyRateResult = runCli(['rate', puzzle, '--profile', 'galaxy']);
  assert.equal(galaxyRateResult.exitCode, 0);
  assert.equal((galaxyRateResult.output as { solved?: boolean }).solved, true);
  assert.equal((galaxyRateResult.output as { ratingPolicyId?: string }).ratingPolicyId, 'classic-galaxy');
}

function testCliAllowAndPreferValidation(): void {
  const almostSolved = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';
  const allowResult = runCli(['solve', almostSolved, '--allow', 'bowmans-bingo']);
  assert.equal(allowResult.exitCode, 0);
  assert.equal(typeof allowResult.output, 'object');

  const invalidPrefer = runCli(['solve', almostSolved, '--allow', 'bowmans-bingo', '--prefer', 'table-chain']);
  assert.equal(invalidPrefer.exitCode, 1);
}

function testBatchSolveAndRateCli(): void {
  const tmpDir = join(process.cwd(), 'dist', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const inputPath = join(tmpDir, 'batch-puzzles.txt');
  const solveOutputPath = join(tmpDir, 'batch-solve.jsonl');
  const rateOutputPath = join(tmpDir, 'batch-rate.csv');
  const summaryPath = join(tmpDir, 'batch-summary.json');
  const usagePath = join(tmpDir, 'batch-usage.json');
  const almostSolved = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';
  writeFileSync(inputPath, `p1\t${almostSolved}\n# comment\np2\t${almostSolved}\np3\t${almostSolved}\n`, 'utf8');

  const solveResult = runCli([
    'batch-solve',
    '--input',
    inputPath,
    '--output',
    solveOutputPath,
    '--format',
    'jsonl',
    '--summary',
    summaryPath,
    '--usage',
    usagePath,
    '--allow',
    'full-house',
    '--prefer',
    'full-house',
    '--max-steps',
    '2',
    '--start-line',
    '1',
    '--end-line',
    '3',
  ]);
  assert.equal(solveResult.exitCode, 0);
  assert.equal((solveResult.output as { puzzles?: number }).puzzles, 2);
  const jsonl = readFileSync(solveOutputPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as { puzzleId?: string; solved?: boolean });
  assert.equal(jsonl.length, 2);
  assert.equal(jsonl[0]?.puzzleId, 'p1');
  assert.equal(jsonl.every((item) => item.solved), true);
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8')) as { solved?: number };
  assert.equal(summary.solved, 2);
  const usage = JSON.parse(readFileSync(usagePath, 'utf8')) as { totalHits?: number; byTechnique?: Record<string, { hits?: number }> };
  assert.equal(usage.totalHits, 2);
  assert.equal(usage.byTechnique?.['full-house']?.hits, 2);
  assert.deepEqual(Object.keys(usage.byTechnique ?? {}), ['full-house']);

  const rateResult = runCli([
    'batch-rate',
    '--input',
    inputPath,
    '--output',
    rateOutputPath,
    '--format',
    'csv',
    '--only',
    'p2',
    '--allow',
    'full-house',
    '--prefer',
    'full-house',
    '--max-steps',
    '2',
  ]);
  assert.equal(rateResult.exitCode, 0);
  assert.equal((rateResult.output as { puzzles?: number }).puzzles, 1);
  const csv = readFileSync(rateOutputPath, 'utf8');
  assert.match(csv, /puzzleId,solved,score/);
  assert.match(csv, /p2,true,10,basic,full-house/);
  assert.doesNotMatch(csv, /p1,true/);
  assert.doesNotMatch(csv, /p3,true/);

  const formulaInputPath = join(tmpDir, 'batch-formula-puzzles.txt');
  const formulaCsvPath = join(tmpDir, 'batch-formula-rate.csv');
  writeFileSync(formulaInputPath, `=HYPERLINK("http://example.test")\t${almostSolved}\n`, 'utf8');
  const formulaRateResult = runCli([
    'batch-rate',
    '--input',
    formulaInputPath,
    '--output',
    formulaCsvPath,
    '--format',
    'csv',
  ]);
  assert.equal(formulaRateResult.exitCode, 0);
  const formulaCsv = readFileSync(formulaCsvPath, 'utf8');
  assert.match(formulaCsv, /^puzzleId,solved,score/m);
  assert.match(formulaCsv, /^"'=HYPERLINK\(""http:\/\/example\.test""\)",true/m);
  assert.doesNotMatch(formulaCsv, /^=HYPERLINK/m);

  const formulaJsonInputPath = join(tmpDir, 'batch-formula-puzzles.json');
  const formulaJsonCsvPath = join(tmpDir, 'batch-formula-rate-json.csv');
  writeFileSync(formulaJsonInputPath, JSON.stringify([
    { puzzleId: '\t=HYPERLINK("http://tab.example")', puzzle: almostSolved },
    { puzzleId: ' @SUM(1,1)', puzzle: almostSolved },
  ]), 'utf8');
  const formulaJsonRateResult = runCli([
    'batch-rate',
    '--input',
    formulaJsonInputPath,
    '--output',
    formulaJsonCsvPath,
    '--format',
    'csv',
  ]);
  assert.equal(formulaJsonRateResult.exitCode, 0);
  const formulaJsonCsv = readFileSync(formulaJsonCsvPath, 'utf8');
  assert.match(formulaJsonCsv, /^"'\t=HYPERLINK\(""http:\/\/tab\.example""\)",true/m);
  assert.match(formulaJsonCsv, /^"' @SUM\(1,1\)",true/m);

  const invalidBatchInputPath = join(tmpDir, 'batch-invalid-puzzles.txt');
  writeFileSync(invalidBatchInputPath, `good\t${almostSolved}\nbad\t123\n`, 'utf8');
  const invalidBatchResult = runCli([
    'batch-rate',
    '--input',
    invalidBatchInputPath,
  ]);
  assert.equal(invalidBatchResult.exitCode, 0);
  const invalidBatchRows = invalidBatchResult.output as Array<{ puzzleId?: string; ok?: boolean; error?: string }>;
  assert.equal(invalidBatchRows.length, 2);
  assert.equal(invalidBatchRows[0]?.ok, true);
  assert.equal(invalidBatchRows[1]?.puzzleId, 'bad');
  assert.equal(invalidBatchRows[1]?.ok, false);
  assert.match(invalidBatchRows[1]?.error ?? '', /81/);

  const invalidBatchFailFast = runCli([
    'batch-rate',
    '--input',
    invalidBatchInputPath,
    '--fail-fast',
  ]);
  assert.equal(invalidBatchFailFast.exitCode, 1);

  const rangedSolve = runCli([
    'batch-solve',
    '--input',
    inputPath,
    '--start-line',
    '4',
    '--end-line',
    '4',
  ]);
  assert.equal(rangedSolve.exitCode, 0);
  const rangedOutput = rangedSolve.output as Array<{ puzzleId?: string }>;
  assert.equal(rangedOutput.length, 1);
  assert.equal(rangedOutput[0]?.puzzleId, 'p3');

  const invalidTechnique = runCli([
    'batch-solve',
    '--input',
    inputPath,
    '--allow',
    'not-a-technique',
  ]);
  assert.equal(invalidTechnique.exitCode, 1);
}

function testSchemas(): void {
  const schemas = getJsonSchemas();
  assert.ok(schemas.board);
  assert.ok(schemas.puzzleState);
  assert.ok(schemas.solveStep);
  assert.ok(schemas.techniqueDefinition);
  assert.ok(schemas.techniqueList);
  assert.ok(schemas.canonicalTransform);
  assert.ok(schemas.canonicalResult);
  assert.ok(schemas.canonicalPairResult);
  assert.ok(schemas.ratingPolicy);
  assert.ok(schemas.ratingResult);
  assert.ok(schemas.generationRequest);
  assert.ok(schemas.generationResult);
  assert.ok(schemas.generatedPuzzle);
  assert.ok(schemas.searchRequest);
  assert.ok(schemas.searchSummary);
  assert.ok(schemas.searchEvent);
  assert.ok(schemas.candidateSelectionPlan);
  assert.ok(schemas.candidateSelectionResult);
  assert.ok(schemas.candidatePoolStats);
  assert.ok(schemas.candidateDedupeResult);
  assert.ok(schemas.searchManifestSummary);
  assert.equal(((schemas.generationRequest.properties as Record<string, unknown>).seed as { minimum?: number }).minimum, 1);
  assert.equal(((schemas.generationRequest.properties as Record<string, unknown>).seed as { maximum?: number }).maximum, 0xffffffff);
  const scoreSchema = (((schemas.generationRequest.properties as Record<string, unknown>).constraints as { properties?: Record<string, unknown> }).properties?.score as { properties?: Record<string, unknown> });
  assert.equal((scoreSchema.properties?.tolerance as { minimum?: number }).minimum, 0);
  (schemas.board as { title?: string }).title = 'mutated';
  assert.notEqual((getJsonSchemas().board as { title?: string }).title, 'mutated');
  assert.ok(JSON.stringify(schemas.solveStep).includes('"branches"'));
  const solveStepSchema = schemas.solveStep as { properties?: { technique?: { enum?: string[] } } };
  assert.ok(solveStepSchema.properties?.technique?.enum?.includes('full-house'));
  assert.equal(solveStepSchema.properties?.technique?.enum?.includes('not-a-technique'), false);
  const techniqueDefinitionSchema = schemas.techniqueDefinition as { properties?: { id?: { enum?: string[] } } };
  assert.ok(techniqueDefinitionSchema.properties?.id?.enum?.includes('full-house'));
  assert.equal(techniqueDefinitionSchema.properties?.id?.enum?.includes('not-a-technique'), false);
  const canonicalTransformSchema = schemas.canonicalTransform as {
    properties?: {
      rowOrder?: { uniqueItems?: boolean };
      colOrder?: { uniqueItems?: boolean };
      digitMap?: { uniqueItems?: boolean; prefixItems?: Array<{ const?: number }> };
    };
  };
  assert.equal(canonicalTransformSchema.properties?.rowOrder?.uniqueItems, true);
  assert.equal(canonicalTransformSchema.properties?.colOrder?.uniqueItems, true);
  assert.equal(canonicalTransformSchema.properties?.digitMap?.uniqueItems, true);
  assert.equal(canonicalTransformSchema.properties?.digitMap?.prefixItems?.[0]?.const, 0);
  const canonicalPairResultSchema = schemas.canonicalPairResult as { properties?: { solution?: { items?: { minimum?: number } } } };
  assert.equal(canonicalPairResultSchema.properties?.solution?.items?.minimum, 1);
  const generatedPuzzleSchema = schemas.generatedPuzzle as { properties?: { canonicalKey?: Record<string, unknown>; solution?: { items?: { minimum?: number } } } };
  assert.equal(generatedPuzzleSchema.properties?.solution?.items?.minimum, 1);
  assert.equal(generatedPuzzleSchema.properties?.canonicalKey?.minLength, 81);
  assert.equal(generatedPuzzleSchema.properties?.canonicalKey?.maxLength, 81);
  assert.equal(generatedPuzzleSchema.properties?.canonicalKey?.pattern, '^[0-9]{81}$');
  const generationResultSchema = schemas.generationResult as {
    properties?: {
      puzzle?: { properties?: { solution?: { items?: { minimum?: number } } } };
      bestCandidate?: { properties?: { solution?: { items?: { minimum?: number } } } };
    };
  };
  assert.equal(generationResultSchema.properties?.puzzle?.properties?.solution?.items?.minimum, 1);
  assert.equal(generationResultSchema.properties?.bestCandidate?.properties?.solution?.items?.minimum, 1);
  const generationRequestSchema = schemas.generationRequest as { properties?: Record<string, Record<string, unknown>> };
  assert.ok(generationRequestSchema.properties?.ratingPolicy);
  const topLevelRatingPolicySchema = schemas.ratingPolicy as { properties?: Record<string, unknown> };
  assert.ok(topLevelRatingPolicySchema.properties?.techniqueOrder);
  const ratingPolicySchema = generationRequestSchema.properties?.ratingPolicy as {
    properties?: {
      techniqueOrder?: { items?: { enum?: string[] } };
      fallbackTechniques?: { items?: { enum?: string[] } };
      techniqueScores?: { propertyNames?: { enum?: string[] } };
      gradeRules?: { items?: { $comment?: string; properties?: { allowedTechniques?: { items?: { enum?: string[] } } } } };
    };
  };
  assert.ok(ratingPolicySchema.properties?.techniqueOrder?.items?.enum?.includes('full-house'));
  assert.equal(ratingPolicySchema.properties?.techniqueOrder?.items?.enum?.includes('not-a-technique'), false);
  assert.ok(ratingPolicySchema.properties?.fallbackTechniques?.items?.enum?.includes('bowmans-bingo'));
  assert.ok(ratingPolicySchema.properties?.techniqueScores?.propertyNames?.enum?.includes('full-house'));
  assert.ok(ratingPolicySchema.properties?.gradeRules?.items?.properties?.allowedTechniques?.items?.enum?.includes('full-house'));
  assert.match(ratingPolicySchema.properties?.gradeRules?.items?.$comment ?? '', /validateRatingPolicy/);
  const constraintSchema = generationRequestSchema.properties?.constraints as {
    properties?: {
      clues?: { properties?: { max?: { minimum?: number }; target?: { minimum?: number } } };
      allowedTechniques?: { items?: { enum?: string[] } };
      forbiddenTechniques?: { items?: { enum?: string[] } };
      preferredTechniques?: { items?: { enum?: string[] } };
      requiredTechniques?: { items?: { oneOf?: Array<{ properties?: { techniques?: { items?: { enum?: string[] } } } }> } };
    };
  };
  assert.equal(constraintSchema.properties?.clues?.properties?.max?.minimum, 17);
  assert.equal(constraintSchema.properties?.clues?.properties?.target?.minimum, 17);
  assert.ok(constraintSchema.properties?.allowedTechniques?.items?.enum?.includes('full-house'));
  assert.ok(constraintSchema.properties?.forbiddenTechniques?.items?.enum?.includes('full-house'));
  assert.ok(constraintSchema.properties?.preferredTechniques?.items?.enum?.includes('full-house'));
  assert.ok(constraintSchema.properties?.requiredTechniques?.items?.oneOf?.[0]?.properties?.techniques?.items?.enum?.includes('full-house'));
  const relaxationSchema = generationRequestSchema.properties?.relaxation as { required?: string[] };
  assert.ok(relaxationSchema.required?.includes('enabled'));
  assert.equal(generationRequestSchema.properties?.maxResults?.minimum, 1);
  assert.equal(generationRequestSchema.properties?.scoreBucketSize?.minimum, 1);
  const searchRequestSchema = schemas.searchRequest as {
    allOf?: unknown;
    additionalProperties?: unknown;
    properties?: Record<string, { minimum?: unknown }>;
  };
  assert.equal(searchRequestSchema.allOf, undefined);
  assert.equal(searchRequestSchema.additionalProperties, false);
  assert.equal(searchRequestSchema.properties?.maxResults?.minimum, 1);
  assert.equal(searchRequestSchema.properties?.scoreBucketSize?.minimum, 1);
  assert.ok(searchRequestSchema.properties?.ratingPolicy);
  const candidateSelectionPlanSchema = schemas.candidateSelectionPlan as {
    properties?: {
      preferredTechniques?: { items?: { enum?: string[] } };
      scoreBuckets?: { $comment?: string };
    };
  };
  assert.ok(candidateSelectionPlanSchema.properties?.preferredTechniques?.items?.enum?.includes('full-house'));
  assert.equal(candidateSelectionPlanSchema.properties?.preferredTechniques?.items?.enum?.includes('not-a-technique'), false);
  assert.match(candidateSelectionPlanSchema.properties?.scoreBuckets?.$comment ?? '', /运行时校验/);
}

function testSchemaCli(): void {
  const listResult = runCli(['schema']);
  assert.equal(listResult.exitCode, 0);
  assert.ok(Array.isArray(listResult.output));

  const stateResult = runCli(['schema', 'puzzleState']);
  assert.equal(stateResult.exitCode, 0);
  assert.equal(typeof stateResult.output, 'object');

  const canonicalResult = runCli(['schema', 'canonicalResult']);
  assert.equal(canonicalResult.exitCode, 0);
  assert.equal(typeof canonicalResult.output, 'object');

  const techniqueListResult = runCli(['schema', 'techniqueList']);
  assert.equal(techniqueListResult.exitCode, 0);
  assert.equal(typeof techniqueListResult.output, 'object');

  const candidateStatsResult = runCli(['schema', 'candidatePoolStats']);
  assert.equal(candidateStatsResult.exitCode, 0);
  assert.equal(typeof candidateStatsResult.output, 'object');

  const manifestSummaryResult = runCli(['schema', 'searchManifestSummary']);
  assert.equal(manifestSummaryResult.exitCode, 0);
  assert.equal(typeof manifestSummaryResult.output, 'object');

  const missingResult = runCli(['schema', 'missing']);
  assert.equal(missingResult.exitCode, 1);
}

function testGenerationRequestAnalysisInvalid(): void {
  const nonObjectRequest = analyzeGenerationRequest(null as never);
  assert.equal(nonObjectRequest.status, 'invalid');
  assert.ok(nonObjectRequest.errors.some((error) => error.code === 'invalid-generation-request'));
  assert.equal(generateOne(null as never).status, 'invalid-request');
  assert.throws(() => [...search(null as never)], /search request 必须是 object/);

  const analysis = analyzeGenerationRequest({
    constraints: {
      score: { min: 100, max: 50 },
    },
  });
  assert.equal(analysis.status, 'invalid');
  assert.ok(analysis.errors.some((error) => error.code === 'score-min-greater-than-max'));

  const invalidClueTarget = analyzeGenerationRequest({
    constraints: {
      clues: { target: 10 },
    },
  });
  assert.equal(invalidClueTarget.status, 'invalid');
  assert.ok(invalidClueTarget.errors.some((error) => error.code === 'clue-target-below-unique-minimum'));

  const lowClueMin = analyzeGenerationRequest({
    constraints: {
      clues: { min: 1 },
    },
  });
  assert.notEqual(lowClueMin.status, 'invalid');
  assert.ok(lowClueMin.warnings.some((warning) => warning.code === 'clue-min-below-unique-minimum-clamped'));

  const invalidNestedObjects = analyzeGenerationRequest({
    constraints: {
      score: 1,
      clues: 1,
    },
    budget: 1,
    relaxation: 1,
  } as never);
  assert.equal(invalidNestedObjects.status, 'invalid');
  assert.ok(invalidNestedObjects.errors.some((error) => error.code === 'invalid-score-constraint'));
  assert.ok(invalidNestedObjects.errors.some((error) => error.code === 'invalid-clue-constraint'));
  assert.ok(invalidNestedObjects.errors.some((error) => error.code === 'invalid-generation-budget'));
  assert.ok(invalidNestedObjects.errors.some((error) => error.code === 'invalid-generation-relaxation'));

  const unknownTopLevel = analyzeGenerationRequest({
    seed: 1,
    extra: 1,
  } as never);
  assert.equal(unknownTopLevel.status, 'invalid');
  assert.ok(unknownTopLevel.errors.some((error) => error.code === 'unknown-generation-field'));
  assert.equal(generateOne({ seed: 1, extra: 1 } as never).status, 'invalid-request');

  const unknownNested = analyzeGenerationRequest({
    constraints: {
      extra: 1,
      score: { min: 1, extra: 2 },
      clues: { target: 40, extra: 3 },
      requiredTechniques: [{ type: 'appears', techniques: ['full-house'], extra: 4 } as never],
    } as never,
    budget: { maxAttempts: 1, extra: 5 } as never,
    relaxation: { enabled: false, extra: 6 } as never,
  });
  assert.equal(unknownNested.status, 'invalid');
  assert.ok(unknownNested.errors.some((error) => error.code === 'unknown-generation-constraint-field'));
  assert.ok(unknownNested.errors.some((error) => error.code === 'unknown-generation-score-field'));
  assert.ok(unknownNested.errors.some((error) => error.code === 'unknown-generation-clue-field'));
  assert.ok(unknownNested.errors.some((error) => error.code === 'unknown-required-technique-field'));
  assert.ok(unknownNested.errors.some((error) => error.code === 'unknown-generation-budget-field'));
  assert.ok(unknownNested.errors.some((error) => error.code === 'unknown-generation-relaxation-field'));

  const invalidRatingPolicy = analyzeGenerationRequest({
    ratingPolicy: { id: 'custom' },
  } as never);
  assert.equal(invalidRatingPolicy.status, 'invalid');
  assert.ok(invalidRatingPolicy.errors.some((error) => error.code === 'invalid-rating-policy-technique-order'));

  const malformedFallbackPolicy = analyzeGenerationRequest({
    ratingPolicy: {
      id: 'custom',
      version: '1',
      techniqueOrder: ['full-house'],
      fallbackTechniques: 1,
      techniqueScores: { 'full-house': 10 },
    },
  } as never);
  assert.equal(malformedFallbackPolicy.status, 'invalid');
  assert.ok(malformedFallbackPolicy.errors.some((error) => error.code === 'invalid-rating-policy-fallback-techniques'));

  const unknownRatingPolicyField = analyzeGenerationRequest({
    ratingPolicy: {
      ...getRatingPolicy('classic-stable'),
      extra: true,
      gradeRules: [{ grade: 'custom', extra: true }],
    },
  } as never);
  assert.equal(unknownRatingPolicyField.status, 'invalid');
  assert.ok(unknownRatingPolicyField.errors.some((error) => error.code === 'unknown-rating-policy-field'));
  assert.ok(unknownRatingPolicyField.errors.some((error) => error.code === 'unknown-rating-policy-grade-rule-field'));

  const unknownRatingPolicyTechnique = analyzeGenerationRequest({
    ratingPolicy: {
      id: 'custom',
      version: '1',
      techniqueOrder: ['not-a-technique'],
      fallbackTechniques: ['also-not-a-technique'],
      techniqueScores: { 'not-a-technique': 100, 'score-only-technique': 50 },
      gradeRules: [{ grade: 'custom', allowedTechniques: ['grade-not-a-technique'] }],
    },
  } as never);
  assert.equal(unknownRatingPolicyTechnique.status, 'invalid');
  assert.ok(unknownRatingPolicyTechnique.errors.some((error) => error.code === 'unknown-rating-policy-technique'));
  assert.ok(unknownRatingPolicyTechnique.errors.some((error) => error.code === 'unknown-rating-policy-score-technique'));

  const missingScorePolicy = analyzeGenerationRequest({
    ratingPolicy: {
      id: 'custom',
      version: '1',
      techniqueOrder: ['full-house'],
      techniqueScores: {},
    } as never,
  });
  assert.equal(missingScorePolicy.status, 'invalid');
  assert.ok(missingScorePolicy.errors.some((error) => error.code === 'invalid-rating-policy-score-coverage'));

  const missingTechniqueOrderPolicy = validateRatingPolicy({
    id: 'custom',
    version: '1',
    techniqueScores: {},
  } as never);
  assert.ok(missingTechniqueOrderPolicy.some((error) => error.code === 'invalid-rating-policy-technique-order'));
  assert.equal(missingTechniqueOrderPolicy.some((error) => error.code === 'invalid-rating-policy-score-coverage'), false);

  const stringTechniqueOrderPolicy = validateRatingPolicy({
    id: 'custom',
    version: '1',
    techniqueOrder: 'full-house',
    techniqueScores: {},
  } as never);
  assert.ok(stringTechniqueOrderPolicy.some((error) => error.code === 'invalid-rating-policy-technique-order'));
  assert.equal(stringTechniqueOrderPolicy.some((error) => error.details?.technique === 'f'), false);

  const stringFallbackPolicy = validateRatingPolicy({
    id: 'custom',
    version: '1',
    techniqueOrder: ['full-house'],
    fallbackTechniques: 'bowmans-bingo',
    techniqueScores: { 'full-house': 10 },
  } as never);
  assert.ok(stringFallbackPolicy.some((error) => error.code === 'invalid-rating-policy-fallback-techniques'));
  assert.equal(stringFallbackPolicy.some((error) => error.details?.technique === 'b'), false);

  const badGradePolicy = analyzeGenerationRequest({
    ratingPolicy: {
      id: 'custom',
      version: '1',
      techniqueOrder: ['full-house'],
      techniqueScores: { 'full-house': 10 },
      gradeRules: [{ grade: 'bad', minScore: 100, maxScore: 10 }],
    } as never,
  });
  assert.equal(badGradePolicy.status, 'invalid');
  assert.ok(badGradePolicy.errors.some((error) => error.code === 'invalid-rating-policy-grade-range'));

  const searchOnlyFields = analyzeGenerationRequest({
    seed: 1,
    maxResults: 1,
    scoreBucketSize: 100,
  } as never);
  assert.notEqual(searchOnlyFields.status, 'invalid');

  const invalidSearchOnlyFields = analyzeGenerationRequest({
    maxResults: 0,
    scoreBucketSize: 0,
  } as never);
  assert.equal(invalidSearchOnlyFields.status, 'invalid');
  assert.ok(invalidSearchOnlyFields.errors.some((error) => error.code === 'invalid-search-max-results'));
  assert.ok(invalidSearchOnlyFields.errors.some((error) => error.code === 'invalid-search-score-bucket-size'));

  const emptyAllowedTechniques = analyzeGenerationRequest({
    constraints: {
      allowedTechniques: [],
    },
  });
  assert.equal(emptyAllowedTechniques.status, 'invalid');
  assert.ok(emptyAllowedTechniques.errors.some((error) => error.code === 'empty-allowed-techniques'));

  const emptyRequiredTechniques = analyzeGenerationRequest({
    constraints: {
      requiredTechniques: [
        { type: 'appears', techniques: [] },
        { type: 'family-coverage', families: [] },
      ],
    },
  });
  assert.equal(emptyRequiredTechniques.status, 'invalid');
  assert.ok(emptyRequiredTechniques.errors.some((error) => error.code === 'empty-required-technique-list'));
  assert.ok(emptyRequiredTechniques.errors.some((error) => error.code === 'empty-required-family-list'));

  const appearsOrRule = analyzeGenerationRequest({
    constraints: {
      allowedTechniques: ['full-house'],
      requiredTechniques: [{ type: 'appears', techniques: ['full-house', 'aic'] }],
    },
  });
  assert.notEqual(appearsOrRule.status, 'invalid');
  assert.equal(appearsOrRule.status, 'valid');
  assert.ok(appearsOrRule.suggestions.some((suggestion) => suggestion.type === 'review-required-technique-alternatives'));

  const extendedFallbackAppearsRule = analyzeGenerationRequest({
    ratingPolicy: getRatingPolicy('classic-extended'),
    constraints: {
      requiredTechniques: [{ type: 'appears', techniques: ['bowmans-bingo'] }],
    },
  });
  assert.notEqual(extendedFallbackAppearsRule.status, 'invalid');

  const unavailableAppearsRule = analyzeGenerationRequest({
    constraints: {
      allowedTechniques: ['full-house'],
      requiredTechniques: [{ type: 'appears', techniques: ['aic'] }],
    },
  });
  assert.equal(unavailableAppearsRule.status, 'invalid');
  assert.ok(unavailableAppearsRule.errors.some((error) => error.code === 'required-technique-not-available'));

  const noAvailableTechniques = analyzeGenerationRequest({
    constraints: {
      forbiddenTechniques: [...getDefaultRatingPolicy().techniqueOrder],
    },
  });
  assert.equal(noAvailableTechniques.status, 'invalid');
  assert.ok(noAvailableTechniques.errors.some((error) => error.code === 'no-available-techniques'));
  assert.equal(noAvailableTechniques.estimatedDifficulty, 'very-high');
  assert.equal(generateOne({
    constraints: {
      forbiddenTechniques: [...getDefaultRatingPolicy().techniqueOrder],
    },
  }).status, 'invalid-request');
  assert.throws(() => [...search({
    constraints: {
      forbiddenTechniques: [...getDefaultRatingPolicy().techniqueOrder],
    },
  })], /no-available-techniques/);
}

function testGenerationRequestAnalysisUnlikely(): void {
  const analysis = analyzeGenerationRequest({
    constraints: {
      score: { min: 3000 },
      allowedTechniques: ['full-house', 'naked-single', 'hidden-single'],
    },
  });
  assert.equal(analysis.status, 'unlikely');
  assert.ok(analysis.warnings.some((warning) => warning.code === 'score-range-too-high-for-narrow-techniques'));
  assert.equal(analysis.feasibility.allowedTechniqueCount, 3);
  assert.equal(analysis.feasibility.maxSingleStepScore, 30);
  assert.ok((analysis.feasibility.estimatedMinStepsForScoreMin ?? 0) >= 100);
}

function testGenerationRequestAnalysisBudgetWarning(): void {
  const analysis = analyzeGenerationRequest({
    constraints: {
      score: { min: 1600, max: 1650 },
      clues: { min: 42, max: 45 },
      allowedTechniques: ['full-house', 'naked-single', 'hidden-single', 'locked-candidates'],
    },
    budget: {
      maxAttempts: 2,
      maxElapsedMs: 1000,
    },
  });
  assert.equal(analysis.status, 'unlikely');
  assert.ok(analysis.warnings.some((warning) => warning.code === 'high-clue-count-with-high-score'));
  assert.ok(analysis.warnings.some((warning) => warning.code === 'budget-too-small-for-constrained-request'));
}

function testGeneratorRuntimeValidation(): void {
  const result = generateOne({
    seed: 1.5,
    minimality: 'loose',
    constraints: {
      clues: { max: 16 },
      symmetry: 'diagonal',
      uniqueness: 'skip',
    },
    budget: {
      maxAttempts: 0,
      maxElapsedMs: -1,
    },
    relaxation: {
      enabled: true,
      maxRounds: -1,
      attemptMultiplierPerRound: 0,
    },
  } as never);
  assert.equal(result.status, 'invalid-request');
  const codes = new Set(result.requestAnalysis.errors.map((error) => error.code));
  assert.ok(codes.has('invalid-seed'));
  assert.ok(codes.has('invalid-minimality'));
  assert.ok(codes.has('invalid-symmetry'));
  assert.ok(codes.has('invalid-uniqueness'));
  assert.ok(codes.has('invalid-budget-max-attempts'));
  assert.ok(codes.has('invalid-budget-max-elapsed-ms'));
  assert.ok(codes.has('invalid-relaxation-max-rounds'));
  assert.ok(codes.has('invalid-relaxation-attempt-multiplier'));
  assert.ok(codes.has('clue-max-below-unique-minimum'));
}

function testSeededRandomNeverShufflesOutOfBounds(): void {
  assert.throws(() => new SolutionGridFactory().create(0), /seed/);
  assert.equal(generateOne({ seed: 0 } as never).status, 'invalid-request');
  assert.throws(() => [...search({ seed: 0 } as never)], /seed/);
  const solution = new SolutionGridFactory().create(1584200935);
  assert.equal(solution.length, 81);
  assert.equal(solution.every((value) => Number.isInteger(value) && value >= 1 && value <= 9), true);

  const result = generateOne({
    seed: 1584200935,
    minimality: 'none',
    constraints: {
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 1000,
    },
  });
  assert.notEqual(result.status, 'invalid-request');
}

function testDefaultTechniqueOrderPolicy(): void {
  assert.ok(Object.isFrozen(CLASSIC_STABLE_POLICY));
  assert.ok(Object.isFrozen(CLASSIC_STABLE_POLICY.techniqueOrder));
  const stableDefinitions = getTechniqueDefinitions()
    .filter((definition) => definition.stability === 'stable');
  const stableDefinitionIds = stableDefinitions.map((definition) => definition.id);
  const policy = getDefaultRatingPolicy();
  assert.deepEqual(policy.techniqueOrder, CLASSIC_STABLE_TECHNIQUE_ORDER);
  assert.deepEqual([...policy.techniqueOrder].sort(), [...stableDefinitionIds].sort());
  assertTechniqueBefore(policy.techniqueOrder, 'finned-x-wing', 'swordfish');
  assertTechniqueBefore(policy.techniqueOrder, 'als-xy-wing', 'grouped-aic');
  assertTechniqueBefore(policy.techniqueOrder, 'nishio-forcing-chains', 'aic');
  assertTechniqueBefore(policy.techniqueOrder, 'aic', 'three-d-medusa');

  const extendedPolicy = getRatingPolicy('classic-extended');
  assert.deepEqual(extendedPolicy.techniqueOrder, CLASSIC_EXTENDED_TECHNIQUE_ORDER);
  assert.deepEqual(extendedPolicy.fallbackTechniques, ['bowmans-bingo']);

  const galaxyPolicy = getRatingPolicy('classic-galaxy');
  assert.deepEqual(galaxyPolicy.techniqueOrder, CLASSIC_GALAXY_TECHNIQUE_ORDER);
  assert.equal(galaxyPolicy.id, 'classic-galaxy');
  assert.deepEqual(galaxyPolicy.fallbackTechniques, [
    'forcing-nets',
    'digit-forcing-chains',
    'cell-forcing-chains',
    'unit-forcing-chains',
    'region-forcing-chains',
    'table-chain',
    'dynamic-forcing-chains',
    'dynamic-forcing-chains-plus',
    'bowmans-bingo',
  ]);
  const galaxyPrimarySet = new Set(galaxyPolicy.techniqueOrder);
  const galaxyFallbackSet = new Set(galaxyPolicy.fallbackTechniques ?? []);
  assert.equal(galaxyPolicy.techniqueOrder.length, galaxyPrimarySet.size);
  assert.equal((galaxyPolicy.fallbackTechniques ?? []).length, galaxyFallbackSet.size);
  assert.equal((galaxyPolicy.fallbackTechniques ?? []).some((technique) => galaxyPrimarySet.has(technique)), false);
  const galaxyEnabled = [...galaxyPolicy.techniqueOrder, ...(galaxyPolicy.fallbackTechniques ?? [])].sort();
  const expectedGalaxyEnabled = getTechniqueDefinitions()
    .map((definition) => definition.id)
    .filter((id) => id !== 'nested-forcing-chains')
    .sort();
  assert.deepEqual(galaxyEnabled, expectedGalaxyEnabled);
  assert.deepEqual(galaxyEnabled, buildDefaultTechniques()
    .map((technique) => technique.id)
    .filter((id) => id !== 'nested-forcing-chains')
    .sort());
  assertTechniqueBefore(galaxyPolicy.techniqueOrder, 'direct-pointing', 'naked-pair');
}

function assertTechniqueBefore(order: readonly TechniqueId[], left: TechniqueId, right: TechniqueId): void {
  const leftIndex = order.indexOf(left);
  const rightIndex = order.indexOf(right);
  assert.notEqual(leftIndex, -1, `${left} 应存在于默认技巧顺序中。`);
  assert.notEqual(rightIndex, -1, `${right} 应存在于默认技巧顺序中。`);
  assert.ok(leftIndex < rightIndex, `${left} 应排在 ${right} 前面。`);
}

function testGenerationAnalyzeCli(): void {
  const result = runCli([
    'generator-analyze',
    '{"constraints":{"score":{"min":3000},"allowedTechniques":["full-house","naked-single","hidden-single"]}}',
  ]);
  assert.equal(result.exitCode, 0);
  assert.equal(typeof result.output, 'object');
}

function testGenerateInvalidRequest(): void {
  const result = generateOne({
    constraints: {
      score: { min: 100, max: 50 },
    },
  });
  assert.equal(result.status, 'invalid-request');

  const overflowingSeedResult = generateOne({
    seed: 0xffffffff,
    budget: {
      maxAttempts: 2,
      maxElapsedMs: 3000,
    },
  });
  assert.equal(overflowingSeedResult.status, 'invalid-request');
  assert.ok(overflowingSeedResult.requestAnalysis.errors.some((error) => error.code === 'invalid-seed'));
}

function testGenerateScoreTargetTolerance(): void {
  const result = generateOne({
    seed: 1,
    minimality: 'none',
    constraints: {
      score: { target: 999999, tolerance: 0 },
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  });
  assert.notEqual(result.status, 'success');
  assert.equal(result.puzzle, undefined);
  assert.ok(result.bestCandidate);
  assert.ok((result.diagnostics.rejectedByReason['score-too-low'] ?? 0) >= 1);
}

function testGenerateOneSmoke(): void {
  const defaultSeedResult = generateOne({
    minimality: 'none',
    constraints: {
      clues: { target: 40, min: 35, max: 45 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  });
  assert.notEqual(defaultSeedResult.status, 'invalid-request');

  const searchOnlyFieldsIgnored = generateOne({
    seed: 1,
    maxResults: 1,
    scoreBucketSize: 50,
    minimality: 'none',
    constraints: {
      score: { target: 999999, tolerance: 0 },
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 2,
      maxElapsedMs: 3000,
    },
  });
  assert.notEqual(searchOnlyFieldsIgnored.status, 'invalid-request');
  assert.equal(searchOnlyFieldsIgnored.diagnostics.attempts, 2);

  const result = generateOne({
    seed: 1,
    minimality: 'none',
    constraints: {
      clues: { target: 40, min: 35, max: 45 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  });
  assert.ok(['success', 'no-match', 'timeout', 'attempt-limit'].includes(result.status));
  assert.equal(result.diagnostics.attempts >= 1, true);
  if (result.puzzle) {
    assert.equal(result.puzzle.solved, true);
    assert.equal(result.puzzle.puzzle.length, 81);
    assert.equal(result.puzzle.solution.length, 81);
    assert.equal(result.puzzle.clueCount, 40);
    const uniqueness = checkUniqueness(result.puzzle.puzzle);
    assert.equal(uniqueness.uniqueSolution, true);
  }
}

function testPuzzleMinimizerHonorsTimeout(): void {
  const minimizer = new PuzzleMinimizer();
  const puzzle = parsePuzzle('534678912672195348198342567859761423426853791713924856961537284287419635345286179');
  const result = minimizer.minimize(puzzle, { maxElapsedMs: 0 });
  assert.equal(result.aborted, true);
  assert.deepEqual(result.puzzle, puzzle);
}

function testGenerateRejectsUnsolvedByRatingPolicy(): void {
  const result = generateOne({
    seed: 1,
    minimality: 'none',
    constraints: {
      clues: { target: 40 },
      allowedTechniques: ['full-house'],
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  });
  assert.notEqual(result.status, 'success');
  assert.equal(result.puzzle, undefined);
  assert.ok((result.diagnostics.rejectedByReason['unsolved-by-rating-policy'] ?? 0) >= 1);
  assert.equal(result.bestCandidate?.solved, false);
}

function testGenerateCli(): void {
  const result = runCli([
    'generate',
    '{"seed":1,"minimality":"none","constraints":{"clues":{"target":40,"min":35,"max":45}},"budget":{"maxAttempts":1,"maxElapsedMs":3000}}',
  ]);
  assert.equal(result.exitCode, 0);
  assert.equal(typeof result.output, 'object');
}

function testGenerateTechniqueConstraints(): void {
  const forbiddenResult = generateOne({
    seed: 1,
    minimality: 'none',
    constraints: {
      clues: { target: 40 },
      forbiddenTechniques: ['naked-single'],
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  });
  assert.ok(
    forbiddenResult.status === 'success'
      || Object.keys(forbiddenResult.diagnostics.rejectedByReason).length > 0,
  );

  const requiredResult = generateOne({
    seed: 1,
    minimality: 'none',
    constraints: {
      clues: { target: 40 },
      requiredTechniques: [{ type: 'appears', techniques: ['two-string-kite'] }],
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  });
  assert.ok(
    requiredResult.status === 'success'
      || (requiredResult.diagnostics.rejectedByReason['missing-required-technique'] ?? 0) >= 1,
  );
}

function testGenerateRelaxation(): void {
  const result = generateOne({
    seed: 1,
    minimality: 'none',
    constraints: {
      score: { min: 3000, max: 3050 },
      clues: { target: 40, min: 40, max: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 1000,
    },
    relaxation: {
      enabled: true,
      maxRounds: 1,
      scoreExpansionPerRound: 200,
      clueExpansionPerRound: 2,
      attemptMultiplierPerRound: 2,
    },
  });
  assert.ok(result.relaxationsApplied);
  assert.ok(result.relaxationsApplied!.length >= 1);

  const targetOnly = generateOne({
    seed: 1,
    minimality: 'none',
    constraints: {
      score: { min: 3000, max: 3050 },
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 1000,
    },
    relaxation: {
      enabled: true,
      maxRounds: 1,
      scoreExpansionPerRound: 200,
      clueExpansionPerRound: 2,
      attemptMultiplierPerRound: 2,
    },
  });
  assert.equal(
    (targetOnly.relaxationsApplied ?? []).some((item) => item.type === 'clue-range-expanded'),
    false,
  );

  const scoreTargetOnly = generateOne({
    seed: 1,
    minimality: 'none',
    constraints: {
      score: { target: 3000, tolerance: 50 },
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 1000,
    },
    relaxation: {
      enabled: true,
      maxRounds: 1,
      scoreExpansionPerRound: 200,
      clueExpansionPerRound: 2,
      attemptMultiplierPerRound: 2,
    },
  });
  assert.equal(
    (scoreTargetOnly.relaxationsApplied ?? []).some((item) => item.type === 'score-range-expanded'),
    false,
  );

  const boundedNoop = generateOne({
    seed: 1,
    minimality: 'none',
    constraints: {
      score: { min: 0 },
      clues: { min: 0, max: 81 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 1000,
    },
    relaxation: {
      enabled: true,
      maxRounds: 1,
      scoreExpansionPerRound: 200,
      clueExpansionPerRound: 2,
      attemptMultiplierPerRound: 2,
    },
  });
  assert.equal(
    (boundedNoop.relaxationsApplied ?? []).some((item) => item.type === 'score-range-expanded' || item.type === 'clue-range-expanded'),
    false,
  );
}

function testSearchSmoke(): void {
  const defaultSeedEvents = [...search({
    maxResults: 1,
    scoreBucketSize: 100,
    minimality: 'none',
    constraints: {
      clues: { target: 40, min: 35, max: 45 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  })];
  assert.ok(defaultSeedEvents.some((event) => event.type === 'done'));

  const events = [...search({
    seed: 1,
    maxResults: 1,
    scoreBucketSize: 100,
    minimality: 'none',
    constraints: {
      clues: { target: 40, min: 35, max: 45 },
    },
    budget: {
      maxAttempts: 2,
      maxElapsedMs: 3000,
    },
  })];
  const done = events.find((event) => event.type === 'done');
  assert.ok(done);
  if (done?.type === 'done') {
    assert.equal(done.summary.accepted, done.accepted);
    assert.equal(done.summary.rejected, done.rejected);
    assert.ok(Object.keys(done.summary.scoreBuckets).length >= 1 || done.accepted === 0);
    assert.ok(Object.keys(done.summary.techniqueHits).length >= 1 || done.accepted === 0);
  }
  assert.ok(events.length >= 1);
}

function testSearchRejectsInvalidOptions(): void {
  assert.throws(() => [...search({ maxResults: 0 } as never)], /maxResults/);
  assert.throws(() => [...search({ scoreBucketSize: 0 } as never)], /scoreBucketSize/);
  assert.throws(() => [...search({ scoreBucketSize: -1 } as never)], /scoreBucketSize/);
  assert.throws(() => [...search({ maxResult: 1 } as never)], /未知字段/);
  assert.throws(() => [...search({ constraints: { clues: { target: 10 } }, budget: { maxAttempts: 2 } } as never)], /clue-target/);
  assert.throws(() => [...search({ seed: 0 } as never)], /seed/);
  assert.throws(() => [...search({ seed: 0xffffffff, budget: { maxAttempts: 2 } } as never)], /seed range/);
  assert.throws(() => [...search({ maxResults: 1, relaxation: { enabled: true } } as never)], /relaxation/);

  const result = runCli([
    'search',
    '{"seed":1,"maxResults":0,"minimality":"none","budget":{"maxAttempts":1,"maxElapsedMs":3000}}',
    '--summary-only',
  ]);
  assert.equal(result.exitCode, 1);

  const typoResult = runCli([
    'search',
    '{"seed":1,"maxResult":1,"minimality":"none","budget":{"maxAttempts":1,"maxElapsedMs":3000}}',
    '--summary-only',
  ]);
  assert.equal(typoResult.exitCode, 1);

  const invalidGenerationResult = runCli([
    'search',
    '{"seed":1,"maxResults":1,"minimality":"none","constraints":{"clues":{"target":10}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}',
    '--summary-only',
  ]);
  assert.equal(invalidGenerationResult.exitCode, 1);
}

function testSearchUsesStableSeedSequence(): void {
  const events = [...search({
    seed: 100,
    maxResults: 2,
    minimality: 'none',
    constraints: {
      clues: { target: 40, min: 35, max: 45 },
    },
    budget: {
      maxAttempts: 2,
      maxElapsedMs: 3000,
    },
  })];
  const generatedSeeds = events
    .flatMap((event) => event.type === 'accepted' && event.puzzle ? [event.puzzle.seed] : []);
  assert.equal(generatedSeeds.every((seed) => seed >= 100 && seed < 102), true);
}

function testSearchCliSummaryOnly(): void {
  const result = runCli([
    'search',
    '{"seed":1,"maxResults":1,"scoreBucketSize":100,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}',
    '--summary-only',
  ]);
  assert.equal(result.exitCode, 0);
  assert.equal((result.output as { type?: string }).type, 'done');
}

function testSearchCliEventFilter(): void {
  const result = runCli([
    'search',
    '{"seed":1,"maxResults":1,"scoreBucketSize":100,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}',
    '--events',
    'done',
  ]);
  assert.equal(result.exitCode, 0);
  assert.ok(Array.isArray(result.output));
  assert.equal((result.output as Array<{ type: string }>).every((event) => event.type === 'done'), true);

  const tmpDir = join(process.cwd(), 'dist', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const invalidSummaryPath = join(tmpDir, `invalid-events-summary-${process.pid}.json`);
  const invalidCandidatesPath = join(tmpDir, `invalid-events-candidates-${process.pid}.json`);
  const invalidManifestPath = join(tmpDir, `invalid-events-manifest-${process.pid}.json`);
  const invalidResult = runCli([
    'search',
    '{"seed":1,"maxResults":1,"scoreBucketSize":100,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}',
    '--write-summary',
    invalidSummaryPath,
    '--write-candidates',
    invalidCandidatesPath,
    '--write-manifest',
    invalidManifestPath,
    '--overwrite-manifest',
    '--events',
    'accepted,typo',
  ]);
  assert.equal(invalidResult.exitCode, 1);
  assert.equal(existsSync(invalidSummaryPath), false);
  assert.equal(existsSync(invalidCandidatesPath), false);
  assert.equal(existsSync(invalidManifestPath), false);

  const missingWriteCandidatesPath = runCli([
    'search',
    '{"seed":1,"maxResults":1,"scoreBucketSize":100,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}',
    '--write-candidates',
  ]);
  assert.equal(missingWriteCandidatesPath.exitCode, 1);

  const duplicateOutputPath = join(tmpDir, `duplicate-search-output-${process.pid}.json`);
  const duplicateOutputResult = runCli([
    'search',
    '{"seed":1,"maxResults":1,"scoreBucketSize":100,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}',
    '--write-candidates',
    duplicateOutputPath,
    '--write-summary',
    duplicateOutputPath,
  ]);
  assert.equal(duplicateOutputResult.exitCode, 1);
}

function testSearchCliWriteCandidates(): void {
  const tmpDir = join(process.cwd(), 'dist', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const outputPath = join(tmpDir, 'search-candidates.json');
  const summaryPath = join(tmpDir, 'search-summary.json');
  const manifestPath = join(tmpDir, 'search-manifest.json');
  const result = runCli([
    'search',
    '{"seed":1,"maxResults":1,"scoreBucketSize":100,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}',
    '--summary-only',
    '--write-candidates',
    outputPath,
    '--write-summary',
    summaryPath,
    '--write-manifest',
    manifestPath,
    '--overwrite-manifest',
  ]);
  assert.equal(result.exitCode, 0);
  const written = JSON.parse(readFileSync(outputPath, 'utf8')) as unknown[];
  assert.ok(Array.isArray(written));
  assert.equal(written.length, 1);
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8')) as { accepted?: number };
  assert.equal(summary.accepted, 1);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { nextSeed?: number; runs?: unknown[] };
  assert.equal(manifest.nextSeed, 2);
  assert.equal(manifest.runs?.length, 1);

  const appendResult = runCli([
    'search',
    '{"seed":1,"maxResults":1,"scoreBucketSize":100,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}',
    '--summary-only',
    '--write-candidates',
    outputPath,
    '--append-candidates',
    '--resume-manifest',
    manifestPath,
  ]);
  assert.equal(appendResult.exitCode, 0);
  const appended = JSON.parse(readFileSync(outputPath, 'utf8')) as unknown[];
  assert.equal(appended.length, 2);
  const resumedManifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { nextSeed?: number; runs?: unknown[] };
  assert.equal(resumedManifest.nextSeed, 3);
  assert.equal(resumedManifest.runs?.length, 2);

  const scoreBucketResumeResult = runCli([
    'search',
    '{"seed":1,"maxResults":1,"scoreBucketSize":50,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}',
    '--summary-only',
    '--write-candidates',
    outputPath,
    '--append-candidates',
    '--resume-manifest',
    manifestPath,
  ]);
  assert.equal(scoreBucketResumeResult.exitCode, 0);
  const scoreBucketResumedManifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { nextSeed?: number; runs?: unknown[] };
  assert.equal(scoreBucketResumedManifest.nextSeed, 4);
  assert.equal(scoreBucketResumedManifest.runs?.length, 3);

  const manifestSummaryResult = runCli(['manifest-summary', manifestPath]);
  assert.equal(manifestSummaryResult.exitCode, 0);
  assert.equal((manifestSummaryResult.output as { manifests?: number }).manifests, 1);
  assert.equal((manifestSummaryResult.output as { runs?: number }).runs, 3);
  assert.equal((manifestSummaryResult.output as { accepted?: number }).accepted, 3);

  const mismatchResult = runCli([
    'search',
    '{"seed":1,"maxResults":1,"scoreBucketSize":100,"minimality":"strict","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}',
    '--summary-only',
    '--resume-manifest',
    manifestPath,
  ]);
  assert.equal(mismatchResult.exitCode, 1);

  const invalidManifestPath = join(tmpDir, 'invalid-search-manifest.json');
  const invalidManifestResult = runCli([
    'search',
    '{"seed":1,"maxResults":1,"minimality":"none","constraints":{"clues":{"target":10}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}',
    '--summary-only',
    '--write-manifest',
    invalidManifestPath,
  ]);
  assert.equal(invalidManifestResult.exitCode, 1);
  assert.equal(existsSync(invalidManifestPath), false);

  const invalidAppendPath = join(tmpDir, 'invalid-append-candidates.json');
  writeFileSync(invalidAppendPath, JSON.stringify([{ score: 1 }]), 'utf8');
  const invalidAppendResult = runCli([
    'search',
    '{"seed":1,"maxResults":1,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}',
    '--summary-only',
    '--write-candidates',
    invalidAppendPath,
    '--append-candidates',
  ]);
  assert.equal(invalidAppendResult.exitCode, 1);
}

function testSearchCliManifestSeedMatchesGeneratedCandidates(): void {
  const tmpDir = join(process.cwd(), 'dist', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const candidatesPath = join(tmpDir, 'manifest-seed-candidates.json');
  const manifestPath = join(tmpDir, 'manifest-seed-search-manifest.json');
  const result = runCli([
    'search',
    '{"seed":20,"maxResults":1,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":1,"maxElapsedMs":3000}}',
    '--summary-only',
    '--write-candidates',
    candidatesPath,
    '--write-manifest',
    manifestPath,
    '--overwrite-manifest',
  ]);
  assert.equal(result.exitCode, 0);
  const candidates = JSON.parse(readFileSync(candidatesPath, 'utf8')) as Array<{ seed?: number }>;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { runs?: Array<{ seedStart?: number; seedEndExclusive?: number }> };
  assert.equal(manifest.runs?.[0]?.seedStart, 20);
  assert.equal(manifest.runs?.[0]?.seedEndExclusive, 21);
  if (candidates.length > 0) {
    assert.equal(candidates[0]?.seed, 20);
  }
}

function testSelectFromCandidates(): void {
  const first = generateOne({
    seed: 1,
    minimality: 'none',
    canonicalize: true,
    constraints: {
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  }).puzzle;
  const second = generateOne({
    seed: 2,
    minimality: 'none',
    canonicalize: true,
    constraints: {
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  }).puzzle;

  assert.ok(first);
  assert.ok(second);

  const result = selectFromCandidates([first, second], {
    maxResults: 1,
    dedupeCanonical: true,
    preferredTechniques: ['full-house'],
    scoreBuckets: [{ min: 0, max: 5000, limit: 1 }],
  });
  assert.equal(result.selected.length, 1);
  assert.equal(result.diagnostics.selected, 1);
  assert.equal(result.diagnostics.rejected, 1);
  assert.equal(result.diagnostics.scoreBucketCounts[0]?.selected, 1);

  assert.throws(() => selectFromCandidates([{ ...first, score: Number.NaN } as never], {
    maxResults: 1,
  }), /score/);
  assert.throws(() => selectFromCandidates([{ ...first, puzzle: undefined } as never], {
    maxResults: 1,
  }), /puzzle/);
  assert.throws(() => selectFromCandidates([{ ...first, techniqueCounts: { 'not-a-technique': 1 } } as never], {
    maxResults: 1,
  }), /未知技巧/);
  assert.throws(() => selectFromCandidates([{ ...first, seed: 0 } as never], {
    maxResults: 1,
  }), /seed/);

  assert.throws(() => selectFromCandidates([first], {
    maxResults: 1,
    scoreBuckets: [{ min: 5000, max: 0 }],
  }), /min 不能大于 max/);

  assert.throws(() => selectFromCandidates([first], {
    maxResults: 1,
    preferredTechniques: ['missing-technique' as never],
  }), /未知 preferredTechniques/);

  assert.throws(() => selectFromCandidates([first], {
    maxResults: 1,
    scoreBuckets: [
      { min: 0, max: 100 },
      { min: 100, max: 200 },
    ],
  }), /不能重叠/);

  const outOfBucket = {
    ...first,
    score: 9000,
  };
  const inBucketSameCanonical = {
    ...first,
    seed: first.seed + 100,
    score: 1000,
  };
  const canonicalAfterBucketResult = selectFromCandidates([outOfBucket, inBucketSameCanonical], {
    maxResults: 1,
    dedupeCanonical: true,
    scoreBuckets: [{ min: 0, max: 2000, limit: 1 }],
  });
  assert.equal(canonicalAfterBucketResult.selected.length, 1);
  assert.equal(canonicalAfterBucketResult.selected[0]?.score, 1000);
  assert.equal(canonicalAfterBucketResult.diagnostics.rejectedByReason['score-out-of-buckets'], 1);
  assert.throws(() => selectFromCandidates([first], {
    maxResults: 1,
    scoreBuckets: [{ min: Number.NaN, max: 100 }],
  }), /有限数字 min 和 max/);
  assert.throws(() => selectFromCandidates([first], {
    maxResults: 1,
    scoreBuckets: [{ min: 0, max: Number.POSITIVE_INFINITY }],
  }), /有限数字 min 和 max/);
  assert.throws(() => selectFromCandidates([first], {
    maxResults: 1,
    scoreBuckets: [{ min: Number.NEGATIVE_INFINITY, max: 100 }],
  }), /有限数字 min 和 max/);

  const firstWithoutCanonical = { ...first };
  const secondWithoutCanonical = { ...first, seed: first.seed + 200 };
  delete firstWithoutCanonical.canonicalKey;
  delete secondWithoutCanonical.canonicalKey;
  const dedupeWithoutCanonicalKeyResult = selectFromCandidates([firstWithoutCanonical, secondWithoutCanonical], {
    maxResults: 2,
    dedupeCanonical: true,
  });
  assert.equal(dedupeWithoutCanonicalKeyResult.selected.length, 1);
  assert.equal(dedupeWithoutCanonicalKeyResult.diagnostics.rejectedByReason['canonical-duplicate'], 1);

  const duplicateDoesNotConsumeBucketResult = selectFromCandidates([first, { ...first, seed: first.seed + 300 }, second], {
    maxResults: 2,
    dedupeCanonical: true,
    scoreBuckets: [{ min: 0, max: 5000, limit: 2 }],
  });
  assert.equal(duplicateDoesNotConsumeBucketResult.selected.length, 2);
  assert.equal(duplicateDoesNotConsumeBucketResult.diagnostics.rejectedByReason['canonical-duplicate'], 1);
  assert.equal(duplicateDoesNotConsumeBucketResult.diagnostics.rejectedByReason['score-bucket-full'] ?? 0, 0);

  const clonedSelection = selectFromCandidates([first, second], { maxResults: 1 });
  clonedSelection.selected[0]!.puzzle[0] = 9;
  assert.notEqual(first.puzzle[0], 9);
}

function testCliParsesInlineJsonArray(): void {
  const result = runCli(['candidate-stats', '[]']);
  assert.equal(result.exitCode, 0);
  assert.equal((result.output as { total?: number }).total, 0);

  mkdirSync('./dist/tmp', { recursive: true });
  const bracketPath = './dist/tmp/[candidates].json';
  writeFileSync(bracketPath, '[]', 'utf8');
  const fileResult = runCli(['candidate-stats', bracketPath]);
  assert.equal(fileResult.exitCode, 0);
  assert.equal((fileResult.output as { total?: number }).total, 0);

  const cliImportOutput = execFileSync(process.execPath, ['--input-type=module', '-'], {
    cwd: process.cwd(),
    input: "import { runCli } from './dist/src/cli/index.js'; process.stdout.write(typeof runCli);",
    encoding: 'utf8',
  });
  assert.equal(cliImportOutput, 'function');

  const cliErrorOutput = spawnSync(process.execPath, ['dist/src/cli/index.js', 'unknown-command'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(cliErrorOutput.status, 1);
  assert.equal(cliErrorOutput.stdout, '');
  assert.match(cliErrorOutput.stderr, /Unknown command/);
}

function testSelectCli(): void {
  const first = generateOne({
    seed: 1,
    minimality: 'none',
    canonicalize: true,
    constraints: {
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  }).puzzle;
  const second = generateOne({
    seed: 2,
    minimality: 'none',
    canonicalize: true,
    constraints: {
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  }).puzzle;
  assert.ok(first);
  assert.ok(second);

  const tmpDir = join(process.cwd(), 'dist', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const candidatesPath = join(tmpDir, 'candidates.json');
  const planPath = join(tmpDir, 'selection-plan.json');
  const selectedPath = join(tmpDir, 'selected.json');
  const rejectedPath = join(tmpDir, 'rejected.json');
  writeFileSync(candidatesPath, JSON.stringify([first, second]), 'utf8');
  writeFileSync(planPath, JSON.stringify({
    maxResults: 1,
    dedupeCanonical: true,
    scoreBuckets: [{ min: 0, max: 5000, limit: 1 }],
  }), 'utf8');

  const result = runCli([
    'select',
    candidatesPath,
    planPath,
    '--write-selected',
    selectedPath,
    '--write-rejected',
    rejectedPath,
  ]);
  assert.equal(result.exitCode, 0);
  assert.equal(typeof result.output, 'object');
  assert.equal((result.output as { selected?: unknown[] }).selected?.length, 1);
  const selected = JSON.parse(readFileSync(selectedPath, 'utf8')) as unknown[];
  const rejected = JSON.parse(readFileSync(rejectedPath, 'utf8')) as unknown[];
  assert.equal(selected.length, 1);
  assert.ok(Array.isArray(rejected));
}

function testParallelSearchPlanCli(): void {
  const result = runCli([
    'parallel-search-plan',
    '{"seed":10,"maxResults":1,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}',
    '--out-dir',
    './dist/tmp/shards',
    '--workers',
    '3',
    '--attempts-per-worker',
    '5',
  ]);
  assert.equal(result.exitCode, 0);
  const plan = result.output as Array<{ seedStart: number; seedEndExclusive: number; request: { maxResults?: number; budget?: { maxAttempts?: number } }; argv: string[]; command: string }>;
  assert.equal(plan.length, 3);
  assert.equal(plan[0]?.seedStart, 10);
  assert.equal(plan[0]?.seedEndExclusive, 15);
  assert.equal(plan[1]?.seedStart, 15);
  assert.equal(plan[0]?.request.maxResults, 5);
  assert.equal(plan[0]?.request.budget?.maxAttempts, 5);
  assert.match(plan[0]?.command ?? '', /--write-candidates/);
  assert.match(plan[0]?.command ?? '', /^sudoku search /);
  assert.doesNotMatch(plan[0]?.command ?? '', /dist\/src\/cli\/index\.js/);
  assert.equal(plan[0]?.argv[0], 'sudoku');
  assert.equal(plan[0]?.argv.includes('--write-candidates'), true);

  const defaultSeedPlanResult = runCli([
    'parallel-search-plan',
    '{"maxResults":1,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":1,"maxElapsedMs":3000}}',
    '--out-dir',
    './dist/tmp/shards',
    '--workers',
    '1',
    '--attempts-per-worker',
    '1',
  ]);
  assert.equal(defaultSeedPlanResult.exitCode, 0);
  const defaultSeedPlan = defaultSeedPlanResult.output as Array<{ seedStart: number }>;
  assert.equal(defaultSeedPlan[0]!.seedStart >= 1 && defaultSeedPlan[0]!.seedStart <= 0xffffffff, true);

  const zeroSeedResult = runCli([
    'parallel-search-plan',
    '{"maxResults":1,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":1,"maxElapsedMs":3000}}',
    '--out-dir',
    './dist/tmp/shards',
    '--workers',
    '1',
    '--attempts-per-worker',
    '1',
    '--seed-start',
    '0',
  ]);
  assert.equal(zeroSeedResult.exitCode, 1);

  const missingWorkersValue = runCli([
    'parallel-search-plan',
    '{"seed":10,"maxResults":1,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}',
    '--out-dir',
    './dist/tmp/shards',
    '--workers',
  ]);
  assert.equal(missingWorkersValue.exitCode, 1);

  const invalidClueRequest = runCli([
    'parallel-search-plan',
    '{"constraints":{"clues":{"target":10}}}',
    '--out-dir',
    './dist/tmp/shards',
  ]);
  assert.equal(invalidClueRequest.exitCode, 1);

  const invalidMaxResultsRequest = runCli([
    'parallel-search-plan',
    '{"maxResults":"x","minimality":"none","constraints":{"clues":{"target":40}}}',
    '--out-dir',
    './dist/tmp/shards',
  ]);
  assert.equal(invalidMaxResultsRequest.exitCode, 1);

  const invalidSeedRequest = runCli([
    'parallel-search-plan',
    '{"seed":"abc","maxResults":1,"minimality":"none","constraints":{"clues":{"target":40}}}',
    '--out-dir',
    './dist/tmp/shards',
  ]);
  assert.equal(invalidSeedRequest.exitCode, 1);

  const overflowingSeedRange = runCli([
    'parallel-search-plan',
    '{"maxResults":1,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":1,"maxElapsedMs":3000}}',
    '--out-dir',
    './dist/tmp/shards',
    '--workers',
    '2',
    '--attempts-per-worker',
    '2',
    '--seed-start',
    String(0xffffffff - 1),
  ]);
  assert.equal(overflowingSeedRange.exitCode, 1);
}

function testMergeCandidatesCli(): void {
  const first = generateOne({
    seed: 1,
    minimality: 'none',
    canonicalize: true,
    constraints: {
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  }).puzzle;
  const second = generateOne({
    seed: 2,
    minimality: 'none',
    canonicalize: true,
    constraints: {
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  }).puzzle;
  assert.ok(first);
  assert.ok(second);

  const tmpDir = join(process.cwd(), 'dist', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const firstPath = join(tmpDir, 'merge-first.json');
  const secondPath = join(tmpDir, 'merge-second.json');
  const invalidPath = join(tmpDir, 'merge-invalid.json');
  const outputPath = join(tmpDir, 'merged-candidates.json');
  writeFileSync(firstPath, JSON.stringify([first, first]), 'utf8');
  writeFileSync(secondPath, JSON.stringify([second]), 'utf8');
  writeFileSync(invalidPath, JSON.stringify([{ ...first, score: null }]), 'utf8');

  const result = runCli([
    'merge-candidates',
    firstPath,
    secondPath,
    '--out',
    outputPath,
    '--dedupe-canonical',
  ]);
  assert.equal(result.exitCode, 0);
  const merged = JSON.parse(readFileSync(outputPath, 'utf8')) as unknown[];
  assert.equal(merged.length, 2);
  assert.equal((result.output as { duplicatesSkipped?: number }).duplicatesSkipped, 1);

  const invalidResult = runCli([
    'merge-candidates',
    invalidPath,
    '--out',
    outputPath,
  ]);
  assert.equal(invalidResult.exitCode, 1);
  assert.match(JSON.stringify(invalidResult.output), /score/);
}

function testCandidatePoolStatsAndDedupeApi(): void {
  const first = generateOne({
    seed: 1,
    minimality: 'none',
    canonicalize: true,
    constraints: {
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  }).puzzle;
  const second = generateOne({
    seed: 2,
    minimality: 'none',
    canonicalize: true,
    constraints: {
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  }).puzzle;
  assert.ok(first);
  assert.ok(second);

  const stats = analyzeCandidatePool([first, first, second], {
    scoreBucketSize: 100,
    clueBucketSize: 5,
  });
  assert.equal(stats.total, 3);
  assert.equal(stats.canonical.withKey, 3);
  assert.equal(stats.canonical.uniqueKeys, 2);
  assert.equal(stats.canonical.duplicateKeys, 1);
  assert.equal(stats.seeds.duplicates, 1);
  assert.ok(Object.keys(stats.score.buckets).length >= 1);
  assert.throws(() => analyzeCandidatePool([first], { scoreBucketSize: 0 }), /scoreBucketSize/);
  assert.throws(() => analyzeCandidatePool([first], { scoreBucketSize: -1 }), /scoreBucketSize/);
  assert.throws(() => analyzeCandidatePool([first], { scoreBucketSize: 1.5 }), /scoreBucketSize/);
  assert.throws(() => analyzeCandidatePool([first], { clueBucketSize: Number.NaN }), /clueBucketSize/);
  assert.throws(() => analyzeCandidatePool([{ ...first, score: null } as never]), /score/);
  assert.throws(() => analyzeCandidatePool([{ ...first, score: Number.NaN } as never]), /score/);
  assert.throws(() => analyzeCandidatePool([{ ...first, clueCount: null } as never]), /clueCount/);
  assert.throws(() => analyzeCandidatePool([{ ...first, puzzle: first.puzzle.slice(0, 80) } as never]), /81/);
  assert.throws(() => analyzeCandidatePool([{ ...first, solution: new Array<number>(81).fill(0) } as never]), /solution/);
  const clueIndex = first.puzzle.findIndex((value) => value !== 0);
  assert.ok(clueIndex >= 0);
  const mismatchedSolution = [...first.solution];
  mismatchedSolution[clueIndex] = (first.puzzle[clueIndex]! % 9) + 1;
  assert.throws(() => analyzeCandidatePool([{ ...first, solution: mismatchedSolution } as never]), /solution/);
  assert.throws(() => analyzeCandidatePool([{ ...first, canonicalKey: '0'.repeat(81) } as never]), /canonicalKey/);
  assert.throws(() => dedupeCandidates([{ ...first, techniqueCounts: { 'not-a-technique': 1 } } as never]), /未知技巧/);

  const deduped = dedupeCandidates([first, first, second], { key: 'canonical' });
  assert.equal(deduped.candidates.length, 2);
  assert.equal(deduped.rejected.length, 1);
  assert.equal(deduped.diagnostics.removed, 1);
  deduped.candidates[0]!.puzzle[0] = 9;
  assert.notEqual(first.puzzle[0], 9);
}

function testCandidatePoolStatsAndDedupeCli(): void {
  const first = generateOne({
    seed: 1,
    minimality: 'none',
    canonicalize: true,
    constraints: {
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  }).puzzle;
  const second = generateOne({
    seed: 2,
    minimality: 'none',
    canonicalize: true,
    constraints: {
      clues: { target: 40 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  }).puzzle;
  assert.ok(first);
  assert.ok(second);

  const tmpDir = join(process.cwd(), 'dist', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const candidatesPath = join(tmpDir, 'stats-candidates.json');
  const invalidCandidatesPath = join(tmpDir, 'invalid-stats-candidates.json');
  const outputPath = join(tmpDir, 'deduped-candidates.json');
  const rejectedPath = join(tmpDir, 'deduped-rejected.json');
  writeFileSync(candidatesPath, JSON.stringify([first, first, second]), 'utf8');
  writeFileSync(invalidCandidatesPath, JSON.stringify([{ ...first, score: null }]), 'utf8');

  const statsResult = runCli([
    'candidate-stats',
    candidatesPath,
    '--score-bucket-size',
    '100',
    '--clue-bucket-size',
    '5',
  ]);
  assert.equal(statsResult.exitCode, 0);
  assert.equal((statsResult.output as { total?: number }).total, 3);
  const invalidStatsResult = runCli(['candidate-stats', invalidCandidatesPath]);
  assert.equal(invalidStatsResult.exitCode, 1);
  assert.match(JSON.stringify(invalidStatsResult.output), /score/);

  const dedupeResult = runCli([
    'dedupe-candidates',
    candidatesPath,
    '--out',
    outputPath,
    '--write-rejected',
    rejectedPath,
  ]);
  assert.equal(dedupeResult.exitCode, 0);
  const deduped = JSON.parse(readFileSync(outputPath, 'utf8')) as unknown[];
  const rejected = JSON.parse(readFileSync(rejectedPath, 'utf8')) as unknown[];
  assert.equal(deduped.length, 2);
  assert.equal(rejected.length, 1);
}

function testPresentation(): void {
  const almostSolved = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';
  const analysis = walkthrough(almostSolved);
  const formatted = formatStep(analysis.steps[0]!, {
    locale: 'zh-CN',
    style: 'teaching',
    stepNumber: 1,
  });
  assert.match(formatted, /第 1 步/);
  assert.match(formatted, /满屋法/);
  assert.match(formatted, /r9c9 填 9/);
  assert.doesNotMatch(formatted, /Only one empty cell/);

  const formattedEn = formatStep(analysis.steps[0]!, {
    locale: 'en-US',
    style: 'short',
    stepNumber: 1,
  });
  assert.doesNotMatch(formattedEn, /\.Reason/);
  assert.doesNotMatch(formattedEn, /\.\./);
  assert.match(formattedEn, /\. Reason:/);

  const forcingStep = nextStep(buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  ), { allowContradictoryCandidateState: true, allowedTechniques: ['forcing-nets'] });
  assert.ok(forcingStep);
  const forcingText = formatStep(forcingStep, {
    locale: 'zh-CN',
    style: 'teaching',
  });
  assert.match(forcingText, /分支：共/);
  assert.match(forcingText, /摘要|矛盾|穷尽/);

  const bugParityText = formatStep({
    technique: 'bug-plus-two',
    score: 214,
    actions: [{ type: 'eliminate', cell: 0, digit: 5 }],
    evidence: {
      pattern: { family: 'bug', subtype: 'bug-plus-two-parity-elimination' },
      cells: [{ cell: 0, digit: 5, role: 'target' }],
    },
  }, {
    locale: 'en-US',
    style: 'short',
  });
  assert.match(bugParityText, /bounded parity proof/);
  assert.doesNotMatch(bugParityText, /shared extra candidates/);

  const contradictionText = formatStep({
    technique: 'bowmans-bingo',
    score: 248,
    actions: [{ type: 'eliminate', cell: 79, digit: 9 }],
    evidence: {
      branches: [
        {
          assumption: { type: 'place', cell: 79, digit: 9 },
          contradiction: true,
          exhausted: true,
          contradictionAt: { kind: 'cell-empty', cell: 80 },
        },
      ],
    },
  }, {
    locale: 'zh-CN',
    style: 'teaching',
  });
  assert.match(contradictionText, /候选耗尽/);

  const invalidActionText = formatStep({
    technique: 'bowmans-bingo',
    score: 248,
    actions: [{ type: 'noop', cell: 79, digit: 9 }],
    evidence: {},
  } as never, {
    locale: 'en-US',
    style: 'short',
  });
  assert.match(invalidActionText, /\[invalid action: noop\]/);
}

function testSolveTextCli(): void {
  const almostSolved = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';
  const result = runCli(['solve', almostSolved, '--format', 'text', '--locale', 'zh-CN']);
  assert.equal(result.exitCode, 0);
  assert.equal(typeof result.output, 'string');
  assert.match(result.output as string, /满屋法/);
  assert.doesNotMatch(result.output as string, /Only one empty cell/);
}

function testLockedCandidates(): void {
  const board = parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const step = nextStep({
    board,
    constraints: {
      exactCandidates: [
        { cell: 0, digits: [1, 2] },
        { cell: 1, digits: [1, 3] },
        { cell: 2, digits: [4, 5] },
        { cell: 9, digits: [6, 7] },
        { cell: 10, digits: [6, 8] },
        { cell: 11, digits: [7, 8] },
        { cell: 18, digits: [2, 3] },
        { cell: 19, digits: [3, 4] },
        { cell: 20, digits: [4, 5] },
        { cell: 3, digits: [1, 9] },
      ],
    },
  }, { allowContradictoryCandidateState: true, allowedTechniques: ['locked-candidates'] });
  assert.equal(step?.technique, 'locked-candidates');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 1));
}

function testNakedPair(): void {
  const board = parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const step = nextStep({
    board,
    constraints: {
      exactCandidates: [
        { cell: 0, digits: [1, 2] },
        { cell: 1, digits: [1, 2] },
        { cell: 2, digits: [1, 2, 3] },
      ],
    },
  }, { allowContradictoryCandidateState: true, allowedTechniques: ['naked-pair'] });
  assert.equal(step?.technique, 'naked-pair');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 2 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 2 && action.digit === 2));
}

function testHiddenPair(): void {
  const board = parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const step = nextStep({
    board,
    constraints: {
      exactCandidates: [
        { cell: 0, digits: [1, 2, 3] },
        { cell: 1, digits: [1, 2, 4] },
        { cell: 2, digits: [3, 4] },
        { cell: 3, digits: [3, 4, 5] },
        { cell: 4, digits: [3, 4, 5] },
        { cell: 5, digits: [3, 4, 5] },
        { cell: 6, digits: [3, 4, 5] },
        { cell: 7, digits: [3, 4, 5] },
        { cell: 8, digits: [3, 4, 5] },
      ],
    },
  }, { allowContradictoryCandidateState: true, allowedTechniques: ['hidden-pair'] });
  assert.equal(step?.technique, 'hidden-pair');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 3));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 1 && action.digit === 4));
}

function testDirectTechniques(): void {
  for (const fixture of loadReferenceTechniqueFixtures().direct.map(toReferenceDirectFixture)) {
    assertReferenceDirectFixture(fixture);
  }
}

function testNakedTriple(): void {
  const board = parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const step = nextStep({
    board,
    constraints: {
      exactCandidates: [
        { cell: 0, digits: [1, 2] },
        { cell: 1, digits: [1, 3] },
        { cell: 2, digits: [2, 3] },
        { cell: 3, digits: [1, 2, 3, 4] },
      ],
    },
  }, { allowContradictoryCandidateState: true, allowedTechniques: ['naked-triple'] });
  assert.equal(step?.technique, 'naked-triple');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 2));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 3));
}

function testHiddenTriple(): void {
  const board = parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const step = nextStep({
    board,
    constraints: {
      exactCandidates: [
        { cell: 0, digits: [1, 2, 4] },
        { cell: 1, digits: [1, 3, 5] },
        { cell: 2, digits: [2, 3, 6] },
        { cell: 3, digits: [4, 5, 6] },
        { cell: 4, digits: [4, 5, 6] },
        { cell: 5, digits: [4, 5, 6] },
        { cell: 6, digits: [4, 5, 6] },
        { cell: 7, digits: [4, 5, 6] },
        { cell: 8, digits: [4, 5, 6] },
      ],
    },
  }, { allowContradictoryCandidateState: true, allowedTechniques: ['hidden-triple'] });
  assert.equal(step?.technique, 'hidden-triple');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 4));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 1 && action.digit === 5));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 2 && action.digit === 6));
}

function testNakedQuad(): void {
  const board = parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const step = nextStep({
    board,
    constraints: {
      exactCandidates: [
        { cell: 0, digits: [1, 2] },
        { cell: 1, digits: [1, 3] },
        { cell: 2, digits: [2, 4] },
        { cell: 3, digits: [3, 4] },
        { cell: 4, digits: [1, 2, 3, 4, 5] },
      ],
    },
  }, { allowContradictoryCandidateState: true, allowedTechniques: ['naked-quad'] });
  assert.equal(step?.technique, 'naked-quad');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 4));
}

function testHiddenQuad(): void {
  const board = parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const step = nextStep({
    board,
    constraints: {
      exactCandidates: [
        { cell: 0, digits: [1, 2, 5] },
        { cell: 1, digits: [1, 3, 6] },
        { cell: 2, digits: [2, 4, 7] },
        { cell: 3, digits: [3, 4, 8] },
        { cell: 4, digits: [5, 6, 7, 8, 9] },
        { cell: 5, digits: [5, 6, 7, 8, 9] },
        { cell: 6, digits: [5, 6, 7, 8, 9] },
        { cell: 7, digits: [5, 6, 7, 8, 9] },
        { cell: 8, digits: [5, 6, 7, 8, 9] },
      ],
    },
  }, { allowContradictoryCandidateState: true, allowedTechniques: ['hidden-quad'] });
  assert.equal(step?.technique, 'hidden-quad');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 5));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 8));
}

function buildExactCandidateState(overrides: Array<[number, number[]]>) {
  const board = parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const byCell = new Map(overrides);
  return {
    board,
    constraints: {
      exactCandidates: Array.from({ length: 81 }, (_, cell) => ({
        cell,
        digits: byCell.get(cell) ?? [8, 9],
      })),
    },
  };
}

function buildCandidateMaskState(overrides: Array<[number, number[]]>) {
  const board = parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const candidateMasks = new Array<number>(81).fill(0);
  for (const [cell, digits] of overrides) {
    candidateMasks[cell] = digits.reduce((mask, digit) => mask | (1 << (digit - 1)), 0);
  }
  return { board, candidateMasks };
}

function buildTrustedState(puzzle: string, overrides: Array<[number, number[]]>) {
  return {
    board: parsePuzzle(puzzle),
    constraints: {
      exactCandidatesMode: 'trusted' as const,
      exactCandidates: overrides.map(([cell, digits]) => ({ cell, digits })),
    },
  };
}

function hasElimination(step: ReturnType<typeof nextStep>, cell: number, digit: number): boolean {
  return step?.actions.some((action) => action.type === 'eliminate' && action.cell === cell && action.digit === digit) ?? false;
}

interface ReferenceDirectFixture {
  technique: Extract<TechniqueId, 'direct-pointing' | 'direct-claiming' | 'direct-hidden-pair' | 'direct-hidden-triplet'>;
  state: StateInput;
  expectedElimination: { cell: number; digit: number };
  expectedPlacement: { cell: number; digit: number };
}

interface ReferenceExpectedLink {
  from: number;
  to: number;
  digit?: number;
  type?: 'strong' | 'weak';
  house?: HouseRef;
}

interface ReferenceExpectedCell {
  cell: number;
  digit?: number;
  role?: 'reason' | 'target' | 'link' | 'pivot';
}

interface ReferenceExpectedNode {
  id: string;
  cells?: number[];
  digit?: number;
}

interface ReferenceChainFixture {
  technique: Extract<TechniqueId,
    | 'bidirectional-x-cycle'
    | 'bidirectional-y-cycle'
    | 'forcing-x-chain'
    | 'forcing-chain'
    | 'aic'
    | 'grouped-aic'
    | 'skyscraper'
    | 'two-string-kite'
    | 'turbot-fish'
    | 'empty-rectangle'>;
  state: StateInput;
  minLinks: number;
  expectedEliminations?: Array<{ cell: number; digit: number }>;
  expectedPlacements?: Array<{ cell: number; digit: number }>;
  minStrongLinks?: number;
  minWeakLinks?: number;
  minGroupedNodes?: number;
  expectedPattern?: { family: string; subtype?: string };
  expectedLinks?: ReferenceExpectedLink[];
  expectedNodes?: ReferenceExpectedNode[];
  expectedCells?: ReferenceExpectedCell[];
}

interface ReferenceWingFixture {
  technique: Extract<TechniqueId,
    | 'xy-wing'
    | 'xyz-wing'
    | 'wxyz-wing'
    | 'w-wing'
    | 'big-wings'
    | 'chute-remote-pairs'
    | 'remote-pairs'>;
  state: StateInput;
  expectedEliminations: Array<{ cell: number; digit: number }>;
  minLinks?: number;
  expectedPattern?: { family: string; subtype?: string };
  expectedLinks?: ReferenceExpectedLink[];
  expectedCells?: ReferenceExpectedCell[];
}

interface ReferenceFishFixture {
  technique: Extract<TechniqueId,
    | 'x-wing'
    | 'swordfish'
    | 'franken-swordfish'
    | 'jellyfish'
    | 'finned-x-wing'
    | 'sashimi-x-wing'
    | 'finned-swordfish'
    | 'finned-jellyfish'
    | 'sashimi-swordfish'
    | 'sashimi-jellyfish'
    | 'finned-franken-swordfish'
    | 'finned-franken-jellyfish'
    | 'larger-fish'
    | 'mutant-fish'>;
  state: StateInput;
  expectedEliminations: Array<{ cell: number; digit: number }>;
  expectedPattern: { family: string; subtype: string };
  expectedCells?: ReferenceExpectedCell[];
  expectedHouses?: HouseRef[];
}

interface ReferenceAlsFixture {
  technique: Extract<TechniqueId,
    | 'almost-locked-pair'
    | 'almost-locked-triple'
    | 'almost-locked-quad'
    | 'als-xz'
    | 'als-xy-wing'
    | 'aic-als'
    | 'fireworks'
    | 'twinned-xy-chains'
    | 'aligned-pair-exclusion'
    | 'death-blossom'
    | 'sue-de-coq'>;
  state: StateInput;
  expectedEliminations: Array<{ cell: number; digit: number }>;
  expectedPattern?: { family: string; subtype?: string };
  minLinks?: number;
  minNodes?: number;
  expectedLinks?: ReferenceExpectedLink[];
  expectedNodes?: ReferenceExpectedNode[];
}

interface ReferencePatternFixture {
  technique: Extract<TechniqueId,
    | 'exocet'
    | 'double-exocet'
    | 'pattern-overlay'
    | 'tridagons'
    | 'sk-loops'>;
  state: StateInput;
  expectedEliminations?: Array<{ cell: number; digit: number }>;
  expectedPlacements?: Array<{ cell: number; digit: number }>;
  expectedPattern?: { family: string; subtype?: string };
  minNodes?: number;
  expectedNodes?: ReferenceExpectedNode[];
  expectedNoteIncludes?: string[];
}

interface ReferenceTechniqueFixtureFile {
  direct: ReferenceDirectFixtureRecord[];
  fish?: ReferenceFishFixtureRecord[];
  chains: ReferenceChainFixtureRecord[];
  wings?: ReferenceWingFixtureRecord[];
  als?: ReferenceAlsFixtureRecord[];
  patterns?: ReferencePatternFixtureRecord[];
  uniqueness: ReferenceUniquenessFixtureRecord[];
  negative?: ReferenceNegativeFixtureRecord[];
}

interface ReferenceRatingCorpusFile {
  corpusId: 'reference-rating-corpus.v1';
  corpusKind: 'reference-rating';
  rows: ReferenceRatingCorpusRecord[];
}

interface ReferenceRatingCorpusRecord {
  id: string;
  externalBucket: string;
  profile: 'classic-stable' | 'classic-extended' | 'classic-galaxy';
  targetFirstTechniques?: TechniqueId[];
  puzzle: string;
  solution: string;
  expected: {
    solved: boolean;
    unique?: boolean;
    hardestTechnique?: TechniqueId;
    score?: number;
    scoreMin?: number;
    scoreMax?: number;
    stepCount?: number;
    techniqueCountsAtLeast?: Partial<Record<TechniqueId, number>>;
    techniqueCountsAtMost?: Partial<Record<TechniqueId, number>>;
  };
}

interface ReferenceDirectFixtureRecord {
  technique: ReferenceDirectFixture['technique'];
  stateKind?: 'exact' | 'puzzle';
  puzzle?: string;
  candidates?: Array<[number, number[]]>;
  expectedElimination: { cell: number; digit: number };
  expectedPlacement: { cell: number; digit: number };
}

interface ReferenceChainFixtureRecord {
  technique: ReferenceChainFixture['technique'];
  stateKind: 'exact' | 'mask';
  candidates: Array<[number, number[]]>;
  minLinks: number;
  expectedEliminations?: Array<{ cell: number; digit: number }>;
  expectedPlacements?: Array<{ cell: number; digit: number }>;
  minStrongLinks?: number;
  minWeakLinks?: number;
  minGroupedNodes?: number;
  expectedPattern?: { family: string; subtype?: string };
  expectedLinks?: ReferenceExpectedLink[];
  expectedNodes?: ReferenceExpectedNode[];
  expectedCells?: ReferenceExpectedCell[];
}

interface ReferenceFishFixtureRecord {
  technique: ReferenceFishFixture['technique'];
  stateKind: 'exact' | 'mask';
  candidates: Array<[number, number[]]>;
  expectedEliminations: Array<{ cell: number; digit: number }>;
  expectedPattern: { family: string; subtype: string };
  expectedCells?: ReferenceExpectedCell[];
  expectedHouses?: HouseRef[];
}

interface ReferenceWingFixtureRecord {
  technique: ReferenceWingFixture['technique'];
  stateKind: 'exact' | 'mask';
  candidates: Array<[number, number[]]>;
  expectedEliminations: Array<{ cell: number; digit: number }>;
  minLinks?: number;
  expectedPattern?: { family: string; subtype?: string };
  expectedLinks?: ReferenceExpectedLink[];
  expectedCells?: ReferenceExpectedCell[];
}

interface ReferenceAlsFixtureRecord {
  technique: ReferenceAlsFixture['technique'];
  stateKind: 'exact' | 'mask';
  candidates: Array<[number, number[]]>;
  expectedEliminations: Array<{ cell: number; digit: number }>;
  expectedPattern?: { family: string; subtype?: string };
  minLinks?: number;
  minNodes?: number;
  expectedLinks?: ReferenceExpectedLink[];
  expectedNodes?: ReferenceExpectedNode[];
}

interface ReferencePatternFixtureRecord {
  technique: ReferencePatternFixture['technique'];
  stateKind: 'exact' | 'mask' | 'trusted';
  puzzle?: string;
  candidates: Array<[number, number[]]>;
  expectedEliminations?: Array<{ cell: number; digit: number }>;
  expectedPlacements?: Array<{ cell: number; digit: number }>;
  expectedPattern?: { family: string; subtype?: string };
  minNodes?: number;
  expectedNodes?: ReferenceExpectedNode[];
  expectedNoteIncludes?: string[];
}

interface ReferenceUniquenessFixtureRecord {
  technique: Extract<TechniqueId,
    | 'unique-rectangle'
    | 'avoidable-rectangle'
    | 'rectangle-elimination'
    | 'extended-rectangle'
    | 'unique-loop'
    | 'hidden-unique-rectangle'
    | 'aic-ur'
    | 'bug-plus-one'
    | 'bug-plus-two'
    | 'bug-plus-n'
  >;
  stateKind: 'exact' | 'mask' | 'trusted';
  puzzle?: string;
  candidates: Array<[number, number[]]>;
  expectedEliminations?: Array<{ cell: number; digit: number }>;
  expectedPlacements?: Array<{ cell: number; digit: number }>;
  expectedPattern?: { family: string; subtype?: string };
  minLinks?: number;
  minNodes?: number;
  expectedNodes?: ReferenceExpectedNode[];
}

interface ReferenceNegativeFixtureRecord {
  technique: TechniqueId;
  stateKind: 'exact' | 'mask' | 'trusted';
  reason: string;
  puzzle?: string;
  defaultCandidates?: number[];
  candidates: Array<[number, number[]]>;
  forbiddenPattern?: { family: string; subtype?: string };
  forbiddenEliminations?: Array<{ cell: number; digit: number }>;
  forbiddenPlacements?: Array<{ cell: number; digit: number }>;
}

const EXPECTED_REFERENCE_DIRECT_SMOKE_TECHNIQUES: ReferenceDirectFixture['technique'][] = [
  'direct-pointing',
  'direct-claiming',
  'direct-hidden-pair',
  'direct-hidden-triplet',
];

const EXPECTED_REFERENCE_FISH_SMOKE_TECHNIQUES: ReferenceFishFixture['technique'][] = [
  'x-wing',
  'swordfish',
  'franken-swordfish',
  'jellyfish',
  'finned-x-wing',
  'sashimi-x-wing',
  'finned-swordfish',
  'finned-jellyfish',
  'sashimi-swordfish',
  'sashimi-jellyfish',
  'finned-franken-swordfish',
  'finned-franken-jellyfish',
  'larger-fish',
  'larger-fish',
  'mutant-fish',
];

const EXPECTED_REFERENCE_CHAIN_SMOKE_TECHNIQUES: ReferenceChainFixture['technique'][] = [
  'bidirectional-x-cycle',
  'bidirectional-x-cycle',
  'forcing-x-chain',
  'skyscraper',
  'skyscraper',
  'two-string-kite',
  'two-string-kite',
  'two-string-kite',
  'two-string-kite',
  'two-string-kite',
  'two-string-kite',
  'two-string-kite',
  'two-string-kite',
  'two-string-kite',
  'turbot-fish',
  'turbot-fish',
  'turbot-fish',
  'turbot-fish',
  'turbot-fish',
  'turbot-fish',
  'turbot-fish',
  'turbot-fish',
  'empty-rectangle',
  'empty-rectangle',
  'bidirectional-y-cycle',
  'bidirectional-y-cycle',
  'forcing-chain',
  'aic',
  'aic',
  'aic',
  'aic',
  'aic',
  'aic',
  'aic',
  'aic',
  'aic',
  'aic',
  'grouped-aic',
  'grouped-aic',
  'grouped-aic',
  'grouped-aic',
];

const EXPECTED_REFERENCE_WING_SMOKE_TECHNIQUES: ReferenceWingFixture['technique'][] = [
  'xy-wing',
  'xyz-wing',
  'wxyz-wing',
  'w-wing',
  'big-wings',
  'chute-remote-pairs',
  'remote-pairs',
];

const EXPECTED_REFERENCE_ALS_SMOKE_TECHNIQUES: ReferenceAlsFixture['technique'][] = [
  'almost-locked-pair',
  'almost-locked-triple',
  'almost-locked-quad',
  'als-xz',
  'als-xy-wing',
  'aic-als',
  'fireworks',
  'twinned-xy-chains',
  'aligned-pair-exclusion',
  'death-blossom',
  'sue-de-coq',
];

const EXPECTED_REFERENCE_PATTERN_SMOKE_TECHNIQUES: ReferencePatternFixture['technique'][] = [
  'exocet',
  'double-exocet',
  'pattern-overlay',
  'tridagons',
  'sk-loops',
];

const EXPECTED_REFERENCE_UNIQUENESS_SMOKE_TECHNIQUES: ReferenceUniquenessFixtureRecord['technique'][] = [
  'unique-rectangle',
  'avoidable-rectangle',
  'rectangle-elimination',
  'extended-rectangle',
  'unique-loop',
  'hidden-unique-rectangle',
  'aic-ur',
  'bug-plus-one',
  'bug-plus-two',
  'bug-plus-n',
];

function loadReferenceTechniqueFixtures(): ReferenceTechniqueFixtureFile {
  const raw = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/reference-techniques/reference-smoke.json'), 'utf8')) as unknown;
  assertReferenceTechniqueFixtureFile(raw);
  return raw;
}

function loadReferenceRatingCorpus(): ReferenceRatingCorpusFile {
  const raw = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/reference-techniques/reference-rating-corpus.json'), 'utf8')) as unknown;
  assertReferenceRatingCorpusFile(raw);
  return raw;
}

function toReferenceDirectFixture(record: ReferenceDirectFixtureRecord): ReferenceDirectFixture {
  return {
    technique: record.technique,
    state: record.stateKind === 'puzzle'
      ? parsePuzzle(record.puzzle!)
      : buildExactCandidateState(record.candidates!),
    expectedElimination: record.expectedElimination,
    expectedPlacement: record.expectedPlacement,
  };
}

function toReferenceChainFixture(record: ReferenceChainFixtureRecord): ReferenceChainFixture {
  return {
    technique: record.technique,
    state: record.stateKind === 'exact'
      ? buildExactCandidateState(record.candidates)
      : buildCandidateMaskState(record.candidates),
    minLinks: record.minLinks,
    ...(record.expectedEliminations ? { expectedEliminations: record.expectedEliminations } : {}),
    ...(record.expectedPlacements ? { expectedPlacements: record.expectedPlacements } : {}),
    ...(record.minStrongLinks !== undefined ? { minStrongLinks: record.minStrongLinks } : {}),
    ...(record.minWeakLinks !== undefined ? { minWeakLinks: record.minWeakLinks } : {}),
    ...(record.minGroupedNodes !== undefined ? { minGroupedNodes: record.minGroupedNodes } : {}),
    ...(record.expectedPattern ? { expectedPattern: record.expectedPattern } : {}),
    ...(record.expectedLinks ? { expectedLinks: record.expectedLinks } : {}),
    ...(record.expectedNodes ? { expectedNodes: record.expectedNodes } : {}),
    ...(record.expectedCells ? { expectedCells: record.expectedCells } : {}),
  };
}

function toReferenceFishFixture(record: ReferenceFishFixtureRecord): ReferenceFishFixture {
  return {
    technique: record.technique,
    state: record.stateKind === 'exact'
      ? buildExactCandidateState(record.candidates)
      : buildCandidateMaskState(record.candidates),
    expectedEliminations: record.expectedEliminations,
    expectedPattern: record.expectedPattern,
    ...(record.expectedCells ? { expectedCells: record.expectedCells } : {}),
    ...(record.expectedHouses ? { expectedHouses: record.expectedHouses } : {}),
  };
}

function toReferenceWingFixture(record: ReferenceWingFixtureRecord): ReferenceWingFixture {
  return {
    technique: record.technique,
    state: record.stateKind === 'exact'
      ? buildExactCandidateState(record.candidates)
      : buildCandidateMaskState(record.candidates),
    expectedEliminations: record.expectedEliminations,
    ...(record.minLinks !== undefined ? { minLinks: record.minLinks } : {}),
    ...(record.expectedPattern ? { expectedPattern: record.expectedPattern } : {}),
    ...(record.expectedLinks ? { expectedLinks: record.expectedLinks } : {}),
    ...(record.expectedCells ? { expectedCells: record.expectedCells } : {}),
  };
}

function toReferencePatternFixture(record: ReferencePatternFixtureRecord): ReferencePatternFixture {
  return {
    technique: record.technique,
    state: buildReferencePatternState(record),
    ...(record.expectedEliminations ? { expectedEliminations: record.expectedEliminations } : {}),
    ...(record.expectedPlacements ? { expectedPlacements: record.expectedPlacements } : {}),
    ...(record.expectedPattern ? { expectedPattern: record.expectedPattern } : {}),
    ...(record.minNodes !== undefined ? { minNodes: record.minNodes } : {}),
    ...(record.expectedNodes ? { expectedNodes: record.expectedNodes } : {}),
    ...(record.expectedNoteIncludes ? { expectedNoteIncludes: record.expectedNoteIncludes } : {}),
  };
}

function assertReferenceTechniqueFixtureFile(value: unknown): asserts value is ReferenceTechniqueFixtureFile {
  assert.ok(isRecord(value), 'Reference fixture file should be an object');
  assert.ok(Array.isArray(value.direct), 'Reference fixture direct should be an array');
  const fish = 'fish' in value ? value.fish : [];
  assert.ok(Array.isArray(fish), 'Reference fixture fish should be an array');
  assert.ok(Array.isArray(value.chains), 'Reference fixture chains should be an array');
  const wings = 'wings' in value ? value.wings : [];
  assert.ok(Array.isArray(wings), 'Reference fixture wings should be an array');
  const als = 'als' in value ? value.als : [];
  assert.ok(Array.isArray(als), 'Reference fixture als should be an array');
  const patterns = 'patterns' in value ? value.patterns : [];
  assert.ok(Array.isArray(patterns), 'Reference fixture patterns should be an array');
  assert.ok(Array.isArray(value.uniqueness), 'Reference fixture uniqueness should be an array');
  const negative = 'negative' in value ? value.negative : [];
  assert.ok(Array.isArray(negative), 'Reference fixture negative should be an array');
  const directTechniques = value.direct.map((record) => assertReferenceDirectFixtureRecord(record));
  const fishTechniques = fish.map((record) => assertReferenceFishFixtureRecord(record));
  assert.deepEqual(value.chains.map((record) => assertReferenceChainFixtureRecord(record)), EXPECTED_REFERENCE_CHAIN_SMOKE_TECHNIQUES);
  const wingTechniques = wings.map((record) => assertReferenceWingFixtureRecord(record));
  const alsTechniques = als.map((record) => assertReferenceAlsFixtureRecord(record));
  const patternTechniques = patterns.map((record) => assertReferencePatternFixtureRecord(record));
  const uniquenessTechniques = value.uniqueness.map((record) => assertReferenceUniquenessFixtureRecord(record));
  for (const record of negative) {
    assertReferenceNegativeFixtureRecord(record);
  }
  assert.deepEqual(wingTechniques, EXPECTED_REFERENCE_WING_SMOKE_TECHNIQUES);
  assert.deepEqual(alsTechniques, EXPECTED_REFERENCE_ALS_SMOKE_TECHNIQUES);
  assert.deepEqual(patternTechniques, EXPECTED_REFERENCE_PATTERN_SMOKE_TECHNIQUES);
  assert.deepEqual(fishTechniques, EXPECTED_REFERENCE_FISH_SMOKE_TECHNIQUES);
  for (const technique of EXPECTED_REFERENCE_UNIQUENESS_SMOKE_TECHNIQUES) {
    assert.ok(uniquenessTechniques.includes(technique), `Reference uniqueness fixtures should include ${technique}`);
  }
  for (const technique of EXPECTED_REFERENCE_DIRECT_SMOKE_TECHNIQUES) {
    assert.ok(directTechniques.includes(technique), `Reference direct fixtures should include ${technique}`);
  }
}

function assertReferenceRatingCorpusFile(value: unknown): asserts value is ReferenceRatingCorpusFile {
  assert.ok(isRecord(value), 'Reference rating corpus should be an object');
  assert.equal(value.corpusId, 'reference-rating-corpus.v1');
  assert.equal(value.corpusKind, 'reference-rating');
  assert.ok(Array.isArray(value.rows), 'Reference rating corpus rows should be an array');
  assert.ok(value.rows.length >= 1, 'Reference rating corpus should not be empty');
  const seenIds = new Set<string>();
  for (const row of value.rows) {
    assertReferenceRatingCorpusRecord(row);
    assert.equal(seenIds.has(row.id), false, `Reference rating corpus should not repeat id ${row.id}`);
    seenIds.add(row.id);
  }
}

function assertReferenceRatingCorpusRecord(value: unknown): asserts value is ReferenceRatingCorpusRecord {
  assert.ok(isRecord(value), 'Reference rating row should be an object');
  assert.equal(typeof value.id, 'string', 'Reference rating row id should be a string');
  const id = value.id as string;
  assert.ok(id.length > 0, 'Reference rating row id should not be empty');
  assert.equal(typeof value.externalBucket, 'string', `${id} externalBucket should be a string`);
  assert.ok(['classic-stable', 'classic-extended', 'classic-galaxy'].includes(value.profile as string), `${id} profile should be built in`);
  if ('targetFirstTechniques' in value) {
    assert.ok(Array.isArray(value.targetFirstTechniques), `${id} targetFirstTechniques should be an array`);
    assert.ok((value.targetFirstTechniques as unknown[]).length > 0, `${id} targetFirstTechniques should not be empty`);
    for (const technique of value.targetFirstTechniques as unknown[]) {
      assert.equal(typeof technique, 'string', `${id} targetFirstTechniques technique should be a string`);
      assert.ok((technique as string).length > 0, `${id} targetFirstTechniques technique should not be empty`);
    }
  }
  assert.equal(typeof value.puzzle, 'string', `${id} puzzle should be a string`);
  assert.equal(typeof value.solution, 'string', `${id} solution should be a string`);
  assert.equal(parsePuzzle(value.puzzle as string).length, 81);
  assert.equal(parsePuzzle(value.solution as string).length, 81);
  assert.ok(isRecord(value.expected), `${id} expected should be an object`);
  const expected = value.expected;
  assert.equal(typeof expected.solved, 'boolean', `${id} expected.solved should be boolean`);
  for (const field of ['score', 'scoreMin', 'scoreMax', 'stepCount'] as const) {
    if (field in expected) {
      const expectedValue: unknown = expected[field];
      assert.equal(typeof expectedValue, 'number', `${id} expected.${field} should be a number`);
      const numericValue = expectedValue as number;
      assert.ok(Number.isInteger(numericValue) && numericValue >= 0, `${id} expected.${field} should be a non-negative integer`);
    }
  }
  if ('techniqueCountsAtLeast' in expected) {
    assert.ok(isRecord(expected.techniqueCountsAtLeast), `${id} expected.techniqueCountsAtLeast should be an object`);
    for (const [technique, count] of Object.entries(expected.techniqueCountsAtLeast)) {
      assert.ok(typeof technique === 'string' && technique.length > 0, `${id} expected.techniqueCountsAtLeast technique should be a string`);
      assert.ok(typeof count === 'number' && Number.isInteger(count) && count >= 0, `${id} expected.techniqueCountsAtLeast count should be a non-negative integer`);
    }
  }
  if ('techniqueCountsAtMost' in expected) {
    assert.ok(isRecord(expected.techniqueCountsAtMost), `${id} expected.techniqueCountsAtMost should be an object`);
    for (const [technique, count] of Object.entries(expected.techniqueCountsAtMost)) {
      assert.ok(typeof technique === 'string' && technique.length > 0, `${id} expected.techniqueCountsAtMost technique should be a string`);
      assert.ok(typeof count === 'number' && Number.isInteger(count) && count >= 0, `${id} expected.techniqueCountsAtMost count should be a non-negative integer`);
    }
  }
}

function assertReferenceDirectFixtureRecord(value: unknown): ReferenceDirectFixture['technique'] {
  assert.ok(isRecord(value), 'Reference direct fixture should be an object');
  assert.ok(EXPECTED_REFERENCE_DIRECT_SMOKE_TECHNIQUES.includes(value.technique as ReferenceDirectFixture['technique']), `Unknown reference direct technique: ${String(value.technique)}`);
  assert.ok(value.stateKind === undefined || value.stateKind === 'exact' || value.stateKind === 'puzzle', `${String(value.technique)} stateKind should be exact or puzzle`);
  if (value.stateKind === 'puzzle') {
    assert.equal(typeof value.puzzle, 'string', `${String(value.technique)} puzzle should be a string`);
    assert.equal(parsePuzzle(value.puzzle as string).length, 81);
  } else {
    assertCandidateTuples(value.candidates, `${String(value.technique)} candidates`);
  }
  assertCellDigitRef(value.expectedElimination, `${String(value.technique)} expectedElimination`);
  assertCellDigitRef(value.expectedPlacement, `${String(value.technique)} expectedPlacement`);
  return value.technique as ReferenceDirectFixture['technique'];
}

function assertReferenceChainFixtureRecord(value: unknown): ReferenceChainFixture['technique'] {
  assert.ok(isRecord(value), 'Reference chain fixture should be an object');
  assert.ok(EXPECTED_REFERENCE_CHAIN_SMOKE_TECHNIQUES.includes(value.technique as ReferenceChainFixture['technique']), `Unknown reference chain technique: ${String(value.technique)}`);
  assert.ok(value.stateKind === 'exact' || value.stateKind === 'mask', `${String(value.technique)} stateKind should be exact or mask`);
  assertCandidateTuples(value.candidates, `${String(value.technique)} candidates`);
  assert.equal(typeof value.minLinks, 'number', `${String(value.technique)} minLinks should be a number`);
  const minLinks = value.minLinks as number;
  assert.ok(Number.isInteger(minLinks) && minLinks >= 1, `${String(value.technique)} minLinks should be a positive integer`);
  if ('expectedEliminations' in value) {
    assert.ok(Array.isArray(value.expectedEliminations), `${String(value.technique)} expectedEliminations should be an array`);
    for (const expected of value.expectedEliminations) {
      assertCellDigitRef(expected, `${String(value.technique)} expectedEliminations`);
    }
  }
  if ('expectedPlacements' in value) {
    assert.ok(Array.isArray(value.expectedPlacements), `${String(value.technique)} expectedPlacements should be an array`);
    for (const expected of value.expectedPlacements) {
      assertCellDigitRef(expected, `${String(value.technique)} expectedPlacements`);
    }
  }
  for (const field of ['minStrongLinks', 'minWeakLinks', 'minGroupedNodes'] as const) {
    if (field in value) {
      const countValue: unknown = value[field];
      assert.equal(typeof countValue, 'number', `${String(value.technique)} ${field} should be a number`);
      const count = countValue as number;
      assert.ok(Number.isInteger(count) && count >= 0, `${String(value.technique)} ${field} should be a non-negative integer`);
    }
  }
  if ('expectedPattern' in value) {
    assert.ok(isRecord(value.expectedPattern), `${String(value.technique)} expectedPattern should be an object`);
    assert.equal(typeof value.expectedPattern.family, 'string', `${String(value.technique)} expectedPattern.family should be a string`);
    if ('subtype' in value.expectedPattern) {
      assert.equal(typeof value.expectedPattern.subtype, 'string', `${String(value.technique)} expectedPattern.subtype should be a string`);
    }
  }
  if ('expectedLinks' in value) {
    assert.ok(Array.isArray(value.expectedLinks), `${String(value.technique)} expectedLinks should be an array`);
    for (const expected of value.expectedLinks) {
      assertExpectedLinkRef(expected, `${String(value.technique)} expectedLinks`);
    }
  }
  if ('expectedNodes' in value) {
    assert.ok(Array.isArray(value.expectedNodes), `${String(value.technique)} expectedNodes should be an array`);
    for (const expected of value.expectedNodes) {
      assertExpectedNodeRef(expected, `${String(value.technique)} expectedNodes`);
    }
  }
  if ('expectedCells' in value) {
    assert.ok(Array.isArray(value.expectedCells), `${String(value.technique)} expectedCells should be an array`);
    for (const expected of value.expectedCells) {
      assertExpectedCellRef(expected, `${String(value.technique)} expectedCells`);
    }
  }
  return value.technique as ReferenceChainFixture['technique'];
}

function assertReferenceFishFixtureRecord(value: unknown): ReferenceFishFixture['technique'] {
  assert.ok(isRecord(value), 'Reference fish fixture should be an object');
  assert.ok(EXPECTED_REFERENCE_FISH_SMOKE_TECHNIQUES.includes(value.technique as ReferenceFishFixture['technique']), `Unknown reference fish technique: ${String(value.technique)}`);
  assert.ok(value.stateKind === 'exact' || value.stateKind === 'mask', `${String(value.technique)} stateKind should be exact or mask`);
  assertCandidateTuples(value.candidates, `${String(value.technique)} candidates`);
  assert.ok(Array.isArray(value.expectedEliminations), `${String(value.technique)} expectedEliminations should be an array`);
  assert.ok(value.expectedEliminations.length > 0, `${String(value.technique)} expectedEliminations should not be empty`);
  for (const expected of value.expectedEliminations) {
    assertCellDigitRef(expected, `${String(value.technique)} expectedEliminations`);
  }
  assert.ok(isRecord(value.expectedPattern), `${String(value.technique)} expectedPattern should be an object`);
  assert.equal(typeof value.expectedPattern.family, 'string', `${String(value.technique)} expectedPattern.family should be a string`);
  assert.equal(typeof value.expectedPattern.subtype, 'string', `${String(value.technique)} expectedPattern.subtype should be a string`);
  if ('expectedCells' in value) {
    assert.ok(Array.isArray(value.expectedCells), `${String(value.technique)} expectedCells should be an array`);
    for (const expected of value.expectedCells) {
      assertExpectedCellRef(expected, `${String(value.technique)} expectedCells`);
    }
  }
  if ('expectedHouses' in value) {
    assert.ok(Array.isArray(value.expectedHouses), `${String(value.technique)} expectedHouses should be an array`);
    for (const expected of value.expectedHouses) {
      assertExpectedHouseRef(expected, `${String(value.technique)} expectedHouses`);
    }
  }
  return value.technique as ReferenceFishFixture['technique'];
}

function assertReferenceWingFixtureRecord(value: unknown): ReferenceWingFixture['technique'] {
  assert.ok(isRecord(value), 'Reference wing fixture should be an object');
  assert.ok(EXPECTED_REFERENCE_WING_SMOKE_TECHNIQUES.includes(value.technique as ReferenceWingFixture['technique']), `Unknown reference wing technique: ${String(value.technique)}`);
  assert.ok(value.stateKind === 'exact' || value.stateKind === 'mask', `${String(value.technique)} stateKind should be exact or mask`);
  assertCandidateTuples(value.candidates, `${String(value.technique)} candidates`);
  assert.ok(Array.isArray(value.expectedEliminations), `${String(value.technique)} expectedEliminations should be an array`);
  assert.ok(value.expectedEliminations.length > 0, `${String(value.technique)} expectedEliminations should not be empty`);
  for (const expected of value.expectedEliminations) {
    assertCellDigitRef(expected, `${String(value.technique)} expectedEliminations`);
  }
  if ('minLinks' in value) {
    assert.equal(typeof value.minLinks, 'number', `${String(value.technique)} minLinks should be a number`);
    const minLinks = value.minLinks as number;
    assert.ok(Number.isInteger(minLinks) && minLinks >= 0, `${String(value.technique)} minLinks should be a non-negative integer`);
  }
  if ('minNodes' in value) {
    assert.equal(typeof value.minNodes, 'number', `${String(value.technique)} minNodes should be a number`);
    const minNodes = value.minNodes as number;
    assert.ok(Number.isInteger(minNodes) && minNodes >= 0, `${String(value.technique)} minNodes should be a non-negative integer`);
  }
  if ('expectedPattern' in value) {
    assert.ok(isRecord(value.expectedPattern), `${String(value.technique)} expectedPattern should be an object`);
    assert.equal(typeof value.expectedPattern.family, 'string', `${String(value.technique)} expectedPattern.family should be a string`);
    if ('subtype' in value.expectedPattern) {
      assert.equal(typeof value.expectedPattern.subtype, 'string', `${String(value.technique)} expectedPattern.subtype should be a string`);
    }
  }
  if ('expectedLinks' in value) {
    assert.ok(Array.isArray(value.expectedLinks), `${String(value.technique)} expectedLinks should be an array`);
    for (const expected of value.expectedLinks) {
      assertExpectedLinkRef(expected, `${String(value.technique)} expectedLinks`);
    }
  }
  if ('expectedCells' in value) {
    assert.ok(Array.isArray(value.expectedCells), `${String(value.technique)} expectedCells should be an array`);
    for (const expected of value.expectedCells) {
      assertExpectedCellRef(expected, `${String(value.technique)} expectedCells`);
    }
  }
  return value.technique as ReferenceWingFixture['technique'];
}

function assertReferenceAlsFixtureRecord(value: unknown): ReferenceAlsFixture['technique'] {
  assert.ok(isRecord(value), 'Reference ALS fixture should be an object');
  assert.ok(EXPECTED_REFERENCE_ALS_SMOKE_TECHNIQUES.includes(value.technique as ReferenceAlsFixture['technique']), `Unknown reference ALS technique: ${String(value.technique)}`);
  assert.ok(value.stateKind === 'exact' || value.stateKind === 'mask', `${String(value.technique)} stateKind should be exact or mask`);
  assertCandidateTuples(value.candidates, `${String(value.technique)} candidates`);
  assert.ok(Array.isArray(value.expectedEliminations), `${String(value.technique)} expectedEliminations should be an array`);
  assert.ok(value.expectedEliminations.length > 0, `${String(value.technique)} expectedEliminations should not be empty`);
  for (const expected of value.expectedEliminations) {
    assertCellDigitRef(expected, `${String(value.technique)} expectedEliminations`);
  }
  if ('expectedPattern' in value) {
    assert.ok(isRecord(value.expectedPattern), `${String(value.technique)} expectedPattern should be an object`);
    assert.equal(typeof value.expectedPattern.family, 'string', `${String(value.technique)} expectedPattern.family should be a string`);
    if ('subtype' in value.expectedPattern) {
      assert.equal(typeof value.expectedPattern.subtype, 'string', `${String(value.technique)} expectedPattern.subtype should be a string`);
    }
  }
  if ('minLinks' in value) {
    assert.equal(typeof value.minLinks, 'number', `${String(value.technique)} minLinks should be a number`);
    const minLinks = value.minLinks as number;
    assert.ok(Number.isInteger(minLinks) && minLinks >= 0, `${String(value.technique)} minLinks should be a non-negative integer`);
  }
  if ('minNodes' in value) {
    assert.equal(typeof value.minNodes, 'number', `${String(value.technique)} minNodes should be a number`);
    const minNodes = value.minNodes as number;
    assert.ok(Number.isInteger(minNodes) && minNodes >= 0, `${String(value.technique)} minNodes should be a non-negative integer`);
  }
  if ('expectedLinks' in value) {
    assert.ok(Array.isArray(value.expectedLinks), `${String(value.technique)} expectedLinks should be an array`);
    for (const expected of value.expectedLinks) {
      assertExpectedLinkRef(expected, `${String(value.technique)} expectedLinks`);
    }
  }
  if ('expectedNodes' in value) {
    assert.ok(Array.isArray(value.expectedNodes), `${String(value.technique)} expectedNodes should be an array`);
    for (const expected of value.expectedNodes) {
      assertExpectedNodeRef(expected, `${String(value.technique)} expectedNodes`);
    }
  }
  return value.technique as ReferenceAlsFixture['technique'];
}

function assertReferencePatternFixtureRecord(value: unknown): ReferencePatternFixture['technique'] {
  assert.ok(isRecord(value), 'Reference pattern fixture should be an object');
  assert.ok(EXPECTED_REFERENCE_PATTERN_SMOKE_TECHNIQUES.includes(value.technique as ReferencePatternFixture['technique']), `Unknown reference pattern technique: ${String(value.technique)}`);
  assert.ok(value.stateKind === 'exact' || value.stateKind === 'mask' || value.stateKind === 'trusted', `${String(value.technique)} stateKind should be exact, mask or trusted`);
  if (value.stateKind === 'trusted') {
    assert.equal(typeof value.puzzle, 'string', `${String(value.technique)} puzzle should be a string`);
  }
  if (typeof value.puzzle === 'string') {
    assert.equal(parsePuzzle(value.puzzle).length, 81);
  }
  assertCandidateTuples(value.candidates, `${String(value.technique)} candidates`);
  if ('expectedEliminations' in value) {
    assert.ok(Array.isArray(value.expectedEliminations), `${String(value.technique)} expectedEliminations should be an array`);
    for (const expected of value.expectedEliminations) {
      assertCellDigitRef(expected, `${String(value.technique)} expectedEliminations`);
    }
  }
  if ('expectedPlacements' in value) {
    assert.ok(Array.isArray(value.expectedPlacements), `${String(value.technique)} expectedPlacements should be an array`);
    for (const expected of value.expectedPlacements) {
      assertCellDigitRef(expected, `${String(value.technique)} expectedPlacements`);
    }
  }
  assert.ok(
    ((value.expectedEliminations as unknown[] | undefined)?.length ?? 0) > 0
    || ((value.expectedPlacements as unknown[] | undefined)?.length ?? 0) > 0,
    `${String(value.technique)} should declare expectedEliminations or expectedPlacements`,
  );
  if ('expectedPattern' in value) {
    assert.ok(isRecord(value.expectedPattern), `${String(value.technique)} expectedPattern should be an object`);
    assert.equal(typeof value.expectedPattern.family, 'string', `${String(value.technique)} expectedPattern.family should be a string`);
    if ('subtype' in value.expectedPattern) {
      assert.equal(typeof value.expectedPattern.subtype, 'string', `${String(value.technique)} expectedPattern.subtype should be a string`);
    }
  }
  if ('minNodes' in value) {
    assert.equal(typeof value.minNodes, 'number', `${String(value.technique)} minNodes should be a number`);
    const minNodes = value.minNodes as number;
    assert.ok(Number.isInteger(minNodes) && minNodes >= 1, `${String(value.technique)} minNodes should be a positive integer`);
  }
  if ('expectedNodes' in value) {
    assert.ok(Array.isArray(value.expectedNodes), `${String(value.technique)} expectedNodes should be an array`);
    for (const expected of value.expectedNodes) {
      assertExpectedNodeRef(expected, `${String(value.technique)} expectedNodes`);
    }
  }
  if ('expectedNoteIncludes' in value) {
    assert.ok(Array.isArray(value.expectedNoteIncludes), `${String(value.technique)} expectedNoteIncludes should be an array`);
    for (const expected of value.expectedNoteIncludes) {
      assert.equal(typeof expected, 'string', `${String(value.technique)} expectedNoteIncludes entries should be strings`);
      assert.ok(expected.length > 0, `${String(value.technique)} expectedNoteIncludes entries should not be empty`);
    }
  }
  return value.technique as ReferencePatternFixture['technique'];
}

function assertReferenceUniquenessFixtureRecord(value: unknown): ReferenceUniquenessFixtureRecord['technique'] {
  assert.ok(isRecord(value), 'Reference uniqueness fixture should be an object');
  assert.ok(EXPECTED_REFERENCE_UNIQUENESS_SMOKE_TECHNIQUES.includes(value.technique as ReferenceUniquenessFixtureRecord['technique']), `Unknown reference uniqueness technique: ${String(value.technique)}`);
  assert.ok(value.stateKind === 'exact' || value.stateKind === 'mask' || value.stateKind === 'trusted', `${String(value.technique)} stateKind should be exact, mask or trusted`);
  if (value.stateKind === 'trusted') {
    assert.equal(typeof value.puzzle, 'string', `${String(value.technique)} puzzle should be a string`);
  }
  if (typeof value.puzzle === 'string') {
    assert.equal(parsePuzzle(value.puzzle).length, 81);
  }
  assertCandidateTuples(value.candidates, `${String(value.technique)} candidates`);
  if ('expectedEliminations' in value) {
    assert.ok(Array.isArray(value.expectedEliminations), `${String(value.technique)} expectedEliminations should be an array`);
  }
  if ('expectedPlacements' in value) {
    assert.ok(Array.isArray(value.expectedPlacements), `${String(value.technique)} expectedPlacements should be an array`);
  }
  assert.ok(
    ((value.expectedEliminations as unknown[] | undefined)?.length ?? 0) > 0
    || ((value.expectedPlacements as unknown[] | undefined)?.length ?? 0) > 0,
    `${String(value.technique)} should declare expectedEliminations or expectedPlacements`,
  );
  for (const expected of (value.expectedEliminations as unknown[] | undefined) ?? []) {
    assertCellDigitRef(expected, `${String(value.technique)} expectedEliminations`);
  }
  for (const expected of (value.expectedPlacements as unknown[] | undefined) ?? []) {
    assertCellDigitRef(expected, `${String(value.technique)} expectedPlacements`);
  }
  if ('expectedPattern' in value) {
    assert.ok(isRecord(value.expectedPattern), `${String(value.technique)} expectedPattern should be an object`);
    assert.equal(typeof value.expectedPattern.family, 'string', `${String(value.technique)} expectedPattern.family should be a string`);
    if ('subtype' in value.expectedPattern) {
      assert.equal(typeof value.expectedPattern.subtype, 'string', `${String(value.technique)} expectedPattern.subtype should be a string`);
    }
  }
  if ('minLinks' in value) {
    assert.equal(typeof value.minLinks, 'number', `${String(value.technique)} minLinks should be a number`);
    const minLinks = value.minLinks as number;
    assert.ok(Number.isInteger(minLinks) && minLinks >= 1, `${String(value.technique)} minLinks should be a positive integer`);
  }
  if ('minNodes' in value) {
    assert.equal(typeof value.minNodes, 'number', `${String(value.technique)} minNodes should be a number`);
    const minNodes = value.minNodes as number;
    assert.ok(Number.isInteger(minNodes) && minNodes >= 1, `${String(value.technique)} minNodes should be a positive integer`);
  }
  if ('expectedNodes' in value) {
    assert.ok(Array.isArray(value.expectedNodes), `${String(value.technique)} expectedNodes should be an array`);
    for (const expected of value.expectedNodes) {
      assertExpectedNodeRef(expected, `${String(value.technique)} expectedNodes`);
    }
  }
  return value.technique as ReferenceUniquenessFixtureRecord['technique'];
}

function assertReferenceNegativeFixtureRecord(value: unknown): void {
  assert.ok(isRecord(value), 'Reference negative fixture should be an object');
  assert.ok(typeof value.technique === 'string', 'Reference negative fixture technique should be a string');
  assert.ok(value.stateKind === 'exact' || value.stateKind === 'mask' || value.stateKind === 'trusted', `${String(value.technique)} stateKind should be exact, mask or trusted`);
  assert.equal(typeof value.reason, 'string', `${String(value.technique)} reason should be a string`);
  assert.ok((value.reason as string).length > 0, `${String(value.technique)} reason should not be empty`);
  if (value.stateKind === 'trusted') {
    assert.equal(typeof value.puzzle, 'string', `${String(value.technique)} puzzle should be a string`);
  }
  if (typeof value.puzzle === 'string') {
    assert.equal(parsePuzzle(value.puzzle).length, 81);
  }
  if ('defaultCandidates' in value) {
    assertDigitList(value.defaultCandidates, `${String(value.technique)} defaultCandidates`);
  }
  if ('forbiddenPattern' in value) {
    assert.ok(isRecord(value.forbiddenPattern), `${String(value.technique)} forbiddenPattern should be an object`);
    assert.equal(typeof value.forbiddenPattern.family, 'string', `${String(value.technique)} forbiddenPattern.family should be a string`);
    if ('subtype' in value.forbiddenPattern) {
      assert.equal(typeof value.forbiddenPattern.subtype, 'string', `${String(value.technique)} forbiddenPattern.subtype should be a string`);
    }
  }
  if ('forbiddenEliminations' in value) {
    assert.ok(Array.isArray(value.forbiddenEliminations), `${String(value.technique)} forbiddenEliminations should be an array`);
    for (const forbidden of value.forbiddenEliminations) {
      assertCellDigitRef(forbidden, `${String(value.technique)} forbiddenEliminations`);
    }
  }
  if ('forbiddenPlacements' in value) {
    assert.ok(Array.isArray(value.forbiddenPlacements), `${String(value.technique)} forbiddenPlacements should be an array`);
    for (const forbidden of value.forbiddenPlacements) {
      assertCellDigitRef(forbidden, `${String(value.technique)} forbiddenPlacements`);
    }
  }
  assertCandidateTuples(value.candidates, `${String(value.technique)} negative candidates`);
}

function assertCandidateTuples(value: unknown, label: string): asserts value is Array<[number, number[]]> {
  assert.ok(Array.isArray(value), `${label} should be an array`);
  const seenCells = new Set<number>();
  for (const entry of value) {
    assert.ok(Array.isArray(entry) && entry.length === 2, `${label} entries should be [cell, digits] tuples`);
    const [cell, digits] = entry as [unknown, unknown];
    assert.equal(typeof cell, 'number', `${label} cell should be a number`);
    const cellIndex = cell as number;
    assert.ok(Number.isInteger(cellIndex) && cellIndex >= 0 && cellIndex < 81, `${label} cell should be 0..80`);
    assert.equal(seenCells.has(cellIndex), false, `${label} should not repeat cell ${cellIndex}`);
    seenCells.add(cellIndex);
    assert.ok(Array.isArray(digits) && digits.length > 0, `${label} digits should be a non-empty array`);
    for (const digit of digits) {
      assert.equal(typeof digit, 'number', `${label} digit should be a number`);
      const candidateDigit = digit as number;
      assert.ok(Number.isInteger(candidateDigit) && candidateDigit >= 1 && candidateDigit <= 9, `${label} digit should be 1..9`);
    }
  }
}

function assertDigitList(value: unknown, label: string): asserts value is number[] {
  assert.ok(Array.isArray(value) && value.length > 0, `${label} should be a non-empty digit array`);
  for (const digit of value) {
    assert.equal(typeof digit, 'number', `${label} digit should be a number`);
    const candidateDigit = digit as number;
    assert.ok(Number.isInteger(candidateDigit) && candidateDigit >= 1 && candidateDigit <= 9, `${label} digit should be 1..9`);
  }
}

function assertCellDigitRef(value: unknown, label: string): void {
  assert.ok(isRecord(value), `${label} should be an object`);
  assert.equal(typeof value.cell, 'number', `${label}.cell should be a number`);
  assert.equal(typeof value.digit, 'number', `${label}.digit should be a number`);
  const cell = value.cell as number;
  const digit = value.digit as number;
  assert.ok(Number.isInteger(cell) && cell >= 0 && cell < 81, `${label}.cell should be 0..80`);
  assert.ok(Number.isInteger(digit) && digit >= 1 && digit <= 9, `${label}.digit should be 1..9`);
}

function assertExpectedLinkRef(value: unknown, label: string): void {
  assert.ok(isRecord(value), `${label} should be an object`);
  assert.equal(typeof value.from, 'number', `${label}.from should be a number`);
  assert.equal(typeof value.to, 'number', `${label}.to should be a number`);
  const from = value.from as number;
  const to = value.to as number;
  assert.ok(Number.isInteger(from) && from >= 0 && from < 81, `${label}.from should be 0..80`);
  assert.ok(Number.isInteger(to) && to >= 0 && to < 81, `${label}.to should be 0..80`);
  if ('digit' in value) {
    assert.equal(typeof value.digit, 'number', `${label}.digit should be a number`);
    const digit = value.digit as number;
    assert.ok(Number.isInteger(digit) && digit >= 1 && digit <= 9, `${label}.digit should be 1..9`);
  }
  if ('type' in value) {
    assert.ok(value.type === 'strong' || value.type === 'weak', `${label}.type should be strong or weak`);
  }
  if ('house' in value) {
    assert.ok(isRecord(value.house), `${label}.house should be an object`);
    assert.ok(value.house.type === 'row' || value.house.type === 'col' || value.house.type === 'box', `${label}.house.type should be row, col or box`);
    assert.equal(typeof value.house.index, 'number', `${label}.house.index should be a number`);
    const index = value.house.index as number;
    assert.ok(Number.isInteger(index) && index >= 0 && index < 9, `${label}.house.index should be 0..8`);
  }
}

function assertExpectedHouseRef(value: unknown, label: string): void {
  assert.ok(isRecord(value), `${label} entry should be an object`);
  assert.ok(value.type === 'row' || value.type === 'col' || value.type === 'box', `${label}.type should be row, col or box`);
  assert.equal(typeof value.index, 'number', `${label}.index should be a number`);
  const index = value.index as number;
  assert.ok(Number.isInteger(index) && index >= 0 && index < 9, `${label}.index should be 0..8`);
}

function assertExpectedCellRef(value: unknown, label: string): void {
  assert.ok(isRecord(value), `${label} entry should be an object`);
  assert.equal(typeof value.cell, 'number', `${label}.cell should be a number`);
  const cell = value.cell as number;
  assert.ok(Number.isInteger(cell) && cell >= 0 && cell < 81, `${label}.cell should be 0..80`);
  if ('digit' in value) {
    const digit = value.digit;
    assert.ok(
      typeof digit === 'number' && Number.isInteger(digit) && digit >= 1 && digit <= 9,
      `${label}.digit should be 1..9`,
    );
  }
  if ('role' in value) {
    assert.ok(
      value.role === 'reason' || value.role === 'target' || value.role === 'link' || value.role === 'pivot',
      `${label}.role should be reason, target, link or pivot`,
    );
  }
}

function assertExpectedNodeRef(value: unknown, label: string): void {
  assert.ok(isRecord(value), `${label} entry should be an object`);
  assert.equal(typeof value.id, 'string', `${label}.id should be a string`);
  if ('cells' in value) {
    assert.ok(Array.isArray(value.cells), `${label}.cells should be an array`);
    for (const cell of value.cells) {
      assert.equal(typeof cell, 'number', `${label}.cells entry should be a number`);
      assert.ok(Number.isInteger(cell) && cell >= 0 && cell < 81, `${label}.cells entry should be 0..80`);
    }
  }
  if ('digit' in value) {
    const digit = value.digit;
    assert.ok(
      typeof digit === 'number' && Number.isInteger(digit) && digit >= 1 && digit <= 9,
      `${label}.digit should be 1..9`,
    );
  }
}

function uniqueStrings<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertReferenceDirectFixture(fixture: ReferenceDirectFixture): void {
  const step = nextStep(fixture.state, {
    allowContradictoryCandidateState: true,
    allowedTechniques: [fixture.technique],
  });
  assert.equal(step?.technique, fixture.technique);
  assert.ok(
    step?.actions.some((action) =>
      action.type === 'eliminate'
      && action.cell === fixture.expectedElimination.cell
      && action.digit === fixture.expectedElimination.digit,
    ),
    `${fixture.technique} should include expected elimination`,
  );
  assert.ok(
    step?.actions.some((action) =>
      action.type === 'place'
      && action.cell === fixture.expectedPlacement.cell
      && action.digit === fixture.expectedPlacement.digit,
    ),
    `${fixture.technique} should include expected placement`,
  );
  assertReferenceDirectStepReplayable(fixture.state, step!, fixture.technique);
}

function assertReferenceChainFixture(fixture: ReferenceChainFixture): void {
  const step = nextStep(fixture.state, {
    allowContradictoryCandidateState: true,
    allowedTechniques: [fixture.technique],
  });
  assert.equal(step?.technique, fixture.technique);
  assert.ok((step?.evidence.links?.length ?? 0) >= fixture.minLinks);
  for (const expected of fixture.expectedEliminations ?? []) {
    assert.ok(
      step?.actions.some((action) =>
        action.type === 'eliminate'
        && action.cell === expected.cell
        && action.digit === expected.digit,
      ),
      `${fixture.technique} should include expected elimination ${expected.cell}:${expected.digit}`,
    );
  }
  for (const expected of fixture.expectedPlacements ?? []) {
    assert.ok(
      step?.actions.some((action) =>
        action.type === 'place'
        && action.cell === expected.cell
        && action.digit === expected.digit,
      ),
      `${fixture.technique} should include expected placement ${expected.cell}:${expected.digit}`,
    );
  }
  if (fixture.minStrongLinks !== undefined) {
    const strongLinks = (step?.evidence.links ?? []).filter((link) => link.type === 'strong').length;
    assert.ok(strongLinks >= fixture.minStrongLinks, `${fixture.technique} should expose at least ${fixture.minStrongLinks} strong links`);
  }
  if (fixture.minWeakLinks !== undefined) {
    const weakLinks = (step?.evidence.links ?? []).filter((link) => link.type === 'weak').length;
    assert.ok(weakLinks >= fixture.minWeakLinks, `${fixture.technique} should expose at least ${fixture.minWeakLinks} weak links`);
  }
  if (fixture.minGroupedNodes !== undefined) {
    const groupedNodes = (step?.evidence.nodes ?? []).filter((node) => node.grouped === true && node.cells.length > 1).length;
    assert.ok(groupedNodes >= fixture.minGroupedNodes, `${fixture.technique} should expose at least ${fixture.minGroupedNodes} grouped nodes`);
  }
  if (fixture.expectedPattern) {
    assert.equal(step?.evidence.pattern?.family, fixture.expectedPattern.family);
    if (fixture.expectedPattern.subtype !== undefined) {
      assert.equal(step?.evidence.pattern?.subtype, fixture.expectedPattern.subtype);
    }
  }
  for (const expected of fixture.expectedLinks ?? []) {
    assert.ok(
      (step?.evidence.links ?? []).some((link) => matchesReferenceExpectedLink(link, expected)),
      `${fixture.technique} should include expected link ${expected.from}<->${expected.to}`,
    );
  }
  for (const expected of fixture.expectedNodes ?? []) {
    assert.ok(
      (step?.evidence.nodes ?? []).some((node) => matchesReferenceExpectedNode(node, expected)),
      `${fixture.technique} should include expected node ${expected.id}`,
    );
  }
  for (const expected of fixture.expectedCells ?? []) {
    assert.ok(
      (step?.evidence.cells ?? []).some((cell) => matchesReferenceExpectedCell(cell, expected)),
      `${fixture.technique} should include expected evidence cell ${expected.cell}`,
    );
  }
  if (fixture.expectedPattern) {
    assert.equal(step?.evidence.pattern?.family, fixture.expectedPattern.family);
    if (fixture.expectedPattern.subtype !== undefined) {
      assert.equal(step?.evidence.pattern?.subtype, fixture.expectedPattern.subtype);
    }
  }
  for (const expected of fixture.expectedLinks ?? []) {
    assert.ok(
      (step?.evidence.links ?? []).some((link) => matchesReferenceExpectedLink(link, expected)),
      `${fixture.technique} should include expected link ${expected.from}<->${expected.to}`,
    );
  }
  assertReferenceChainStepReplayable(fixture.state, step!, fixture.technique, fixture.minLinks ?? 0);
}

function matchesReferenceExpectedLink(
  link: NonNullable<NonNullable<ReturnType<typeof nextStep>>['evidence']['links']>[number],
  expected: ReferenceExpectedLink,
): boolean {
  const sameEndpoints = (link.from === expected.from && link.to === expected.to)
    || (link.from === expected.to && link.to === expected.from);
  if (!sameEndpoints) {
    return false;
  }
  if (expected.digit !== undefined && link.digit !== expected.digit) {
    return false;
  }
  if (expected.type !== undefined && link.type !== expected.type) {
    return false;
  }
  if (expected.house !== undefined && !houseRefsEqual(link.house, expected.house)) {
    return false;
  }
  return true;
}

function matchesReferenceExpectedCell(
  cell: NonNullable<NonNullable<ReturnType<typeof nextStep>>['evidence']['cells']>[number],
  expected: ReferenceExpectedCell,
): boolean {
  if (cell.cell !== expected.cell) {
    return false;
  }
  if (expected.digit !== undefined && cell.digit !== expected.digit) {
    return false;
  }
  if (expected.role !== undefined && cell.role !== expected.role) {
    return false;
  }
  return true;
}

function houseRefsEqual(left: HouseRef | undefined, right: HouseRef): boolean {
  return left?.type === right.type && left.index === right.index;
}

function assertReferenceFishFixture(fixture: ReferenceFishFixture): void {
  const step = nextStep(fixture.state, {
    allowContradictoryCandidateState: true,
    allowedTechniques: [fixture.technique],
  });
  assert.equal(step?.technique, fixture.technique);
  for (const expected of fixture.expectedEliminations) {
    assert.ok(
      step?.actions.some((action) =>
        action.type === 'eliminate'
        && action.cell === expected.cell
        && action.digit === expected.digit,
      ),
      `${fixture.technique} should include expected elimination ${expected.cell}:${expected.digit}`,
    );
  }
  assert.equal(step?.evidence.pattern?.family, fixture.expectedPattern.family);
  assert.equal(step?.evidence.pattern?.subtype, fixture.expectedPattern.subtype);
  for (const expected of fixture.expectedCells ?? []) {
    assert.ok(
      (step?.evidence.cells ?? []).some((cell) => matchesReferenceExpectedCell(cell, expected)),
      `${fixture.technique} should include expected evidence cell ${expected.cell}`,
    );
  }
  for (const expected of fixture.expectedHouses ?? []) {
    assert.ok(
      (step?.evidence.houses ?? []).some((house) => houseRefsEqual(house, expected)),
      `${fixture.technique} should include expected house ${expected.type}:${expected.index}`,
    );
  }
  replaySteps(fixture.state, [step!]);
}

function assertReferenceWingFixture(fixture: ReferenceWingFixture): void {
  const step = nextStep(fixture.state, {
    allowContradictoryCandidateState: true,
    allowedTechniques: [fixture.technique],
  });
  assert.equal(step?.technique, fixture.technique);
  for (const expected of fixture.expectedEliminations) {
    assert.ok(
      step?.actions.some((action) =>
        action.type === 'eliminate'
        && action.cell === expected.cell
        && action.digit === expected.digit,
      ),
      `${fixture.technique} should include expected elimination ${expected.cell}:${expected.digit}`,
    );
  }
  if (fixture.expectedPattern) {
    assert.equal(step?.evidence.pattern?.family, fixture.expectedPattern.family);
    if (fixture.expectedPattern.subtype !== undefined) {
      assert.equal(step?.evidence.pattern?.subtype, fixture.expectedPattern.subtype);
    }
  }
  for (const expected of fixture.expectedLinks ?? []) {
    assert.ok(
      (step?.evidence.links ?? []).some((link) => matchesReferenceExpectedLink(link, expected)),
      `${fixture.technique} should include expected link ${expected.from}<->${expected.to}`,
    );
  }
  for (const expected of fixture.expectedCells ?? []) {
    assert.ok(
      (step?.evidence.cells ?? []).some((cell) => matchesReferenceExpectedCell(cell, expected)),
      `${fixture.technique} should include expected evidence cell ${expected.cell}`,
    );
  }
  assertReferenceChainStepReplayable(fixture.state, step!, fixture.technique, fixture.minLinks ?? 0);
}

function assertReferencePatternFixture(fixture: ReferencePatternFixture): void {
  const step = nextStep(fixture.state, {
    allowContradictoryCandidateState: true,
    allowedTechniques: [fixture.technique],
  });
  assert.equal(step?.technique, fixture.technique);
  for (const expected of fixture.expectedEliminations ?? []) {
    assert.ok(
      step?.actions.some((action) =>
        action.type === 'eliminate'
        && action.cell === expected.cell
        && action.digit === expected.digit,
      ),
      `${fixture.technique} should include expected elimination ${expected.cell}:${expected.digit}`,
    );
  }
  for (const expected of fixture.expectedPlacements ?? []) {
    assert.ok(
      step?.actions.some((action) =>
        action.type === 'place'
        && action.cell === expected.cell
        && action.digit === expected.digit,
      ),
      `${fixture.technique} should include expected placement ${expected.cell}:${expected.digit}`,
    );
  }
  if (fixture.expectedPattern) {
    assert.equal(step?.evidence.pattern?.family, fixture.expectedPattern.family);
    if (fixture.expectedPattern.subtype !== undefined) {
      assert.equal(step?.evidence.pattern?.subtype, fixture.expectedPattern.subtype);
    }
  }
  if (fixture.minNodes !== undefined) {
    assert.ok((step?.evidence.nodes?.length ?? 0) >= fixture.minNodes, `${fixture.technique} should expose at least ${fixture.minNodes} nodes`);
  }
  for (const expected of fixture.expectedNodes ?? []) {
    assert.ok(
      (step?.evidence.nodes ?? []).some((node) => matchesReferenceExpectedNode(node, expected)),
      `${fixture.technique} should include expected node ${expected.id}`,
    );
  }
  for (const expected of fixture.expectedNoteIncludes ?? []) {
    assert.ok(
      step?.evidence.note?.includes(expected),
      `${fixture.technique} note should include ${expected}`,
    );
  }
  replaySteps(fixture.state, [step!]);
}

function assertReferenceUniquenessFixture(fixture: ReferenceUniquenessFixtureRecord): void {
  const state = buildReferenceUniquenessState(fixture);
  const step = nextStep(state, {
    allowContradictoryCandidateState: true,
    allowedTechniques: [fixture.technique],
  });
  assert.equal(step?.technique, fixture.technique);
  for (const expected of fixture.expectedEliminations ?? []) {
    assert.ok(
      step?.actions.some((action) =>
        action.type === 'eliminate'
        && action.cell === expected.cell
        && action.digit === expected.digit,
      ),
      `${fixture.technique} should include expected elimination ${expected.cell}:${expected.digit}`,
    );
  }
  for (const expected of fixture.expectedPlacements ?? []) {
    assert.ok(
      step?.actions.some((action) =>
        action.type === 'place'
        && action.cell === expected.cell
        && action.digit === expected.digit,
      ),
      `${fixture.technique} should include expected placement ${expected.cell}:${expected.digit}`,
    );
  }
  if (fixture.expectedPattern) {
    assert.equal(step?.evidence.pattern?.family, fixture.expectedPattern.family);
    if (fixture.expectedPattern.subtype !== undefined) {
      assert.equal(step?.evidence.pattern?.subtype, fixture.expectedPattern.subtype);
    }
  }
  if (fixture.minLinks !== undefined) {
    assert.ok((step?.evidence.links?.length ?? 0) >= fixture.minLinks, `${fixture.technique} should expose at least ${fixture.minLinks} links`);
  }
  if (fixture.minNodes !== undefined) {
    assert.ok((step?.evidence.nodes?.length ?? 0) >= fixture.minNodes, `${fixture.technique} should expose at least ${fixture.minNodes} nodes`);
  }
  for (const expected of fixture.expectedNodes ?? []) {
    assert.ok(
      (step?.evidence.nodes ?? []).some((node) => matchesReferenceExpectedNode(node, expected)),
      `${fixture.technique} should include expected node ${expected.id}`,
    );
  }
  replaySteps(state, [step!]);
}

function matchesReferenceExpectedNode(
  node: NonNullable<NonNullable<ReturnType<typeof nextStep>>['evidence']['nodes']>[number],
  expected: ReferenceExpectedNode,
): boolean {
  if (node.id !== expected.id) {
    return false;
  }
  if (expected.digit !== undefined && node.digit !== expected.digit) {
    return false;
  }
  if (expected.cells !== undefined && !expected.cells.every((cell) => node.cells.includes(cell))) {
    return false;
  }
  return true;
}

function buildReferenceUniquenessState(fixture: ReferenceUniquenessFixtureRecord): StateInput {
  if (fixture.stateKind === 'exact') {
    return buildExactCandidateState(fixture.candidates);
  }
  if (fixture.stateKind === 'mask') {
    return buildCandidateMaskState(fixture.candidates);
  }
  return buildTrustedState(fixture.puzzle!, fixture.candidates);
}

function buildReferencePatternState(fixture: ReferencePatternFixtureRecord): StateInput {
  if (fixture.stateKind === 'exact') {
    return buildExactCandidateState(fixture.candidates);
  }
  if (fixture.stateKind === 'mask') {
    return buildCandidateMaskState(fixture.candidates);
  }
  return buildTrustedState(fixture.puzzle!, fixture.candidates);
}

function buildReferenceNegativeState(fixture: ReferenceNegativeFixtureRecord): StateInput {
  if (fixture.stateKind === 'exact') {
    const byCell = new Map(fixture.candidates);
    return {
      board: parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000'),
      constraints: {
        exactCandidates: Array.from({ length: 81 }, (_, cell) => ({
          cell,
          digits: byCell.get(cell) ?? fixture.defaultCandidates ?? [8, 9],
        })),
      },
    };
  }
  if (fixture.stateKind === 'mask') {
    return buildCandidateMaskState(fixture.candidates);
  }
  return buildTrustedState(fixture.puzzle!, fixture.candidates);
}

function assertReferenceDirectStepReplayable(
  state: StateInput,
  step: NonNullable<ReturnType<typeof nextStep>>,
  technique: TechniqueId,
): void {
  assert.equal(step.technique, technique);
  const placement = step.actions.find((action) => action.type === 'place');
  assert.ok(placement, `${technique} should include a direct placement`);
  assert.ok(step.actions.some((action) => action.type === 'eliminate'), `${technique} should include eliminations`);
  const replayed = replaySteps(state, [step]);
  assert.equal(replayed[placement.cell], placement.digit);
}

function assertReferenceChainStepReplayable(
  state: StateInput,
  step: NonNullable<ReturnType<typeof nextStep>>,
  technique: TechniqueId,
  minLinks: number,
): void {
  assert.equal(step.technique, technique);
  assert.ok((step.evidence.links?.length ?? 0) >= minLinks, `${technique} should expose chain links`);
  assert.ok(step.actions.length > 0, `${technique} should have at least one action`);
  replaySteps(state, [step]);
}

function testReferenceSmokeFixturesAlignWithDefinitionsAndGalaxyPolicy(): void {
  const fixtures = loadReferenceTechniqueFixtures();
  const expectedTechniques = [
    ...fixtures.direct.map((fixture) => fixture.technique),
    ...(fixtures.fish ?? []).map((fixture) => fixture.technique),
    ...fixtures.chains.map((fixture) => fixture.technique),
    ...(fixtures.wings ?? []).map((fixture) => fixture.technique),
    ...(fixtures.als ?? []).map((fixture) => fixture.technique),
    ...(fixtures.patterns ?? []).map((fixture) => fixture.technique),
    ...fixtures.uniqueness.map((fixture) => fixture.technique),
  ];
  const definitionsById = new Map(getTechniqueDefinitions().map((definition) => [definition.id, definition]));
  const galaxyPolicy = getRatingPolicy('classic-galaxy');
  const enabledGalaxyTechniques = new Set([
    ...galaxyPolicy.techniqueOrder,
    ...(galaxyPolicy.fallbackTechniques ?? []),
  ]);

  for (const technique of expectedTechniques) {
    const definition = definitionsById.get(technique);
    assert.ok(definition, `${technique} should exist in technique definitions`);
    if ([
      'unique-rectangle',
      'avoidable-rectangle',
      'rectangle-elimination',
      'extended-rectangle',
      'hidden-unique-rectangle',
      'aic-ur',
      'bug-plus-one',
      'aic',
      'grouped-aic',
      'skyscraper',
      'two-string-kite',
      'turbot-fish',
      'empty-rectangle',
      'x-wing',
      'swordfish',
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
      'fireworks',
      'twinned-xy-chains',
      'aligned-pair-exclusion',
      'death-blossom',
      'sue-de-coq',
      'exocet',
      'double-exocet',
      'pattern-overlay',
      'tridagons',
      'sk-loops',
      'franken-swordfish',
    ].includes(technique)) {
      assert.equal(definition?.stability, 'stable', `${technique} should remain stable`);
    } else {
      assert.equal(definition?.stability, 'experimental', `${technique} should remain an experimental reference technique`);
    }
    assert.ok(enabledGalaxyTechniques.has(technique), `${technique} should remain in classic-galaxy enabled techniques`);
  }

  assert.deepEqual(
    uniqueStrings(expectedTechniques),
    uniqueStrings([
      ...EXPECTED_REFERENCE_DIRECT_SMOKE_TECHNIQUES,
      ...EXPECTED_REFERENCE_FISH_SMOKE_TECHNIQUES,
      ...EXPECTED_REFERENCE_CHAIN_SMOKE_TECHNIQUES,
      ...EXPECTED_REFERENCE_WING_SMOKE_TECHNIQUES,
      ...EXPECTED_REFERENCE_ALS_SMOKE_TECHNIQUES,
      ...EXPECTED_REFERENCE_PATTERN_SMOKE_TECHNIQUES,
      ...EXPECTED_REFERENCE_UNIQUENESS_SMOKE_TECHNIQUES,
    ]),
    'Reference smoke fixtures should cover the current v1 smoke technique set.',
  );
}

function testReferenceSmokeFixturesReachableViaExplicitOptions(): void {
  const fixtures = loadReferenceTechniqueFixtures();
  const cases: Array<{
    technique: TechniqueId;
    state: StateInput;
  }> = [
    ...fixtures.direct.map((fixture) => ({
      technique: fixture.technique,
      state: toReferenceDirectFixture(fixture).state,
    })),
    ...(fixtures.fish ?? []).map((fixture) => ({
      technique: fixture.technique,
      state: toReferenceFishFixture(fixture).state,
    })),
    ...fixtures.chains.map((fixture) => ({
      technique: fixture.technique,
      state: toReferenceChainFixture(fixture).state,
    })),
    ...(fixtures.wings ?? []).map((fixture) => ({
      technique: fixture.technique,
      state: toReferenceWingFixture(fixture).state,
    })),
    ...(fixtures.als ?? []).map((fixture) => ({
      technique: fixture.technique,
      state: fixture.stateKind === 'exact'
        ? buildExactCandidateState(fixture.candidates)
        : buildCandidateMaskState(fixture.candidates),
    })),
    ...(fixtures.patterns ?? []).map((fixture) => ({
      technique: fixture.technique,
      state: toReferencePatternFixture(fixture).state,
    })),
    ...fixtures.uniqueness.map((fixture) => ({
      technique: fixture.technique,
      state: buildReferenceUniquenessState(fixture),
    })),
  ];
  const allowedTechniques = cases.map((fixture) => fixture.technique);

  for (const fixture of cases) {
    const step = nextStep(fixture.state, {
      allowedTechniques,
      fallbackTechniques: [],
      allowContradictoryCandidateState: true,
      preferredTechniques: [fixture.technique],
    });
    assert.equal(
      step?.technique,
      fixture.technique,
      `${fixture.technique} should remain reachable via explicit reference options + preferredTechniques`,
    );
  }

  for (const fixture of fixtures.negative ?? []) {
    const step = nextStep(buildReferenceNegativeState(fixture), {
      allowedTechniques: [fixture.technique],
      fallbackTechniques: [],
      allowContradictoryCandidateState: true,
      preferredTechniques: [fixture.technique],
    });
    if (fixture.forbiddenPattern) {
      assert.ok(
        !step
        || step.evidence.pattern?.family !== fixture.forbiddenPattern.family
        || (
          fixture.forbiddenPattern.subtype !== undefined
          && step.evidence.pattern?.subtype !== fixture.forbiddenPattern.subtype
        ),
        `${fixture.technique} negative fixture should not produce forbidden pattern ${fixture.forbiddenPattern.family}:${fixture.forbiddenPattern.subtype ?? '*'}`,
      );
    }
    for (const forbidden of fixture.forbiddenEliminations ?? []) {
      assert.ok(
        !hasElimination(step, forbidden.cell, forbidden.digit),
        `${fixture.technique} negative fixture should not eliminate forbidden candidate ${forbidden.cell}:${forbidden.digit}: ${fixture.reason}`,
      );
    }
    for (const forbidden of fixture.forbiddenPlacements ?? []) {
      assert.ok(
        !step?.actions.some((action) => action.type === 'place' && action.cell === forbidden.cell && action.digit === forbidden.digit),
        `${fixture.technique} negative fixture should not place forbidden digit ${forbidden.cell}:${forbidden.digit}: ${fixture.reason}`,
      );
    }
    if (
      !fixture.forbiddenPattern
      && (fixture.forbiddenEliminations?.length ?? 0) === 0
      && (fixture.forbiddenPlacements?.length ?? 0) === 0
    ) {
      assert.equal(step, null, `${fixture.technique} negative fixture should not produce a step: ${fixture.reason}`);
    }
  }
}

function testReferenceSmokeFixturesListedByTechniquesCli(): void {
  const result = runCli(['techniques']);
  assert.equal(result.exitCode, 0);
  assert.ok(Array.isArray(result.output));
  const techniques = result.output as Array<{
    id?: string;
    aliases?: string[];
    seStatus?: string;
    seDifficulty?: string;
  }>;
  const fixtures = loadReferenceTechniqueFixtures();
  const expectedTechniques = [
    ...fixtures.direct.map((fixture) => fixture.technique),
    ...(fixtures.fish ?? []).map((fixture) => fixture.technique),
    ...fixtures.chains.map((fixture) => fixture.technique),
    ...(fixtures.wings ?? []).map((fixture) => fixture.technique),
    ...(fixtures.als ?? []).map((fixture) => fixture.technique),
    ...(fixtures.patterns ?? []).map((fixture) => fixture.technique),
    ...fixtures.uniqueness.map((fixture) => fixture.technique),
  ];

  for (const technique of expectedTechniques) {
    const item = techniques.find((entry) => entry.id === technique);
    assert.ok(item, `${technique} should be listed by techniques CLI`);
    assert.ok((item?.aliases?.length ?? 0) >= 1, `${technique} should keep aliases in CLI output`);
  }
}

function testReferenceAuditScript(): void {
  const output = execFileSync(process.execPath, ['scripts/audit-reference-techniques.mjs', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const payload = JSON.parse(output) as {
    summary?: { total?: number; passed?: number; failed?: number; auditId?: string; corpusKind?: string; note?: string };
  };
  assert.equal(payload.summary?.auditId, 'reference-techniques.v1');
  assert.equal(payload.summary?.corpusKind, 'reference-smoke');
  assert.match(payload.summary?.note ?? '', /not a full external rating corpus/);
  assert.equal(payload.summary?.total, 213);
  assert.equal(payload.summary?.passed, 213);
  assert.equal(payload.summary?.failed, 0);

  const tmpDir = join(process.cwd(), 'dist', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const invalidPath = join(tmpDir, 'invalid-reference-fixture.json');
  writeFileSync(invalidPath, JSON.stringify({
    direct: [{
      technique: 'direct-pointing',
      candidates: [[81, [1]]],
      expectedElimination: { cell: 3, digit: 1 },
      expectedPlacement: { cell: 3, digit: 4 },
    }],
    chains: [],
    uniqueness: [],
  }), 'utf8');
  const invalid = spawnSync(process.execPath, ['scripts/audit-reference-techniques.mjs', '--input', invalidPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /cell must be 0\.\.80/);

  const mismatchPath = join(tmpDir, 'mismatch-reference-fixture.json');
  writeFileSync(mismatchPath, JSON.stringify({
    direct: [{
      technique: 'direct-pointing',
      candidates: [
        [0, [1, 2]],
        [1, [1, 3]],
        [3, [1, 4]],
      ],
      expectedElimination: { cell: 3, digit: 1 },
      expectedPlacement: { cell: 3, digit: 5 },
    }],
    chains: [],
    uniqueness: [],
  }), 'utf8');
  const mismatch = spawnSync(process.execPath, ['scripts/audit-reference-techniques.mjs', '--input', mismatchPath, '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(mismatch.status, 1);
  const mismatchPayload = JSON.parse(mismatch.stdout) as {
    summary?: { failed?: number };
    rows?: Array<{ issues?: string[] }>;
  };
  assert.equal(mismatchPayload.summary?.failed, 1);
  assert.ok(mismatchPayload.rows?.[0]?.issues?.includes('missing-expected-placement'));

  const forbiddenActionPath = join(tmpDir, 'forbidden-action-reference-fixture.json');
  writeFileSync(forbiddenActionPath, JSON.stringify({
    direct: [],
    chains: [],
    uniqueness: [],
    negative: [
      {
        technique: 'bug-plus-one',
        stateKind: 'exact',
        reason: 'forbidden placement mismatch should be reported',
        defaultCandidates: [1, 2],
        candidates: [[0, [1, 2, 3]]],
        forbiddenPlacements: [{ cell: 0, digit: 1 }],
      },
      {
        technique: 'bug-plus-two',
        stateKind: 'trusted',
        reason: 'forbidden elimination mismatch should be reported',
        puzzle: '004008912002005348198342567859761423426853791713924856961537284287419635345286179',
        candidates: [
          [0, [1, 2, 3]],
          [1, [3, 4]],
          [3, [1, 2, 3]],
          [4, [3, 4]],
          [9, [1, 2]],
          [10, [3, 4]],
          [12, [1, 2]],
          [13, [3, 4]],
        ],
        forbiddenEliminations: [{ cell: 1, digit: 3 }],
      },
    ],
  }), 'utf8');
  const forbiddenAction = spawnSync(process.execPath, ['scripts/audit-reference-techniques.mjs', '--input', forbiddenActionPath, '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(forbiddenAction.status, 1);
  const forbiddenActionPayload = JSON.parse(forbiddenAction.stdout) as {
    summary?: { failed?: number };
    rows?: Array<{ issues?: string[] }>;
  };
  assert.equal(forbiddenActionPayload.summary?.failed, 2);
  assert.ok(forbiddenActionPayload.rows?.some((row) => row.issues?.includes('forbidden-placement:0:1')));
  assert.ok(forbiddenActionPayload.rows?.some((row) => row.issues?.includes('forbidden-elimination:1:3')));
}

function testReferenceRatingCorpus(): void {
  const corpus = loadReferenceRatingCorpus();
  for (const row of corpus.rows) {
    const uniqueness = checkUniqueness(row.puzzle);
    if (row.expected.unique) {
      assert.equal(uniqueness.status, 'unique', `${row.id} should remain unique`);
      assert.equal(serializeBoard(uniqueness.firstSolution!), row.solution, `${row.id} first solution should match fixture solution`);
    }
    const result = rate(row.puzzle, buildReferenceRatingPolicy(row));
    assert.equal(result.solved, row.expected.solved, `${row.id} solved should match`);
    if (row.expected.hardestTechnique) {
      assert.equal(result.hardestTechnique, row.expected.hardestTechnique, `${row.id} hardest technique should match`);
    }
    if (typeof row.expected.score === 'number') {
      assert.equal(result.score, row.expected.score, `${row.id} score should match`);
    }
    if (typeof row.expected.scoreMin === 'number') {
      assert.ok(result.score >= row.expected.scoreMin, `${row.id} score should meet min`);
    }
    if (typeof row.expected.scoreMax === 'number') {
      assert.ok(result.score <= row.expected.scoreMax, `${row.id} score should meet max`);
    }
    if (typeof row.expected.stepCount === 'number') {
      assert.equal(result.steps.length, row.expected.stepCount, `${row.id} step count should match`);
    }
    for (const [technique, count] of Object.entries(row.expected.techniqueCountsAtLeast ?? {}) as Array<[TechniqueId, number]>) {
      assert.ok((result.techniqueCounts[technique] ?? 0) >= count, `${row.id} should keep ${technique} count`);
    }
    for (const [technique, count] of Object.entries(row.expected.techniqueCountsAtMost ?? {}) as Array<[TechniqueId, number]>) {
      assert.ok((result.techniqueCounts[technique] ?? 0) <= count, `${row.id} should cap ${technique} count`);
    }
    assert.equal(serializeBoard(replaySteps(row.puzzle, result.steps)), row.solution, `${row.id} replay should match solution`);
  }
}

function buildReferenceRatingPolicy(row: ReferenceRatingCorpusRecord): RatingPolicy {
  const policy = getRatingPolicy(row.profile);
  if (!row.targetFirstTechniques || row.targetFirstTechniques.length === 0) {
    return policy;
  }
  const targetSet = new Set(row.targetFirstTechniques);
  const primary = [...policy.techniqueOrder];
  const fallback = [...(policy.fallbackTechniques ?? [])];
  return {
    ...policy,
    id: `${policy.id}:target-first-reference-test`,
    techniqueOrder: [
      ...row.targetFirstTechniques,
      ...primary.filter((technique) => !targetSet.has(technique)),
      ...fallback.filter((technique) => !targetSet.has(technique)),
    ],
    fallbackTechniques: fallback.filter((technique) => !targetSet.has(technique)),
  };
}

function testReferenceRatingAuditScript(): void {
  const output = execFileSync(process.execPath, ['scripts/audit-reference-rating-corpus.mjs', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const payload = JSON.parse(output) as {
    summary?: { total?: number; passed?: number; failed?: number; auditId?: string; corpusKind?: string };
    rows?: Array<{
      id?: string;
      ok?: boolean;
      score?: number;
      hardestTechnique?: string;
      stepCount?: number;
      verifiedSteps?: number;
      firstTechniqueSteps?: Record<string, number>;
      techniqueCountGaps?: unknown[];
    }>;
  };
  assert.equal(payload.summary?.auditId, 'reference-rating-corpus.v1');
  assert.equal(payload.summary?.corpusKind, 'reference-rating');
  assert.equal(payload.summary?.total, 68);
  assert.equal(payload.summary?.passed, 68);
  assert.equal(payload.summary?.failed, 0);
  assert.ok(payload.rows?.every((row) => row.firstTechniqueSteps && Object.keys(row.firstTechniqueSteps).length > 0));
  assert.ok(payload.rows?.every((row) => Array.isArray(row.techniqueCountGaps)));
  assert.ok(payload.rows?.some((row) => row.id === 'se-1.0-full-house' && row.ok === true && row.hardestTechnique === 'full-house'));
  assert.ok(payload.rows?.some((row) => row.id === 'classic-galaxy-hidden-single-x-wing-path' && row.ok === true && row.hardestTechnique === 'x-wing'));
  assert.ok(payload.rows?.some((row) => row.id === 'classic-galaxy-locked-candidates-path' && row.ok === true && row.hardestTechnique === 'locked-candidates'));
  assert.ok(payload.rows?.some((row) => row.id === 'classic-galaxy-hidden-triple-path' && row.ok === true && row.hardestTechnique === 'avoidable-rectangle'));
  assert.ok(payload.rows?.some((row) => row.id === 'classic-galaxy-naked-quad-path' && row.ok === true && row.hardestTechnique === 'finned-franken-swordfish'));
  assert.ok(payload.rows?.some((row) => row.id === 'classic-galaxy-hidden-quad-path' && row.ok === true && row.hardestTechnique === 'hidden-quad'));
  assert.ok(payload.rows?.some((row) => row.id === 'classic-galaxy-x-coloring-path' && row.ok === true && row.hardestTechnique === 'als-xy-wing'));
  assert.ok(payload.rows?.some((row) => row.id === 'classic-galaxy-mutant-fish-path' && row.ok === true && row.hardestTechnique === 'mutant-fish'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-direct-epic-099' && row.ok === true && row.hardestTechnique === 'avoidable-rectangle'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-als-pattern-fish-epic-085' && row.ok === true && row.hardestTechnique === 'larger-fish'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-bug-plus-two-epic-092' && row.ok === true && row.hardestTechnique === 'bug-plus-two'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-bug-plus-n-external-bug3-001' && row.ok === true && row.hardestTechnique === 'bug-plus-n'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-bug-plus-one-epic-031' && row.ok === true && row.hardestTechnique === 'finned-franken-jellyfish'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-unique-loop-epic-024' && row.ok === true && row.hardestTechnique === 'unique-loop'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-constructed-extended-rectangle-epic-024' && row.ok === true && row.hardestTechnique === 'extended-rectangle'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-forcing-epic-095' && row.ok === true && row.hardestTechnique === 'bowmans-bingo'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-aic-grouped-x-cycles-epic-088' && row.ok === true && row.hardestTechnique === 'finned-franken-jellyfish'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-two-string-kite-epic-092' && row.ok === true && row.hardestTechnique === 'two-string-kite'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-forcing-x-chain-epic-094' && row.ok === true && row.hardestTechnique === 'forcing-x-chain'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-coloring-medusa-xy-chain-epic-098' && row.ok === true && row.hardestTechnique === 'three-d-medusa'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-x-chain-epic-097' && row.ok === true && row.hardestTechnique === 'x-chain'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-twinned-xy-chains-epic-097' && row.ok === true && row.hardestTechnique === 'twinned-xy-chains'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-synthetic-fireworks-seed-065' && row.ok === true && row.hardestTechnique === 'fireworks'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-synthetic-sk-loops-seed-084' && row.ok === true && row.hardestTechnique === 'sk-loops'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-constructed-exocet-seed-010' && row.ok === true && row.hardestTechnique === 'exocet'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-constructed-double-exocet-seed-001' && row.ok === true && row.hardestTechnique === 'double-exocet'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-constructed-tridagons-constrained-001' && row.ok === true && row.hardestTechnique === 'tridagons'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-study-aic-exotic-epic-035-step-001' && row.ok === true && row.hardestTechnique === 'aic-exotic'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-study-cell-forcing-chains-hard-040-step-081' && row.ok === true && row.hardestTechnique === 'cell-forcing-chains'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-study-digit-forcing-chains-expert-059-step-090' && row.ok === true && row.hardestTechnique === 'digit-forcing-chains'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-study-forcing-nets-epic-017-step-084' && row.ok === true && row.hardestTechnique === 'forcing-nets'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-study-region-forcing-chains-hard-040-step-081' && row.ok === true && row.hardestTechnique === 'region-forcing-chains'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-study-nested-forcing-chains-hard-040-step-081' && row.ok === true && row.hardestTechnique === 'nested-forcing-chains'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-study-table-chain-hard-036-step-001' && row.ok === true && row.hardestTechnique === 'table-chain'));
  assert.ok(payload.rows?.some((row) => row.id === 'target-first-study-unit-forcing-chains-hard-086-step-082' && row.ok === true && row.hardestTechnique === 'unit-forcing-chains'));
  assert.ok(payload.rows?.every((row) => row.verifiedSteps === row.stepCount));

  const humanOutput = execFileSync(process.execPath, ['scripts/audit-reference-rating-corpus.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.match(humanOutput, /verified=1\/1/);
  assert.match(humanOutput, /verified=51\/51/);
  assert.match(humanOutput, /Reference rating corpus: 68\/68/);

  const tmpDir = join(process.cwd(), 'dist', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const invalidPath = join(tmpDir, 'invalid-reference-rating-corpus.json');
  writeFileSync(invalidPath, JSON.stringify({
    corpusId: 'reference-rating-corpus.v1',
    corpusKind: 'reference-rating',
    rows: [{
      id: 'bad',
      externalBucket: 'bad',
      profile: 'not-a-profile',
      puzzle: '0'.repeat(81),
      solution: '0'.repeat(81),
      expected: { solved: false },
    }],
  }), 'utf8');
  const invalid = spawnSync(process.execPath, ['scripts/audit-reference-rating-corpus.mjs', '--input', invalidPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /profile must be a built-in profile/);

  writeFileSync(invalidPath, JSON.stringify({
    corpusId: 'reference-rating-corpus.v1',
    corpusKind: 'reference-rating',
    rows: [{
      id: 'bad-count',
      externalBucket: 'bad',
      profile: 'classic-stable',
      puzzle: '0'.repeat(81),
      solution: '0'.repeat(81),
      expected: { solved: false, techniqueCountsAtMost: { 'full-house': -1 } },
    }],
  }), 'utf8');
  const invalidCount = spawnSync(process.execPath, ['scripts/audit-reference-rating-corpus.mjs', '--input', invalidPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(invalidCount.status, 1);
  assert.match(invalidCount.stderr, /techniqueCountsAtMost has an invalid count/);
}

function testReferenceRatingCandidateSearchScript(): void {
  const tmpDir = join(process.cwd(), 'dist', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const inputPath = join(tmpDir, 'reference-rating-candidates.txt');
  writeFileSync(inputPath, [
    '534678912672195348198342567859761423426853791713924856961537284287419635345286170 534678912672195348198342567859761423426853791713924856961537284287419635345286179',
    '534678912672195348198342567859761423426853791713924856961537284287419635345286179 534678912672195348198342567859761423426853791713924856961537284287419635345286179',
  ].join('\n'), 'utf8');

  const output = execFileSync(process.execPath, [
    'scripts/find-reference-rating-candidates.mjs',
    '--input',
    inputPath,
    '--profile',
    'stable',
    '--target',
    'full-house',
    '--hardest',
    'full-house',
    '--max-rows',
    '1',
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const payload = JSON.parse(output) as {
    summary?: { auditId?: string; matched?: number; scanned?: number; profile?: string; targetTechniques?: string[]; hardestTechniques?: string[] };
    rows?: Array<{
      sourceId?: string;
      matchedTechniques?: string[];
      suggestedCorpusRow?: {
        profile?: string;
        expected?: { techniqueCountsAtLeast?: Record<string, number>; unique?: boolean };
      };
    }>;
  };
  assert.equal(payload.summary?.auditId, 'reference-rating-candidate-search.v1');
  assert.equal(payload.summary?.profile, 'classic-stable');
  assert.deepEqual(payload.summary?.targetTechniques, ['full-house']);
  assert.deepEqual(payload.summary?.hardestTechniques, ['full-house']);
  assert.equal(payload.summary?.scanned, 1);
  assert.equal(payload.summary?.matched, 1);
  assert.equal(payload.rows?.[0]?.sourceId, 'line-1');
  assert.deepEqual(payload.rows?.[0]?.matchedTechniques, ['full-house']);
  assert.equal(payload.rows?.[0]?.suggestedCorpusRow?.profile, 'classic-stable');
  assert.equal(payload.rows?.[0]?.suggestedCorpusRow?.expected?.unique, true);
  assert.equal(payload.rows?.[0]?.suggestedCorpusRow?.expected?.techniqueCountsAtLeast?.['full-house'], 1);

  const jsonInputPath = join(tmpDir, 'reference-rating-candidates-array.json');
  const arrayPuzzle = '534678912672195348198342567859761423426853791713924856961537284287419635345286170'
    .split('')
    .map((digit) => Number(digit));
  const arraySolution = '534678912672195348198342567859761423426853791713924856961537284287419635345286179'
    .split('')
    .map((digit) => Number(digit));
  writeFileSync(jsonInputPath, JSON.stringify({
    rows: [{
      puzzle: arrayPuzzle,
      solution: arraySolution,
    }],
  }), 'utf8');
  const jsonOutput = execFileSync(process.execPath, [
    'scripts/find-reference-rating-candidates.mjs',
    '--input',
    jsonInputPath,
    '--profile',
    'stable',
    '--target',
    'full-house',
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const jsonPayload = JSON.parse(jsonOutput) as {
    summary?: { matched?: number; scanned?: number };
    rows?: Array<{
      sourceId?: string;
      puzzle?: string;
      solution?: string;
      matchedTechniques?: string[];
      suggestedCorpusRow?: { id?: string };
    }>;
  };
  assert.equal(jsonPayload.summary?.scanned, 1);
  assert.equal(jsonPayload.summary?.matched, 1);
  assert.equal(jsonPayload.rows?.[0]?.sourceId, 'row-1');
  assert.equal(jsonPayload.rows?.[0]?.puzzle, arrayPuzzle.join(''));
  assert.equal(jsonPayload.rows?.[0]?.solution, arraySolution.join(''));
  assert.deepEqual(jsonPayload.rows?.[0]?.matchedTechniques, ['full-house']);
  assert.equal(jsonPayload.rows?.[0]?.suggestedCorpusRow?.id, 'candidate-row-1');

  const samplesInputPath = join(tmpDir, 'reference-rating-candidates-samples.json');
  writeFileSync(samplesInputPath, JSON.stringify({
    samples: [{
      sampleId: 'learning:full-house:sample-1',
      puzzle: arrayPuzzle.join(''),
      solution: arraySolution.join(''),
    }],
  }), 'utf8');
  const samplesOutput = execFileSync(process.execPath, [
    'scripts/find-reference-rating-candidates.mjs',
    '--input',
    samplesInputPath,
    '--profile',
    'stable',
    '--target',
    'full-house',
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const samplesPayload = JSON.parse(samplesOutput) as {
    summary?: { matched?: number; scanned?: number };
    rows?: Array<{ sourceId?: string; matchedTechniques?: string[] }>;
  };
  assert.equal(samplesPayload.summary?.scanned, 1);
  assert.equal(samplesPayload.summary?.matched, 1);
  assert.equal(samplesPayload.rows?.[0]?.sourceId, 'learning:full-house:sample-1');
  assert.deepEqual(samplesPayload.rows?.[0]?.matchedTechniques, ['full-house']);

  const excludePath = join(tmpDir, 'reference-rating-candidate-existing-corpus.json');
  writeFileSync(excludePath, JSON.stringify({
    rows: [{ puzzle: '534678912672195348198342567859761423426853791713924856961537284287419635345286170' }],
  }), 'utf8');
  const excludedOutput = execFileSync(process.execPath, [
    'scripts/find-reference-rating-candidates.mjs',
    '--input',
    inputPath,
    '--profile',
    'stable',
    '--target',
    'full-house',
    '--exclude-corpus',
    excludePath,
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const excludedPayload = JSON.parse(excludedOutput) as {
    summary?: { excluded?: number; matched?: number; scanned?: number };
    rows?: unknown[];
  };
  assert.equal(excludedPayload.summary?.scanned, 2);
  assert.equal(excludedPayload.summary?.excluded, 1);
  assert.equal(excludedPayload.summary?.matched, 0);
  assert.equal(excludedPayload.rows?.length, 0);

  const startRowOutput = execFileSync(process.execPath, [
    'scripts/find-reference-rating-candidates.mjs',
    '--input',
    inputPath,
    '--profile',
    'stable',
    '--target',
    'full-house',
    '--start-row',
    '2',
    '--max-puzzles',
    '1',
    '--include-misses',
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const startRowPayload = JSON.parse(startRowOutput) as {
    summary?: { startRow?: number; scanned?: number; matched?: number; misses?: number };
    rows?: Array<{ sourceId?: string; searchMatched?: boolean }>;
  };
  assert.equal(startRowPayload.summary?.startRow, 2);
  assert.equal(startRowPayload.summary?.scanned, 1);
  assert.equal(startRowPayload.summary?.matched, 0);
  assert.equal(startRowPayload.summary?.misses, 1);
  assert.equal(startRowPayload.rows?.[0]?.sourceId, 'line-2');
  assert.equal(startRowPayload.rows?.[0]?.searchMatched, false);

  const missesOutput = execFileSync(process.execPath, [
    'scripts/find-reference-rating-candidates.mjs',
    '--input',
    inputPath,
    '--profile',
    'stable',
    '--target',
    'bug-plus-one',
    '--include-misses',
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const missesPayload = JSON.parse(missesOutput) as {
    summary?: {
      matched?: number;
      misses?: number;
      scanned?: number;
      missesIncluded?: boolean;
      maxRows?: number;
      maxMisses?: number;
    };
    rows?: Array<{
      sourceId?: string;
      searchMatched?: boolean;
      missReason?: string;
      matchedTechniques?: string[];
      hardestTechnique?: string | null;
      techniqueCounts?: Record<string, number>;
    }>;
  };
  assert.equal(missesPayload.summary?.scanned, 2);
  assert.equal(missesPayload.summary?.matched, 0);
  assert.equal(missesPayload.summary?.misses, 2);
  assert.equal(missesPayload.summary?.missesIncluded, true);
  assert.equal(missesPayload.summary?.maxRows, 20);
  assert.equal(missesPayload.summary?.maxMisses, 20);
  assert.equal(missesPayload.rows?.length, 2);
  assert.equal(missesPayload.rows?.[0]?.sourceId, 'line-1');
  assert.equal(missesPayload.rows?.[0]?.searchMatched, false);
  assert.equal(missesPayload.rows?.[0]?.missReason, 'target-technique-missing');
  assert.deepEqual(missesPayload.rows?.[0]?.matchedTechniques, []);
  assert.equal(missesPayload.rows?.[0]?.hardestTechnique, 'full-house');
  assert.equal(missesPayload.rows?.[0]?.techniqueCounts?.['full-house'], 1);

  const targetFirstOutput = execFileSync(process.execPath, [
    'scripts/find-reference-rating-candidates.mjs',
    '--input',
    inputPath,
    '--profile',
    'stable',
    '--target',
    'naked-single',
    '--target-first',
    '--compare-normal-profile',
    '--minimize-hit',
    '--max-rows',
    '1',
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const targetFirstPayload = JSON.parse(targetFirstOutput) as {
    summary?: {
      matched?: number;
      scanned?: number;
      targetFirst?: boolean;
      compareNormalProfile?: boolean;
      minimizeHit?: boolean;
      candidateOrder?: string;
    };
    rows?: Array<{
      matchedTechniques?: string[];
      hardestTechnique?: string;
      normalProfileRating?: { hardestTechnique?: string; techniqueCounts?: Record<string, number> } | null;
      minimized?: {
        puzzle?: string;
        solution?: string;
        clueCount?: number;
        removedClues?: unknown[];
        rating?: { techniqueCounts?: Record<string, number> };
        suggestedCorpusRow?: { expected?: { unique?: boolean; techniqueCountsAtLeast?: Record<string, number> } };
      } | null;
    }>;
  };
  assert.equal(targetFirstPayload.summary?.targetFirst, true);
  assert.equal(targetFirstPayload.summary?.compareNormalProfile, true);
  assert.equal(targetFirstPayload.summary?.minimizeHit, true);
  assert.equal(targetFirstPayload.summary?.candidateOrder, 'input');
  assert.equal(targetFirstPayload.summary?.scanned, 1);
  assert.equal(targetFirstPayload.summary?.matched, 1);
  assert.deepEqual(targetFirstPayload.rows?.[0]?.matchedTechniques, ['naked-single']);
  assert.equal(targetFirstPayload.rows?.[0]?.hardestTechnique, 'naked-single');
  assert.equal(targetFirstPayload.rows?.[0]?.normalProfileRating?.hardestTechnique, 'full-house');
  assert.equal(targetFirstPayload.rows?.[0]?.normalProfileRating?.techniqueCounts?.['full-house'], 1);
  assert.ok((targetFirstPayload.rows?.[0]?.minimized?.clueCount ?? 81) < 80);
  assert.ok((targetFirstPayload.rows?.[0]?.minimized?.removedClues?.length ?? 0) > 0);
  assert.equal(targetFirstPayload.rows?.[0]?.minimized?.solution, '534678912672195348198342567859761423426853791713924856961537284287419635345286179');
  assert.ok((targetFirstPayload.rows?.[0]?.minimized?.rating?.techniqueCounts?.['naked-single'] ?? 0) > 0);
  assert.equal(targetFirstPayload.rows?.[0]?.minimized?.suggestedCorpusRow?.expected?.unique, true);
  assert.ok((targetFirstPayload.rows?.[0]?.minimized?.suggestedCorpusRow?.expected?.techniqueCountsAtLeast?.['naked-single'] ?? 0) > 0);

  const difficultyInputPath = join(tmpDir, 'reference-rating-candidates-sorted.json');
  writeFileSync(difficultyInputPath, JSON.stringify({
    rows: [
      {
        id: 'easy-first',
        score: 10,
        puzzle: arrayPuzzle,
        solution: arraySolution,
      },
      {
        id: 'hard-second',
        score: 999,
        puzzle: arrayPuzzle,
        solution: arraySolution,
      },
    ],
  }), 'utf8');
  const difficultyOutput = execFileSync(process.execPath, [
    'scripts/find-reference-rating-candidates.mjs',
    '--input',
    difficultyInputPath,
    '--profile',
    'stable',
    '--target',
    'full-house',
    '--difficulty-first',
    '--max-rows',
    '1',
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const difficultyPayload = JSON.parse(difficultyOutput) as {
    summary?: { candidateOrder?: string; scanned?: number; matched?: number };
    rows?: Array<{ sourceId?: string }>;
  };
  assert.equal(difficultyPayload.summary?.candidateOrder, 'difficulty-desc');
  assert.equal(difficultyPayload.summary?.scanned, 1);
  assert.equal(difficultyPayload.summary?.matched, 1);
  assert.equal(difficultyPayload.rows?.[0]?.sourceId, 'hard-second');

  const cappedMissesOutput = execFileSync(process.execPath, [
    'scripts/find-reference-rating-candidates.mjs',
    '--input',
    inputPath,
    '--profile',
    'stable',
    '--target',
    'bug-plus-one',
    '--include-misses',
    '--max-misses',
    '1',
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const cappedMissesPayload = JSON.parse(cappedMissesOutput) as {
    summary?: { matched?: number; misses?: number; scanned?: number; maxMisses?: number };
    rows?: unknown[];
  };
  assert.equal(cappedMissesPayload.summary?.scanned, 2);
  assert.equal(cappedMissesPayload.summary?.matched, 0);
  assert.equal(cappedMissesPayload.summary?.misses, 1);
  assert.equal(cappedMissesPayload.summary?.maxMisses, 1);
  assert.equal(cappedMissesPayload.rows?.length, 1);

  const elapsedBudgetOutput = execFileSync(process.execPath, [
    'scripts/find-reference-rating-candidates.mjs',
    '--input',
    inputPath,
    '--profile',
    'stable',
    '--target',
    'full-house',
    '--max-elapsed-ms',
    '0',
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const elapsedBudgetPayload = JSON.parse(elapsedBudgetOutput) as {
    summary?: {
      matched?: number;
      scanned?: number;
      maxElapsedMs?: number;
      stoppedEarly?: boolean;
      stopReason?: string;
    };
    rows?: unknown[];
  };
  assert.equal(elapsedBudgetPayload.summary?.scanned, 0);
  assert.equal(elapsedBudgetPayload.summary?.matched, 0);
  assert.equal(elapsedBudgetPayload.summary?.maxElapsedMs, 0);
  assert.equal(elapsedBudgetPayload.summary?.stoppedEarly, true);
  assert.equal(elapsedBudgetPayload.summary?.stopReason, 'elapsed-budget');
  assert.equal(elapsedBudgetPayload.rows?.length, 0);

  const invalid = spawnSync(process.execPath, [
    'scripts/find-reference-rating-candidates.mjs',
    '--input',
    inputPath,
    '--profile',
    'not-a-profile',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /profile/);

  const bugInspectionOutput = execFileSync(process.execPath, [
    'scripts/inspect-bug-plus-two-candidates.mjs',
    '--section',
    'negative',
    '--id',
    'bug-plus-two-non-common-not-common-extra',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const bugInspection = JSON.parse(bugInspectionOutput) as {
    summary?: { auditId?: string; id?: string; pairCount?: number; nonCommonExtraPairs?: number; hasSolution?: boolean };
    pairs?: Array<{
      kind?: string;
      ownHouseOdd?: boolean;
      extras?: Array<{ cell?: number; digit?: number }>;
      targetProbes?: Array<{
        digit?: number;
        candidates?: Array<{ cell?: number; seesBothExtras?: boolean; solutionDigit?: number; isSolutionDigit?: boolean }>;
      }>;
      completionProbe?: {
        proofMode?: string;
        completed?: boolean;
        budgetExceeded?: boolean;
        solutionCount?: number;
        statesVisited?: number;
        extraCandidateHits?: Array<{ cell?: number; digit?: number; hitCount?: number; canEliminateByBoundedCompletion?: boolean }>;
      };
      safeTargetCandidates?: Array<{ cell?: number; digit?: number; seesBothExtras?: boolean; solutionDigit?: number }>;
    }>;
  };
  assert.equal(bugInspection.summary?.auditId, 'bug-plus-two-candidate-inspection.v1');
  assert.equal(bugInspection.summary?.id, 'bug-plus-two-non-common-not-common-extra');
  assert.equal(bugInspection.summary?.hasSolution, true);
  assert.equal(bugInspection.summary?.pairCount, 1);
  assert.equal(bugInspection.summary?.nonCommonExtraPairs, 1);
  assert.equal(bugInspection.pairs?.[0]?.kind, 'non-common-extra');
  assert.equal(bugInspection.pairs?.[0]?.ownHouseOdd, true);
  assert.deepEqual(bugInspection.pairs?.[0]?.extras, [
    { cell: 0, digit: 3 },
    { cell: 3, digit: 4 },
  ]);
  assert.ok(
    bugInspection.pairs?.[0]?.targetProbes
      ?.find((probe) => probe.digit === 3)
      ?.candidates?.some((candidate) =>
        candidate.cell === 1
        && candidate.seesBothExtras
        && candidate.solutionDigit === 3
        && candidate.isSolutionDigit === true),
  );
  assert.ok(
    bugInspection.pairs?.[0]?.safeTargetCandidates
      ?.some((candidate) =>
        candidate.cell === 4
        && candidate.digit === 3
        && candidate.seesBothExtras
        && candidate.solutionDigit === 7),
  );
  assert.equal(bugInspection.pairs?.[0]?.completionProbe?.proofMode, 'bounded-completion');
  assert.equal(bugInspection.pairs?.[0]?.completionProbe?.completed, true);
  assert.equal(bugInspection.pairs?.[0]?.completionProbe?.budgetExceeded, false);
  assert.equal(bugInspection.pairs?.[0]?.completionProbe?.solutionCount, 0);
  assert.ok((bugInspection.pairs?.[0]?.completionProbe?.statesVisited ?? 0) > 0);
  assert.ok(
    bugInspection.pairs?.[0]?.completionProbe?.extraCandidateHits
      ?.every((candidate) => candidate.canEliminateByBoundedCompletion === false),
  );

  const bugPositiveInspectionOutput = execFileSync(process.execPath, [
    'scripts/inspect-bug-plus-two-candidates.mjs',
    '--section',
    'uniqueness',
    '--id',
    'bug-plus-two-parity-elimination-bounded-positive',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const bugPositiveInspection = JSON.parse(bugPositiveInspectionOutput) as {
    summary?: { id?: string; nonCommonExtraPairs?: number };
    pairs?: Array<{
      completionProbe?: {
        proofMode?: string;
        completed?: boolean;
        budgetExceeded?: boolean;
        solutionCount?: number;
        statesVisited?: number;
        extraCandidateHits?: Array<{ cell?: number; digit?: number; hitCount?: number; canEliminateByBoundedCompletion?: boolean }>;
      };
    }>;
  };
  assert.equal(bugPositiveInspection.summary?.id, 'bug-plus-two-parity-elimination-bounded-positive');
  assert.equal(bugPositiveInspection.summary?.nonCommonExtraPairs, 1);
  assert.equal(bugPositiveInspection.pairs?.[0]?.completionProbe?.proofMode, 'bounded-completion');
  assert.equal(bugPositiveInspection.pairs?.[0]?.completionProbe?.completed, true);
  assert.equal(bugPositiveInspection.pairs?.[0]?.completionProbe?.budgetExceeded, false);
  assert.equal(bugPositiveInspection.pairs?.[0]?.completionProbe?.solutionCount, 4);
  assert.ok((bugPositiveInspection.pairs?.[0]?.completionProbe?.statesVisited ?? 0) > 0);
  assert.ok(
    bugPositiveInspection.pairs?.[0]?.completionProbe?.extraCandidateHits
      ?.some((candidate) =>
        candidate.cell === 0
        && candidate.digit === 5
        && candidate.hitCount === 0
        && candidate.canEliminateByBoundedCompletion === true),
  );

  const bugBudgetInspectionOutput = execFileSync(process.execPath, [
    'scripts/inspect-bug-plus-two-candidates.mjs',
    '--section',
    'negative',
    '--id',
    'bug-plus-two-parity-budget-no-hit',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const bugBudgetInspection = JSON.parse(bugBudgetInspectionOutput) as {
    summary?: { id?: string; nonCommonExtraPairs?: number };
    pairs?: Array<{
      completionProbe?: {
        proofMode?: string;
        completed?: boolean;
        budgetExceeded?: boolean;
        solutionCount?: number;
        statesVisited?: number;
        extraCandidateHits?: Array<{ canEliminateByBoundedCompletion?: boolean }>;
      };
    }>;
  };
  assert.equal(bugBudgetInspection.summary?.id, 'bug-plus-two-parity-budget-no-hit');
  assert.equal(bugBudgetInspection.summary?.nonCommonExtraPairs, 1);
  assert.equal(bugBudgetInspection.pairs?.[0]?.completionProbe?.proofMode, 'bounded-completion');
  assert.equal(bugBudgetInspection.pairs?.[0]?.completionProbe?.completed, false);
  assert.equal(bugBudgetInspection.pairs?.[0]?.completionProbe?.budgetExceeded, true);
  assert.equal(bugBudgetInspection.pairs?.[0]?.completionProbe?.solutionCount, 0);
  assert.equal(bugBudgetInspection.pairs?.[0]?.completionProbe?.statesVisited, 0);
  assert.ok(
    bugBudgetInspection.pairs?.[0]?.completionProbe?.extraCandidateHits
      ?.every((candidate) => candidate.canEliminateByBoundedCompletion === false),
  );
}

function testReferenceRatingCandidateSynthesisScript(): void {
  const tmpDir = join(process.cwd(), 'dist', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const outputPath = join(tmpDir, 'reference-rating-synthesis-smoke.json');
  const output = execFileSync(process.execPath, [
    'scripts/synthesize-reference-rating-candidates.mjs',
    '--target',
    'naked-single',
    '--profile',
    'stable',
    '--seed-start',
    '1',
    '--max-seeds',
    '1',
    '--max-rows',
    '1',
    '--min-clues',
    '80',
    '--check-after-clues',
    '80',
    '--compare-normal-profile',
    '--minimize-hit',
    '--output',
    outputPath,
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const payload = JSON.parse(output) as {
    summary?: {
      auditId?: string;
      profile?: string;
      targetFirst?: boolean;
      compareNormalProfile?: boolean;
      minimizeHit?: boolean;
      matched?: number;
      diagnostics?: { seedsTried?: number; acceptedRemovals?: number; ratingChecks?: number };
    };
    rows?: Array<{
      sourceId?: string;
      seed?: number;
      matchedTechniques?: string[];
      clueCount?: number;
      removedClues?: unknown[];
      hardestTechnique?: string;
      normalProfileRating?: { hardestTechnique?: string; techniqueCounts?: Record<string, number> } | null;
      minimized?: {
        clueCount?: number;
        removedClues?: unknown[];
        rating?: { techniqueCounts?: Record<string, number> };
        suggestedCorpusRow?: { expected?: { unique?: boolean; techniqueCountsAtLeast?: Record<string, number> } };
      } | null;
      suggestedCorpusRow?: { expected?: { unique?: boolean; techniqueCountsAtLeast?: Record<string, number> } };
    }>;
  };
  assert.equal(payload.summary?.auditId, 'reference-rating-candidate-synthesis.v1');
  assert.equal(payload.summary?.profile, 'classic-stable');
  assert.equal(payload.summary?.targetFirst, true);
  assert.equal(payload.summary?.compareNormalProfile, true);
  assert.equal(payload.summary?.minimizeHit, true);
  assert.equal(payload.summary?.matched, 1);
  assert.equal(payload.summary?.diagnostics?.seedsTried, 1);
  assert.equal(payload.summary?.diagnostics?.acceptedRemovals, 1);
  assert.equal(payload.summary?.diagnostics?.ratingChecks, 1);
  assert.equal(payload.rows?.[0]?.sourceId, 'synthetic-seed-1');
  assert.equal(payload.rows?.[0]?.seed, 1);
  assert.deepEqual(payload.rows?.[0]?.matchedTechniques, ['naked-single']);
  assert.equal(payload.rows?.[0]?.clueCount, 80);
  assert.equal(payload.rows?.[0]?.removedClues?.length, 1);
  assert.equal(payload.rows?.[0]?.hardestTechnique, 'naked-single');
  assert.equal(payload.rows?.[0]?.normalProfileRating?.hardestTechnique, 'full-house');
  assert.equal(payload.rows?.[0]?.normalProfileRating?.techniqueCounts?.['full-house'], 1);
  assert.ok((payload.rows?.[0]?.minimized?.clueCount ?? 81) < 80);
  assert.ok((payload.rows?.[0]?.minimized?.removedClues?.length ?? 0) > 0);
  assert.ok((payload.rows?.[0]?.minimized?.rating?.techniqueCounts?.['naked-single'] ?? 0) > 0);
  assert.equal(payload.rows?.[0]?.minimized?.suggestedCorpusRow?.expected?.unique, true);
  assert.equal(payload.rows?.[0]?.suggestedCorpusRow?.expected?.unique, true);
  assert.equal(payload.rows?.[0]?.suggestedCorpusRow?.expected?.techniqueCountsAtLeast?.['naked-single'], 1);

  const saved = JSON.parse(readFileSync(outputPath, 'utf8')) as { summary?: { auditId?: string } };
  assert.equal(saved.summary?.auditId, 'reference-rating-candidate-synthesis.v1');

  const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  assert.equal(packageJson.scripts?.['synthesize:reference-candidates'], 'npm run build && node scripts/synthesize-reference-rating-candidates.mjs');
}

function testReferenceGapAuditScript(): void {
  const tmpDir = join(process.cwd(), 'dist', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const inputPath = join(tmpDir, 'reference-gap-audit-candidates.txt');
  const missingPath = join(tmpDir, 'reference-gap-audit-missing.txt');
  const outputDir = join(tmpDir, 'reference-gap-audit-test');
  writeFileSync(inputPath, [
    '534678912672195348198342567859761423426853791713924856961537284287419635345286170 534678912672195348198342567859761423426853791713924856961537284287419635345286179',
  ].join('\n'), 'utf8');

  const output = execFileSync(process.execPath, [
    'scripts/audit-reference-gaps.mjs',
    '--group',
    'direct',
    '--source',
    `tiny=${inputPath}`,
    '--source',
    `missing=${missingPath}`,
    '--profile',
    'stable',
    '--max-puzzles',
    '1',
    '--max-rows',
    '1',
    '--max-misses',
    '1',
    '--max-elapsed-ms',
    '10000',
    '--no-exclude-corpus',
    '--output-dir',
    outputDir,
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const payload = JSON.parse(output) as {
    summary?: {
      auditId?: string;
      profile?: string;
      groups?: string[];
      totalRuns?: number;
      executedRuns?: number;
      skippedRuns?: number;
      failedRuns?: number;
      totalScanned?: number;
      totalMatched?: number;
      includeMisses?: boolean;
      startRow?: number;
    };
    runs?: Array<{
      group?: string;
      sourceId?: string;
      status?: string;
      reason?: string;
      output?: string;
      targetTechniques?: string[];
      scanned?: number;
      matched?: number;
      misses?: number;
    }>;
  };
  assert.equal(payload.summary?.auditId, 'reference-gap-audit.v1');
  assert.equal(payload.summary?.profile, 'classic-stable');
  assert.deepEqual(payload.summary?.groups, ['direct']);
  assert.equal(payload.summary?.totalRuns, 2);
  assert.equal(payload.summary?.executedRuns, 1);
  assert.equal(payload.summary?.skippedRuns, 1);
  assert.equal(payload.summary?.failedRuns, 0);
  assert.equal(payload.summary?.totalScanned, 1);
  assert.equal(payload.summary?.totalMatched, 0);
  assert.equal(payload.summary?.includeMisses, true);
  assert.equal(payload.summary?.startRow, 1);

  const okRun = payload.runs?.find((run) => run.sourceId === 'tiny');
  assert.equal(okRun?.group, 'direct');
  assert.equal(okRun?.status, 'ok');
  assert.equal(okRun?.scanned, 1);
  assert.equal(okRun?.matched, 0);
  assert.equal(okRun?.misses, 1);
  assert.deepEqual(okRun?.targetTechniques, [
    'direct-pointing',
    'direct-claiming',
    'direct-hidden-pair',
    'direct-hidden-triplet',
  ]);
  assert.ok(okRun?.output);
  assert.equal(existsSync(join(process.cwd(), okRun.output!)), true);
  const detail = JSON.parse(readFileSync(join(process.cwd(), okRun.output!), 'utf8')) as {
    summary?: { auditId?: string; targetTechniques?: string[] };
    rows?: Array<{ searchMatched?: boolean; missReason?: string }>;
  };
  assert.equal(detail.summary?.auditId, 'reference-rating-candidate-search.v1');
  assert.deepEqual(detail.summary?.targetTechniques, okRun.targetTechniques);
  assert.equal(detail.rows?.[0]?.searchMatched, false);
  assert.equal(detail.rows?.[0]?.missReason, 'target-technique-missing');

  const skippedRun = payload.runs?.find((run) => run.sourceId === 'missing');
  assert.equal(skippedRun?.status, 'skipped');
  assert.equal(skippedRun?.reason, 'missing-input');
  assert.equal(existsSync(join(outputDir, 'summary.json')), true);

  const stableGapsOutput = execFileSync(process.execPath, [
    'scripts/audit-reference-gaps.mjs',
    '--group',
    'stable-gaps',
    '--source',
    `tiny=${inputPath}`,
    '--max-puzzles',
    '1',
    '--max-rows',
    '1',
    '--max-misses',
    '1',
    '--no-exclude-corpus',
    '--output-dir',
    outputDir,
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const stableGapsPayload = JSON.parse(stableGapsOutput) as {
    summary?: { groups?: string[] };
    runs?: Array<{ targetTechniques?: string[] }>;
  };
  assert.deepEqual(stableGapsPayload.summary?.groups, ['stable-gaps']);
  assert.ok(stableGapsPayload.runs?.[0]?.targetTechniques?.includes('locked-candidates'));
  assert.ok(stableGapsPayload.runs?.[0]?.targetTechniques?.includes('unique-rectangle'));
  assert.ok(stableGapsPayload.runs?.[0]?.targetTechniques?.includes('bug-plus-one'));
  assert.equal(stableGapsPayload.runs?.[0]?.targetTechniques?.includes('remote-pairs'), false);

  const invalid = spawnSync(process.execPath, [
    'scripts/audit-reference-gaps.mjs',
    '--group',
    'not-a-group',
    '--source',
    `tiny=${inputPath}`,
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Unknown target group/);
}

function testReferenceCoverageAuditScript(): void {
  const output = execFileSync(process.execPath, [
    'scripts/audit-reference-coverage.mjs',
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const payload = JSON.parse(output) as {
    summary?: {
      auditId?: string;
      definitions?: number;
      stable?: number;
      experimental?: number;
      positiveSmokeTechniques?: number;
      negativeSmokeTechniques?: number;
      ratingCorpusTechniques?: number;
      stableMissingRatingCorpus?: string[];
      experimentalMissingRatingCorpus?: string[];
    };
    rows?: Array<{
      id?: string;
      stability?: string;
      positiveSmoke?: number;
      negativeSmoke?: number;
      ratingRows?: number;
      ratingHardestRows?: number;
      hasRatingCorpus?: boolean;
    }>;
  };
  assert.equal(payload.summary?.auditId, 'reference-coverage.v1');
  assert.equal(payload.summary?.definitions, 90);
  assert.equal(payload.summary?.stable, 60);
  assert.equal(payload.summary?.experimental, 30);
  assert.equal(payload.summary?.positiveSmokeTechniques, 61);
  assert.equal(payload.summary?.negativeSmokeTechniques, 66);
  assert.equal(payload.summary?.ratingCorpusTechniques, 90);
  assert.equal(payload.summary?.stableMissingRatingCorpus?.includes('bug-plus-one'), false);
  assert.equal(payload.summary?.stableMissingRatingCorpus?.includes('hidden-single'), false);
  assert.equal(payload.summary?.stableMissingRatingCorpus?.includes('locked-candidates'), false);
  assert.equal(payload.summary?.stableMissingRatingCorpus?.includes('x-wing'), false);
  assert.equal(payload.summary?.stableMissingRatingCorpus?.includes('naked-pair'), false);
  assert.equal(payload.summary?.stableMissingRatingCorpus?.includes('hidden-pair'), false);
  assert.equal(payload.summary?.stableMissingRatingCorpus?.includes('naked-triple'), false);
  assert.equal(payload.summary?.stableMissingRatingCorpus?.includes('hidden-triple'), false);
  assert.equal(payload.summary?.stableMissingRatingCorpus?.includes('naked-quad'), false);
  assert.equal(payload.summary?.stableMissingRatingCorpus?.includes('hidden-quad'), false);
  assert.equal(payload.summary?.stableMissingRatingCorpus?.includes('x-coloring'), false);
  assert.equal(payload.summary?.stableMissingRatingCorpus?.includes('unique-rectangle'), false);
  assert.equal(payload.summary?.stableMissingRatingCorpus?.includes('hidden-unique-rectangle'), false);
  assert.equal(payload.summary?.stableMissingRatingCorpus?.includes('aligned-pair-exclusion'), false);
  assert.equal(payload.summary?.stableMissingRatingCorpus?.includes('sashimi-jellyfish'), false);
  assert.equal(payload.summary?.experimentalMissingRatingCorpus?.includes('almost-locked-quad'), false);
  assert.equal(payload.summary?.experimentalMissingRatingCorpus?.includes('remote-pairs'), false);
  assert.equal(payload.summary?.experimentalMissingRatingCorpus?.includes('direct-pointing'), false);
  assert.equal(payload.summary?.experimentalMissingRatingCorpus?.includes('direct-hidden-triplet'), false);
  assert.equal(payload.summary?.experimentalMissingRatingCorpus?.includes('bidirectional-x-cycle'), false);
  assert.equal(payload.summary?.experimentalMissingRatingCorpus?.includes('mutant-fish'), false);

  const fullHouse = payload.rows?.find((row) => row.id === 'full-house');
  assert.equal(fullHouse?.hasRatingCorpus, true);
  assert.ok((fullHouse?.ratingRows ?? 0) > 0);
  const remotePairs = payload.rows?.find((row) => row.id === 'remote-pairs');
  assert.equal(remotePairs?.stability, 'experimental');
  assert.ok((remotePairs?.positiveSmoke ?? 0) > 0);
  assert.equal(remotePairs?.hasRatingCorpus, true);
  const bugPlusTwo = payload.rows?.find((row) => row.id === 'bug-plus-two');
  assert.equal(bugPlusTwo?.stability, 'experimental');
  assert.ok((bugPlusTwo?.positiveSmoke ?? 0) > 0);
  assert.equal(bugPlusTwo?.hasRatingCorpus, true);

  const humanOutput = execFileSync(process.execPath, [
    'scripts/audit-reference-coverage.mjs',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.match(humanOutput, /Reference coverage: 90 definitions/);
  assert.match(humanOutput, /Stable missing rating corpus/);

  const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  assert.equal(packageJson.scripts?.['audit:coverage'], 'npm run build && node scripts/audit-reference-coverage.mjs');
}

function testForcingBranchEvidenceAuditScript(): void {
  const output = execFileSync(process.execPath, [
    'scripts/audit-forcing-branch-evidence.mjs',
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const payload = JSON.parse(output) as {
    summary?: {
      auditId?: string;
      corpusRows?: number;
      forcingSteps?: number;
      stepsWithBranches?: number;
      branchCount?: number;
      contradictionBranches?: number;
      failed?: number;
      stopReasonCounts?: Record<string, number>;
    };
    rows?: Array<{
      rowId?: string;
      technique?: string;
      ok?: boolean;
      branchCount?: number;
      contradictionAtKinds?: Array<string | null>;
      maxSteps?: number[];
    }>;
  };
  assert.equal(payload.summary?.auditId, 'forcing-branch-evidence.v1');
  assert.equal(payload.summary?.corpusRows, 68);
  assert.equal(payload.summary?.forcingSteps, 6);
  assert.equal(payload.summary?.stepsWithBranches, 6);
  assert.equal(payload.summary?.branchCount, 6);
  assert.equal(payload.summary?.contradictionBranches, 6);
  assert.equal(payload.summary?.failed, 0);
  assert.equal(payload.summary?.stopReasonCounts?.contradiction, 6);
  assert.ok(payload.rows?.every((row) => row.ok === true && row.technique === 'nishio-forcing-chains'));
  assert.ok(payload.rows?.every((row) => row.branchCount === 1));
  assert.ok(payload.rows?.every((row) => row.contradictionAtKinds?.every((kind) => kind !== null)));
  assert.ok(payload.rows?.every((row) => row.maxSteps?.every((maxSteps) => maxSteps === 0)));

  const humanOutput = execFileSync(process.execPath, [
    'scripts/audit-forcing-branch-evidence.mjs',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.match(humanOutput, /Forcing branch evidence: 6\/6/);
  assert.match(humanOutput, /Stop reasons: contradiction=6/);

  const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  assert.equal(packageJson.scripts?.['audit:forcing-evidence'], 'npm run build && node scripts/audit-forcing-branch-evidence.mjs');
}

function testForcingSmokeEvidenceAuditScript(): void {
  const output = execFileSync(process.execPath, [
    'scripts/audit-forcing-smoke-evidence.mjs',
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const payload = JSON.parse(output) as {
    summary?: {
      auditId?: string;
      fixtures?: number;
      passed?: number;
      failed?: number;
      totalBranches?: number;
      truncatedBranches?: number;
      contradictionBranches?: number;
      stopReasonCounts?: Record<string, number>;
    };
    rows?: Array<{
      technique?: string;
      ok?: boolean;
      branchCount?: number;
      pattern?: { family?: string; subtype?: string } | null;
      maxSteps?: number[];
      contradictionAtKinds?: Array<string | null>;
      actionTypes?: string[];
    }>;
  };
  assert.equal(payload.summary?.auditId, 'forcing-smoke-evidence.v1');
  assert.equal(payload.summary?.fixtures, 11);
  assert.equal(payload.summary?.passed, 11);
  assert.equal(payload.summary?.failed, 0);
  assert.equal(payload.summary?.totalBranches, 16);
  assert.equal(payload.summary?.truncatedBranches, 0);
  assert.equal(payload.summary?.contradictionBranches, 11);
  assert.equal(payload.summary?.stopReasonCounts?.contradiction, 11);
  assert.equal(payload.summary?.stopReasonCounts?.['no-step'], 5);
  assert.ok(payload.rows?.every((row) => row.ok === true));

  const byTechnique = new Map(payload.rows?.map((row) => [row.technique, row]));
  assert.ok(payload.rows?.every((row) => row.pattern?.family === 'forcing'));
  assert.equal(byTechnique.get('forcing-nets')?.pattern?.subtype, 'forcing-nets-shared-placement');
  assert.equal(byTechnique.get('nishio-forcing-chains')?.pattern?.subtype, 'nishio-forcing-chains-exact-contradiction');
  assert.equal(byTechnique.get('table-chain')?.pattern?.subtype, 'table-chain-candidate-contradiction');
  assert.equal(byTechnique.get('dynamic-forcing-chains')?.pattern?.subtype, 'dynamic-forcing-chains-candidate-contradiction');
  assert.equal(byTechnique.get('dynamic-forcing-chains-plus')?.pattern?.subtype, 'dynamic-forcing-chains-plus-candidate-contradiction');
  assert.equal(byTechnique.get('bowmans-bingo')?.pattern?.subtype, 'bowmans-bingo-candidate-contradiction');
  assert.equal(byTechnique.get('nested-forcing-chains')?.pattern?.subtype, 'nested-forcing-chains-candidate-contradiction');
  assert.deepEqual(byTechnique.get('table-chain')?.maxSteps, [20]);
  assert.deepEqual(byTechnique.get('dynamic-forcing-chains')?.maxSteps, [28]);
  assert.deepEqual(byTechnique.get('dynamic-forcing-chains-plus')?.maxSteps, [40]);
  assert.deepEqual(byTechnique.get('bowmans-bingo')?.maxSteps, [16]);
  assert.deepEqual(byTechnique.get('nested-forcing-chains')?.maxSteps, [18]);
  assert.ok(byTechnique.get('dynamic-forcing-chains-plus')?.actionTypes?.includes('eliminate'));
  assert.ok(byTechnique.get('forcing-nets')?.actionTypes?.includes('place'));
  assert.ok(payload.rows?.every((row) =>
    row.contradictionAtKinds?.filter((kind) => kind !== null).every((kind) => kind === 'house-missing')));

  const humanOutput = execFileSync(process.execPath, [
    'scripts/audit-forcing-smoke-evidence.mjs',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.match(humanOutput, /Forcing smoke evidence: 11\/11/);
  assert.match(humanOutput, /Branches: 16; truncated=0; contradictions=11/);

  const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  assert.equal(packageJson.scripts?.['audit:forcing-smoke'], 'npm run build && node scripts/audit-forcing-smoke-evidence.mjs');
}

function testBugGraphEvidenceAuditScript(): void {
  const output = execFileSync(process.execPath, [
    'scripts/audit-bug-graph-evidence.mjs',
    '--json',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const payload = JSON.parse(output) as {
    summary?: {
      auditId?: string;
      bugRows?: number;
      placementRows?: number;
      eliminationRows?: number;
      rowsWithBaseLinks?: number;
      totalBaseStrongLinks?: number;
      failed?: number;
    };
    rows?: Array<{
      rowId?: string;
      technique?: string;
      subtype?: string | null;
      ok?: boolean;
      actionTypes?: string[];
      baseStrongLinks?: number;
      nodeIds?: string[];
    }>;
  };
  assert.equal(payload.summary?.auditId, 'bug-graph-evidence.v1');
  assert.equal(payload.summary?.bugRows, 5);
  assert.equal(payload.summary?.placementRows, 2);
  assert.equal(payload.summary?.eliminationRows, 3);
  assert.equal(payload.summary?.rowsWithBaseLinks, 3);
  assert.equal(payload.summary?.totalBaseStrongLinks, 78);
  assert.equal(payload.summary?.failed, 0);
  assert.ok(payload.rows?.every((row) => row.ok === true));

  const placementRows = payload.rows?.filter((row) => row.technique === 'bug-plus-one') ?? [];
  assert.equal(placementRows.length, 2);
  assert.ok(placementRows.every((row) => row.actionTypes?.includes('place')));
  assert.ok(placementRows.every((row) => row.nodeIds?.includes('bug-parity-row')));
  assert.ok(placementRows.every((row) => row.nodeIds?.includes('bug-parity-col')));
  assert.ok(placementRows.every((row) => row.nodeIds?.includes('bug-parity-box')));

  const eliminationRows = payload.rows?.filter((row) => row.actionTypes?.includes('eliminate')) ?? [];
  assert.equal(eliminationRows.length, 3);
  assert.ok(eliminationRows.every((row) => (row.baseStrongLinks ?? 0) >= 8));
  assert.ok(eliminationRows.every((row) =>
    row.nodeIds?.includes('bug-common-extra-targets')
    || row.nodeIds?.includes('bug-elimination-targets')));
  assert.ok(eliminationRows.some((row) => row.subtype === 'bug-plus-two-parity-elimination'));

  const humanOutput = execFileSync(process.execPath, [
    'scripts/audit-bug-graph-evidence.mjs',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.match(humanOutput, /BUG graph evidence: 5\/5/);
  assert.match(humanOutput, /baseStrongLinks=78/);

  const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  assert.equal(packageJson.scripts?.['audit:bug-evidence'], 'npm run build && node scripts/audit-bug-graph-evidence.mjs');
}

function hasCandidate(candidateMasks: readonly number[], cell: number, digit: number): boolean {
  return ((candidateMasks[cell] ?? 0) & (1 << (digit - 1))) !== 0;
}

function getHouseCandidateCells(
  board: readonly number[],
  candidateMasks: readonly number[],
  house: TestHouse,
  digit: number,
): number[] {
  return getHouseCells(house).filter((cell) => board[cell] === 0 && hasCandidate(candidateMasks, cell, digit));
}

function sameNumberSet(left: readonly number[], right: readonly number[]): boolean {
  const normalize = (items: readonly number[]) => Array.from(new Set(items)).sort((a, b) => a - b);
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function assertBasicFishStructure(
  board: readonly number[],
  candidateMasks: readonly number[],
  step: NonNullable<ReturnType<typeof nextStep>>,
  size: 3 | 4,
): void {
  const actions = step.actions.filter((action) => action.type === 'eliminate');
  assert.equal(actions.length, step.actions.length);
  const digit = actions[0]?.digit;
  assert.ok(digit);
  assert.ok(actions.every((action) => action.digit === digit));
  const houses = step.evidence.houses ?? [];
  assert.equal(houses.length, size * 2);

  const basisHouses = houses.slice(0, size) as TestHouse[];
  const coverHouses = houses.slice(size, size * 2) as TestHouse[];
  const basisType = basisHouses[0]?.type;
  const coverType = basisType === 'row' ? 'col' : basisType === 'col' ? 'row' : null;
  assert.ok(basisType === 'row' || basisType === 'col');
  assert.ok(coverType);
  assert.ok(basisHouses.every((house) => house.type === basisType));
  assert.ok(coverHouses.every((house) => house.type === coverType));

  const basisIndexes = basisHouses.map((house) => house.index);
  const coverIndexes = coverHouses.map((house) => house.index);
  const coverIndexesFromBasis: number[] = [];
  for (const house of basisHouses) {
    const cells = getHouseCandidateCells(board, candidateMasks, house, digit);
    assert.ok(cells.length >= 2 && cells.length <= size);
    for (const cell of cells) {
      coverIndexesFromBasis.push(basisType === 'row' ? CELL_TO_COL[cell]! : CELL_TO_ROW[cell]!);
    }
  }
  assert.equal(new Set(coverIndexesFromBasis).size, size);
  assert.ok(sameNumberSet(coverIndexesFromBasis, coverIndexes));

  const expectedTargets: number[] = [];
  for (const coverIndex of coverIndexes) {
    const coverHouse: TestHouse = { type: coverType, index: coverIndex };
    for (const cell of getHouseCandidateCells(board, candidateMasks, coverHouse, digit)) {
      const cellBasis = basisType === 'row' ? CELL_TO_ROW[cell]! : CELL_TO_COL[cell]!;
      if (!basisIndexes.includes(cellBasis)) {
        expectedTargets.push(cell);
      }
    }
  }
  assert.ok(sameNumberSet(actions.map((action) => action.cell), expectedTargets));
}

function assertFrankenSwordfishStructure(
  board: readonly number[],
  candidateMasks: readonly number[],
  step: NonNullable<ReturnType<typeof nextStep>>,
): void {
  const actions = step.actions.filter((action) => action.type === 'eliminate');
  assert.equal(actions.length, step.actions.length);
  const digit = actions[0]?.digit;
  assert.ok(digit);
  assert.ok(actions.every((action) => action.digit === digit));
  const houses = step.evidence.houses ?? [];
  assert.equal(houses.length, 6);

  const basisHouses = houses.slice(0, 3) as TestHouse[];
  const coverHouses = houses.slice(3, 6) as TestHouse[];
  const coverType = coverHouses[0]?.type;
  const orientation = coverType === 'col' ? 'row' : coverType === 'row' ? 'col' : null;
  assert.ok(orientation);
  assert.ok(coverHouses.every((house) => house.type === coverType));
  assert.ok(basisHouses.every((house) => house.type === orientation || house.type === 'box'));
  assert.ok(basisHouses.some((house) => house.type === orientation));
  assert.ok(basisHouses.some((house) => house.type === 'box'));

  const candidateSets = basisHouses.map((house) => getHouseCandidateCells(board, candidateMasks, house, digit));
  const allBasisCandidates = candidateSets.flat();
  assert.equal(new Set(allBasisCandidates).size, allBasisCandidates.length);
  const coverIndexesFromBasis: number[] = [];
  for (const cells of candidateSets) {
    assert.ok(cells.length >= 2 && cells.length <= 3);
    for (const cell of cells) {
      coverIndexesFromBasis.push(orientation === 'row' ? CELL_TO_COL[cell]! : CELL_TO_ROW[cell]!);
    }
  }
  assert.equal(new Set(coverIndexesFromBasis).size, 3);
  assert.ok(sameNumberSet(coverIndexesFromBasis, coverHouses.map((house) => house.index)));

  for (let index = 0; index < candidateSets.length; index += 1) {
    const otherCells = new Set<number>();
    for (let otherIndex = 0; otherIndex < candidateSets.length; otherIndex += 1) {
      if (otherIndex === index) {
        continue;
      }
      for (const cell of candidateSets[otherIndex]!) {
        otherCells.add(cell);
      }
    }
    assert.equal(candidateSets[index]!.every((cell) => otherCells.has(cell)), false);
  }

  for (const coverHouse of coverHouses) {
    let supportCount = 0;
    for (const cells of candidateSets) {
      if (cells.some((cell) => (orientation === 'row' ? CELL_TO_COL[cell]! : CELL_TO_ROW[cell]!) === coverHouse.index)) {
        supportCount += 1;
      }
    }
    assert.ok(supportCount >= 2);
  }

  const basisCellSet = new Set<number>();
  for (const house of basisHouses) {
    for (const cell of getHouseCells(house)) {
      basisCellSet.add(cell);
    }
  }
  const expectedTargets: number[] = [];
  for (const coverHouse of coverHouses) {
    for (const cell of getHouseCandidateCells(board, candidateMasks, coverHouse, digit)) {
      if (!basisCellSet.has(cell)) {
        expectedTargets.push(cell);
      }
    }
  }
  assert.ok(sameNumberSet(actions.map((action) => action.cell), expectedTargets));
}

function testXWing(): void {
  const board = parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const oneCells = new Set([0, 3, 18, 21, 36, 45]);
  const step = nextStep({
    board,
    constraints: {
      exactCandidates: Array.from({ length: 81 }, (_, cell) => ({
        cell,
        digits: oneCells.has(cell) ? [1, 2] : [2, 3],
      })),
    },
  }, { allowContradictoryCandidateState: true, allowedTechniques: ['x-wing'] });
  assert.equal(step?.technique, 'x-wing');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 36 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 45 && action.digit === 1));
}

function testSwordfish(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [1, [1, 8]],
    [10, [1, 8]],
    [11, [1, 8]],
    [18, [1, 8]],
    [20, [1, 8]],
    [27, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['swordfish'] });
  assert.equal(step?.technique, 'swordfish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 27 && action.digit === 1));
}

function testFrankenSwordfish(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [2, [1, 8]],
    [36, [1, 8]],
    [37, [1, 8]],
    [55, [1, 8]],
    [56, [1, 8]],
    [27, [1, 8]],
    [46, [1, 8]],
    [47, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['franken-swordfish'] });
  assert.equal(step?.technique, 'franken-swordfish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 27 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 46 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 47 && action.digit === 1));
}

function testFinnedFrankenSwordfish(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [2, [1, 8]],
    [8, [1, 8]],
    [9, [1, 8]],
    [17, [1, 8]],
    [54, [1, 8]],
    [55, [1, 8]],
    [19, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['finned-franken-swordfish'] });
  assert.equal(step?.technique, 'finned-franken-swordfish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 19 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'fish', subtype: 'finned-franken-swordfish' });

  const noTarget = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [2, [1, 8]],
    [8, [1, 8]],
    [9, [1, 8]],
    [17, [1, 8]],
    [54, [1, 8]],
    [55, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['finned-franken-swordfish'] });
  assert.equal(noTarget, null);
}

function testFinnedFrankenJellyfish(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [1, [1, 8]],
    [2, [1, 8]],
    [27, [1, 8]],
    [28, [1, 8]],
    [60, [1, 8]],
    [61, [1, 8]],
    [78, [1, 8]],
    [79, [1, 8]],
    [9, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['finned-franken-jellyfish'] });
  assert.equal(step?.technique, 'finned-franken-jellyfish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 9 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'fish', subtype: 'finned-franken-jellyfish' });

  const noTarget = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [1, [1, 8]],
    [2, [1, 8]],
    [27, [1, 8]],
    [28, [1, 8]],
    [60, [1, 8]],
    [61, [1, 8]],
    [78, [1, 8]],
    [79, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['finned-franken-jellyfish'] });
  assert.equal(noTarget, null);
}

function testJellyfish(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [1, [1, 8]],
    [10, [1, 8]],
    [11, [1, 8]],
    [20, [1, 8]],
    [21, [1, 8]],
    [27, [1, 8]],
    [30, [1, 8]],
    [36, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['jellyfish'] });
  assert.equal(step?.technique, 'jellyfish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 36 && action.digit === 1));
}

function testLargerFish(): void {
  const buildRows = (size: 5 | 6 | 7): Array<[number, number[]]> => {
    const rows: Array<[number, number[]]> = [];
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        rows.push([row * 9 + col, [1, 8]]);
      }
    }
    rows.push([size * 9, [1, 8]]);
    return rows;
  };

  for (const size of [5, 6, 7] as const) {
    const candidates = buildRows(size);
    const targetCell = size * 9;
    const step = nextStep(buildExactCandidateState(candidates), {
      allowContradictoryCandidateState: true,
      allowedTechniques: ['larger-fish'],
    });
    assert.equal(step?.technique, 'larger-fish');
    assert.deepEqual(step?.evidence.pattern, { family: 'fish', subtype: 'larger-fish' });
    assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === targetCell && action.digit === 1));
    assert.ok((step?.evidence.houses ?? []).some((house) => house.type === 'row' && house.index === size - 1));
    assert.ok((step?.evidence.houses ?? []).some((house) => house.type === 'col' && house.index === size - 1));
  }

  const candidates = buildRows(5);
  const noTarget = nextStep(buildExactCandidateState(candidates.filter(([cell]) => cell !== 45)), {
    allowContradictoryCandidateState: true,
    allowedTechniques: ['larger-fish'],
  });
  assert.equal(noTarget, null);
}

function testMutantFish(): void {
  const candidates: Array<[number, number[]]> = [
    [0, [1, 8]],
    [1, [1, 8]],
    [9, [1, 8]],
    [10, [1, 8]],
    [60, [1, 8]],
    [61, [1, 8]],
    [18, [1, 8]],
  ];
  const step = nextStep(buildExactCandidateState(candidates), {
    allowContradictoryCandidateState: true,
    allowedTechniques: ['mutant-fish'],
  });
  assert.equal(step?.technique, 'mutant-fish');
  assert.deepEqual(step?.evidence.pattern, { family: 'fish', subtype: 'mutant-fish-size-3' });
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 18 && action.digit === 1));
  assert.ok((step?.evidence.houses ?? []).some((house) => house.type === 'row' && house.index === 6));
  assert.ok((step?.evidence.houses ?? []).some((house) => house.type === 'box' && house.index === 8));

  const noTarget = nextStep(buildExactCandidateState(candidates.filter(([cell]) => cell !== 18)), {
    allowContradictoryCandidateState: true,
    allowedTechniques: ['mutant-fish'],
  });
  assert.equal(noTarget, null);
}

function testFinnedXWing(): void {
  const board = parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const oneCells = new Set([0, 3, 12, 18, 21, 22]);
  const step = nextStep({
    board,
    constraints: {
      exactCandidates: Array.from({ length: 81 }, (_, cell) => ({
        cell,
        digits: oneCells.has(cell) ? [1, 2] : [2, 3],
      })),
    },
  }, { allowContradictoryCandidateState: true, allowedTechniques: ['finned-x-wing'] });
  assert.equal(step?.technique, 'finned-x-wing');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 12 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'fish', subtype: 'finned-x-wing' });
}

function testSashimiXWing(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [2, [1, 8]],
    [9, [1, 8]],
    [10, [1, 8]],
    [20, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['sashimi-x-wing'] });
  assert.equal(step?.technique, 'sashimi-x-wing');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 20 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'fish', subtype: 'sashimi-x-wing' });

  const noTarget = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [2, [1, 8]],
    [9, [1, 8]],
    [10, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['sashimi-x-wing'] });
  assert.equal(noTarget, null);
}

function testFinnedSwordfish(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [1, [1, 8]],
    [2, [1, 8]],
    [27, [1, 8]],
    [30, [1, 8]],
    [55, [1, 8]],
    [57, [1, 8]],
    [9, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['finned-swordfish'] });
  assert.equal(step?.technique, 'finned-swordfish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 9 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'fish', subtype: 'finned-swordfish' });
}

function testFinnedJellyfish(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [1, [1, 8]],
    [2, [1, 8]],
    [27, [1, 8]],
    [30, [1, 8]],
    [45, [1, 8]],
    [49, [1, 8]],
    [64, [1, 8]],
    [67, [1, 8]],
    [9, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['finned-jellyfish'] });
  assert.equal(step?.technique, 'finned-jellyfish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 9 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'fish', subtype: 'finned-jellyfish' });
}

function testSashimiSwordfish(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [2, [1, 8]],
    [27, [1, 8]],
    [30, [1, 8]],
    [55, [1, 8]],
    [57, [1, 8]],
    [9, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['sashimi-swordfish'] });
  assert.equal(step?.technique, 'sashimi-swordfish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 9 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'fish', subtype: 'sashimi-swordfish' });
}

function testSashimiJellyfish(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [2, [1, 8]],
    [27, [1, 8]],
    [30, [1, 8]],
    [45, [1, 8]],
    [49, [1, 8]],
    [64, [1, 8]],
    [67, [1, 8]],
    [9, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['sashimi-jellyfish'] });
  assert.equal(step?.technique, 'sashimi-jellyfish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 9 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'fish', subtype: 'sashimi-jellyfish' });
}

function testAlignedPairExclusion(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2, 3]],
    [1, [1, 2]],
    [2, [1, 2]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['aligned-pair-exclusion'] });
  assert.equal(step?.technique, 'aligned-pair-exclusion');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 2));
  assert.equal(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 3), false);
  assert.equal(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 1), false);
  assert.deepEqual(step?.evidence.pattern, { family: 'als', subtype: 'aligned-pair-exclusion' });
}

function testExocet(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [1, [2, 3]],
    [15, [1, 2, 3, 4]],
    [21, [1, 2, 3, 4]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['exocet'] });
  assert.equal(step?.technique, 'exocet');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 15 && action.digit === 4));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 21 && action.digit === 4));
  assert.deepEqual(step?.evidence.pattern, { family: 'pattern', subtype: 'exocet' });
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'exocet:base:0' && node.cells.includes(0) && node.cells.includes(1)));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'exocet:targets:0' && node.cells.includes(15) && node.cells.includes(21)));
  assert.match(step?.evidence.note ?? '', /links 2 base cells and 2 target cells/);
  assert.match(step?.evidence.note ?? '', /3 base digit/);
}

function testDoubleExocet(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [1, [2, 3]],
    [13, [1, 2]],
    [14, [2, 3]],
    [15, [1, 2, 3, 4]],
    [21, [1, 2, 3, 4]],
    [8, [1, 2, 3, 4]],
    [19, [1, 2, 3, 4]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['double-exocet'] });
  assert.equal(step?.technique, 'double-exocet');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 15 && action.digit === 4));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 21 && action.digit === 4));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 8 && action.digit === 4));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 19 && action.digit === 4));
  assert.deepEqual(step?.evidence.pattern, { family: 'pattern', subtype: 'double-exocet' });
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'double-exocet:base:0'));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'double-exocet:base:1'));
  assert.match(step?.evidence.note ?? '', /links 2 base pair/);
  assert.match(step?.evidence.note ?? '', /4 base cells and 4 target cells/);
  assert.match(step?.evidence.note ?? '', /3 base digit/);
}

function testPatternOverlay(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [12, [1, 8]],
    [24, [1, 8]],
    [28, [1, 8]],
    [40, [1, 8]],
    [52, [1, 8]],
    [56, [1, 8]],
    [68, [1, 8]],
    [80, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['pattern-overlay'] });
  assert.equal(step?.technique, 'pattern-overlay');
  assert.ok(step?.actions.some((action) => action.type === 'place' && action.cell === 0 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'place' && action.cell === 80 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'pattern', subtype: 'pattern-overlay-single-digit-template' });
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'pattern-overlay:template-support' && node.digit === 1));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'pattern-overlay:targets' && node.cells.includes(0) && node.cells.includes(80)));
  assert.match(step?.evidence.note ?? '', /enumerates 1 legal template/);
  assert.match(step?.evidence.note ?? '', /4096 template budget/);
}

function testTridagons(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2, 4]],
    [11, [1, 3]],
    [19, [2, 3]],
    [3, [1, 2]],
    [13, [1, 3]],
    [23, [2, 3]],
    [27, [1, 2]],
    [37, [1, 3]],
    [47, [2, 3]],
    [30, [1, 2]],
    [40, [1, 3]],
    [50, [2, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['tridagons'] });
  assert.equal(step?.technique, 'tridagons');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 2));
  assert.deepEqual(step?.evidence.pattern, { family: 'pattern', subtype: 'tridagon-four-box-guardian' });
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'tridagons:guardian' && node.cells.includes(0)));
  assert.ok((step?.evidence.nodes ?? []).filter((node) => node.id.startsWith('tridagons:box:')).length >= 4);
  assert.match(step?.evidence.note ?? '', /uses 4 box pattern/);
  assert.match(step?.evidence.note ?? '', /3 tridagon digit/);
  assert.match(step?.evidence.note ?? '', /one guardian cell/);
}

function testSkLoops(): void {
  const puzzle = '900800000000000000000000000700600000000000000000000000000000000000000000000000000';
  const step = nextStep(buildTrustedState(puzzle, [
    [1, [1, 2]],
    [2, [1, 2]],
    [4, [1, 2]],
    [5, [1, 2]],
    [12, [1, 2]],
    [21, [1, 2]],
    [39, [1, 2]],
    [48, [1, 2]],
    [31, [1, 2]],
    [32, [1, 2]],
    [28, [1, 2]],
    [29, [1, 2]],
    [36, [1, 2]],
    [45, [1, 2]],
    [9, [1, 2]],
    [18, [1, 2]],
    [6, [1]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['sk-loops'] });
  assert.equal(step?.technique, 'sk-loops');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 6 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'pattern', subtype: 'sk-loop-eight-node' });
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'sk-loops:pivots' && node.cells.includes(0) && node.cells.includes(3)));
  assert.ok((step?.evidence.nodes ?? []).filter((node) => node.id.startsWith('sk-loops:node:')).length >= 8);
  assert.match(step?.evidence.note ?? '', /lock 8 node/);
  assert.match(step?.evidence.note ?? '', /4 pivot/);
  assert.match(step?.evidence.note ?? '', /8 link house/);
}

function testAicExotic(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [1, [2, 3]],
    [10, [1, 3]],
    [9, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['aic-exotic'] });
  assert.equal(step?.technique, 'aic-exotic');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 9 && action.digit === 1));
}

function testForcingNets(): void {
  const step = nextStep(buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  ), { allowContradictoryCandidateState: true, allowedTechniques: ['forcing-nets'] });
  assert.equal(step?.technique, 'forcing-nets');
  assert.ok(step?.actions.some((action) => action.type === 'place' && action.cell === 80 && action.digit === 9));
  assertForcingBranches(step, 2);
}

function testDigitForcingChains(): void {
  const step = nextStep(buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  ), { allowContradictoryCandidateState: true, allowedTechniques: ['digit-forcing-chains'] });
  assert.equal(step?.technique, 'digit-forcing-chains');
  assert.ok(step?.actions.some((action) => action.type === 'place' && action.cell === 80 && action.digit === 9));
  assertForcingBranches(step, 2);
}

function testNishioForcingChains(): void {
  const step = nextStep(buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  ), { allowContradictoryCandidateState: true, allowedTechniques: ['nishio-forcing-chains'] });
  assert.equal(step?.technique, 'nishio-forcing-chains');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 79 && action.digit === 9));
  assertForcingBranches(step, 1);
}

function testCellForcingChains(): void {
  const step = nextStep(buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  ), { allowContradictoryCandidateState: true, allowedTechniques: ['cell-forcing-chains'] });
  assert.equal(step?.technique, 'cell-forcing-chains');
  assert.ok(step?.actions.some((action) => action.type === 'place' && action.cell === 80 && action.digit === 9));
  assertForcingBranches(step, 2);
}

function testUnitForcingChains(): void {
  const step = nextStep(buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  ), { allowContradictoryCandidateState: true, allowedTechniques: ['unit-forcing-chains'] });
  assert.equal(step?.technique, 'unit-forcing-chains');
  assert.ok(step?.actions.some((action) => action.type === 'place' && action.cell === 79 && action.digit === 7));
  assertForcingBranches(step, 2);
}

function testRegionForcingChainsAlias(): void {
  const step = nextStep(buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  ), { allowContradictoryCandidateState: true, allowedTechniques: ['region-forcing-chains'] });
  assert.equal(step?.technique, 'region-forcing-chains');
  assert.ok(step?.actions.some((action) => action.type === 'place' && action.cell === 79 && action.digit === 7));
  assertForcingBranches(step, 2);
}

function testDynamicForcingChains(): void {
  const step = nextStep(buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  ), { allowContradictoryCandidateState: true, allowedTechniques: ['dynamic-forcing-chains'] });
  assert.equal(step?.technique, 'dynamic-forcing-chains');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 79 && action.digit === 9));
  assertForcingBranches(step, 1);
}

function testDynamicForcingChainsPlus(): void {
  const step = nextStep(buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  ), { allowContradictoryCandidateState: true, allowedTechniques: ['dynamic-forcing-chains-plus'] });
  assert.equal(step?.technique, 'dynamic-forcing-chains-plus');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 79 && action.digit === 9));
  assertForcingBranches(step, 1);
}

function testBowmansBingo(): void {
  const step = nextStep(buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  ), { allowContradictoryCandidateState: true, allowedTechniques: ['bowmans-bingo'] });
  assert.equal(step?.technique, 'bowmans-bingo');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 79 && action.digit === 9));
  assertForcingBranches(step, 1);
}

function testBowmansBingoRealBoards(): void {
  const sudokuwikiStep = nextStep(
    '006000400000050070070100030800079006060301050700620004090007020030060000008000900',
    { allowContradictoryCandidateState: true, allowedTechniques: ['bowmans-bingo'] },
  );
  assert.equal(sudokuwikiStep?.technique, 'bowmans-bingo');
  assert.ok(sudokuwikiStep?.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 8));
  assertForcingBranches(sudokuwikiStep, 1);
  assert.equal(sudokuwikiStep?.evidence.branches?.[0]?.contradictionAt?.kind, 'cell-empty');

  const taupierStep = nextStep(
    '302004605005326407604590032030400050007000904040001023000040509400805200000000348',
    { allowContradictoryCandidateState: true, allowedTechniques: ['bowmans-bingo'] },
  );
  assert.equal(taupierStep?.technique, 'bowmans-bingo');
  assert.ok(taupierStep?.actions.some((action) => action.type === 'eliminate' && action.cell === 7 && action.digit === 1));
  assertForcingBranches(taupierStep, 1);
  assert.equal(taupierStep?.evidence.branches?.[0]?.contradictionAt?.kind, 'house-missing');
}

function assertForcingBranches(
  step: ReturnType<typeof nextStep>,
  minimumBranchCount: number,
): void {
  const branches = step?.evidence.branches ?? [];
  assert.ok(branches.length >= minimumBranchCount);
  assert.ok(branches.every((branch) => branch.assumption.cell >= 0 && branch.assumption.digit >= 1));
  assert.ok(branches.every((branch) => Number.isInteger(branch.steps) && (branch.steps ?? -1) >= 0));
  assert.ok(branches.every((branch) => Number.isInteger(branch.maxSteps) && (branch.maxSteps ?? -1) >= 0));
  assert.ok(branches.every((branch) => typeof branch.truncated === 'boolean'));
  assert.ok(branches.every((branch) =>
    ['contradiction', 'no-step', 'step-limit', 'replay-error'].includes(branch.stopReason ?? '')));
  assert.ok(branches.some((branch) => branch.contradiction || branch.exhausted));
  assert.ok(branches
    .filter((branch) => branch.contradiction)
    .every((branch) => branch.contradictionAt?.kind !== undefined));
}

function testXYWing(): void {
  const board = parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const step = nextStep({
    board,
    constraints: {
      exactCandidates: [
        { cell: 0, digits: [1, 2] },
        { cell: 1, digits: [1, 3] },
        { cell: 9, digits: [2, 3] },
        { cell: 10, digits: [3, 4] },
      ],
    },
  }, { allowContradictoryCandidateState: true, allowedTechniques: ['xy-wing'] });
  assert.equal(step?.technique, 'xy-wing');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 10 && action.digit === 3));
  assert.deepEqual(step?.evidence.pattern, { family: 'wing', subtype: 'xy-wing' });
}

function testXYZWing(): void {
  const board = parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const step = nextStep({
    board,
    constraints: {
      exactCandidates: [
        { cell: 0, digits: [1, 2, 3] },
        { cell: 1, digits: [1, 3] },
        { cell: 9, digits: [2, 3] },
        { cell: 10, digits: [3, 4] },
      ],
    },
  }, { allowContradictoryCandidateState: true, allowedTechniques: ['xyz-wing'] });
  assert.equal(step?.technique, 'xyz-wing');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 10 && action.digit === 3));
  assert.deepEqual(step?.evidence.pattern, { family: 'wing', subtype: 'xyz-wing' });
}

function testWXYZWing(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [1, [1, 3]],
    [9, [1, 4]],
    [10, [2, 3, 4]],
    [2, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['wxyz-wing'] });
  assert.equal(step?.technique, 'wxyz-wing');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 2 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'wing', subtype: 'wxyz-restricted-digits' });
}

function testBigWings(): void {
  const state = buildCandidateMaskState([
    [0, [1, 2]],
    [1, [1, 3]],
    [2, [2, 3, 4]],
    [3, [1, 4]],
    [4, [1, 2, 3, 4]],
  ]);
  const step = nextStep(state, { allowContradictoryCandidateState: true, allowedTechniques: ['big-wings'] });
  assert.equal(step?.technique, 'big-wings');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 2));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 3));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 4));
  assert.deepEqual(step?.evidence.pattern, { family: 'wing', subtype: 'big-wings-als-stem' });
}

function testWWing(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [30, [1, 2]],
    [4, [1, 8]],
    [31, [1, 8]],
    [3, [2, 8]],
    [27, [2, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['w-wing'] });
  assert.equal(step?.technique, 'w-wing');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 2));
  assert.deepEqual(step?.evidence.pattern, { family: 'wing', subtype: 'w-wing-strong-link-bridge' });
  assert.ok(step?.evidence.links?.some((link) => link.from === 4 && link.to === 31 && link.digit === 1 && link.type === 'strong'));
}

function testChuteRemotePairs(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [13, [1, 2]],
    [4, [2]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['chute-remote-pairs'] });
  assert.equal(step?.technique, 'chute-remote-pairs');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 2));
  assert.ok((step?.evidence.cells ?? []).some((cell) => cell.role === 'link' && cell.cell === 24));
  assert.deepEqual(step?.evidence.pattern, { family: 'wing', subtype: 'chute-horizontal' });
}

function testRemotePairs(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [4, [1, 2]],
    [40, [1, 2]],
    [44, [1, 2]],
    [8, [1, 2, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['remote-pairs'] });
  assert.equal(step?.technique, 'remote-pairs');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 8 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 8 && action.digit === 2));
  assert.ok((step?.evidence.links ?? []).length >= 6);
  assert.deepEqual(step?.evidence.pattern, { family: 'wing', subtype: 'remote-pairs-opposite-color-endpoints' });

  const sameColorEndpoint = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [4, [1, 2]],
    [40, [1, 2]],
    [36, [1, 2, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['remote-pairs'] });
  assert.equal(sameColorEndpoint, null);
}

function testAlmostLockedPair(): void {
  const step = nextStep(buildCandidateMaskState([
    [3, [1, 2]],
    [4, [1, 8]],
    [9, [1, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['almost-locked-pair'] });
  assert.equal(step?.technique, 'almost-locked-pair');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'als', subtype: 'almost-locked-pair' });
}

function testAlmostLockedTriple(): void {
  const step = nextStep(buildCandidateMaskState([
    [3, [1, 2]],
    [4, [2, 3]],
    [5, [1, 8]],
    [9, [1, 4]],
    [10, [3, 5]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['almost-locked-triple'] });
  assert.equal(step?.technique, 'almost-locked-triple');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 5 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'als', subtype: 'almost-locked-triple' });
}

function testAlmostLockedQuad(): void {
  const step = nextStep(buildCandidateMaskState([
    [3, [1, 2]],
    [4, [2, 3]],
    [5, [3, 4]],
    [6, [1, 9]],
    [9, [1, 5]],
    [10, [2, 6]],
    [18, [4, 7]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['almost-locked-quad'] });
  assert.equal(step?.technique, 'almost-locked-quad');
  assert.ok(hasElimination(step, 6, 1));
  assert.ok(hasElimination(step, 9, 5));
  assert.ok(hasElimination(step, 10, 6));
  assert.ok(hasElimination(step, 18, 7));
  assert.ok((step?.evidence.cells ?? []).filter((cell) => cell.role === 'reason').length >= 6);
  assert.deepEqual(step?.evidence.pattern, { family: 'als', subtype: 'almost-locked-quad' });

  const noHit = nextStep(buildCandidateMaskState([
    [3, [1, 2]],
    [4, [2, 3]],
    [5, [3, 4, 5]],
    [6, [1, 9]],
    [9, [1, 5]],
    [10, [2, 6]],
    [18, [4, 7]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['almost-locked-quad'] });
  assert.equal(noHit, null);
}

function testAlsXZ(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [1, [1, 3]],
    [9, [1, 4]],
    [14, [2, 4]],
    [3, [2, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['als-xz'] });
  assert.equal(step?.technique, 'als-xz');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 2));
  assert.deepEqual(step?.evidence.pattern, { family: 'als', subtype: 'als-xz' });
  assert.ok((step?.evidence.links?.length ?? 0) >= 1);
}

function testAlsXYWing(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [9, [1, 3]],
    [1, [2, 3]],
    [10, [3, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['als-xy-wing'] });
  assert.equal(step?.technique, 'als-xy-wing');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 10 && action.digit === 3));
  assert.deepEqual(step?.evidence.pattern, { family: 'als', subtype: 'als-xy-wing' });
  assert.ok((step?.evidence.links?.length ?? 0) >= 2);
}

function testAicAls(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [1, [2, 3]],
    [2, [1, 3]],
    [3, [1, 4]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['aic-als'] });
  assert.equal(step?.technique, 'aic-als');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 1));
  assert.ok((step?.evidence.links?.length ?? 0) >= 2);
  assert.deepEqual(step?.evidence.pattern, { family: 'als', subtype: 'aic-als-rcc-chain' });
}

function testFireworks(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2, 3, 4]],
    [3, [1, 2, 3, 5]],
    [27, [1, 2, 3, 6]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['fireworks'] });
  assert.equal(step?.technique, 'fireworks');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 4));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 5));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 27 && action.digit === 6));
  assert.deepEqual(step?.evidence.pattern, { family: 'als', subtype: 'fireworks' });
}

function testTwinnedXYChains(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [1, [2, 3]],
    [2, [3, 4]],
    [9, [1, 5]],
    [10, [5, 6]],
    [11, [4, 6]],
    [18, [1]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['twinned-xy-chains'] });
  assert.equal(step?.technique, 'twinned-xy-chains');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 18 && action.digit === 1));
  assert.equal((step?.evidence.cells ?? []).filter((cell) => cell.role === 'reason').length, 6);
  assert.deepEqual(step?.evidence.pattern, { family: 'als', subtype: 'twinned-xy-chains' });
}

function testSueDeCoq(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [1, [3, 4]],
    [3, [1, 5]],
    [4, [2, 5]],
    [5, [3, 5]],
    [6, [5]],
    [9, [1, 6]],
    [10, [2, 6]],
    [11, [3, 6]],
    [18, [6]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['sue-de-coq'] });
  assert.equal(step?.technique, 'sue-de-coq');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 6 && action.digit === 5));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 18 && action.digit === 6));
  assert.deepEqual(step?.evidence.pattern, { family: 'als', subtype: 'sue-de-coq-row-box' });
}

function testDeathBlossom(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2, 3]],
    [1, [1, 4]],
    [9, [2, 4]],
    [10, [3, 4]],
    [2, [4]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['death-blossom'] });
  assert.equal(step?.technique, 'death-blossom');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 2 && action.digit === 4));
  assert.deepEqual(step?.evidence.pattern, { family: 'als', subtype: 'death-blossom' });
}

function testSimpleColoring(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [18, [1, 8]],
    [10, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['simple-coloring'] });
  assert.equal(step?.technique, 'simple-coloring');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 10 && action.digit === 1));
  assert.ok((step?.evidence.links?.length ?? 0) >= 1);
}

function testXChain(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [9, [1, 8]],
    [10, [1, 8]],
    [1, [1, 8]],
    [2, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['x-chain'] });
  assert.equal(step?.technique, 'x-chain');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 2 && action.digit === 1));
  assert.ok((step?.evidence.links?.length ?? 0) >= 3);
}

function testMultiColors(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [18, [1, 8]],
    [8, [1, 8]],
    [26, [1, 8]],
    [4, [1, 8]],
    [20, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['multi-colors'] });
  assert.equal(step?.technique, 'multi-colors');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 20 && action.digit === 1));
  assert.ok((step?.evidence.links?.length ?? 0) >= 3);
}

function testThreeDMedusa(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2, 3]],
    [9, [1, 2]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['three-d-medusa'] });
  assert.equal(step?.technique, 'three-d-medusa');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 3));
  assert.ok((step?.evidence.links?.length ?? 0) >= 2);
}

function testGroupedXCycles(): void {
  const step = nextStep(buildCandidateMaskState([
    [4, [1]],
    [8, [1]],
    [21, [1]],
    [22, [1]],
    [51, [1]],
    [55, [1]],
    [57, [1]],
    [66, [1]],
    [67, [1]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['grouped-x-cycles'] });
  assert.equal(step?.technique, 'grouped-x-cycles');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 57 && action.digit === 1));
  assert.ok((step?.evidence.cells ?? []).some((cell) => cell.role === 'reason' && cell.cell === 4));
}

function testGroupedAic(): void {
  const step = nextStep(buildCandidateMaskState([
    [1, [1, 2, 4, 5]],
    [2, [2, 3, 4, 5]],
    [11, [3]],
    [12, [1, 3]],
    [18, [5]],
    [19, [1]],
    [20, [1, 3, 4, 5]],
    [24, [1, 4]],
    [34, [3]],
    [44, [1, 5]],
    [51, [5]],
    [52, [4]],
    [55, [1, 5]],
    [61, [1, 2, 3]],
    [62, [5]],
    [63, [1, 3, 5]],
    [68, [4]],
    [74, [1, 2, 3, 5]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['grouped-aic'] });
  assert.equal(step?.technique, 'grouped-aic');
  assert.ok((step?.actions.filter((action) => action.type === 'eliminate').length ?? 0) > 0);
  assert.match(step?.evidence.note ?? '', /组/);
  assert.ok((step?.evidence.links?.length ?? 0) >= 5);
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.grouped === true && node.cells.length > 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'grouped-aic', subtype: 'different-digit-endpoints' });
}

function testXYChain(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [9, [2, 3]],
    [10, [1, 3]],
    [1, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['xy-chain'] });
  assert.equal(step?.technique, 'xy-chain');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 1 && action.digit === 1));
  assert.ok((step?.evidence.links?.length ?? 0) >= 3);
  assert.deepEqual(step?.evidence.pattern, { family: 'xy-chain', subtype: 'open-chain' });
}

function testAicSameDigitEndpoint(): void {
  const step = nextStep(buildCandidateMaskState([
    [4, [4]],
    [17, [1, 2, 3]],
    [23, [1]],
    [30, [3]],
    [31, [3, 4]],
    [35, [2, 3, 4]],
    [38, [4]],
    [39, [1]],
    [45, [1]],
    [47, [4]],
    [55, [1]],
    [58, [3, 4]],
    [73, [3, 4]],
    [75, [1]],
    [76, [1]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['aic'] });
  assert.equal(step?.technique, 'aic');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 4));
  assert.ok((step?.evidence.links?.length ?? 0) >= 3);
  assert.deepEqual(step?.evidence.pattern, { family: 'aic', subtype: 'same-digit-endpoints' });
}

function testAicDifferentDigitEndpoint(): void {
  const step = nextStep(buildCandidateMaskState([
    [4, [2, 3]],
    [14, [1, 3]],
    [15, [4]],
    [20, [3, 4]],
    [22, [2]],
    [26, [2, 3, 4]],
    [28, [2, 3, 4]],
    [30, [2]],
    [34, [4]],
    [45, [3, 5]],
    [52, [1, 3]],
    [54, [4]],
    [69, [1, 3, 4]],
    [74, [2]],
    [78, [2]],
    [80, [1, 2, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['aic'] });
  assert.equal(step?.technique, 'aic');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 26 && action.digit === 4));
  assert.equal(
    (step?.evidence.cells ?? []).some((cell) => cell.role === 'reason' && cell.cell === 26 && cell.digit === 4),
    false,
  );
  assert.deepEqual(step?.evidence.pattern, { family: 'aic', subtype: 'different-digit-endpoints' });
}

function testAicContinuousLoop(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2, 4]],
    [1, [1, 2, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['aic'] });
  assert.equal(step?.technique, 'aic');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 4));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 1 && action.digit === 3));
  assert.ok((step?.evidence.links?.length ?? 0) >= 4);
  assert.deepEqual(step?.evidence.pattern, { family: 'aic', subtype: 'continuous-loop' });
}

function testAicDiscontinuousWeakLoop(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2, 3]],
    [1, [2, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['aic'] });
  assert.equal(step?.technique, 'aic');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 1));
  assert.ok((step?.evidence.links?.length ?? 0) >= 5);
  assert.deepEqual(step?.evidence.pattern, { family: 'aic', subtype: 'discontinuous-loop-weak-weak' });
}

function testAicDiscontinuousStrongLoop(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 4]],
    [1, [1, 3]],
    [9, [1, 2]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['aic'] });
  assert.equal(step?.technique, 'aic');
  assert.ok(step?.actions.some((action) => action.type === 'place' && action.cell === 0 && action.digit === 1));
  assert.ok((step?.evidence.links?.length ?? 0) >= 3);
  assert.deepEqual(step?.evidence.pattern, { family: 'aic', subtype: 'discontinuous-loop-strong-strong' });
}

function testReferenceChainEntryPoints(): void {
  for (const fixture of (loadReferenceTechniqueFixtures().fish ?? []).map(toReferenceFishFixture)) {
    assertReferenceFishFixture(fixture);
  }
  for (const fixture of loadReferenceTechniqueFixtures().chains.map(toReferenceChainFixture)) {
    assertReferenceChainFixture(fixture);
  }
  for (const fixture of (loadReferenceTechniqueFixtures().wings ?? []).map(toReferenceWingFixture)) {
    assertReferenceWingFixture(fixture);
  }
}

function testSkyscraper(): void {
  const board = parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const oneCells = new Set([0, 3, 18, 22, 13]);
  const step = nextStep({
    board,
    constraints: {
      exactCandidates: Array.from({ length: 81 }, (_, cell) => ({
        cell,
        digits: oneCells.has(cell) ? [1, 2] : [2, 3],
      })),
    },
  }, { allowContradictoryCandidateState: true, allowedTechniques: ['skyscraper'] });
  assert.equal(step?.technique, 'skyscraper');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'skyscraper', subtype: 'col-base' });
  assert.ok((step?.evidence.links ?? []).filter((link) => link.type === 'strong').length >= 2);

  const rowBaseStep = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [2, [1, 8]],
    [27, [1, 8]],
    [37, [1, 8]],
    [38, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['skyscraper'] });
  assert.equal(rowBaseStep?.technique, 'skyscraper');
  assert.ok(rowBaseStep?.actions.some((action) => action.type === 'eliminate' && action.cell === 27 && action.digit === 1));
  assert.deepEqual(rowBaseStep?.evidence.pattern, { family: 'skyscraper', subtype: 'row-base' });
  assert.ok((rowBaseStep?.evidence.links ?? []).filter((link) => link.type === 'strong').length >= 2);
}

function testTurbotFish(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [9, [1, 8]],
    [10, [1, 8]],
    [19, [1, 8]],
    [2, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['turbot-fish'] });
  assert.equal(step?.technique, 'turbot-fish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'turbot-fish', subtype: 'row-box-row' });
  assert.ok((step?.evidence.links ?? []).filter((link) => link.type === 'strong').length >= 2);
  assert.ok((step?.evidence.links ?? []).filter((link) => link.type === 'weak').length >= 1);

  const colBoxColStep = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [1, [1, 8]],
    [2, [1, 8]],
    [9, [1, 8]],
    [19, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['turbot-fish'] });
  assert.equal(colBoxColStep?.technique, 'turbot-fish');
  assert.ok(colBoxColStep?.actions.some((action) => action.type === 'eliminate' && action.cell === 2 && action.digit === 1));
  assert.deepEqual(colBoxColStep?.evidence.pattern, { family: 'turbot-fish', subtype: 'col-box-col' });
  assert.ok((colBoxColStep?.evidence.links ?? []).filter((link) => link.type === 'strong').length >= 2);
  assert.ok((colBoxColStep?.evidence.links ?? []).filter((link) => link.type === 'weak').length >= 1);

  const variants: Array<{
    candidates: Array<[number, number[]]>;
    expectedCell: number;
    subtype: string;
  }> = [
    { candidates: [[0, [1, 8]], [1, [1, 8]], [2, [1, 8]], [9, [1, 8]], [10, [1, 8]]], expectedCell: 2, subtype: 'col-row-col' },
    { candidates: [[0, [1, 8]], [1, [1, 8]], [9, [1, 8]], [10, [1, 8]], [18, [1, 8]]], expectedCell: 18, subtype: 'row-col-row' },
    { candidates: [[0, [1, 8]], [1, [1, 8]], [3, [1, 8]], [4, [1, 8]], [9, [1, 8]]], expectedCell: 1, subtype: 'col-row-box' },
    { candidates: [[0, [1, 8]], [1, [1, 8]], [3, [1, 8]], [27, [1, 8]], [30, [1, 8]]], expectedCell: 3, subtype: 'row-col-box' },
    { candidates: [[0, [1, 8]], [1, [1, 8]], [3, [1, 8]], [4, [1, 8]], [6, [1, 8]]], expectedCell: 6, subtype: 'box-row-box' },
    { candidates: [[0, [1, 8]], [1, [1, 8]], [11, [1, 8]], [18, [1, 8]], [20, [1, 8]]], expectedCell: 18, subtype: 'row-box-col' },
  ];
  for (const variant of variants) {
    const variantStep = nextStep(buildExactCandidateState(variant.candidates), {
      allowContradictoryCandidateState: true,
      allowedTechniques: ['turbot-fish'],
    });
    assert.equal(variantStep?.technique, 'turbot-fish');
    assert.ok(variantStep?.actions.some((action) =>
      action.type === 'eliminate' && action.cell === variant.expectedCell && action.digit === 1));
    assert.deepEqual(variantStep?.evidence.pattern, { family: 'turbot-fish', subtype: variant.subtype });
    assert.ok((variantStep?.evidence.links ?? []).filter((link) => link.type === 'strong').length >= 2);
    assert.ok((variantStep?.evidence.links ?? []).filter((link) => link.type === 'weak').length >= 1);
  }
}

function testEmptyRectangle(): void {
  const step = nextStep(buildExactCandidateState([
    [1, [1, 8]],
    [2, [1, 8]],
    [9, [1, 8]],
    [18, [1, 8]],
    [3, [1, 8]],
    [39, [1, 8]],
    [36, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['empty-rectangle'] });
  assert.equal(step?.technique, 'empty-rectangle');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 36 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'empty-rectangle', subtype: 'column-conjugate' });
  assert.ok((step?.evidence.links ?? []).filter((link) => link.type === 'strong').length >= 1);

  const rowConjugateStep = nextStep(buildExactCandidateState([
    [1, [1, 8]],
    [2, [1, 8]],
    [4, [1, 8]],
    [9, [1, 8]],
    [13, [1, 8]],
    [18, [1, 8]],
    [27, [1, 8]],
    [31, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['empty-rectangle'] });
  assert.equal(rowConjugateStep?.technique, 'empty-rectangle');
  assert.ok(rowConjugateStep?.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 1));
  assert.deepEqual(rowConjugateStep?.evidence.pattern, { family: 'empty-rectangle', subtype: 'row-conjugate' });
  assert.ok((rowConjugateStep?.evidence.links ?? []).filter((link) => link.type === 'strong').length >= 1);
}

function testUniqueRectangle(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [3, [1, 2]],
    [9, [1, 2]],
    [12, [1, 2, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['unique-rectangle'] });
  assert.equal(step?.technique, 'unique-rectangle');
  assert.deepEqual(step?.evidence.pattern, { family: 'unique-rectangle', subtype: 'type-1' });
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'ur-rectangle' && node.cells.length === 4));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'ur-roof' && node.cells.includes(12)));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 12 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 12 && action.digit === 2));

  const type2RowRoof = nextStep(buildCandidateMaskState([
    [0, [1, 2, 3]],
    [3, [1, 2, 3]],
    [9, [1, 2]],
    [12, [1, 2]],
    [6, [3, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['unique-rectangle'] });
  assert.equal(type2RowRoof?.technique, 'unique-rectangle');
  assert.deepEqual(type2RowRoof?.evidence.pattern, { family: 'unique-rectangle', subtype: 'type-2-shared-extra' });
  assert.ok(type2RowRoof?.actions.some((action) => action.type === 'eliminate' && action.cell === 6 && action.digit === 3));
  assert.ok((type2RowRoof?.evidence.nodes ?? []).some((node) => node.id === 'ur-floor' && node.cells.includes(9) && node.cells.includes(12)));
  assert.ok((type2RowRoof?.evidence.nodes ?? []).some((node) => node.id === 'ur-roof' && node.cells.includes(0) && node.cells.includes(3)));
}

function testUniqueRectangleType4(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [3, [1, 2, 3]],
    [9, [1, 2]],
    [12, [1, 2, 4]],
    [21, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['unique-rectangle'] });
  assert.equal(step?.technique, 'unique-rectangle');
  assert.deepEqual(step?.evidence.pattern, { family: 'unique-rectangle', subtype: 'type-4' });
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 12 && action.digit === 1));

  const rowSharedRoof = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [3, [1, 2]],
    [9, [1, 2, 3]],
    [12, [1, 2, 4]],
    [10, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['unique-rectangle'] });
  assert.equal(rowSharedRoof?.technique, 'unique-rectangle');
  assert.deepEqual(rowSharedRoof?.evidence.pattern, { family: 'unique-rectangle', subtype: 'type-4' });
  assert.ok(rowSharedRoof?.actions.some((action) => action.type === 'eliminate' && action.cell === 9 && action.digit === 1));
  assert.ok(rowSharedRoof?.actions.some((action) => action.type === 'eliminate' && action.cell === 12 && action.digit === 1));
  assert.ok((rowSharedRoof?.evidence.nodes ?? []).some((node) => node.id === 'ur-floor' && node.cells.includes(0) && node.cells.includes(3)));
  assert.ok((rowSharedRoof?.evidence.nodes ?? []).some((node) => node.id === 'ur-roof' && node.cells.includes(9) && node.cells.includes(12)));
}

function testUniqueRectangleType3NakedSet(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [3, [1, 2, 3]],
    [9, [1, 2]],
    [12, [1, 2, 4]],
    [4, [1, 8]],
    [13, [2, 8]],
    [21, [1, 3, 4]],
    [30, [2, 3, 4]],
    [39, [3, 4, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['unique-rectangle'] });
  assert.equal(step?.technique, 'unique-rectangle');
  assert.deepEqual(step?.evidence.pattern, { family: 'unique-rectangle', subtype: 'type-3-naked-set' });
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 39 && action.digit === 3));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 39 && action.digit === 4));
}

function testUniqueRectangleType3HiddenSet(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [3, [1, 2, 3]],
    [9, [1, 2]],
    [12, [1, 2, 4]],
    [4, [1, 8]],
    [13, [2, 8]],
    [21, [1, 3, 5]],
    [30, [2, 3, 6]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['unique-rectangle'] });
  assert.equal(step?.technique, 'unique-rectangle');
  assert.deepEqual(step?.evidence.pattern, { family: 'unique-rectangle', subtype: 'type-3-hidden-set' });
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 21 && action.digit === 5));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 30 && action.digit === 6));
}

function testAvoidableRectangle(): void {
  const step = nextStep(buildTrustedState(
    '020000000000000000000000000210000000000000000000000000000000000000000000000000000',
    [[0, [1, 3]]],
  ), { allowContradictoryCandidateState: true, allowedTechniques: ['avoidable-rectangle'] });
  assert.equal(step?.technique, 'avoidable-rectangle');
  assert.deepEqual(step?.evidence.pattern, { family: 'avoidable-rectangle', subtype: 'three-solved-corners' });
  assert.ok(hasElimination(step, 0, 1));

  const invalidBoard = parsePuzzle('000100000200100000000000000000000000000000000000000000000000000000000000000000000');
  const candidateMasks = new Array<number>(81).fill(0);
  candidateMasks[0] = (1 << (1 - 1)) | (1 << (2 - 1));
  const invalidStep = nextStep({ board: invalidBoard, candidateMasks }, { allowContradictoryCandidateState: true, allowedTechniques: ['avoidable-rectangle'] });
  assert.equal(invalidStep, null);
}

function testRectangleElimination(): void {
  const rowStep = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [3, [1, 8]],
    [27, [1, 8]],
    [30, [1, 8]],
    [31, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['rectangle-elimination'] });
  assert.equal(rowStep?.technique, 'rectangle-elimination');
  assert.deepEqual(rowStep?.evidence.pattern, { family: 'rectangle-elimination', subtype: 'row-strong-link' });
  assert.ok(rowStep?.actions.some((action) => action.type === 'eliminate' && action.cell === 27 && action.digit === 1));
  assert.ok((rowStep?.evidence.links?.length ?? 0) >= 1);

  const colStep = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [3, [1, 8]],
    [6, [1, 8]],
    [27, [1, 8]],
    [30, [1, 8]],
    [31, [1, 8]],
    [39, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['rectangle-elimination'] });
  assert.equal(colStep?.technique, 'rectangle-elimination');
  assert.deepEqual(colStep?.evidence.pattern, { family: 'rectangle-elimination', subtype: 'col-strong-link' });
  assert.ok(colStep?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 1));
  assert.ok((colStep?.evidence.links?.length ?? 0) >= 1);
}

function testExtendedRectangle(): void {
  const twoByThree = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [3, [1, 2]],
    [6, [1, 2]],
    [9, [1, 2]],
    [12, [1, 2]],
    [15, [1, 2, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['extended-rectangle'] });
  assert.equal(twoByThree?.technique, 'extended-rectangle');
  assert.deepEqual(twoByThree?.evidence.pattern, { family: 'extended-rectangle', subtype: '2x3-or-3x2-type-1' });
  assert.ok(twoByThree?.actions.some((action) => action.type === 'eliminate' && action.cell === 15 && action.digit === 1));
  assert.ok(twoByThree?.actions.some((action) => action.type === 'eliminate' && action.cell === 15 && action.digit === 2));

  const threeByTwo = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [1, [1, 2]],
    [27, [1, 2]],
    [28, [1, 2]],
    [54, [1, 2]],
    [55, [1, 2, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['extended-rectangle'] });
  assert.equal(threeByTwo?.technique, 'extended-rectangle');
  assert.deepEqual(threeByTwo?.evidence.pattern, { family: 'extended-rectangle', subtype: '2x3-or-3x2-type-1' });
  assert.ok(threeByTwo?.actions.some((action) => action.type === 'eliminate' && action.cell === 55 && action.digit === 1));
  assert.ok(threeByTwo?.actions.some((action) => action.type === 'eliminate' && action.cell === 55 && action.digit === 2));
}

function testUniqueLoop(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [3, [1, 2]],
    [6, [1, 2]],
    [9, [1, 2]],
    [12, [1, 2]],
    [15, [1, 2, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['unique-loop'] });
  assert.equal(step?.technique, 'unique-loop');
  assert.deepEqual(step?.evidence.pattern, { family: 'unique-loop', subtype: '2x3-or-3x2-single-roof' });
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 15 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 15 && action.digit === 2));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'unique-loop' && node.cells.length === 6));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'unique-loop:base-pair' && node.cells.includes(0) && node.cells.includes(12)));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'unique-loop:guardians' && node.cells.includes(15)));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'unique-loop:targets' && node.cells.includes(15)));

  const sharedGuardian = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [3, [1, 2]],
    [6, [1, 2, 9]],
    [9, [1, 2]],
    [12, [1, 2]],
    [15, [1, 2, 9]],
    [24, [8, 9]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['unique-loop'] });
  assert.equal(sharedGuardian?.technique, 'unique-loop');
  assert.deepEqual(sharedGuardian?.evidence.pattern, { family: 'unique-loop', subtype: '2x3-or-3x2-shared-guardian' });
  assert.ok(sharedGuardian?.actions.some((action) => action.type === 'eliminate' && action.cell === 24 && action.digit === 9));
  assert.ok((sharedGuardian?.evidence.nodes ?? []).some((node) => node.id === 'unique-loop:guardians' && node.cells.includes(6) && node.cells.includes(15)));
  assert.ok((sharedGuardian?.evidence.nodes ?? []).some((node) => node.id === 'unique-loop:targets' && node.digit === 9 && node.cells.includes(24)));

  const generalized = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [3, [1, 2]],
    [10, [1, 2]],
    [12, [1, 2]],
    [28, [1, 2]],
    [31, [1, 2]],
    [36, [1, 2, 3]],
    [40, [1, 2]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['unique-loop'] });
  assert.equal(generalized?.technique, 'unique-loop');
  assert.deepEqual(generalized?.evidence.pattern, { family: 'unique-loop', subtype: 'generalized-single-roof' });
  assert.ok(generalized?.actions.some((action) => action.type === 'eliminate' && action.cell === 36 && action.digit === 1));
  assert.ok(generalized?.actions.some((action) => action.type === 'eliminate' && action.cell === 36 && action.digit === 2));
  assert.ok((generalized?.evidence.nodes ?? []).some((node) => node.id === 'unique-loop' && node.cells.length === 8));
  assert.ok((generalized?.evidence.nodes ?? []).some((node) => node.id === 'unique-loop:guardians' && node.cells.includes(36)));

  const longerGeneralized = nextStep(buildExactCandidateState([
    [0, [1, 2, 3]],
    [1, [1, 2]],
    [28, [1, 2]],
    [31, [1, 2]],
    [40, [1, 2]],
    [43, [1, 2]],
    [47, [1, 2]],
    [52, [1, 2]],
    [56, [1, 2]],
    [59, [1, 2]],
    [68, [1, 2]],
    [71, [1, 2]],
    [72, [1, 2]],
    [80, [1, 2]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['unique-loop'] });
  assert.equal(longerGeneralized?.technique, 'unique-loop');
  assert.deepEqual(longerGeneralized?.evidence.pattern, { family: 'unique-loop', subtype: 'generalized-single-roof' });
  assert.ok(longerGeneralized?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 1));
  assert.ok(longerGeneralized?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 2));
  assert.ok((longerGeneralized?.evidence.nodes ?? []).some((node) => node.id === 'unique-loop' && node.cells.length === 14));
  assert.ok((longerGeneralized?.evidence.nodes ?? []).some((node) => node.id === 'unique-loop:guardians' && node.cells.includes(0)));

  const noSingleRoof = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [3, [1, 2]],
    [6, [1, 2]],
    [9, [1, 2]],
    [12, [1, 2, 3]],
    [15, [1, 2, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['unique-loop'] });
  assert.equal(noSingleRoof, null);

  const brokenLoop = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [3, [1, 2]],
    [10, [1, 2]],
    [12, [1, 2]],
    [28, [1, 2]],
    [31, [1, 2]],
    [36, [1, 2, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['unique-loop'] });
  assert.equal(brokenLoop, null);

  const targetWithoutPair = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [3, [1, 2]],
    [10, [1, 2]],
    [12, [1, 2]],
    [28, [1, 2]],
    [31, [1, 2]],
    [36, [1, 3]],
    [40, [1, 2]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['unique-loop'] });
  assert.equal(targetWithoutPair, null);

  const multipleGuardians = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [3, [1, 2]],
    [10, [1, 2]],
    [12, [1, 2]],
    [28, [1, 2]],
    [31, [1, 2]],
    [36, [1, 2, 3]],
    [40, [1, 2, 4]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['unique-loop'] });
  assert.equal(multipleGuardians, null);
}

function testHiddenUniqueRectangle(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [3, [1, 2]],
    [9, [1, 2]],
    [12, [1, 2, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['hidden-unique-rectangle'] });
  assert.equal(step?.technique, 'hidden-unique-rectangle');
  assert.deepEqual(step?.evidence.pattern, { family: 'hidden-unique-rectangle', subtype: 'type-6-strong-link-corner' });
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.digit === 2));
  assert.ok((step?.evidence.links?.length ?? 0) >= 2);
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'ur-rectangle' && node.cells.length === 4));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'ur-roof' && node.cells.includes(3)));

  const mirrored = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [1, [1, 2]],
    [27, [1, 2]],
    [28, [1, 2, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['hidden-unique-rectangle'] });
  assert.equal(mirrored?.technique, 'hidden-unique-rectangle');
  assert.deepEqual(mirrored?.evidence.pattern, { family: 'hidden-unique-rectangle', subtype: 'type-6-strong-link-corner' });
  assert.ok(mirrored?.actions.some((action) => action.type === 'eliminate' && action.cell === 1 && action.digit === 2));
  assert.ok((mirrored?.evidence.links?.length ?? 0) >= 2);
  assert.ok((mirrored?.evidence.nodes ?? []).some((node) => node.id === 'ur-rectangle' && node.cells.includes(28)));
  assert.ok((mirrored?.evidence.nodes ?? []).some((node) => node.id === 'ur-roof' && node.cells.includes(1)));
}

function testAicUr(): void {
  const singleRoof = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [3, [1, 2]],
    [9, [1, 2]],
    [12, [1, 2, 3]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['aic-ur'] });
  assert.equal(singleRoof?.technique, 'aic-ur');
  assert.deepEqual(singleRoof?.evidence.pattern, { family: 'unique-rectangle-aic', subtype: 'single-roof-chain' });
  assert.ok(singleRoof?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 2));
  assert.ok((singleRoof?.evidence.cells ?? []).some((cell) => cell.role === 'link' && cell.cell === 12));
  assert.ok((singleRoof?.evidence.links?.length ?? 0) >= 2);
  assert.ok((singleRoof?.evidence.nodes ?? []).some((node) => node.id === 'ur-rectangle' && node.cells.length === 4));
  assert.ok((singleRoof?.evidence.nodes ?? []).some((node) => node.id === 'ur-roof' && node.cells.includes(3)));

  const floorRoof = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [3, [1, 2]],
    [9, [1, 2, 3]],
    [10, [1, 2, 8]],
    [12, [1, 2, 4]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['aic-ur'] });
  assert.equal(floorRoof?.technique, 'aic-ur');
  assert.deepEqual(floorRoof?.evidence.pattern, { family: 'unique-rectangle-aic', subtype: 'floor-roof-chain' });
  assert.ok(floorRoof?.actions.some((action) => action.type === 'eliminate' && action.cell === 12 && action.digit === 2));
  assert.ok((floorRoof?.evidence.links?.length ?? 0) >= 1);
  assert.ok((floorRoof?.evidence.nodes ?? []).some((node) => node.id === 'ur-floor' && node.cells.includes(0) && node.cells.includes(3)));
  assert.ok((floorRoof?.evidence.nodes ?? []).some((node) => node.id === 'ur-roof' && node.cells.includes(9) && node.cells.includes(12)));

  const mirroredFloorRoof = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [3, [1, 2]],
    [9, [1, 2, 4]],
    [10, [2, 8]],
    [12, [1, 2, 3]],
    [13, [1, 8]],
    [18, [1, 8]],
  ]), { allowContradictoryCandidateState: true, allowedTechniques: ['aic-ur'] });
  assert.equal(mirroredFloorRoof?.technique, 'aic-ur');
  assert.deepEqual(mirroredFloorRoof?.evidence.pattern, { family: 'unique-rectangle-aic', subtype: 'floor-roof-chain' });
  assert.ok(mirroredFloorRoof?.actions.some((action) => action.type === 'eliminate' && action.cell === 9 && action.digit === 2));
  assert.ok((mirroredFloorRoof?.evidence.links ?? []).some((link) => link.from === 3 && link.to === 12 && link.type === 'strong'));
  assert.ok((mirroredFloorRoof?.evidence.nodes ?? []).some((node) => node.id === 'ur-floor' && node.cells.includes(0) && node.cells.includes(3)));
  assert.ok((mirroredFloorRoof?.evidence.nodes ?? []).some((node) => node.id === 'ur-roof' && node.cells.includes(9) && node.cells.includes(12)));
}

function testBugPlusOne(): void {
  const overrides: Array<[number, number[]]> = [];
  for (let cell = 0; cell < 81; cell += 1) {
    overrides.push([cell, cell === 0 ? [1, 2, 3] : [1, 2]]);
  }
  const step = nextStep(buildExactCandidateState(overrides), { allowContradictoryCandidateState: true, allowedTechniques: ['bug-plus-one'] });
  assert.equal(step?.technique, 'bug-plus-one');
  assert.deepEqual(step?.evidence.pattern, { family: 'bug', subtype: 'bug-plus-one' });
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'bug-base' && node.cells.length === 80));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'bug-extra' && node.cells.includes(0)));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'bug-parity-row' && node.digit === 1 && node.cells.includes(0)));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'bug-parity-col' && node.digit === 1 && node.cells.includes(0)));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'bug-parity-box' && node.digit === 1 && node.cells.includes(0)));
  assert.ok(step?.actions.some((action) => action.type === 'place' && action.cell === 0));
}

function testBugPlusTwo(): void {
  const step = nextStep(buildTrustedState(
    '004008912002005348198342567859761423426853791713924856961537284287419635345286179',
    [
      [0, [1, 2, 3]],
      [1, [3, 4]],
      [3, [1, 2, 3]],
      [4, [3, 4]],
      [9, [1, 2]],
      [10, [3, 4]],
      [12, [1, 2]],
      [13, [3, 4]],
    ],
  ), { allowContradictoryCandidateState: true, allowedTechniques: ['bug-plus-two'] });
  assert.equal(step?.technique, 'bug-plus-two');
  assert.deepEqual(step?.evidence.pattern, { family: 'bug', subtype: 'bug-plus-two-common-extra' });
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'bug-base' && node.cells.includes(0) && node.cells.includes(3)));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'bug-extra' && node.cells.includes(0) && node.cells.includes(3)));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'bug-common-extra-targets' && node.digit === 3 && node.cells.includes(1) && node.cells.includes(4)));
  assert.ok((step?.evidence.links ?? []).some((link) =>
    link.type === 'strong'
    && link.digit === 1
    && link.house?.type === 'row'
    && link.house.index === 0
    && new Set([link.from, link.to]).has(0)
    && new Set([link.from, link.to]).has(3)));
  assert.ok(hasElimination(step, 1, 3));
  assert.ok(hasElimination(step, 4, 3));
  for (const fixture of loadReferenceTechniqueFixtures().uniqueness) {
    assertReferenceUniquenessFixture(fixture);
  }
}

function testBugPlusN(): void {
  const step = nextStep(buildTrustedState(
    '000006789456789123789123456000007891567891234891234567345678912678912345912345678',
    [
      [0, [1, 2, 3]],
      [1, [1, 3, 4]],
      [2, [2, 3, 4]],
      [3, [3, 5]],
      [4, [3, 5]],
      [27, [1, 2]],
      [28, [1, 4]],
      [29, [2, 4]],
      [30, [3, 5]],
      [31, [3, 5]],
    ],
  ), { allowContradictoryCandidateState: true, allowedTechniques: ['bug-plus-n'] });
  assert.equal(step?.technique, 'bug-plus-n');
  assert.deepEqual(step?.evidence.pattern, { family: 'bug', subtype: 'bug-plus-n-common-extra' });
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'bug-base' && node.cells.includes(0) && node.cells.includes(31)));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'bug-extra' && node.digit === 3 && node.cells.includes(0) && node.cells.includes(1) && node.cells.includes(2)));
  assert.ok((step?.evidence.nodes ?? []).some((node) => node.id === 'bug-common-extra-targets' && node.digit === 3 && node.cells.includes(3) && node.cells.includes(4)));
  assert.ok((step?.evidence.links ?? []).some((link) =>
    link.type === 'strong'
    && link.digit === 1
    && link.house?.type === 'row'
    && link.house.index === 0
    && new Set([link.from, link.to]).has(0)
    && new Set([link.from, link.to]).has(1)));
  assert.ok(hasElimination(step, 3, 3));
  assert.ok(hasElimination(step, 4, 3));
}

function testTwoStringKite(): void {
  const board = parsePuzzle('000000000000000000000000000000000000000000000000000000000000000000000000000000000');
  const oneCells = new Set([0, 5, 10, 28, 32]);
  const step = nextStep({
    board,
    constraints: {
      exactCandidates: Array.from({ length: 81 }, (_, cell) => ({
        cell,
        digits: oneCells.has(cell) ? [1, 2] : [2, 3],
      })),
    },
  }, { allowContradictoryCandidateState: true, allowedTechniques: ['two-string-kite'] });
  assert.equal(step?.technique, 'two-string-kite');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 32 && action.digit === 1));
  assert.deepEqual(step?.evidence.pattern, { family: 'two-string-kite', subtype: 'box-linked-row-column-b0' });
  assert.ok((step?.evidence.links ?? []).filter((link) => link.type === 'strong').length >= 3);

  const variants: Array<{
    candidates: Array<[number, number[]]>;
    expectedCell: number;
    subtype: string;
  }> = [
    { candidates: [[0, [1, 8]], [3, [1, 8]], [13, [1, 8]], [45, [1, 8]], [49, [1, 8]]], expectedCell: 45, subtype: 'box-linked-row-column-b1' },
    { candidates: [[3, [1, 8]], [8, [1, 8]], [16, [1, 8]], [30, [1, 8]], [34, [1, 8]]], expectedCell: 30, subtype: 'box-linked-row-column-b2' },
    { candidates: [[1, [1, 8]], [5, [1, 8]], [27, [1, 8]], [32, [1, 8]], [37, [1, 8]]], expectedCell: 5, subtype: 'box-linked-row-column-b3' },
    { candidates: [[0, [1, 8]], [4, [1, 8]], [27, [1, 8]], [30, [1, 8]], [40, [1, 8]]], expectedCell: 0, subtype: 'box-linked-row-column-b4' },
    { candidates: [[0, [1, 8]], [7, [1, 8]], [27, [1, 8]], [33, [1, 8]], [43, [1, 8]]], expectedCell: 0, subtype: 'box-linked-row-column-b5' },
    { candidates: [[46, [1, 8]], [50, [1, 8]], [64, [1, 8]], [72, [1, 8]], [77, [1, 8]]], expectedCell: 50, subtype: 'box-linked-row-column-b6' },
    { candidates: [[0, [1, 8]], [4, [1, 8]], [54, [1, 8]], [57, [1, 8]], [67, [1, 8]]], expectedCell: 0, subtype: 'box-linked-row-column-b7' },
    { candidates: [[48, [1, 8]], [52, [1, 8]], [70, [1, 8]], [75, [1, 8]], [80, [1, 8]]], expectedCell: 48, subtype: 'box-linked-row-column-b8' },
  ];
  for (const variant of variants) {
    const variantStep = nextStep(buildExactCandidateState(variant.candidates), {
      allowContradictoryCandidateState: true,
      allowedTechniques: ['two-string-kite'],
    });
    assert.equal(variantStep?.technique, 'two-string-kite');
    assert.ok(variantStep?.actions.some((action) =>
      action.type === 'eliminate' && action.cell === variant.expectedCell && action.digit === 1));
    assert.deepEqual(variantStep?.evidence.pattern, { family: 'two-string-kite', subtype: variant.subtype });
    assert.ok((variantStep?.evidence.links ?? []).filter((link) => link.type === 'strong').length >= 3);
  }
}

function run(): void {
  testPublicSourceImportGuard();
  testPackageExportsDist();
  testPublicRepoMaintenanceFiles();
  testParseAndSerialize();
  testBoardAdapters();
  testForbiddenCandidates();
  testTrustedCandidateState();
  testStateCandidateContradictionsAndAssumptions();
  testValidationConflict();
  testUniqueness();
  testCanonicalize();
  testPublicBoardValueValidation();
  testPublicGridTablesAreImmutable();
  testCanonicalTransformStateAndStep();
  testCli();
  testTechniquesCli();
  testStableTechniqueGoldenCoverage();
  testExperimentalTechniqueDefinitions();
  testTechniqueDefinitionBoundaryIntegrity();
  testSolverFullHouse();
  testHiddenSinglePatternEvidence();
  testInvalidFilledBoardNotSolved();
  testVerifyStepAndWalkthrough();
  testAnalyzeSolveUsage();
  testIllegalCandidateStateBlocksContradictoryScan();
  testSolverNakedSingleWithForbiddenCandidate();
  testSolveCli();
  testExtendedSolveProfile();
  testExtendedGeneratorPolicyIncludesFallback();
  testFindTechniqueScenario();
  testRate();
  testHintAndSummaries();
  testExtendedRate();
  testAllowedTechniqueOrder();
  testExperimentalForcingDefaultsToFallback();
  testForcingBranchInvalidInternalStepDoesNotEscape();
  testSolverMaxStepsAndScenarioContradictionGuards();
  testFindSteps();
  testRateCli();
  testProfileCli();
  testCliAllowAndPreferValidation();
  testBatchSolveAndRateCli();
  testSchemas();
  testSchemaCli();
  testGenerationRequestAnalysisInvalid();
  testGenerationRequestAnalysisUnlikely();
  testGenerationRequestAnalysisBudgetWarning();
  testGeneratorRuntimeValidation();
  testSeededRandomNeverShufflesOutOfBounds();
  testDefaultTechniqueOrderPolicy();
  testGenerationAnalyzeCli();
  testGenerateInvalidRequest();
  testGenerateScoreTargetTolerance();
  testGenerateOneSmoke();
  testPuzzleMinimizerHonorsTimeout();
  testGenerateRejectsUnsolvedByRatingPolicy();
  testGenerateCli();
  testGenerateTechniqueConstraints();
  testGenerateRelaxation();
  testSearchSmoke();
  testSearchRejectsInvalidOptions();
  testSearchUsesStableSeedSequence();
  testSearchCliSummaryOnly();
  testSearchCliEventFilter();
  testSearchCliWriteCandidates();
  testSearchCliManifestSeedMatchesGeneratedCandidates();
  testSelectFromCandidates();
  testCliParsesInlineJsonArray();
  testSelectCli();
  testParallelSearchPlanCli();
  testMergeCandidatesCli();
  testCandidatePoolStatsAndDedupeApi();
  testCandidatePoolStatsAndDedupeCli();
  testPresentation();
  testSolveTextCli();
  testLockedCandidates();
  testNakedPair();
  testHiddenPair();
  testReferenceSmokeFixturesAlignWithDefinitionsAndGalaxyPolicy();
  testReferenceSmokeFixturesReachableViaExplicitOptions();
  testReferenceSmokeFixturesListedByTechniquesCli();
  testReferenceAuditScript();
  testReferenceRatingCorpus();
  testReferenceRatingAuditScript();
  testReferenceRatingCandidateSearchScript();
  testReferenceRatingCandidateSynthesisScript();
  testReferenceGapAuditScript();
  testReferenceCoverageAuditScript();
  testForcingBranchEvidenceAuditScript();
  testForcingSmokeEvidenceAuditScript();
  testBugGraphEvidenceAuditScript();
  testDirectTechniques();
  testNakedTriple();
  testHiddenTriple();
  testNakedQuad();
  testHiddenQuad();
  testXWing();
  testSwordfish();
  testFrankenSwordfish();
  testFinnedFrankenSwordfish();
  testFinnedFrankenJellyfish();
  testJellyfish();
  testLargerFish();
  testMutantFish();
  testFinnedXWing();
  testSashimiXWing();
  testFinnedSwordfish();
  testFinnedJellyfish();
  testSashimiSwordfish();
  testSashimiJellyfish();
  testAlignedPairExclusion();
  testExocet();
  testDoubleExocet();
  testPatternOverlay();
  testTridagons();
  testSkLoops();
  testAicExotic();
  testForcingNets();
  testDigitForcingChains();
  testNishioForcingChains();
  testCellForcingChains();
  testUnitForcingChains();
  testRegionForcingChainsAlias();
  testDynamicForcingChains();
  testDynamicForcingChainsPlus();
  testBowmansBingo();
  testBowmansBingoRealBoards();
  testXYWing();
  testXYZWing();
  testWXYZWing();
  testBigWings();
  testWWing();
  testChuteRemotePairs();
  testRemotePairs();
  testAlmostLockedPair();
  testAlmostLockedTriple();
  testAlmostLockedQuad();
  testAlsXZ();
  testAlsXYWing();
  testAicAls();
  testFireworks();
  testTwinnedXYChains();
  testSueDeCoq();
  testDeathBlossom();
  testSimpleColoring();
  testThreeDMedusa();
  testGroupedXCycles();
  testGroupedAic();
  testXChain();
  testMultiColors();
  testXYChain();
  testAicSameDigitEndpoint();
  testAicDifferentDigitEndpoint();
  testAicContinuousLoop();
  testAicDiscontinuousWeakLoop();
  testAicDiscontinuousStrongLoop();
  testReferenceChainEntryPoints();
  testSkyscraper();
  testTurbotFish();
  testEmptyRectangle();
  testUniqueRectangle();
  testUniqueRectangleType4();
  testUniqueRectangleType3NakedSet();
  testUniqueRectangleType3HiddenSet();
  testAvoidableRectangle();
  testRectangleElimination();
  testExtendedRectangle();
  testUniqueLoop();
  testHiddenUniqueRectangle();
  testAicUr();
  testBugPlusOne();
  testBugPlusTwo();
  testBugPlusN();
  testTwoStringKite();
  process.stdout.write('All tests passed\n');
}

run();
