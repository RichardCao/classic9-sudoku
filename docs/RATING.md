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
  techniqueScores: Record<TechniqueId, number>;
  maxSteps?: number;
  gradeRules?: GradeRule[];
}
```

含义：

1. `techniqueOrder` 决定求解器尝试技巧的顺序。
2. `techniqueScores` 决定每个步骤的分值。
3. `maxSteps` 用于限制 walkthrough 步数。
4. `gradeRules` 是可选分档规则，不属于核心难度真理。

## 内置规则

当前只内置 `classic-stable.v1`。

`classic-stable.v1` 是公开库默认规则，目标是稳定、通用。它不绑定任何产品里的 `easy / normal / hard / expert / epic` 档位，也不承诺这些档位的业务含义。

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
