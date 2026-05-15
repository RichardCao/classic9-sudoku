# 高级技巧迁移评估

本文档用于评估已经吸收到公开库、但尚未作为 stable 默认技巧暴露的高级技巧。

结论：

1. 公开库第一版不应该一次性发布所有高级技巧。
2. 已经迁移的 stable 技巧应保持“小而可靠”。
3. 旧项目中的技巧已经全部吸收到公开库代码中；剩余工作主要是决定哪些 experimental 技巧值得进一步升级为 stable。

## 当前公开库 stable 技巧

当前已经稳定迁移并进入 `getTechniqueDefinitions()` 的技巧：

1. `full-house`
2. `naked-single`
3. `hidden-single`
4. `locked-candidates`
5. `naked-pair`
6. `hidden-pair`
7. `naked-triple`
8. `hidden-triple`
9. `naked-quad`
10. `hidden-quad`
11. `x-wing`
12. `swordfish`
13. `franken-swordfish`
14. `jellyfish`
15. `finned-x-wing`
16. `finned-swordfish`
17. `finned-jellyfish`
18. `sashimi-swordfish`
19. `sashimi-jellyfish`
20. `xy-wing`
21. `xyz-wing`
22. `wxyz-wing`
23. `w-wing`
24. `chute-remote-pairs`
25. `almost-locked-pair`
26. `almost-locked-triple`
27. `als-xz`
28. `als-xy-wing`
29. `aic-als`
30. `fireworks`
31. `twinned-xy-chains`
32. `sue-de-coq`
33. `death-blossom`
34. `aligned-pair-exclusion`
35. `exocet`
36. `double-exocet`
37. `pattern-overlay`
38. `tridagons`
39. `sk-loops`
40. `simple-coloring`
41. `multi-colors`
42. `three-d-medusa`
43. `grouped-x-cycles`
44. `grouped-aic`
45. `x-chain`
46. `xy-chain`
47. `aic`
48. `aic-exotic`
49. `skyscraper`
50. `turbot-fish`
51. `two-string-kite`
52. `empty-rectangle`
53. `unique-rectangle`
54. `avoidable-rectangle`
55. `rectangle-elimination`
56. `extended-rectangle`
57. `hidden-unique-rectangle`
58. `aic-ur`
59. `bug-plus-one`

这些技巧已经具备：

1. 结构化 `SolveStep`。
2. 中文 `formatStep` 展示。
3. 每个技巧的 focused test。
4. stable 技巧清单和 golden 覆盖断言。

## 已评估但未公开稳定的技巧

以下技巧已经在公开库中可显式调用，但还没有进入 stable 默认列表。是否升级为 stable，需要继续补齐证据结构、中文展示、focused test 和回归样例。

### 鱼类和变体

候选：当前本组主要候选已经迁移为 stable。

后续建议：

1. 如果继续扩展鱼类变体，仍要明确 basis house、cover line、fin、target 的 evidence 结构。
2. 混合 fish 变体必须保留 focused golden，避免 box basis 与 line basis 组合产生 false positive。

### 翼、ALS 和 bent set

候选：当前本组主要候选已经迁移为 stable。

迁移建议：

1. bent set 或 APE 这类结构进入 stable 前，必须证明删除动作不是依赖英文说明才能理解。
2. 一旦涉及 ALS 或可见关系枚举，必须保留最小 candidate golden，避免因为枚举范围调整引入 false positive。

### 链和 coloring

候选：当前本组候选已经迁移为 stable。

迁移建议：

1. 链类技巧应该共享一个稳定的 `links` evidence schema。
2. 不能只返回 `note`，必须能表达强链、弱链、端点、删除目标。
3. `x-chain`、`xy-chain`、`aic`、`grouped-x-cycles`、`grouped-aic` 应作为同一批验证，因为 link 建模错误会互相污染。
4. `empty-rectangle` 和 `turbot-fish` 可以在 `single-digit-chain` 家族中排在较前。

### 唯一性技巧

候选：当前本组主要候选已经迁移为 stable。

迁移建议：

1. 需要在文档里明确“唯一解假设”是技巧前提。
2. `SolveStep.evidence` 应包含 rectangle corners、floor/roof、extra candidates、target。
3. 这些技巧不应在 `uniqueness: skip` 的生成或评分语境下默认启用。

### forcing 和搜索类技巧

候选：

1. `forcing-nets`
2. `digit-forcing-chains`
3. `nishio-forcing-chains`
4. `cell-forcing-chains`
5. `unit-forcing-chains`
6. `bowmans-bingo`

迁移建议：

1. 第一版不应把这些技巧作为 stable 默认技巧。
2. 需要先定义分支证据结构，包括假设、分支步骤摘要、矛盾点和结论。
3. 需要严格控制运行预算，否则生成器和评分会不可预测。
4. 可以先作为 `experimental` 技巧暴露，并默认不进入 `classic-stable.v1`。
5. 旧项目里不少 forcing 教学例子是“中途候选态”而不是纯题面例子。公开库做 raw-board 回归时，不应该强行要求它们在当前预算下复刻同一目标动作；这类样例更适合作为 `trusted` 候选态测试，或作为文档里的“来源参考”。

### 其它高级结构

候选：当前本组中的 `sk-loops` 已进入 stable，其余复杂结构当前主要集中在 forcing / 分支搜索一侧。

迁移建议：

1. 如果后续继续扩展更宽的 SK Loop 家族形态，仍要先补结构样例和回归。
2. 这些技巧都需要先明确结构范围和最小可解释证据，不能只给出删除动作。

## 推荐迁移顺序

当前公开库第一版已经吸收了旧项目里的全部技巧。后续工作不再是“是否吸收”，而是“哪些 experimental 技巧可以继续升级为 stable”。建议按下面顺序推进：

### 第一批：experimental 搜索类

1. forcing families
2. `bowmans-bingo`

前置条件：

1. 明确运行预算。
2. 明确 experimental 标记。
3. 不默认进入通用评分规则。
4. 使用 harder puzzle 回归集验证 false positive 风险。

## 每个技巧进入 stable 的验收标准

1. 技巧 id 出现在 `TECHNIQUE_DEFINITIONS`。
2. `nextStep` 可以通过 `allowedTechniques` 单独命中该技巧。
3. `SolveStep.actions` 可回放。
4. `SolveStep.evidence` 不依赖英文 `note` 才能理解。
5. `formatStep` 有中文说明。
6. 有 focused test。
7. 至少有一个真实题或候选态 golden。
8. 如果技巧依赖唯一解、分支或搜索预算，文档必须明确说明。

## 当前不建议直接迁移的内容

不建议在公开库中作为独立 stable 技巧添加：

1. `remote-pairs`
2. `y-wing-chain`
3. `multivalue-x-wing`
4. `guardians`

这些更适合作为 deprecated 技巧或更通用技巧的特例。如果未来需要，可以作为更通用链类技巧的内部识别结果，而不是公开独立技巧。
