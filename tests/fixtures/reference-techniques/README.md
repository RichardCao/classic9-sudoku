# Reference technique fixtures

This directory stores source-repository fixtures for reference technique work. They are not shipped in the npm package.

## `reference-smoke.json`

`reference-smoke.json` is a lightweight smoke corpus for the current reference technique surface:

- Direct techniques: `direct-pointing`, `direct-claiming`, `direct-hidden-pair`, `direct-hidden-triplet`.
- Chain entry points: `bidirectional-x-cycle`, `forcing-x-chain`, `bidirectional-y-cycle`, `forcing-chain`.

These cases use artificial candidate states. They verify that each technique is callable through explicit solver options, returns the expected action shape, exposes chain links when applicable, and remains replayable. They are not full proof fixtures and should not be treated as external rating corpus samples.

Run them with:

```bash
npm run audit:reference
```

The audit summary reports `corpusKind: "reference-smoke"` to make this boundary explicit.

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

Chain records:

```json
{
  "technique": "forcing-x-chain",
  "stateKind": "exact",
  "candidates": [[0, [1, 8]]],
  "minLinks": 3
}
```

Rules enforced by tests and `audit:reference`:

- `technique` must be one of the current reference smoke techniques.
- `candidates` entries are `[cell, digits]` tuples.
- `cell` is `0..80`; `digit` is `1..9`.
- A candidate record must not repeat a cell.
- Chain `stateKind` is `exact` or `mask`.
- Chain `minLinks` is a positive integer.

## Adding Real External Corpus

Real-board external rating fixtures should be added separately from `reference-smoke.json`. They should include a puzzle, known solution when available, expected hardest external bucket or target technique, and enough metadata to distinguish rating regression from single-step smoke coverage.
