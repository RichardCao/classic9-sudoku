#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import { getTechniqueDefinitions } from '../dist/src/index.js';

const DEFAULT_SMOKE = 'tests/fixtures/reference-techniques/reference-smoke.json';
const DEFAULT_RATING = 'tests/fixtures/reference-techniques/reference-rating-corpus.json';

const options = parseArgs(process.argv.slice(2));
const startedAt = performance.now();
const definitions = getTechniqueDefinitions();
const smokeFixture = JSON.parse(readFileSync(resolve(process.cwd(), options.smokePath), 'utf8'));
const ratingFixture = JSON.parse(readFileSync(resolve(process.cwd(), options.ratingPath), 'utf8'));
const smokeCoverage = collectSmokeCoverage(smokeFixture);
const ratingCoverage = collectRatingCoverage(ratingFixture);

const rows = definitions
  .map((definition) => {
    const positiveSmoke = smokeCoverage.positive.get(definition.id) ?? 0;
    const negativeSmoke = smokeCoverage.negative.get(definition.id) ?? 0;
    const ratingRows = ratingCoverage.techniqueRows.get(definition.id) ?? 0;
    const ratingHardestRows = ratingCoverage.hardestRows.get(definition.id) ?? 0;
    return {
      id: definition.id,
      family: definition.family,
      stability: definition.stability,
      seDifficulty: definition.seDifficulty ?? null,
      seStatus: definition.seStatus ?? null,
      positiveSmoke,
      negativeSmoke,
      ratingRows,
      ratingHardestRows,
      hasPositiveSmoke: positiveSmoke > 0,
      hasNegativeSmoke: negativeSmoke > 0,
      hasRatingCorpus: ratingRows > 0 || ratingHardestRows > 0,
    };
  })
  .sort((left, right) => left.family.localeCompare(right.family) || left.id.localeCompare(right.id));

const stableRows = rows.filter((row) => row.stability === 'stable');
const experimentalRows = rows.filter((row) => row.stability === 'experimental');
const payload = {
  summary: {
    auditId: 'reference-coverage.v1',
    definitions: rows.length,
    stable: stableRows.length,
    experimental: experimentalRows.length,
    positiveSmokeTechniques: rows.filter((row) => row.hasPositiveSmoke).length,
    negativeSmokeTechniques: rows.filter((row) => row.hasNegativeSmoke).length,
    ratingCorpusTechniques: rows.filter((row) => row.hasRatingCorpus).length,
    stableMissingPositiveSmoke: stableRows.filter((row) => !row.hasPositiveSmoke).map((row) => row.id),
    stableMissingRatingCorpus: stableRows.filter((row) => !row.hasRatingCorpus).map((row) => row.id),
    experimentalMissingPositiveSmoke: experimentalRows.filter((row) => !row.hasPositiveSmoke).map((row) => row.id),
    experimentalMissingRatingCorpus: experimentalRows.filter((row) => !row.hasRatingCorpus).map((row) => row.id),
    elapsedMs: Math.round(performance.now() - startedAt),
  },
  rows,
};

if (options.outputPath) {
  writeFileSync(resolve(process.cwd(), options.outputPath), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

if (options.json) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  printHumanSummary(payload);
}

function collectSmokeCoverage(fixture) {
  const positive = new Map();
  const negative = new Map();
  for (const entry of collectTechniqueEntries(fixture)) {
    const bucket = entry.section === 'negative' ? negative : positive;
    bucket.set(entry.technique, (bucket.get(entry.technique) ?? 0) + 1);
  }
  return { positive, negative };
}

function collectTechniqueEntries(value, section = null) {
  const entries = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      entries.push(...collectTechniqueEntries(item, section));
    }
    return entries;
  }
  if (!isRecord(value)) {
    return entries;
  }
  const nextSection = typeof value.section === 'string'
    ? value.section
    : section;
  if (typeof value.technique === 'string') {
    entries.push({ technique: value.technique, section: nextSection });
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'technique') {
      continue;
    }
    const childSection = section ?? key;
    entries.push(...collectTechniqueEntries(child, childSection));
  }
  return entries;
}

function collectRatingCoverage(fixture) {
  if (!isRecord(fixture) || !Array.isArray(fixture.rows)) {
    throw new Error('Reference rating corpus must be an object with a rows array.');
  }
  const techniqueRows = new Map();
  const hardestRows = new Map();
  for (const row of fixture.rows) {
    if (!isRecord(row) || !isRecord(row.expected)) {
      continue;
    }
    for (const [technique, count] of Object.entries(row.expected.techniqueCountsAtLeast ?? {})) {
      if (Number(count) > 0) {
        techniqueRows.set(technique, (techniqueRows.get(technique) ?? 0) + 1);
      }
    }
    if (typeof row.expected.hardestTechnique === 'string') {
      const technique = row.expected.hardestTechnique;
      hardestRows.set(technique, (hardestRows.get(technique) ?? 0) + 1);
    }
  }
  return { techniqueRows, hardestRows };
}

function parseArgs(args) {
  const parsed = {
    smokePath: DEFAULT_SMOKE,
    ratingPath: DEFAULT_RATING,
    outputPath: null,
    json: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--json') {
      parsed.json = true;
      continue;
    }
    if (item === '--smoke') {
      parsed.smokePath = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--rating') {
      parsed.ratingPath = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--output') {
      parsed.outputPath = requireValue(args, index, item);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${item}`);
  }
  return parsed;
}

function requireValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function printHumanSummary(payload) {
  const summary = payload.summary;
  process.stdout.write(`Reference coverage: ${summary.definitions} definitions (${summary.stable} stable, ${summary.experimental} experimental)\n`);
  process.stdout.write(`Positive smoke: ${summary.positiveSmokeTechniques}; negative smoke: ${summary.negativeSmokeTechniques}; rating corpus: ${summary.ratingCorpusTechniques}\n`);
  process.stdout.write(`Stable missing rating corpus (${summary.stableMissingRatingCorpus.length}): ${summary.stableMissingRatingCorpus.join(', ') || 'none'}\n`);
  process.stdout.write(`Experimental missing rating corpus (${summary.experimentalMissingRatingCorpus.length}): ${summary.experimentalMissingRatingCorpus.join(', ') || 'none'}\n`);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
