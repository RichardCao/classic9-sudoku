# 发布后指标复盘

本文用于记录文档、Release、topics、keywords 等包装动作是否带来外部可见改善。它不是性能 benchmark，也不作为 npm 搜索排名承诺。

## 记录节奏

每次公开发布后记录：

1. 发布当天。
2. 发布后 7 天。
3. 发布后 30 天。
4. 每月一次轻量复盘。

## 需要记录的数据

| 指标 | 命令或来源 |
| --- | --- |
| npm version | `npm view @sudoku-tools/classic9 version` |
| npm downloads | `npm view @sudoku-tools/classic9 time --json` 和 npm package 页面 |
| npm search 排名 | `npm search sudoku --json --searchlimit=50` |
| GitHub stars/forks/issues | `gh repo view RichardCao/classic9-sudoku --json stargazerCount,forkCount,issues` |
| GitHub topics | `gh repo view RichardCao/classic9-sudoku --json repositoryTopics` |
| Release 是否存在 | `gh release view v0.4.0` |
| README 首屏动作 | 手动记录日期和改动摘要 |

## 当前基线

记录日期：2026-06-23

已完成包装动作：

1. 创建 GitHub Release `v0.4.0`。
2. 增加 GitHub topics。
3. 更新仓库 description 和 homepage。
4. README 首屏增加中文定位、Quick Start、徽章和示例入口。
5. `package.json` keywords 增加 rating、hints、cli、canonical、logic puzzle 等搜索词。
6. 新增主流包迁移文档和 minimal use 文档。

后续需要在下一次 npm 发布后记录：

```bash
npm search sudoku --json --searchlimit=50
npm view @sudoku-tools/classic9 version description keywords --json
gh repo view RichardCao/classic9-sudoku --json description,homepageUrl,repositoryTopics,stargazerCount,forkCount
```

## 复盘问题

1. `npm search sudoku` 中是否出现本包。
2. README 首屏是否降低首次使用门槛。
3. GitHub topics 是否覆盖主要搜索词。
4. 迁移文档是否减少“为什么不用轻量包”的解释成本。
5. 包体是否因文档纳入 npm 包而继续超过 1MB unpacked。

## 记录模板

```md
## YYYY-MM-DD

版本：

已完成动作：

npm search 位置：

npm downloads：

GitHub stars/forks/issues：

结论：

下一步：
```
