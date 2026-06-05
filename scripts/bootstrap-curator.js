#!/usr/bin/env node
/**
 * One-time bootstrap: convert current js/data.js → _curator/data.js (master format).
 * Run once at the start of the curator's setup.
 * Safe to re-run only if _curator/data.js doesn't yet have hand-added _curatorMeta —
 * otherwise it will be overwritten. (Use with caution after initial setup.)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(REPO_ROOT, 'js', 'data.js');
const DEST_DIR = path.join(REPO_ROOT, '_curator');
const DEST = path.join(DEST_DIR, 'data.js');

if (!fs.existsSync(SRC)) {
    process.stderr.write('js/data.js not found — cannot bootstrap.\n');
    process.exit(1);
}

let src = fs.readFileSync(SRC, 'utf8');
src = src.replace(/^const karaokeData = /, 'const curatorMasterData = ');
if (!src.endsWith('\n')) src += '\n';
src +=
    '\nif (typeof window !== \'undefined\') window.curatorMasterData = curatorMasterData;\n' +
    'if (typeof module !== \'undefined\') module.exports = curatorMasterData;\n';

fs.mkdirSync(DEST_DIR, { recursive: true });
fs.writeFileSync(DEST, src);

process.stdout.write('[bootstrap] wrote ' + path.relative(REPO_ROOT, DEST) + ' (' + src.length + ' bytes)\n');
