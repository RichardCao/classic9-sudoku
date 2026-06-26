# Subpath Exports 方案

状态：暂缓执行，先保持边界清晰

## 背景

当前 `package.json` 只暴露根入口：

```json
{
  "exports": {
    ".": {
      "types": "./dist/src/index.d.ts",
      "default": "./dist/src/index.js"
    }
  }
}
```

这对兼容性最简单，但用户如果只需要 parser/validate/canonical，也无法在 Node import 层表达更细依赖。浏览器 bundler 是否能 tree-shake，取决于构建配置。

## 暂缓原因

1. 当前主线是功能完善、生成器成熟度和 canonical 性能。
2. subpath exports 一旦发布，会形成新的兼容承诺。
3. solver 技巧文件尚未拆分，提前暴露 subpath 收益有限。
4. CommonJS / Node 18 兼容性暂不推进，见 [ADR_MODULE_COMPATIBILITY.md](./ADR_MODULE_COMPATIBILITY.md)。

## 候选 subpaths

| subpath | 目标 |
| --- | --- |
| `@sudoku-tools/classic9/core` | constants、types、grid、bitset |
| `@sudoku-tools/classic9/parser` | parse/serialize 和 adapters |
| `@sudoku-tools/classic9/validate` | validate、normalizeState |
| `@sudoku-tools/classic9/solver` | nextStep、walkthrough、verifyStep |
| `@sudoku-tools/classic9/rating` | rate、policy、summary |
| `@sudoku-tools/classic9/canonical` | canonical transform 系列 API |
| `@sudoku-tools/classic9/generator` | generate/search/candidate pool |
| `@sudoku-tools/classic9/schema` | getJsonSchemas |

## 执行前置

1. 拆分 `src/solver/techniques.ts`，降低单文件耦合。
2. 每个 subpath 有目录级 public `index.ts` 或明确 public barrel。
3. 增加 pack smoke，验证每个 subpath 的 ESM import 和 types。
4. README 和 API 文档明确根入口仍是默认推荐入口。

## 验证草案

```bash
npm run build
node --input-type=module -e "import('./dist/src/canonical/index.js').then(m => console.log(typeof m.canonicalizeBoard))"
npm run smoke:pack
npm pack --dry-run --json
```

## 决策

短期不发布 subpath exports。其他任务实现时应避免深层互相依赖继续扩散，为后续拆分保留空间。
