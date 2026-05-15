import {
  analyzeCandidatePool,
  dedupeCandidates,
  generateOne,
  selectFromCandidates,
} from '@sudoku-tools/classic9';

const candidates = [];

for (let offset = 0; offset < 10; offset += 1) {
  const result = generateOne({
    seed: 1000 + offset,
    canonicalize: true,
    minimality: 'none',
    constraints: {
      clues: { target: 40, min: 35, max: 45 },
    },
    budget: {
      maxAttempts: 1,
      maxElapsedMs: 3000,
    },
  });
  if (result.status === 'success' && result.puzzle) {
    candidates.push(result.puzzle);
  }
}

const stats = analyzeCandidatePool(candidates);
const deduped = dedupeCandidates(candidates);
const selection = selectFromCandidates(deduped.candidates, {
  maxResults: 3,
  dedupeCanonical: true,
  scoreBuckets: [
    { min: 0, max: 999, limit: 1 },
    { min: 1000, max: 1999, limit: 1 },
    { min: 2000, max: 9999, limit: 1 },
  ],
});

console.log(JSON.stringify({
  generated: candidates.length,
  stats,
  dedupe: deduped.diagnostics,
  selected: selection.selected.length,
  rejected: selection.rejected.length,
}, null, 2));
