#!/usr/bin/env node
/**
 * Snapshot lines of code, file count, and bytes for source files.
 *
 * Used to measure before/after for the Code Unification initiative
 * (see GitHub issue: Code Unification & Simplification — tracking).
 *
 * Usage:
 *   node scripts/code-metrics.js               # print summary
 *   node scripts/code-metrics.js --json        # print JSON
 *   node scripts/code-metrics.js --save        # save snapshot under metrics/snapshots/
 *   node scripts/code-metrics.js --compare metrics/snapshots/<file>.json
 *
 * Buckets separate runtime app code (js/, css/, *.html) from tooling
 * (scripts/, supabase/) and docs (docs/, *.md). Refactor work should
 * shrink the app buckets without growing docs to mask the change.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const BUCKETS = {
  'app-js':   (f) => /^js[\\/]/.test(f) && f.endsWith('.js'),
  'app-css':  (f) => /^css[\\/]/.test(f) && f.endsWith('.css'),
  'app-html': (f) => /^[^\\/]+\.html$/.test(f),
  'editor':   (f) => /^editor[\\/]/.test(f),
  'scripts':  (f) => /^scripts[\\/]/.test(f),
  'supabase': (f) => /^supabase[\\/]/.test(f),
  'docs':     (f) => /^docs[\\/]/.test(f) || (/^[^\\/]+\.md$/.test(f) && f !== 'CLAUDE.md'),
  'claude':   (f) => f === 'CLAUDE.md',
  'config':   (f) => /^(\.github[\\/]|package\.json$|package-lock\.json$)/.test(f),
};

const EXCLUDE = /^(node_modules|_deprecated|\.git|metrics)[\\/]?/;
const INCLUDE_EXTS = new Set(['.js', '.css', '.html', '.md', '.sql', '.json', '.yml', '.yaml', '.sh']);

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full);
    if (EXCLUDE.test(rel)) continue;
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (INCLUDE_EXTS.has(path.extname(entry.name))) {
      files.push(rel);
    }
  }
  return files;
}

function bucketFor(rel) {
  for (const [name, test] of Object.entries(BUCKETS)) {
    if (test(rel)) return name;
  }
  return 'other';
}

function measure(rel) {
  const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const lines = content.split('\n');
  return {
    bytes: Buffer.byteLength(content, 'utf8'),
    lines: lines.length,
    nonBlank: lines.filter((l) => l.trim().length > 0).length,
  };
}

function gitInfo() {
  const safe = (cmd) => {
    try { return execSync(cmd, { cwd: ROOT }).toString().trim(); }
    catch { return 'unknown'; }
  };
  return {
    commit: safe('git rev-parse HEAD'),
    branch: safe('git rev-parse --abbrev-ref HEAD'),
  };
}

function snapshot() {
  const files = walk(ROOT, []);
  const { commit, branch } = gitInfo();
  const result = {
    date: new Date().toISOString(),
    commit,
    branch,
    total: { files: 0, bytes: 0, lines: 0, nonBlank: 0 },
    buckets: {},
  };

  for (const rel of files) {
    const bucket = bucketFor(rel);
    const m = measure(rel);
    if (!result.buckets[bucket]) {
      result.buckets[bucket] = { files: 0, bytes: 0, lines: 0, nonBlank: 0 };
    }
    for (const k of ['bytes', 'lines', 'nonBlank']) {
      result.buckets[bucket][k] += m[k];
      result.total[k] += m[k];
    }
    result.buckets[bucket].files += 1;
    result.total.files += 1;
  }

  return result;
}

function fmtKb(n) { return (n / 1024).toFixed(1) + ' KB'; }
function fmtDelta(n) { return (n >= 0 ? '+' : '') + n.toLocaleString(); }

function formatSummary(s) {
  const lines = [];
  lines.push(`Code metrics — ${s.date.slice(0, 10)} @ ${s.commit.slice(0, 7)} (${s.branch})`);
  lines.push('');
  lines.push(`Total: ${s.total.files} files, ${s.total.lines.toLocaleString()} lines `
    + `(${s.total.nonBlank.toLocaleString()} non-blank), ${fmtKb(s.total.bytes)}`);
  lines.push('');
  lines.push('  Bucket          Files    Lines  Non-blank       KB');
  lines.push('  ' + '-'.repeat(54));
  const entries = Object.entries(s.buckets).sort((a, b) => b[1].lines - a[1].lines);
  for (const [name, b] of entries) {
    lines.push(
      '  ' + name.padEnd(14)
      + ' ' + String(b.files).padStart(5)
      + ' ' + String(b.lines).padStart(8)
      + ' ' + String(b.nonBlank).padStart(10)
      + ' ' + (b.bytes / 1024).toFixed(1).padStart(8)
    );
  }
  return lines.join('\n');
}

function formatDiff(before, after) {
  const lines = [];
  lines.push(`Δ ${before.commit.slice(0, 7)} → ${after.commit.slice(0, 7)}`);
  lines.push('');
  lines.push('Total:');
  lines.push(`  Files     ${before.total.files} → ${after.total.files}     (${fmtDelta(after.total.files - before.total.files)})`);
  lines.push(`  Lines     ${before.total.lines.toLocaleString()} → ${after.total.lines.toLocaleString()}     (${fmtDelta(after.total.lines - before.total.lines)})`);
  lines.push(`  Non-blank ${before.total.nonBlank.toLocaleString()} → ${after.total.nonBlank.toLocaleString()}     (${fmtDelta(after.total.nonBlank - before.total.nonBlank)})`);
  lines.push(`  Bytes     ${fmtKb(before.total.bytes)} → ${fmtKb(after.total.bytes)}     (${fmtDelta(after.total.bytes - before.total.bytes)} bytes)`);
  lines.push('');
  lines.push('By bucket (only changed):');
  const allBuckets = new Set([...Object.keys(before.buckets), ...Object.keys(after.buckets)]);
  const empty = { files: 0, bytes: 0, lines: 0, nonBlank: 0 };
  for (const name of allBuckets) {
    const b = before.buckets[name] || empty;
    const a = after.buckets[name] || empty;
    const dl = a.lines - b.lines;
    if (dl === 0) continue;
    lines.push(`  ${name.padEnd(14)} ${b.lines.toLocaleString().padStart(7)} → ${a.lines.toLocaleString().padStart(7)} lines (${fmtDelta(dl)})`);
  }
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const compareIdx = args.indexOf('--compare');

  if (compareIdx !== -1 && args[compareIdx + 1]) {
    const before = JSON.parse(fs.readFileSync(args[compareIdx + 1], 'utf8'));
    const after = snapshot();
    console.log(formatDiff(before, after));
    return;
  }

  const s = snapshot();

  if (args.includes('--json')) {
    console.log(JSON.stringify(s, null, 2));
  } else {
    console.log(formatSummary(s));
  }

  if (args.includes('--save')) {
    const dir = path.join(ROOT, 'metrics', 'snapshots');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${s.date.slice(0, 10)}-${s.commit.slice(0, 7)}.json`);
    fs.writeFileSync(file, JSON.stringify(s, null, 2));
    console.error(`\nSaved snapshot to ${path.relative(ROOT, file)}`);
  }
}

main();
