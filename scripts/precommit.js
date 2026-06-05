#!/usr/bin/env node
/**
 * Git pre-commit hook callback.
 *
 * Runs the curator build script if the master file exists. If the build
 * succeeds and js/data.js changed, stages it so it goes into the commit.
 * If the build fails (validation error, bad master), blocks the commit.
 *
 * If the master file doesn't exist (fresh clone, no curator data), this is
 * a no-op — exits 0 so commits proceed normally.
 *
 * Installed by scripts/install-hooks.js into .git/hooks/pre-commit.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const MASTER_PATH = path.join(REPO_ROOT, '_curator', 'data.js');
const PUBLIC_PATH = path.join(REPO_ROOT, 'js', 'data.js');
const BUILD_SCRIPT = path.join(__dirname, 'build-public-data.js');

if (!fs.existsSync(MASTER_PATH)) {
    // No master = no curator workflow here. Common on CI or fresh clones.
    process.exit(0);
}

process.stdout.write('[pre-commit] _curator/data.js found — running build...\n');

const prevContent = fs.existsSync(PUBLIC_PATH) ? fs.readFileSync(PUBLIC_PATH, 'utf8') : null;

const result = spawnSync(process.execPath, [BUILD_SCRIPT], {
    cwd: REPO_ROOT,
    stdio: 'inherit'
});

if (result.status !== 0) {
    process.stderr.write('[pre-commit] build failed — commit blocked.\n');
    process.exit(result.status || 1);
}

// Stage js/data.js if it changed
const newContent = fs.existsSync(PUBLIC_PATH) ? fs.readFileSync(PUBLIC_PATH, 'utf8') : null;
if (newContent !== prevContent) {
    try {
        execSync('git add ' + JSON.stringify(path.relative(REPO_ROOT, PUBLIC_PATH).replace(/\\/g, '/')), {
            cwd: REPO_ROOT,
            stdio: 'inherit'
        });
        process.stdout.write('[pre-commit] js/data.js updated and staged.\n');
    } catch (err) {
        process.stderr.write('[pre-commit] WARNING: build succeeded but could not stage js/data.js: ' + err.message + '\n');
        process.exit(1);
    }
}

process.exit(0);
