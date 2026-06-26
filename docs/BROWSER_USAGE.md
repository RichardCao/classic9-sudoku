# 浏览器使用说明

`@sudoku-tools/classic9` 可以在支持 ESM 的现代前端构建工具中尝试使用，但当前不是极小 bundle 取向，也不提供 UMD/CDN 版本。

## 支持边界

1. 推荐通过 Vite、Rollup、Webpack、esbuild 等 ESM bundler 使用。
2. 不提供 `<script>` 直接加载的 UMD bundle。
3. CLI 只适用于 Node.js，不适用于浏览器。
4. `rate()`、`generateOne()`、`search()` 和 galaxy/heavy forcing profile 可能较重，浏览器主线程慎用。
5. tree-shaking 取决于 bundler；当前包还没有 subpath exports。

## Vite 示例

```ts
import {
  hint,
  parsePuzzle,
  rate,
  summarizeRating,
  validate,
} from '@sudoku-tools/classic9';

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const board = parsePuzzle(puzzle);

console.log(validate(board).legal);
console.log(hint(board, { format: { locale: 'zh-CN' } }).text);
console.log(summarizeRating(rate(board)));
```

## Web Worker 建议

以下场景建议放入 Web Worker：

1. 批量 `rate()`。
2. `generateOne()` 预算超过几百毫秒。
3. `search()` 候选池生成。
4. 使用 `classic-galaxy` 或显式启用重型 forcing 技巧。
5. canonical 处理大量低 clue 题面。

Worker 消息建议只传可序列化数据：

```ts
// main thread
worker.postMessage({
  type: 'rate',
  puzzle,
});
```

```ts
// worker
import { parsePuzzle, rate, summarizeRating } from '@sudoku-tools/classic9';

self.onmessage = (event) => {
  if (event.data?.type !== 'rate') {
    return;
  }
  const board = parsePuzzle(event.data.puzzle);
  self.postMessage({
    type: 'rating',
    rating: summarizeRating(rate(board)),
  });
};
```

## Bundle 注意事项

当前包体主要来自 solver 技巧实现、schema、generator 和 docs。浏览器项目如果只需要 parse/validate/hint，仍会从根入口导入完整公共 API。未来可以通过 subpath exports 或按 profile 拆分降低采用成本，但当前不要承诺极小 bundle。

## 不建议的用法

1. 在输入框每次 keypress 同步运行 `rate()`。
2. 在主线程循环跑 `search()`。
3. 默认启用 galaxy profile 处理大量题面。
4. 把 `bestCandidate` 当成成功生成结果直接入库。
5. 依赖当前内部文件路径做深层 import。
