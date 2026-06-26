# 贡献指南

感谢参与标准 9x9 数独工具库的改进。

## 基本原则

1. 核心库只支持标准 9x9 数独。
2. 不引入 UI、业务应用框架或业务难度规则。
3. 新增公开字段要有文档和测试。
4. 修改评分规则必须升级规则版本。
5. 修改 canonical 算法必须升级 canonical version。

## 本地检查

```bash
npm run typecheck
npm test
npm run test:slow
npm run examples:typecheck
npm run smoke:cli
npm run pack:dry-run
```

开发中优先运行 `npm test` 获取快速反馈。涉及 reference corpus、候选池、forcing evidence、生成器慢路径或 CLI 子进程审计时，还需要运行 `npm run test:slow`。完整测试分层见 [docs/TESTING.md](./docs/TESTING.md)，慢测必要性说明见 [docs/TEST_AUDIT.md](./docs/TEST_AUDIT.md)。

如果需要定位新增慢点，可以运行：

```bash
CLASSIC9_TEST_TIMING=1 npm test
CLASSIC9_TEST_TIMING=1 npm run test:slow
```

## 新增技巧的要求

新增 stable 技巧必须满足：

1. `TECHNIQUE_DEFINITIONS` 中有技巧定义。
2. `nextStep` 可以用 `allowedTechniques` 单独命中。
3. `SolveStep.actions` 可回放。
4. `SolveStep.evidence` 有结构化证据。
5. `formatStep` 有中文展示。
6. 有 focused test。
7. 文档更新 `TECHNIQUES.md`。

高级技巧实现和维护要求见：

- [docs/TECHNIQUES.md](./docs/TECHNIQUES.md)

技巧类 bug 的最小复现应尽量包含：

1. 81 位 puzzle。
2. 已知 solution，如果有。
3. 使用的 profile 或 `allowedTechniques` / `preferredTechniques`。
4. 期望命中的技巧和实际返回的 `SolveStep`。
5. 如果是中途候选态，说明来源，不要把 trusted/artificial candidate state 直接计入真实题面 corpus。

## 生成器变更

生成器变更需要说明：

1. 请求字段语义。
2. failure diagnostics。
3. 对 reproducibility 的影响。
4. seed 行为是否改变。
5. 是否影响 `search` 和 manifest 续跑。

## 文档语言

当前项目文档和注释优先使用中文。TypeScript API 名称保持英文。
