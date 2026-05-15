import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  canonicalizeBoard,
  canonicalizePair,
  checkUniqueness,
  CLASSIC_STABLE_TECHNIQUE_ORDER,
  applyTransformToBoard,
  applyTransformToState,
  applyTransformToStep,
  analyzeCandidatePool,
  analyzeGenerationRequest,
  dedupeCandidates,
  formatStep,
  generateOne,
  getDefaultRatingPolicy,
  getPackageInfo,
  getJsonSchemas,
  getTechniqueDefinitions,
  normalizeState,
  nextStep,
  parsePuzzle,
  rate,
  replaySteps,
  invertTransform,
  search,
  selectFromCandidates,
  serializeBoard,
  validate,
  walkthrough,
} from '../src/index.js';
import { runCli } from '../src/cli/index.js';

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

function testParseAndSerialize(): void {
  const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
  const board = parsePuzzle(puzzle);
  assert.equal(board.length, 81);
  assert.equal(serializeBoard(board), puzzle);
}

function testPublicSourceImportGuard(): void {
  const sourceRoot = join(process.cwd(), 'src');
  const bannedPatterns = [
    /assets\//,
    /from\s+['"]cc['"]/,
  ];
  for (const filePath of listSourceFiles(sourceRoot)) {
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
  assert.equal(packageJson.version, '0.1.0');
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
  assert.equal(packageJson.files?.includes('scripts'), false);
  assert.ok(packageJson.keywords?.includes('sudoku'));
  assert.equal(packageJson.engines?.node, '>=20');
  assert.equal(typeof packageJson.devDependencies?.typescript, 'string');
  assert.equal(typeof packageJson.devDependencies?.['@types/node'], 'string');
  assert.equal(packageJson.scripts?.['pack:dry-run'], 'npm_config_cache=./.npm-cache npm pack --dry-run');
  assert.equal(packageJson.scripts?.prepack, 'npm run build');
  assert.equal(packageJson.scripts?.['examples:typecheck'], 'tsc -p tsconfig.examples.json --noEmit --pretty false');
  assert.equal(packageJson.scripts?.['smoke:cli'], 'npm run build && node scripts/smoke-cli.mjs');
  assert.ok(packageJson.scripts?.['smoke:dist']?.includes("import('./dist/src/index.js')"));
  assert.equal(packageJson.scripts?.['smoke:pack'], 'npm run build && node scripts/smoke-packed-package.mjs');
  assert.equal(packageJson.scripts?.verify, 'npm run typecheck && npm test && npm run examples:typecheck && npm run smoke:dist && npm run smoke:cli && npm run pack:dry-run && npm run smoke:pack');
  assert.deepEqual(getPackageInfo(), {
    name: '@sudoku-tools/classic9',
    version: packageJson.version,
  });
}

function testPublicRepoMaintenanceFiles(): void {
  for (const file of ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', '.gitignore', 'tsconfig.examples.json', 'scripts/smoke-cli.mjs', 'scripts/smoke-packed-package.mjs']) {
    assert.equal(existsSync(join(process.cwd(), file)), true, `${file} should exist`);
  }
  const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');
  assert.match(readme, /@sudoku-tools\/classic9/);
  assert.match(readme, /标准 9x9 数独工具库/);
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
  assert.ok(invalidChar.contradictions.some((message) => /Invalid character/.test(message)));
}

function testUniqueness(): void {
  const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
  const uniqueness = checkUniqueness(puzzle);
  assert.equal(uniqueness.uniqueSolution, true);
  assert.ok(uniqueness.firstSolution);
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
  }, { allowedTechniques: ['naked-single'] });
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
  assert.equal((helpResult.output as { version?: string }).version, '0.1.0');

  const versionResult = runCli(['version']);
  assert.equal(versionResult.exitCode, 0);
  assert.deepEqual(versionResult.output, {
    name: '@sudoku-tools/classic9',
    version: '0.1.0',
  });
}

function testTechniquesCli(): void {
  const result = runCli(['techniques']);
  assert.equal(result.exitCode, 0);
  assert.ok(Array.isArray(result.output));
  assert.ok((result.output as Array<{ id?: string }>).some((item) => item.id === 'full-house'));
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
    .map((definition) => definition.id);
  for (const id of [
    'forcing-nets',
    'digit-forcing-chains',
    'nishio-forcing-chains',
    'cell-forcing-chains',
    'unit-forcing-chains',
    'bowmans-bingo',
  ]) {
    assert.ok(experimentalIds.includes(id as never), `${id} should be experimental`);
  }

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
  assert.equal(nextStep(patternState, { allowedTechniques: ['pattern-overlay'] })?.technique, 'pattern-overlay');

  const forcingState = buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  );
  assert.equal(nextStep(forcingState)?.technique === 'forcing-nets', false);
  assert.equal(nextStep(forcingState, { allowedTechniques: ['forcing-nets'] })?.technique, 'forcing-nets');
}

function testSolverFullHouse(): void {
  const almostSolved = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';
  const analysis = walkthrough(almostSolved);
  assert.equal(analysis.solved, true);
  assert.equal(analysis.steps.length, 1);
  assert.equal(analysis.steps[0]?.technique, 'full-house');
  const replayed = replaySteps(almostSolved, analysis.steps);
  assert.equal(serializeBoard(replayed), '534678912672195348198342567859761423426853791713924856961537284287419635345286179');
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
  const allowedKeepsDefaultOrder = nextStep(state, { allowedTechniques: ['naked-triple', 'naked-pair'] });
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

function testRateCli(): void {
  const almostSolved = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';
  const result = runCli(['rate', almostSolved]);
  assert.equal(result.exitCode, 0);
  assert.equal(typeof result.output, 'object');
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
  assert.ok(JSON.stringify(schemas.solveStep).includes('"branches"'));
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
  const analysis = analyzeGenerationRequest({
    constraints: {
      score: { min: 100, max: 50 },
    },
  });
  assert.equal(analysis.status, 'invalid');
  assert.ok(analysis.errors.some((error) => error.code === 'score-min-greater-than-max'));
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

function testDefaultTechniqueOrderPolicy(): void {
  const stableDefinitions = getTechniqueDefinitions()
    .filter((definition) => definition.stability === 'stable')
    .map((definition) => definition.id);
  const policy = getDefaultRatingPolicy();
  assert.deepEqual(policy.techniqueOrder, CLASSIC_STABLE_TECHNIQUE_ORDER);
  assert.deepEqual(policy.techniqueOrder, stableDefinitions);
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
    assert.equal(result.puzzle.puzzle.length, 81);
    assert.equal(result.puzzle.solution.length, 81);
    assert.ok(result.puzzle.clueCount >= 35);
    assert.ok(result.puzzle.clueCount <= 45);
    const uniqueness = checkUniqueness(result.puzzle.puzzle);
    assert.equal(uniqueness.uniqueSolution, true);
  }
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
}

function testSearchSmoke(): void {
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

  const manifestSummaryResult = runCli(['manifest-summary', manifestPath]);
  assert.equal(manifestSummaryResult.exitCode, 0);
  assert.equal((manifestSummaryResult.output as { manifests?: number }).manifests, 1);
  assert.equal((manifestSummaryResult.output as { runs?: number }).runs, 2);
  assert.equal((manifestSummaryResult.output as { accepted?: number }).accepted, 2);

  const mismatchResult = runCli([
    'search',
    '{"seed":1,"maxResults":1,"scoreBucketSize":100,"minimality":"strict","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":2,"maxElapsedMs":3000}}',
    '--summary-only',
    '--resume-manifest',
    manifestPath,
  ]);
  assert.equal(mismatchResult.exitCode, 1);
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
  const plan = result.output as Array<{ seedStart: number; seedEndExclusive: number; command: string }>;
  assert.equal(plan.length, 3);
  assert.equal(plan[0]?.seedStart, 10);
  assert.equal(plan[0]?.seedEndExclusive, 15);
  assert.equal(plan[1]?.seedStart, 15);
  assert.match(plan[0]?.command ?? '', /--write-candidates/);
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
  const outputPath = join(tmpDir, 'merged-candidates.json');
  writeFileSync(firstPath, JSON.stringify([first, first]), 'utf8');
  writeFileSync(secondPath, JSON.stringify([second]), 'utf8');

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

  const deduped = dedupeCandidates([first, first, second], { key: 'canonical' });
  assert.equal(deduped.candidates.length, 2);
  assert.equal(deduped.rejected.length, 1);
  assert.equal(deduped.diagnostics.removed, 1);
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
  const outputPath = join(tmpDir, 'deduped-candidates.json');
  const rejectedPath = join(tmpDir, 'deduped-rejected.json');
  writeFileSync(candidatesPath, JSON.stringify([first, first, second]), 'utf8');

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

  const forcingStep = nextStep(buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  ), { allowedTechniques: ['forcing-nets'] });
  assert.ok(forcingStep);
  const forcingText = formatStep(forcingStep, {
    locale: 'zh-CN',
    style: 'teaching',
  });
  assert.match(forcingText, /分支：共/);
  assert.match(forcingText, /摘要|矛盾|穷尽/);

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
  }, { allowedTechniques: ['locked-candidates'] });
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
  }, { allowedTechniques: ['naked-pair'] });
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
  }, { allowedTechniques: ['hidden-pair'] });
  assert.equal(step?.technique, 'hidden-pair');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 3));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 1 && action.digit === 4));
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
  }, { allowedTechniques: ['naked-triple'] });
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
  }, { allowedTechniques: ['hidden-triple'] });
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
  }, { allowedTechniques: ['naked-quad'] });
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
  }, { allowedTechniques: ['hidden-quad'] });
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
  }, { allowedTechniques: ['x-wing'] });
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
  ]), { allowedTechniques: ['swordfish'] });
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
  ]), { allowedTechniques: ['franken-swordfish'] });
  assert.equal(step?.technique, 'franken-swordfish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 27 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 46 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 47 && action.digit === 1));
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
  ]), { allowedTechniques: ['jellyfish'] });
  assert.equal(step?.technique, 'jellyfish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 36 && action.digit === 1));
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
  }, { allowedTechniques: ['finned-x-wing'] });
  assert.equal(step?.technique, 'finned-x-wing');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 12 && action.digit === 1));
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
  ]), { allowedTechniques: ['finned-swordfish'] });
  assert.equal(step?.technique, 'finned-swordfish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 9 && action.digit === 1));
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
  ]), { allowedTechniques: ['finned-jellyfish'] });
  assert.equal(step?.technique, 'finned-jellyfish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 9 && action.digit === 1));
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
  ]), { allowedTechniques: ['sashimi-swordfish'] });
  assert.equal(step?.technique, 'sashimi-swordfish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 9 && action.digit === 1));
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
  ]), { allowedTechniques: ['sashimi-jellyfish'] });
  assert.equal(step?.technique, 'sashimi-jellyfish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 9 && action.digit === 1));
}

function testAlignedPairExclusion(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2, 3]],
    [1, [1, 2]],
    [2, [1, 2]],
  ]), { allowedTechniques: ['aligned-pair-exclusion'] });
  assert.equal(step?.technique, 'aligned-pair-exclusion');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 2));
  assert.equal(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 3), false);
  assert.equal(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 1), false);
}

function testExocet(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [1, [2, 3]],
    [15, [1, 2, 3, 4]],
    [21, [1, 2, 3, 4]],
  ]), { allowedTechniques: ['exocet'] });
  assert.equal(step?.technique, 'exocet');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 15 && action.digit === 4));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 21 && action.digit === 4));
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
  ]), { allowedTechniques: ['double-exocet'] });
  assert.equal(step?.technique, 'double-exocet');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 15 && action.digit === 4));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 21 && action.digit === 4));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 8 && action.digit === 4));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 19 && action.digit === 4));
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
  ]), { allowedTechniques: ['pattern-overlay'] });
  assert.equal(step?.technique, 'pattern-overlay');
  assert.ok(step?.actions.some((action) => action.type === 'place' && action.cell === 0 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'place' && action.cell === 80 && action.digit === 1));
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
  ]), { allowedTechniques: ['tridagons'] });
  assert.equal(step?.technique, 'tridagons');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 2));
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
  ]), { allowedTechniques: ['sk-loops'] });
  assert.equal(step?.technique, 'sk-loops');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 6 && action.digit === 1));
}

function testAicExotic(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [1, [2, 3]],
    [10, [1, 3]],
    [9, [1, 8]],
  ]), { allowedTechniques: ['aic-exotic'] });
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
  ), { allowedTechniques: ['forcing-nets'] });
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
  ), { allowedTechniques: ['digit-forcing-chains'] });
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
  ), { allowedTechniques: ['nishio-forcing-chains'] });
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
  ), { allowedTechniques: ['cell-forcing-chains'] });
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
  ), { allowedTechniques: ['unit-forcing-chains'] });
  assert.equal(step?.technique, 'unit-forcing-chains');
  assert.ok(step?.actions.some((action) => action.type === 'place' && action.cell === 79 && action.digit === 7));
  assertForcingBranches(step, 2);
}

function testBowmansBingo(): void {
  const step = nextStep(buildTrustedState(
    '534678912672195348198342567859761423426853791713924856961537284287419600345286100',
    [
      [79, [7, 9]],
      [80, [8, 9]],
    ],
  ), { allowedTechniques: ['bowmans-bingo'] });
  assert.equal(step?.technique, 'bowmans-bingo');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 79 && action.digit === 9));
  assertForcingBranches(step, 1);
}

function testBowmansBingoRealBoards(): void {
  const sudokuwikiStep = nextStep(
    '006000400000050070070100030800079006060301050700620004090007020030060000008000900',
    { allowedTechniques: ['bowmans-bingo'] },
  );
  assert.equal(sudokuwikiStep?.technique, 'bowmans-bingo');
  assert.ok(sudokuwikiStep?.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 8));
  assertForcingBranches(sudokuwikiStep, 1);
  assert.equal(sudokuwikiStep?.evidence.branches?.[0]?.contradictionAt?.kind, 'cell-empty');

  const taupierStep = nextStep(
    '302004605005326407604590032030400050007000904040001023000040509400805200000000348',
    { allowedTechniques: ['bowmans-bingo'] },
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
  }, { allowedTechniques: ['xy-wing'] });
  assert.equal(step?.technique, 'xy-wing');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 10 && action.digit === 3));
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
  }, { allowedTechniques: ['xyz-wing'] });
  assert.equal(step?.technique, 'xyz-wing');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 10 && action.digit === 3));
}

function testWXYZWing(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [1, [1, 3]],
    [9, [1, 4]],
    [10, [2, 3, 4]],
    [2, [1, 8]],
  ]), { allowedTechniques: ['wxyz-wing'] });
  assert.equal(step?.technique, 'wxyz-wing');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 2 && action.digit === 1));
}

function testWWing(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [30, [1, 2]],
    [4, [1, 8]],
    [31, [1, 8]],
    [3, [2, 8]],
    [27, [2, 8]],
  ]), { allowedTechniques: ['w-wing'] });
  assert.equal(step?.technique, 'w-wing');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 2));
}

function testChuteRemotePairs(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [13, [1, 2]],
    [4, [2]],
  ]), { allowedTechniques: ['chute-remote-pairs'] });
  assert.equal(step?.technique, 'chute-remote-pairs');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 2));
  assert.ok((step?.evidence.cells ?? []).some((cell) => cell.role === 'link' && cell.cell === 24));
}

function testAlmostLockedPair(): void {
  const step = nextStep(buildCandidateMaskState([
    [3, [1, 2]],
    [4, [1, 8]],
    [9, [1, 3]],
  ]), { allowedTechniques: ['almost-locked-pair'] });
  assert.equal(step?.technique, 'almost-locked-pair');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 1));
}

function testAlmostLockedTriple(): void {
  const step = nextStep(buildCandidateMaskState([
    [3, [1, 2]],
    [4, [2, 3]],
    [5, [1, 8]],
    [9, [1, 4]],
    [10, [3, 5]],
  ]), { allowedTechniques: ['almost-locked-triple'] });
  assert.equal(step?.technique, 'almost-locked-triple');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 5 && action.digit === 1));
}

function testAlsXZ(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [1, [1, 3]],
    [9, [1, 4]],
    [14, [2, 4]],
    [3, [2, 8]],
  ]), { allowedTechniques: ['als-xz'] });
  assert.equal(step?.technique, 'als-xz');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 2));
}

function testAlsXYWing(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [9, [1, 3]],
    [1, [2, 3]],
    [10, [3, 8]],
  ]), { allowedTechniques: ['als-xy-wing'] });
  assert.equal(step?.technique, 'als-xy-wing');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 10 && action.digit === 3));
}

function testAicAls(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2, 3]],
    [1, [2, 3]],
    [9, [1, 3]],
    [10, [3]],
  ]), { allowedTechniques: ['aic-als'] });
  assert.equal(step?.technique, 'aic-als');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 10 && action.digit === 3));
  assert.ok((step?.evidence.links?.length ?? 0) >= 2);
}

function testFireworks(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2, 3, 4]],
    [3, [1, 2, 3, 5]],
    [27, [1, 2, 3, 6]],
  ]), { allowedTechniques: ['fireworks'] });
  assert.equal(step?.technique, 'fireworks');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 4));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 5));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 27 && action.digit === 6));
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
  ]), { allowedTechniques: ['twinned-xy-chains'] });
  assert.equal(step?.technique, 'twinned-xy-chains');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 18 && action.digit === 1));
  assert.equal((step?.evidence.cells ?? []).filter((cell) => cell.role === 'reason').length, 6);
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
  ]), { allowedTechniques: ['sue-de-coq'] });
  assert.equal(step?.technique, 'sue-de-coq');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 6 && action.digit === 5));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 18 && action.digit === 6));
}

function testDeathBlossom(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2, 3]],
    [1, [1, 4]],
    [9, [2, 4]],
    [10, [3, 4]],
    [2, [4]],
  ]), { allowedTechniques: ['death-blossom'] });
  assert.equal(step?.technique, 'death-blossom');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 2 && action.digit === 4));
}

function testSimpleColoring(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [18, [1, 8]],
    [10, [1, 8]],
  ]), { allowedTechniques: ['simple-coloring'] });
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
  ]), { allowedTechniques: ['x-chain'] });
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
  ]), { allowedTechniques: ['multi-colors'] });
  assert.equal(step?.technique, 'multi-colors');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 20 && action.digit === 1));
  assert.ok((step?.evidence.links?.length ?? 0) >= 3);
}

function testThreeDMedusa(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2, 3]],
    [9, [1, 2]],
  ]), { allowedTechniques: ['three-d-medusa'] });
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
  ]), { allowedTechniques: ['grouped-x-cycles'] });
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
  ]), { allowedTechniques: ['grouped-aic'] });
  assert.equal(step?.technique, 'grouped-aic');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 1 && action.digit === 4));
  assert.match(step?.evidence.note ?? '', /组/);
  assert.ok((step?.evidence.links?.length ?? 0) >= 5);
}

function testXYChain(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [9, [2, 3]],
    [10, [1, 3]],
    [1, [1, 8]],
  ]), { allowedTechniques: ['xy-chain'] });
  assert.equal(step?.technique, 'xy-chain');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 1 && action.digit === 1));
  assert.ok((step?.evidence.links?.length ?? 0) >= 3);
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
  ]), { allowedTechniques: ['aic'] });
  assert.equal(step?.technique, 'aic');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 4 && action.digit === 4));
  assert.ok((step?.evidence.links?.length ?? 0) >= 3);
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
  ]), { allowedTechniques: ['aic'] });
  assert.equal(step?.technique, 'aic');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 26 && action.digit === 4));
  assert.equal(
    (step?.evidence.cells ?? []).some((cell) => cell.role === 'reason' && cell.cell === 26 && cell.digit === 4),
    false,
  );
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
  }, { allowedTechniques: ['skyscraper'] });
  assert.equal(step?.technique, 'skyscraper');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 1));
}

function testTurbotFish(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [9, [1, 8]],
    [10, [1, 8]],
    [19, [1, 8]],
    [2, [1, 8]],
  ]), { allowedTechniques: ['turbot-fish'] });
  assert.equal(step?.technique, 'turbot-fish');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.digit === 1));
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
  ]), { allowedTechniques: ['empty-rectangle'] });
  assert.equal(step?.technique, 'empty-rectangle');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 36 && action.digit === 1));
}

function testUniqueRectangle(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [3, [1, 2]],
    [9, [1, 2]],
    [12, [1, 2, 3]],
  ]), { allowedTechniques: ['unique-rectangle'] });
  assert.equal(step?.technique, 'unique-rectangle');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 12 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 12 && action.digit === 2));
}

function testAvoidableRectangle(): void {
  const board = parsePuzzle('000100000200100000000000000000000000000000000000000000000000000000000000000000000');
  const candidateMasks = new Array<number>(81).fill(0);
  candidateMasks[0] = (1 << (1 - 1)) | (1 << (2 - 1));
  const step = nextStep({ board, candidateMasks }, { allowedTechniques: ['avoidable-rectangle'] });
  assert.equal(step?.technique, 'avoidable-rectangle');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 0 && action.digit === 2));
}

function testRectangleElimination(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 8]],
    [3, [1, 8]],
    [27, [1, 8]],
    [30, [1, 8]],
    [31, [1, 8]],
  ]), { allowedTechniques: ['rectangle-elimination'] });
  assert.equal(step?.technique, 'rectangle-elimination');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 27 && action.digit === 1));
}

function testExtendedRectangle(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [3, [1, 2]],
    [6, [1, 2]],
    [9, [1, 2]],
    [12, [1, 2]],
    [15, [1, 2, 3]],
  ]), { allowedTechniques: ['extended-rectangle'] });
  assert.equal(step?.technique, 'extended-rectangle');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 15 && action.digit === 1));
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 15 && action.digit === 2));
}

function testHiddenUniqueRectangle(): void {
  const step = nextStep(buildExactCandidateState([
    [0, [1, 2]],
    [3, [1, 2]],
    [9, [1, 2]],
    [12, [1, 2, 3]],
  ]), { allowedTechniques: ['hidden-unique-rectangle'] });
  assert.equal(step?.technique, 'hidden-unique-rectangle');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.digit === 2));
}

function testAicUr(): void {
  const step = nextStep(buildCandidateMaskState([
    [0, [1, 2]],
    [3, [1, 2]],
    [9, [1, 2]],
    [12, [1, 2, 3]],
  ]), { allowedTechniques: ['aic-ur'] });
  assert.equal(step?.technique, 'aic-ur');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 3 && action.digit === 2));
  assert.ok((step?.evidence.cells ?? []).some((cell) => cell.role === 'link' && cell.cell === 12));
}

function testBugPlusOne(): void {
  const overrides: Array<[number, number[]]> = [];
  for (let cell = 0; cell < 81; cell += 1) {
    overrides.push([cell, cell === 0 ? [1, 2, 3] : [1, 2]]);
  }
  const step = nextStep(buildExactCandidateState(overrides), { allowedTechniques: ['bug-plus-one'] });
  assert.equal(step?.technique, 'bug-plus-one');
  assert.ok(step?.actions.some((action) => action.type === 'place' && action.cell === 0));
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
  }, { allowedTechniques: ['two-string-kite'] });
  assert.equal(step?.technique, 'two-string-kite');
  assert.ok(step?.actions.some((action) => action.type === 'eliminate' && action.cell === 32 && action.digit === 1));
}

function run(): void {
  testPublicSourceImportGuard();
  testPackageExportsDist();
  testPublicRepoMaintenanceFiles();
  testParseAndSerialize();
  testForbiddenCandidates();
  testTrustedCandidateState();
  testValidationConflict();
  testUniqueness();
  testCanonicalize();
  testCanonicalTransformStateAndStep();
  testCli();
  testTechniquesCli();
  testStableTechniqueGoldenCoverage();
  testExperimentalTechniqueDefinitions();
  testSolverFullHouse();
  testSolverNakedSingleWithForbiddenCandidate();
  testSolveCli();
  testRate();
  testAllowedTechniqueOrder();
  testRateCli();
  testSchemas();
  testSchemaCli();
  testGenerationRequestAnalysisInvalid();
  testGenerationRequestAnalysisUnlikely();
  testGenerationRequestAnalysisBudgetWarning();
  testGeneratorRuntimeValidation();
  testDefaultTechniqueOrderPolicy();
  testGenerationAnalyzeCli();
  testGenerateInvalidRequest();
  testGenerateScoreTargetTolerance();
  testGenerateOneSmoke();
  testGenerateCli();
  testGenerateTechniqueConstraints();
  testGenerateRelaxation();
  testSearchSmoke();
  testSearchCliSummaryOnly();
  testSearchCliEventFilter();
  testSearchCliWriteCandidates();
  testSelectFromCandidates();
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
  testNakedTriple();
  testHiddenTriple();
  testNakedQuad();
  testHiddenQuad();
  testXWing();
  testSwordfish();
  testFrankenSwordfish();
  testJellyfish();
  testFinnedXWing();
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
  testBowmansBingo();
  testBowmansBingoRealBoards();
  testXYWing();
  testXYZWing();
  testWXYZWing();
  testWWing();
  testChuteRemotePairs();
  testAlmostLockedPair();
  testAlmostLockedTriple();
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
  testSkyscraper();
  testTurbotFish();
  testEmptyRectangle();
  testUniqueRectangle();
  testAvoidableRectangle();
  testRectangleElimination();
  testExtendedRectangle();
  testHiddenUniqueRectangle();
  testAicUr();
  testBugPlusOne();
  testTwoStringKite();
  process.stdout.write('All tests passed\n');
}

run();
