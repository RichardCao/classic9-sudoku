#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const samplesPerTechnique = Number(process.env.SAMPLES_PER_TECHNIQUE ?? 3);
const maxSamplesPerPuzzle = Number(process.env.MAX_SAMPLES_PER_PUZZLE ?? 4);
const strictPuzzleCap = process.env.STRICT_PUZZLE_CAP === '1';
const outDir = process.env.OUT_DIR ?? 'dist/tmp/learning/classic9-game-500-final';
const gameInput = process.env.GAME_INPUT ?? '/Users/create/SudokuGame/temp/learning-inputs/game-500-source.json';

const sourceRuns = [
  {
    id: 'main',
    label: '500 baseline + target-first',
    dir: 'dist/tmp/learning/classic9-game-500',
    priority: 30,
  },
  {
    id: 'missing-epic',
    label: 'epic-only underfilled supplement',
    dir: 'dist/tmp/learning/classic9-game-500-missing-epic-only',
    priority: 20,
  },
  {
    id: 'underfilled-untried',
    label: 'untried-puzzle underfilled supplement',
    dir: 'dist/tmp/learning/classic9-game-500-underfilled-untried',
    priority: 5,
    recursive: true,
  },
  {
    id: 'overused-hardcap4',
    label: 'overused-puzzle replacements, puzzle cap 4',
    dir: 'dist/tmp/learning/classic9-game-500-alternatives-overused-gt4-hardcap4',
    priority: 0,
  },
];

const difficultyRank = new Map([
  ['easy', 0],
  ['normal', 1],
  ['hard', 2],
  ['expert', 3],
  ['epic', 4],
]);

fs.mkdirSync(outDir, { recursive: true });

const mainAuditPath = path.join(sourceRuns[0].dir, 'classic9-learning-audit.json');
const mainSamplesPath = path.join(sourceRuns[0].dir, 'classic9-learning-samples.json');
if (!fs.existsSync(mainAuditPath) || !fs.existsSync(mainSamplesPath)) {
  throw new Error(`Missing main learning output under ${sourceRuns[0].dir}`);
}

const mainAudit = readJson(mainAuditPath);
const mainSamples = readJson(mainSamplesPath).samples ?? [];
const targetTechniqueIds = [...new Set([
  ...mainSamples.map((sample) => sample.primaryTechnique),
  ...(mainAudit.summary?.missingTechniques ?? []),
])].sort();

const candidatesByTechnique = new Map();
const sourceRunSummaries = [];
for (const run of sourceRuns) {
  const sampleFiles = collectSampleFiles(run.dir, run.recursive);
  let sampleCount = 0;
  for (const file of sampleFiles) {
    const data = readJson(file);
    for (const sample of data.samples ?? []) {
      if (!targetTechniqueIds.includes(sample.primaryTechnique)) {
        continue;
      }
      const candidate = {
        sample: structuredClone(sample),
        run,
        file,
        key: sampleKey(sample),
      };
      const list = candidatesByTechnique.get(sample.primaryTechnique) ?? [];
      list.push(candidate);
      candidatesByTechnique.set(sample.primaryTechnique, list);
      sampleCount += 1;
    }
  }
  sourceRunSummaries.push({
    id: run.id,
    label: run.label,
    dir: run.dir,
    sampleFiles: sampleFiles.length,
    sampleCount,
  });
}

for (const [technique, candidates] of candidatesByTechnique) {
  const seen = new Set();
  const unique = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.key)) {
      continue;
    }
    seen.add(candidate.key);
    unique.push(candidate);
  }
  candidatesByTechnique.set(technique, unique);
}

const techniqueOrder = targetTechniqueIds
  .map((technique) => ({
    technique,
    score: maxTechniqueScore(candidatesByTechnique.get(technique) ?? []),
    candidateCount: candidatesByTechnique.get(technique)?.length ?? 0,
    puzzleCount: new Set((candidatesByTechnique.get(technique) ?? []).map((candidate) => candidate.sample.puzzleId)).size,
  }))
  .sort((left, right) =>
    left.puzzleCount - right.puzzleCount
    || left.candidateCount - right.candidateCount
    || right.score - left.score
    || left.technique.localeCompare(right.technique))
  .map((entry) => entry.technique);

const selected = strictPuzzleCap
  ? selectWithPuzzleCap(techniqueOrder, candidatesByTechnique)
  : selectCompleteValid(techniqueOrder, candidatesByTechnique);

const selectedSamples = selected
  .map((entry) => entry.sample)
  .sort(compareSamplesForOutput);

const finalCounts = countBy(selectedSamples, (sample) => sample.primaryTechnique);
const finalPuzzleUsage = countBy(selectedSamples, (sample) => sample.puzzleId);
for (const sample of selectedSamples) {
  sample.selectionRank = selectedSamples
    .filter((item) => item.primaryTechnique === sample.primaryTechnique)
    .findIndex((item) => item === sample) + 1;
  sample.sharedPuzzle = finalPuzzleUsage.get(sample.puzzleId) > 1;
  sample.duplicateUseCount = finalPuzzleUsage.get(sample.puzzleId);
}

const fullTechniqueIds = targetTechniqueIds.filter((technique) => (finalCounts.get(technique) ?? 0) >= samplesPerTechnique);
const underfilledTechniqueIds = targetTechniqueIds
  .filter((technique) => (finalCounts.get(technique) ?? 0) < samplesPerTechnique)
  .sort();
const unresolvedDetails = buildUnderfilledDetails(underfilledTechniqueIds, finalCounts);

const output = {
  generatedAt: new Date().toISOString(),
  profile: 'classic-galaxy.v1',
  mode: 'merged-game-500-full-techniques',
  input: gameInput,
  samplesPerTechnique,
  maxSamplesPerPuzzle,
  strictPuzzleCap,
  summary: {
    targetTechniques: targetTechniqueIds.length,
    includedTechniques: fullTechniqueIds.length,
    underfilledTechniques: underfilledTechniqueIds.length,
    selectedSamples: selectedSamples.length,
    maxPuzzleUse: Math.max(0, ...finalPuzzleUsage.values()),
  },
  merge: {
    sourceRuns: sourceRunSummaries,
    policy: [
      'Only techniques with at least three selectable samples are included for the game file.',
      strictPuzzleCap
        ? 'Puzzle use is capped at four samples while selecting replacements.'
        : 'Puzzle use is balanced during ranking, but the final file prioritizes complete valid technique coverage over a hard puzzle cap.',
      'Candidates prefer supplemental/replacement runs, harder puzzle labels, fewer simple alternatives, and valid replay data.',
    ],
    excludedUnderfilledTechniques: unresolvedDetails,
  },
  samples: selectedSamples,
};

const finalSamplesPath = path.join(outDir, 'classic9-learning-samples.game-500.json');
const finalReportPath = path.join(outDir, 'classic9-learning-samples.game-500.report.md');
const underfilledDocPath = 'docs/LEARNING_SAMPLE_UNDERFILLED_TECHNIQUES.md';

writeJson(finalSamplesPath, output);
fs.writeFileSync(finalReportPath, buildFinalReport(output, finalCounts, finalPuzzleUsage), 'utf8');
fs.writeFileSync(underfilledDocPath, buildUnderfilledDoc(output, unresolvedDetails), 'utf8');

console.log(`Final game samples: ${finalSamplesPath}`);
console.log(`Final report: ${finalReportPath}`);
console.log(`Underfilled doc: ${underfilledDocPath}`);
console.log(`includedTechniques=${fullTechniqueIds.length}/${targetTechniqueIds.length}`);
console.log(`samples=${selectedSamples.length}`);
console.log(`maxPuzzleUse=${output.summary.maxPuzzleUse}`);
console.log(`strictPuzzleCap=${strictPuzzleCap}`);
console.log(`underfilled=${underfilledTechniqueIds.join(', ') || '(none)'}`);

function selectCompleteValid(orderedTechniques, allCandidatesByTechnique) {
  const selected = [];
  const selectedKeys = new Set();
  const usage = new Map();
  const completeTechniques = orderedTechniques.filter((technique) =>
    (allCandidatesByTechnique.get(technique) ?? []).filter((candidate) => !hasValidationIssue(candidate.sample)).length >= samplesPerTechnique);

  for (let round = 0; round < samplesPerTechnique; round += 1) {
    for (const technique of completeTechniques) {
      const current = selected.filter((entry) => entry.sample.primaryTechnique === technique).length;
      if (current > round) {
        continue;
      }
      const next = (allCandidatesByTechnique.get(technique) ?? [])
        .filter((candidate) => !selectedKeys.has(candidate.key) && !hasValidationIssue(candidate.sample))
        .map((candidate) => ({
          candidate,
          score: candidateScore(technique, candidate, usage),
        }))
        .sort((left, right) => left.score - right.score || compareCandidateStable(left.candidate, right.candidate))[0]?.candidate;
      if (!next) {
        continue;
      }
      selected.push(next);
      selectedKeys.add(next.key);
      usage.set(next.sample.puzzleId, (usage.get(next.sample.puzzleId) ?? 0) + 1);
    }
  }

  return selected.filter((entry) =>
    selected.filter((other) => other.sample.primaryTechnique === entry.sample.primaryTechnique).length >= samplesPerTechnique);
}

function collectSampleFiles(dir, recursive = false) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const direct = path.join(dir, 'classic9-learning-samples.json');
  const files = fs.existsSync(direct) ? [direct] : [];
  if (!recursive) {
    return files;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...collectSampleFiles(path.join(dir, entry.name), true));
    }
  }
  return files;
}

function selectWithPuzzleCap(orderedTechniques, allCandidatesByTechnique) {
  const selectable = orderedTechniques
    .map((technique) => {
      const validCandidates = (allCandidatesByTechnique.get(technique) ?? [])
        .filter((candidate) => !hasValidationIssue(candidate.sample));
      return {
        technique,
        combinations: buildCombinations(technique, validCandidates),
      };
    })
    .filter((entry) => entry.combinations.length > 0)
    .sort((left, right) =>
      left.combinations.length - right.combinations.length
      || minPuzzleSpan(left.combinations) - minPuzzleSpan(right.combinations)
      || left.technique.localeCompare(right.technique));

  const deadline = Date.now() + Number(process.env.MERGE_SEARCH_TIMEOUT_MS ?? 30000);
  const usage = new Map();
  const chosen = [];
  const fixed = selectable.filter((entry) => entry.combinations.length === 1);
  const variable = selectable.filter((entry) => entry.combinations.length > 1);

  for (const entry of fixed) {
    const combination = entry.combinations[0];
    if (!combinationFits(combination, usage)) {
      continue;
    }
    applyCombination(combination, usage, 1);
    chosen.push({ technique: entry.technique, combination });
  }

  let best = { full: 0, cost: Number.POSITIVE_INFINITY, chosen: [] };
  let foundAll = false;

  search(0, chosen.length, chosen.reduce((sum, entry) => sum + entry.combination.cost, 0));

  return best.chosen.flatMap((entry) => entry.combination.candidates);

  function search(index, full, cost) {
    if (foundAll || Date.now() > deadline) {
      return;
    }
    if (full + (variable.length - index) < best.full) {
      return;
    }
    if (index >= variable.length) {
      if (full > best.full || (full === best.full && cost < best.cost)) {
        best = {
          full,
          cost,
          chosen: chosen.map((entry) => ({ ...entry })),
        };
        foundAll = full === fixed.length + variable.length;
      }
      return;
    }

    const entry = variable[index];
    let triedFit = false;
    for (const combination of entry.combinations) {
      if (!combinationFits(combination, usage)) {
        continue;
      }
      triedFit = true;
      applyCombination(combination, usage, 1);
      chosen.push({ technique: entry.technique, combination });
      search(index + 1, full + 1, cost + combination.cost);
      chosen.pop();
      applyCombination(combination, usage, -1);
      if (foundAll) {
        return;
      }
    }

    // Skipping is only useful when every combination is blocked or when a later
    // technique may produce a better full-technique count under the puzzle cap.
    if (!triedFit || full + (variable.length - index - 1) >= best.full) {
      search(index + 1, full, cost + 1_000_000);
    }
  }
}

function buildCombinations(technique, candidates) {
  if (candidates.length < samplesPerTechnique) {
    return [];
  }
  const sorted = [...candidates].sort((left, right) =>
    candidateScore(technique, left, new Map()) - candidateScore(technique, right, new Map())
    || compareCandidateStable(left, right));
  const combinations = [];
  const stack = [];

  visit(0);

  return combinations
    .map((combo) => ({
      candidates: combo,
      puzzles: combo.map((candidate) => candidate.sample.puzzleId),
      cost: combo.reduce((sum, candidate) => sum + candidateScore(technique, candidate, new Map()), 0)
        + duplicatePuzzlePenalty(combo),
    }))
    .sort((left, right) => left.cost - right.cost || minPuzzleSpan([left]) - minPuzzleSpan([right]))
    .slice(0, Number(process.env.MERGE_MAX_COMBINATIONS_PER_TECHNIQUE ?? 200));

  function visit(start) {
    if (stack.length === samplesPerTechnique) {
      combinations.push([...stack]);
      return;
    }
    for (let index = start; index <= sorted.length - (samplesPerTechnique - stack.length); index += 1) {
      stack.push(sorted[index]);
      visit(index + 1);
      stack.pop();
    }
  }
}

function duplicatePuzzlePenalty(combo) {
  const counts = countBy(combo, (candidate) => candidate.sample.puzzleId);
  return [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1) * 12000, 0);
}

function minPuzzleSpan(combinations) {
  return Math.min(...combinations.map((combo) => new Set(combo.puzzles).size));
}

function combinationFits(combination, usage) {
  const deltas = countBy(combination.candidates, (candidate) => candidate.sample.puzzleId);
  for (const [puzzleId, count] of deltas) {
    if ((usage.get(puzzleId) ?? 0) + count > maxSamplesPerPuzzle) {
      return false;
    }
  }
  return true;
}

function applyCombination(combination, usage, direction) {
  const deltas = countBy(combination.candidates, (candidate) => candidate.sample.puzzleId);
  for (const [puzzleId, count] of deltas) {
    const next = (usage.get(puzzleId) ?? 0) + direction * count;
    if (next <= 0) {
      usage.delete(puzzleId);
    } else {
      usage.set(puzzleId, next);
    }
  }
}

function candidateScore(technique, candidate, usage) {
  const sample = candidate.sample;
  const simpleCount = Array.isArray(sample.simpleAlternativeTechniques) ? sample.simpleAlternativeTechniques.length : 0;
  const difficulty = difficultyRank.get(sample.difficulty) ?? -1;
  const sourcePenalty = candidate.run.priority;
  const puzzleUsePenalty = (usage.get(sample.puzzleId) ?? 0) * 50000;
  const overusedPuzzlePenalty = ['hard-011', 'expert-099'].includes(sample.puzzleId) ? 7000 : 0;
  const targetScore = sample.defaultScore ?? sample.technique?.defaultScore ?? sample.targetStep?.score ?? 0;
  return sourcePenalty
    + simpleCount * 3000
    + puzzleUsePenalty
    + overusedPuzzlePenalty
    + (sample.targetStep?.actions?.length ?? 0) * 25
    + (sample.hitStepNumber ?? 0) * 40
    + ((sample.selectionScore ?? 0) / 20)
    - difficulty * 4500
    - targetScore * 3
    + (technique === sample.primaryTechnique ? 0 : 100000);
}

function hasValidationIssue(sample) {
  return Boolean(sample.validation?.replayError)
    || Boolean(sample.validation?.finalMatchesSolution === false)
    || Boolean(sample.validation?.actionIssues?.length);
}

function compareCandidateStable(left, right) {
  return left.sample.primaryTechnique.localeCompare(right.sample.primaryTechnique)
    || (left.sample.puzzleId ?? '').localeCompare(right.sample.puzzleId ?? '')
    || (left.sample.hitStepNumber ?? 0) - (right.sample.hitStepNumber ?? 0)
    || left.key.localeCompare(right.key);
}

function compareSamplesForOutput(left, right) {
  return left.primaryTechnique.localeCompare(right.primaryTechnique)
    || (left.selectionRank ?? 0) - (right.selectionRank ?? 0)
    || (left.puzzleId ?? '').localeCompare(right.puzzleId ?? '')
    || (left.hitStepNumber ?? 0) - (right.hitStepNumber ?? 0);
}

function sampleKey(sample) {
  const actions = JSON.stringify(sample.targetStep?.actions ?? []);
  return [
    sample.primaryTechnique,
    sample.puzzleId,
    sample.hitStepNumber,
    sample.puzzle,
    actions,
  ].join('|');
}

function maxTechniqueScore(candidates) {
  return Math.max(0, ...candidates.map((candidate) =>
    candidate.sample.defaultScore ?? candidate.sample.technique?.defaultScore ?? candidate.sample.targetStep?.score ?? 0));
}

function countBy(items, getKey) {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function buildUnderfilledDetails(techniques, finalCounts) {
  return techniques.map((technique) => {
    const candidates = candidatesByTechnique.get(technique) ?? [];
    const validCandidates = candidates.filter((candidate) => !hasValidationIssue(candidate.sample));
    const attempts = collectAttemptSummary(technique);
    return {
      technique,
      selectedSamples: finalCounts.get(technique) ?? 0,
      neededSamples: Math.max(0, samplesPerTechnique - (finalCounts.get(technique) ?? 0)),
      candidateSamples: candidates.length,
      validCandidateSamples: validCandidates.length,
      attemptedTargetFirstPuzzles: attempts.uniquePuzzles,
      targetFirstRows: attempts.rows,
      targetFirstHits: attempts.hits,
      targetFirstErrors: attempts.errors,
    };
  });
}

function collectAttemptSummary(technique) {
  const puzzleIds = new Set();
  let rows = 0;
  let hits = 0;
  let errors = 0;
  const auditFiles = [
    path.join('dist/tmp/learning/classic9-game-500', 'classic9-learning-audit.json'),
    path.join('dist/tmp/learning/classic9-game-500-missing-epic-only', 'classic9-learning-audit.json'),
    path.join('dist/tmp/learning/classic9-game-500-underfilled-untried', technique, 'classic9-learning-audit.json'),
  ];
  for (const file of auditFiles) {
    if (!fs.existsSync(file)) {
      continue;
    }
    const audit = readJson(file);
    for (const row of audit.auditRows ?? []) {
      if (row.targetTechnique !== technique) {
        continue;
      }
      rows += 1;
      puzzleIds.add(row.puzzleId);
      if ((row.steps ?? []).some((step) => step.technique === technique)) {
        hits += 1;
      }
      if (row.error) {
        errors += 1;
      }
    }
  }
  return { uniquePuzzles: puzzleIds.size, rows, hits, errors };
}

function buildFinalReport(data, techniqueCounts, puzzleCounts) {
  const topPuzzles = [...puzzleCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 20);
  const lines = [
    '# Classic9 Game 500 Learning Samples',
    '',
    `Generated: ${data.generatedAt}`,
    `Input: ${data.input}`,
    '',
    '## Summary',
    '',
    `- Included techniques: ${data.summary.includedTechniques}/${data.summary.targetTechniques}`,
    `- Samples: ${data.summary.selectedSamples}`,
    `- Samples per included technique: ${data.samplesPerTechnique}`,
    `- Max samples per puzzle: ${data.summary.maxPuzzleUse}${data.strictPuzzleCap ? `/${data.maxSamplesPerPuzzle}` : ` (preferred cap ${data.maxSamplesPerPuzzle}; not enforced in complete-coverage mode)`}`,
    `- Underfilled techniques: ${data.summary.underfilledTechniques}`,
    '',
    '## Top Puzzle Reuse',
    '',
    ...topPuzzles.map(([puzzleId, count]) => `- ${puzzleId}: ${count}`),
    '',
    '## Included Technique Counts',
    '',
    ...[...techniqueCounts.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([technique, count]) => `- ${technique}: ${count}`),
    '',
    '## Underfilled Techniques',
    '',
    ...data.merge.excludedUnderfilledTechniques.map((entry) =>
      `- ${entry.technique}: selected=${entry.selectedSamples}, needed=${entry.neededSamples}, validCandidateSamples=${entry.validCandidateSamples}, candidateSamples=${entry.candidateSamples}, targetFirstUniquePuzzles=${entry.attemptedTargetFirstPuzzles}`),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function buildUnderfilledDoc(data, unresolvedDetails) {
  const lines = [
    '# Learning Sample Underfilled Techniques',
    '',
    `Generated: ${data.generatedAt}`,
    '',
    'This document records techniques that still do not have three usable learning samples after merging the 500-puzzle baseline run, epic-only supplement, untried-puzzle supplement, and overused-puzzle replacement run.',
    '',
    '## Current Status',
    '',
    `- Target techniques from classic-galaxy run: ${data.summary.targetTechniques}`,
    `- Techniques ready for the mini-game file: ${data.summary.includedTechniques}`,
    `- Techniques still underfilled: ${data.summary.underfilledTechniques}`,
    `- Final game sample file: ${path.join(outDir, 'classic9-learning-samples.game-500.json')}`,
    '',
    '## Underfilled List',
    '',
  ];

  if (unresolvedDetails.length === 0) {
    lines.push('- None.');
  } else {
    for (const detail of unresolvedDetails) {
      lines.push(`- ${detail.technique}: selected ${detail.selectedSamples}/${samplesPerTechnique}; valid candidates ${detail.validCandidateSamples}; raw candidate samples ${detail.candidateSamples}; target-first tried ${detail.attemptedTargetFirstPuzzles} unique puzzles (${detail.targetFirstRows} rows), hits ${detail.targetFirstHits}, errors ${detail.targetFirstErrors}.`);
    }
  }

  lines.push(
    '',
    '## Notes For Follow-up',
    '',
    '- Techniques with raw samples but fewer than three valid candidates were left out of the game file to keep the first packaged set correctness-oriented.',
    '- Techniques with zero raw candidates appear not to be triggered by the current 500-puzzle bank under the target-technique-first searches that have completed.',
    `- The default merge prioritizes complete valid technique coverage; run with STRICT_PUZZLE_CAP=1 to regenerate a stricter cap-${maxSamplesPerPuzzle} variant for comparison.`,
    '- Follow-up options: add or generate puzzles known to contain these patterns, or improve the classic9 detectors/explanations if the patterns should have been detected.',
    '- `nested-forcing-chains` is implemented in classic9 but excluded from `classic-galaxy`, so it is not counted in this game-file target list unless explicitly requested in a separate run.',
    '',
    '## Source Runs Used',
    '',
    ...data.merge.sourceRuns.map((run) => `- ${run.id}: ${run.dir}; sampleFiles=${run.sampleFiles}; samples=${run.sampleCount}`),
    '',
  );
  return `${lines.join('\n')}\n`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
