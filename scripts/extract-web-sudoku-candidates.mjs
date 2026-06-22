#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const options = parseArgs(process.argv.slice(2));
const startedAt = performance.now();
const urls = collectUrls(options);
const rows = [];
const seen = new Set();
let fetched = 0;
let failed = 0;

for (const url of urls) {
  let text = '';
  try {
    text = await fetchText(url, options.timeoutMs);
    fetched += 1;
  } catch (error) {
    failed += 1;
    if (options.includeFailures) {
      const sourceId = buildSourceId(url, 'fetch-failed');
      rows.push(`# ${sourceId} ${formatError(error)}`);
    }
    continue;
  }

  for (const candidate of extractCandidates(url, text)) {
    const key = `${candidate.sourceId}\t${candidate.puzzle}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    rows.push(`${candidate.sourceId} ${candidate.puzzle}`);
  }
}

const payload = `${rows.join('\n')}${rows.length > 0 ? '\n' : ''}`;
if (options.outputPath) {
  writeFileSync(resolve(process.cwd(), options.outputPath), payload, 'utf8');
} else {
  process.stdout.write(payload);
}

if (!options.quiet) {
  process.stderr.write(
    `Extracted ${rows.filter((row) => !row.startsWith('#')).length} candidate(s) from ${fetched}/${urls.length} URL(s); failed=${failed}; elapsed=${Math.round(performance.now() - startedAt)}ms\n`,
  );
}

function collectUrls(extractOptions) {
  const collected = [];
  if (extractOptions.inputPath) {
    const text = readFileSync(resolve(process.cwd(), extractOptions.inputPath), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const body = line.replace(/#.*/, '').trim();
      if (!body) {
        continue;
      }
      collected.push(...body.split(/\s+/).filter((token) => /^https?:\/\//.test(token)));
    }
  }
  collected.push(...extractOptions.urls);
  return [...new Set(collected)];
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 classic9-reference-candidate-audit/1.0',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      return await fetchTextWithCurl(url, timeoutMs, error);
    }
  } finally {
    clearTimeout(timer);
  }
}

function fetchTextWithCurl(url, timeoutMs, originalError) {
  return new Promise((resolveFetch, rejectFetch) => {
    execFile(
      'curl',
      ['-Ls', '--max-time', String(Math.max(1, Math.ceil(timeoutMs / 1000))), url],
      { maxBuffer: 20 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          rejectFetch(new Error(`${formatError(originalError)}; curl:${formatError(error)}`));
          return;
        }
        resolveFetch(stdout);
      },
    );
  });
}

function extractCandidates(url, html) {
  const candidates = [];
  const seenPuzzles = new Set();
  const decoded = decodeHtml(html);
  const sources = [
    { label: 'url', text: url },
    { label: 'html', text: html },
    { label: 'decoded', text: decoded },
  ];

  for (const source of sources) {
    collectPattern(candidates, seenPuzzles, url, source.label, source.text, /(?:[?&]|&amp;)(?:bd|p|puzzle|grid)=([0-9.-]{81})(?=&|#|["'<\s]|$)/gi);
    collectPattern(candidates, seenPuzzles, url, source.label, source.text, /playsudoku\?p=([0-9.-]{81})(?=&|#|["'<\s]|$)/gi);
    collectPattern(candidates, seenPuzzles, url, source.label, source.text, /Original sudoku:\s*<\/h2>\s*<p><code>\s*([0-9.-]{81})/gi);
    collectPattern(candidates, seenPuzzles, url, source.label, source.text, /\b([0-9.]{81})\b/g);
  }
  collectAsciiGridCandidates(candidates, seenPuzzles, url, decoded);

  return candidates;
}

function collectPattern(candidates, seenPuzzles, url, label, text, pattern) {
  for (const match of text.matchAll(pattern)) {
    const puzzle = normalizePuzzle(match[1]);
    if (!puzzle) {
      continue;
    }
    if (seenPuzzles.has(puzzle)) {
      continue;
    }
    seenPuzzles.add(puzzle);
    candidates.push({
      sourceId: buildSourceId(url, label),
      puzzle,
    });
  }
}

function collectAsciiGridCandidates(candidates, seenPuzzles, url, html) {
  const text = decodeHtml(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|pre|td|tr|div|span|code)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  let rows = [];
  for (const line of text.split(/\r?\n/)) {
    const body = line.replace(/\u00a0/g, ' ').trim();
    if (!body.includes('|')) {
      continue;
    }
    const tokens = body.match(/[0-9.]/g) ?? [];
    if (tokens.length === 0) {
      continue;
    }
    if (tokens.length !== 9) {
      rows = [];
      continue;
    }
    rows.push(tokens.join(''));
    if (rows.length === 9) {
      const puzzle = normalizePuzzle(rows.join(''));
      rows = [];
      if (!puzzle || seenPuzzles.has(puzzle)) {
        continue;
      }
      seenPuzzles.add(puzzle);
      candidates.push({
        sourceId: buildSourceId(url, 'ascii-grid'),
        puzzle,
      });
    }
  }
}

function normalizePuzzle(value) {
  const trimmed = value.trim().replace(/[.-]/g, '0');
  if (!/^[0-9]{81}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function buildSourceId(rawUrl, label) {
  try {
    const parsed = new URL(rawUrl);
    const path = parsed.pathname
      .replace(/^\/+|\/+$/g, '')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return `web:${parsed.hostname.replace(/^www\./, '')}:${path || 'root'}:${label}`;
  } catch {
    return `web:unknown:${label}`;
  }
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseArgs(args) {
  const parsed = {
    inputPath: null,
    outputPath: null,
    urls: [],
    timeoutMs: 15000,
    includeFailures: false,
    quiet: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--input') {
      parsed.inputPath = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--output') {
      parsed.outputPath = requireValue(args, index, item);
      index += 1;
      continue;
    }
    if (item === '--url') {
      parsed.urls.push(requireValue(args, index, item));
      index += 1;
      continue;
    }
    if (item === '--timeout-ms') {
      parsed.timeoutMs = parsePositiveInteger(requireValue(args, index, item), item);
      index += 1;
      continue;
    }
    if (item === '--include-failures') {
      parsed.includeFailures = true;
      continue;
    }
    if (item === '--quiet') {
      parsed.quiet = true;
      continue;
    }
    throw new Error(`Unknown option: ${item}`);
  }
  if (!parsed.inputPath && parsed.urls.length === 0) {
    throw new Error('--input or --url is required.');
  }
  return parsed;
}

function requireValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function parsePositiveInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return parsed;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
