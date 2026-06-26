# ADR: 模块格式和 Node 版本兼容性

状态：接受当前策略，后续按用户反馈复评

日期：2026-06-23

## 背景

当前包是 ESM-only，`engines.node` 为 `>=20`。这降低了构建复杂度，也让源码、CLI 和测试都保持单一模块模型。但部分 Sudoku 包仍支持 CommonJS 或较旧 Node 版本，可能影响迁移门槛。

## 选项

### 方案 A：保持 ESM-only + Node >=20

优点：

1. 构建和发布链路简单。
2. types、exports、CLI 和源码一致。
3. 不需要维护双包 hazard。
4. 当前 CI 已覆盖 Node 20/22。

缺点：

1. CommonJS 项目需要动态 `import()` 或迁移到 ESM。
2. Node 18 用户不能直接使用。

### 方案 B：双 ESM/CJS 发布

优点：

1. CommonJS 用户迁移成本低。
2. 生态兼容面更广。

缺点：

1. 需要双构建、双 smoke、双 exports。
2. 可能引入 default/named export 差异。
3. CLI、types 和 subpath exports 更复杂。
4. 会增加发布前验证成本。

### 方案 C：只提供 CJS wrapper

优点：

1. 表面上可以支持 `require()`。
2. 工作量小于完整双构建。

缺点：

1. ESM 异步加载会让同步 API wrapper 语义变差。
2. 容易产生半兼容状态。
3. 对浏览器和 bundler 没有明显收益。

## 决策

近期保持：

1. ESM-only。
2. Node `>=20`。
3. 不增加 CommonJS wrapper。
4. 不为 Node 18 做额外 polyfill 或 CI。

理由：当前优先级是功能完善、生成器成熟度、canonical 性能和包体边界。CommonJS / Node 18 兼容会增加构建、测试和文档成本，不适合作为近期主线。

## 复评条件

满足以下任一条件时重新评估：

1. GitHub issue 中出现明确 CommonJS / Node 18 用户需求。
2. 下游项目必须集成到 CommonJS-only 环境。
3. subpath exports 设计完成后，双构建成本显著降低。
4. 包进入 1.0 前，需要明确兼容面承诺。

## README 对应说明

README 应继续说明：

1. Node.js `>=20`。
2. ESM-only，推荐 `import`。
3. 浏览器使用依赖 ESM bundler，不提供 UMD/CDN bundle。
