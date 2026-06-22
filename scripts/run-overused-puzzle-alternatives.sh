#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MAIN_SAMPLES="${MAIN_SAMPLES:-./dist/tmp/learning/classic9-game-500/classic9-learning-samples.json}"
INPUT_PATH="${INPUT_PATH:-/Users/create/SudokuGame/temp/learning-inputs/game-500-source.json}"
EXCLUDE_PUZZLE="${EXCLUDE_PUZZLE:-hard-011}"
OUT_DIR="${OUT_DIR:-./dist/tmp/learning/classic9-game-500-alternatives-${EXCLUDE_PUZZLE}}"
LOG_PATH="$OUT_DIR/run.log"

mkdir -p "$OUT_DIR" "$(dirname "$INPUT_PATH")"

if [[ ! -f "$MAIN_SAMPLES" ]]; then
  echo "Main samples file not found: $MAIN_SAMPLES" >&2
  exit 1
fi

if [[ ! -f "$INPUT_PATH" ]]; then
  node - <<'NODE'
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { createRequire } = require('module');

const sourceDir = '/Users/create/SudokuGame/assets/puzzles';
const outPath = process.env.INPUT_PATH || '/Users/create/SudokuGame/temp/learning-inputs/game-500-source.json';

function loadTs(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const out = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  const localRequire = createRequire(filePath);
  new Function('exports', 'require', 'module', '__filename', '__dirname', out)(
    module.exports,
    localRequire,
    module,
    filePath,
    path.dirname(filePath),
  );
  return module.exports;
}

const rows = [];
for (const difficulty of ['easy', 'normal', 'hard', 'expert', 'epic']) {
  const loaded = loadTs(path.join(sourceDir, `${difficulty}.ts`));
  const puzzles = Object.values(loaded).find(Array.isArray);
  if (!Array.isArray(puzzles)) {
    throw new Error(`No puzzle array in ${difficulty}.ts`);
  }
  rows.push(...puzzles);
}
if (rows.length !== 500) {
  throw new Error(`Expected 500 puzzles, got ${rows.length}`);
}
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
console.log(`${outPath} puzzles=${rows.length}`);
NODE
fi

TECHNIQUE_ARGS="$(MAIN_SAMPLES="$MAIN_SAMPLES" EXCLUDE_PUZZLE="$EXCLUDE_PUZZLE" node - <<'NODE'
const fs = require('fs');
const samplesPath = process.env.MAIN_SAMPLES;
const excludePuzzle = process.env.EXCLUDE_PUZZLE;
const payload = JSON.parse(fs.readFileSync(samplesPath, 'utf8'));
const samples = payload.samples || [];
const techniques = [...new Set(samples
  .filter((sample) => sample.puzzleId === excludePuzzle)
  .map((sample) => sample.primaryTechnique))];
if (techniques.length === 0) {
  throw new Error(`No techniques found for puzzle ${excludePuzzle} in ${samplesPath}`);
}
console.error(`excludePuzzle=${excludePuzzle} techniques=${techniques.length}`);
console.error(techniques.join(', '));
process.stdout.write(techniques.map((technique) => `--technique ${technique}`).join(' '));
NODE
)"

RESUME_FLAG=""
if [[ "${1:-}" == "--resume" ]]; then
  RESUME_FLAG="--resume"
fi

echo "Main samples: $MAIN_SAMPLES"
echo "Input: $INPUT_PATH"
echo "Exclude puzzle: $EXCLUDE_PUZZLE"
echo "Out dir: $OUT_DIR"
echo "Writing log to $LOG_PATH"

nohup zsh -lc "
npm run build && node scripts/build-learning-samples.mjs \
  --input '$INPUT_PATH' \
  --out-dir '$OUT_DIR' \
  --samples-per-technique 3 \
  --max-samples-per-puzzle 3 \
  --max-priority-puzzles-per-technique 499 \
  --max-priority-elapsed-ms-per-technique 3600000 \
  --max-steps 2048 \
  --fallback-mode target-only \
  --exclude-puzzle '$EXCLUDE_PUZZLE' \
  $RESUME_FLAG \
  $TECHNIQUE_ARGS
" >> "$LOG_PATH" 2>&1 &

echo "overused-puzzle alternative search pid=$!"
echo "tail -f $LOG_PATH"
