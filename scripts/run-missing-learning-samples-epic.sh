#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

INPUT_PATH="/Users/create/SudokuGame/temp/learning-inputs/game-epic-source.json"
OUT_DIR="./dist/tmp/learning/classic9-game-500-missing-epic-only"
LOG_PATH="$OUT_DIR/run.log"

mkdir -p "$(dirname "$INPUT_PATH")" "$OUT_DIR"

node - <<'NODE'
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { createRequire } = require('module');

const filePath = '/Users/create/SudokuGame/assets/puzzles/epic.ts';
const outPath = '/Users/create/SudokuGame/temp/learning-inputs/game-epic-source.json';

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

const puzzles = Object.values(module.exports).find(Array.isArray);
if (!Array.isArray(puzzles)) {
  throw new Error('No epic puzzle array found');
}
if (puzzles.length !== 100) {
  throw new Error(`Expected 100 epic puzzles, got ${puzzles.length}`);
}

fs.writeFileSync(outPath, `${JSON.stringify(puzzles, null, 2)}\n`, 'utf8');
console.log(`${outPath} puzzles=${puzzles.length}`);
NODE

RESUME_FLAG=""
if [[ "${1:-}" == "--resume" ]]; then
  RESUME_FLAG="--resume"
fi

echo "Writing log to $LOG_PATH"
nohup zsh -lc "
npm run build && node scripts/build-learning-samples.mjs \
  --input '$INPUT_PATH' \
  --out-dir '$OUT_DIR' \
  --samples-per-technique 3 \
  --max-samples-per-puzzle 3 \
  --max-priority-puzzles-per-technique 100 \
  --max-priority-elapsed-ms-per-technique 3600000 \
  --max-steps 2048 \
  --fallback-mode target-only \
  $RESUME_FLAG \
  --technique sk-loops \
  --technique tridagons \
  --technique double-exocet \
  --technique exocet \
  --technique fireworks \
  --technique bug-plus-one \
  --technique extended-rectangle \
  --technique avoidable-rectangle \
  --technique x-chain \
  --technique skyscraper \
  --technique turbot-fish \
  --technique simple-coloring \
  --technique bidirectional-y-cycle \
  --technique bidirectional-x-cycle \
  --technique direct-hidden-triplet \
  --technique direct-hidden-pair \
  --technique direct-claiming \
  --technique direct-pointing
" >> "$LOG_PATH" 2>&1 &

echo "missing-technique search pid=$!"
echo "tail -f $LOG_PATH"
