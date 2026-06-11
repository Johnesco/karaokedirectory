#!/usr/bin/env node
/**
 * Regenerate js/data.js from js/data.json — the canonical source.
 *
 * data.json is the single artifact developers (and the curator) edit.
 * data.js exists only so the browser can load venue data synchronously
 * via <script src="js/data.js"> without changing index.html / submit.html
 * (no async refactor in this ticket, see #102).
 *
 * The CI workflow runs this and then `git diff --quiet js/data.js` to
 * catch any drift — if you edit data.json and forget to sync, CI fails.
 *
 * Usage:
 *   node scripts/sync-data-js.js          # write js/data.js from js/data.json
 *   node scripts/sync-data-js.js --check  # exit 1 if data.js is out of sync (no write)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'js', 'data.json');
const JS_PATH = path.join(ROOT, 'js', 'data.js');

const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
const regenerated = 'const karaokeData = ' + JSON.stringify(data, null, 2) + ';\n';

if (process.argv.includes('--check')) {
    const actual = fs.readFileSync(JS_PATH, 'utf-8');
    if (actual === regenerated) {
        console.log('js/data.js is in sync with js/data.json');
        process.exit(0);
    }
    console.error('js/data.js is OUT OF SYNC with js/data.json.');
    console.error('Run: node scripts/sync-data-js.js');
    process.exit(1);
}

fs.writeFileSync(JS_PATH, regenerated);
console.log('Wrote', JS_PATH, '—', data.listings.length, 'venues');
