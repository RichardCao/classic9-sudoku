# ADR: 技巧加载和 lazy loading

状态：暂不引入异步 lazy loading

日期：2026-06-23

## 背景

`dist/src/solver/techniques.js` 是当前最大单文件。把技巧按 profile 或家族 lazy loading 可能降低初始加载成本，但会影响 `hint()`、`nextStep()`、`walkthrough()` 和 `rate()` 这些同步 API。

## 选项

### 方案 A：保持同步加载

优点：

1. 不破坏现有同步 API。
2. Node、CLI、测试和文档都简单。
3. 无异步初始化和缓存状态。

缺点：

1. 根入口加载成本仍偏高。
2. 浏览器只用 validate/parser 时包体体验不理想。

### 方案 B：按 profile lazy loading

优点：

1. stable 用户不加载 galaxy/heavy forcing。
2. 未来浏览器使用体验可能更好。

缺点：

1. `rate()` / `walkthrough()` 可能需要 async 版本。
2. 同步 API 和异步 API 并存会增加文档和测试成本。
3. CLI 和 worker 行为需要额外验证。

### 方案 C：静态拆分 + subpath exports

优点：

1. 不改变同步 API。
2. 用户可以按 subpath import 表达轻量依赖。
3. 与 solver techniques 机械拆分兼容。

缺点：

1. 仍要维护更多 public 入口。
2. 对 bundler 的收益需要实际 benchmark。

## 决策

短期采用方案 A，并为方案 C 做准备：

1. 不引入异步 lazy loading。
2. 不改变 `hint()`、`nextStep()`、`walkthrough()`、`rate()` 的同步语义。
3. 优先拆分 `solver/techniques.ts`，改善维护性。
4. 后续如增加 subpath exports，先做静态入口，不引入 async API。

## 需要的证据

执行方案 C 前应补：

1. Node startup benchmark。
2. Vite/browser bundle 分析。
3. `npm run analyze:package-size` 对比。
4. 每个 subpath 的 pack smoke。
