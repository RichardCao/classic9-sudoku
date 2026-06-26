# @sudoku-tools/classic9 0.4.0 状态与竞品评估

评估时间：2026-06-22，北京时间约 19:19。
评估对象：npm 已发布的 `@sudoku-tools/classic9@0.4.0`、GitHub 仓库 `RichardCao/classic9-sudoku`、当前源码工作树。
下载量窗口：npm downloads API `2026-05-23:2026-06-22`。

## 结论

`@sudoku-tools/classic9@0.4.0` 不是一个普通的“生成一道数独 / 解一道数独”轻量包，而是一个偏题库生产、可解释求解、评分、canonical 去重、候选池筛选和 release 审计的标准 9x9 数独工具链。

它当前的功能深度明显高于 npm 上多数主流 Sudoku 包，尤其强在：

1. 人类逻辑步骤和结构化 evidence。
2. 评分策略版本化。
3. 高级技巧覆盖。
4. 候选池和批量 CLI。
5. reference corpus / audit 型质量门禁。

但它的公开生态状态仍是早期：

1. npm 近 30 天下载量只有 `360`，低于 `@algorithm.ts/sudoku`、`sudoku-gen`、`sudoku`、`sudoku-core` 等常见包。
2. GitHub 当前只有 `1` star、`0` fork、`0` open issue，无 topics，无 GitHub Releases。
3. 包体解包约 `942 KB`，比多数轻量包大很多。
4. Node `>=20` + ESM-only 对老项目和 CommonJS 用户不友好。
5. 生成器、候选池、重型 forcing 仍明确属于实验或离线能力。

一句话定位：它是“功能和工程验证很深、生态验证还很浅”的早期专业工具包。适合做解释型数独产品、题库后台和高级技巧研究；不适合作为只需要快速求解或简单生成的最小依赖。

## 公开发布状态

| 项目 | 当前状态 |
| --- | --- |
| npm 包名 | `@sudoku-tools/classic9` |
| npm 版本 | `0.4.0` |
| npm 发布时间 | `2026-06-22T09:00:13.222Z` |
| npm 近 30 天下载量 | `360` |
| npm 解包体积 | registry 约 `941,066` bytes；当前工作树 dry-run 约 `941,724` bytes |
| 压缩包体积 | 当前工作树 dry-run 约 `178,121` bytes |
| 运行时依赖 | 无 |
| 运行环境 | Node.js `>=20`，ESM-only |
| License | MIT |
| GitHub 仓库 | `RichardCao/classic9-sudoku` |
| GitHub 状态 | public，`1` star，`0` fork，`0` open issue |
| GitHub tag | 已有 `v0.4.0`、`v0.3.0`、`v0.2.0` |
| GitHub Release 页面 | 当前为空 |
| GitHub topics | 当前为空 |

## 本地源码能力快照

| 能力 | 当前工作树事实 |
| --- | --- |
| TypeScript 源码文件 | `29` 个 |
| docs 文件 | `24` 个 |
| examples 文件 | `5` 个 |
| 技巧定义 | `90` 个 |
| stable 技巧 | `60` 个 |
| experimental 技巧 | `30` 个 |
| 技巧族 | `als`、`chain`、`coloring`、`fish`、`forcing`、`intersection`、`pattern`、`single`、`single-digit-chain`、`subset`、`uniqueness`、`wing` |
| 内置评分策略 | `classic-stable.v1`、`classic-extended.v1`、`classic-galaxy.v1` |
| `classic-stable` | 60 个 primary 技巧 |
| `classic-extended` | 60 个 primary 技巧 + 1 个 fallback |
| `classic-galaxy` | 80 个 primary 技巧 + 9 个 fallback |
| 快速测试 | `npm test` 通过，约 `16.1s` |
| 慢速测试 | `npm run test:slow` 通过，约 `13m40s` |
| 完整测试 | `npm run test:full` 通过，约 `11m00s`，该值受机器负载影响 |

说明：测试分层是当前工作树状态；npm registry 上已经发布的 0.4.0 包本身不会包含后续本地未发布改动。

## npm 竞品横向数据

下表按“npm 搜索常见度、功能相近度、近期维护状态”选取。下载量均为 `2026-05-23:2026-06-22`。

| 包 | 定位 | 最新版本 | 最近发布 | 近 30 天下载 | 解包体积 | GitHub |
| --- | --- | ---: | --- | ---: | ---: | --- |
| `@sudoku-tools/classic9` | 标准 9x9 工具链：解析、唯一解、人类逻辑、评分、生成、canonical、候选池、CLI | `0.4.0` | 2026-06-22 | `360` | `941 KB` | `1` star / `0` fork |
| `@algorithm.ts/sudoku` | 高效 solver / creator，算法型 | `4.0.4` | 2026-03-23 | `5315` | `61 KB` | monorepo `115` star / `10` fork |
| `sudoku-gen` | 简单 puzzle generator | `1.0.2` | 2023-04-21 | `3109` | `31 KB` | `39` star / `11` fork |
| `sudoku` | 老牌 generator + solver | `0.0.3` | 2019-11-22 | `1757` | `61 KB` | `157` star / `46` fork |
| `sudoku-core` | TS 生成、求解、逐步/分析，偏应用集成 | `3.0.3` | 2024-06-14 | `1430` | `123 KB` | `110` star / `9` fork |
| `@reetesh/sudoku-engine` | 生成、求解、game helpers、hints、difficulty、batch generation | `2.0.0` | 2026-06-09 | `489` | `132 KB` | `1` star / `0` fork |
| `fast-sudoku-solver` | TypeScript 快速 solver | `3.0.3` | 2026-05-14 | `238` | `46 KB` | `2` star / `0` fork |
| `@forfuns/sudoku` | solver + generator | `1.3.0` | 2025-03-04 | `192` | `29 KB` | `4` star / `1` fork |
| `@wsabol/sudoku-solver` | solve / next move / describe / validate | `0.1.14` | 2026-04-23 | `166` | `88 KB` | 未在 npm metadata 中声明 GitHub |
| `@amanwebdev/sudoku-generator` | generator | `1.1.6` | 2025-08-08 | `161` | `27 KB` | `0` star / `0` fork |
| `@donmahallem/sudoku` | Sudoku solver | `0.7.1` | 2026-01-22 | `127` | `113 KB` | monorepo `2` star / `2` fork |
| `sudoku-toolbox` | simple toolbox，依赖 `sudoku-gen` | `1.1.8` | 2023-09-23 | `61` | `13 KB` | `0` star / `0` fork |

几个直接观察：

1. 下载量第一梯队不是功能最深的包，而是更早发布、更轻、更容易搜到的包。
2. `@sudoku-tools/classic9` 的下载量已经高于一批近期小包，但明显低于 `@algorithm.ts/sudoku`、`sudoku-gen`、`sudoku`、`sudoku-core`。
3. `@sudoku-tools/classic9` 的体积最大，约为 `sudoku-gen` 的 30 倍、`@algorithm.ts/sudoku` 的 15 倍。
4. `sudoku-core` 是功能定位上最接近“应用集成”的竞品；`@algorithm.ts/sudoku` 是更强的算法型竞品；`sudoku-gen` 是轻量 generator 竞品。
5. `npm search sudoku` 前 15 中没有出现 `@sudoku-tools/classic9`，说明搜索曝光和生态信号还弱。

## 功能矩阵

| 能力 | classic9 | 主流轻量 generator/solver 包 | `sudoku-core` 这类应用型包 | `@algorithm.ts/sudoku` 这类算法型包 |
| --- | --- | --- | --- | --- |
| 9x9 解析 / 序列化 | 强 | 常见 | 常见 | 常见 |
| 格式校验 / 冲突检查 | 强 | 常见 | 常见 | 常见 |
| 唯一解检查 | 强，带预算/节点诊断 | 不一定有 | 通常有 | 通常有 |
| 快速求解 | 有，但不是唯一目标 | 常见 | 常见 | 强 |
| 人类逻辑步骤 | 强，结构化 `SolveStep` | 通常弱或无 | 部分支持 | 通常不是重点 |
| 高级技巧覆盖 | 非常强，90 定义、60 stable | 通常无 | 有限 | 通常不按教学技巧组织 |
| Evidence / links / nodes / branches | 强 | 通常无 | 通常弱 | 通常无 |
| 评分策略版本化 | 强，`ratingPolicyId/version` | 通常无 | 可能有难度标签 | 通常无 |
| 生成器 | 有，但文档明确实验边界 | 通常强在简单生成 | 通常有 | 有 |
| 候选池搜索/去重/筛选 | 强 | 通常无 | 少见 | 通常无 |
| canonical 等价去重 | 强，但当前空盘/稀疏盘较慢 | 通常无 | 少见 | 通常无 |
| CLI | 强，含 batch/search/select/audit 相关命令 | 有些有 | 不一定 | 不一定 |
| JSON Schema | 有 | 少见 | 少见 | 少见 |
| 文档深度 | 强，偏中文和工程内部 | 通常短 README | 中等 | 算法文档为主 |
| 浏览器/CJS 友好度 | 弱，Node >=20 + ESM-only | 通常更好 | 通常更好 | 视包而定 |
| 包体/安装成本 | 弱，较大 | 强，轻 | 中等 | 强，较轻 |
| 生态验证 | 弱，刚公开 | 中到强 | 中 | 中到强 |

## 优势

### 1. 可解释求解能力稀缺

多数 npm Sudoku 包的核心是“生成/求答案”，而 `classic9` 把求解步骤作为一等对象。`SolveStep` 不只是文本说明，还包含：

1. `actions`：落子或删候选。
2. `evidence.houses` / `evidence.cells`：区域和格子证据。
3. `evidence.links`：链式技巧证据。
4. `evidence.nodes`：复杂 cell-set / proof node。
5. `evidence.pattern`：技巧 family/subtype。
6. `evidence.branches`：forcing / 试探类分支证据。

这使它更适合做提示系统、教学 UI、题库审计、技巧样例提取，而不是只做后台解题器。

### 2. 高级技巧覆盖范围很宽

当前公开定义包含 `90` 个技巧，其中 `60` 个 stable、`30` 个 experimental。覆盖范围包括 singles、subsets、fish、wings、ALS、pattern、coloring、chains、forcing、uniqueness 等。这个覆盖面在 npm Sudoku 包中非常少见。

### 3. 评分不是硬编码“难度标签”

`classic9` 明确把评分和策略版本绑定，评分结果带 `ratingPolicyId` 和 `ratingPolicyVersion`。这比很多包直接输出 `easy/hard/expert` 更适合题库长期入库，因为后续可以重评、迁移或并存多套评分规则。

### 4. 题库生产链路完整

除了 `generateOne()`，项目还提供：

1. `search()` 批量搜索候选。
2. 候选池统计、去重、筛选、合并。
3. manifest 续跑。
4. parallel shard 计划。
5. batch solve / batch rate CLI。
6. canonical key 去重。

这套能力更像题库后台工具链，而不是单函数 npm helper。

### 5. 审计和发布门禁意识强

项目包含 reference smoke、reference rating corpus、coverage audit、forcing evidence audit、BUG graph evidence audit、release smoke corpus 等机制。0.4.0 changelog 也明确强调真实题面评分路径、步骤回放、`verifyStep(..., { mode: "evidence" })` 和不误删真解候选。

### 6. 零运行时依赖

尽管包体较大，运行时依赖为 0。对供应链风险、部署稳定性和长期维护是优势。

## 缺陷和风险

### 1. 生态采用度低

`@sudoku-tools/classic9` 近 30 天下载量为 `360`。对比：

1. `@algorithm.ts/sudoku`：`5315`。
2. `sudoku-gen`：`3109`。
3. `sudoku`：`1757`。
4. `sudoku-core`：`1430`。

GitHub 也只有 `1` star、`0` fork、无 topics、无 Release 页面。当前更像“公开可用的早期专业项目”，还不是生态层面的成熟包。

### 2. 包体和复杂度明显偏重

解包体积约 `942 KB`，其中 `dist/src/solver/techniques.js` 约 `426 KB`。如果用户只是想：

1. 生成一道普通题。
2. 快速求解。
3. 做一个简单网页小游戏。

那么 `classic9` 的能力大概率过剩，轻量包更有吸引力。

### 3. Node >=20 + ESM-only 限制集成面

很多小游戏、旧后端、CommonJS 项目或浏览器直连场景会优先选择更宽松的包。`classic9` 当前更适合现代 Node/TypeScript 项目。

### 4. 生成器多样性边界需要继续补强

`docs/GENERATOR.md` 明确说明当前完整终盘生成器偏 lightweight / reproducible：从固定合法终盘出发做数字置换、行列带内/栈内置换、带/栈置换和转置等价变换，不声称覆盖所有终盘等价类。

这对 smoke、可复现候选池任务是优势；对大规模正式题库的终盘多样性是短板。

### 5. canonical 当前有退化性能问题

当前 `canonicalizeBoard()` 遍历结构变换组合。实测普通题 canonical 约 2.5 秒，空盘约 27 秒，单线索稀疏盘约 10 秒。候选池去重、select、merge、candidate-stats 等路径都会受影响。

这不影响功能正确性，但会影响批量题库任务吞吐。后续应给空盘/低 clue 盘加 fast path，并考虑剪枝或缓存策略。

### 6. 慢速审计不适合默认开发循环

当前已将测试分为：

1. `npm test`：快速测试，约 16 秒。
2. `npm run test:slow`：慢速审计/慢测，约 13 分钟以上。
3. `npm run test:full`：完整测试，约 11 分钟以上。

这个分层是合理方向，但也说明项目已经有明显 release audit 成本。后续新增技巧时，需要继续避免把 release 级审计塞回默认测试。

### 7. 文档偏中文，国际传播弱

文档细，但主要面向中文读者。npm 上主流用户和搜索流量更依赖英文 README、英文 examples、badges、GitHub topics、Release notes。当前对外传播包装不足。

### 8. 仍是 0.x

版本为 `0.4.0`，即使文档有兼容策略，外部使用者仍会预期 API 可能变化。对生产项目采用会有心理门槛。

## 适用场景判断

### 适合

1. 需要结构化提示和教学解释的数独产品。
2. 需要按人类技巧评分和分档的题库系统。
3. 需要 canonical 去重、候选池筛选、批量评分的后台工具。
4. 需要研究高级技巧覆盖、reference corpus、evidence 审计的项目。
5. Node 20+ / TypeScript / ESM 环境。

### 不适合

1. 只需要快速求解答案。
2. 只需要轻量随机生成一道题。
3. 浏览器端极小 bundle。
4. CommonJS 或旧 Node 环境。
5. 需要任意尺寸数独或变体数独。

## 优先建议

### P0：对外可信度和发现性

1. 补 GitHub Release：为 `v0.4.0` 创建 Release notes，并链接 npm。
2. 补 GitHub topics：`sudoku`、`typescript`、`sudoku-solver`、`sudoku-generator`、`logic-solver`、`puzzle`、`canonical`。
3. README 增加英文摘要和英文 quick start，至少覆盖安装、validate、hint、rate、generate、CLI。
4. 增加 badges：CI、npm downloads、bundle/package size、license。
5. 写清楚一句英文定位：`Human-readable Sudoku solving, rating and puzzle-library tooling for classic 9x9 Sudoku.`

### P1：降低采用门槛

1. 增加 `docs/MIGRATING_FROM_POPULAR_PACKAGES.md`，对照 `sudoku-gen`、`sudoku-core`、`@algorithm.ts/sudoku` 给 API mapping。
2. 增加更短的 examples：`validate.ts`、`solve.ts`、`hint.ts`、`generate.ts`。
3. 对 npm README 降噪：把长技巧列表移到 docs，首页突出 5 个最常用 API。
4. 提供 “minimal use” 文档，说明如果只用 parser/validator/rating/generator 应该怎么调用。

### P1：性能和包体

1. 给 `canonicalizeBoard()` 增加空盘、满盘、低 clue 盘 fast path。
2. 候选池操作尽量优先使用已有 `canonicalKey`，缺失时再计算。
3. 考虑 subpath exports：`@sudoku-tools/classic9/core`、`/solver`、`/generator`、`/cli`。
4. 拆分 `solver/techniques.js` 或引入按 profile 的 lazy loading，降低简单场景成本。

### P2：生成器成熟度

1. 增加真正随机终盘生成，或支持外部 solution pool。
2. 给生成器写吞吐和命中率 benchmark，但避免承诺单机绝对性能。
3. 对 `minimality: strict`、线索数硬约束、score target 的冲突提供更明确 cookbook。

### P2：生态信任

1. 发布 `1.0` 前冻结核心 API：parser、validate、uniqueness、solver、rating、canonical。
2. 把 generator/candidate pool 明确标为 experimental 或 beta。
3. 增加 issue templates 和 discussion 入口。
4. 给 reference corpus 增加简短说明页，解释为什么这套质量门禁有价值。

## 与竞品的策略定位

### 对 `sudoku-gen`

不要正面争“更轻、更简单”。`sudoku-gen` 的优势就是轻量 generator。`classic9` 应强调生成后的评分、候选池、canonical、解释和批量工具。

### 对 `@algorithm.ts/sudoku`

不要正面争“纯算法效率”。`@algorithm.ts/sudoku` 更成熟、下载量更大、包体更小。`classic9` 应强调人类逻辑步骤、evidence、评分策略和题库生产。

### 对 `sudoku-core`

这是最接近应用型定位的竞品。`classic9` 的差异点应放在高级技巧覆盖、结构化 evidence、rating policy、canonical 和 CLI batch/search/select。

### 对新近 engine 包

例如 `@reetesh/sudoku-engine`、`@wsabol/sudoku-solver` 也在往 hints / game helper 方向走。`classic9` 当前优势是 corpus/audit 和高级技巧深度；短板是英文包装和生态信号。

## 数据来源

外部来源：

1. npm registry：`https://registry.npmjs.org/<package>`。
2. npm downloads API：`https://api.npmjs.org/downloads/point/2026-05-23:2026-06-22/<package>`。
3. npm search：`npm search sudoku --json`。
4. GitHub API：`https://api.github.com/repos/RichardCao/classic9-sudoku` 以及各竞品仓库 API。
5. npm 页面：`https://www.npmjs.com/package/@sudoku-tools/classic9`。
6. GitHub 页面：`https://github.com/RichardCao/classic9-sudoku`。

本地来源：

1. `package.json`
2. `README.md`
3. `CHANGELOG.md`
4. `docs/API.md`
5. `docs/TECHNIQUES.md`
6. `docs/GENERATOR.md`
7. `docs/RATING.md`
8. `src/canonical/index.ts`
9. `tests/run-tests.ts`

本地验证命令：

```bash
npm test
npm run test:slow
npm run test:full
npm pack --dry-run --json
```

## 后续复核点

1. 如果重新发布 0.4.x 或 0.5.0，应重新抓取 npm 下载量和 GitHub 指标。
2. 如果优化 canonical，应单独记录普通题、空盘、稀疏盘、候选池去重的耗时变化。
3. 如果补 GitHub Release / topics / 英文 README，应观察 npm search 和下载量是否有改善。
4. 如果生成器改为真正随机终盘，应重新评估“题库生产成熟度”。
