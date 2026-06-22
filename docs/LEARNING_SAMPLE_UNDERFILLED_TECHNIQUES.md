# Learning Sample Underfilled Techniques

Generated: 2026-06-03T06:20:36.480Z

This document records techniques that still do not have three usable learning samples after merging the 500-puzzle baseline run, epic-only supplement, untried-puzzle supplement, and overused-puzzle replacement run.

## Current Status

- Target techniques from classic-galaxy run: 76
- Techniques ready for the mini-game file: 69
- Techniques still underfilled: 7
- Final game sample file: dist/tmp/learning/classic9-game-500-final/classic9-learning-samples.game-500.json

## Underfilled List

- avoidable-rectangle: selected 0/3; valid candidates 0; raw candidate samples 0; target-first tried 500 unique puzzles (502 rows), hits 0, errors 0.
- bug-plus-one: selected 0/3; valid candidates 2; raw candidate samples 3; target-first tried 69 unique puzzles (72 rows), hits 3, errors 0.
- double-exocet: selected 0/3; valid candidates 0; raw candidate samples 0; target-first tried 500 unique puzzles (503 rows), hits 0, errors 0.
- exocet: selected 0/3; valid candidates 0; raw candidate samples 3; target-first tried 227 unique puzzles (230 rows), hits 3, errors 0.
- extended-rectangle: selected 0/3; valid candidates 0; raw candidate samples 0; target-first tried 500 unique puzzles (503 rows), hits 0, errors 0.
- sk-loops: selected 0/3; valid candidates 0; raw candidate samples 0; target-first tried 500 unique puzzles (503 rows), hits 0, errors 0.
- tridagons: selected 0/3; valid candidates 0; raw candidate samples 0; target-first tried 500 unique puzzles (503 rows), hits 0, errors 0.

## Notes For Follow-up

- Techniques with raw samples but fewer than three valid candidates were left out of the game file to keep the first packaged set correctness-oriented.
- Techniques with zero raw candidates appear not to be triggered by the current 500-puzzle bank under the target-technique-first searches that have completed.
- The default merge prioritizes complete valid technique coverage; run with STRICT_PUZZLE_CAP=1 to regenerate a stricter cap-4 variant for comparison.
- Follow-up options: add or generate puzzles known to contain these patterns, or improve the classic9 detectors/explanations if the patterns should have been detected.
- `nested-forcing-chains` is implemented in classic9 but excluded from `classic-galaxy`, so it is not counted in this game-file target list unless explicitly requested in a separate run.

## Source Runs Used

- main: dist/tmp/learning/classic9-game-500; sampleFiles=1; samples=202
- missing-epic: dist/tmp/learning/classic9-game-500-missing-epic-only; sampleFiles=1; samples=35
- underfilled-untried: dist/tmp/learning/classic9-game-500-underfilled-untried; sampleFiles=8; samples=6
- overused-hardcap4: dist/tmp/learning/classic9-game-500-alternatives-overused-gt4-hardcap4; sampleFiles=1; samples=81
