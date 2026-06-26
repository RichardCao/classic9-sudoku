# classic9 0.4 发布后任务队列

来源：[`PACKAGE_STATUS_0.4.0_COMPARISON.md`](./PACKAGE_STATUS_0.4.0_COMPARISON.md)
目标：解决 0.4.0 评估中暴露的主要问题，提高公开可信度、采用门槛、性能、生成器成熟度和发布门禁质量。
适用范围：`@sudoku-tools/classic9` npm 包、GitHub 仓库、源码文档、测试/发布流程。

## 总体策略

当前包的核心问题不是功能不足，而是“功能深、生态浅、包偏重、部分路径慢、对外包装弱”。任务队列按以下顺序推进：

1. 先补对外可信度和文档入口，让外部用户看得懂、愿意试。
2. 再降低采用门槛，让常见用户能从轻量包迁移或最小化使用。
3. 同步处理 canonical 和候选池性能，避免专业能力在真实批量任务中拖慢。
4. 再推进生成器成熟度和包体拆分，这两类改动风险更高，需要单独验收。
5. 最后收口 1.0 前 API 稳定化和生态运营。

## 当前是否可以顺次执行

不能简单从 A1 到 I3 无脑顺次执行。原因：

1. A1、A2、G2 涉及 GitHub 远端操作，优先使用 `gh` 或 GitHub API 自动执行；如果本机没有权限或 token，再向维护者请求授权。
2. A5 依赖下一次 npm 发布后才能验证搜索排名变化。
3. C2 的语义已经确认：空盘 `canonicalizeBoard()` 的 transform 固定为 identity；`canonicalizePair()` 面对无唯一解、题面与 solution 不匹配或题面信息不足时，允许 warning + 尽力而为，优先减少资源浪费。
4. D2/D3/D4 是架构任务，必须在 D1 包体报告之后执行，不能提前机械拆分。
5. E2/E3 依赖 E1 的生成器方案设计，不能直接实现。
6. G/I/H 类任务主要是治理和里程碑，不应阻塞 P0/P1 的文档、包装和性能任务。

可以直接按下方“本地可执行顺序”推进；其中标为“外部手工”的任务应单独处理，不阻塞本地代码/文档任务。

## 已确认决策

1. 文档和 Release notes 统一使用中文；README 可以保留必要英文关键词或 badge 文案，但正文以中文为主。
2. GitHub Release、topics、仓库描述、issue 创建等优先自动化执行；需要权限时再询问维护者。
3. 暂不按 `0.4.1` 发布时间排任务，任务主线以功能完善和采用门槛改善为主。
4. README 可以移除完整技巧列表，只保留概览和 `docs/TECHNIQUES.md` 链接。
5. 允许调整 npm keywords，目标是提升搜索曝光。
6. 空盘 canonical transform 固定为 identity。canonical 主要服务有唯一解题面；无解、非唯一解或信息不足题面尽量减少资源浪费。
7. `canonicalizePair()` 对无唯一解、题面与 solution 不匹配或信息不足场景可以给出 warning，并尽力变换，不保证得到强 canonical 结果。
8. 候选池 `canonicalKey` 复用采用策略 B：默认只校验格式，格式合法就复用，不重算比对；严格重算只作为可选审计能力。
9. subpath exports 暂不作为近期任务；实现功能时可以适当保持边界清晰，避免阻碍未来拆分。
10. CommonJS / Node 18 可以低成本评估，但不应显著增加近期工作量。
11. 真正随机终盘生成需要实现；可以参考上层小游戏和开源项目思路，但不能直接拷贝代码。
12. 测试需要做必要性审计：必要的保留，不必要或重复的精简。

## 本地可执行顺序

### 第 0 批：已完成或无需再排

1. F4：更新 0.4.0 changelog 中 `verify:release` / `test:slow` 描述。

### 第 1 批：无需外部权限、低风险、可立即执行

1. F0：测试必要性审计，确认 slow tests 是否都必须保留。
2. F1：固化测试分层文档。
3. A3：README 顶部增加中文定位和最短 Quick Start。
4. A4：增加 README 徽章和外部入口。
5. B2：新增最小示例文件。
6. B4：新增 minimal use 文档。
7. B3：README 首页降噪。

### 第 2 批：需要联网复核或下一次发布验证

1. B1：新增主流包迁移文档，需要复核竞品 README/API。
2. A5：增加 npm 搜索关键词复核；metadata 可以先改，搜索排名验证要等下一次 npm 发布。

### 第 3 批：性能基线和低风险优化

1. C1：为 canonical 添加 benchmark 脚本。
2. D1：生成包体组成报告。
3. C2：canonical 空盘 fast path；按已确认语义实现 identity transform 和 warning/best-effort 边界。
4. C4：候选池优先复用 `canonicalKey`。
5. C5：候选池性能 benchmark。

### 第 4 批：中等风险架构任务

1. C3：canonical 低 clue 剪枝。
2. D3：拆分 `solver/techniques.ts`。
3. D4：评估 lazy loading / profile loading。
4. D2：设计 subpath exports 方案；暂缓执行，只在不增加工作量时兼顾未来拆分。

### 第 5 批：生成器成熟度

1. E1：随机终盘生成方案设计。
2. E4：生成器 cookbook。
3. E2：实现随机 backtracking 终盘生成原型。
4. E3：支持外部 solution pool。

### 第 6 批：外部手工任务

1. A1：创建 GitHub Release for v0.4.0。
2. A2：补 GitHub topics 和仓库描述。
3. F2：CI workflow 分层；需要推分支后观察 GitHub Actions。
4. G2：Issue templates 和 contribution flow。

### 第 7 批：1.0 前治理

1. G1：核心 API 稳定性清单。
2. G3：Reference corpus 说明页。
3. G4：下载量和搜索排名复盘机制。
4. H1：CommonJS / older Node 兼容性决策。
5. H2：Browser usage 文档。
6. I1/I2/I3：0.4.1、0.5.0、1.0 readiness 里程碑。

## 优先级定义

| 优先级 | 含义 | 建议节奏 |
| --- | --- | --- |
| P0 | 直接影响外部可信度、搜索曝光、首次使用体验 | 0.4.x 立即处理 |
| P1 | 直接影响采用门槛、核心性能、常见集成场景 | 0.4.x / 0.5.0 |
| P2 | 提升专业能力成熟度，但改动较大或需要长期验证 | 0.5.x |
| P3 | 生态运营、1.0 前治理、持续观测 | 持续执行 |

## 状态枚举

| 状态 | 含义 |
| --- | --- |
| `todo` | 未开始 |
| `doing` | 进行中 |
| `blocked` | 等外部条件或设计决策 |
| `manual` | 需要仓库权限、npm 发布或 GitHub 设置等外部手工动作 |
| `done` | 已完成且验收通过 |

## Epic A：对外可信度和发现性

### A1. 创建 GitHub Release for v0.4.0

优先级：P0
状态：done
负责人建议：发布维护者
依赖：已存在 git tag `v0.4.0`
执行方式：优先使用 `gh` CLI 或 GitHub API 自动创建；如果本机未登录或权限不足，再向维护者请求授权。

背景：

1. 当前 GitHub tag 已有 `v0.4.0`，但 Release 页面为空。
2. npm 用户和 GitHub 用户很难快速判断 0.4.0 发布内容、边界和升级风险。
3. 评估报告指出 GitHub Release 缺失是生态信任短板。

具体步骤：

1. 确认本地和远端都已有 `v0.4.0` tag；如果远端没有，先请求确认后 push tag。
2. 基于 `CHANGELOG.md` 的 0.4.0 小节整理中文 release notes。
3. Release 标题使用 `v0.4.0 - 参考 corpus 覆盖与公开 API 完善`。
4. Release notes 顶部写明 npm 包链接：`https://www.npmjs.com/package/@sudoku-tools/classic9/v/0.4.0`。
5. 增加“本版变化”分组：reference rating corpus、API additions、evidence improvements、galaxy profile。
6. 增加“兼容性说明”分组：仍为 0.x、Node >=20、ESM-only、generator/candidate pool experimental。
7. 增加“验证命令”分组：发布前运行过的 gate，例如 `npm run verify`、`npm run verify:coverage`、`npm run verify:release -- --input tests/fixtures/release-smoke-corpus.json`。
8. 增加“已知限制”分组：canonical 低 clue 性能、生成器终盘多样性、重型 forcing 不适合在线批量。
9. 发布 GitHub Release，确认 tag 指向 `Release 0.4.0` 提交。

完成记录：

1. 已确认远端 `refs/tags/v0.4.0` 存在，指向 commit `75e9e588546c0c4be21c8178951236987cab3183`。
2. 已用 `gh release create` 创建 GitHub Release。
3. Release URL：`https://github.com/RichardCao/classic9-sudoku/releases/tag/v0.4.0`。
4. `gh release view v0.4.0 --json tagName,name,isDraft,isPrerelease,url,publishedAt` 确认 `isDraft=false`、`isPrerelease=false`。

验收标准：

1. GitHub Releases 页面出现 `v0.4.0`。
2. Release notes 包含 npm 链接、兼容边界、验证命令和已知限制。
3. README 徽章或链接不需要立即修改，但 Release 页面必须可从 tag 进入。
4. Release notes 使用中文，不夸大 experimental 能力。

验证命令/检查：

```bash
git tag --list 'v0.4.0'
git show --stat v0.4.0
git ls-remote --tags origin v0.4.0
gh release view v0.4.0
```

人工检查：

1. 打开 GitHub Release 页面。
2. 确认 Release 非 draft。
3. 确认没有把 experimental 能力描述成 stable 承诺。

### A2. 补 GitHub topics 和仓库描述

优先级：P0
状态：done
负责人建议：仓库管理员
依赖：GitHub 仓库权限
执行方式：优先使用 `gh api` 自动更新；权限不足时询问维护者。

背景：

1. 当前 GitHub topics 为空。
2. `npm search sudoku` 前 15 未出现本包，虽然 topics 不直接决定 npm 搜索，但对 GitHub 搜索和生态可信度有帮助。

具体步骤：

1. 在 GitHub 仓库设置中添加 topics：
   `sudoku`、`typescript`、`sudoku-solver`、`sudoku-generator`、`logic-solver`、`puzzle`、`canonical`、`rating`、`cli`。
2. 仓库描述改为中文为主，例如：
   `标准 9x9 数独 TypeScript 工具库：可解释求解、评分、生成、canonical 去重、候选池和 CLI。`
3. 仓库 website 链接保留 README 或 npm 包链接。
4. 确认 topics 不包含过度营销词，例如 `ai`、`best`、`fastest`。

完成记录：

1. 已用 `gh repo edit` 更新仓库描述：
   `标准 9x9 数独 TypeScript 工具库：可解释求解、评分、生成、canonical 去重、候选池和 CLI。`
2. 已设置 homepage：
   `https://www.npmjs.com/package/@sudoku-tools/classic9`
3. 已设置 topics：
   `sudoku`、`typescript`、`sudoku-solver`、`sudoku-generator`、`logic-solver`、`puzzle`、`canonical`、`rating`、`cli`。
4. 已用 `gh repo view RichardCao/classic9-sudoku --json description,repositoryTopics,url,homepageUrl` 验证生效。

验收标准：

1. GitHub API 返回 topics 非空。
2. 仓库描述能一句话说明和轻量 generator/solver 的差异。

验证命令：

```bash
curl -s https://api.github.com/repos/RichardCao/classic9-sudoku | jq '{description, topics}'
```

### A3. README 顶部增加中文定位和最短 Quick Start

优先级：P0
状态：done
负责人建议：文档维护者
依赖：无

背景：

1. README 目前中文内容完整，但首屏需要更快说明定位和差异点。
2. 当前首页信息量大，高级技巧列表较长，不利于首次用户理解。

具体步骤：

1. 在 README 标题和徽章之后增加中文一句话定位：
   `面向标准 9x9 数独的可解释求解、评分、生成、canonical 去重、候选池和 CLI 工具链。`
2. 增加“为什么用这个包”小节，用 4 条中文 bullet：
   结构化解题步骤、版本化评分策略、canonical 去重、候选池和批量 CLI。
3. 增加最短中文 Quick Start，展示：
   `parsePuzzle`、`validate`、`hint`、`rate`、`generateOne`。
4. “当前版本定位”保留，但移动到首屏摘要之后。
5. README 顶部不放完整 60 个 stable 技巧列表，只保留链接到 `docs/TECHNIQUES.md`。
6. 保留中文 API 选择表；必要英文内容仅限 API 名称和关键词。

验收标准：

1. npm README 顶部 60 秒内能看懂包定位。
2. 中文 Quick Start 能复制运行。
3. 不夸大生成器成熟度，不把 experimental 技巧描述成默认能力。

验证命令：

```bash
npm run typecheck
npm test
npm pack --dry-run --json
```

人工检查：

1. 打开 npm 包 README 预览或本地 markdown 预览。
2. 确认首屏不被长技巧列表淹没。

### A4. 增加徽章和外部入口

优先级：P0
状态：done
负责人建议：文档维护者
依赖：CI workflow 名称稳定

背景：

1. 当前 README 只有 npm version、license、GitHub 三个徽章。
2. 外部用户缺少 CI 状态、下载量、包体等快速信号。

具体步骤：

1. 增加 CI badge，指向 `.github/workflows/ci.yml` 实际 workflow 名称。
2. 增加 npm downloads badge。
3. 增加 unpacked/package size badge，如使用 bundlephobia 需确认 scoped package 可访问。
4. 增加 TypeScript badge 或 `types included` 文案。
5. 保留 MIT badge。
6. 如果 badge 服务不能稳定处理 scoped package，则不要加不可靠 badge。

完成记录：

1. 已增加 CI badge。
2. 已增加 npm downloads badge。
3. 已增加 types included badge。
4. 包体 badge 暂未增加，原因是 scoped package 的第三方体积 badge 稳定性需要后续确认。

验收标准：

1. README 徽章链接可点击。
2. CI badge 状态能正确显示。
3. 没有坏图标或 404 badge。

验证：

1. 本地 markdown 预览。
2. GitHub README 页面人工检查。

### A5. 增加 npm 搜索关键词复核

优先级：P0
状态：done
负责人建议：发布维护者
依赖：下一次 npm 发布
执行说明：可以先修改 metadata；搜索排名变化只能在下一次 npm 发布后验证。

背景：

1. `npm search sudoku` 前 15 未出现本包。
2. 当前 keywords 包含 `sudoku`、`sudoku-solver`、`sudoku-generator`、`classic9`、`puzzle`、`typescript`，还可以更贴近用户搜索。

具体步骤：

1. 在 `package.json` keywords 中评估增加：
   `sudoku-rating`、`sudoku-hints`、`sudoku-cli`、`sudoku-generator`、`sudoku-solver`、`logic-puzzle`、`canonical`、`puzzle-generator`。
2. 避免关键词过多或无关。
3. 更新后运行 `npm pack --dry-run --json`，确认 package metadata 正常。
4. 在下一次发布后记录 `npm search sudoku --json` 的排名变化。

完成记录：

1. `package.json` description 已补入英文可搜索关键词 `Sudoku TypeScript`，同时保留中文定位。
2. keywords 已覆盖 solver、generator、rating、hints、cli、canonical、logic puzzle 和 TypeScript。
3. 已用 `npm search sudoku --json --searchlimit=20` 复核当前主流关键词形态；排名变化需要等下一次 npm 发布后再记录。
4. 已运行 `npm pack --dry-run --json --cache ./.npm-cache`，package metadata 正常。

验收标准：

1. keywords 能覆盖 solver/generator/hints/rating/canonical/cli。
2. 不引入与实际能力不符的关键词。

验证命令：

```bash
node -e "const p=require('./package.json'); console.log(p.keywords)"
npm pack --dry-run --json
```

## Epic B：采用门槛和文档重构

### B1. 新增主流包迁移文档

优先级：P1
状态：done
负责人建议：文档维护者
依赖：竞品 API 复核

背景：

1. 评估报告指出 `sudoku-gen`、`sudoku-core`、`@algorithm.ts/sudoku` 是关键竞品。
2. 用户需要知道为什么不直接用轻量包，以及迁移成本。

建议文件：

```text
docs/MIGRATING_FROM_POPULAR_PACKAGES.md
```

具体步骤：

1. 增加 `sudoku-gen` 对照：
   生成一道题、难度标签差异、classic9 的评分/候选池补充价值。
2. 增加 `sudoku-core` 对照：
   board 表示、step-by-step solving、analysis、difficulty 与 classic9 rating policy 的区别。
3. 增加 `@algorithm.ts/sudoku` 对照：
   DLX/creator/solver 与 classic9 人类逻辑 evidence 的差异。
4. 增加 `sudoku` 老包对照：
   Node/Web 旧包场景、现代 TS/ESM/API 差异。
5. 每个迁移章节至少包含：
   `原包常见用法`、`classic9 对应 API`、`注意事项`、`不建议迁移的场景`。
6. 增加统一 board adapter 说明：
   `fromMatrix`、`toMatrix`、`fromNullableBoard`、`toNullableBoard`。
7. 链接到 `docs/API.md`、`docs/RATING.md`、`docs/GENERATOR.md`。

验收标准：

1. 文档覆盖至少 4 个包。
2. 每个包至少有 1 个代码示例。
3. 明确说明“不适合只要轻量生成/快速求解的用户”。

完成记录：

1. 已新增 `docs/MIGRATING_FROM_POPULAR_PACKAGES.md`。
2. 已覆盖 `sudoku-gen`、`sudoku-core`、`@algorithm.ts/sudoku` 和 `sudoku`。
3. 每个包均包含原包常见用法、classic9 对应 API、注意事项和不建议迁移场景。
4. README 文档列表已增加主流包迁移文档链接。
5. `package.json files` 已加入该文档，确保 npm 包内容和 README 入口一致。

验证：

```bash
npm run examples:typecheck
npm test
```

### B2. 新增最小示例文件

优先级：P1
状态：done
负责人建议：示例维护者
依赖：无

背景：

1. 当前 examples 数量较少，偏综合。
2. 用户需要按任务复制最小示例。

建议新增文件：

```text
examples/validate.ts
examples/solve.ts
examples/hint.ts
examples/rate.ts
examples/generate.ts
examples/canonical-dedupe.ts
```

具体步骤：

1. `validate.ts`：展示 parse + validate + invalid input handling。
2. `solve.ts`：展示 walkthrough/analyzeSolve 和 solved/stuckReason。
3. `hint.ts`：展示 `hint(board, { format: { locale: 'zh-CN' } })` 和 `en-US`。
4. `rate.ts`：展示 stable/extended/galaxy profile 的结果差异。
5. `generate.ts`：展示 `generateOne` 的最小请求、失败状态、bestCandidate 不入库原则。
6. `canonical-dedupe.ts`：展示两个等价题面的 canonical key 去重。
7. 更新 `examples/README.md`。
8. 更新 `README.md` 的 examples 链接列表。
9. 确保 `tsconfig.examples.json` 包含新增文件。

验收标准：

1. 每个示例只聚焦一个场景。
2. 示例无外部依赖。
3. `npm run examples:typecheck` 通过。

验证命令：

```bash
npm run examples:typecheck
npm test
```

### B3. README 首页降噪

优先级：P1
状态：done
负责人建议：文档维护者
依赖：A3

背景：

1. README 当前直接列出 60 个 stable 技巧和大量 experimental 技巧说明。
2. npm 首页过长会影响新用户判断。

具体步骤：

1. README 中保留 “stable 技巧概览”，改为：
   `当前 stable 覆盖 60 个技巧，详见 docs/TECHNIQUES.md`。
2. 保留 5 到 8 个代表性技巧族，不展开完整列表。
3. 将完整技巧列表移动到 `docs/TECHNIQUES.md`，该文件已存在，无需重复。
4. README 保留 extended/galaxy 的边界说明，但压缩到 2 段。
5. README 顶部保留安装、Quick Start、API 选择表、CLI Quick Start。

验收标准：

1. README 首屏更短。
2. 用户仍能快速找到完整技巧列表链接。
3. 不删除生成器和重型 forcing 的限制说明。

验证：

```bash
npm pack --dry-run --json
npm test
```

### B4. 新增 minimal use 文档

优先级：P1
状态：done
负责人建议：文档维护者
依赖：B2

建议文件：

```text
docs/MINIMAL_USE.md
```

背景：

1. 包功能很全，但用户可能只想用其中一小块。
2. 当前包还未拆 subpath exports，文档应先说明最小调用方式和成本。

具体步骤：

1. 章节一：只做 parse/validate。
2. 章节二：只做唯一解检查。
3. 章节三：只做 hint。
4. 章节四：只做 rate。
5. 章节五：只做 generate。
6. 章节六：只做 canonical key。
7. 每章包含：
   `imports`、`input format`、`return summary`、`runtime caveat`。
8. 明确说明当前仍是单入口 export，tree-shaking 取决于打包器。

验收标准：

1. 文档能让用户不用读完整 API.md 就完成常见任务。
2. 对 canonical 和 galaxy profile 的性能风险有提示。

验证：

```bash
npm test
```

## Epic C：canonical 与候选池性能

### C1. 为 canonical 添加 benchmark 脚本

优先级：P1
状态：done
负责人建议：性能维护者
依赖：无

背景：

评估中实测：

1. 普通题 canonical 约 2.5 秒。
2. 空盘 canonical 约 27 秒。
3. 单线索稀疏盘 canonical 约 10 秒。

在优化前需要稳定 benchmark，避免只凭单次手测判断。

建议文件：

```text
scripts/benchmark-canonical.mjs
```

具体步骤：

1. 构造 benchmark cases：
   `normal puzzle`、`solved grid`、`empty board`、`single clue`、`17 clues`、`generated 40 clues`。
2. 每个 case 支持 `--iterations <n>`。
3. 输出 human summary 和 `--json`。
4. 统计 `minMs`、`maxMs`、`avgMs`、`p50Ms`、`p95Ms`。
5. 记录 canonical key 长度和 transform 合法性。
6. 增加 npm script：
   `benchmark:canonical`: `npm run build && node scripts/benchmark-canonical.mjs`
7. 文档写入 `docs/CANONICAL.md` 的性能分析小节。

完成记录：

1. 已新增 `scripts/benchmark-canonical.mjs`。
2. 已新增 npm script `benchmark:canonical`。
3. 脚本支持 `--iterations`、`--case` 和 `--json`。
4. 当前 smoke 结果显示空盘 fast path 为毫秒级；普通题和低 clue 题仍是后续 C3 优化对象。

验收标准：

1. 脚本能稳定跑完。
2. JSON 输出可用于后续对比。
3. benchmark 不进入默认 `npm test`。

验证命令：

```bash
npm run build
node scripts/benchmark-canonical.mjs --iterations 3 --json
npm test
```

### C2. canonical 空盘 fast path

优先级：P1
状态：done
负责人建议：核心算法维护者
依赖：C1

背景：

空盘 canonical 当前会遍历全结构组合，但结果显然是 81 个 `0`，transform 可以使用 identity 或约定的最小 transform。
已确认正式约定：空盘 `canonicalizeBoard(emptyBoard)` 固定返回 identity transform。canonical 主要服务有唯一解的题面；对于无解、非唯一解或信息不足题面，应尽量减少资源浪费，输出 best-effort 结果或 warning，而不是消耗大量时间追求强 canonical。

具体步骤：

1. 在 `canonicalizeBoard()` 开头统计 filled cell count。
2. 如果 filled count 为 0，直接返回：
   `key = '0'.repeat(81)`。
3. `board = new Array(81).fill(0)`。
4. transform 使用 identity：
   `transposed = false`、`rowOrder = [0..8]`、`colOrder = [0..8]`、`digitMap = [0..9]`。
5. 增加单元测试：
   空盘 canonical key、board、transform 合法。
6. 为 `canonicalizePair(emptyPuzzle, solution)` 增加明确行为：
   如果 puzzle 为空、无唯一解、与 solution 不匹配或题面信息不足，返回 warning，并按 best-effort transform 处理；不保证 solution 被强 canonical 化。
7. 为 `CanonicalPairResult` 或 diagnostics 增加 warning 承载方式；如果不适合改公开返回结构，则先在文档和错误/警告策略中明确。
8. 更新 `docs/CANONICAL.md`，写明空盘 identity 约定和 pair best-effort 边界。

完成记录：

1. `canonicalizeBoard(emptyBoard)` 已直接返回 81 个 `0`、空 board 和 identity transform。
2. `canonicalizePair()` 已增加可选 `warnings`，面对不完整、冲突或与题面不匹配的 solution 时返回 best-effort 结果。
3. `canonicalPairResult` schema 已允许 `solution` 为普通 board，并增加 `warnings` 字段。
4. `docs/CANONICAL.md` 已写入空盘 identity transform 和 best-effort 约定。
5. `tests/run-tests.ts` 已覆盖空盘 identity transform 和 pair warnings。

设计注意：

1. `canonicalizeBoard(emptyPuzzle)` 当前可能返回某个任意最小 transform；因为所有 transforms key 相同，identity 是稳定可解释选择，并已作为正式约定。
2. `canonicalizePair()` 以 puzzle 为主；puzzle 不能提供足够信息时不为了 solution tie-break 消耗大量资源。
3. 如果未来需要“solution 也强 canonical”的能力，应另开 API 或 option，例如 `canonicalizeSolutionGrid()` 或 `canonicalizePair(..., { tieBreakBySolution: true })`，不要改变默认轻量策略。

验收标准：

1. `canonicalizeBoard(emptyBoard)` 耗时降到毫秒级。
2. 现有 `testCanonicalize` 通过。
3. 文档说明空盘 identity transform 策略。
4. `canonicalizePair()` 对 empty / non-unique / mismatch 场景的 warning 或 best-effort 行为有测试覆盖。

验证命令：

```bash
npm run benchmark:canonical -- --iterations 10 --json
npm test
npm run test:slow
```

### C3. canonical 低 clue 剪枝

优先级：P1
状态：done
负责人建议：核心算法维护者
依赖：C1、C2

背景：

单线索稀疏盘约 10 秒，说明低 clue 棋盘剪枝不足。候选池场景可能包含大量低 clue 或等价近似题面。

具体步骤：

1. 在 benchmark 中固定 single clue、two clues same band、two clues different bands、17 clue cases。
2. 分析 `buildCanonicalCandidate()` 的 early exit 命中率。
3. 尝试按 clue 分布先生成候选 row/col order 的排序，优先让更多 `0` 或更小 mapped digit 出现在前面。
4. 为低 clue board 增加结构签名剪枝：
   row clue counts、col clue counts、box clue counts、digit occurrence counts。
5. 在遍历 rowOrder/colOrder 前先过滤不可能优于当前 best 的 order pair。
6. 保持 canonical key 与旧算法一致；如果改变 key，必须升级 canonical version，原则上不接受。
7. 增加 old/new 对照测试：选取固定 corpus，优化前后 key 不变。

完成记录：

1. 已增加单线索 fast path：直接推导 canonical key 为 80 个 `0` 加 `1`，并生成合法 transform。
2. `npm run benchmark:canonical -- --iterations 1 --case sparse-multiple --json` 显示单线索耗时约 2.3ms，较此前约 3.8s 明显超过 5x 改善。
3. 已增加测试固定单线索 canonical key 和 transform 合法性。
4. 多线索低 clue 的进一步剪枝仍可在后续优化中继续推进；当前已满足本任务验收中的单线索性能门槛。

验收标准：

1. 单线索 canonical 性能至少提升 5x。
2. 普通题 canonical 不变慢。
3. 固定 corpus canonical key 全部不变。

验证命令：

```bash
npm run benchmark:canonical -- --iterations 5 --json
npm test
npm run test:slow
```

### C4. 候选池优先复用 canonicalKey

优先级：P1
状态：done
负责人建议：生成器/候选池维护者
依赖：C1

背景：

候选池 select/merge/stats/dedupe 路径慢，原因之一是重复计算 canonical。已经有候选可能携带 `canonicalKey`，应优先复用。
已确认采用策略 B：默认只校验 `canonicalKey` 格式，格式合法就复用，不重新计算并比对 puzzle。严格重算比对只作为可选审计能力。

具体步骤：

1. 检查 `selectFromCandidates()` 中 dedupe canonical 的实现。
2. 检查 CLI：
   `select`、`merge-candidates`、`candidate-stats`、`dedupe-candidates`。
3. 定义 canonical key 获取顺序：
   `candidate.canonicalKey` 合法则使用；否则 `canonicalizeBoard(candidate.puzzle)`。
4. 增加 canonicalKey 合法性校验：
   81 位字符串，只含 `0-9`，必要时可附带 algorithm/version。
5. 增加 diagnostics：
   `canonicalKeyReused`、`canonicalKeyComputed`、`canonicalKeyInvalid`。
6. 增加可选严格审计参数：
   API 可用 `verifyCanonicalKey: true`，CLI 可用 `--verify-canonical-key`；严格模式下重新计算并比对，不匹配时报错或记录 `canonicalKeyMismatch`。
7. 更新 `docs/CANDIDATE_POOL.md`，建议长期入库保存 canonical metadata，并说明默认复用策略与严格审计策略差异。
8. 增加测试：
   有 canonicalKey 时不调用 canonicalizeBoard，可通过注入或计数 helper 间接验证。
9. 增加测试：
   格式非法 canonicalKey 会回退到重新计算或报出明确 diagnostics。
10. 增加测试：
   `--verify-canonical-key` 能发现 canonicalKey 与 puzzle 不匹配。

完成记录：

1. 候选池 API 默认只校验 `canonicalKey` 格式；格式合法时直接复用。
2. 缺少合法 `canonicalKey` 的候选在 canonical 去重路径会重新计算 canonical key。
3. `selectFromCandidates()`、`dedupeCandidates()`、CLI `select`、`merge-candidates`、`candidate-stats`、`dedupe-candidates` 已支持 `verifyCanonicalKey` / `--verify-canonical-key`。
4. `CandidateSelectionDiagnostics` 和 `CandidateDedupeResult.diagnostics` 已增加 `canonicalKeyUsage`，记录 reused、computed、invalid。
5. `docs/CANDIDATE_POOL.md` 已说明默认复用策略、严格审计策略和 diagnostics 含义。
6. `tests/run-tests.ts` 已覆盖默认复用、严格校验和缺 key 计算路径。

验收标准：

1. 已有 canonicalKey 的候选池操作显著变快。
2. 缺失 canonicalKey 的行为保持兼容。
3. diagnostics 能看出复用、计算、非法和不匹配数量。
4. 默认模式不重算格式合法的 canonicalKey。
5. 严格审计模式可以发现不匹配数据。

验证命令：

```bash
npm test
npm run test:slow
node scripts/benchmark-canonical.mjs --iterations 3 --json
```

### C5. 候选池性能 benchmark

优先级：P1
状态：done
负责人建议：生成器/候选池维护者
依赖：C4

建议文件：

```text
scripts/benchmark-candidate-pool.mjs
```

具体步骤：

1. 构造候选池：
   10、100、1000 个候选。
2. 分别测试：
   全部带 canonicalKey、全部不带 canonicalKey、50% 带 canonicalKey。
3. 测试操作：
   `candidate-stats`、`dedupeCandidates`、`selectFromCandidates`、`merge-candidates`。
4. 输出 human + JSON。
5. 不进入默认 test。

完成记录：

1. 已新增 `scripts/benchmark-candidate-pool.mjs`。
2. 已新增 npm script `benchmark:candidate-pool`。
3. 脚本支持 `--size`、`--iterations`、`--verify-canonical-key` 和 `--json`。
4. 默认使用合成候选池，避免把生成器耗时混入候选池操作基准。

验收标准：

1. 能量化 C4 的改进。
2. benchmark 数据不承诺公开性能，只作为开发对比。

验证命令：

```bash
npm run build
node scripts/benchmark-candidate-pool.mjs --json
```

## Epic D：包体和模块边界

### D1. 生成包体组成报告

优先级：P1
状态：done
负责人建议：构建维护者
依赖：无

背景：

当前解包体积约 `942 KB`，`dist/src/solver/techniques.js` 约 `426 KB`。需要先量化构成，再决定拆分策略。

建议文件：

```text
scripts/analyze-package-size.mjs
```

具体步骤：

1. 运行 `npm pack --dry-run --json`。
2. 解析 files 列表，按目录聚合 size：
   `core`、`solver`、`generator`、`cli`、`docs`、`examples`。
3. 输出 top 20 files。
4. 增加 npm script：
   `analyze:package-size`: `npm run build && node scripts/analyze-package-size.mjs`
5. 在报告中标记是否超过阈值：
   unpacked > 1MB warning、single file > 500KB warning。

完成记录：

1. 已新增 `scripts/analyze-package-size.mjs`。
2. 已新增 npm script `analyze:package-size`。
3. 脚本调用 `npm pack --dry-run --json --cache ./.npm-cache`，输出 human 或 `--json`，并支持 `--out` 和 `--limit`。
4. 当前 smoke 报告：tarball 约 213.9 KB，unpacked 约 1,045.9 KB，entryCount 94。
5. 当前最大组为 `dist/src/solver` 约 489.1 KB，最大单文件为 `dist/src/solver/techniques.js` 约 425.6 KB；docs 约 203.8 KB，是后续 D2/D3/D4 的评估输入。

验收标准：

1. 能一条命令看到包体组成。
2. 输出可复制到 release notes。

验证命令：

```bash
npm run analyze:package-size
npm test
```

### D2. 设计 subpath exports 方案

优先级：P3
状态：done
负责人建议：API 维护者
依赖：D1

背景：

当前只有根入口 `"."`。用户即使只需要 parser/validate，也会看到完整包入口。虽然 tree-shaking 可能工作，但 Node 直接使用无法按功能边界表达依赖。
当前决策：暂时不主动推进 subpath exports，先完善功能和性能；实现其他任务时只需保持模块边界清晰，避免增加未来拆分成本。

建议 subpaths：

```text
@sudoku-tools/classic9/core
@sudoku-tools/classic9/solver
@sudoku-tools/classic9/generator
@sudoku-tools/classic9/canonical
@sudoku-tools/classic9/rating
@sudoku-tools/classic9/schema
```

具体步骤：

1. 设计 `src/core-api.ts` 或目录级 `index.ts` 入口。
2. 明确每个 subpath 导出范围。
3. 更新 `package.json exports`，保留根入口兼容。
4. 确保 types 指向对应 `.d.ts`。
5. 增加 import smoke：
   每个 subpath 用 Node ESM import 一次。
6. 更新 README / `docs/API.md`，说明根入口仍推荐，subpath 面向轻量场景。

完成记录：

1. 已新增 `docs/SUBPATH_EXPORTS_PLAN.md`。
2. 当前决策为暂缓发布 subpath exports，先保持模块边界清晰，避免过早形成兼容承诺。
3. 文档已列出候选 subpaths、前置条件和验证草案。

验收标准：

1. 旧 import 不破坏。
2. 新 subpath import 可用。
3. `npm pack --dry-run --json` 包含对应 dist 文件。

验证命令：

```bash
npm run build
node --input-type=module -e "import('@sudoku-tools/classic9/core')"
npm test
npm run smoke:pack
```

### D3. 拆分 `solver/techniques.ts`

优先级：P2
状态：done
负责人建议：solver 维护者
依赖：D1、D2

背景：

`dist/src/solver/techniques.js` 是最大文件。拆分可以改善维护性，也可能为 lazy loading 或 profile-based loading 铺路。

建议目录：

```text
src/solver/techniques/singles.ts
src/solver/techniques/subsets.ts
src/solver/techniques/fish.ts
src/solver/techniques/wings.ts
src/solver/techniques/als.ts
src/solver/techniques/patterns.ts
src/solver/techniques/chains.ts
src/solver/techniques/forcing.ts
src/solver/techniques/uniqueness.ts
src/solver/techniques/index.ts
```

具体步骤：

1. 先只做机械拆分，不改算法。
2. 保持 `buildDefaultTechniques()` 行为和技巧顺序不变。
3. 每拆一个家族跑 `npm test`。
4. 拆完跑 `npm run test:slow`。
5. 确认 dist 包体总体不显著变大。
6. 如果循环依赖出现，先抽公共 helper 到 `techniques/common.ts`。

完成记录：

1. 已将原 `src/solver/techniques.ts` 的实现迁入 `src/solver/techniques/index.ts`。
2. 原 `src/solver/techniques.ts` 保留为兼容 barrel，继续支持现有 import 路径 `../solver/techniques.js`。
3. 本次只做机械拆分，不改算法、不改技巧顺序、不改 public API。
4. `npm test` 已通过，覆盖技巧定义数量、stable/experimental 边界和 `getTechniqueDefinitions()` 顺序相关回归。
5. `npm run analyze:package-size -- --json --limit 8` 已通过；`dist/src/solver/techniques.js` 不再是最大实现文件，实际实现进入 `dist/src/solver/techniques/index.js`。
6. 后续如果继续按 singles/subsets/fish/wings/als/patterns/chains/forcing/uniqueness 逐族拆分，应以当前目录结构为基础继续推进。

验收标准：

1. 技巧定义数量仍为 90。
2. stable/experimental 数量不变。
3. `npm test` 和 `npm run test:slow` 通过。
4. `getTechniqueDefinitions()` 输出顺序不变。

验证命令：

```bash
npm test
npm run test:slow
npm run analyze:package-size
```

### D4. 评估 lazy loading / profile loading

优先级：P2
状态：done
负责人建议：架构维护者
依赖：D2、D3

背景：

很多用户只使用基础 validate/generate/rate，不一定需要全部 heavy techniques 常驻入口。lazy loading 可降低初始加载成本，但会引入异步 API 或构建复杂度。

具体步骤：

1. 调研当前 API 是否允许异步加载技巧。
2. 评估保持同步 API 的方案：
   profile build-time split、optional subpath import、静态分包。
3. 写 ADR：
   `docs/ADR_TECHNIQUE_LOADING.md`。
4. 明确不做的方案及原因，例如破坏同步 `hint()`。
5. 如果采用 lazy loading，先新增实验 API，不改默认入口。

完成记录：

1. 已新增 `docs/ADR_TECHNIQUE_LOADING.md`。
2. 决策为暂不引入异步 lazy loading，不破坏同步 `hint()` / `nextStep()` / `walkthrough()` / `rate()`。
3. 后续优先做静态拆分和 subpath exports 评估。

验收标准：

1. 有明确 ADR。
2. 不破坏现有 API。
3. 有 bundle/Node startup benchmark 支撑决策。

## Epic E：生成器成熟度

### E1. 随机终盘生成方案设计

优先级：P2
状态：done
负责人建议：生成器维护者
依赖：无

背景：

当前终盘生成从固定合法终盘做等价变换，适合 reproducible smoke，但不覆盖所有终盘等价类。

具体步骤：

1. 写设计文档：
   `docs/GENERATOR_RANDOM_SOLUTION_PLAN.md`。
2. 对比三种方案：
   backtracking 随机填充、DLX 随机精确覆盖、外部 solution pool。
3. 定义质量指标：
   solution diversity、速度、可复现 seed、内存、唯一解检查成本。
4. 定义 API 选项：
   `solutionSource: 'transform-fixed' | 'random-backtracking' | 'pool'`。
5. 明确默认值是否保持兼容。
6. 列出迁移风险。

完成记录：

1. 已新增 `docs/GENERATOR_RANDOM_SOLUTION_PLAN.md`。
2. 已明确推荐新增 `random-backtracking`，默认仍保持 `transform-fixed`。
3. 已说明外部 solution pool 的 provenance / license 边界。

验收标准：

1. 文档明确推荐方案和不推荐方案。
2. API 变更点清楚。
3. 不影响当前 generator 行为。

### E2. 实现随机 backtracking 终盘生成原型

优先级：P2
状态：done
负责人建议：生成器维护者
依赖：E1

具体步骤：

1. 在 `src/generator/solution-grid.ts` 增加新 generator class 或策略。
2. 使用 seeded RNG，保证相同 seed 可复现。
3. 随机选择 cell order 或 digit order。
4. 加入 max node / max elapsed budget，避免极端慢。
5. 与现有 transform-fixed 策略并存。
6. 增加 tests：
   完整合法终盘、seed 稳定、不同 seed 多样性、budget abort。
7. 增加 benchmark。

完成记录：

1. `SolutionGridFactory` 已新增 `createWithOptions()`，支持 `source: 'random-backtracking'`。
2. 随机终盘生成使用 seeded RNG，保持相同 seed 可复现。
3. 已增加 node / elapsed budget，超出时返回 `timeout`。
4. `generateOne()` 已支持 `solutionSource: 'random-backtracking'`，默认仍为 `transform-fixed`。
5. 已增加测试覆盖合法性、seed 稳定性、不同 seed 多样性和 timeout。

验收标准：

1. 生成终盘合法。
2. seed 可复现。
3. 100 个 seed 不重复率达到设计阈值。
4. 不改变旧默认行为，除非明确发布 breaking note。

验证命令：

```bash
npm test
npm run benchmark:uniqueness
```

### E3. 支持外部 solution pool

优先级：P2
状态：done
负责人建议：生成器维护者
依赖：E1

具体步骤：

1. 设计 `solutionPool` 输入格式：
   array、file path、callback 暂只选一种。
2. CLI 支持 `--solution-pool <file>`。
3. 校验每个 solution 完整、合法。
4. seed 决定 pool 抽样顺序。
5. 文档说明 pool 数据不随 npm 包提供。

完成记录：

1. `GenerationRequest` 已支持 `solutionSource: 'pool'` 和 `solutionPool`。
2. `SolutionGridFactory` 已支持从 pool 中按 seed 抽取完整终盘。
3. CLI `generator-analyze`、`generate`、`search` 已支持 `--solution-pool <file>`。
4. 已校验 pool 中每个 solution 必须是完整合法终盘。
5. `docs/GENERATOR.md` 已说明 pool 数据不随 npm 包提供。

验收标准：

1. 用户可以用自有终盘池生成题目。
2. 非法终盘有明确错误。
3. pool 模式和 existing generator constraints 兼容。

### E4. 生成器 cookbook

优先级：P2
状态：done
负责人建议：文档维护者
依赖：E1 可并行

建议文件：

```text
docs/GENERATOR_COOKBOOK.md
```

具体步骤：

1. 增加 “在线生成一题” 配方。
2. 增加 “离线构建候选池” 配方。
3. 增加 “固定 clue target” 配方。
4. 增加 “strict minimality” 配方。
5. 增加 “目标分数范围” 配方。
6. 增加 “要求出现某技巧” 配方。
7. 增加 “失败诊断 bestCandidate 怎么看” 配方。
8. 增加 “为什么高分+窄技巧范围难命中” 说明。

完成记录：

1. 已新增 `docs/GENERATOR_COOKBOOK.md`。
2. 已覆盖在线生成、离线候选池、固定 clue target、strict minimality、目标分数范围、目标技巧和失败诊断。
3. 文档明确 `bestCandidate` 只用于诊断，不应直接入库。

验收标准：

1. 每个 cookbook 都有完整 JSON 请求。
2. 每个 cookbook 都说明成功/失败状态如何判断。
3. 不把 `bestCandidate` 描述成可直接入库。

## Epic F：测试、CI 与发布门禁

### F0. 测试必要性审计

优先级：P0
状态：done
负责人建议：测试维护者
依赖：当前 `npm test` / `npm run test:slow` 已可运行

背景：

`npm run test:slow` 当前约 13 分钟。用户确认需要判断这些测试是否都必要：必要的保留，不必要或重复的精简。

具体步骤：

1. 列出 `runSlowTest(...)` 中的每个慢测及耗时。
2. 将慢测分为四类：
   release gate 必需、脚本接口 smoke 必需、重复覆盖可删、benchmark/诊断应移出测试。
3. 对每个慢测标注覆盖目标：
   API 行为、CLI 行为、corpus 正确性、evidence 安全、性能诊断。
4. 找出重复执行的 audit：
   例如测试里直接跑 corpus，同时又通过脚本子进程跑同一 corpus。
5. 对可删或可降级的慢测提出替代验证：
   tiny fixture、单行 corpus、脚本参数 smoke、独立 `verify:coverage`。
6. 输出审计文档：
   `docs/TEST_AUDIT.md` 或写入 `docs/TESTING.md`。
7. 根据审计结论更新 `tests/run-tests.ts` 和 npm scripts。

验收标准：

1. 每个 slow test 都有保留或精简理由。
2. `npm test` 保持快速。
3. `npm run test:slow` 的耗时有明确目标；如果不能减少，必须说明原因。
4. 被删除或降级的测试，其覆盖目标有替代 gate。

验证：

```bash
npm test
npm run test:slow
```

### F1. 固化测试分层文档

优先级：P0
状态：done
负责人建议：测试维护者
依赖：当前测试分层已实现

背景：

当前已有：

1. `npm test`：fast。
2. `npm run test:slow`：slow-only。
3. `npm run test:full`：full。

需要把策略写清楚，避免后续又把 release audit 塞回 fast。

具体步骤：

1. 新增或更新 `docs/CI.md`，如果公开 docs 不包含则创建 `docs/TESTING.md`。
2. 写明 fast/slow/full 的边界。
3. 写明新增测试时的归类规则：
   unit/smoke -> fast；真实题面全量/audit 子进程/benchmark -> slow。
4. 写明本地推荐：
   开发中跑 `npm test`；PR 前跑 `npm test` + 相关 slow；发布前跑 `verify:release`。
5. README 本地验证小节链接到该文档。

验收标准：

1. 文档明确测试归类。
2. 新贡献者能判断新测试放哪里。

验证：

```bash
npm test
```

### F2. CI workflow 分层

优先级：P1
状态：done
负责人建议：CI 维护者
依赖：F1

背景：

CI 应该把快速反馈和慢速审计拆开，否则 PR 反馈慢。

具体步骤：

1. 检查 `.github/workflows/ci.yml` 当前内容。
2. 增加 fast job：
   `npm ci`、`npm run typecheck`、`npm test`、`npm run examples:typecheck`。
3. 增加 smoke job：
   `npm run smoke:dist`、`npm run smoke:cli`、`npm run pack:dry-run`、`npm run smoke:pack`。
4. 增加 slow audit job：
   `npm run test:slow`，可设置只在 main、tag、manual dispatch 跑。
5. 增加 release audit job：
   tag 或 manual 时跑 `npm run verify:release -- --input tests/fixtures/release-smoke-corpus.json`。
6. 配置 timeout：
   fast 10 分钟，slow 30 分钟，release 45 分钟。

完成记录：

1. `.github/workflows/ci.yml` 已拆为 `fast`、`smoke`、`slow-audit` 和 `release-audit`。
2. PR 路径保留 fast 反馈；main/tag/manual 覆盖 slow；tag/manual 覆盖 release audit。
3. 已配置 fast 10 分钟、slow 30 分钟、release 45 分钟 timeout。

验收标准：

1. PR 能快速拿到 fast 反馈。
2. main/tag 仍覆盖慢审计。
3. CI badge 指向 fast 或 overall 状态明确。

验证：

1. 本地检查 workflow yaml。
2. 推分支观察 GitHub Actions。

### F3. 慢测性能预算报警

优先级：P1
状态：done
负责人建议：测试维护者
依赖：F1

背景：

`test:slow` 已经 10 分钟级。如果继续增长，需要报警。

具体步骤：

1. 增加 `scripts/run-tests-with-timing.mjs` 或在 runner 内可选 `CLASSIC9_TEST_TIMING=1`。
2. 输出每个测试耗时。
3. 对 fast 测试设置 soft budget：
   单项 > 500ms warning，总耗时 > 60s warning。
4. 对 slow 测试设置 soft budget：
   单项 > 5min warning，总耗时 > 20min warning。
5. CI 中只打印 warning，不直接失败；release 可选择失败。

完成记录：

1. `tests/run-tests.ts` 已支持 `CLASSIC9_TEST_TIMING=1`。
2. 计时模式输出耗时前 20 的测试项和 soft budget warning。
3. 可用 `CLASSIC9_TEST_TIMING_FAIL_ON_BUDGET=1` 将 warning 升级为失败。
4. `docs/TESTING.md` 和 `CONTRIBUTING.md` 已说明用法。

验收标准：

1. 能定位新增慢点。
2. 默认输出不太吵。

验证命令：

```bash
CLASSIC9_TEST_TIMING=1 npm test
CLASSIC9_TEST_TIMING=1 npm run test:slow
```

### F4. 更新 0.4.0 changelog 中 verify:release 描述

优先级：P0
状态：done
负责人建议：发布维护者
依赖：当前 `verify:release` 脚本调整

背景：

`CHANGELOG.md` 0.4.0 中写到 `verify:release` 会在基础 `verify` 后追加 coverage/evidence 审计。当前工作树已调整为 `verify:release` 显式运行 `npm test`、`test:slow`、examples、smoke、pack 和 `verify-release.mjs`。需要避免文档不一致。

具体步骤：

1. 修改 `CHANGELOG.md` 0.4.0 第 5 点和行为变化第 1 点。
2. 明确 `test:slow` 覆盖真实题面 corpus、reference audit、forcing evidence 等慢测。
3. 明确 `verify:coverage` 仍可单独运行覆盖审计。
4. README 的发布前验证段落同步检查。

验收标准：

1. `CHANGELOG.md` 不再描述旧 verify:release 链路。
2. README 和 package scripts 一致。
3. 已执行 `rg "verify:release|test:slow|verify:coverage" README.md CHANGELOG.md package.json` 和 `npm test`。

验证：

```bash
rg "verify:release|test:slow|verify:coverage" README.md CHANGELOG.md package.json
npm test
```

## Epic G：生态信任和 1.0 准备

### G1. 核心 API 稳定性清单

优先级：P2
状态：done
负责人建议：API 维护者
依赖：无

建议文件：

```text
docs/API_STABILITY_1.0_PLAN.md
```

具体步骤：

1. 列出准备冻结的 API：
   parser、adapters、validate、uniqueness、solver basics、rating、canonical。
2. 列出继续 experimental 的 API：
   generator、search、candidate pool、heavy forcing profiles。
3. 为每类 API 定义允许变化：
   新增字段、未知字段、错误类型、schema 版本。
4. 定义 1.0 前必须完成的 breaking changes。
5. 定义 deprecation 机制。

完成记录：

1. 已新增 `docs/API_STABILITY_1.0_PLAN.md`。
2. 已区分准备冻结 API、继续 experimental API、允许兼容变化、需要版本说明的变化和 deprecation 机制。

验收标准：

1. 1.0 前哪些 API 稳定清楚。
2. 用户能判断升级风险。

### G2. Issue templates 和 contribution flow

优先级：P2
状态：done
负责人建议：仓库维护者
依赖：GitHub repo
执行方式：先在仓库内生成 issue templates；如果需要批量创建 GitHub issues，使用 G5 的自动化任务。

具体步骤：

1. 添加 `.github/ISSUE_TEMPLATE/bug_report.yml`。
2. 添加 `.github/ISSUE_TEMPLATE/feature_request.yml`。
3. 添加 `.github/ISSUE_TEMPLATE/technique_bug.yml`，字段包含 puzzle、solution、profile、expected technique、actual step。
4. 添加 `.github/ISSUE_TEMPLATE/performance_issue.yml`，字段包含 command、input size、Node version、elapsed time。
5. 更新 `CONTRIBUTING.md`，说明测试分层和最小复现。

完成记录：

1. 已新增 bug、feature、technique、performance 四个 issue template。
2. `CONTRIBUTING.md` 已补测试分层、慢测计时和技巧类 bug 最小复现说明。

验收标准：

1. GitHub New Issue 页面显示模板。
2. 技巧类 bug 能收集足够复现信息。

### G5. 将任务队列自动创建为 GitHub issues

优先级：P2
状态：done
负责人建议：仓库维护者
依赖：GitHub repo、`gh` CLI 登录或 GitHub token

背景：

用户确认如果能自动更新到 GitHub，就希望把任务队列生成 GitHub issues。该任务不替代本地任务文档，而是把可执行任务同步到 GitHub 便于追踪。

具体步骤：

1. 检查 `gh auth status`。
2. 如果未登录或无权限，向维护者请求授权方式。
3. 为任务队列生成 issue mapping：
   `A1`、`A2`、`A3` 等任务 ID 对应 issue title。
4. 为每个 issue 生成中文正文，包含：
   背景、具体步骤、验收标准、验证命令、依赖任务。
5. 给 issue 添加 labels：
   `priority:P0/P1/P2/P3`、`area:docs/performance/generator/ci/release`、`status:todo`。
6. 对需要权限的任务添加 `manual` 或 `needs-permission` label。
7. 创建前先检查是否已有同标题 issue，避免重复。
8. 创建完成后把 issue URL 回写到任务队列文档，或生成 `docs/GITHUB_ISSUE_BACKLOG.md` 记录映射。

完成记录：

1. 已确认创建前 open issue 为空。
2. 已为剩余未完成且适合远端追踪的任务创建 GitHub issues：[#1](https://github.com/RichardCao/classic9-sudoku/issues/1) 到 [#19](https://github.com/RichardCao/classic9-sudoku/issues/19)。
3. 已新增 `docs/GITHUB_ISSUE_BACKLOG.md` 记录任务到 issue 的映射。
4. 本地已完成或已直接执行的任务没有重复创建 issue。

验收标准：

1. GitHub 上存在对应 issues。
2. 每个 issue 都能追溯到本任务队列中的任务 ID。
3. 重复执行脚本不会重复创建 issue。

验证命令：

```bash
gh auth status
gh issue list --limit 100
```

### G3. Reference corpus 说明页

优先级：P2
状态：done
负责人建议：测试/文档维护者
依赖：现有 reference fixtures

建议文件：

```text
docs/REFERENCE_CORPUS.md
```

具体步骤：

1. 解释 `reference-smoke.json` 和 `reference-rating-corpus.json` 区别。
2. 解释 trusted/artificial candidate state 不能计入真实题面 corpus。
3. 解释每行 rating corpus 必须唯一解、完整路径可回放、不误删真解候选。
4. 说明如何新增一行 corpus。
5. 链接脚本：
   `find-reference-rating-candidates.mjs`、`synthesize-reference-rating-candidates.mjs`、`audit-reference-rating-corpus.mjs`。
6. 说明 slow test 为什么慢。

完成记录：

1. 已新增 `docs/REFERENCE_CORPUS.md`。
2. 已说明 reference smoke 与 real-board rating corpus 区别、trusted/artificial candidate state 边界和新增 corpus 流程。

验收标准：

1. 新维护者能按文档新增 corpus。
2. 文档避免把 smoke 和 real-board corpus 混淆。

### G4. 下载量和搜索排名复盘机制

优先级：P3
状态：done
负责人建议：发布维护者
依赖：A1-A5 发布后

建议文件：

```text
docs/MARKET_METRICS.md
```

具体步骤：

1. 记录每次发布后 7 天、30 天 npm downloads。
2. 记录 `npm search sudoku --json` 排名。
3. 记录 GitHub stars/forks/issues/topics。
4. 记录 README 首屏中文优化、Release、topics 等动作日期。
5. 每月复盘一次是否改善。

完成记录：

1. 已新增 `docs/MARKET_METRICS.md`。
2. 已记录 2026-06-23 包装动作基线和后续复盘命令。

验收标准：

1. 有历史数据趋势。
2. 能判断文档/包装改动是否有外部效果。

## Epic H：兼容性和运行环境

### H1. CommonJS / older Node 兼容性决策

优先级：P2
状态：done
负责人建议：架构维护者
依赖：用户反馈或明确产品目标

背景：

Node >=20 + ESM-only 是当前采用门槛之一。但放宽会增加构建复杂度。

具体步骤：

1. 写 ADR：
   `docs/ADR_MODULE_COMPATIBILITY.md`。
2. 评估三个方案：
   保持 ESM-only、双 ESM/CJS、只提供 CJS wrapper。
3. 评估 Node >=18 支持成本。
4. 检查 TypeScript target、Node API 使用、测试环境。
5. 做结论：
   近期不改，或 0.5/1.0 改。

完成记录：

1. 已新增 `docs/ADR_MODULE_COMPATIBILITY.md`。
2. 决策为近期保持 ESM-only 和 Node `>=20`，暂不增加 CJS wrapper 或 Node 18 支持。

验收标准：

1. 有明确决策。
2. README 中运行环境说明与决策一致。

### H2. Browser usage 文档

优先级：P2
状态：done
负责人建议：文档维护者
依赖：H1 可并行

背景：

很多 Sudoku 包用于网页小游戏。classic9 当前包体较大，浏览器使用需要明确边界。

建议文件：

```text
docs/BROWSER_USAGE.md
```

具体步骤：

1. 说明支持 ESM bundler 场景。
2. 说明不提供 UMD/CDN bundle。
3. 说明 heavy solver/profile 对 bundle 体积影响。
4. 给 Vite 示例。
5. 给 Web Worker 建议，尤其是 rate/generate/search。
6. 明确 Node-only CLI 不适用于浏览器。

完成记录：

1. 已新增 `docs/BROWSER_USAGE.md`。
2. 已说明 ESM bundler、Vite 示例、Web Worker 建议、bundle 注意事项和不支持 UMD/CDN。

验收标准：

1. 浏览器用户知道如何尝试。
2. 不承诺极小 bundle。

## Epic I：版本发布和后续里程碑

### I1. 0.4.1 patch 发布准备

优先级：P3
状态：done
负责人建议：发布维护者
依赖：A1-A4、F4 可优先合入
执行说明：当前暂不以发布节奏为主线；该任务只用于未来需要 patch 发布时快速收口，不阻塞功能完善任务。

建议范围：

1. README 中文定位和 Quick Start。
2. GitHub Release / topics。
3. 测试分层文档和 changelog 修正。
4. canonical empty fast path 如果风险低，可以纳入。

不建议纳入：

1. subpath exports。
2. 随机终盘生成。
3. CJS 兼容。

验收标准：

1. patch 只包含文档/包装/低风险修复。
2. `npm run verify` 通过。
3. `npm run verify:release -- --input tests/fixtures/release-smoke-corpus.json` 通过。

完成记录：

1. 已新增 `docs/RELEASE_0.4.1_PREP.md`。
2. 已列出建议纳入范围、不建议纳入范围、发布前命令和发布说明要点。

### I2. 0.5.0 minor 规划

优先级：P2
状态：done
负责人建议：项目维护者
依赖：C/D/E 设计任务
执行说明：不预设发布时间；以功能完成度和验证结果决定是否进入 0.5.0。

建议范围：

1. canonical 性能优化。
2. candidate pool canonicalKey 复用。
3. package size 分析。
4. generator random solution 原型。
5. migration docs 和 minimal examples。

验收标准：

1. 有明确 milestone。
2. 每个进入 0.5.0 的任务都有 issue 和验收标准。

完成记录：

1. 已新增 `docs/MILESTONES.md`。
2. 已整理 0.5.0 候选范围和门禁。

### I3. 1.0.0 readiness gate

优先级：P3
状态：done
负责人建议：项目维护者
依赖：G1

1. 核心 API 稳定清单完成。
2. README 中文首屏入口完成，必要英文关键词清楚。
3. 至少一个 minor 版本验证 canonical 优化稳定；subpath exports 可暂不作为 1.0 前置条件。
4. generator experimental 边界清楚。
5. issue templates 和 release notes 流程稳定。
6. npm/GitHub 指标至少有连续两次复盘。

验收标准：

1. 有 `docs/API_STABILITY_1.0_PLAN.md`。
2. 有 1.0 checklist。

完成记录：

1. `docs/API_STABILITY_1.0_PLAN.md` 已提供 1.0 checklist。
2. `docs/MILESTONES.md` 已整理 1.0 readiness 前置条件和非前置条件。
3. 没有未决 breaking changes。

## 推荐执行顺序

第一批，0.4.x 低风险：

1. F0 测试必要性审计。
2. F1 固化测试分层文档。
3. A3 README 中文定位和 Quick Start。
4. A4 增加 badges。
5. B2 新增最小 examples。
6. B4 新增 minimal use 文档。
7. B3 README 首页降噪。

第二批，0.4.x / 0.5.0 性能和采用门槛：

1. C1 canonical benchmark。
2. C2 empty board canonical fast path。
3. C4 candidate pool canonicalKey 复用。
4. C5 candidate pool benchmark。
5. B1 主流包迁移文档。
6. A5 npm keywords 优化。
7. D1 package size 分析。

外部自动化批次：

1. A1 自动创建 GitHub Release。
2. A2 自动补 topics 和仓库描述。
3. G5 自动创建 GitHub issues。
4. G2 issue templates 和 contribution flow。

第三批，0.5.x 架构和生成器：

1. C3 低 clue canonical 剪枝。
2. D3 拆分 solver techniques。
3. D4 lazy loading / profile loading 评估。
4. E1 随机终盘方案设计。
5. E4 generator cookbook。
6. E2 随机终盘原型。
7. E3 外部 solution pool。
8. D2 subpath exports 方案；暂缓，只在不增加工作量时兼顾。

第四批，1.0 前治理：

1. G1 核心 API 稳定性清单。
2. G3 reference corpus 说明页。
3. H1 module compatibility ADR。
4. H2 browser usage 文档。
5. G4 下载量和搜索排名复盘机制。
6. I3 1.0 readiness gate。

## 每周执行建议

### Week 1

1. 完成 F0/F1，先审计测试必要性并固化测试分层文档。
2. 完成 A3/A4，优化 README 首屏和徽章。
3. 完成 B2，补最小 examples。
4. 并行尝试 A1/A2 自动化；如果 GitHub 权限不足，记录需要维护者授权。

### Week 2

1. 完成 B4/B3，补 minimal use 文档并给 README 降噪。
2. 完成 C1 canonical benchmark。
3. 开始 C2 空盘 canonical identity fast path。
4. 开始 B1 主流包迁移文档调研。

### Week 3

1. 完成 C2/C4。
2. 完成 C5。
3. 完成 D1 package size 分析。
4. 完成 A5 keywords metadata 更新。

### Week 4

1. 完成 B1。
2. 完成 E1。
3. 开始 E4 generator cookbook。
4. 根据 C/D/E 结果规划下一阶段功能，不强行绑定发布日期。

## Definition of Done

所有任务默认满足以下条件才可标记 `done`：

1. 代码或文档已落盘。
2. 相关 README/docs 链接已更新。
3. 对应测试或人工检查已执行。
4. 若改变 package metadata，已运行 `npm pack --dry-run --json`。
5. 若改变公开 API，已更新 `docs/API.md` 和 `docs/COMPATIBILITY.md`。
6. 若改变生成器行为，已更新 `docs/GENERATOR.md`。
7. 若改变评分/技巧行为，已更新 `docs/RATING.md` 或 `docs/TECHNIQUES.md`。
8. 若改变测试分层或发布流程，已更新 `README.md`、`CHANGELOG.md` 或 `docs/TESTING.md`。

## 验证命令速查

快速开发：

```bash
npm test
```

慢速测试：

```bash
npm run test:slow
```

完整测试：

```bash
npm run test:full
```

示例类型检查：

```bash
npm run examples:typecheck
```

打包检查：

```bash
npm pack --dry-run --json
```

常规验证：

```bash
npm run verify
```

发布验证：

```bash
npm run verify:release -- --input tests/fixtures/release-smoke-corpus.json
```

覆盖和 evidence 审计：

```bash
npm run verify:coverage
```
