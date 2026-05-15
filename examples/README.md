# 示例

本目录提供公开库第一版的最小使用示例。

## API 示例

`basic-api.ts` 展示：

1. 解析题面。
2. 校验题目。
3. 求解 walkthrough。
4. 评分。
5. canonical key。

`generate-and-select.ts` 展示：

1. 按线索数生成候选题。
2. 分析候选池统计。
3. 候选池去重。
4. 按分数桶选择题目。

`forcing-branches.ts` 展示：

1. 通过 `allowedTechniques` 显式启用 experimental forcing 技巧。
2. 读取 `SolveStep.evidence.branches`。
3. 展示分支假设、矛盾定位和分支动作摘要数量。

这些示例面向发布后的包名：

```ts
import { parsePuzzle } from '@sudoku-tools/classic9';
```

如果在源码目录内直接运行，需要先构建并把导入路径改成本地 `../dist/src/index.js`，或者用包管理器把当前目录链接为依赖。

## CLI 示例

`cli.md` 展示常用命令，包括校验、求解、评分、生成、搜索、续跑、候选池统计和去重。
