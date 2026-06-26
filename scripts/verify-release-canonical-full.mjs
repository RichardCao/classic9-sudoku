#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const inputPath = takeOption(args, '--input');
if (!inputPath) {
  fail('verify:release:canonical-full 需要显式 --input 指定 release audit 题集路径。');
}

const cwd = resolve(fileURLToPath(new URL('..', import.meta.url)));
const passthroughArgs = withoutOption(args, '--input');

execFileSync(npmCommand(), ['run', 'verify:release', '--', '--input', inputPath, ...passthroughArgs], {
  cwd,
  stdio: 'inherit',
});

execFileSync(npmCommand(), ['run', 'audit:canonical-equivalence:full'], {
  cwd,
  stdio: 'inherit',
});

function takeOption(args, name) {
  const index = args.indexOf(name);
  if (index < 0) {
    return null;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    fail(`${name} 缺少参数值。`);
  }
  return value;
}

function withoutOption(args, name) {
  const output = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name) {
      index += 1;
      continue;
    }
    output.push(args[index]);
  }
  return output;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}
