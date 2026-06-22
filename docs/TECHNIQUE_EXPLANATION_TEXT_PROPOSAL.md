# Technique Explanation Text Proposal

本文档是 `LEARNING_SAMPLE_EXPLANATION_PLAN.md` 的落地文案提案，只给 classic9 后续实现使用，不直接修改源码。

目标：

1. 为当前 86 个已实现技巧给出可直接改写进 `TechniqueExplanation` catalog 的中文解释源稿。
2. 为学习样例解释提供可复用的“按题面生成”模板，确保解释引用当前题面的格子、候选、区域、链或分支。
3. 明确哪些技巧需要 finder 补充 evidence，避免用空泛文字掩盖证据不足。

外部资料只作为术语和结构参考，不复制外部文案。主要参考 HoDoKu、SudokuWiki、Sukaku/Sudoku Explainer 的公开技巧分类和 classic9 现有兼容文档。

`86` 是当前 dist 快照。后续实现、lint 和生成报告必须以运行时 `getTechniqueDefinitions()` 为准；如果 classic9 新增、删除或重命名技巧，本提案表格需要同步更新。

## Shared Text Rules

禁止在最终解释中出现：

- “当前 classic9 已实现的解题技巧”
- “见结构化证据”
- “可对目标执行本步骤”
- “该技巧返回的动作已经通过校验”
- 只有技巧名、没有结构说明的句子

禁用短语 lint 只扫描最终 `TechniqueExplanation` catalog 字段和生成后的 `sampleExplanationZh` 输出，不扫描本文档的规则说明区。

所有技巧解释至少包含：

- `oneLineZh`: 一句话讲清楚技巧解决的结构。
- `spottingZh`: 用户在候选盘上应该看什么。
- `proofIdeaZh`: 为什么这个动作成立。
- `actionZh`: 这个技巧通常产生什么动作。
- `sampleFocusZh`: 学习样例解释时必须引用哪些题面信息。

## Field Mapping To TechniqueExplanation

本文档的表格是文案源稿，不是完整 TypeScript catalog。落地到 `TechniqueExplanation` 时建议这样映射：

| catalog field | source in this proposal | note |
| --- | --- | --- |
| `id` | 表格 `id` | 必须和 `getTechniqueDefinitions()` 完全一致。 |
| `oneLineZh` | 表格 `oneLineZh` | 可直接使用，必要时做轻微润色。 |
| `conceptZh` | 表格 `oneLineZh` + `proofIdeaZh` 提供素材 | 必须独立改写成 1 到 2 句“技巧核心概念”，不能机械拼接两列文本。 |
| `spottingZh` | 表格 `spottingZh` | 可直接使用。 |
| `proofIdeaZh` | 表格 `proofIdeaZh` | 可直接使用，但复杂技巧需要结合 `classic9BoundaryZh` 限定口径。 |
| `actionZh` | 表格 `actionZh` | 可直接使用。 |
| `sampleFocusZh` | 表格 `sampleFocusZh` | 用于 `sampleExplanationZh` renderer，不一定进入 catalog。 |
| `evidenceRolesZh` | “Evidence Improvements Needed” + 各技巧 `sampleFocusZh` | 需要实现者补成 role 字典。 |
| `prerequisitesZh` | uniqueness / forcing / pattern / template 相关文字 | 唯一解、分支试探、模板枚举等必须显式写入。 |
| `commonPitfallsZh` | 由实现者按技巧补充 | 本文只给方向，不能省略高风险技巧的 pitfalls。 |
| `implementationNotesZh` | “Classic9 Boundary Notes” | 用于避免文案承诺超过当前 finder 能力。 |
| `requiredEvidence` | “Evidence Improvements Needed” + 样例模板 | 用于 audit 和 `insufficient-evidence` 判断。 |

如果某字段无法从当前 evidence 支持，不能靠文案补齐，应在审计中标记 `needs-evidence`。

## Sample Explanation Templates

这些模板是后续 `sampleExplanationZh` 的生成规则，不是固定文案。实际输出必须填入当前样例的格子、数字、区域、链、分支和动作。

### Single

模板：

```text
当前局面中，{targetCell} 的候选/所在区域已经被限制到只剩 {digit}。
因此本步在 {targetCell} 填入 {digit}。
```

必须引用：

- 目标格
- 目标数字
- 如果是 hidden/full house，引用对应行/列/宫

### Intersection

模板：

```text
数字 {digit} 在 {baseHouse} 中的候选都落在 {coverHouse} 的交叉位置。
因此 {coverHouse} 的其它位置不能再保留候选 {digit}，本步删除 {targets}。
```

Direct 变体要额外说明“删除后形成直接落子”。

### Subset

模板：

```text
在 {house} 中，{subsetCells} 与数字 {digits} 形成绑定。
这些数字必须占用这些格，因此 {targets} 中不属于该绑定的候选可以删除。
```

显性数组强调“这些格只有这些数字”；隐性数组强调“这些数字只在这些格出现”。

### Fish

模板：

```text
固定数字 {digit}，它在 {baseHouses} 中的候选位置只能由 {coverHouses} 覆盖。
所以 {coverHouses} 中不属于鱼结构的其它 {digit} 可以删除。
```

带鳍/刺身/Franken 必须额外引用：

- 鱼鳍或缺角
- 删除目标与鱼鳍同宫或可见关系
- 混合 base/cover 的口径

### Wing

模板：

```text
{pivotCell} 和 {wingCells} 形成 {techniqueName}。
无论枢轴取哪一个候选，两个翼都会让 {targetCells} 的候选 {digit} 不可能成立。
```

必须引用 pivot、wing、target 和共同可见关系。

### ALS

模板：

```text
{alsCells} 是准锁定集合：n 个格子只含 n+1 个候选。
通过 {restrictedCommon} 或 pivot 限制后，集合内部会被迫分配，因此 {targets} 的候选 {digit} 可以删除。
```

复杂 ALS 技巧必须列出 ALS 角色，如 pivot、petal、restricted common、target。

### Chain

模板：

```text
从 {startNode} 到 {endNode} 的链交替使用强关系和弱关系。
链端形成互斥或必然关系，因此同时受两端约束的 {targets} 不能保留候选 {digit}。
```

必须引用链端、目标候选和至少一段 link。分组链必须说明 grouped node 包含哪些格。

### Coloring

模板：

```text
候选 {digit} 的强链可以分成两种颜色。
如果某种颜色内部冲突，或目标格同时看见互补颜色，则 {targets} 的候选 {digit} 可以删除。
```

3D Medusa 必须说明跨数字节点，不要只写单数字染色。

### Single-digit Chain

模板：

```text
固定数字 {digit}，{structureCells} 之间通过行列宫中的强链形成 {techniqueName}。
两个端点共同影响 {targets}，所以这些位置不能再保留候选 {digit}。
```

Skyscraper、Two-String Kite、Turbot Fish、Empty Rectangle 要各自说明图形结构。

### Uniqueness

模板：

```text
在唯一解前提下，{structureCells} 如果保留这些候选，会形成两个数字可互换的致命结构。
为了避免多解，必须删除 {targets} 中会完成该结构的候选。
```

必须明确唯一解前提，不允许省略。

### Pattern

模板：

```text
当前候选盘出现 {techniqueName} 的专属结构：{structureRoles}。
该结构限制了 base/target/guardian/template 的取值，因此 {targets} 的候选或落子结论成立。
```

Exocet、Double Exocet、Pattern Overlay、Tridagons、SK Loops 必须用专属角色，不要归入普通链。

### Forcing

模板：

```text
本步从 {assumption} 开始做有限分支。
分支覆盖了 {branchScope}；其中 {contradictionSummary} 或所有可存活分支都推出 {commonAction}。
因此本步可以执行 {targets}。
```

必须引用：

- 假设
- 分支数量或分支范围
- 矛盾点或共同结论
- 是否截断

## Technique Text Catalog

以下表格是理想解释源稿。Pattern、forcing、uniqueness、ALS、chain/coloring 等复杂技巧落地时必须受后文 `Classic9 Boundary Notes` 约束；如果当前 finder evidence 不足，应标记 `insufficient-evidence`，不能用表格文案替代证据。

### Single

| id | oneLineZh | spottingZh | proofIdeaZh | actionZh | sampleFocusZh |
| --- | --- | --- | --- | --- | --- |
| `full-house` | 某一行、列或宫只剩最后一个空格，可以直接填入缺失数字。 | 找只剩一个空格的行、列或宫，并列出该区域缺少的数字。 | 数独每个区域必须包含 1 到 9 且不能重复；区域只缺一个数字时，该数字只能放在唯一空格。 | 通常是一次 `place`。 | 引用区域、唯一空格、缺失数字。 |
| `naked-single` | 某个空格只剩一个候选数，可以直接确定。 | 找候选表中只有一个数字的格子。 | 该格其它数字都已被同行、同列或同宫排除，剩下候选就是唯一可填数字。 | 通常是一次 `place`。 | 引用目标格和它唯一剩余的候选。 |
| `hidden-single` | 某个数字在一个区域内只剩一个可放位置。 | 固定一个数字，检查它在某行、列或宫中是否只有一个候选位置。 | 该区域必须包含这个数字，而其它位置都不能放，所以唯一候选位置必须填入该数字。 | 通常是一次 `place`。 | 引用数字、区域、唯一候选格。 |

### Intersection

| id | oneLineZh | spottingZh | proofIdeaZh | actionZh | sampleFocusZh |
| --- | --- | --- | --- | --- | --- |
| `locked-candidates` | 一个数字被锁在宫与行列的交叉处，可删除交叉外同线或同宫候选。 | 看某数字在一个宫内是否全部落在同一行/列，或在一行/列中是否全部落在同一宫。 | 该数字必须在交叉区域内出现，因此同一行/列或同一宫的其它位置不可能再放这个数字。 | 通常是一个或多个 `eliminate`。 | 引用被锁定的数字、base house、cover house、删除目标。 |
| `direct-pointing` | 指向型区块摒除后立即形成落子。 | 先找宫内候选被锁到同一行/列的结构，再检查删除后是否让某区域只剩唯一位置。 | 锁定关系先删除外部候选，删除结果又触发直接落子。 | 通常包含 `eliminate` 后的直接 `place`，或返回可直接推进的动作。 | 引用锁定结构和删除后形成的唯一位置。 |
| `direct-claiming` | 声明型区块摒除后立即形成落子。 | 先找行/列内候选被锁到同一宫的结构，再检查删除后是否让某区域只剩唯一位置。 | 该数字被声明在交叉宫中，宫内其它位置删除后会产生直接确定。 | 通常包含 `eliminate` 后的直接 `place`，或返回可直接推进的动作。 | 引用行/列、宫、删除目标和直接落子目标。 |

### Subset

| id | oneLineZh | spottingZh | proofIdeaZh | actionZh | sampleFocusZh |
| --- | --- | --- | --- | --- | --- |
| `direct-hidden-pair` | 两个数字在一个区域内只出现在两个格中，清理其它候选后可直接推进。 | 找同一行、列或宫内两个数字的候选位置完全落在同两个格。 | 这两个数字必须占用这两个格，因此这两个格中的其它候选都不成立；如果清理后出现单数，就可直接落子。 | 通常是删除数组格内其它候选，可能伴随直接落子。 | 引用区域、两个数字、两个数组格、删除后形成的结果。 |
| `naked-pair` | 两个格只含同一对候选，这两个数字锁定在这两个格。 | 在同一区域找两个候选集完全相同且大小为 2 的格。 | 这两个数字必须分别填在这两个格中，因此同一区域其它格不能再保留这两个数字。 | 通常删除区域其它格中的这两个候选。 | 引用两个格、两个数字、同一区域、删除目标。 |
| `hidden-pair` | 两个数字在区域内只出现在两个格中，可删除这两个格的其它候选。 | 固定一个区域，找两个数字的候选位置恰好只覆盖同两个格。 | 这两个数字必须占用这两个格，因此这两个格里其它候选不可能成立。 | 通常删除数组格内的其它候选。 | 引用区域、两个数字、两个隐藏格、被删其它候选。 |
| `naked-triple` | 三个格的候选只落在三个数字中，这三个数字锁定在这三个格。 | 在同一区域找三个格，其候选并集大小为 3。 | 三个数字必须填满这三个格，因此同一区域其它格不能保留这些数字。 | 删除区域其它格中的这三个候选。 | 引用三个格、三个数字、删除目标。 |
| `direct-hidden-triplet` | 三个数字在区域内只出现在三个格中，清理其它候选后可直接推进。 | 找三个数字的候选位置只覆盖同三个格。 | 这三个数字必须占用这三个格，因此这些格的其它候选都可删除；若清理后只剩单数，可直接落子。 | 删除数组格内其它候选，可能产生直接落子。 | 引用三个数字、三个格、清理结果。 |
| `hidden-triple` | 三个数字在区域内只出现在三个格中，可删除这三个格的其它候选。 | 固定区域，找三个数字的所有候选位置只覆盖三个格。 | 这些数字必须占用这些格，因此这些格不能再取其它数字。 | 删除隐藏数组格中的其它候选。 | 引用区域、三个数字、三个格、删除目标。 |
| `naked-quad` | 四个格的候选只落在四个数字中，这四个数字锁定在这四个格。 | 在同一区域找四个格，候选并集大小为 4。 | 四个数字必须占用这四个格，因此区域其它格不能保留这些数字。 | 删除区域其它格中的这四个候选。 | 引用四个格、四个数字、区域和删除目标。 |
| `hidden-quad` | 四个数字在区域内只出现在四个格中，可删除这四个格的其它候选。 | 固定区域，找四个数字的候选位置只覆盖四个格。 | 这四个数字必须占用这四个格，因此这些格中其它候选不成立。 | 删除隐藏四数组格中的其它候选。 | 引用四个数字、四个格、删除目标。 |

### Fish

| id | oneLineZh | spottingZh | proofIdeaZh | actionZh | sampleFocusZh |
| --- | --- | --- | --- | --- | --- |
| `x-wing` | 某数字在两条基线上的候选被两条覆盖线完全锁住。 | 固定一个数字，找两行或两列中候选只落在同两列或同行。 | 两条基线都必须放该数字，只能占用覆盖线交点，因此覆盖线其它位置不能放该数字。 | 删除覆盖线上的其它同数字候选。 | 引用数字、两条 base、两条 cover、删除目标。 |
| `swordfish` | 某数字在三条基线上的候选被三条覆盖线锁住。 | 固定数字，找三行/列的候选位置合计只落在三条覆盖线。 | 三条基线需要各放一个该数字，三条覆盖线被鱼结构占用，覆盖线其它候选可删。 | 删除覆盖线其它位置的同数字候选。 | 引用三条 base、三条 cover、目标候选。 |
| `franken-swordfish` | 剑鱼的基线或覆盖线混入宫，形成混合 fish。 | 固定数字，找三条混合基线与三条覆盖线覆盖候选。 | 混合基线仍要求该数字各占一处，覆盖线其它非结构位置不能再放该数字。 | 删除覆盖线中不属于基线的目标候选。 | 引用混合 line/box、数字、删除目标，并说明 classic9 当前 Franken 口径。 |
| `finned-franken-swordfish` | Franken Swordfish 带有鱼鳍，只有看见鱼鳍的覆盖线候选可删。 | 在 Franken Swordfish 中找额外候选作为 fin，并检查目标与 fin 的同宫/可见关系。 | 若鱼鳍不成立，鱼结构成立；若鱼鳍成立，与鱼鳍冲突的目标也不成立，因此共同目标可删。 | 删除与 fin 相关的覆盖线候选。 | 引用 fin、目标、cover、同宫关系。 |
| `finned-franken-jellyfish` | Franken Jellyfish 带有鱼鳍，删除条件受鱼鳍限制。 | 固定数字，找四阶混合 fish 和额外 fin。 | 目标候选无论由鱼结构还是鱼鳍分支都会被排除。 | 删除与 fin 相关的覆盖线候选。 | 引用四条基线/覆盖线、fin、目标。 |
| `jellyfish` | 某数字在四条基线上的候选被四条覆盖线锁住。 | 固定数字，找四行/列候选只落在四列/行。 | 四条基线必须各放该数字，因此覆盖线其它位置不可能再放。 | 删除覆盖线其它同数字候选。 | 引用四条 base、四条 cover、删除目标。 |
| `finned-x-wing` | X-Wing 多出一个鱼鳍，只能删除看见鱼鳍的目标。 | 找近似 X-Wing 加一个额外候选作为 fin。 | 如果 fin 不成立则 X-Wing 成立；如果 fin 成立则同宫目标被排除，所以共同受限目标可删。 | 删除与 fin 同宫且在覆盖线上的候选。 | 引用 fin、base/cover、目标同宫关系。 |
| `sashimi-x-wing` | X-Wing 缺一个角并带鱼鳍，形成刺身结构。 | 找三角 X-Wing 和补偿用的 fin。 | 缺角使普通 X-Wing 不完整，但 fin 分支仍能覆盖目标删除条件。 | 删除与 fin 相关的覆盖线候选。 | 引用缺角、fin、目标。 |
| `finned-swordfish` | Swordfish 带鱼鳍，删除目标必须受鱼鳍约束。 | 找三阶 fish 加额外 fin。 | fish 分支与 fin 分支都排除同一目标，因此该目标候选可删。 | 删除看见 fin 的覆盖线候选。 | 引用 fin、三条 base/cover、删除目标。 |
| `finned-jellyfish` | Jellyfish 带鱼鳍，删除条件限定在鱼鳍影响范围。 | 找四阶 fish 加额外 fin。 | 目标候选在鱼成立或 fin 成立两种情况下都不可能保留。 | 删除与 fin 相关的候选。 | 引用四阶结构、fin、目标。 |
| `sashimi-swordfish` | Swordfish 缺少普通鱼的完整角，但由鱼鳍补足删除逻辑。 | 找三阶刺身 fish 的缺角和 fin。 | 缺角分支由 fin 处理，目标在所有可能下都被排除。 | 删除与 fin 相关的覆盖线候选。 | 引用缺角、fin、目标。 |
| `sashimi-jellyfish` | Jellyfish 的刺身变体，用缺角和鱼鳍限制删除目标。 | 找四阶刺身 fish 的缺角、fin 和覆盖线目标。 | 目标候选同时被鱼结构和 fin 结构排除。 | 删除与 fin 相关的覆盖线候选。 | 引用四阶结构、缺角、fin、目标。 |

### Wing

| id | oneLineZh | spottingZh | proofIdeaZh | actionZh | sampleFocusZh |
| --- | --- | --- | --- | --- | --- |
| `xy-wing` | 一个双值枢轴连接两个双值翼，两个翼共享的数字可从共同可见格删除。 | 找候选为 XY 的 pivot、候选为 XZ 和 YZ 的两个 wing。 | pivot 取 X 或 Y 都会迫使某个 wing 取 Z，因此同时看见两个 wing 的格不能保留 Z。 | 删除共同可见格中的 Z。 | 引用 pivot、两个 wing、共享数字 Z、目标格。 |
| `xyz-wing` | 三值枢轴和两个双值翼共同限制一个数字。 | 找候选为 XYZ 的 pivot，两个 wing 分别含 pivot 的两个配对数字并共享 Z。 | 无论 pivot 或 wing 如何分配，目标如果同时看见 pivot 和两个 wing，就不能取共享数字。 | 删除共同可见目标中的共享候选。 | 引用 pivot、wing、共享数字和共同可见条件。 |
| `wxyz-wing` | 四格 wing 结构把一个受限候选锁在内部，可删外部共同可见候选。 | 找四个相关格，其候选集合形成 WXYZ 结构并存在受限公共候选。 | 受限候选必定由结构内部承担，外部共同可见格不能保留该候选。 | 删除外部共同可见候选。 | 引用四格集合、受限候选、目标。 |
| `w-wing` | 两个相同双值格通过强链连接，公共可见处可删其中一个数字。 | 找两个候选相同的双值格，并找另一数字上的强链把它们联动。 | 强链保证两个端点不能同时取链数字，从而迫使至少一端取另一数字，公共可见目标不能取该数字。 | 删除两个端点共同可见格中的目标候选。 | 引用两个双值端点、连接强链、删除数字。 |
| `chute-remote-pairs` | 同一 chute 内的远程数对限制第三宫 yellow cells，从公共可见区删除候选。 | 找同一三宫带中的远程数对和第三宫中缺失的 yellow-cell 数字。 | 远程数对的奇偶关系使第三宫无法同时容纳某个候选，公共可见处的相反候选可删。 | 删除公共可见区的目标候选。 | 引用 chute、两个远程数对格、yellow cells、目标。 |
| `remote-pairs` | 相同双值候选组成奇数链，链端颜色相反，公共可见格可删这两个数字。 | 找一串候选完全相同的双值格，并形成奇数长度远程链。 | 链端必定一真一假，因此任何同时看见两端的格不能取这对候选中的任一数字。 | 删除共同可见格中的这对候选。 | 引用双值链、链端、两个被删数字。 |

### ALS

| id | oneLineZh | spottingZh | proofIdeaZh | actionZh | sampleFocusZh |
| --- | --- | --- | --- | --- | --- |
| `big-wings` | ALS 与双值 stem 同时连接，删除 stem 链接数字或 ALS 独占数字。 | 找一个 ALS、一个双值 stem，以及 stem 两个数字与 ALS 的连接。 | stem 的任一取值都会限制 ALS，导致目标候选在所有分支下都不成立。 | 删除目标候选。 | 引用 ALS、stem、连接数字、目标。 |
| `almost-locked-pair` | 两格三候选的准锁定数对通过限制关系删候选。 | 找两个格只含三个候选，并与外部目标形成共同限制。 | 一旦某个公共候选被外部约束，ALS 内部剩余数字被锁定，目标候选无法成立。 | 删除外部目标候选。 | 引用 ALS 格、候选集合、restricted common、目标。 |
| `almost-locked-triple` | 三格四候选的准锁定三数组通过限制关系删候选。 | 找三格候选四数的 ALS，并观察它与目标的可见关系。 | ALS 被 restricted common 限制后会转为确定数组，外部共同候选可删。 | 删除目标候选。 | 引用三格 ALS、四个候选、共同候选、目标。 |
| `almost-locked-quad` | 四格五候选的准锁定四数组通过限制关系删候选。 | 找四格五候选的 ALS 与目标之间的共同限制。 | ALS 的一个自由度被限制后，目标候选在所有合法分配下都不成立。 | 删除目标候选。 | 引用四格 ALS、五个候选、目标。 |
| `als-xz` | 两个 ALS 通过 restricted common 相连，删除共同可见的 X/Z 候选。 | 找两个 ALS，它们共享一个或两个受限公共候选，且目标同时看见相关候选。 | 受限公共候选不能同时在两个 ALS 外消失，因此外部共同可见的目标候选不可能成立。 | 删除目标候选。 | 引用两个 ALS、restricted common、目标候选。 |
| `als-xy-wing` | 一个 pivot ALS 连接两个 wing ALS，删除共同外部候选。 | 找三个 ALS：pivot 与两个 wing 分别通过不同 restricted common 相连。 | pivot 的候选选择会迫使某个 wing 排除目标候选，因此所有分支都删同一外部候选。 | 删除共同外部候选。 | 引用 pivot ALS、两个 wing ALS、连接候选、目标。 |
| `aic-als` | 把 ALS 内部强关系接入 AIC 链，利用链端关系删候选。 | 找 AIC 链中包含 ALS 节点或 ALS 强链接的结构。 | ALS 内部候选关系可作为强链节点，链端推出目标候选为假。 | 删除链端共同影响的候选。 | 引用 ALS 节点、链端、目标。 |
| `fireworks` | 交点和两个翼格锁成隐藏组，删除这些格中的其它候选。 | 找一个交点格和两个翼格，它们在多个数字上形成互相约束。 | 这三个格必须承载一组隐藏数字，因此不属于该隐藏组的候选可删。 | 删除三格中的其它候选。 | 引用交点、翼格、隐藏数字、删除候选。 |
| `twinned-xy-chains` | 六格 2x3 或 3x2 结构把六个数字成对锁定，向外删除公共可见候选。 | 找六个双值/近双值格组成 twinned XY 结构。 | 成对链覆盖所有数字分配，目标候选在所有配对情况下都不能成立。 | 删除公共可见候选。 | 引用六格结构、成对数字、目标。 |
| `sue-de-coq` | 行宫交集与两侧翼格把候选分拆为互斥集合，删除对应区域外部候选。 | 找一个 line-box 交集，以及行翼和宫翼中互补的候选集合。 | 交集和两翼必须分配这些数字，行/宫其它位置不能再保留对应候选。 | 删除行翼或宫翼影响区域中的候选。 | 引用交集、行翼、宫翼、被删数字。 |
| `death-blossom` | pivot 的每个候选分别连接一个 ALS 花瓣，删除所有花瓣共享的外部候选。 | 找一个 pivot 格，其每个候选都能限制一个 ALS petal。 | pivot 必取一个候选，因此至少一个 petal 被激活；共享外部候选在所有 petal 分支下都不成立。 | 删除共同外部候选。 | 引用 pivot、petals、共享候选、目标。 |
| `aligned-pair-exclusion` | 两个目标格的所有候选配对都被排除时，可删除无支持候选。 | 选择两个对齐格，枚举它们的候选组合，检查冲突或 ALS 排除。 | 如果某个候选无法参与任何合法配对，它就不可能出现在解中。 | 删除无合法支持的候选。 | 引用两个目标格、被排除的配对类型、目标候选。 |

### Coloring And Chain

| id | oneLineZh | spottingZh | proofIdeaZh | actionZh | sampleFocusZh |
| --- | --- | --- | --- | --- | --- |
| `bidirectional-x-cycle` | 单数字强链形成双向环，环上的相反关系可删除目标候选。 | 固定一个数字，找由强链连接的闭合或双向结构。 | 双向推理都将目标候选推出为假，因此该候选可删。 | 删除目标候选。 | 引用数字、环端/颜色、目标。 |
| `bidirectional-y-cycle` | 双值格形成双向 Y 环，链端共同可见候选可删。 | 找双值格之间按候选交替连接的环或双向链。 | 链两向推理都排除同一候选，目标不能保留该候选。 | 删除目标候选。 | 引用双值链、链端、删除数字。 |
| `forcing-chain` | 一条强制链从假设出发推出目标候选不成立。 | 找候选间连续的强制蕴含关系。 | 假设成立会沿链推出与目标冲突的结论，因此目标候选可删。 | 删除目标候选。 | 引用起点、链端、冲突目标。 |
| `grouped-aic` | AIC 中允许一组候选作为分组节点，利用端点关系删候选。 | 找强弱交替链，其中某些节点是一组同数字候选。 | 分组节点仍表达“至少一个成立/最多一个成立”的关系，链端推出目标为假。 | 删除目标候选。 | 引用分组节点、链端、目标。 |
| `x-chain` | 单数字强弱链端点共同影响目标，可删除该数字。 | 固定数字，沿强链/弱链连接候选位置。 | 链端至少有一端为真，目标同时看见链端时不能取该数字。 | 删除共同可见目标中的该数字。 | 引用数字、链端、共同可见目标。 |
| `xy-chain` | 双值格链让链端同一数字至少一端成立，公共可见处可删。 | 找一串双值格，前后共享候选，链端共享目标数字。 | 链端中至少一个会取目标数字，因此同时看见两端的格不能保留该数字。 | 删除公共可见目标候选。 | 引用双值链、端点数字、目标。 |
| `aic` | 交替强弱链利用端点关系删除候选。 | 找候选节点之间强、弱关系交替的链。 | AIC 的端点形成互斥或至少一真关系，目标候选被端点共同排除。 | 删除目标候选。 | 引用链端、强弱关系、目标。 |
| `aic-exotic` | AIC 接入 ALS、唯一矩形等异构强链接，扩展链式删除能力。 | 找普通强弱链之外的 exotic link 节点。 | 异构节点仍提供可靠强关系，链端关系可推出目标候选为假。 | 删除目标候选。 | 引用 exotic link 类型、链端、目标。 |
| `simple-coloring` | 单数字强链二染色后，通过颜色冲突或夹击删候选。 | 固定数字，把强链两端交替染成两色。 | 若同色冲突则该色全假；若目标同时看见两色，则目标候选必假。 | 删除目标候选。 | 引用数字、两色端点、冲突或夹击。 |
| `x-coloring` | 扩展染色使用更多强链关系，找出颜色矛盾或目标夹击。 | 固定数字，扩展强链图并寻找颜色规则。 | 颜色关系覆盖候选真假，目标若被两种互补颜色限制就可删除。 | 删除目标候选。 | 引用颜色组、目标、删除原因。 |
| `multi-colors` | 多个独立染色链之间产生弱连接，可删除同时受两组颜色约束的候选。 | 找两个或多个强链染色组件，并检查组件间弱连接。 | 两组颜色的连接排除了某些组合，目标如果同时看见被排除组合就不能成立。 | 删除目标候选。 | 引用两个颜色组件、弱连接、目标。 |
| `three-d-medusa` | 跨数字强链图进行二染色，通过多种颜色规则删候选或落子。 | 找同格、同区域、双值格之间的强关系，构成跨数字图。 | 染色图中某种颜色若导致冲突则全假；或目标被两色夹击时可删。 | 删除候选，少数情况下可落子。 | 引用跨数字节点、颜色规则、目标。 |

### Single-digit Chain

| id | oneLineZh | spottingZh | proofIdeaZh | actionZh | sampleFocusZh |
| --- | --- | --- | --- | --- | --- |
| `forcing-x-chain` | 单数字强制链从一个候选分支推出目标候选不成立。 | 固定数字，找一串行列宫强制关系。 | 假设某端成立会沿链推出目标位置不能再取该数字。 | 删除目标候选。 | 引用数字、链起点、链终点、目标。 |
| `grouped-x-cycles` | 单数字 X-Cycle 允许分组候选作为节点。 | 固定数字，在行列宫中找分组强链/弱链形成的循环或链。 | 分组节点表达某组候选至少一真或最多一真，链端共同排除目标。 | 删除目标候选。 | 引用 grouped node、数字、目标。 |
| `skyscraper` | 两条平行强链形成两个屋顶，屋顶共同可见处可删候选。 | 固定数字，找两行或两列各有一条强链，并形成非矩形屋顶。 | 两条 base 中该数字各有一个为真，至少一个屋顶为真，目标同时看见屋顶时可删。 | 删除屋顶共同可见格中的该数字。 | 引用两个 base、两个 roof、目标。 |
| `two-string-kite` | 一条行强链和一条列强链通过同宫连接，远端交叉处可删候选。 | 固定数字，找一条行强链、一条列强链，且其中一端在同一宫。 | 同宫端不能同时为真，迫使至少一个远端为真，因此远端交叉目标可删。 | 删除远端交叉位置的候选。 | 引用行链、列链、同宫端、远端目标。 |
| `turbot-fish` | 三段单数字强弱关系形成短链，端点共同可见处可删。 | 固定数字，找 strong-weak-strong 结构。 | 两个端点至少一个为真，目标同时看见端点时不能取该数字。 | 删除共同可见目标候选。 | 引用三段链、端点、目标。 |
| `empty-rectangle` | 宫内空矩形与行/列共轭对结合，删除交叉目标候选。 | 固定数字，在宫内找空矩形形态，并找到相关行/列强链。 | 如果目标成立，会迫使宫内候选布局与共轭对冲突，因此目标候选可删。 | 删除交叉目标候选。 | 引用空矩形宫、共轭对、目标。 |

### Pattern

| id | oneLineZh | spottingZh | proofIdeaZh | actionZh | sampleFocusZh |
| --- | --- | --- | --- | --- | --- |
| `exocet` | base cells 限制 target cells 只能取 base digits。 | 找两个 base cells、两个 target cells，以及连接它们的 escape/companion 约束。 | base digits 必须传递到 target cells，target 中非 base 数字会破坏 Exocet 结构。 | 删除 target cells 中非 base digits。 | 引用 base cells、target cells、base digits、删除目标。 |
| `double-exocet` | 两组 Exocet 在同一 band/stack 中共享 base digits，限制四个 target cells。 | 找两套互相关联的 Exocet base/target 结构。 | 两组 Exocet 共同约束 target cells，只允许共享 base digits。 | 删除四个 target cells 中非 base digits。 | 引用两组 base/target、共享数字、目标。 |
| `pattern-overlay` | 枚举某数字所有合法模板，采用所有模板共同支持的落子或删除。 | 固定一个数字，枚举它在所有行列宫中的合法摆放模板。 | 如果所有合法模板都包含某位置，可落子；如果所有模板都排除某位置，可删候选。 | 可能 `place` 或 `eliminate`。 | 引用数字、共同模板结论、目标动作。 |
| `tridagons` | 四宫奇偶结构和 guardian 限制 Tridagon digits。 | 找四个宫中的三数字循环结构及 guardian 格。 | Tridagon 结构若无 guardian 会造成不可解或多解约束，guardian 只能承担宫外数字。 | 删除 guardian 中的 Tridagon 数字候选。 | 引用四宫结构、Tridagon digits、guardian、删除目标。 |
| `sk-loops` | SK Loop 把候选锁入八段闭环，可删除环外相关候选。 | 找由八个节点和候选对组成的闭环结构。 | 环内候选必须按闭环分配，相关行列宫中的外部同数字候选不能成立。 | 删除环外目标候选。 | 引用 loop nodes、loop digits、外部目标。 |

### Forcing

| id | oneLineZh | spottingZh | proofIdeaZh | actionZh | sampleFocusZh |
| --- | --- | --- | --- | --- | --- |
| `forcing-nets` | 对多个分支展开网状推理，保留所有存活分支共同推出的结论。 | 选择一个 pivot 或候选集合，检查各分支推导是否得到同一动作。 | 分支覆盖当前可能性；若每个存活分支都推出同一动作，该动作就是必然结论。 | 可能落子或删候选。 | 引用分支入口、分支数、共同动作、截断情况。 |
| `digit-forcing-chains` | 比较某候选成立与不成立两条分支，采用共同结论。 | 固定一个候选，分别看 ON/OFF 分支。 | 该候选不是真就是假；如果两边都推出同一结论，则结论必然成立。 | 可能落子或删候选。 | 引用候选、ON/OFF 分支、共同动作。 |
| `nishio-forcing-chains` | 假设某候选成立会导致矛盾，因此删除该候选。 | 选择一个候选，沿强制推导检查是否产生矛盾。 | 如果候选成立不可能完成合法数独，该候选必为假。 | 删除假设候选。 | 引用假设候选、矛盾位置、分支摘要。 |
| `cell-forcing-chains` | 同一格所有候选分支都推出同一外部结论。 | 选择一个多候选格，分别假设每个候选成立。 | 该格必须取其中一个候选；如果所有候选分支都推出同一动作，该动作必然成立。 | 可能落子或删候选。 | 引用目标格、所有候选分支、共同动作。 |
| `unit-forcing-chains` | 某区域内某数字的所有位置分支都推出同一结论。 | 选择一个区域和数字，枚举该数字所有可放位置。 | 该数字必须落在这些位置之一；每个分支都推出的动作就是必然动作。 | 可能落子或删候选。 | 引用区域、数字、位置分支、共同动作。 |
| `region-forcing-chains` | 枚举某 region 中某数字的位置分支，采用共同结论。 | 与 unit forcing 类似，但按 classic9 region 口径组织分支。 | 所有合法位置分支覆盖可能性，共同结论可以直接采用。 | 可能落子或删候选。 | 引用 region、数字、分支和共同动作。 |
| `table-chain` | 用静态 implication table 找矛盾或共同结论。 | 选择候选或分支入口，检查静态蕴含表中的推导结果。 | 静态表中所有相关分支若共同排除目标或产生矛盾，可采用对应动作。 | 通常删除候选，也可采用共同动作。 | 引用表分支、矛盾/共同结论、目标。 |
| `dynamic-forcing-chains` | 动态分支允许在分支内继续推导，保留共同结论或矛盾删除。 | 对候选做有界动态展开，检查分支内后续步骤。 | 动态推导覆盖更深层可能；如果结论在预算内稳定出现，可采用。 | 通常删除候选或共同动作。 | 引用假设、动态深度/预算、矛盾点。 |
| `dynamic-forcing-chains-plus` | 更深更宽的动态强制链，用更大预算寻找共同结论。 | 与 dynamic forcing 相同，但允许更高分支预算。 | 更大的预算能发现普通动态强制链未发现的稳定共同结论。 | 删除候选或采用共同动作。 | 引用预算、分支数、是否截断。 |
| `nested-forcing-chains` | 分支内允许一层受控 forcing，寻找矛盾或共同结论。 | 对候选做外层假设，并允许内层 forcing 辅助推导。 | 若嵌套推导覆盖的分支导向矛盾或共同动作，则目标动作成立。 | 删除候选或采用共同动作。 | 引用外层假设、内层 forcing 摘要、矛盾/共同动作。 |
| `bowmans-bingo` | 对候选做有界试探，若稳定导向矛盾则删除该候选。 | 选择一个候选，按有限逻辑分支尝试它成立。 | 如果该候选成立会让某格候选耗尽、某区域数字重复或无处可放，则该候选不可能成立。 | 删除假设候选。 | 引用假设候选、矛盾类型、分支摘要。 |

### Uniqueness

| id | oneLineZh | spottingZh | proofIdeaZh | actionZh | sampleFocusZh |
| --- | --- | --- | --- | --- | --- |
| `unique-rectangle` | 避免四角两数字互换形成多解的致命矩形。 | 找两行两列两宫中的四格，含同一 deadly pair，且有 roof/target 差异。 | 在唯一解前提下，不能留下两个数字互换仍成立的矩形，因此可删除会完成致命结构的候选。 | 删除 deadly pair 或相关目标候选。 | 引用四角、deadly pair、roof/target、唯一解前提。 |
| `avoidable-rectangle` | 三个角已固定时，第四角若取某候选会形成可交换矩形。 | 找三角已解、第四角候选可导致同数字矩形的结构。 | 若第四角取目标候选，题面会出现可避免的多解矩形，因此该候选必须删除。 | 删除第四角目标候选。 | 引用三已解角、第四角、候选、唯一解前提。 |
| `rectangle-elimination` | 利用矩形与强弱链关系，删除会维持致命矩形的候选。 | 找唯一矩形候选，并观察外部链或覆盖关系如何限制 roof。 | 目标候选若保留，会让致命矩形无法被破坏；链关系因此排除该候选。 | 删除目标候选。 | 引用矩形角、链/覆盖证据、目标。 |
| `extended-rectangle` | 2x3 或 3x2 扩展矩形避免更大致命模式。 | 找六格扩展矩形结构，包含重复 pair 和 roof。 | 唯一解前提下，扩展致命模式不能保留，目标候选会完成该模式所以可删。 | 删除目标候选。 | 引用六格结构、deadly pair、roof、目标。 |
| `hidden-unique-rectangle` | 强链接隐藏出唯一矩形风险，从而删除目标候选。 | 找近似唯一矩形，其中某些候选通过强链暴露为 roof。 | 如果目标候选成立，会迫使隐藏的致命矩形出现，因此目标候选不成立。 | 删除目标候选。 | 引用矩形、隐藏强链、目标。 |
| `aic-ur` | 把唯一矩形作为 AIC 节点接入链式推理。 | 找 AIC 中某个节点是 UR 致命结构或其互补约束。 | UR 节点提供唯一解前提下的强关系，链端推出目标候选为假。 | 删除目标候选。 | 引用 UR 节点、链端、目标、唯一解前提。 |
| `bug-plus-one` | 盘面接近 BUG，只剩一个三值格，特定数字必须填入。 | 检查所有未解格几乎都是双值，只有一个格多一个候选。 | 若不选择额外候选，会形成 BUG 多解结构；唯一解要求额外候选成立。 | 通常在三值格 `place`。 | 引用唯一三值格、额外候选、唯一解前提。 |
| `bug-plus-two` | BUG+2 中两个额外候选至少一个成立，可删除共同可见候选。 | 找接近 BUG 的盘面和两个额外候选。 | 为避免 BUG 多解结构，两个额外候选不能同时为假；共同可见目标不能保留同数字候选。 | 删除共同可见目标候选。 | 引用两个额外候选、目标、唯一解前提。 |
| `bug-plus-n` | BUG+n 中多个额外候选共享同一数字，可删除共同可见候选。 | 找至少三个三值格共享同一个 extra digit，移除这些 extra 后仍形成 BUG base。 | 唯一解前提下，所有共享 extra 不能同时为假；同时看到这些 extra cells 的同数字候选不能保留。 | 删除共同可见目标候选。 | 引用多个额外候选、BUG base、目标、唯一解前提。 |

### Classic9 Boundary Notes

这些说明必须进入 `implementationNotesZh` 或相近字段，避免文案超过当前 finder 能力。

| area | boundary |
| --- | --- |
| `pattern` | Exocet、Double Exocet、Tridagons、SK Loops 的文案只能描述 classic9 当前 finder 返回的结构和动作。若 evidence 没有明确 base/target/guardian/loop roles，样例解释必须标记 `insufficient-evidence`，不能把外部资料中的完整定义硬套到样例上。 |
| `pattern-overlay` | 只能说“当前实现枚举该数字的合法模板，并采用共同结论”。不要承诺和任何外部模板求解器的模板搜索范围完全一致。 |
| `forcing` | “所有分支共同推出”只适用于 branches 未截断且覆盖范围清楚的样例。若 `truncated`、`stopReason` 或 branch budget 表明分支不完整，解释必须降级为 `usable` 或 `insufficient-evidence`，并把预算状态写入说明。 |
| `table-chain` | 当前文案应称为 classic9 的静态 implication table 口径，不声明完全同构 Sudoku Explainer Table Chain。 |
| `dynamic-forcing-chains` | 必须说明是有界动态展开，不是无限深完整证明树。 |
| `nested-forcing-chains` | 当前只应描述“一层受控 forcing 嵌套”或 classic9 实际实现边界，不声明完整 nested proof-tree 同构。 |
| `uniqueness` | 所有 UR/BUG 类解释必须显式写“在唯一解前提下”。如果调用方不接受唯一解假设，应允许隐藏或标注这些技巧。 |
| `ALS` | ALS 技巧解释必须以 evidence 中实际 ALS cells/digits/restricted common 为准。缺少这些角色时不能只按技巧名生成完整说明。 |
| `chain/coloring` | 链类解释必须以 `links` 或可恢复端点为准。若 evidence 只有 reason/target cells，没有 ordered path，不能声称“沿链可见”。 |

## Evidence Improvements Needed

后续 classic9 实现时建议优先补充以下 evidence，而不是只改文案：

| area | required improvement |
| --- | --- |
| Fish | 明确 `base`、`cover`、`fin`、`sashimi`、`overlap` roles。 |
| Chain / Coloring | `links` 需要可展示的 ordered path；分组节点要带完整 cell set。 |
| ALS | ALS cells、ALS digits、restricted common、pivot/petal roles 必须稳定。 |
| Pattern | Exocet / Tridagons / SK Loops 需要专属 role，不要只用 `reason`。 |
| Uniqueness | 所有 UR/BUG 类 evidence 应标记 `deadly-pair`、`corner`、`roof`、`target` 和唯一解前提。 |
| Forcing | branches 必须包含 assumption、contradictionAt、stopReason、truncated、summary actions。 |

## Proposed Output Fields

后续样例文件建议新增：

```ts
interface SampleExplanationZh {
  title: string;
  context: string;
  spotting: string;
  action: string;
  reasoning: string;
  afterEffect?: string;
  simplicityCheck?: string;
  validation: string;
  quality: 'good' | 'usable' | 'insufficient-evidence' | 'invalid';
  evidenceGaps: string[];
  referencedCells: string[];
  referencedDigits: number[];
  referencedHouses: string[];
}
```

小游戏读取优先级：

1. `sampleExplanationZh`，如果 `quality` 是 `good` 或 `usable`。
2. 旧字段 `teachingTextZh` 和 `scenario.formattedStepZh` 作为兼容降级。
3. `quality = invalid` 的样例不进入小游戏文件。

## Implementation Notes

- 这份文案提案应先进入文档评审，再拆成 `technique-explanations.ts` 的数据。
- 每条文案落地时必须用 lint 检查禁用短语。
- 每条样例解释必须由 evidence 生成，不允许把本文档里的示例句硬编码到样例文件。
- 外部资料仅用于术语核对；如果 classic9 当前 finder 没有完整实现外部技巧的所有 subtype，文案必须写当前实现边界。

## References

这些链接用于术语和结构核对，不作为逐字文案来源：

- HoDoKu Techniques: <https://hodoku.sourceforge.net/en/techniques.php>
- HoDoKu Technique Introduction: <https://hodoku.sourceforge.net/en/tech_intro.php>
- SudokuWiki Strategy Families: <https://www.sudokuwiki.org/Strategy_Families>
- SudokuWiki Chains and Links: <https://www.sudokuwiki.org/Introducing_Chains_and_Links>
- SudokuWiki Forcing Nets: <https://www.sudokuwiki.org/Forcing_Nets>
- SudokuWiki Cell Forcing Chains: <https://www.sudokuwiki.org/Cell_Forcing_Chains>
- Sukaku Explainer FAQ: <https://github-wiki-see.page/m/SudokuMonster/SukakuExplainer/wiki/SE121---FAQ>
- classic9 technique overview: `docs/TECHNIQUES.md`
- classic9 SE compatibility notes: `docs/SE_COMPATIBILITY.md`
- classic9 chain matrix: `docs/SE_CHAIN_MATRIX.md`
- classic9 uniqueness matrix: `docs/SE_UNIQUENESS_MATRIX.md`
