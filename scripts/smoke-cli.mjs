import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cliPath = join(process.cwd(), 'dist', 'src', 'cli', 'index.js');
const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

function runJson(args) {
  const output = execFileSync('node', [cliPath, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

function runText(args) {
  return execFileSync('node', [cliPath, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const almostSolved = '534678912672195348198342567859761423426853791713924856961537284287419635345286170';

const version = runJson(['version']);
assert.equal(version.name, '@sudoku-tools/classic9');
assert.equal(version.version, packageJson.version);

const help = runJson(['help']);
assert.equal(help.package, '@sudoku-tools/classic9');
assert.equal(help.version, packageJson.version);
assert.ok(help.commands.some((command) => command.command === 'validate <puzzle>'));

const validation = runJson(['validate', puzzle]);
assert.equal(validation.legal, true);

const schemaList = runJson(['schema']);
assert.ok(schemaList.includes('candidatePoolStats'));
assert.ok(schemaList.includes('searchManifestSummary'));

const techniques = runJson(['techniques']);
assert.ok(techniques.some((technique) => technique.id === 'full-house'));

const textSolve = runText(['solve', almostSolved, '--format', 'text', '--locale', 'zh-CN']);
assert.match(textSolve, /满屋法/);

const analysis = runJson([
  'generator-analyze',
  '{"constraints":{"score":{"min":3000},"allowedTechniques":["full-house","naked-single","hidden-single"]}}',
]);
assert.equal(analysis.status, 'unlikely');

console.log('cli smoke passed');
