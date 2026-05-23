import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cacheDir = join(root, '.npm-cache');
const tempDir = mkdtempSync(join(tmpdir(), 'classic9-pack-smoke-'));
let tarballPath;

try {
  const packOutput = execFileSync(npmCommand(), ['pack', '--json', '--cache', cacheDir], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const packed = JSON.parse(packOutput)[0];
  if (!packed?.filename) {
    throw new Error('npm pack 没有返回 tarball 文件名。');
  }
  tarballPath = join(root, packed.filename);
  const files = new Set(packed.files.map((file) => file.path));
  for (const required of ['dist/src/index.js', 'dist/src/index.d.ts', 'dist/src/cli/index.js', 'README.md', 'LICENSE']) {
    if (!files.has(required)) {
      throw new Error(`发布包缺少必要文件：${required}`);
    }
  }
  for (const forbidden of ['src/', 'tests/', 'scripts/', 'dist/tests/', 'dist/tmp/', '.npm-cache/']) {
    if ([...files].some((file) => file === forbidden.slice(0, -1) || file.startsWith(forbidden))) {
      throw new Error(`发布包包含禁止内容：${forbidden}`);
    }
  }

  execFileSync(npmCommand(), ['init', '-y'], {
    cwd: tempDir,
    stdio: 'ignore',
  });
  execFileSync(npmCommand(), ['install', tarballPath, '--cache', cacheDir, '--ignore-scripts'], {
    cwd: tempDir,
    stdio: 'inherit',
  });
  execFileSync(process.execPath, ['--input-type=module', '-e', [
    "import { parsePuzzle, getPackageInfo } from '@sudoku-tools/classic9';",
    "if (typeof parsePuzzle !== 'function') throw new Error('parsePuzzle missing');",
    "if (getPackageInfo().name !== '@sudoku-tools/classic9') throw new Error('package info mismatch');",
  ].join(' ')], {
    cwd: tempDir,
    stdio: 'inherit',
  });
  const binPath = join(tempDir, 'node_modules', '.bin', process.platform === 'win32' ? 'sudoku.cmd' : 'sudoku');
  const versionOutput = execFileSync(binCommand(binPath), binArgs(binPath, ['version']), {
    cwd: tempDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();
  if (!versionOutput.includes('@sudoku-tools/classic9')) {
    throw new Error(`CLI version 输出异常：${versionOutput}`);
  }

  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (!versionOutput.includes(packageJson.version)) {
    throw new Error(`CLI version 未包含当前版本：${packageJson.version}`);
  }

  console.log('packed package smoke passed');
} finally {
  if (tarballPath) {
    rmSync(tarballPath, { force: true });
  }
  rmSync(tempDir, { recursive: true, force: true });
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function binCommand(binPath) {
  return process.platform === 'win32' ? 'cmd.exe' : binPath;
}

function binArgs(binPath, args) {
  return process.platform === 'win32' ? ['/d', '/s', '/c', `"${binPath}" ${args.join(' ')}`] : args;
}
