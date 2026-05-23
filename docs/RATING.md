# 评分规则

评分不是题目的客观属性，而是某套求解策略和技巧权重下的结果。

因此所有评分结果都必须包含：

1. `ratingPolicyId`
2. `ratingPolicyVersion`

调用方存储题库时，也应该同时保存这两个字段。

## RatingPolicy

评分规则核心字段：

```ts
interface RatingPolicy {
  id: string;
  version: string;
  techniqueOrder: TechniqueId[];
  fallbackTechniques?: TechniqueId[];
  techniqueScores: Record<TechniqueId, number>;
  maxSteps?: number;
  gradeRules?: GradeRule[];
}
```

含义：

1. `techniqueOrder` 决定求解器尝试技巧的顺序。内置 stable 规则使用显式的人类解题顺序，整体从基础技巧走向复杂技巧；`defaultScore` 是计分权重，不直接决定默认扫描顺序。
2. `fallbackTechniques` 是可选 fallback 管线，只在 primary 技巧全部无命中时尝试。
3. `techniqueScores` 决定每个步骤的分值，并且必须覆盖 `techniqueOrder` 和 `fallbackTechniques` 中所有已启用技巧。
4. `maxSteps` 用于限制 walkthrough 步数。
5. `gradeRules` 是可选分档规则，不属于核心难度真理。

自定义 `RatingPolicy` 会被严格校验：

1. `techniqueOrder` 必须是非空已知技巧列表。
2. `fallbackTechniques` 如果存在，必须全部是已知技巧。
3. `techniqueScores` 的 key 必须是已知技巧，value 必须是有限数字。
4. `techniqueScores` 必须覆盖所有已启用技巧。
5. `maxSteps` 如果存在，必须是正整数。
6. `gradeRules[].allowedTechniques` 如果存在，必须全部是已知技巧。
7. `gradeRules[].minScore` 和 `maxScore` 如果同时存在，必须满足 `minScore <= maxScore`。

可以先调用 `validateRatingPolicy(policy)` 获取结构化错误；`undefined`、`null`、数组和其他非 object 输入都会被视为非法 policy，不会被当成默认规则。`rate(input, policy)` 和 `buildSolveOptionsFromRatingPolicy(policy)` 会在 policy 非法时直接抛错。`getRatingPolicy(id)` 只接受 `classic-stable` 和 `classic-extended`，未知 id 会抛错，不会静默回退到默认规则。

如果调用方使用 `getJsonSchemas().ratingPolicy` 或生成请求里的 `ratingPolicy` schema 做预校验，还需要再调用 `validateRatingPolicy(policy)`。JSON Schema 负责字段类型、未知技巧和未知字段等静态结构；`techniqueScores` 是否覆盖所有已启用技巧、`gradeRules[].minScore <= maxScore` 这类动态规则以运行时校验为准。

## 内置规则

当前内置两套规则：

1. `classic-stable.v1`
2. `classic-extended.v1`

`classic-stable.v1` 是公开库默认规则，目标是稳定、通用。它不绑定任何产品里的 `easy / normal / hard / expert / epic` 档位，也不承诺这些档位的业务含义。

`classic-extended.v1` 面向“在 stable 之上再多给一层求解能力”的场景。当前它会先完整运行 stable 技巧；只有当前状态 primary 技巧全部无命中时，才把 `bowmans-bingo` 作为 fallback safety net 尝试，不会把全部 experimental forcing 技巧直接并入默认管线。

如果调用方需要自己的题库分档，应定义独立的 `RatingPolicy`，并在题库记录中保存对应的 `id/version`。

## 分数解释

题目总分来自解题步骤分数累加。

这意味着：

1. 高阶技巧出现一次，不一定总分很高。
2. 基础技巧步骤很多，也可能累积出较高分。
3. 修改技巧顺序可能改变步骤序列，从而改变分数。
4. 修改技巧权重会直接改变总分。

## grade

`grade` 是评分规则下的标签，不是核心标准。

公开库不会固定 `easy / normal / hard / expert / epic` 的含义。调用方如果需要这些档位，应该在自己的 preset 或业务层定义。

## 生成器关系

生成器的 `constraints.score` 必须按当前 `ratingPolicy` 解释。

如果同时指定高分范围和很窄的技巧范围，生成器可能很难命中。可以先运行：

```bash
node dist/src/cli/index.js generator-analyze request.json
```

查看请求是否明显不合理。

## 兼容要求

评分规则变更必须升级 `version`。不能在同一个 `id/version` 下静默改变技巧分值、技巧顺序或分档规则。

如果调用方只是想获得内置规则副本，可以调用：

```ts
import { getRatingPolicy } from '@sudoku-tools/classic9';

const stable = getRatingPolicy('classic-stable');
const extended = getRatingPolicy('classic-extended');
```
