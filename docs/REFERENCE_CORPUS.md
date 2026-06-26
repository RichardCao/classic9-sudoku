# Reference Corpus 说明

reference corpus 用于保证技巧实现、评分路径和 evidence 输出不会在重构中静默退化。它不是普通示例题库，也不是营销素材。

## 两类 fixture

| 文件 | 类型 | 用途 |
| --- | --- | --- |
| `tests/fixtures/reference-techniques/reference-smoke.json` | smoke / trusted candidate state | 固定技巧 finder 的边界、证据结构和 no-hit guard |
| `tests/fixtures/reference-techniques/reference-rating-corpus.json` | real-board rating corpus | 固定真实题面在指定 profile 下的完整评分路径 |

## reference smoke

`reference-smoke.json` 可以包含：

1. 人工构造候选态。
2. trusted candidate state。
3. no-hit guard。
4. 镜像、转置、subtype 和 evidence 引用检查。

它的作用是让单个 finder 的边界更清楚。它不要求题面来自真实发布题库，也不要求完整评分路径自然走到该技巧。

重要限制：

1. trusted / artificial candidate state 不能计入真实题面 rating corpus。
2. smoke 命中只能说明 finder 在该状态下行为正确，不等于普通玩家路径会自然走到该技巧。
3. 如果 smoke 来自外部网页或论坛，应保留 provenance，但不要直接复制第三方源码。

## reference rating corpus

`reference-rating-corpus.json` 的每一行必须满足：

1. 输入是普通 81 格题面，不是中途候选态。
2. 题面有唯一解。
3. 在指定 rating policy 下可以完整求解或命中预期路径。
4. 每一步都能通过 `verifyStep(..., { mode: "evidence" })`。
5. place / eliminate 动作不能违背已知 solution。
6. 如果使用 `targetFirstTechniques` 辅助发现，加入 corpus 前仍应说明正常 profile 的结果。

## 新增 corpus 行流程

1. 准备候选题面，记录来源和 license/provenance。
2. 用 `checkUniqueness()` 或 audit 脚本确认唯一解。
3. 使用目标技巧优先搜索候选：

```bash
npm run find:reference-candidates -- --target x-wing --target-first --compare-normal-profile --minimize-hit --input candidates.txt
```

4. 如现有题面池没有命中，可用合成脚本辅助搜索：

```bash
npm run synthesize:reference-candidates -- --target x-wing --target-first --minimize-hit --compare-normal-profile
```

5. 将候选行加入 `reference-rating-corpus.json`。
6. 运行：

```bash
npm run audit:reference
npm run audit:coverage
```

7. 如果涉及 forcing / BUG / graph evidence，再运行：

```bash
npm run verify:coverage
```

## 为什么 slow test 慢

slow profile 中的 reference 测试会做几类昂贵工作：

1. 遍历真实题面 corpus。
2. 每一步求解后验证 evidence 引用。
3. 对照已知 solution 检查删候选安全性。
4. 启动 audit 脚本子进程，验证 CLI/script 入口没有偏离库内逻辑。
5. 覆盖 forcing evidence、forcing smoke 和 BUG graph evidence。

因此 reference audit 不应放进普通 fast `npm test`。日常开发先运行 `npm test`，修改 reference、forcing、BUG 或候选搜索脚本后再运行 `npm run test:slow`。

## 相关脚本

1. `scripts/audit-reference-techniques.mjs`
2. `scripts/audit-reference-rating-corpus.mjs`
3. `scripts/audit-reference-coverage.mjs`
4. `scripts/find-reference-rating-candidates.mjs`
5. `scripts/synthesize-reference-rating-candidates.mjs`
6. `scripts/audit-forcing-branch-evidence.mjs`
7. `scripts/audit-forcing-smoke-evidence.mjs`
8. `scripts/audit-bug-graph-evidence.mjs`
