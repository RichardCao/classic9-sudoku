# Learning Sample Explanation Plan

本文档只记录改造计划，不直接修改 classic9 源码。目标是解决两类问题：

1. 所有已实现技巧都要有用户能读懂的技巧介绍，不能依赖默认占位话术。
2. 学习样例的解释要能根据每个命中的具体题面生成，说明“这个题此刻为什么能用这个技巧”，而不是只给通用定义。

## Current State

当前解释链路分三层：

- 技巧定义：`src/solver/techniques.ts` 的 `TECHNIQUE_DEFINITIONS` 只包含 `id`、中英文名称、技巧族、分值、稳定性、SE 元数据等，不包含完整教学解释。
- 单步证据：各 finder 返回 `SolveStep.evidence`，部分步骤包含 `evidence.note`。当前 `src/solver/techniques.ts` 中可检出的 `note` 字面量只有 31 条，而已实现技巧有 86 个，说明很多技巧没有 finder 级的专属说明。
- 展示文案：`src/presentation/index.ts` 的 `formatTechniqueReason()` 按 `TechniqueId` 拼部分说明；`scripts/build-learning-samples.mjs` 的 `techniqueGuide()` 又按 `family` 生成 `intro` / `whenToUse` / `whyThisWorks`。

当前主要问题：

- `techniqueGuide()` 是按 family 写的，无法解释具体技巧的结构差异。例如 `aic`、`aic-exotic`、`grouped-aic` 都会落到相似的链式介绍，学习价值有限。
- `formatTechniqueReason()` 虽然覆盖了很多技巧，但主要是单句模板，缺少“如何在当前题面识别结构”的过程说明。
- `evidence.note` 覆盖不完整，且有中英文混杂。它适合作为开发侧 proof hint，不适合作为最终教学文案的唯一来源。
- 样例解释目前包含 `boardBefore`、`candidatesBefore`、`targetStep`、`formattedStepZh`，但没有系统地把候选分布、关键格角色、动作结果、前置状态和简单替代技巧组织成一段教学说明。
- 当前样例里 `simpleAlternativeTechniques` 只是排序/筛选辅助信息，没有转化成“为什么这个样例适合学习当前技巧”的用户文案。

## External Reference Baseline

外部资料只作为术语边界、技巧族划分和解释要点参考，不复制外部文案，也不把外部求解器的搜索顺序当作 classic9 的契约。

建议参考资料：

- HoDoKu 技巧页：用于核对技巧族、常见 subtype、fish/wing/chain/ALS/uniqueness 的教学组织方式。
- SudokuWiki Strategy Families：用于核对面向用户的技巧入口、图片化解释习惯和基础到高级的学习路径。
- Sudoku Explainer / Sukaku Explainer 相关 FAQ 和兼容文档：用于核对 forcing、dynamic forcing、nested forcing、SE difficulty 名称边界。
- classic9 现有文档：`docs/TECHNIQUES.md`、`docs/SE_COMPATIBILITY.md`、`docs/SE_CHAIN_MATRIX.md`、`docs/SE_UNIQUENESS_MATRIX.md`，用于保证解释不会越过当前实现能力。

采用原则：

- 只采纳“这个技巧需要解释哪些结构”的要点，不采纳外部逐字表述。
- 如果外部资料和 classic9 当前实现边界不一致，以 classic9 的 `TechniqueId`、`SolveStep.evidence` 和测试行为为准。
- 对 SE / HoDoKu 中存在但 classic9 尚未完整同构的技巧，解释必须写成 classic9 当前口径，例如 `table-chain` 不能宣称完全等同 SE Table Chain。
- 对 uniqueness 技巧，外部资料常默认标准数独唯一解前提；classic9 文案必须显式提示这个前提，避免用户误以为是普通候选约束。
- 对 forcing 技巧，外部资料常用“假设导致矛盾”或“多分支共同结论”描述；classic9 文案必须额外说明预算、截断和 branch summary 的含义。

## Task 1: Update All Technique Explanations

目标：为所有已实现技巧建立专属解释资料，不再依赖 family 默认介绍。

### Proposed Explanation Catalog

新增一个独立解释目录，建议后续实现为 `src/presentation/technique-explanations.ts` 或相近模块。每个 `TechniqueId` 一条记录。

建议字段：

- `id`: 技巧 id。
- `nameZh` / `nameEn`: 展示名，可复用 definition，但解释目录应显式引用，避免名称缺失。
- `oneLineZh`: 一句话解释，面向技巧列表。
- `conceptZh`: 技巧核心概念，解释这个技巧在解决什么结构问题。
- `spottingZh`: 用户看题时如何识别这个技巧，必须包含候选分布特征。
- `proofIdeaZh`: 为什么这个技巧成立，说明逻辑依据。
- `actionZh`: 这个技巧通常会产生什么动作，例如落子、删候选、共同结论、唯一性删候选。
- `evidenceRolesZh`: 解释 evidence 中常见角色，如 `reason`、`target`、`pivot`、`base`、`cover`、`fin`、`guardian`、`branch`。
- `commonPitfallsZh`: 容易误解或误用的点，尤其是 uniqueness、forcing、ALS、fish、Exocet 等。
- `prerequisitesZh`: 如果依赖唯一解、分支试探、模板枚举或其它前提，需要明确告诉用户。
- `shortTemplateZh`: 单步短解释模板。
- `teachingTemplateZh`: 学习样例长解释模板。
- `qualityTags`: 用于 lint 的标签，如 `mentionsDigit`、`mentionsTargetCell`、`mentionsHouses`、`mentionsBranches`。

建议 TypeScript 结构：

```ts
interface TechniqueExplanation {
  id: TechniqueId;
  audienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  oneLineZh: string;
  conceptZh: string;
  spottingZh: string;
  proofIdeaZh: string;
  actionZh: string;
  evidenceRolesZh: Record<string, string>;
  prerequisitesZh?: string[];
  commonPitfallsZh?: string[];
  implementationNotesZh?: string[];
  shortTemplateZh: ExplanationTemplate;
  teachingTemplateZh: ExplanationTemplate;
  renderer: ExplanationRendererId;
  requiredEvidence: EvidenceRequirement[];
  qualityTags: ExplanationQualityTag[];
}
```

模板不是简单字符串拼接，应该允许引用上下文字段：

```ts
type ExplanationTemplate =
  | { type: 'static'; text: string }
  | { type: 'parts'; parts: ExplanationTemplatePart[] };

type ExplanationTemplatePart =
  | { kind: 'text'; value: string }
  | { kind: 'digit'; source: 'action' | 'evidence' }
  | { kind: 'cells'; role: string; min?: number }
  | { kind: 'houses'; role?: string; min?: number }
  | { kind: 'branches'; summary: 'short' | 'teaching' };
```

这样做的目的：

- 缺少关键字段时 renderer 可以报 `insufficient-evidence`，而不是生成空话。
- 技巧解释可以复用，但每个样例仍然引用自己的格子、数字、区域和分支。
- 后续可以支持英文解释，不必重写样例生成逻辑。

解释目录必须覆盖所有已实现技巧。目前 dist 中可见的技巧总数为 86。这个数字是当前快照；实际实现和 lint 必须以运行时 `getTechniqueDefinitions()` 为准，新增或移除技巧时文案 catalog 必须同步更新。

- `single`: `full-house`, `naked-single`, `hidden-single`
- `intersection`: `locked-candidates`, `direct-pointing`, `direct-claiming`
- `subset`: `direct-hidden-pair`, `naked-pair`, `hidden-pair`, `naked-triple`, `direct-hidden-triplet`, `hidden-triple`, `naked-quad`, `hidden-quad`
- `fish`: `x-wing`, `swordfish`, `franken-swordfish`, `finned-franken-swordfish`, `finned-franken-jellyfish`, `jellyfish`, `finned-x-wing`, `sashimi-x-wing`, `finned-swordfish`, `finned-jellyfish`, `sashimi-swordfish`, `sashimi-jellyfish`
- `wing`: `xy-wing`, `xyz-wing`, `wxyz-wing`, `w-wing`, `chute-remote-pairs`, `remote-pairs`
- `als`: `big-wings`, `almost-locked-pair`, `almost-locked-triple`, `almost-locked-quad`, `als-xz`, `als-xy-wing`, `aic-als`, `fireworks`, `twinned-xy-chains`, `sue-de-coq`, `death-blossom`, `aligned-pair-exclusion`
- `coloring`: `bidirectional-x-cycle`, `simple-coloring`, `x-coloring`, `multi-colors`, `three-d-medusa`
- `chain`: `bidirectional-y-cycle`, `forcing-chain`, `grouped-aic`, `x-chain`, `xy-chain`, `aic`, `aic-exotic`
- `single-digit-chain`: `forcing-x-chain`, `grouped-x-cycles`, `skyscraper`, `two-string-kite`, `turbot-fish`, `empty-rectangle`
- `forcing`: `forcing-nets`, `digit-forcing-chains`, `nishio-forcing-chains`, `cell-forcing-chains`, `unit-forcing-chains`, `region-forcing-chains`, `table-chain`, `dynamic-forcing-chains`, `dynamic-forcing-chains-plus`, `nested-forcing-chains`, `bowmans-bingo`
- `pattern`: `exocet`, `double-exocet`, `pattern-overlay`, `tridagons`, `sk-loops`
- `uniqueness`: `unique-rectangle`, `avoidable-rectangle`, `rectangle-elimination`, `extended-rectangle`, `hidden-unique-rectangle`, `aic-ur`, `bug-plus-one`, `bug-plus-two`, `bug-plus-n`

### Explanation Quality Rules

每个技巧解释必须满足：

- 不允许出现“当前 classic9 已实现的解题技巧”“见结构化证据”“可对目标执行本步骤”这类默认占位话术。
- `oneLineZh` 必须说明该技巧的核心结构，不只是重复技巧名。
- `spottingZh` 必须告诉用户看什么候选布局。
- `proofIdeaZh` 必须能回答“为什么可以删这个候选/填这个数”。
- 对 uniqueness 技巧必须明确“依赖唯一解假设”。
- 对 forcing 技巧必须明确“假设分支、矛盾、共同结论、预算截断”的含义。
- 对 fish 技巧必须区分普通、带鳍、刺身、Franken 的删除条件。
- 对 chain / coloring 技巧必须说明强链、弱链、端点、共同可见或颜色冲突。
- 对 ALS 技巧必须说明 ALS 的“n 格 n+1 数”基础，以及 restricted common / 外部共同候选。
- 对 pattern 技巧必须说明这是特殊结构，不应被说成普通链或普通数组。

禁用短语 lint 只扫描最终解释 catalog 字段和生成后的样例解释输出，不扫描本文档的规则说明区，否则会因为规则本身列出禁用短语而误报。

### Technique Explanation Work Breakdown

建议把当前技巧全集分四批完成。当前快照为 86 个技巧，但实际分批清单应由 `getTechniqueDefinitions()` 和文案 catalog lint 生成，避免 classic9 后续新增技巧后遗漏。

第一批：基础和低风险技巧。

- 范围：`single`、`intersection`、`subset`、普通 `fish`、普通 `wing`。
- 目标：先把用户最容易遇到的技巧写清楚，建立解释 catalog、lint 和 snapshot 测试框架。
- 重点：候选唯一性、区域唯一性、显性/隐性数组、普通 fish 的 base/cover 概念。

第二批：链、染色、single-digit-chain。

- 范围：`x-chain`、`xy-chain`、`aic`、`grouped-aic`、`aic-exotic`、`simple-coloring`、`x-coloring`、`multi-colors`、`three-d-medusa`、`skyscraper`、`two-string-kite`、`turbot-fish`、`empty-rectangle` 等。
- 目标：把强链、弱链、端点、共同可见、颜色冲突、分组节点解释成用户能读懂的语言。
- 重点：所有链类解释必须引用实际 link endpoints；如果当前 evidence 不足，先标记 evidence gap。

第三批：ALS、uniqueness、pattern。

- 范围：ALS family、UR/BUG family、Exocet、Pattern Overlay、Tridagons、SK Loops。
- 目标：解释复杂结构的前提、角色和删除条件，不能只写技巧名。
- 重点：唯一解假设、ALS 的 n 格 n+1 数、restricted common、guardian/base/target/template 角色。

第四批：forcing / search-like。

- 范围：`forcing-nets`、`digit-forcing-chains`、`cell-forcing-chains`、`unit-forcing-chains`、`region-forcing-chains`、`table-chain`、`dynamic-forcing-chains`、`dynamic-forcing-chains-plus`、`nested-forcing-chains`、`bowmans-bingo`、`nishio-forcing-chains`。
- 目标：把分支假设、矛盾定位、共同结论、预算截断讲清楚。
- 重点：forcing 解释必须避免“试出来所以对”的印象，要说明逻辑上覆盖了哪些可能性，以及 branch 是否被截断。

### Implementation Plan For Task 1

1. 增加解释数据模型。
   建议先定义 `TechniqueExplanation` 类型，不直接扩展 `TechniqueDefinition`。`TechniqueDefinition` 更偏 API 元数据，解释目录更偏 presentation/learning。

2. 建立当前全部技巧的解释清单。
   先按 family 批量起草，再逐个技巧补差异。不要用 family 默认值当最终文案。

3. 把 `techniqueGuide()` 改为读取解释目录。
   `intro`、`whenToUse`、`whyThisWorks` 分别映射到 `conceptZh`、`spottingZh`、`proofIdeaZh`。

4. 把 `formatTechniqueReason()` 改成解释目录驱动。
   技巧专用模板继续保留，但从集中 switch 迁移到每个技巧的 renderer 或 template 配置。

5. 给每个技巧补 evidence role 映射。
   例如 fish 的 `base` / `cover` / `fin`，forcing 的 `assumption` / `contradiction`，uniqueness 的 `corner` / `roof` / `deadly pair`，ALS 的 `pivot` / `restricted common`。

6. 增加解释 lint。
   建议新增脚本检查：
   - 当前 `getTechniqueDefinitions()` 返回的全部技巧都有解释。
   - 每个解释字段非空。
   - 禁止默认占位短语。
   - 中文解释不能只包含英文技巧名。
   - 需要唯一解/分支/模板枚举的技巧必须声明前提。

7. 增加展示快照测试。
   对每个技巧至少保留一个 `SolveStep` fixture，验证 `formatStep(..., style: 'teaching')` 输出包含动作、关键格/区域、技巧核心词和 proof idea。

## Task 2: Generate Sample Explanations From Each Hit Puzzle

目标：学习样例解释不只是“这个技巧是什么”，还要说明“这个题、这个步骤、这些候选为什么构成这个技巧”。

### Proposed Explanation Pipeline

每个样例生成解释时使用以下输入：

- 原题：`puzzle`、`solution`、`difficulty`、`puzzleId`。
- 命中状态：`scenario.boardBefore`、`scenario.candidatesBefore`。
- 目标步骤：`targetStep.technique`、`targetStep.actions`、`targetStep.evidence`。
- 前置步骤摘要：`stepsBeforeSummary`。
- 题目整体信息：`hitStepNumber`、`puzzleHardestTechnique`、`puzzleStepCount`、`baselineDifficultyScore`。
- 选择质量信息：`simpleAlternativeTechniques`、`validation`。

建议输出结构：

- `sampleExplanationZh.title`: 标题，例如“在 epic-082 第 1 步学习 Bowman's Bingo”。
- `sampleExplanationZh.context`: 当前局面上下文，例如“这是原题开局状态 / 已经过 6 步基础技巧后出现的结构”。
- `sampleExplanationZh.spotting`: 结合当前候选盘说明结构如何出现，必须引用实际格子、数字、区域。
- `sampleExplanationZh.action`: 明确动作，例如“删除 r2c4 的候选 8”。
- `sampleExplanationZh.reasoning`: 用当前 evidence 解释为什么该动作成立。
- `sampleExplanationZh.afterEffect`: 说明动作后候选盘发生了什么，落子/删候选带来的推进价值。
- `sampleExplanationZh.simplicityCheck`: 如果 `simpleAlternativeTechniques` 为空，说明“此刻没有检测到更简单的稳定技巧”；如果不为空，列出并提示这是学习样例取舍。
- `sampleExplanationZh.validation`: 样例是否通过 target step 校验，是否存在 action issue。
- `sampleExplanationZh.preSteps`: 可选，说明命中前最后几步如何把局面推进到该结构。

### Sample Generation Algorithm

建议用一个确定性 explanation service 生成样例解释，避免每次运行文案漂移。

输入：

```ts
interface BuildLearningExplanationInput {
  sample: LearningSample;
  definition: TechniqueDefinition;
  explanation: TechniqueExplanation;
  scenario: {
    boardBefore: number[] | null;
    candidatesBefore: number[] | null;
    boardAfter: number[] | null;
    candidatesAfter: number[] | null;
  };
}
```

流程：

1. `extractContext()`
   从 action、evidence、scenario 中抽取 `targetCells`、`reasonCells`、`digits`、`houses`、`links`、`branches`、`candidateBefore/After`。

2. `validateEvidenceForTechnique()`
   使用 `TechniqueExplanation.requiredEvidence` 检查 evidence 是否足够。缺关键字段则返回 `quality = insufficient-evidence` 和 gap codes。

3. `renderSpotting()`
   解释如何在当前题面看到结构。必须使用当前样例的具体格子、数字、区域。

4. `renderAction()`
   用动作生成明确句子，例如“因此删除 r4c9 的候选 5”。多个动作要分组，避免长句难读。

5. `renderReasoning()`
   调用 technique renderer。forcing 用 branch renderer；chain 用 link renderer；fish 用 base/cover renderer；uniqueness 用 deadly-pattern renderer。

6. `renderSimplicityCheck()`
   根据 `simpleAlternativeTechniques` 输出：
   - 空：当前状态没有检测到更简单的稳定技巧，适合作为该技巧学习样例。
   - 非空：列出简单技巧，并说明该样例用于观察目标技巧，小游戏可选择是否展示提示。

7. `renderValidation()`
   如果 `validation.targetStepValid` 为真，写“该步骤动作可回放，未发现候选合法性问题”。否则设置 `quality = invalid`，不得进入小游戏文件。

8. `scoreExplanationQuality()`
   根据证据完整度、引用数量、验证结果、简单替代技巧数量给出 `good` / `usable` / `insufficient-evidence` / `invalid`。

输出应稳定排序字段，方便 diff 和审校。

### Example Explanation Shape

以下是目标格式示意，不是最终文案：

```json
{
  "sampleExplanationZh": {
    "title": "在 epic-082 第 1 步学习 Bowman's Bingo",
    "context": "这是题目开局状态，目标技巧在第 1 步命中。",
    "spotting": "观察 r2c4 的候选 8：它是本步试探分支的入口。",
    "action": "删除 r2c4 的候选 8。",
    "reasoning": "如果假设 r2c4 = 8，分支在有限推导内导致第 5 列数字 8 无处可放，因此该假设不可能成立。",
    "simplicityCheck": "当前状态仍检测到 hidden-single 等更简单技巧；该样例用于学习 Bowman's Bingo 的分支证据。",
    "validation": "目标步骤可回放，动作没有候选合法性问题。",
    "quality": "usable",
    "referencedCells": ["r2c4"],
    "referencedDigits": [8],
    "referencedHouses": ["第 5 列"]
  }
}
```

真实实现必须从 `targetStep.evidence.branches[0].contradictionAt` 等字段生成这些内容，不能手写。

### Technique-specific Renderer

不能只用一个通用模板。建议按技巧族提供基础 renderer，再为复杂技巧覆盖专属 renderer。

基础 renderer 分层：

- `singleRenderer`: 强调唯一候选/唯一位置。
- `subsetRenderer`: 说明数组格、数组数字、删哪些候选。
- `fishRenderer`: 说明目标数字、base houses、cover houses、fin/sashimi/franken 结构、删除范围。
- `wingRenderer`: 说明 pivot、wing、共同可见目标。
- `alsRenderer`: 说明 ALS 集合、restricted common、目标候选。
- `chainRenderer`: 说明链端、强弱链、共同可见或端点关系。
- `coloringRenderer`: 说明颜色、冲突/夹击、删除原因。
- `forcingRenderer`: 说明假设分支、每个分支状态、矛盾位置或共同结论。
- `patternRenderer`: 说明 Exocet / Pattern Overlay / Tridagons / SK Loop 的专属结构。
- `uniquenessRenderer`: 说明唯一解前提、致命模式、要删除的候选。

专属 renderer 优先级：

1. `techniqueRenderer[techniqueId]`
2. `familyRenderer[family]`
3. fail hard，不允许静默退回默认废话

### Evidence Requirements

为了让样例解释能真正依赖题面，后续 classic9 finder 应尽量补齐结构化 evidence。建议最低要求：

- 所有步骤都要有 `actions`，且动作可回放。
- `evidence.cells` 中关键格必须有 role，不要只放 cell。
- `evidence.houses` 必须包含能解释结构的区域，不只是目标格所在区域。
- chain / coloring 必须提供 `links` 或可解释的端点信息。
- forcing 必须提供 `branches`，包括 assumption、contradiction/exhausted、contradictionAt、actions 摘要、truncated/stopReason。
- fish 必须标明 digit、base/cover、fin 或 guardian。
- uniqueness 必须标明 deadly pair、rectangle corners、roof/target、唯一解前提。
- pattern 技巧必须标明该模式的基础格、目标格、guardian/base/target/template 等角色。

如果某个技巧暂时拿不到足够 evidence，样例生成器应把它标记为 `explanationQuality: "insufficient-evidence"`，不要生成看似具体但实际空泛的教学文本。

### Detailed Evidence Matrix

以下矩阵用于指导后续 finder 补 evidence，以及 renderer 判断是否能生成高质量样例解释。

| 技巧族 | 必需 evidence | 推荐 roles | 解释必须回答的问题 |
| --- | --- | --- | --- |
| `single` | target cell、digit、house 可选 | `target`, `reason` | 为什么这个格/区域只剩一个可能？ |
| `intersection` | digit、box、line、被删目标 | `reason`, `target`, `base`, `cover` | 候选为什么被锁在交叉区域？哪些同线/同宫候选因此删除？ |
| `subset` | subset cells、subset digits、house、targets | `reason`, `subset`, `target` | 这组数字为什么只能占这组格？删除的是数组外候选还是数组内其它候选？ |
| `fish` | digit、base houses、cover houses、targets | `base`, `cover`, `target`, `fin`, `sashimi`, `overlap` | 基线和覆盖线如何锁住该数字？带鳍/刺身/Franken 的删除条件是什么？ |
| `wing` | pivot、wings、target、digit | `pivot`, `wing`, `target`, `reason` | 无论 pivot 走哪种可能，为什么目标候选都不成立？ |
| `als` | ALS cells、ALS digits、restricted common、target | `als`, `pivot`, `restricted-common`, `target`, `petal` | ALS 如何被限制？共同外部候选为什么能删？ |
| `chain` | ordered links、endpoints、target | `endpoint`, `link`, `target`, `group` | 强弱链端点形成什么关系？目标如何同时受端点约束？ |
| `single-digit-chain` | digit、strong links、endpoints、target | `endpoint`, `strong-link`, `target` | 单数字强链如何形成图形结构？目标为什么共同可见？ |
| `coloring` | digit 或多数字节点、颜色、冲突/夹击 | `color-a`, `color-b`, `conflict`, `target` | 哪个颜色不可能？或目标为什么同时看见两种颜色？ |
| `uniqueness` | deadly pair、rectangle cells、roof/target、unique premise | `corner`, `roof`, `deadly-pair`, `target` | 如果不删除会形成什么多解/致命结构？唯一解前提在哪里使用？ |
| `pattern` | technique-specific structure | `base`, `target`, `guardian`, `template`, `loop` | 该特殊结构的核心角色是什么？动作违反了哪个结构约束？ |
| `forcing` | branches、assumptions、contradiction/common action、budget | `assumption`, `branch-target`, `contradiction`, `common-action` | 分支覆盖了哪些可能？矛盾在哪里？共同结论是否受预算影响？ |

必要的 evidence gap 分类：

- `missing-target`: 找不到目标动作或目标格。
- `missing-digit`: 无法确定解释中的目标数字。
- `missing-structure-cells`: 没有足够关键格解释结构。
- `missing-houses`: 没有区域信息，无法说明行列宫关系。
- `missing-links`: 链/染色技巧没有 link 或端点。
- `missing-branches`: forcing 技巧没有 branch summary。
- `missing-pattern-roles`: pattern/uniqueness/ALS 技巧缺少专属角色。
- `invalid-action`: 动作验证失败。

这些 gap 应进入样例质量报告，帮助 classic9 后续补 finder evidence。

### Sample Explanation Selection Rules

后续学习样例筛选应把解释质量纳入排序：

- 优先选择 `explanationQuality = good` 的样例。
- 优先选择实际引用了具体格子、数字、区域、链/分支证据的样例。
- 优先选择 `simpleAlternativeTechniques.length === 0` 的样例。
- 优先选择难题中的样例，但不能牺牲动作正确性和解释完整性。
- 如果同一技巧只有少数有效样例，允许题目集中，但报告中要标注原因。
- 如果样例动作验证失败，即使命中技巧也不能进入小游戏学习文件。

### Explanation-aware Merge Rules

最终小游戏样例合并时，建议把解释质量作为第一层过滤：

1. 丢弃 `quality = invalid`。
2. 默认只选择 `good` 和 `usable`。
3. 如果某技巧不足 3 个，但存在 `insufficient-evidence` 样例，不进入小游戏文件，写入 underfilled 文档，原因标为 `needs-evidence`。
4. 同一技巧有多个候选时排序：
   - `good` 优先于 `usable`
   - `simpleAlternativeTechniques.length` 少者优先
   - 解释引用的 cells/houses/links/branches 更多者优先
   - validation 完整者优先
   - 难题优先
   - 题目复用少者优先
5. 如果为了凑满 3 个必须使用同一道题多个样例，报告中注明“候选池不足导致集中”，而不是静默接受。

### Output Schema Proposal

在现有样例字段之外，建议新增：

```ts
interface SampleExplanationZh {
  title: string;
  context: string;
  spotting: string;
  action: string;
  reasoning: string;
  afterEffect?: string;
  simplicityCheck?: string;
  prelude?: string;
  validation: string;
  quality: 'good' | 'usable' | 'insufficient-evidence' | 'invalid';
  evidenceGaps: string[];
  referencedCells: string[];
  referencedDigits: number[];
  referencedHouses: string[];
}
```

`SampleExplanationZh` 是 `sampleExplanationZh` 字段的建议类型。`teachingTextZh` 可以保留作为兼容字段，但小游戏优先读取新的 `sampleExplanationZh`。

### Implementation Plan For Task 2

1. 定义解释中间模型。
   从 `SolveStep`、`scenario` 和 `TechniqueExplanation` 生成 `ExplanationContext`，统一格式化 cell、house、digit、action。

2. 给每个 family 建基础 renderer。
   先保证所有技巧都能生成结构化解释对象，但不允许输出默认占位。

3. 给复杂技巧补专属 renderer。
   优先顺序建议：
   - Forcing：`forcing-nets`、`digit-forcing-chains`、`cell-forcing-chains`、`unit-forcing-chains`、`table-chain`、`bowmans-bingo`
   - Uniqueness：`unique-rectangle`、`bug-plus-one`、`hidden-unique-rectangle`、`aic-ur`
   - Pattern：`exocet`、`double-exocet`、`pattern-overlay`、`tridagons`、`sk-loops`
   - ALS：`sue-de-coq`、`death-blossom`、`aligned-pair-exclusion`、`fireworks`
   - Chains/coloring：`aic`、`aic-exotic`、`grouped-aic`、`three-d-medusa`

4. 更新样例生成脚本。
   `build-learning-samples.mjs` 中 `buildTeachingText()` 改为调用新的 explanation service。输出 `sampleExplanationZh`，同时保留旧字段。

5. 增加样例解释审计脚本。
   建议对最新最终样例文件全量检查：
   - 标题、context、spotting、action、reasoning 均非空。
   - 至少引用一个实际格子或区域。
   - 至少引用目标动作中的 digit。
   - 不包含默认占位短语。
   - validation 不通过时 quality 必须是 `invalid`，且不能进入小游戏文件。

6. 生成解释质量报告。
   报告按技巧列出：
   - 3 个样例的 quality。
   - 是否有更简单技巧同时可用。
   - 是否缺少关键 evidence。
   - 是否来自同一题过多。

7. 重新合并小游戏样例。
   合并时先过滤 invalid，再优先 good，其次 usable。对于 underfilled 技巧，文档记录“缺样例”还是“有命中但解释证据不足”。

### Audit Script Details

建议新增 `scripts/audit-learning-explanations.mjs`，分三类检查。

技巧解释 catalog 检查：

- `missing-explanation`: definition 中存在但 catalog 缺失。
- `empty-field`: 关键字段为空。
- `generic-text`: 命中禁用短语。
- `missing-prerequisite`: uniqueness / forcing / pattern 等缺少前提说明。
- `renderer-missing`: 没有 renderer。

样例解释检查：

- `missing-sample-explanation`: 样例没有 `sampleExplanationZh`。
- `invalid-quality`: validation 失败但 quality 不是 `invalid`。
- `no-current-cell-reference`: 解释没有引用当前题面的具体格。
- `no-action-digit-reference`: 解释没有引用目标动作数字。
- `no-evidence-reference`: 解释没有使用 evidence 中的格、区域、link 或 branch。
- `generic-sample-text`: 出现默认占位话术。
- `branch-too-vague`: forcing 样例没有 assumption 或 contradiction/common conclusion。

报告输出：

- `classic9-learning-explanation-audit.json`
- `classic9-learning-explanation-audit.md`

Markdown 报告按 technique 分组：

- 样例数量。
- `good` / `usable` / `insufficient-evidence` / `invalid` 数量。
- evidence gap codes。
- 需要 classic9 finder 补充的字段。
- 是否影响小游戏发布。

### Migration Compatibility

为了不破坏现有调用方，建议分阶段兼容：

- 第一阶段保留 `teachingTextZh` 和 `scenario.formattedStepZh`。
- 新增 `techniqueExplanationZh` 和 `sampleExplanationZh`。
- 小游戏优先读取 `sampleExplanationZh`，没有时才降级读取旧字段。
- `formatStep()` 的旧 API 保持不变，只在 `style: 'teaching'` 时逐步接入新 renderer。
- 解释 catalog 不进入 solver core，避免求解逻辑依赖文案模块。

### Risks And Mitigations

- 风险：为了生成漂亮解释，renderer 开始猜测 evidence 没有表达的结构。
  处理：缺证据就标记 `insufficient-evidence`，不编造。

- 风险：外部资料和 classic9 实现口径不一致。
  处理：解释 catalog 每条记录加 `implementationNotesZh`，明确 classic9 当前边界。

- 风险：forcing 解释过长，小游戏展示困难。
  处理：branch renderer 输出短版和展开版；小游戏默认短版，用户点开看分支详情。

- 风险：当前技巧全集一次性审校成本高。
  处理：按四批交付，每批有 lint 和 snapshot 测试。

- 风险：部分技巧当前没有可用样例或样例 validation 失败。
  处理：underfilled 文档区分 `not-triggered`、`invalid-action`、`needs-evidence`、`needs-puzzle`。

### Concrete Milestones

建议按以下里程碑推进：

1. `M1 catalog skeleton`
   建立 `TechniqueExplanation` 类型、按 `getTechniqueDefinitions()` 生成的 id 骨架、lint 脚本；此阶段不追求文案完整，但必须能检查缺字段。

2. `M2 basic explanations`
   完成 `single`、`intersection`、`subset`、普通 `fish`、普通 `wing` 的专属解释和 renderer。

3. `M3 advanced explanation catalog`
   完成链、染色、single-digit-chain、ALS、uniqueness、pattern、forcing 的解释 catalog；所有技巧不再使用默认占位。

4. `M4 sample explanation service`
   生成 `sampleExplanationZh`，输出 quality 和 evidence gap codes。

5. `M5 final sample audit`
   对当前小游戏样例全量审计，生成 explanation audit report；把质量不足的技巧写入后续处理文档。当前最终样例数 207 是历史运行快照，实际审计必须读取最新样例文件重新计算。

6. `M6 rerun and merge`
   用 explanation-aware merge 重新生成小游戏样例文件，确保 valid + explained 的样例才进入发布文件。

## Deliverables

建议后续实现完成后产出：

- `src/presentation/technique-explanations.ts`: 覆盖当前全部 `getTechniqueDefinitions()` 的解释目录。
- `src/presentation/learning-explanations.ts`: 根据题面和 evidence 生成样例解释。
- `scripts/audit-learning-explanations.mjs`: 审计技巧解释和样例解释质量。
- `docs/TECHNIQUE_EXPLANATION_GUIDE.md`: 面向维护者的解释写作规范。
- 更新后的最终样例文件，新增 `sampleExplanationZh`。
- 更新后的样例质量报告，列出每个已纳入小游戏技巧的样例解释质量。
- 外部参考链接清单和 classic9 实现边界说明，避免后续审校误把外部技巧定义当成当前实现承诺。

## Acceptance Criteria

任务 1 完成标准：

- 当前 `getTechniqueDefinitions()` 返回的全部已实现技巧都有专属解释记录。
- 没有任何技巧使用 family 默认占位作为最终文案。
- 每个技巧至少有 `oneLineZh`、`conceptZh`、`spottingZh`、`proofIdeaZh`、`actionZh`。
- uniqueness / forcing / pattern / ALS / fish / chain 的关键前提和结构差异写清楚。
- 解释 lint 通过。

任务 2 完成标准：

- 每个进入小游戏的样例都有 `sampleExplanationZh`。
- 每条样例解释都引用当前题面的实际格子、数字、动作和至少一种 evidence 信息。
- 对 forcing 样例，解释包含分支假设和矛盾/共同结论。
- 对 uniqueness 样例，解释包含唯一解前提和致命结构。
- 对 fish / chain / ALS / pattern 样例，解释能指出结构角色，而不是只重复技巧名。
- 最终小游戏样例中不包含 validation 失败样例。
- 最终报告能列出解释质量不足的技巧，方便后续补 evidence 或补题。
- 审计报告能区分 `not-triggered`、`invalid-action`、`needs-evidence`、`needs-puzzle` 四类后续问题。

## Suggested Work Order

1. 先实现解释 catalog 和 lint，不动 solver 逻辑。
2. 用最新最终样例文件跑解释审计，找出 evidence 缺口。
3. 对 explanation renderer 可覆盖的技巧先生成 `sampleExplanationZh`。
4. 对 evidence 不足的技巧列成 classic9 finder 改造清单。
5. 等 finder 补齐 evidence 后，再重跑样例解释和最终合并。

这样可以把“文案质量问题”和“solver evidence 不足问题”分开处理，避免用漂亮但不真实的文字掩盖证据缺口。
