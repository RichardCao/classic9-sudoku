# External Technique Comparison

This document is the external-reference snapshot for the deep technique audit in [CLASSIC9_UNIMPLEMENTED_TECHNIQUE_COMPLETION_PLAN.md](./CLASSIC9_UNIMPLEMENTED_TECHNIQUE_COMPLETION_PLAN.md). It compares the current classic9 public technique set against mature solver taxonomies, open-source solver structure, and community encyclopedia pages.

This is not an implementation license to copy external code. External projects are used only to identify names, scope boundaries, example leads, and proof obligations.

Audit date: 2026-06-24.

## Sources

| Source | URL | Why it is used | License / caution |
| --- | --- | --- | --- |
| HoDoKu technique guide | https://hodoku.sourceforge.net/en/techniques.php | Broad human-solver taxonomy, including fish, uniqueness, wings, chains, ALS, last resort techniques | Guide content is GNU FDL; use as taxonomy/provenance only |
| HoDoKu SourceForge project | https://sourceforge.net/projects/hodoku/ | Confirms HoDoKu is an open-source Java solver with 70+ human-style techniques | GPLv3; do not port code |
| SukakuExplainer repository | https://github.com/SudokuMonster/SukakuExplainer | Open-source SE/Sukaku lineage and rating reference | LGPL-2.1; use as taxonomy/rating reference only |
| SukakuExplainer rule tree | https://github.com/SudokuMonster/SukakuExplainer/tree/master/diuf/sudoku/solver/rules | Confirms rule-family structure such as chaining and uniqueness packages | Do not copy Java implementation |
| NewerSudokuExplainer repository | https://github.com/SudokuMonster/NewerSudokuExplainer | SE-family fork whose README mentions added W-Wing, two-strong-link techniques, WXYZ/VWXYZ and extension patterns | License lineage must be treated as SE-family; taxonomy only |
| SudokuWiki Strategy Families | https://www.sudokuwiki.org/Strategy_Families | Community technique encyclopedia and example-board lead source | Web examples need independent replay/verify before corpus inclusion |
| SudokuWiki Quad Forcing Chains | https://www.sudokuwiki.org/Quad_Forcing_Chains | Documents Quad Forcing Chains as separated from other forcing chains and placed late in solver order | Web examples need independent replay/verify before corpus inclusion |
| Sudopedia Solving Technique index | https://www.sudopedia.org/wiki/Solving_Technique | Terminology check for coloring, uniqueness, chains, BUG Lite, and controversy notes | Terminology/provenance only |
| SudoCue solving guide | http://sudocue.net/guide.php | Classic Ruud-style solving guide with older names such as Subset Counting, Color Wing and Unique Corner / Side / Subset / Pair | Copyrighted guide; taxonomy/provenance only |
| Simple Sudoku solving guide | https://www.angusj.com/sudoku/hints.php | Angus Johnson's widely referenced guide for basics, fish, coloring and XY-Wing | Web tutorial; names only |
| Sudoku Dragon strategy guide | https://www.sudokudragon.com/sudokustrategy.htm | Older solver/tutorial source with chain permutation and Alternate Pair terminology | Web tutorial; names only |
| SudokuCoach technique overview | https://sudoku.coach/en/learn/technique-overview | Modern tutorial taxonomy and puzzle-mining lead source | Use only verified puzzle strings/candidate states |
| SudokuCoach WXYZ-Wing page | https://sudoku.coach/de/learn/wxyz-wing | Mentions WXYZ-Wing and higher named wings including VWXYZ and RSTUVWXYZ | Dynamic site; use as name lead only |
| Sudoku9981 WXYZ-Wing page | https://www.sudoku9981.com/sudoku-solving/wxyz-wing.php | Tutorial page that explicitly describes WXYZ-Wing as extendable to VWXYZ, UVWXYZ and beyond | Web tutorial; names only |
| SunnieShine Sudoku repository | https://github.com/SunnieShine/Sudoku | Very broad modern open-source solver taxonomy, including rank logic, deadly patterns, exocet subtypes, whips, and many named wings/chains | README currently reports MIT for code and CC-BY-4.0 for docs; use as taxonomy only, no code port |
| kcirtapfromspace sudoku-core | https://github.com/kcirtapfromspace/sudoku-core | Independent public-source Rust engine whose README lists Siamese Fish, ALS Chain, Aligned Triplet Exclusion, Kraken Fish and SE-like forcing names | GitHub API did not detect an SPDX license in quick pass; taxonomy only, no code port |
| SudokuWiki solver page | https://www.sudokuwiki.org/sudoku.htm | Confirms SudokuWiki's live solver exposes named human techniques and links technique explanations | Web solver behavior is not a stable API; use names/examples only |
| jsolano react-sudoku-solver | https://github.com/jsolano/react-sudoku-solver | Public React solver that documents 38 strategies adapted from SudokuWiki | GitHub API did not detect an SPDX license in quick pass; taxonomy and coverage count only |
| magnusjt sudoku | https://github.com/magnusjt/sudoku | Public solver/game README with supported and intentionally skipped technique lists | License not checked; taxonomy only |
| dharkness sudoku-rust | https://github.com/dharkness/sudoku-rust | Public Rust solver whose `Strategy` enum lists 48 strategy labels including Almost Unique Rectangle | License not checked; source-level name check only |
| raphael-kahler SudokuSolver | https://github.com/raphael-kahler/SudokuSolver | Public C# solver with a README technique table linked to Sudopedia names | GitHub API did not detect an SPDX license in quick pass; useful as a mainstream taxonomy cross-check |
| DRovara SudokuSolver | https://github.com/DRovara/SudokuSolver | Public C# solver with GUI toggles and source flags for common advanced techniques | README claims MIT but GitHub API did not detect an SPDX license; source-level name check only |
| brockovercash sudoku | https://github.com/brockovercash/sudoku | Small hint script that exposes candidate counts and singles-style hints | No license found in quick pass; low-scope cross-check only |
| Kristanix Sudoku Epic techniques | https://www.kristanix.com/sudokuepic/sudoku-solving-techniques.php | Tutorial page commonly referenced by smaller solver projects | Web tutorial; names only |
| Sudoku of the Day techniques | https://www.sudokuoftheday.com/techniques/ | Tutorial index for common newspaper-to-master techniques, including Nishio and guessing | Web tutorial; names only |
| Sudoku 10'000 app listing | https://play.google.com/store/apps/details?id=com.onegravity.sudoku.sudoku10kfree | Public app listing with a long hint-technique inventory | App-store text; use only as name lead source |
| EnjoySudoku Almost Hidden Sets thread | https://forum.enjoysudoku.com/almost-hidden-sets-useful-redundant-t3197.html | Community discussion defining and debating Almost Hidden Sets | Forum terminology; use as lead only |
| r/sudoku technique master list | https://www.reddit.com/r/sudoku/wiki/techniques/ | Community-maintained advanced technique index including AHS, ALS transport, distributed subsets and aligned exclusions | Community terminology; use as lead only |

## Current Conclusion

At public `TechniqueId` level, the current 90 classic9 ids cover the mainstream named families found in Sudoku Explainer / Sukaku Explainer, HoDoKu, SudokuWiki, Sudopedia, and SudokuCoach for classic 9x9 Sudoku. The expanded open-source pass adds a stronger warning: broad solvers such as SunnieShine enumerate many more named subtypes than classic9 currently claims. The remaining gaps are therefore split into:

1. true missing named techniques;
2. partial subtypes under an existing family;
3. techniques expressible by current AIC / forcing machinery but not exposed or audited as a named public technique;
4. variant-grid or non-goal items.

The strongest external signals for future work are:

| Gap type | External signal | Current classic9 status | Required outcome |
| --- | --- | --- | --- |
| Full BUG family | Sudopedia lists BUG Lite separately; HoDoKu documents BUG+1; SE groups BUG around 5.6..6.0 | `bug-plus-one`, `bug-plus-two`, `bug-plus-n` exist, but broader BUG+n / BUG Lite are partial or missing | Keep existing ids partial; design multi-extra proof before expanding finder |
| Generalized Unique Loop | HoDoKu and SE treat UR / hidden rectangles / loops as a broad family | `unique-loop`, `extended-rectangle`, `hidden-unique-rectangle`, `aic-ur` exist with bounded subtypes | Do not claim full generalized UL until loop proof compression and larger-loop guards exist |
| Endofin / overlap / cannibal fish | HoDoKu fish guide explicitly separates fins, sashimi, endo fins, cannibalism, Franken and Mutant fish | ordinary, finned, sashimi, Franken, larger, and conservative mutant fish exist | Add explicit endofin/overlap evidence or document as non-covered subtype |
| Kraken Fish / Siamese Fish | HoDoKu last-resort / complex fish taxonomy includes Kraken/Siamese style fish | no separate public id; some forcing/fish components exist | Treat as future forcing+fish proof family, not currently covered |
| Full ALS Chain | HoDoKu ALS guide includes ALS-XZ, ALS-XY-Wing, ALS Chain, Death Blossom | `als-xz`, `als-xy-wing`, `aic-als`, `death-blossom` exist | Clarify whether `aic-als` is only a conservative ALS chain subset; add endpoint proof guards |
| Dynamic / Nested Forcing proof tree | SE/Sukaku forcing buckets distinguish dynamic, DFC+, nested | entries exist and have smoke/evidence audits | Add true nested branch tree shape, truncation semantics, and budget tests |
| Rating clone | SE/Sukaku and HoDoKu have their own ordering / difficulty systems | classic9 exposes `seDifficulty` metadata but no SE policy | Remain out of scope unless a separate compatibility profile is designed |
| Aligned Triplet / General Aligned Exclusion | SunnieShine and kcirtapfromspace list Aligned Exclusion / Aligned Triplet Exclusion families | only `aligned-pair-exclusion` exists | Add scope decision: implement ATE / aligned exclusion or explicitly leave as missing |
| Extra wing names | SunnieShine lists M-Wing, Medusa Wing, Split-Wing, Hybrid-Wing, Local-Wing, XYZ-Loop, Fit/Fat Ring | many may be AIC/wing variants but are not pinned by id/subtype | Classify each as covered-by-AIC, covered-by-wing, or missing before claiming coverage |
| Large named wings | Sudoku 10'000, SudokuCoach, Sudoku9981 and NewerSudokuExplainer mention VWXYZ-Wing, UVWXYZ-Wing, TUVWXYZ-Wing, RSTUVWXYZ-Wing or WXYZ/VWXYZ extensions | `wxyz-wing` and `big-wings` exist, but `big-wings` is an ALS-stem model, not a full named large-wing family | Treat larger named wings as partial / unscoped until subtype fixtures exist |
| Extra deadly-pattern names | SunnieShine lists Borescoper, Qiu, Unique Matrix, Uniqueness Clue Cover, Reverse BUG, rotating/anonymous deadly patterns | only UR/HUR/AR/RE/ER/UL/BUG partial ids exist | Treat as missing / unscoped uniqueness subtypes until examples and no-hit guards exist |
| AHS / rank / leftover logic | EnjoySudoku, r/sudoku and SunnieShine surface Almost Hidden Sets, Almost Almost Hidden Sets, Distributed Disjointed Subset, Law of Leftovers, multi-sector locked sets and rank-style logic | no first-class AHS or rank-logic technique id | Mostly unscoped; decide whether classic 9x9 rank logic belongs in core |
| Community-only advanced names | r/sudoku lists BARNs, ALS transport, Cyclopes Fish, MUG/PUG/YUCK, Thor's Hammer and other high-order names | some overlap exists with `wxyz-wing`, `aic`, `aic-als`, `unique-loop`, fish and forcing ids | Treat as terminology leads until each has independent examples and proof boundaries |
| Older set-counting / alternate-pair terminology | SudoCue documents Subset Counting and Sudoku Dragon mentions Chain Permutation / Alternate Pair | some reductions may overlap subsets, ALS, APE, XY-Wing or AIC | Treat as unscoped set/rank logic unless a concrete finder boundary is defined |
| Almost Unique Rectangle | dharkness sudoku-rust exposes `AlmostUniqueRectangle`; r/sudoku also lists Almost UR | classic9 has UR/HUR/UR-AIC/extended rectangle/unique-loop but no explicit Almost Unique Rectangle id | Treat as unscoped uniqueness variant until examples clarify relation to current `aic-ur` / `unique-loop` |
| Quad / Rectangle Forcing Chains | SudokuWiki solver exposes Quad Forcing Chains; SunnieShine lists Rectangle Forcing Chains and BUG+n Forcing Chains | current forcing ids include digit/cell/unit/region/table/dynamic/nested, but no quad/rectangle-specific public id | Treat as unscoped named forcing variants until proof-tree shape is designed |

## HoDoKu Mapping

HoDoKu is the broadest external checklist because its guide groups both common human techniques and last-resort techniques.

| HoDoKu area | External names | classic9 mapping | Status | Follow-up |
| --- | --- | --- | --- | --- |
| Singles | Full House / Last Digit, Hidden Single, Naked Single | `full-house`, `hidden-single`, `naked-single` | covered | Add low-risk negative smoke only if matrix policy requires every low-risk id to be audited |
| Intersections | Pointing, Claiming | `locked-candidates`, `direct-pointing`, `direct-claiming` | covered / covered-as-variant | No missing id; direct rows remain separate SE compatibility concern |
| Hidden / Naked Subsets | Pair, Triple, Quad | `hidden-pair`, `hidden-triple`, `hidden-quad`, `naked-pair`, `naked-triple`, `naked-quad`; direct variants for SE | covered | Basic subset negative smoke can be added for audit completeness |
| Basic Fish | X-Wing, Swordfish, Jellyfish, Larger Basic Fish | `x-wing`, `swordfish`, `jellyfish`, `larger-fish` | covered | `larger-fish` stays experimental / extension; no stable promotion needed |
| Finned / Sashimi Fish | Finned/Sashimi X-Wing, Swordfish, Jellyfish, Larger Finned Fish | `finned-x-wing`, `sashimi-x-wing`, `finned-swordfish`, `sashimi-swordfish`, `finned-jellyfish`, `sashimi-jellyfish` | representative coverage | Larger finned fish and explicit endofin/cannibal proof remain open |
| Complex Fish | Franken, Mutant, Siamese, cannibal / overlap ideas | `franken-swordfish`, `finned-franken-swordfish`, `finned-franken-jellyfish`, `mutant-fish` | partial for generalized complex fish | Add endofin/overlap/cannibal taxonomy before expanding `mutant-fish` |
| Single Digit Patterns | Skyscraper, 2-String Kite, Turbot Fish, Empty Rectangle | `skyscraper`, `two-string-kite`, `turbot-fish`, `empty-rectangle` | covered | Current smoke has strong subtype coverage; continue real-board diversity only |
| Uniqueness | UR Types 1-6, Hidden Rectangle, Avoidable Rectangle, BUG+1 | `unique-rectangle`, `hidden-unique-rectangle`, `aic-ur`, `extended-rectangle`, `unique-loop`, `avoidable-rectangle`, `bug-plus-one` | partial | Main remaining proof work is broader UR/UL and BUG, not new ids |
| Wings | XY-Wing, XYZ-Wing, W-Wing | `xy-wing`, `xyz-wing`, `w-wing` plus `wxyz-wing`, `big-wings`, `chute-remote-pairs`, `remote-pairs` | covered / extension | No missing mainstream wing id found |
| Miscellaneous | Sue de Coq | `sue-de-coq` | covered | Keep ALS/bent-set evidence pinned |
| Coloring | Simple Colors, Multi Colors | `simple-coloring`, `x-coloring`, `multi-colors`, `three-d-medusa` | covered / extension | `x-coloring` still lacks negative smoke in generated matrix |
| Chains and Loops | Remote Pair, X-Chain, XY-Chain, Nice Loop/AIC, Grouped Nice Loop/AIC | `remote-pairs`, `x-chain`, `xy-chain`, `aic`, `grouped-aic`, `grouped-x-cycles`, `aic-exotic` | covered / partial | More real-board chain diversity and grouped renderer are still useful |
| ALS | ALS-XZ, ALS-XY-Wing, ALS Chain, Death Blossom | `als-xz`, `als-xy-wing`, `aic-als`, `death-blossom` | covered / partial | Clarify ALS-chain subset and add endpoint proof guards |
| Last Resort | Templates, Forcing Chain, Forcing Net, Kraken Fish, Brute Force | `pattern-overlay`, `forcing-chain`, `forcing-nets`, forcing family ids | partial | Kraken Fish and brute force are not currently claimed; brute force remains non-goal |

## SudokuWiki / Sudopedia Mapping

SudokuWiki and Sudopedia are useful because they surface community names that do not always appear in SE/HoDoKu tables.

| External family | Names checked | classic9 mapping | Status |
| --- | --- | --- | --- |
| Basic candidates | naked / hidden subsets, pointing pairs, box-line reduction | singles, subsets, `locked-candidates` | covered |
| Bent sets | Chute Remote Pairs, Y-Wing, W-Wing, XYZ-Wing, WXYZ-Wing, Almost Locked Pairs/Triples, Fireworks, Twinned XY-Chains | `chute-remote-pairs`, `xy-wing`, `w-wing`, `xyz-wing`, `wxyz-wing`, `almost-locked-*`, `fireworks`, `twinned-xy-chains` | covered |
| Chaining | X-Wing family, rectangle elimination, simple/multi coloring, XY-Chains, 3D Medusa, Remote Pairs, X-Cycles, SK Loops, grouped X-cycles, inference chains, grouped AIC, ALS-AIC, UR-AIC, exotic links | matching classic9 ids exist | covered / partial |
| Forcing | Digit, Nishio, Cell, Unit Forcing Chains; Forcing Nets | forcing family ids exist | covered / partial proof tree |
| Exotic | Exocet, Double Exocet, Pattern Overlay, Tridagons, Sue-de-Coq, Death Blossom, Bowman's Bingo | matching classic9 ids exist | covered as classic9 extensions |
| Uniqueness | Unique Rectangles, Extended Rectangles, Hidden Rectangles, Avoidable Rectangles, BUG+1, Gurth's Theorem | uniqueness family ids exist except Gurth's Theorem | Gurth's Theorem is not claimed; treat as candidate lead / non-goal until scoped |
| Deprecated / alternate names | Remote Pairs, Y-Wing Chain, Multivalue X-Wing, Multi-Colouring, Empty Rectangles, Guardians | mostly mapped to existing ids; Guardians / Multivalue X-Wing need explicit scope if added | no current public-id gap unless these are promoted to first-class names |

## Sudoku Explainer / SukakuExplainer Mapping

SE/SukakuExplainer are already represented by `seDifficulty`, `seStatus`, [SE_COMPATIBILITY.md](./SE_COMPATIBILITY.md), [SE_CHAIN_MATRIX.md](./SE_CHAIN_MATRIX.md), and [SE_UNIQUENESS_MATRIX.md](./SE_UNIQUENESS_MATRIX.md). This pass confirms the current local metadata still aligns with the high-level SE buckets:

| SE bucket | classic9 mapping | Current status |
| --- | --- | --- |
| 1.0..5.4 basics, direct, fish, wings, subsets | direct ids, singles, subsets, `x-wing`, `swordfish`, `jellyfish`, `xy-wing`, `xyz-wing` | covered or covered-as-variant |
| 4.5..5.0 uniqueness | `unique-rectangle`, `hidden-unique-rectangle`, `aic-ur`, `rectangle-elimination`, `avoidable-rectangle`, `extended-rectangle`, `unique-loop` | partial |
| 5.6..6.0 BUG | `bug-plus-one`, `bug-plus-two`, `bug-plus-n` | partial |
| 6.2 APE | `aligned-pair-exclusion` | covered |
| 6.5..8.0 chains and bidirectional cycles | `bidirectional-x-cycle`, `bidirectional-y-cycle`, `forcing-x-chain`, `forcing-chain`, `x-chain`, `xy-chain`, `aic`, `grouped-aic` | covered-as-variant / partial |
| 7.5..10+ forcing | `nishio-forcing-chains`, `forcing-nets`, `digit-forcing-chains`, `cell-forcing-chains`, `unit-forcing-chains`, `region-forcing-chains`, `table-chain`, `dynamic-forcing-chains`, `dynamic-forcing-chains-plus`, `nested-forcing-chains` | covered / partial proof tree |

The SukakuExplainer repository confirms that SE-derived open source keeps rules organized into solver rule families such as chaining and uniqueness. classic9 should keep using this as a package-boundary and naming signal only; the Java rule implementations are license-incompatible for direct porting.

## Expanded Open-Source Taxonomy Pass

The following sources go beyond the first mainstream taxonomy pass. They are useful precisely because they mention obscure names that are easy to miss when only checking SE / HoDoKu / SudokuWiki.

| Source | External names or families found | classic9 mapping | Current decision |
| --- | --- | --- | --- |
| SunnieShine Sudoku | M-Wing, Medusa Wing, Split-Wing, Hybrid-Wing, Local-Wing, XYZ-Loop, Fit Ring, Fat Ring | `aic`, `xy-chain`, `xyz-wing`, `wxyz-wing`, `big-wings`, `three-d-medusa` may cover some patterns behaviorally | not claimed; each needs subtype examples before marking covered |
| SunnieShine Sudoku | Almost Locked Candidates, Locked Candidates Type 3, ALS-W-Wing, ALS Chain, grouped ALS, ESP, ERIP | `almost-locked-*`, `als-xz`, `als-xy-wing`, `aic-als`, `death-blossom`, `sue-de-coq` | partial; ALS-chain and ALS-W-Wing/ESP/ERIP are not individually audited |
| SunnieShine Sudoku | Aligned Triplet Exclusion, generalized Aligned Exclusion | `aligned-pair-exclusion` only | missing named technique / future ATE family |
| SunnieShine Sudoku | Borescoper's Deadly Pattern, Qiu's Deadly Pattern, Unique Matrix, Uniqueness Clue Cover, Reverse BUG, Rotating Deadly Pattern, Anonymous Deadly Pattern | `unique-rectangle`, `hidden-unique-rectangle`, `aic-ur`, `unique-loop`, `bug-plus-*` | missing or unscoped uniqueness subtypes |
| SunnieShine Sudoku | Bi-value Oddagon, Tri-value Oddagon, Broken Loop, Domino Loop | `unique-loop`, `sk-loops`, `aic` may overlap in narrow cases | missing as named oddagon / loop families |
| SunnieShine Sudoku | Continuous Nice Loop, Grouped Continuous Nice Loop, Node Collision, Blossom Loop, Finned Chain, Grouped Finned Chain | `aic`, `grouped-aic`, `forcing-chain` | partial; not separately named or audited |
| SunnieShine Sudoku | Whip, grouped whip, complex/nested forcing variants, contradiction forcing chains, double forcing chains | forcing family ids and `nested-forcing-chains` | partial; no whip / braid style public id |
| SunnieShine Sudoku | Multi-sector Locked Sets, rank-style eliminations, Law of Leftovers | no first-class rank logic id | unscoped; Law of Leftovers is usually jigsaw/variant adjacent and not classic9 core by default |
| SunnieShine Sudoku | Junior Exocet, Senior Exocet, Weak Exocet, Complex Senior Exocet, Generalized Exocet, Double Exocet | `exocet`, `double-exocet` | partial; subtypes not audited separately |
| SunnieShine Sudoku | Standard / Anti / Double / Complex Generalized Sue de Coq, 3D Sue de Coq | `sue-de-coq` | partial; not subtype-complete |
| kcirtapfromspace sudoku-core | Siamese Fish, ALS Chain, Aligned Triplet Exclusion, Kraken Fish | `mutant-fish`, `aic-als`, `aligned-pair-exclusion`, forcing family ids | confirms known gaps: Siamese/Kraken/ATE and full ALS Chain remain not complete |
| NewerSudokuExplainer | W-Wing, two-strong-link techniques, WXYZ-Wing, VWXYZ-Wing and WXYZ/VWXYZ extension patterns | `w-wing`, `skyscraper`, `two-string-kite`, `turbot-fish`, `wxyz-wing`, `big-wings` | confirms large-wing subtype gap, not a new basics gap |
| SudoCue guide | Color Wing, Empty Rectangle / Hinge, Subset Counting, Unique Corner / Side / Subset / Pair, Medusa Bridge / Complex | `simple-coloring`, `multi-colors`, `three-d-medusa`, `empty-rectangle`, uniqueness ids, subsets / ALS / APE | mostly covered or partial; Subset Counting is unscoped |
| magnusjt sudoku | finned/sashimi fish, W/XY/XYZ wings, BUG+1, UR Type 1, hidden rectangles, empty rectangle with two candidates, grouped continuous/discontinuous nice loops, grouped AIC; TODO / won't-do list mentions ALS, Kraken/Franken fish, UR Type 2-6, avoidable rectangles and Sue de Coq | existing fish/wing/chain/uniqueness ids cover much of this; ALS/fish/UR breadth remains partial | mostly confirms known partial areas |
| dharkness sudoku-rust | 48 strategy labels including AlmostUniqueRectangle, WXYZ-Wing, AIC, ALS, Death Blossom, Sue de Coq, Digit Forcing Chain and many SudokuWiki-style basics | existing ids cover most; AlmostUniqueRectangle has no first-class id | confirms Almost UR / Almost Unique Rectangle as unscoped |
| SudokuWiki solver page | "General Logic" plus named human strategies reachable from the online solver | many existing ids | no new id from this source alone; use specific linked strategy pages as evidence when adding fixtures |
| SudokuWiki Quad Forcing Chains | Quad Forcing Chains as a late, separated last-resort forcing family | no dedicated `quad-forcing-chains` id | confirms unscoped forcing variant |
| Sudoku9981 / SudokuCoach WXYZ pages | WXYZ-Wing extendable to VWXYZ / UVWXYZ / higher wings | `wxyz-wing`; `big-wings` is not equivalent | confirms large named wings are only partial / unscoped |
| Sudoku 10'000 app listing | VWXYZ / UVWXYZ / TUVWXYZ / RSTUVWXYZ wings, BUG+3 / BUG+4, Forcing XY-Chains, Double / Contradiction Forcing Chains | `wxyz-wing`, `big-wings`, `bug-plus-n`, forcing family ids | partial; these names are not individually pinned |
| EnjoySudoku / r/sudoku advanced terminology | Almost Hidden Sets, Almost Almost Hidden Sets, ALS/AHS combinations, Distributed Disjointed Subset, APE/ATE | `aligned-pair-exclusion`, ALS ids, `sue-de-coq`, `death-blossom` | AHS and distributed subset families remain unscoped / missing |
| r/sudoku advanced terminology | Cyclopes Fish, Squirmbag / Starfish / Whale / Leviathan, BARNs, ALS transport wings, MUG / PUG / YUCK, Almost UR / Almost BUG / Almost MUG, Universal Unavoidable Candidate, Thor's Hammer | fish ids, `larger-fish`, `wxyz-wing`, `aic-als`, uniqueness ids, forcing ids may overlap in narrow cases | mostly unscoped; do not claim coverage without examples |

This expanded pass changes the previous "no new public `TechniqueId` needed" conclusion: no new id is required for the 0.4.x release gates, but several externally named techniques are not currently implemented as explicit public techniques. They should be tracked as future candidates rather than silently absorbed into `aic` or `forcing-chain`.

## Additional Web And Open-Source Cross-Checks

These sources are useful as negative evidence: they were checked, their named techniques were mapped, and they did not add new high-priority gaps beyond the expanded taxonomy above.

| Source | Names checked | classic9 mapping | Result |
| --- | --- | --- | --- |
| raphael-kahler SudokuSolver | naked / hidden singles, pairs, triples, quads; pointing / claiming; simple coloring; X-Wing, Swordfish, Jellyfish with finned / sashimi variants; XY / XYZ / WXYZ-Wing | singles, subsets, `locked-candidates`, `simple-coloring`, fish ids, wing ids | covered; no new missing technique |
| jsolano react-sudoku-solver | 38 strategies adapted from SudokuWiki, including basics, fish, wings, uniqueness, chains, ALS, forcing and Quad Forcing Chains | mostly existing ids; no dedicated `quad-forcing-chains` id | confirms SudokuWiki mapping and the unscoped Quad Forcing Chains lead |
| DRovara SudokuSolver | hidden singles, naked/hidden pairs/triples/quads, X-Wing, Swordfish | existing singles, subsets, fish ids | covered; no new missing technique |
| brockovercash sudoku | candidate counts and singular row/column/box hints | candidate display plus hidden-single-style checks | covered by lower-level singles / candidate state; low taxonomy value |
| Kristanix Sudoku Epic techniques | Sole Candidate, Unique Candidate, Block/Column/Row Interaction, Block/Block Interaction, Naked/Hidden Subset, X-Wing, Swordfish, Forcing Chain | `naked-single`, `hidden-single`, `locked-candidates`, subsets, fish, `forcing-chain` / forcing family | covered; no new missing technique |
| Sudoku of the Day techniques | Single Position, Single Candidate, Candidate Lines, Double Pairs, Multiple Lines, Naked/Hidden Pairs/Triples, X-Wing, Swordfish, Forcing Chains, Nishio, Guessing | singles, locked candidates / line-box interactions, subsets, fish, forcing, `nishio-forcing-chains`; guessing is non-goal | covered except guessing, which remains non-goal |
| Simple Sudoku / Sudoku Dragon guides | basics, locked candidates / subgroup exclusion, hidden/naked subsets, X-Wing, Swordfish, Jellyfish, coloring, multi-coloring, XY-Wing; Sudoku Dragon also mentions Chain Permutation and Alternate Pair | existing basics, subsets, fish, coloring, XY-Wing; chain permutation / alternate pair are not separately named | covered except alternate-pair / permutation terminology remains unscoped |
| SudokuWiki solver page detail | Quad Forcing Chains option | no dedicated `quad-forcing-chains` id | new unscoped forcing variant; do not claim coverage |

## Missing / Non-Claimed External Names

These names were found externally but are not currently safe to advertise as fully implemented:

| External name | Current decision | Reason |
| --- | --- | --- |
| BUG Lite | missing / future proof family | Requires a broader BUG graph than the current conservative `bug-plus-n` shared-extra model |
| Gurth's Theorem | non-claimed lead | Needs explicit scope and examples before deciding whether it is a solver technique, uniqueness diagnostic, or non-goal |
| Guardians | non-claimed lead | Community term is broad; current uniqueness/fish/pattern guardians are subtype evidence, not a public technique |
| Multivalue X-Wing | non-claimed lead | Needs semantic split from ALS / fish / forcing before adding a name |
| Y-Wing Chain | covered-as-variant candidate | Likely maps to `xy-chain` / `bidirectional-y-cycle`, but no separate public id currently planned |
| Kraken Fish | missing / future forcing+fish proof family | Requires fish plus branch proof and is not equivalent to current ordinary finned fish |
| Siamese Fish | partial / not explicitly tagged | Existing fish may hit representative cases, but no explicit subtype evidence is pinned |
| Endofin / cannibal / overlap fish | partial / not explicitly tagged | Current matrix has ordinary/finned/sashimi/Franken/mutant coverage, but not a dedicated endofin/overlap proof |
| Cyclopes Fish | missing / unscoped fish variant | Current fish ids start from ordinary size-2 X-Wing and do not claim one-house cyclops-style logic |
| Finned / Sashimi larger fish, Squirmbag / Starfish / Whale / Leviathan variants | partial | `larger-fish` covers conservative ordinary size 5/6/7 fish, not all named finned/sashimi/complex larger-fish variants |
| Aligned Triplet Exclusion | missing | `aligned-pair-exclusion` cannot be advertised as triplet/general aligned exclusion without a separate finder or proof model |
| ALS-W-Wing / ESP / ERIP | missing or unscoped ALS variants | Current ALS ids do not pin these names; add examples before deciding whether they map to ALS-AIC |
| ALS transport / S-Wing / M-Wing as ALS transport | unscoped ALS-chain variants | Current `aic-als` and wing ids do not expose ALS transport as a named proof shape |
| BARNs / Bent Almost Restricted Naked Sets | missing or unscoped bent-set family | Current `wxyz-wing`, `big-wings` and ALS ids may overlap but do not claim general BARNs |
| Almost Hidden Set / Almost Almost Hidden Set | missing or unscoped AHS family | Existing ALS ids and occasional AHS evidence nodes do not expose AHS as a searchable public technique |
| Distributed Disjointed Subset / Almost Distributed Disjointed Subset | missing or unscoped rank family | Current `sue-de-coq` / `death-blossom` do not claim this broader rank-logic family |
| Subset Counting / set-counting logic | unscoped rank/set-counting family | SudoCue describes it as a powerful theory behind XY-Wing, XYZ-Wing, APE and ALS, but classic9 has no general set-counting finder |
| M-Wing / Medusa Wing / Split-Wing / Hybrid-Wing / Local-Wing | unscoped chain/wing variants | They may reduce to AIC or XY-chain patterns, but classic9 has no named evidence or reference rows |
| XYZ-Loop / Fit Ring / Fat Ring | unscoped wing/loop variants | Existing wing and AIC finders may overlap but do not claim these structures |
| Alternate Pair / Chain Permutation | unscoped chain/permutation terminology | May overlap with XY-Wing, remote pairs, subsets or AIC, but classic9 has no named evidence rows |
| VWXYZ-Wing / UVWXYZ-Wing / TUVWXYZ-Wing / RSTUVWXYZ-Wing | partial / unscoped large-wing family | `wxyz-wing` and ALS-stem `big-wings` do not prove coverage for these named larger wings |
| Whip / grouped whip / braid-style logic | missing / future forcing-chain family | Needs a different proof-tree and rating boundary than current bounded forcing summaries |
| Forcing XY-Chains / Double Forcing Chains / Contradiction Forcing Chains | unscoped forcing variants | Current forcing ids may overlap behaviorally but do not expose these names or proof shapes |
| Quad Forcing Chains / Rectangle Forcing Chains / BUG+n Forcing Chains | unscoped forcing variants | Current forcing ids do not expose these names or their proof-tree starting sets |
| Aligned Exclusion beyond pairs | missing | Pair-only APE is implemented; broader aligned exclusion is not |
| Borescoper's Deadly Pattern / Qiu's Deadly Pattern / Unique Matrix / Uniqueness Clue Cover | missing uniqueness subtypes | Need source examples and uniqueness proof nodes before implementation |
| Reverse BUG / rotating or anonymous deadly patterns | missing or unscoped uniqueness subtypes | Current BUG ids are conservative BUG+1/+2/+n shapes only |
| MUG / PUG / YUCK / Almost UR / Almost Unique Rectangle / Almost BUG / Almost MUG | missing or unscoped uniqueness / unavoidable-set families | Current uniqueness ids do not expose these community names or proof shapes |
| Bi-value Oddagon / Tri-value Oddagon / Broken Loop / Domino Loop | missing or partial loop families | Do not equate to `unique-loop` or `sk-loops` without subtype fixtures |
| Universal Unavoidable Candidate / Thor's Hammer | missing or unscoped advanced logic | Current pattern / forcing ids do not expose these named proof models |
| Multi-sector Locked Sets / rank logic | unscoped | Could be a future rank-logic family; not currently part of classic9 technique ids |
| Law of Leftovers | non-goal for now | Mostly associated with jigsaw / region variants; classic9 is standard 9x9 only |
| Junior / Senior / Weak / Complex / Generalized Exocet subtypes | partial | `exocet` and `double-exocet` exist, but subtype breadth is not audited |
| 3D Sue de Coq / Generalized Sue de Coq subtypes | partial | `sue-de-coq` exists but does not claim all named variants |
| Brute Force | non-goal | Not a human-step `TechniqueId`; forcing families remain bounded logical proofs |

## Test And Fixture Implications

The external pass changes priorities but does not require immediate solver behavior changes.

| Priority | Work item | Fixture target |
| --- | --- | --- |
| P0 | Keep negative smoke complete for all public ids | Current reference smoke has no public id with `-Smoke = 0`; future ids must add no-hit guards with the positive smoke |
| P1 | Expand fish proof terminology | endofin / overlap / cannibal invalid-cover no-hit and solution-safety guards |
| P1 | Expand BUG and unique-loop proof models | BUG Lite lead rows, BUG+n multi-extra no-hit, larger unique-loop positive/no-hit |
| P1 | Strengthen ALS-chain boundary | `aic-als` endpoint role checks, no-target guards, and HoDoKu-style ALS chain source leads |
| P1 | Decide ATE / aligned exclusion scope | Aligned Triplet Exclusion positive/no-hit candidate-state smoke if implemented; otherwise explicit non-goal |
| P1 | Triage extra named wings | M-Wing / Medusa Wing / Split-Wing / Hybrid-Wing / Local-Wing / XYZ-Loop examples mapped to AIC-or-missing |
| P1 | Triage larger named wings | VWXYZ / UVWXYZ / TUVWXYZ / RSTUVWXYZ candidate-state rows or explicit mapping to a generalized wing finder |
| P1/P2 | Decide AHS and distributed subset scope | Almost Hidden Set and Distributed Disjointed Subset examples; classify as rank logic, ALS dual, or non-goal |
| P2 | Triage extra deadly patterns and oddagons | one trusted candidate-state row per accepted subtype, plus no-hit guard |
| P2 | Split forcing-start families if accepted | Quad / Rectangle / BUG+n / Forcing XY / Double / Contradiction forcing chain proof-shape rows |
| P2 | Add forcing proof-tree shape tests | dynamic-only, dynamic-plus-only, nested-only, over-budget no-hit, branch isolation |
| P2 | Preserve non-hit leads | external examples that solve earlier or time out stay in source lead logs, not rating corpus |

## Acceptance Update

This comparison satisfies the first external taxonomy pass if:

| Gate | Status |
| --- | --- |
| All mainstream SE / HoDoKu / SudokuWiki / Sudopedia / SudokuCoach public families have a classic9 mapping, partial marker, or non-goal reason | done |
| No new public `TechniqueId` is required before continuing 0.4.x proof work | done |
| Expanded sources that mention additional named techniques are recorded with missing / partial / unscoped decisions | done |
| High-risk partial areas are explicitly named | done |
| Source URLs and license cautions are recorded | done |
| Solver behavior remains unchanged | done |
