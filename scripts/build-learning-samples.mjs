#!/usr/bin/env node
import { createRequire } from 'node:module';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';

import {
  analyzeSolve,
  buildSolveOptionsFromRatingPolicy,
  checkUniqueness,
  findSteps,
  formatStep,
  getRatingPolicy,
  getTechniqueDefinitions,
  parsePuzzle,
  replaySteps,
  serializeBoard,
  verifyWalkthrough,
} from '../dist/src/index.js';

const require = createRequire(import.meta.url);
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const definitions = getTechniqueDefinitions();
const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
const allTechniqueIds = definitions.map((definition) => definition.id);
const galaxyPolicy = getRatingPolicy('classic-galaxy');
const galaxyOptions = buildSolveOptionsFromRatingPolicy(galaxyPolicy);
const galaxyPrimary = [...galaxyPolicy.techniqueOrder];
const galaxyFallback = [...(galaxyPolicy.fallbackTechniques ?? [])];
const galaxyTechniqueSet = new Set([...(galaxyOptions.allowedTechniques ?? []), ...galaxyPrimary, ...galaxyFallback]);
const missingFromGalaxy = allTechniqueIds.filter((technique) => !galaxyTechniqueSet.has(technique));

const options = parseArgs(process.argv.slice(2));
if (missingFromGalaxy.length > 0 && options.progress) {
  process.stderr.write(`classic-galaxy 未包含这些已实现技巧，默认不纳入本轮目标；如需审计请显式 --technique：${missingFromGalaxy.join(', ')}\n`);
}
const targetTechniqueIds = options.techniques.length > 0
  ? options.techniques
  : allTechniqueIds.filter((technique) => galaxyTechniqueSet.has(technique));
const outputPaths = buildOutputPaths(options);
mkdirSync(outputPaths.outDir, { recursive: true });

const rows = loadPuzzleRows(options.inputPath)
  .filter((row) => !options.excludePuzzles.includes(row.id))
  .slice(0, options.limit ?? Number.POSITIVE_INFINITY);
if (rows.length === 0) {
  fail(`没有从题集读取到题目：${options.inputPath}`);
}
const rowsById = new Map(rows.map((row) => [row.id, row]));
const startedAt = performance.now();
const state = loadInitialState();

if (options.skipBaseline) {
  progress(`stage=baseline skipped puzzles=${rows.length}`);
} else {
  runBaselineStage();
}
runPriorityStage();
writeOutputs();

if (options.json) {
  process.stdout.write(`${JSON.stringify({
    summary: state.report.summary,
    outputs: outputPaths,
  }, null, 2)}\n`);
} else {
  process.stdout.write([
    '',
    `learning samples built: ${state.samples.length} samples`,
    `covered techniques: ${state.report.summary.coveredTechniques}/${state.report.summary.targetTechniques}`,
    `full techniques: ${state.report.summary.fullTechniques}/${state.report.summary.targetTechniques}`,
    `checkpoint: ${outputPaths.checkpointPath}`,
    `audit: ${outputPaths.auditPath}`,
    `samples: ${outputPaths.samplesPath}`,
    `report: ${outputPaths.reportPath}`,
  ].join('\n'));
  process.stdout.write('\n');
}

function runBaselineStage() {
  progress(`stage=baseline puzzles=${rows.length} profile=classic-galaxy.v1`);
  for (const [index, row] of rows.entries()) {
    if (state.auditRows.some((analysis) => analysis.analysisId === analysisId('galaxy-baseline', row.id, null))) {
      continue;
    }
    const analysis = runAnalysis(row, buildBaselineOptions(), 'galaxy-baseline');
    state.auditRows.push(analysis);
    flush(`baseline ${index + 1}/${rows.length} ${row.id} solved=${analysis.solved} score=${analysis.score} hardest=${analysis.hardestTechnique ?? '-'} steps=${analysis.stepCount} elapsed=${analysis.elapsedMs}ms`);
  }
}

function runPriorityStage() {
  progress('stage=priority-supplement');
  for (const technique of techniqueOrderHardestFirst()) {
    while (selectedCount(technique) < options.samplesPerTechnique) {
      const before = selectedCount(technique);
      const attempts = ensurePriorityAttempts(technique);
      attempts.stoppedReason = null;
      const sortedRows = hardestRowsFirst();
      const started = performance.now();
      for (const row of sortedRows) {
        if (selectedCount(technique) >= options.samplesPerTechnique) {
          attempts.stoppedReason = 'target-filled';
          break;
        }
        if (attempts.attemptedPuzzles >= options.maxPriorityPuzzlesPerTechnique) {
          attempts.stoppedReason = 'max-priority-puzzles-per-technique';
          break;
        }
        if (performance.now() - started > options.maxPriorityElapsedMsPerTechnique) {
          attempts.stoppedReason = 'max-priority-elapsed-ms-per-technique';
          break;
        }
        if (state.auditRows.some((analysis) => analysis.analysisId === analysisId('target-technique-first', row.id, technique))) {
          continue;
        }
        attempts.attemptedPuzzles += 1;
        const analysis = runAnalysis(row, buildPriorityOptions(technique), 'target-technique-first', technique);
        state.auditRows.push(analysis);
        if (analysis.error) {
          attempts.errors += 1;
        }
        const hit = analysis.steps.some((step) => step.technique === technique);
        if (hit) {
          attempts.hits += 1;
        }
        rebuildSelections();
        flush(`priority ${technique} ${attempts.attemptedPuzzles}/${options.maxPriorityPuzzlesPerTechnique} ${row.id} hit=${hit} selected=${selectedCount(technique)}/${options.samplesPerTechnique} score=${baselineDifficulty(row.id).score} elapsed=${analysis.elapsedMs}ms`);
        if (selectedCount(technique) >= options.samplesPerTechnique) {
          break;
        }
      }
      attempts.elapsedMs += Math.round(performance.now() - started);
      attempts.stoppedReason ??= selectedCount(technique) > before ? 'made-progress' : 'exhausted';
      rebuildSelections();
      writeOutputs();
      if (selectedCount(technique) === before) {
        break;
      }
    }
  }
}

function rebuildSelections() {
  const candidatesByTechnique = collectAllCandidates();
  const selected = [];
  const selectedKeys = new Set();
  const puzzleUsage = new Map();
  const simpleAlternativeCache = new Map();

  for (const technique of techniqueOrderHardestFirst()) {
    while (selected.filter((sample) => sample.primaryTechnique === technique).length < options.samplesPerTechnique) {
      const candidate = chooseCandidate(
        technique,
        candidatesByTechnique.get(technique) ?? [],
        selectedKeys,
        puzzleUsage,
        simpleAlternativeCache,
      );
      if (!candidate) {
        break;
      }
      const rank = selected.filter((sample) => sample.primaryTechnique === technique).length + 1;
      const useCount = puzzleUsage.get(candidate.puzzleId) ?? 0;
      candidate.selectionRank = rank;
      candidate.selectionScore = scoreCandidate(candidate, technique, puzzleUsage, simpleAlternativeCache);
      candidate.sharedPuzzle = useCount > 0;
      candidate.duplicateUseCount = useCount;
      candidate.simpleAlternativeTechniques = findSimpleAlternatives(candidate, simpleAlternativeCache)
        .map((step) => step.technique);
      selected.push(candidate);
      selectedKeys.add(candidate.sampleKey);
      puzzleUsage.set(candidate.puzzleId, useCount + 1);
    }
  }

  state.samples = selected.map((sample) => enrichSample(sample));
  state.report = buildReport(candidatesByTechnique, puzzleUsage);
}

function collectAllCandidates() {
  const candidatesByTechnique = new Map(targetTechniqueIds.map((technique) => [technique, []]));
  for (const analysis of state.auditRows) {
    if (analysis.error) {
      continue;
    }
    for (const [stepIndex, step] of analysis.steps.entries()) {
      if (analysis.targetTechnique && step.technique !== analysis.targetTechnique) {
        continue;
      }
      const candidates = candidatesByTechnique.get(step.technique);
      if (!candidates) {
        continue;
      }
      candidates.push(buildCandidate(analysis, step, stepIndex));
    }
  }
  return candidatesByTechnique;
}

function chooseCandidate(technique, candidates, selectedKeys, puzzleUsage, simpleAlternativeCache) {
  const available = candidates.filter((candidate) =>
    !selectedKeys.has(candidate.sampleKey)
    && (puzzleUsage.get(candidate.puzzleId) ?? 0) < options.maxSamplesPerPuzzle);
  if (available.length === 0) {
    return null;
  }
  return available
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(candidate, technique, puzzleUsage, simpleAlternativeCache),
    }))
    .sort((left, right) => left.score - right.score || compareCandidateStable(left.candidate, right.candidate))[0]?.candidate ?? null;
}

function scoreCandidate(candidate, technique, puzzleUsage, simpleAlternativeCache) {
  const targetScore = definitionsById.get(technique)?.defaultScore ?? candidate.targetStep.score;
  const validationPenalty = candidate.validation.actionIssues.length > 0 || candidate.validation.replayError ? 100000 : 0;
  const simpleAlternatives = findSimpleAlternatives(candidate, simpleAlternativeCache);
  const simpleAlternativePenalty = simpleAlternatives.length * 1800;
  const solutionPenalty = candidate.solution ? 0 : 250;
  const priorityPenalty = candidate.mode === 'galaxy-baseline' ? 0 : 100;
  const puzzleUse = puzzleUsage.get(candidate.puzzleId) ?? 0;
  const difficultyBonus = Math.min(15000, Math.floor(baselineDifficulty(candidate.puzzleId).sortScore / 200));
  return validationPenalty
    + simpleAlternativePenalty
    + solutionPenalty
    + priorityPenalty
    + puzzleUse * 2500
    + candidate.hitStepNumber * 80
    + candidate.targetStep.actions.length * 30
    + (candidate.targetStep.evidence.cells?.length ?? 0) * 4
    + (candidate.targetStep.evidence.houses?.length ?? 0) * 3
    + (candidate.targetStep.evidence.links?.length ?? 0) * 8
    + (candidate.targetStep.evidence.branches?.length ?? 0) * 30
    - targetScore * 2
    - difficultyBonus;
}

function findSimpleAlternatives(candidate, cache) {
  const cacheKey = `${candidate.analysisId}:${candidate.hitStepNumber}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  const targetScore = definitionsById.get(candidate.primaryTechnique)?.defaultScore ?? candidate.targetStep.score;
  const simplerTechniques = galaxyPrimary.filter((technique) => {
    if (technique === candidate.primaryTechnique) {
      return false;
    }
    const definition = definitionsById.get(technique);
    if (!definition || definition.stability !== 'stable') {
      return false;
    }
    // This is only a "simple alternative" ranking hint. Avoid forcing/pattern
    // scans here; those are not "特别简单" and can be expensive or experimental.
    if (definition.family === 'forcing' || definition.family === 'pattern') {
      return false;
    }
    return definition.defaultScore < targetScore;
  });
  if (simplerTechniques.length === 0) {
    cache.set(cacheKey, []);
    return [];
  }
  const row = rowsById.get(candidate.puzzleId);
  const analysis = state.auditRows.find((item) => item.analysisId === candidate.analysisId);
  if (!row || !analysis) {
    cache.set(cacheKey, []);
    return [];
  }
  let verified;
  try {
    const prefix = analysis.steps.slice(0, Math.max(0, candidate.hitStepNumber - 1));
    verified = verifyWalkthrough(row.puzzleBoard, prefix, { mode: 'action' });
  } catch {
    cache.set(cacheKey, []);
    return [];
  }
  if (!verified.valid && verified.firstInvalidStepIndex !== null) {
    cache.set(cacheKey, []);
    return [];
  }
  let found = [];
  for (const technique of simplerTechniques) {
    try {
      const result = findSteps({
        board: verified.finalBoard,
        candidateMasks: verified.finalCandidates,
      }, {
        allowedTechniques: [technique],
        preferredTechniques: [technique],
        fallbackTechniques: [],
        limit: 1,
        sort: 'pipeline',
      });
      found.push(...result.steps);
      if (found.length >= 5) {
        break;
      }
    } catch {
      // Alternative detection is a ranking hint only. A detector failure must
      // not invalidate the sample run or lose checkpoint progress.
    }
  }
  cache.set(cacheKey, found);
  return found;
}

function buildCandidate(analysis, step, stepIndex) {
  const definition = definitionsById.get(step.technique);
  const stepsBefore = analysis.steps.slice(0, stepIndex);
  const techniqueCountsBefore = {};
  for (const beforeStep of stepsBefore) {
    techniqueCountsBefore[beforeStep.technique] = (techniqueCountsBefore[beforeStep.technique] ?? 0) + 1;
  }
  return {
    sampleKey: `${step.technique}:${analysis.analysisId}:${stepIndex + 1}`,
    analysisId: analysis.analysisId,
    mode: analysis.mode,
    primaryTechnique: step.technique,
    technique: {
      id: step.technique,
      nameZh: definition?.nameZh ?? step.technique,
      nameEn: definition?.nameEn ?? step.technique,
      family: definition?.family ?? 'unknown',
      stability: definition?.stability ?? 'experimental',
      defaultScore: definition?.defaultScore ?? step.score,
      aliases: definition?.aliases ?? [],
      seDifficulty: definition?.seDifficulty ?? null,
      seStatus: definition?.seStatus ?? null,
    },
    techniqueNameZh: definition?.nameZh ?? step.technique,
    techniqueNameEn: definition?.nameEn ?? step.technique,
    family: definition?.family ?? 'unknown',
    stability: definition?.stability ?? 'experimental',
    defaultScore: definition?.defaultScore ?? step.score,
    puzzleRef: {
      source: analysis.source,
      id: analysis.puzzleId,
      sourceIndex: analysis.sourceIndex,
      difficulty: analysis.difficulty,
    },
    puzzleId: analysis.puzzleId,
    source: analysis.source,
    sourceIndex: analysis.sourceIndex,
    difficulty: analysis.difficulty,
    puzzle: analysis.puzzle,
    solution: analysis.solution,
    profile: 'classic-galaxy.v1',
    profileDetails: {
      id: 'classic-galaxy',
      version: galaxyPolicy.version,
      mode: analysis.mode === 'galaxy-baseline' ? 'galaxy-baseline' : 'target-first',
      fallbackMode: analysis.mode === 'galaxy-baseline' ? 'galaxy' : options.fallbackMode,
      promotedFallbackTarget: galaxyFallback.includes(step.technique) && analysis.mode === 'target-technique-first',
    },
    hitStepNumber: stepIndex + 1,
    puzzleScore: analysis.score,
    baselineDifficultyScore: baselineDifficulty(analysis.puzzleId).sortScore,
    puzzleHardestTechnique: analysis.hardestTechnique,
    puzzleStepCount: analysis.stepCount,
    targetStep: step,
    stepsBeforeSummary: {
      count: stepsBefore.length,
      techniqueCounts: techniqueCountsBefore,
      lastSteps: stepsBefore.slice(-options.maxPreludeSteps).map((beforeStep, index) => ({
        stepNumber: stepsBefore.length - Math.min(options.maxPreludeSteps, stepsBefore.length) + index + 1,
        technique: beforeStep.technique,
        textZh: safeFormatStep(beforeStep, {
          locale: 'zh-CN',
          style: 'short',
          stepNumber: stepsBefore.length - Math.min(options.maxPreludeSteps, stepsBefore.length) + index + 1,
        }),
      })),
    },
    teachingTextZh: buildTeachingText(step, stepIndex),
    validation: analysis.validation,
    selectionRank: 0,
    selectionScore: null,
    sharedPuzzle: false,
    duplicateUseCount: 0,
    simpleAlternativeTechniques: [],
  };
}

function enrichSample(sample) {
  const row = rowsById.get(sample.puzzleId);
  const analysis = state.auditRows.find((item) => item.analysisId === sample.analysisId);
  const prefixAndTarget = analysis?.steps.slice(0, sample.hitStepNumber) ?? [];
  const targetResult = row && prefixAndTarget.length > 0
    ? verifyWalkthrough(row.puzzleBoard, prefixAndTarget, { mode: 'evidence' }).stepResults[sample.hitStepNumber - 1] ?? null
    : null;
  const scenario = {
    hitStepNumber: sample.hitStepNumber,
    stepsBeforeCount: Math.max(0, sample.hitStepNumber - 1),
    boardBefore: targetResult?.before.board ?? null,
    candidatesBefore: targetResult?.before.candidates ?? null,
    boardAfter: targetResult?.after?.board ?? null,
    candidatesAfter: targetResult?.after?.candidates ?? null,
    targetStep: sample.targetStep,
    formattedStepZh: sample.teachingTextZh.thisStep,
    ...(options.includeStepsBefore ? { stepsBefore: prefixAndTarget.slice(0, -1) } : {}),
  };
  const publicSample = {
    sampleId: `learning:${sample.primaryTechnique}:${sample.puzzleId}:${sample.hitStepNumber}:${sample.selectionRank}`,
    ...sample,
    scenario,
    validation: {
      ...sample.validation,
      targetStepValid: targetResult?.valid ?? false,
      validationIssues: targetResult?.issues ?? [],
    },
  };
  delete publicSample.sampleKey;
  delete publicSample.analysisId;
  return publicSample;
}

function buildTeachingText(step, stepIndex) {
  const definition = definitionsById.get(step.technique);
  const guide = techniqueGuide(definition);
  return {
    title: `${definition?.nameZh ?? step.technique} 示例`,
    techniqueIntro: guide.intro,
    whenToUse: guide.whenToUse,
    whyThisWorks: guide.whyThisWorks,
    thisStep: safeFormatStep(step, { locale: 'zh-CN', style: 'teaching', stepNumber: stepIndex + 1 }),
  };
}

function techniqueGuide(definition) {
  const name = definition?.nameZh ?? '这个技巧';
  const family = definition?.family ?? 'unknown';
  const guides = {
    single: ['直接确定一个格子数字的基础技巧。', '当某个格子、行、列或宫被限制到只剩一个可能时使用。', '数独每行、每列、每宫都必须包含 1 到 9 且不能重复；如果其他可能都被排除，剩下的数字就是唯一答案。'],
    intersection: ['利用宫与行列交叉处的候选分布来删候选。', '观察某个数字在宫内是否只落在同一行/列，或在行/列中是否只落在同一宫。', '如果该数字必须落在交叉区域内，那么同一行、列或宫的其他位置就不能再保留这个候选。'],
    subset: ['关注同一区域内一组格子和一组候选数字之间的绑定关系。', '在同一行、列或宫里寻找显性数组或隐性数组。', '这组数字必须占用这组格子，因此同一区域中其他格子的相同候选可以删除，或这些格子的其他候选可以删除。'],
    fish: ['利用某个数字在多条基线和覆盖线上的排列删候选。', '固定一个候选数字，查看它在若干行、列或宫中的候选位置是否被同样数量的覆盖线完全覆盖。', '这些基线中的该数字必须分别落在覆盖线交点上，因此覆盖线其他位置不能再放这个数字。'],
    wing: ['通过少数双值格之间的联动排除共同影响范围内的候选。', '寻找枢轴格和翼格形成“无论哪边成立都会排除同一候选”的结构。', '分支结果覆盖所有可能情况；如果每种可能都会让某个候选不成立，就可以安全删除它。'],
    als: ['使用准锁定集合或相关扩展结构进行候选排除。', '寻找 n 个格子中只有 n+1 个候选数字的集合，并观察它们与其他集合的限制关系。', '准锁定集合一旦受某个候选限制，就会迫使集合内部形成确定分配，从而排除外部共同可见的候选。'],
    coloring: ['通过强链染色追踪候选的真假关系。', '沿强链把互斥位置标成两种颜色，再寻找颜色冲突或共同影响。', '强链两端必有一真一假；如果某种颜色导致冲突，或目标格同时看见互补可能，就能推出删除结论。'],
    chain: ['把一连串强弱关系连接起来得到删除结论。', '寻找从一个候选出发、经过强链和弱链后能回到相关目标的路径。', '链端之间形成互斥或必然关系；目标候选如果同时受到链端约束，就可以删除。'],
    'single-digit-chain': ['围绕单个候选数字建立链式结构。', '固定一个数字，寻找它在行、列、宫中的强链端点及共同影响。', '同一区域中该数字只有少数可能位置时会形成强制关系；链两端覆盖到的目标候选不能继续保留。'],
    forcing: ['使用假设分支或多分支共同结论推进题目。', '普通结构技巧难以继续时，选择一个候选或单元进行有限分支。', '如果假设导致矛盾，它就不可能成立；如果所有合法分支都得到同一动作，这个动作就是必然结论。'],
    pattern: ['依赖题面中特殊候选布局的高阶结构模式。', '寻找符合该模式的基础格、目标格、守护候选或模板结构。', '结构模式会把候选真假关系绑定起来；违反绑定的候选会破坏唯一解或区域合法性。'],
    uniqueness: ['使用唯一解假设排除会造成多解结构的候选。', '寻找矩形、BUG 或其他可能导致两个数字互换仍成立的结构。', '标准数独题默认只有唯一解；会形成两个解都成立的候选可以被排除。'],
  };
  const [intro, whenToUse, whyThisWorks] = guides[family] ?? ['是当前 classic9 已实现的解题技巧。', '在候选盘中寻找该技巧对应的结构化证据。', '该技巧返回的动作已经通过 classic9 的可回放步骤和候选合法性校验。'];
  return { intro: `${name} ${intro}`, whenToUse, whyThisWorks };
}

function runAnalysis(row, solveOptions, mode, targetTechnique = null) {
  const started = performance.now();
  const id = analysisId(mode, row.id, targetTechnique);
  try {
    const analysis = analyzeSolve(row.puzzleBoard, solveOptions);
    return {
      analysisId: id,
      mode,
      targetTechnique,
      puzzleId: row.id,
      source: row.source,
      sourceIndex: row.sourceIndex,
      difficulty: row.difficulty,
      puzzle: row.puzzle,
      solution: row.solution,
      solved: analysis.solved,
      score: analysis.score,
      hardestTechnique: analysis.hardestTechnique,
      stepCount: analysis.steps.length,
      stuckReason: analysis.stuckReason ?? null,
      elapsedMs: Math.round(performance.now() - started),
      usage: options.includeUsage ? (analysis.usage ?? null) : undefined,
      validation: validateAnalysis(row, analysis),
      steps: analysis.steps,
      error: null,
    };
  } catch (error) {
    return {
      analysisId: id,
      mode,
      targetTechnique,
      puzzleId: row.id,
      source: row.source,
      sourceIndex: row.sourceIndex,
      difficulty: row.difficulty,
      puzzle: row.puzzle,
      solution: row.solution,
      solved: false,
      score: 0,
      hardestTechnique: null,
      stepCount: 0,
      stuckReason: null,
      elapsedMs: Math.round(performance.now() - started),
      usage: options.includeUsage ? null : undefined,
      validation: { actionIssues: [], replayError: null, finalMatchesSolution: null },
      steps: [],
      error: formatError(error),
    };
  }
}

function validateAnalysis(row, analysis) {
  const actionIssues = [];
  if (row.solutionBoard) {
    for (const [stepIndex, step] of analysis.steps.entries()) {
      for (const action of step.actions) {
        const truth = row.solutionBoard[action.cell];
        if (action.type === 'place' && action.digit !== truth) {
          actionIssues.push({ step: stepIndex + 1, technique: step.technique, cell: action.cell, digit: action.digit, expected: truth, reason: 'place-mismatch' });
        }
        if (action.type === 'eliminate' && action.digit === truth) {
          actionIssues.push({ step: stepIndex + 1, technique: step.technique, cell: action.cell, digit: action.digit, expected: truth, reason: 'eliminates-solution-digit' });
        }
      }
    }
  }
  let replayError = null;
  let finalMatchesSolution = null;
  if (analysis.solved && row.solutionBoard) {
    try {
      finalMatchesSolution = serializeBoard(replaySteps(row.puzzleBoard, analysis.steps)) === row.solution;
      if (!finalMatchesSolution) {
        actionIssues.push({ reason: 'final-board-mismatch', message: 'Replayed solved board does not match known solution.' });
      }
    } catch (error) {
      replayError = formatError(error);
    }
  }
  return { actionIssues, replayError, finalMatchesSolution };
}

function buildBaselineOptions() {
  return { ...galaxyOptions, includeUsage: options.includeUsage, maxSteps: options.maxSteps };
}

function buildPriorityOptions(technique) {
  const includeOtherFallback = options.fallbackMode === 'galaxy';
  return {
    allowedTechniques: uniqueStrings([...galaxyPrimary, technique, ...(includeOtherFallback ? galaxyFallback : [])]),
    preferredTechniques: uniqueStrings([technique, ...galaxyPrimary.filter((id) => id !== technique)]),
    fallbackTechniques: includeOtherFallback ? galaxyFallback.filter((id) => id !== technique) : [],
    includeUsage: options.includeUsage,
    maxSteps: options.maxSteps,
  };
}

function buildReport(candidatesByTechnique, puzzleUsage) {
  const selectedByTechnique = new Map(targetTechniqueIds.map((technique) => [technique, []]));
  for (const sample of state.samples) {
    selectedByTechnique.get(sample.primaryTechnique)?.push(sample);
  }
  const techniques = targetTechniqueIds.map((technique) => {
    const definition = definitionsById.get(technique);
    const samples = selectedByTechnique.get(technique) ?? [];
    const candidates = candidatesByTechnique.get(technique) ?? [];
    const baselineHits = candidates.filter((candidate) => candidate.mode === 'galaxy-baseline').length;
    const priorityHits = candidates.filter((candidate) => candidate.mode === 'target-technique-first').length;
    return {
      technique,
      nameZh: definition?.nameZh ?? technique,
      family: definition?.family ?? 'unknown',
      stability: definition?.stability ?? 'experimental',
      defaultScore: definition?.defaultScore ?? 0,
      selected: samples.length,
      baselineHits,
      priorityHits,
      priorityAttempts: state.priorityAttemptsByTechnique[technique] ?? null,
      status: samples.length >= options.samplesPerTechnique ? 'full' : samples.length > 0 ? 'partial' : 'missing',
      samples: samples.map((sample) => ({
        id: sample.sampleId,
        puzzleId: sample.puzzleId,
        mode: sample.mode,
        hitStepNumber: sample.hitStepNumber,
        selectionScore: sample.selectionScore,
        sharedPuzzle: sample.sharedPuzzle,
        simpleAlternativeTechniques: sample.simpleAlternativeTechniques,
      })),
    };
  }).sort((left, right) => right.defaultScore - left.defaultScore || left.technique.localeCompare(right.technique));
  const puzzleUseRows = Array.from(puzzleUsage.entries())
    .map(([puzzleId, count]) => ({ puzzleId, count }))
    .sort((left, right) => right.count - left.count || left.puzzleId.localeCompare(right.puzzleId));
  return {
    summary: {
      input: resolve(options.inputPath),
      puzzles: rows.length,
      baselineSolved: baselineAnalyses().filter((row) => row.solved).length,
      targetTechniques: targetTechniqueIds.length,
      coveredTechniques: techniques.filter((row) => row.selected > 0).length,
      fullTechniques: techniques.filter((row) => row.selected >= options.samplesPerTechnique).length,
      missingTechniques: techniques.filter((row) => row.selected === 0).map((row) => row.technique),
      partialTechniques: techniques.filter((row) => row.selected > 0 && row.selected < options.samplesPerTechnique).map((row) => row.technique),
      unresolvedTechniques: techniques
        .filter((row) => row.selected < options.samplesPerTechnique)
        .map((row) => ({
          technique: row.technique,
          selected: row.selected,
          needed: options.samplesPerTechnique - row.selected,
          priorityHits: row.priorityHits,
          attemptedPuzzles: row.priorityAttempts?.attemptedPuzzles ?? 0,
          stoppedReason: row.priorityAttempts?.stoppedReason ?? null,
        })),
      selectedSamples: state.samples.length,
      maxPuzzleUse: puzzleUseRows[0]?.count ?? 0,
      reusedPuzzles: puzzleUseRows.filter((row) => row.count > 1).length,
      totalElapsedMs: Math.round(performance.now() - startedAt),
    },
    techniques,
    puzzleUseRows,
  };
}

function writeOutputs() {
  rebuildSelections();
  const checkpoint = {
    version: 1,
    updatedAt: new Date().toISOString(),
    input: resolve(options.inputPath),
    options: publicOptions(),
    auditRows: state.auditRows,
    priorityAttemptsByTechnique: state.priorityAttemptsByTechnique,
  };
  writeAtomicJson(outputPaths.checkpointPath, checkpoint);
  writeAtomicJson(outputPaths.auditPath, {
    generatedAt: new Date().toISOString(),
    profile: 'classic-galaxy.v1',
    mode: 'baseline-then-target-technique-first',
    input: resolve(options.inputPath),
    options: publicOptions(),
    summary: state.report.summary,
    auditRows: state.auditRows,
  });
  writeAtomicJson(outputPaths.samplesPath, {
    generatedAt: new Date().toISOString(),
    profile: 'classic-galaxy.v1',
    mode: 'baseline-then-target-technique-first',
    input: resolve(options.inputPath),
    samplesPerTechnique: options.samplesPerTechnique,
    samples: state.samples.sort((left, right) => compareTechniqueHardnessDesc(left.primaryTechnique, right.primaryTechnique)
      || left.primaryTechnique.localeCompare(right.primaryTechnique)
      || left.selectionRank - right.selectionRank),
  });
  writeAtomic(outputPaths.reportPath, renderMarkdownReport());
}

function renderMarkdownReport() {
  const report = state.report;
  const lines = [
    '# Classic9 Learning Samples Report',
    '',
    `- Generated at: ${new Date().toISOString()}`,
    `- Input: ${report.summary.input}`,
    `- Puzzles: ${report.summary.puzzles}`,
    `- Baseline solved: ${report.summary.baselineSolved}/${report.summary.puzzles}`,
    `- Techniques covered: ${report.summary.coveredTechniques}/${report.summary.targetTechniques}`,
    `- Techniques with ${options.samplesPerTechnique} samples: ${report.summary.fullTechniques}/${report.summary.targetTechniques}`,
    `- Selected samples: ${report.summary.selectedSamples}`,
    `- Max puzzle reuse: ${report.summary.maxPuzzleUse}`,
    `- Checkpoint JSON: ${outputPaths.checkpointPath}`,
    `- Audit JSON: ${outputPaths.auditPath}`,
    `- Samples JSON: ${outputPaths.samplesPath}`,
    '',
    '## Technique Coverage',
    '',
    '| Technique | 中文名 | Family | Stability | Score | Selected | Baseline hits | Priority hits | Status |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |',
    ...report.techniques.map((row) => `| \`${row.technique}\` | ${row.nameZh} | \`${row.family}\` | ${row.stability} | ${row.defaultScore} | ${row.selected} | ${row.baselineHits} | ${row.priorityHits} | ${row.status} |`),
    '',
    '## Missing Or Partial',
    '',
  ];
  const incomplete = report.techniques.filter((row) => row.status !== 'full');
  if (incomplete.length === 0) {
    lines.push(`All techniques reached ${options.samplesPerTechnique} samples.`);
  } else {
    lines.push('These techniques still need samples after the completed search. Keep this section for follow-up work.');
    lines.push('');
    for (const row of incomplete) {
      const attempts = row.priorityAttempts;
      lines.push([
        `- \`${row.technique}\`:`,
        `selected=${row.selected}`,
        `needed=${Math.max(0, options.samplesPerTechnique - row.selected)}`,
        `baselineHits=${row.baselineHits}`,
        `priorityHits=${row.priorityHits}`,
        attempts ? `attempted=${attempts.attemptedPuzzles}` : 'attempted=0',
        attempts?.stoppedReason ? `stop=${attempts.stoppedReason}` : '',
      ].filter(Boolean).join(' '));
    }
  }
  lines.push('', '## Puzzle Reuse', '');
  for (const row of report.puzzleUseRows.slice(0, 50)) {
    lines.push(`- ${row.puzzleId}: ${row.count}`);
  }
  return `${lines.join('\n')}\n`;
}

function loadInitialState() {
  if (options.resume && existsSync(outputPaths.checkpointPath)) {
    const checkpoint = JSON.parse(readFileSync(outputPaths.checkpointPath, 'utf8'));
    return {
      auditRows: Array.isArray(checkpoint.auditRows) ? checkpoint.auditRows : [],
      priorityAttemptsByTechnique: checkpoint.priorityAttemptsByTechnique ?? {},
      samples: [],
      report: emptyReport(),
    };
  }
  return {
    auditRows: [],
    priorityAttemptsByTechnique: {},
    samples: [],
    report: emptyReport(),
  };
}

function emptyReport() {
  return {
    summary: {
      input: resolve(options.inputPath),
      puzzles: rows.length,
      baselineSolved: 0,
      targetTechniques: targetTechniqueIds.length,
      coveredTechniques: 0,
      fullTechniques: 0,
      missingTechniques: targetTechniqueIds,
      partialTechniques: [],
      selectedSamples: 0,
      maxPuzzleUse: 0,
      reusedPuzzles: 0,
      totalElapsedMs: 0,
    },
    techniques: [],
    puzzleUseRows: [],
  };
}

function baselineAnalyses() {
  return state.auditRows.filter((analysis) => analysis.mode === 'galaxy-baseline');
}

function baselineDifficulty(puzzleId) {
  const baseline = baselineAnalyses().find((analysis) => analysis.puzzleId === puzzleId);
  const hardestScore = baseline?.hardestTechnique ? definitionsById.get(baseline.hardestTechnique)?.defaultScore ?? 0 : 0;
  return {
    score: baseline?.score ?? 0,
    hardestTechnique: baseline?.hardestTechnique ?? null,
    stepCount: baseline?.stepCount ?? 0,
    sortScore: (baseline?.score ?? 0) * 1000 + hardestScore * 10 + (baseline?.stepCount ?? 0),
  };
}

function hardestRowsFirst() {
  return [...rows].sort((left, right) =>
    baselineDifficulty(right.id).sortScore - baselineDifficulty(left.id).sortScore
    || left.sourceIndex - right.sourceIndex);
}

function techniqueOrderHardestFirst() {
  return [...targetTechniqueIds].sort(compareTechniqueHardnessDesc);
}

function compareTechniqueHardnessDesc(left, right) {
  const leftDefinition = definitionsById.get(typeof left === 'string' ? left : left.technique);
  const rightDefinition = definitionsById.get(typeof right === 'string' ? right : right.technique);
  return (rightDefinition?.defaultScore ?? 0) - (leftDefinition?.defaultScore ?? 0);
}

function compareCandidateStable(left, right) {
  return baselineDifficulty(right.puzzleId).sortScore - baselineDifficulty(left.puzzleId).sortScore
    || right.puzzleScore - left.puzzleScore
    || left.hitStepNumber - right.hitStepNumber
    || left.puzzleId.localeCompare(right.puzzleId)
    || left.sampleKey.localeCompare(right.sampleKey);
}

function selectedCount(technique) {
  return state.samples.filter((sample) => sample.primaryTechnique === technique).length;
}

function ensurePriorityAttempts(technique) {
  state.priorityAttemptsByTechnique[technique] ??= {
    technique,
    attemptedPuzzles: 0,
    hits: 0,
    errors: 0,
    elapsedMs: 0,
    stoppedReason: null,
  };
  return state.priorityAttemptsByTechnique[technique];
}

function analysisId(mode, puzzleId, targetTechnique) {
  return `${mode}:${targetTechnique ?? 'all'}:${puzzleId}`;
}

function flush(message) {
  progress(message);
  if (options.flushEach) {
    writeOutputs();
  }
}

function progress(message) {
  if (options.progress) {
    process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);
  }
}

function safeFormatStep(step, formatOptions) {
  try {
    return formatStep(step, formatOptions);
  } catch (error) {
    return `无法生成步骤解释：${formatError(error)}`;
  }
}

function loadPuzzleRows(inputPath) {
  const absolutePath = resolve(inputPath);
  if (!existsSync(absolutePath)) {
    fail(`题集文件不存在：${absolutePath}`);
  }
  const extension = extname(absolutePath).toLowerCase();
  let raw;
  if (extension === '.json') {
    raw = JSON.parse(readFileSync(absolutePath, 'utf8'));
  } else if (extension === '.jsonl' || extension === '.ndjson') {
    raw = readFileSync(absolutePath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } else if (extension === '.js' || extension === '.cjs') {
    if (!options.allowCodeInput) {
      fail(`JS/CJS 输入会执行本地代码，请改用 JSON/JSONL 或显式传 --allow-code-input：${absolutePath}`);
    }
    raw = require(absolutePath);
  } else if (extension === '.ts') {
    if (!options.allowCodeInput) {
      fail(`TS 输入会执行本地代码，请改用 JSON/JSONL 或显式传 --allow-code-input：${absolutePath}`);
    }
    raw = loadTsModule(absolutePath);
  } else {
    fail(`不支持的题集格式：${extension || '<none>'}`);
  }
  const rows = Array.isArray(raw) ? raw : pickExportedRows(raw);
  return rows.map((row, index) => normalizePuzzleRow(row, index, absolutePath));
}

function loadTsModule(absolutePath) {
  const source = readFileSync(absolutePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: absolutePath,
  });
  const module = { exports: {} };
  const localRequire = createRequire(absolutePath);
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', transpiled.outputText); // eslint-disable-line no-new-func
  fn(module.exports, localRequire, module, absolutePath, dirname(absolutePath));
  return module.exports;
}

function pickExportedRows(loaded) {
  if (Array.isArray(loaded)) {
    return loaded;
  }
  for (const value of Object.values(loaded ?? {})) {
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

function normalizePuzzleRow(row, index, source) {
  if (!row || typeof row !== 'object') {
    fail(`第 ${index + 1} 项不是题面对象：${source}`);
  }
  const rawPuzzle = row.puzzle ?? row.grid ?? row.board;
  if (!rawPuzzle) {
    fail(`第 ${index + 1} 项缺少 puzzle/grid/board：${source}`);
  }
  const puzzleBoard = parsePuzzle(rawPuzzle);
  const puzzle = serializeBoard(puzzleBoard);
  const rawSolution = row.solution ?? row.answer;
  let solutionBoard = null;
  let solution = null;
  if (rawSolution) {
    solutionBoard = parsePuzzle(rawSolution);
    solution = serializeBoard(solutionBoard);
  } else if (options.fillMissingSolutions) {
    const uniqueness = checkUniqueness(puzzleBoard, { maxElapsedMs: options.uniquenessMaxElapsedMs });
    if (uniqueness.uniqueSolution && uniqueness.firstSolution) {
      solutionBoard = uniqueness.firstSolution;
      solution = serializeBoard(solutionBoard);
    }
  }
  return {
    source,
    sourceIndex: index,
    id: String(row.id ?? row.name ?? `puzzle-${index + 1}`),
    difficulty: typeof row.difficulty === 'string' ? row.difficulty : null,
    puzzle,
    puzzleBoard,
    solution,
    solutionBoard,
  };
}

function parseArgs(args) {
  const parsed = {
    inputPath: null,
    outDir: resolve(root, 'dist/tmp/learning'),
    auditPath: null,
    samplesPath: null,
    reportPath: null,
    checkpointPath: null,
    techniques: [],
    excludePuzzles: [],
    samplesPerTechnique: 3,
    maxSamplesPerPuzzle: 3,
    maxPriorityPuzzlesPerTechnique: 500,
    maxPriorityElapsedMsPerTechnique: 120000,
    maxSteps: galaxyPolicy.maxSteps ?? 1024,
    maxPreludeSteps: 5,
    limit: null,
    includeUsage: false,
    includeStepsBefore: false,
    skipBaseline: false,
    fallbackMode: 'target-only',
    fillMissingSolutions: false,
    allowCodeInput: false,
    uniquenessMaxElapsedMs: 1000,
    flushEach: true,
    resume: false,
    progress: true,
    json: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--input') {
      parsed.inputPath = requireValue(args, index, item);
      index += 1;
    } else if (item === '--technique') {
      const technique = requireValue(args, index, item);
      if (!definitionsById.has(technique)) {
        fail(`未知技巧：${technique}`);
      }
      parsed.techniques = uniqueStrings([...parsed.techniques, technique]);
      index += 1;
    } else if (item === '--exclude-puzzle') {
      parsed.excludePuzzles = uniqueStrings([...parsed.excludePuzzles, requireValue(args, index, item)]);
      index += 1;
    } else if (item === '--out-dir') {
      parsed.outDir = resolve(requireValue(args, index, item));
      index += 1;
    } else if (item === '--audit-output') {
      parsed.auditPath = resolve(requireValue(args, index, item));
      index += 1;
    } else if (item === '--samples-output') {
      parsed.samplesPath = resolve(requireValue(args, index, item));
      index += 1;
    } else if (item === '--report-output') {
      parsed.reportPath = resolve(requireValue(args, index, item));
      index += 1;
    } else if (item === '--checkpoint') {
      parsed.checkpointPath = resolve(requireValue(args, index, item));
      index += 1;
    } else if (item === '--samples-per-technique') {
      parsed.samplesPerTechnique = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
    } else if (item === '--max-samples-per-puzzle') {
      parsed.maxSamplesPerPuzzle = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
    } else if (item === '--max-priority-puzzles-per-technique') {
      parsed.maxPriorityPuzzlesPerTechnique = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
    } else if (item === '--max-priority-elapsed-ms-per-technique') {
      parsed.maxPriorityElapsedMsPerTechnique = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
    } else if (item === '--max-steps') {
      parsed.maxSteps = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
    } else if (item === '--max-prelude-steps') {
      parsed.maxPreludeSteps = parseNonNegativeInteger(requireValue(args, index, item), item);
      index += 1;
    } else if (item === '--limit') {
      parsed.limit = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
    } else if (item === '--fallback-mode') {
      const value = requireValue(args, index, item);
      if (!['target-only', 'galaxy', 'none'].includes(value)) {
        fail('--fallback-mode 只能是 target-only、galaxy 或 none。');
      }
      parsed.fallbackMode = value;
      index += 1;
    } else if (item === '--include-usage') {
      parsed.includeUsage = true;
    } else if (item === '--include-steps-before') {
      parsed.includeStepsBefore = true;
    } else if (item === '--skip-baseline') {
      parsed.skipBaseline = true;
    } else if (item === '--fill-missing-solutions') {
      parsed.fillMissingSolutions = true;
    } else if (item === '--allow-code-input') {
      parsed.allowCodeInput = true;
    } else if (item === '--uniqueness-max-elapsed-ms') {
      parsed.uniquenessMaxElapsedMs = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
    } else if (item === '--resume') {
      parsed.resume = true;
    } else if (item === '--no-flush-each') {
      parsed.flushEach = false;
    } else if (item === '--no-progress') {
      parsed.progress = false;
    } else if (item === '--json') {
      parsed.json = true;
    } else if (item === '--help' || item === '-h') {
      printHelpAndExit();
    } else {
      fail(`未知参数：${item}`);
    }
  }
  if (!parsed.inputPath) {
    fail('缺少 --input <file>。');
  }
  return parsed;
}

function buildOutputPaths(parsed) {
  const outDir = resolve(parsed.outDir);
  return {
    outDir,
    auditPath: parsed.auditPath ?? resolve(outDir, 'classic9-learning-audit.json'),
    samplesPath: parsed.samplesPath ?? resolve(outDir, 'classic9-learning-samples.json'),
    reportPath: parsed.reportPath ?? resolve(outDir, 'classic9-learning-report.md'),
    checkpointPath: parsed.checkpointPath ?? resolve(outDir, 'classic9-learning-checkpoint.json'),
  };
}

function publicOptions() {
  return {
    samplesPerTechnique: options.samplesPerTechnique,
    maxSamplesPerPuzzle: options.maxSamplesPerPuzzle,
    maxPriorityPuzzlesPerTechnique: options.maxPriorityPuzzlesPerTechnique,
    maxPriorityElapsedMsPerTechnique: options.maxPriorityElapsedMsPerTechnique,
    maxSteps: options.maxSteps,
    maxPreludeSteps: options.maxPreludeSteps,
    limit: options.limit,
    techniques: options.techniques,
    excludePuzzles: options.excludePuzzles,
    includeUsage: options.includeUsage,
    includeStepsBefore: options.includeStepsBefore,
    skipBaseline: options.skipBaseline,
    fallbackMode: options.fallbackMode,
    fillMissingSolutions: options.fillMissingSolutions,
    allowCodeInput: options.allowCodeInput,
    uniquenessMaxElapsedMs: options.uniquenessMaxElapsedMs,
    flushEach: options.flushEach,
    resume: options.resume,
  };
}

function writeAtomicJson(path, value) {
  writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, content, 'utf8');
  try {
    renameSync(tempPath, path);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

function requireValue(args, index, name) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    fail(`${name} 缺少参数值。`);
  }
  return value;
}

function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(`${name} 必须是大于 0 的整数。`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    fail(`${name} 必须是大于等于 0 的整数。`);
  }
  return parsed;
}

function uniqueStrings(values) {
  return Array.from(new Set(values));
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function printHelpAndExit() {
  process.stdout.write(`Usage:
  node scripts/build-learning-samples.mjs --input <puzzles.json> [options]

Options:
  --out-dir <dir>                                default: dist/tmp/learning
  --checkpoint <file>                            default: <out-dir>/classic9-learning-checkpoint.json
  --resume                                      resume from checkpoint
  --technique <id>                              target technique, repeatable
  --exclude-puzzle <id>                         skip puzzle id, repeatable
  --samples-per-technique <n>                    default: 3
  --max-samples-per-puzzle <n>                   soft cap, default: 3
  --max-priority-puzzles-per-technique <n>       default: 500
  --max-priority-elapsed-ms-per-technique <ms>   default: 120000
  --max-steps <n>                                default: classic-galaxy maxSteps
  --fallback-mode target-only|galaxy|none        default: target-only
  --include-usage
  --include-steps-before
  --skip-baseline
  --fill-missing-solutions
  --allow-code-input
  --limit <n>
  --no-flush-each
  --no-progress
  --json
`);
  process.exit(0);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
