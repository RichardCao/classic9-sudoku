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

当前内置：

1. `classic-stable.v1`：默认通用评分策略，只使用 stable 技巧。
2. `classic-extended.v1`：显式增强策略，先运行 stable 技巧；只有当前状态 primary 技巧全部无命中时，才把 `bowmans-bingo` 作为 fallback safety net 尝试。
3. `classic-galaxy.v1`：本包自己的全技巧策略，启用所有已实现技巧，并把重型 forcing / 试探类技巧放入 fallback 管线。

后续如果增加 `src/presets`，建议只导出普通对象，不让核心模块反向依赖 preset。preset 一旦公开并被题库使用，就需要版本化。

`classic-extended.v1` 的目的不是把 experimental forcing 全部升为 stable，而是给调用方一个可复现、版本化的增强入口。当前实测如果一次性启用全部 forcing 技巧，部分高难题耗时会显著上升；因此 extended 只选择当前收益明确的一条兜底技巧。

`classic-galaxy.v1` 的目的不是替换默认评分，而是给调用方一个可复现、版本化的全技巧入口。它不复刻外部求解器排序，也不承诺和任何外部评分体系逐步同构。

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
