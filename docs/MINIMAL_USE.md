# 最小使用指南

本指南面向只想使用 `@sudoku-tools/classic9` 某一小部分能力的调用方。当前包仍以根入口导出为主：

```ts
import { parsePuzzle, validate } from '@sudoku-tools/classic9';
```

是否能被打包器 tree-shaking 取决于调用方构建工具。Node 直接运行时仍会按 ESM 模块加载依赖图；如果后续需要更细粒度入口，可再评估 subpath exports。

## 只做解析和校验

适用场景：用户输入题面、导入题库前检查格式和冲突。

```ts
import { parsePuzzle, validate } from '@sudoku-tools/classic9';

const board = parsePuzzle('530070000600195000098000060800060003400803001700020006060000280000419005000080079');
const result = validate(board);

console.log(result.legal);
console.log(result.contradictions);
```

注意事项：

1. `parsePuzzle()` 会在格式非法时抛错。
2. 如果需要把非法输入转成结构化结果，可以直接用 `validate(input)`。
3. `0`、`.`、`-` 都可以表示空格。

## 只做唯一解检查

适用场景：生成题目后确认唯一解，或导入题库前检查题目质量。

```ts
import { checkUniqueness } from '@sudoku-tools/classic9';

const result = checkUniqueness(puzzle, { maxElapsedMs: 1000 });

console.log(result.status);
console.log(result.uniqueSolution);
console.log(result.searchDiagnostics);
```

注意事项：

1. `status` 可能是 `no-solution`、`unique`、`multiple`、`invalid`、`aborted`。
2. 传入 `maxElapsedMs` 后，如果预算耗尽，应把结果视为“预算内未知”，不要当成确定多解或无解。
3. `solutionCountLowerBound` 是已找到解数下界，最多用于区分是否至少找到多个解。

## 只做一个提示

适用场景：前端提示按钮、教学 UI、一步一步引导。

```ts
import { hint } from '@sudoku-tools/classic9';

const result = hint(puzzle, {
  format: { locale: 'zh-CN', style: 'teaching' },
});

if (result.found) {
  console.log(result.technique);
  console.log(result.text);
  console.log(result.actions);
} else {
  console.log(result.stuckReason);
}
```

注意事项：

1. `hint()` 不会修改输入状态。
2. 默认只使用 stable 技巧。
3. 需要高级 experimental 技巧时，显式传入 `allowedTechniques` 或使用内置 profile 构造求解选项。

## 只做完整求解

适用场景：判断当前策略能否解出题、展示完整步骤、离线分析。

```ts
import { summarizeAnalysis, walkthrough } from '@sudoku-tools/classic9';

const analysis = walkthrough(puzzle, { maxSteps: 200 });
const summary = summarizeAnalysis(analysis);

console.log(summary.solved);
console.log(summary.stepCount);
console.log(summary.hardestTechnique);
```

注意事项：

1. 默认 walkthrough 使用 stable 技巧。
2. `maxSteps` 可以避免异常输入导致过长路径。
3. 如果 `solved` 为 false，应检查 `stuckReason`。

## 只做评分

适用场景：题库分档、排序、筛选。

```ts
import { getRatingPolicy, rate, summarizeRating } from '@sudoku-tools/classic9';

const rating = rate(puzzle, getRatingPolicy('classic-stable'));
const summary = summarizeRating(rating);

console.log(summary.score);
console.log(summary.grade);
console.log(summary.ratingPolicyId);
console.log(summary.ratingPolicyVersion);
```

注意事项：

1. 分数不是题目的客观属性，而是某套策略下的结果。
2. 题库入库时建议保存 `ratingPolicyId` 和 `ratingPolicyVersion`。
3. `classic-galaxy` 覆盖更广，但可能更慢；不建议默认用于在线批量评分。

## 只生成一道题

适用场景：在线生成一题或后台候选题生成。

```ts
import { generateOne } from '@sudoku-tools/classic9';

const result = generateOne({
  seed: 1,
  canonicalize: true,
  minimality: 'none',
  constraints: { clues: { target: 40 } },
  budget: { maxAttempts: 1, maxElapsedMs: 3000 },
});

if (result.status === 'success') {
  console.log(result.puzzle.puzzle);
  console.log(result.puzzle.solution);
} else {
  console.log(result.status);
  console.log(result.bestCandidate);
}
```

注意事项：

1. 只有 `status === 'success'` 的 `puzzle` 才保证满足请求约束。
2. `bestCandidate` 只用于诊断和调参，不应直接入库。
3. 当前生成器偏可复现和轻量，终盘多样性仍在后续版本继续增强。

## 只做 canonical 去重

适用场景：题库导入、候选池去重、等价题面合并。

```ts
import { canonicalizeBoard, parsePuzzle } from '@sudoku-tools/classic9';

const board = parsePuzzle(puzzle);
const canonical = canonicalizeBoard(board);

console.log(canonical.key);
```

注意事项：

1. canonical key 用于等价题面去重。
2. 当前低 clue / 空盘 canonical 是性能敏感路径，后续会继续优化。
3. 长期入库时建议同时保存 canonical algorithm 和 version。

## 只用 CLI

适用场景：脚本、CI、离线批处理。

```bash
sudoku validate "<puzzle>"
sudoku solve "<puzzle>" --format text --locale zh-CN
sudoku rate "<puzzle>" --profile stable
sudoku generate '{"seed":1,"constraints":{"clues":{"target":40}},"budget":{"maxAttempts":1,"maxElapsedMs":3000}}'
```

注意事项：

1. CLI 随 npm 包提供，命令名为 `sudoku`。
2. 批量任务建议使用 `batch-solve`、`batch-rate`、`search`、`select`。
3. 重型审计脚本属于源码仓库工具，不随 npm 包发布。
