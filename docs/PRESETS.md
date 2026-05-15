# 预设规则

公开库核心只处理标准 9x9 数独能力，不把任何具体产品的关卡系统写死为核心规则。

## preset 的定位

preset 是一组可选配置，适合表达某个产品或题库项目的规则，例如：

1. 评分规则。
2. 常用生成参数。
3. 分数分档。
4. 题库筛选策略。
5. 默认 budget。
6. 技巧白名单或黑名单。

这些配置可以被调用方采用，也可以完全不用。

## 不应写进核心的内容

以下内容不应成为核心库固定逻辑：

1. 某个产品的难度档位。
2. 某个题库的关卡编号。
3. 某个业务场景的生成时间预算。
4. 某类题库的特殊保留规则。
5. 某个补题任务的分桶比例。

原因是公开库应该能服务不同题库和不同产品。

## 当前状态

当前只内置 `classic-stable.v1` 作为默认通用评分策略。

后续如果增加 `src/presets`，建议只导出普通对象，不让核心模块反向依赖 preset。preset 一旦公开并被题库使用，就需要版本化。

## 调用方自定义

调用方可以传入自己的 `RatingPolicy`：

```ts
import { rate } from '@sudoku-tools/classic9';

const result = rate(puzzle, myPolicy);
```

生成器也可以使用同一套 policy：

```ts
import { generateOne } from '@sudoku-tools/classic9';

const result = generateOne({
  ratingPolicy: myPolicy,
  constraints: {
    score: { min: 1200, max: 1600 }
  }
});
```

## 版本规则

preset 一旦公开并被题库使用，就需要版本化。

如果修改以下内容，必须升级版本：

1. 技巧顺序。
2. 技巧分值。
3. 分档边界。
4. 默认生成参数。
5. 题库筛选策略。
