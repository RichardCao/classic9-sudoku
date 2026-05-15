# 发布检查

公开发布前建议按顺序执行：

```bash
npm run typecheck
npm test
npm run examples:typecheck
npm run build
npm run smoke:dist
npm run smoke:cli
npm run pack:dry-run
npm run smoke:pack
npm run verify
```

`pack:dry-run` 会使用当前包目录下的 `.npm-cache`，避免用户级 npm cache 权限问题影响发布检查。

干净 clone 中应先执行 `npm install` 或 `npm ci` 安装 devDependencies。当前包声明了 `typescript` 和 `@types/node`，用于保证 `prepack`、CI 和本地发布检查可复现。

## 包内容

`package.json` 通过 `files` 限制 npm 发布内容：

1. `dist/src`
2. `README.md`
3. `CHANGELOG.md`
4. `CONTRIBUTING.md`
5. `docs`
6. `examples`
7. `LICENSE`
8. `SECURITY.md`

不发布：

1. `dist/tests`
2. `dist/tmp`
3. `scripts`
4. `tests`
5. 临时任务队列。
6. 发布准备目录。

## 版本号

当前公开发布版本为 `0.1.0`。

当前发布元信息：

1. npm 包名：`@sudoku-tools/classic9`。
2. GitHub 仓库：`https://github.com/RichardCao/classic9-sudoku`。
3. `package.json` 已包含 `repository`、`bugs`、`homepage`。
4. `package.json` 已包含 `publishConfig.access = public`。
5. README 已包含 npm、MIT license 和 GitHub 链接。

正式发布前还需要确认 npm 账号是否具备发布 `@sudoku-tools/classic9` 的权限，以及 GitHub 远端仓库是否已经创建。

正式发布命令建议为：

```bash
npm publish
```

由于 `publishConfig.access` 已设置为 `public`，不需要额外传 `--access public`。如果使用临时命令覆盖发布配置，应显式保持公开访问。

## 验证重点

`npm run pack:dry-run` 应确认：

1. 包里有 `dist/src/index.js`。
2. 包里有 `dist/src/index.d.ts`。
3. 包里有 CLI 文件 `dist/src/cli/index.js`。
4. 包里有 README、docs、examples 和 LICENSE。
5. 包里没有测试临时输出、发布准备脚本或内部任务文件。

## 打包安装 smoke

`npm run smoke:pack` 会执行真实消费路径：

1. 先构建。
2. `npm pack` 生成 tarball。
3. 在系统临时目录创建一个空项目。
4. 从本地 tarball 安装 `@sudoku-tools/classic9`。
5. 通过包名 `import '@sudoku-tools/classic9'` 验证 ESM 入口。
6. 通过 `npx sudoku version` 验证发布后的 bin。

这个检查用于覆盖 `files` 白名单、`exports`、`types`、`bin` 和 tarball 内容是否一致。

## dist smoke

`npm run smoke:dist` 会先构建，再通过 Node 直接导入 `./dist/src/index.js`，确认发布入口至少能正常加载并导出核心 API。

## CLI smoke

`npm run smoke:cli` 会先构建，再直接运行 `dist/src/cli/index.js` 的核心只读命令：

1. `version`
2. `help`
3. `validate`
4. `schema`
5. `techniques`
6. `solve --format text --locale zh-CN`
7. `generator-analyze`

它用于确认发布后的 CLI 文件可以被 Node 正常执行，且 JSON/text 输出契约没有明显破坏。

## 一键验证

`npm run verify` 会按顺序执行：

1. `typecheck`
2. `test`
3. `examples:typecheck`
4. `smoke:dist`
5. `smoke:cli`
6. `pack:dry-run`
7. `smoke:pack`

这个脚本适合发布前最终确认。

## examples typecheck

`npm run examples:typecheck` 使用 `tsconfig.examples.json`，把 `@sudoku-tools/classic9` 映射到本地 `src/index.ts`。这样示例可以保持发布后的包名导入方式，同时仍能在本地开发时被 TypeScript 校验。
