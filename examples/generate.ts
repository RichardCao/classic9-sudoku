import {
  generateOne,
} from '@sudoku-tools/classic9';

const result = generateOne({
  seed: 1,
  canonicalize: true,
  minimality: 'none',
  constraints: {
    clues: { target: 40 },
  },
  budget: {
    maxAttempts: 1,
    maxElapsedMs: 3000,
  },
});

console.log(JSON.stringify({
  status: result.status,
  success: result.status === 'success',
  puzzle: result.puzzle ? {
    clues: result.puzzle.clueCount,
    score: result.puzzle.score,
    solved: result.puzzle.solved,
    canonicalKey: result.puzzle.canonicalKey,
  } : null,
  bestCandidateIsDiagnosticOnly: result.status !== 'success' && !!result.bestCandidate,
}, null, 2));
