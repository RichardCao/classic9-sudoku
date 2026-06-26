# Technique Audit Matrix

This file is generated from `scripts/audit-reference-coverage.mjs --markdown-output`.
It tracks audit readiness for each public `TechniqueId`; it does not change solver policy or technique stability.

## Summary

| Metric | Value |
| --- | --- |
| Definitions | 90 |
| Stable | 60 |
| Experimental | 30 |
| Positive smoke techniques | 90 |
| Negative smoke techniques | 90 |
| Rating corpus techniques | 90 |
| Stable missing positive smoke | 0 |
| Stable missing negative smoke | 0 |
| Stable missing rating corpus | 0 |
| Experimental missing positive smoke | 0 |
| Experimental missing negative smoke | 0 |
| Experimental missing rating corpus | 0 |

## Status Meaning

| Status | Meaning |
| --- | --- |
| `audited` | Has real-board rating coverage, positive smoke, and negative smoke. |
| `covered` | Has real-board rating coverage or positive smoke, but still lacks at least one audit layer. |
| `implemented` | Has a public definition but lacks coverage evidence in the current fixtures. |

## Matrix

| Technique | Family | Stability | SE status | +Smoke | -Smoke | Rating | Hardest | Audit | Risk | Next action |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| `aic-als` | als | experimental | non-se-extension | 1 | 1 | 2 | 3 | audited | medium | Monitor for priority or evidence drift. |
| `aligned-pair-exclusion` | als | stable | covered | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `almost-locked-pair` | als | stable | non-se-extension | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `almost-locked-quad` | als | experimental | non-se-extension | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `almost-locked-triple` | als | stable | non-se-extension | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `als-xy-wing` | als | stable | non-se-extension | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `als-xz` | als | stable | non-se-extension | 1 | 1 | 1 | 2 | audited | medium | Monitor for priority or evidence drift. |
| `big-wings` | als | experimental | non-se-extension | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `death-blossom` | als | stable | non-se-extension | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `fireworks` | als | stable | non-se-extension | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `sue-de-coq` | als | stable | non-se-extension | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `twinned-xy-chains` | als | stable | non-se-extension | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `aic` | chain | stable | partial | 10 | 6 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `aic-exotic` | chain | stable | non-se-extension | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `bidirectional-y-cycle` | chain | experimental | covered-as-variant | 2 | 1 | 2 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `forcing-chain` | chain | experimental | covered-as-variant | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `grouped-aic` | chain | stable | partial | 4 | 5 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `x-chain` | chain | stable | partial | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `xy-chain` | chain | stable | partial | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `bidirectional-x-cycle` | coloring | experimental | covered-as-variant | 2 | 1 | 2 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `multi-colors` | coloring | stable | non-se-extension | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `simple-coloring` | coloring | stable | partial | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `three-d-medusa` | coloring | stable | non-se-extension | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `x-coloring` | coloring | stable | partial | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `finned-franken-jellyfish` | fish | experimental | non-se-extension | 1 | 1 | 1 | 4 | audited | medium | Monitor for priority or evidence drift. |
| `finned-franken-swordfish` | fish | experimental | non-se-extension | 1 | 1 | 1 | 2 | audited | medium | Monitor for priority or evidence drift. |
| `finned-jellyfish` | fish | stable | non-se-extension | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `finned-swordfish` | fish | stable | non-se-extension | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `finned-x-wing` | fish | stable | non-se-extension | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `franken-swordfish` | fish | stable | non-se-extension | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `jellyfish` | fish | stable | covered | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `larger-fish` | fish | experimental | non-se-extension | 2 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `mutant-fish` | fish | experimental | non-se-extension | 1 | 2 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `sashimi-jellyfish` | fish | stable | non-se-extension | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `sashimi-swordfish` | fish | stable | non-se-extension | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `sashimi-x-wing` | fish | experimental | non-se-extension | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `swordfish` | fish | stable | covered | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `x-wing` | fish | stable | covered | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `bowmans-bingo` | forcing | experimental | non-se-extension | 1 | 1 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `cell-forcing-chains` | forcing | experimental | partial | 1 | 1 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `digit-forcing-chains` | forcing | experimental | partial | 1 | 1 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `dynamic-forcing-chains` | forcing | experimental | partial | 1 | 1 | 1 | 0 | audited | high | Expand subtype and solution-safety guards. |
| `dynamic-forcing-chains-plus` | forcing | experimental | partial | 1 | 1 | 1 | 0 | audited | high | Expand subtype and solution-safety guards. |
| `forcing-nets` | forcing | experimental | partial | 1 | 1 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `nested-forcing-chains` | forcing | experimental | partial | 1 | 1 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `nishio-forcing-chains` | forcing | stable | covered | 1 | 1 | 1 | 4 | audited | high | Expand subtype and solution-safety guards. |
| `region-forcing-chains` | forcing | experimental | covered-as-variant | 1 | 1 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `table-chain` | forcing | experimental | partial | 1 | 1 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `unit-forcing-chains` | forcing | experimental | partial | 1 | 1 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `direct-claiming` | intersection | experimental | covered | 3 | 1 | 1 | 0 | audited | low | Monitor for priority or evidence drift. |
| `direct-pointing` | intersection | experimental | covered | 3 | 1 | 1 | 0 | audited | low | Monitor for priority or evidence drift. |
| `locked-candidates` | intersection | stable | covered-as-variant | 1 | 1 | 1 | 1 | audited | low | Monitor for priority or evidence drift. |
| `double-exocet` | pattern | stable | non-se-extension | 1 | 1 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `exocet` | pattern | stable | non-se-extension | 1 | 1 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `pattern-overlay` | pattern | stable | non-se-extension | 1 | 1 | 1 | 0 | audited | high | Expand subtype and solution-safety guards. |
| `sk-loops` | pattern | stable | non-se-extension | 1 | 1 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `tridagons` | pattern | stable | non-se-extension | 1 | 1 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `full-house` | single | stable | covered | 1 | 1 | 3 | 1 | audited | low | Monitor for priority or evidence drift. |
| `hidden-single` | single | stable | covered-as-variant | 1 | 1 | 2 | 0 | audited | low | Monitor for priority or evidence drift. |
| `naked-single` | single | stable | covered | 1 | 1 | 2 | 2 | audited | low | Monitor for priority or evidence drift. |
| `empty-rectangle` | single-digit-chain | stable | non-se-extension | 2 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `forcing-x-chain` | single-digit-chain | experimental | covered-as-variant | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `grouped-x-cycles` | single-digit-chain | stable | partial | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `skyscraper` | single-digit-chain | stable | non-se-extension | 2 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `turbot-fish` | single-digit-chain | stable | non-se-extension | 8 | 1 | 2 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `two-string-kite` | single-digit-chain | stable | non-se-extension | 9 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `direct-hidden-pair` | subset | experimental | covered | 4 | 1 | 1 | 0 | audited | low | Monitor for priority or evidence drift. |
| `direct-hidden-triplet` | subset | experimental | covered | 3 | 1 | 1 | 0 | audited | low | Monitor for priority or evidence drift. |
| `hidden-pair` | subset | stable | covered | 1 | 1 | 2 | 0 | audited | low | Monitor for priority or evidence drift. |
| `hidden-quad` | subset | stable | covered | 1 | 1 | 1 | 1 | audited | low | Monitor for priority or evidence drift. |
| `hidden-triple` | subset | stable | covered | 1 | 1 | 1 | 0 | audited | low | Monitor for priority or evidence drift. |
| `naked-pair` | subset | stable | covered | 1 | 1 | 1 | 0 | audited | low | Monitor for priority or evidence drift. |
| `naked-quad` | subset | stable | covered | 1 | 1 | 1 | 0 | audited | low | Monitor for priority or evidence drift. |
| `naked-triple` | subset | stable | covered | 1 | 1 | 1 | 0 | audited | low | Monitor for priority or evidence drift. |
| `aic-ur` | uniqueness | stable | partial | 3 | 3 | 1 | 0 | audited | high | Expand subtype and solution-safety guards. |
| `avoidable-rectangle` | uniqueness | stable | partial | 1 | 1 | 3 | 7 | audited | high | Expand subtype and solution-safety guards. |
| `bug-plus-n` | uniqueness | experimental | partial | 1 | 1 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `bug-plus-one` | uniqueness | stable | partial | 2 | 2 | 1 | 0 | audited | high | Expand subtype and solution-safety guards. |
| `bug-plus-two` | uniqueness | experimental | partial | 2 | 6 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `extended-rectangle` | uniqueness | stable | partial | 2 | 1 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `hidden-unique-rectangle` | uniqueness | stable | partial | 2 | 2 | 2 | 2 | audited | high | Expand subtype and solution-safety guards. |
| `rectangle-elimination` | uniqueness | stable | partial | 2 | 1 | 1 | 0 | audited | high | Expand subtype and solution-safety guards. |
| `unique-loop` | uniqueness | experimental | partial | 4 | 6 | 1 | 1 | audited | high | Expand subtype and solution-safety guards. |
| `unique-rectangle` | uniqueness | stable | partial | 9 | 5 | 1 | 0 | audited | high | Expand subtype and solution-safety guards. |
| `chute-remote-pairs` | wing | stable | non-se-extension | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `remote-pairs` | wing | experimental | non-se-extension | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `w-wing` | wing | stable | non-se-extension | 1 | 1 | 1 | 0 | audited | medium | Monitor for priority or evidence drift. |
| `wxyz-wing` | wing | stable | non-se-extension | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `xy-wing` | wing | stable | covered | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
| `xyz-wing` | wing | stable | covered | 1 | 1 | 1 | 1 | audited | medium | Monitor for priority or evidence drift. |
