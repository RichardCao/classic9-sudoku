# CI 建议

当前公开库不依赖外部服务，最小 CI 只需要运行 TypeScript 构建和测试。

## 推荐命令

```bash
npm run typecheck
npm test
```

如果仓库根目录就是公开库目录，则可以改成：

```bash
npm run typecheck
npm test
```

## GitHub Actions 示例

```yaml
name: ci

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm run typecheck
      - run: npm test
```

## import guard

测试中会检查 `src` 下的公开库代码没有引用外部应用路径，例如：

1. `assets/`
2. `cc`
3. 已知的应用工程绝对路径

这个检查用于保证公开库可以独立发布。
