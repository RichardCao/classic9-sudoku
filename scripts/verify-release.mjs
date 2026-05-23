#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const inputPath = takeOption(args, '--input');
if (!inputPath) {
  fail('verify:release 需要显式 --input 指定 release audit 题集路径。');
}

const auditArgs = ['run', 'audit:stable', '--', '--input', inputPath, ...withoutOption(args, '--input')];
const output = execFileSync(npmCommand(), auditArgs, {
  cwd: resolve(fileURLToPath(new URL('..', import.meta.url))),
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});
process.stdout.write(output);

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
