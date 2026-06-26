#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const options = parseArgs(process.argv.slice(2));
const packEntries = runPackDryRun();
const pack = packEntries[0];
if (!pack) {
  throw new Error('npm pack --dry-run did not return package metadata.');
}

const files = pack.files.map((file) => ({
  path: file.path,
  size: file.size,
  group: groupPath(file.path),
  extension: extensionOf(file.path),
}));
const summary = {
  reportId: 'package-size-report.v1',
  name: pack.name,
  version: pack.version,
  tarballBytes: pack.size,
  unpackedBytes: pack.unpackedSize,
  entryCount: pack.entryCount,
  topLevelGroups: aggregate(files, (file) => file.group),
  extensions: aggregate(files, (file) => file.extension),
  largestFiles: [...files].sort((left, right) => right.size - left.size).slice(0, options.limit),
};

if (options.out) {
  writeFileSync(options.out, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

if (options.json) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  printHumanSummary(summary);
}

function runPackDryRun() {
  const output = execFileSync(npmCommand(), ['pack', '--dry-run', '--json', '--cache', './.npm-cache'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(output);
}

function aggregate(files, keyFn) {
  const groups = new Map();
  for (const file of files) {
    const key = keyFn(file);
    const current = groups.get(key) ?? { name: key, bytes: 0, files: 0 };
    current.bytes += file.size;
    current.files += 1;
    groups.set(key, current);
  }
  return [...groups.values()].sort((left, right) => right.bytes - left.bytes);
}

function groupPath(path) {
  if (path.startsWith('dist/src/')) {
    const parts = path.split('/');
    return parts.length >= 4 ? `dist/src/${parts[2]}` : 'dist/src';
  }
  const [first] = path.split('/');
  return first ?? path;
}

function extensionOf(path) {
  const last = path.split('/').pop() ?? path;
  const dotIndex = last.lastIndexOf('.');
  return dotIndex >= 0 ? last.slice(dotIndex) : '(none)';
}

function parseArgs(args) {
  const parsed = {
    json: false,
    out: null,
    limit: 15,
  };
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--json') {
      parsed.json = true;
      continue;
    }
    if (item === '--out') {
      parsed.out = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--limit') {
      parsed.limit = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${item}`);
  }
  return parsed;
}

function parsePositiveInteger(raw, option) {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return value;
}

function requireValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function printHumanSummary(summary) {
  process.stdout.write(`Package size: ${summary.name}@${summary.version}\n`);
  process.stdout.write(`- tarball: ${formatBytes(summary.tarballBytes)}\n`);
  process.stdout.write(`- unpacked: ${formatBytes(summary.unpackedBytes)}\n`);
  process.stdout.write(`- entries: ${summary.entryCount}\n`);
  process.stdout.write('\nTop groups:\n');
  for (const group of summary.topLevelGroups.slice(0, 10)) {
    process.stdout.write(`- ${group.name}: ${formatBytes(group.bytes)} (${group.files} files)\n`);
  }
  process.stdout.write('\nLargest files:\n');
  for (const file of summary.largestFiles) {
    process.stdout.write(`- ${file.path}: ${formatBytes(file.size)}\n`);
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}
