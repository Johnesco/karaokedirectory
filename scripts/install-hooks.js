#!/usr/bin/env node
/**
 * One-time setup: install git hooks for the karaokedirectory project.
 *
 * Currently installs:
 *   .git/hooks/pre-commit — runs scripts/precommit.js (curator build + stage)
 *
 * Run from the repo root:
 *   node scripts/install-hooks.js
 *
 * Safe to re-run. Overwrites any existing hook of the same name with a backup.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOKS_DIR = path.join(REPO_ROOT, '.git', 'hooks');

if (!fs.existsSync(HOOKS_DIR)) {
    process.stderr.write('[install-hooks] .git/hooks not found at ' + HOOKS_DIR + '.\n');
    process.stderr.write('Are you running this from the repo root in a fresh clone? Try `git init` or `git clone` first.\n');
    process.exit(1);
}

const hookPath = path.join(HOOKS_DIR, 'pre-commit');
const hookBody =
    '#!/bin/sh\n' +
    '# karaokedirectory pre-commit hook (installed by scripts/install-hooks.js)\n' +
    '# Runs the curator build if _curator/data.js exists; stages js/data.js if it changed.\n' +
    'exec node scripts/precommit.js\n';

if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf8');
    if (existing === hookBody) {
        process.stdout.write('[install-hooks] pre-commit already installed and current. No changes.\n');
        process.exit(0);
    }
    const backupPath = hookPath + '.backup-' + Date.now();
    fs.copyFileSync(hookPath, backupPath);
    process.stdout.write('[install-hooks] existing pre-commit backed up to ' + path.relative(REPO_ROOT, backupPath) + '\n');
}

fs.writeFileSync(hookPath, hookBody, 'utf8');

// chmod +x — best effort; on Windows this is a no-op but harmless
try {
    fs.chmodSync(hookPath, 0o755);
} catch (err) {
    // Windows fs.chmodSync may throw on some filesystems; ignore
}

process.stdout.write('[install-hooks] installed ' + path.relative(REPO_ROOT, hookPath) + '\n');
process.stdout.write('[install-hooks] git commits will now auto-run the curator build when _curator/data.js exists.\n');
