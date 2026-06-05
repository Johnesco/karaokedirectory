#!/usr/bin/env node
/**
 * Optional: watch _curator/data.js and rebuild js/data.js on save.
 *
 * Leave this running in a terminal during a curation session. Edits to the
 * master trigger an automatic rebuild; reload localhost to see public-app
 * rendering update without manual `node scripts/build-public-data.js` calls.
 *
 * Usage:
 *   node scripts/watch-master.js
 *
 * Ctrl-C to stop.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const MASTER_PATH = path.join(REPO_ROOT, '_curator', 'data.js');
const BUILD_SCRIPT = path.join(__dirname, 'build-public-data.js');

if (!fs.existsSync(MASTER_PATH)) {
    process.stderr.write('[watch-master] _curator/data.js not found. Bootstrap before watching.\n');
    process.exit(1);
}

function build() {
    const result = spawnSync(process.execPath, [BUILD_SCRIPT], {
        cwd: REPO_ROOT,
        stdio: 'inherit'
    });
    if (result.status !== 0) {
        process.stderr.write('[watch-master] build returned exit ' + result.status + '\n');
    }
}

// Initial build so the watcher boots from a known-good state
build();

// fs.watch fires multiple events per save on some platforms — debounce
let pending = null;
fs.watch(MASTER_PATH, { persistent: true }, (eventType) => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
        pending = null;
        process.stdout.write('[watch-master] master changed (' + eventType + '), rebuilding...\n');
        build();
    }, 150);
});

process.stdout.write('[watch-master] watching ' + path.relative(REPO_ROOT, MASTER_PATH) + ' — Ctrl-C to stop\n');
