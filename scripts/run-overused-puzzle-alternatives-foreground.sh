#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MAIN_SAMPLES="${MAIN_SAMPLES:-./dist/tmp/learning/classic9-game-500/classic9-learning-samples.json}"
SOURCE_INPUT="${SOURCE_INPUT:-/Users/create/SudokuGame/temp/learning-inputs/game-500-source.json}"
OVERUSED_MIN_COUNT="${OVERUSED_MIN_COUNT:-5}"
EXCLUDE_PUZZLES="${EXCLUDE_PUZZLES:-}"
PRIMARY_EXCLUDE_PUZZLE="${PRIMARY_EXCLUDE_PUZZLE:-${EXCLUDE_PUZZLES%%,*}}"
OUT_SUFFIX="${PRIMARY_EXCLUDE_PUZZLE:-overused-gt-$((OVERUSED_MIN_COUNT - 1))}"
OUT_DIR="${OUT_DIR:-./dist/tmp/learning/classic9-game-500-alternatives-${OUT_SUFFIX}}"
LOG_PATH="$OUT_DIR/run.log"
MAX_ELAPSED_MS="${MAX_ELAPSED_MS:-315360000000}"
MAX_STEPS="${MAX_STEPS:-2048}"
MAX_SAMPLES_PER_PUZZLE="${MAX_SAMPLES_PER_PUZZLE:-3}"
RUN_BUILD="${RUN_BUILD:-0}"

mkdir -p "$OUT_DIR"

if [[ ! -f "$MAIN_SAMPLES" ]]; then
  echo "Main samples file not found: $MAIN_SAMPLES" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_INPUT" ]]; then
  echo "Input file not found: $SOURCE_INPUT" >&2
  exit 1
fi

RESUME_FLAG=""
if [[ "${1:-}" == "--resume" ]]; then
  RESUME_FLAG="--resume"
fi

PLAN_PATH="$OUT_DIR/alternatives-plan.json"

MAIN_SAMPLES="$MAIN_SAMPLES" EXCLUDE_PUZZLES="$EXCLUDE_PUZZLES" OVERUSED_MIN_COUNT="$OVERUSED_MIN_COUNT" node - <<'NODE' "$PLAN_PATH"
const fs = require('fs');
const [planPath] = process.argv.slice(2);
const samplesPath = process.env.MAIN_SAMPLES;
const explicitExcludes = (process.env.EXCLUDE_PUZZLES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const minCount = Number(process.env.OVERUSED_MIN_COUNT || 5);
const samples = JSON.parse(fs.readFileSync(samplesPath, 'utf8')).samples || [];
const byPuzzle = new Map();
for (const sample of samples) {
  if (!byPuzzle.has(sample.puzzleId)) byPuzzle.set(sample.puzzleId, []);
  byPuzzle.get(sample.puzzleId).push(sample);
}
const autoExcludes = [...byPuzzle.entries()]
  .filter(([, rows]) => rows.length >= minCount)
  .map(([puzzleId]) => puzzleId)
  .sort();
const excludePuzzles = [...new Set([...explicitExcludes, ...autoExcludes])];
const primary = excludePuzzles[0] || null;
const techniques = [...new Set(samples
  .filter((sample) => excludePuzzles.includes(sample.puzzleId))
  .map((sample) => sample.primaryTechnique))]
  .sort();
if (techniques.length === 0) {
  throw new Error(`No overused techniques found in ${samplesPath}; explicitExcludes=${explicitExcludes.join(',')}, minCount=${minCount}`);
}
fs.writeFileSync(planPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  samplesPath,
  overusedMinCount: minCount,
  primaryExcludePuzzle: primary,
  excludePuzzles,
  techniques,
  overusedPuzzles: autoExcludes.map((puzzleId) => ({ puzzleId, count: byPuzzle.get(puzzleId).length })),
}, null, 2)}\n`, 'utf8');
console.log(`plan=${planPath}`);
console.log(`primaryExcludePuzzle=${primary}`);
console.log(`excludePuzzles=${excludePuzzles.join(',')}`);
console.log(`techniques=${techniques.length}`);
console.log(techniques.join(', '));
NODE

EXCLUDE_ARGS=()
IFS=',' read -rA EXCLUDE_ARRAY <<< "$EXCLUDE_PUZZLES"
if [[ -z "$EXCLUDE_PUZZLES" ]]; then
  EXCLUDE_PUZZLES="$(node - <<'NODE' "$PLAN_PATH"
const fs = require('fs');
const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
process.stdout.write(plan.excludePuzzles.join(','));
NODE
)"
  IFS=',' read -rA EXCLUDE_ARRAY <<< "$EXCLUDE_PUZZLES"
fi
for puzzle in "${EXCLUDE_ARRAY[@]}"; do
  puzzle="$(echo "$puzzle" | xargs)"
  [[ -n "$puzzle" ]] && EXCLUDE_ARGS+=(--exclude-puzzle "$puzzle")
done

TECHNIQUE_ARGS=()
while IFS= read -r technique; do
  [[ -n "$technique" ]] && TECHNIQUE_ARGS+=(--technique "$technique")
done < <(node - <<'NODE' "$PLAN_PATH"
const fs = require('fs');
const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const technique of plan.techniques) console.log(technique);
NODE
)

echo "Main samples: $MAIN_SAMPLES"
echo "Input: $SOURCE_INPUT"
echo "Overused threshold: count >= $OVERUSED_MIN_COUNT"
echo "Exclude puzzles: $EXCLUDE_PUZZLES"
echo "Out dir: $OUT_DIR"
echo "Writing log to $LOG_PATH"

FILTERED_INPUT="$OUT_DIR/input-filtered-sorted.json"
node - <<'NODE' "$SOURCE_INPUT" "$PLAN_PATH" "$FILTERED_INPUT"
const fs = require('fs');
const [sourceInput, planPath, outPath] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(sourceInput, 'utf8'));
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const excluded = new Set(plan.excludePuzzles);
const baselineDirs = [
  'dist/tmp/learning/classic9-game-500',
  'dist/tmp/learning/classic9-game-500-missing-epic-only',
  'dist/tmp/learning/classic9-game-500-alternatives-hard-011',
];
const difficulty = new Map();
for (const dir of baselineDirs) {
  const checkpoint = `${dir}/classic9-learning-checkpoint.json`;
  if (!fs.existsSync(checkpoint)) continue;
  const auditRows = JSON.parse(fs.readFileSync(checkpoint, 'utf8')).auditRows || [];
  for (const row of auditRows) {
    if (row.mode === 'galaxy-baseline') {
      difficulty.set(row.puzzleId, { score: row.score || 0, stepCount: row.stepCount || 0 });
    }
  }
}
const filtered = rows
  .filter((row) => !excluded.has(String(row.id)))
  .sort((left, right) => {
    const l = difficulty.get(left.id) || {};
    const r = difficulty.get(right.id) || {};
    return (r.score || 0) - (l.score || 0)
      || (r.stepCount || 0) - (l.stepCount || 0)
      || String(left.id).localeCompare(String(right.id));
  });
fs.writeFileSync(outPath, `${JSON.stringify(filtered, null, 2)}\n`, 'utf8');
console.log(`filtered input: ${outPath} puzzles=${filtered.length}`);
NODE

{
  echo ""
  echo "===== $(date -u +%Y-%m-%dT%H:%M:%SZ) overused alternatives ====="
  if [[ "$RUN_BUILD" == "1" ]]; then
    npm run build
  else
    echo "Skipping npm run build (RUN_BUILD=0); using existing dist/."
  fi
  node scripts/build-learning-samples.mjs \
    --input "$FILTERED_INPUT" \
    --out-dir "$OUT_DIR" \
    --samples-per-technique 3 \
    --max-samples-per-puzzle "$MAX_SAMPLES_PER_PUZZLE" \
    --max-priority-puzzles-per-technique 500 \
    --max-priority-elapsed-ms-per-technique "$MAX_ELAPSED_MS" \
    --max-steps "$MAX_STEPS" \
    --fallback-mode target-only \
    --skip-baseline \
    $RESUME_FLAG \
    "${TECHNIQUE_ARGS[@]}"
} 2>&1 | tee -a "$LOG_PATH"

echo "Done. Log: $LOG_PATH"
