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
npm run examples:typecheck
npm run smoke:cli
npm run pack:dry-run
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

高级技巧迁移路线见：

- [docs/ADVANCED_TECHNIQUE_MIGRATION.md](./docs/ADVANCED_TECHNIQUE_MIGRATION.md)

## 生成器变更

生成器变更需要说明：

1. 请求字段语义。
2. failure diagnostics。
3. 对 reproducibility 的影响。
4. seed 行为是否改变。
5. 是否影响 `search` 和 manifest 续跑。

## 文档语言

当前项目文档和注释优先使用中文。TypeScript API 名称保持英文。
