#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

SOURCE_INPUT="${SOURCE_INPUT:-/Users/create/SudokuGame/temp/learning-inputs/game-500-source.json}"
OUT_ROOT="${OUT_ROOT:-./dist/tmp/learning/classic9-game-500-underfilled-untried}"
LOG_PATH="$OUT_ROOT/run.log"
MAX_ELAPSED_MS="${MAX_ELAPSED_MS:-315360000000}"
MAX_STEPS="${MAX_STEPS:-2048}"
MAX_SAMPLES_PER_PUZZLE="${MAX_SAMPLES_PER_PUZZLE:-3}"
RUN_BUILD="${RUN_BUILD:-0}"

mkdir -p "$OUT_ROOT"

if [[ ! -f "$SOURCE_INPUT" ]]; then
  echo "Input file not found: $SOURCE_INPUT" >&2
  exit 1
fi

RESUME_FLAG=""
if [[ "${1:-}" == "--resume" ]]; then
  RESUME_FLAG="--resume"
fi

PLAN_PATH="$OUT_ROOT/underfilled-plan.json"

node - <<'NODE' "$SOURCE_INPUT" "$PLAN_PATH"
const fs = require('fs');
const [sourceInput, planPath] = process.argv.slice(2);

const resultDirs = [
  'dist/tmp/learning/classic9-game-500',
  'dist/tmp/learning/classic9-game-500-missing-epic-only',
  'dist/tmp/learning/classic9-game-500-alternatives-hard-011',
].filter((dir) => fs.existsSync(dir));

const sourceRows = JSON.parse(fs.readFileSync(sourceInput, 'utf8'));
const sampleCounts = new Map();
const triedByTechnique = new Map();
const baselineDifficulty = new Map();

for (const dir of resultDirs) {
  const samplesPath = `${dir}/classic9-learning-samples.json`;
  if (fs.existsSync(samplesPath)) {
    const samples = JSON.parse(fs.readFileSync(samplesPath, 'utf8')).samples || [];
    for (const sample of samples) {
      sampleCounts.set(sample.primaryTechnique, (sampleCounts.get(sample.primaryTechnique) || 0) + 1);
    }
  }

  const checkpointPath = `${dir}/classic9-learning-checkpoint.json`;
  if (fs.existsSync(checkpointPath)) {
    const rows = JSON.parse(fs.readFileSync(checkpointPath, 'utf8')).auditRows || [];
    for (const row of rows) {
      if (row.mode === 'galaxy-baseline') {
        baselineDifficulty.set(row.puzzleId, {
          score: row.score || 0,
          stepCount: row.stepCount || 0,
        });
      }
      if (row.mode !== 'target-technique-first' || !row.targetTechnique) continue;
      if (!triedByTechnique.has(row.targetTechnique)) triedByTechnique.set(row.targetTechnique, new Set());
      triedByTechnique.get(row.targetTechnique).add(row.puzzleId);
    }
  }
}

const techniques = Array.from(new Set([
  ...Array.from(sampleCounts.keys()),
  ...Array.from(triedByTechnique.keys()),
])).sort();

const underfilled = techniques
  .map((technique) => ({
    technique,
    existingSamples: sampleCounts.get(technique) || 0,
    needed: Math.max(0, 3 - (sampleCounts.get(technique) || 0)),
    triedPuzzles: Array.from(triedByTechnique.get(technique) || []).sort(),
  }))
  .filter((item) => item.needed > 0);

for (const item of underfilled) {
  const tried = new Set(item.triedPuzzles);
  item.untriedPuzzles = sourceRows.filter((row) => !tried.has(String(row.id))).length;
}

fs.writeFileSync(planPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  sourceInput,
  resultDirs,
  baselineDifficulty: Object.fromEntries(baselineDifficulty),
  underfilled,
}, null, 2)}\n`, 'utf8');

console.log(`plan=${planPath}`);
console.log(`underfilled=${underfilled.length}`);
for (const item of underfilled) {
  console.log(`${item.technique}: existing=${item.existingSamples}, needed=${item.needed}, tried=${item.triedPuzzles.length}, untried=${item.untriedPuzzles}`);
}
NODE

echo "Writing log to $LOG_PATH"
echo "Plan: $PLAN_PATH"

while IFS=$'\t' read -r technique needed; do
  [[ -n "$technique" ]] || continue
  TECH_DIR="$OUT_ROOT/$technique"
  TECH_INPUT="$TECH_DIR/input-untried.json"
  mkdir -p "$TECH_DIR"

  node - <<'NODE' "$SOURCE_INPUT" "$PLAN_PATH" "$technique" "$TECH_INPUT"
const fs = require('fs');
const [sourceInput, planPath, technique, outPath] = process.argv.slice(2);
const sourceRows = JSON.parse(fs.readFileSync(sourceInput, 'utf8'));
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const item = plan.underfilled.find((entry) => entry.technique === technique);
if (!item) throw new Error(`Technique not found in plan: ${technique}`);
const tried = new Set(item.triedPuzzles);
const difficulty = plan.baselineDifficulty || {};
const rows = sourceRows
  .filter((row) => !tried.has(String(row.id)))
  .sort((left, right) => {
    const l = difficulty[left.id] || {};
    const r = difficulty[right.id] || {};
    return (r.score || 0) - (l.score || 0)
      || (r.stepCount || 0) - (l.stepCount || 0)
      || String(left.id).localeCompare(String(right.id));
  });
fs.writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
console.log(`${technique}: wrote ${rows.length} untried puzzles to ${outPath}`);
NODE

  {
    echo ""
    echo "===== $(date -u +%Y-%m-%dT%H:%M:%SZ) technique=$technique needed=$needed ====="
    if [[ "$RUN_BUILD" == "1" ]]; then
      npm run build
    else
      echo "Skipping npm run build (RUN_BUILD=0); using existing dist/."
    fi
    node scripts/build-learning-samples.mjs \
      --input "$TECH_INPUT" \
      --out-dir "$TECH_DIR" \
      --samples-per-technique "$needed" \
      --max-samples-per-puzzle "$MAX_SAMPLES_PER_PUZZLE" \
      --max-priority-puzzles-per-technique 500 \
      --max-priority-elapsed-ms-per-technique "$MAX_ELAPSED_MS" \
      --max-steps "$MAX_STEPS" \
      --fallback-mode target-only \
      --skip-baseline \
      $RESUME_FLAG \
      --technique "$technique"
  } 2>&1 | tee -a "$LOG_PATH"
done < <(node - <<'NODE' "$PLAN_PATH"
const fs = require('fs');
const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const item of plan.underfilled) {
  if (item.untriedPuzzles > 0) console.log(`${item.technique}\t${item.needed}`);
}
NODE
)

echo "Done. Log: $LOG_PATH"
