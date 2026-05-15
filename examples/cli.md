# CLI 示例

安装包后推荐直接使用 `sudoku` 命令。没有安装时可以使用 `npx -p @sudoku-tools/classic9 sudoku ...`。

本地源码开发时，先执行：

```bash
npm run build
```

然后也可以把下列 `sudoku` 替换为 `node dist/src/cli/index.js`。

## 校验

查看版本：

```bash
sudoku version
```

```bash
sudoku validate "530070000600195000098000060800060003400803001700020006060000280000419005000080079"
```

## 求解

```bash
sudoku solve "534678912672195348198342567859761423426853791713924856961537284287419635345286170" --format text --locale zh-CN
```

## 评分

```bash
sudoku rate "534678912672195348198342567859761423426853791713924856961537284287419635345286170"
```

## 生成一道题

```bash
sudoku generate '{"seed":1,"canonicalize":true,"minimality":"none","constraints":{"clues":{"target":40,"min":35,"max":45}},"budget":{"maxAttempts":1,"maxElapsedMs":3000}}'
```

## 批量搜索

```bash
sudoku search '{"seed":1,"maxResults":5,"canonicalize":true,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":10,"maxElapsedMs":5000}}' --summary-only --write-candidates ./dist/tmp/candidates.json --write-manifest ./dist/tmp/search-manifest.json
```

## 续跑

```bash
sudoku search '{"seed":1,"maxResults":5,"canonicalize":true,"minimality":"none","constraints":{"clues":{"target":40}},"budget":{"maxAttempts":10,"maxElapsedMs":5000}}' --summary-only --resume-manifest ./dist/tmp/search-manifest.json --write-candidates ./dist/tmp/candidates.json --append-candidates
```

## 候选池统计和去重

```bash
sudoku candidate-stats ./dist/tmp/candidates.json
sudoku dedupe-candidates ./dist/tmp/candidates.json --out ./dist/tmp/candidates-deduped.json
```

## 筛选候选池

```bash
sudoku select ./dist/tmp/candidates-deduped.json ./selection-plan.json --write-selected ./dist/tmp/selected.json --write-rejected ./dist/tmp/rejected.json
```
