# Reference technique fixtures

This directory stores source-repository fixtures for reference technique work. They are not shipped in the npm package.

## `reference-smoke.json`

`reference-smoke.json` is a lightweight smoke corpus for the current reference technique surface:

- Direct techniques: `direct-pointing`, `direct-claiming`, `direct-hidden-pair`, `direct-hidden-triplet`.
- Fish smoke: `x-wing`, `swordfish`, `franken-swordfish`, `jellyfish`, `finned-x-wing`, `sashimi-x-wing`, `finned-swordfish`, `finned-jellyfish`, `sashimi-swordfish`, `sashimi-jellyfish`, `finned-franken-swordfish`, `finned-franken-jellyfish`, `larger-fish`, `mutant-fish`.
- Chain entry points: `bidirectional-x-cycle`, `forcing-x-chain`, `bidirectional-y-cycle`, `forcing-chain`, `aic`, `grouped-aic`, plus single-digit pattern chains `skyscraper`, `two-string-kite`, `turbot-fish`, `empty-rectangle`.
- Wing smoke: `xy-wing`, `xyz-wing`, `wxyz-wing`, `w-wing`, `big-wings`, `chute-remote-pairs`, `remote-pairs`.
- ALS smoke: `almost-locked-pair`, `almost-locked-triple`, `almost-locked-quad`, `als-xz`, `als-xy-wing`, `aic-als`, `fireworks`, `twinned-xy-chains`, `aligned-pair-exclusion`, `death-blossom`, `sue-de-coq`.
- Pattern smoke: `exocet`, `double-exocet`, `pattern-overlay`, `tridagons`, `sk-loops`.
- Uniqueness smoke: `unique-rectangle`, `avoidable-rectangle`, `rectangle-elimination`, `extended-rectangle`, `unique-loop`, `hidden-unique-rectangle`, `aic-ur`, `bug-plus-one`, `bug-plus-two`, `bug-plus-n`.

Most cases use artificial candidate states. Some direct rows use real puzzle strings as single-step explicit-technique smoke fixtures. They verify that each technique is callable through explicit solver options, returns the expected action shape, exposes chain links when applicable, and remains replayable. Direct techniques may have multiple rows to cover different row/column/box directions and real-board single-step reachability. They are not full proof fixtures and should not be treated as external rating corpus samples.

Run them with:

```bash
npm run audit:reference
```

`npm run audit:reference` runs both the artificial candidate-state smoke audit and the real-board rating corpus audit. To run only this smoke file, use:

```bash
npm run build
node scripts/audit-reference-techniques.mjs
```

The smoke audit summary reports `corpusKind: "reference-smoke"` to make this boundary explicit.

## Fixture format

Direct records:

```json
{
  "technique": "direct-pointing",
  "candidates": [[0, [1, 2]]],
  "expectedElimination": { "cell": 3, "digit": 1 },
  "expectedPlacement": { "cell": 3, "digit": 4 }
}
```

Direct records may also use a real puzzle state:

```json
{
  "technique": "direct-pointing",
  "stateKind": "puzzle",
  "puzzle": "030678002...",
  "expectedElimination": { "cell": 61, "digit": 4 },
  "expectedPlacement": { "cell": 61, "digit": 8 }
}
```

Chain records:

```json
{
  "technique": "forcing-x-chain",
  "stateKind": "exact",
  "candidates": [[0, [1, 8]]],
  "minLinks": 3,
  "expectedEliminations": [{ "cell": 2, "digit": 1 }],
  "minStrongLinks": 3,
  "minWeakLinks": 0,
  "minGroupedNodes": 0,
  "expectedLinks": [
    { "from": 0, "to": 1, "digit": 1, "type": "strong", "house": { "type": "row", "index": 0 } }
  ]
}
```

Fish records:

```json
{
  "technique": "finned-swordfish",
  "stateKind": "exact",
  "candidates": [[0, [1, 8]]],
  "expectedEliminations": [{ "cell": 9, "digit": 1 }],
  "expectedPattern": { "family": "fish", "subtype": "finned-swordfish" }
}
```

Wing records:

```json
{
  "technique": "remote-pairs",
  "stateKind": "exact",
  "candidates": [[0, [1, 2]]],
  "expectedEliminations": [{ "cell": 8, "digit": 1 }],
  "expectedPattern": { "family": "wing", "subtype": "remote-pairs-opposite-color-endpoints" },
  "expectedLinks": [{ "from": 0, "to": 4, "digit": 1, "type": "weak" }],
  "minLinks": 6
}
```

ALS records:

```json
{
  "technique": "almost-locked-quad",
  "stateKind": "mask",
  "candidates": [[3, [1, 2]]],
  "expectedEliminations": [{ "cell": 6, "digit": 1 }],
  "expectedPattern": { "family": "als", "subtype": "almost-locked-quad" },
  "minNodes": 2
}
```

Pattern records:

```json
{
  "technique": "pattern-overlay",
  "stateKind": "exact",
  "candidates": [[0, [1, 8]]],
  "expectedPlacements": [{ "cell": 0, "digit": 1 }],
  "expectedPattern": { "family": "pattern", "subtype": "pattern-overlay-single-digit-template" },
  "minNodes": 2
}
```

Uniqueness records:

```json
{
  "technique": "avoidable-rectangle",
  "stateKind": "trusted",
  "puzzle": "020000000...",
  "candidates": [[0, [1, 3]]],
  "expectedEliminations": [{ "cell": 0, "digit": 1 }],
  "expectedPattern": { "family": "avoidable-rectangle", "subtype": "three-solved-corners" }
}
```

Rules enforced by tests and `audit:reference`:

- `technique` must be one of the current reference smoke techniques.
- `candidates` entries are `[cell, digits]` tuples.
- `cell` is `0..80`; `digit` is `1..9`.
- A candidate record must not repeat a cell.
- Direct records either omit `stateKind` and use exact artificial candidates, or use `stateKind: "puzzle"` with an 81-character puzzle string for real-board single-step smoke.
- Chain `stateKind` is `exact` or `mask`.
- Chain `minLinks` is a positive integer.
- Chain records may declare `expectedEliminations`, `minStrongLinks`, `minWeakLinks`, `minGroupedNodes`, `expectedLinks`, `expectedNodes` and `expectedCells` to pin subtype/evidence boundaries.
- `expectedLinks` are direction-insensitive for `from`/`to`, but `digit`, `type` and `house` are matched exactly when present.
- Fish `stateKind` is `exact` or `mask`.
- Fish records must declare at least one `expectedEliminations` entry and the exact `{ family: "fish", subtype }` pattern evidence; they may declare `expectedCells` and `expectedHouses` to pin representative fish / fin / target proof cells and base / cover / fin houses.
- Wing `stateKind` is `exact` or `mask`.
- Wing records must declare at least one `expectedEliminations` entry. They may declare `expectedPattern`, `expectedLinks`, `expectedCells` and `minLinks`; `expectedCells` pins reason / pivot / link / target proof roles for wing types that do not expose chain links.
- ALS `stateKind` is `exact` or `mask`.
- ALS records must declare at least one `expectedEliminations` entry and may declare `expectedPattern`, `expectedLinks`, `minLinks`, `minNodes` and `expectedNodes` to pin ALS / AHS subtype evidence.
- Pattern `stateKind` is `exact`, `mask` or `trusted`.
- Pattern records using `trusted` state include an 81-character `puzzle`, which is needed for structures such as SK Loops that depend on solved pivot cells.
- Pattern records must declare at least one `expectedEliminations` or `expectedPlacements` entry and may declare `expectedPattern`, `minNodes`, `expectedNodes` and `expectedNoteIncludes` to pin Exocet / Pattern Overlay / Tridagons / SK Loops proof roles and short proof summaries.
- Uniqueness `stateKind` is `exact`, `mask` or `trusted`.
- Uniqueness records using `trusted` state include an 81-character `puzzle`; each uniqueness record must declare at least one expected elimination or placement. Some `trusted` uniqueness rows are external-source candidate-state smoke rows, such as the HoDoKu `bug101` BUG+1 example and the HoDoKu `bug102` no-hit guard; these still do not count as full rating-path corpus rows.
- Uniqueness records may declare `minLinks`, `minNodes` and `expectedNodes`; UR / HUR / AIC-UR rows use these fields to pin the rectangle/floor/roof proof boundary, and BUG rows use them to pin BUG base/extra/parity/target nodes.
- `expectedNodes` matches by node `id`, optional `digit`, and required-in-node `cells`; it does not require the emitted node to contain only those cells.
- Uniqueness records may declare `minLinks` when a subtype depends on chain evidence, such as UR-AIC.
- Negative records live in `negative`; they use the same candidate-state shape and normally assert that the named technique returns no step. They may use `defaultCandidates` to keep large artificial no-hit states readable. They may also declare `forbiddenPattern` to allow a step while asserting that it must not be labeled as a specific pattern family/subtype.
- Positive smoke rows are also passed through `verifyStep(..., { mode: "evidence" })` for structural action/evidence validation. The audit filters context-dependent errors from artificial candidate states, but invalid action/evidence/link shapes still fail the gate.

## `reference-rating-corpus.json`

`reference-rating-corpus.json` is the real-board corpus for external-reference rating work. Unlike `reference-smoke.json`, every row uses a normal puzzle string and a known solution. It is intended to catch rating-path regressions such as hardest technique drift, score drift, uniqueness drift and replay mismatches. The audit also runs every rating-path step through `verifyStep(..., { mode: "evidence" })` and checks that placements/eliminations do not contradict the known solution.

As of the 0.4.0 release line, `audit:coverage` expects every current technique definition to have rating-corpus coverage: 90 definitions total, 60 stable and 30 experimental. This does not mean every subtype is complete or every experimental technique is promoted to stable; it means each public `TechniqueId` has at least one legal real-board rating path that can be replayed and audited.

Run it directly with:

```bash
npm run build
node scripts/audit-reference-rating-corpus.mjs
```

To search an existing puzzle bank for candidate real-board rows before adding them to the corpus, use:

```bash
npm run build
node scripts/find-reference-rating-candidates.mjs --input puzzles.txt --profile galaxy --target grouped-aic,bug-plus-one --target-first --exclude-corpus tests/fixtures/reference-techniques/reference-rating-corpus.json --json
```

The candidate search accepts a plain text file with one puzzle per line, optionally followed by a known solution, or a JSON array / `{ "rows": [...] }` object with `puzzle` and optional `solution` fields. It emits `firstTechniqueSteps`, `techniqueCounts` and a `suggestedCorpusRow` block that can be reviewed before manually adding a row to `reference-rating-corpus.json`. Use `--exclude-corpus` to skip puzzles already present in the checked-in corpus. When the goal is to cover a specific technique, use `--target-first` and put the target technique first; the committed corpus row should mirror that ordering in `targetFirstTechniques`.

Row shape:

```json
{
  "id": "se-1.0-full-house",
  "externalBucket": "SE 1.0 Last value",
  "profile": "classic-stable",
  "puzzle": "534678912...",
  "solution": "534678912...",
  "expected": {
    "solved": true,
    "unique": true,
    "hardestTechnique": "full-house",
    "score": 10,
    "stepCount": 1,
    "techniqueCountsAtLeast": {
      "full-house": 1
    },
    "techniqueCountsAtMost": {
      "bowmans-bingo": 0
    }
  }
}
```

The audit output includes `firstTechniqueSteps`, which records the first 1-based step index for each technique that appears in the rating path, and `techniqueCountGaps`, which explains any `techniqueCountsAtLeast` / `techniqueCountsAtMost` mismatch. Use these diagnostics when a candidate puzzle is solved by an earlier or different technique than expected.

Do not convert artificial or external-source candidate-state smoke fixtures into rating corpus rows. A committed rating row must pass all of these checks:

- `checkUniqueness(puzzle).status === "unique"`.
- The known `solution` matches the uniqueness result and final replayed board.
- `rate(puzzle, targetFirstPolicy)` solves the puzzle when `targetFirstTechniques` is present.
- The target technique appears in `techniqueCounts` when the row claims target coverage.
- Every rating step passes evidence validation and never places or eliminates against the known solution.
- `npm run audit:reference` and `npm run audit:coverage` both pass after the row is added.

## Adding Real External Corpus

Real-board external rating fixtures should be added separately from `reference-smoke.json`. They should include a puzzle, known solution when available, expected hardest external bucket or target technique, and enough metadata to distinguish rating regression from single-step smoke coverage.
