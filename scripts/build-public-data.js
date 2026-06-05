#!/usr/bin/env node
/**
 * Build public js/data.js from the gitignored curator master.
 *
 * Strict mode: if anything in the master is malformed, or any _curatorMeta
 * would survive into the output, the build refuses to write and exits non-zero.
 *
 * Usage:
 *   node scripts/build-public-data.js
 *
 * Exit codes:
 *   0  — clean build (or no-op if js/data.js would be byte-identical)
 *   1  — master missing or unreadable
 *   2  — validation errors (master has bad shape or output would be malformed)
 *   3  — write failure
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MASTER_PATH = path.join(REPO_ROOT, '_curator', 'data.js');
const PUBLIC_PATH = path.join(REPO_ROOT, 'js', 'data.js');

function die(code, message) {
    process.stderr.write('[build-public-data] ERROR: ' + message + '\n');
    process.exit(code);
}

function reportErrors(errors) {
    process.stderr.write('[build-public-data] VALIDATION FAILED (' + errors.length + ' issue' + (errors.length === 1 ? '' : 's') + '):\n');
    for (const e of errors) process.stderr.write('  - ' + e + '\n');
    process.stderr.write('\nNo changes written to ' + path.relative(REPO_ROOT, PUBLIC_PATH) + '.\n');
    process.exit(2);
}

// 1. Load master ------------------------------------------------------------
if (!fs.existsSync(MASTER_PATH)) {
    die(1,
        'Master not found at ' + path.relative(REPO_ROOT, MASTER_PATH) + '.\n' +
        'Bootstrap: cp -r _curator.example _curator, then paste your venue data into _curator/data.js.'
    );
}

let master;
try {
    // Clear cache so re-runs (e.g. from watch-master.js) pick up edits
    delete require.cache[require.resolve(MASTER_PATH)];
    master = require(MASTER_PATH);
} catch (err) {
    die(1, 'Could not load master file: ' + err.message);
}

// 2. Validate master shape --------------------------------------------------
const shapeErrors = [];
if (!master || typeof master !== 'object') shapeErrors.push('master export is not an object');
else {
    if (!master.tagDefinitions || typeof master.tagDefinitions !== 'object') {
        shapeErrors.push('master.tagDefinitions is missing or not an object');
    }
    if (!Array.isArray(master.listings)) {
        shapeErrors.push('master.listings is missing or not an array');
    }
}
if (shapeErrors.length) reportErrors(shapeErrors);

// 3. Deep-clone listings, strip _curatorMeta --------------------------------
const tagIds = new Set(Object.keys(master.tagDefinitions));
const requiredFields = ['id', 'name', 'address', 'schedule'];
const errors = [];
let stripped = 0;

// Recursive strip: catches _curatorMeta anywhere in the tree, including on
// schedule entries or nested objects. The top-level count tracks per-venue
// strips; nested strips also feed the safety check below.
function stripCuratorMetaDeep(node) {
    if (Array.isArray(node)) {
        for (const item of node) stripCuratorMetaDeep(item);
    } else if (node && typeof node === 'object') {
        if (Object.prototype.hasOwnProperty.call(node, '_curatorMeta')) {
            delete node._curatorMeta;
        }
        for (const value of Object.values(node)) stripCuratorMetaDeep(value);
    }
}

const publicListings = master.listings.map((venue, idx) => {
    const clone = JSON.parse(JSON.stringify(venue));
    const hadTopLevelMeta = Object.prototype.hasOwnProperty.call(clone, '_curatorMeta');
    stripCuratorMetaDeep(clone);
    if (hadTopLevelMeta) stripped++;

    const label = clone.id ? `listing[${idx}] "${clone.id}"` : `listing[${idx}]`;

    for (const field of requiredFields) {
        if (!clone[field]) errors.push(`${label}: missing required field "${field}"`);
    }
    if (clone.address && (!clone.address.street || !clone.address.city)) {
        errors.push(`${label}: address.street and address.city are required`);
    }
    if (!Array.isArray(clone.schedule) || clone.schedule.length === 0) {
        errors.push(`${label}: schedule must be a non-empty array`);
    }
    if (Array.isArray(clone.tags)) {
        for (const tag of clone.tags) {
            if (!tagIds.has(tag)) errors.push(`${label}: unknown tag id "${tag}"`);
        }
    }
    return clone;
});

// 4. Final safety check — no _curatorMeta survived --------------------------
const serialized = JSON.stringify(publicListings);
if (serialized.indexOf('_curatorMeta') !== -1) {
    errors.push('SAFETY CHECK FAILED: "_curatorMeta" appeared in serialized output. Refusing to write.');
}

if (errors.length) reportErrors(errors);

// 5. Build the public file -------------------------------------------------
const publicData = {
    tagDefinitions: master.tagDefinitions,
    listings: publicListings
};
const output = 'const karaokeData = ' + JSON.stringify(publicData, null, 2) + ';\n';

// Skip write if byte-identical (avoids touching mtime / git status)
let prevContent = null;
if (fs.existsSync(PUBLIC_PATH)) {
    prevContent = fs.readFileSync(PUBLIC_PATH, 'utf8');
}

if (prevContent === output) {
    process.stdout.write('[build-public-data] up to date — ' + publicListings.length + ' venues, ' + stripped + ' had _curatorMeta stripped\n');
    process.exit(0);
}

try {
    fs.writeFileSync(PUBLIC_PATH, output, 'utf8');
} catch (err) {
    die(3, 'Could not write public data: ' + err.message);
}

process.stdout.write(
    '[build-public-data] wrote ' + publicListings.length + ' venues to ' + path.relative(REPO_ROOT, PUBLIC_PATH) +
    ' (' + stripped + ' had _curatorMeta stripped, ' + output.length + ' bytes)\n'
);
