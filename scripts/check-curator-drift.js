#!/usr/bin/env node
/**
 * Compare the curator master against js/data.json and report drift.
 *
 * The curator's "Export to karaokedirectory" writes js/data.json **verbatim**
 * from its own master. Nothing sits between the two: a master that is behind
 * the repo silently reverts whatever landed since it was last synced, and every
 * existing gate stays green — validate-data.js checks the file against the
 * schema, not against what it replaced.
 *
 * That is not hypothetical. On 2026-08-26 the master was 17 days stale and
 * missing all 13 tag definitions from #229's contrast fix plus four Highball
 * schedule entries including #228's Story-Oke event. Exporting would have
 * reintroduced 111 contrast failures and deleted a live event (#237).
 *
 * Direction matters:
 *   master ahead of repo  -> normal. That is the pending export.
 *   repo ahead of master  -> DANGEROUS. Export would drop it. Exits non-zero.
 *
 * The master lives outside this repo and is not required. When it is absent
 * this exits 0 with a note, so CI and other contributors are unaffected.
 *
 * Usage:
 *   npm run curator:check
 *   node scripts/check-curator-drift.js [path/to/data-curated.js]
 *   CURATOR_MASTER=/some/path npm run curator:check
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPO_DATA = path.join(ROOT, 'js', 'data.json');
const DEFAULT_MASTER = path.join(os.homedir(), 'karaoke-curator', 'data-curated.js');
const MASTER = process.argv[2] || process.env.CURATOR_MASTER || DEFAULT_MASTER;

/* Fields the master legitimately carries that the public file never has. These
   are curator bookkeeping, not drift — the export strips them by design. */
const CURATOR_ONLY_FIELDS = new Set(['_curatorMeta']);

const REGISTRIES = ['tagDefinitions', 'kjs', 'companies', 'cities'];

// ---------------------------------------------------------------- loading

function readMaster(file) {
    const src = fs.readFileSync(file, 'utf8');
    const marker = 'window.curatorData';
    const at = src.indexOf(marker);
    if (at === -1) throw new Error(`no "${marker}" assignment found in ${file}`);
    const eq = src.indexOf('=', at + marker.length);
    if (eq === -1) throw new Error(`malformed assignment in ${file}`);
    const body = src.slice(eq + 1).trim().replace(/;\s*$/, '');
    try {
        // The curator always writes JSON.stringify output, so this is JSON.
        // Parsed rather than evaluated: this file is not ours, and it does not
        // need to be executed to be compared.
        return JSON.parse(body);
    } catch (err) {
        throw new Error(
            `${file} is not parseable as JSON (${err.message}).\n`
            + '  The curator writes valid JSON; a hand-edit with unquoted keys or a\n'
            + '  trailing comma will land here. Fix the file or re-save from the curator.'
        );
    }
}

// ---------------------------------------------------------------- compare

/** Canonical form of a value, key-order independent, for equality tests. */
function canon(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
}

/** One-line label for a schedule entry, for human-readable output. */
function describeEntry(e) {
    const when = e.date || e.day || '?';
    const time = [e.startTime, e.endTime].filter(Boolean).join('-');
    return [e.frequency, when, time, e.eventName].filter(Boolean).join(' ');
}

const lost = [];        // repo content the export would drop -> fatal
const pending = [];     // master content not yet exported     -> informational

function compareRegistry(name, repoReg = {}, masterReg = {}) {
    for (const [id, repoVal] of Object.entries(repoReg)) {
        const masterVal = masterReg[id];
        if (masterVal === undefined) {
            lost.push(`${name}.${id} exists in the repo but not in the master`);
            continue;
        }
        for (const [field, rv] of Object.entries(repoVal)) {
            if (canon(rv) !== canon(masterVal[field])) {
                lost.push(`${name}.${id}.${field}: repo ${JSON.stringify(rv)} -> master ${JSON.stringify(masterVal[field])}`);
            }
        }
    }
    for (const id of Object.keys(masterReg)) {
        if (repoReg[id] === undefined) pending.push(`${name}.${id} is new in the master`);
    }
}

function compareVenue(repoV, masterV) {
    for (const [field, rv] of Object.entries(repoV)) {
        if (field === 'schedule') continue;                 // handled below
        const mv = masterV[field];
        if (mv === undefined) {
            lost.push(`${repoV.id}.${field} exists in the repo but not in the master`);
        } else if (canon(rv) !== canon(mv)) {
            lost.push(`${repoV.id}.${field}: repo ${JSON.stringify(rv)} -> master ${JSON.stringify(mv)}`);
        }
    }
    for (const field of Object.keys(masterV)) {
        if (CURATOR_ONLY_FIELDS.has(field)) continue;
        if (repoV[field] === undefined) pending.push(`${repoV.id}.${field} is new in the master`);
    }

    // Schedule entries compare as a set: order carries no meaning.
    const repoEntries = repoV.schedule || [];
    const masterEntries = masterV.schedule || [];
    const masterKeys = new Set(masterEntries.map(canon));
    const repoKeys = new Set(repoEntries.map(canon));
    for (const e of repoEntries) {
        if (!masterKeys.has(canon(e))) lost.push(`${repoV.id} schedule entry missing from master: ${describeEntry(e)}`);
    }
    for (const e of masterEntries) {
        if (!repoKeys.has(canon(e))) pending.push(`${repoV.id} new schedule entry in master: ${describeEntry(e)}`);
    }
}

// ---------------------------------------------------------------- run

if (!fs.existsSync(MASTER)) {
    console.log('=== Curator drift check ===');
    console.log(`No curator master at ${MASTER}`);
    console.log('Nothing to compare — skipping. Expected for anyone who does not run the curator.');
    process.exit(0);
}

let repo;
let master;
try {
    repo = JSON.parse(fs.readFileSync(REPO_DATA, 'utf8'));
    master = readMaster(MASTER);
} catch (err) {
    console.error('=== Curator drift check ===');
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
}

const countOf = (o) => ({
    listings: (o.listings || []).length,
    schedule: (o.listings || []).reduce((n, v) => n + (v.schedule || []).length, 0),
    ...Object.fromEntries(REGISTRIES.map((r) => [r, Object.keys(o[r] || {}).length])),
});

const rc = countOf(repo);
const mc = countOf(master);

console.log('=== Curator drift check ===');
console.log(`master: ${MASTER}`);
console.log(`repo:   ${path.relative(ROOT, REPO_DATA)}`);
console.log('');
console.log('                 repo   master');
for (const k of Object.keys(rc)) {
    const flag = rc[k] === mc[k] ? '' : '   <- differs';
    console.log(`  ${k.padEnd(14)} ${String(rc[k]).padStart(4)}   ${String(mc[k]).padStart(4)}${flag}`);
}

for (const r of REGISTRIES) compareRegistry(r, repo[r], master[r]);

const masterById = new Map((master.listings || []).map((v) => [v.id, v]));
const repoIds = new Set();
for (const v of (repo.listings || [])) {
    repoIds.add(v.id);
    const mv = masterById.get(v.id);
    if (!mv) {
        lost.push(`venue "${v.id}" exists in the repo but not in the master`);
        continue;
    }
    compareVenue(v, mv);
}
for (const v of (master.listings || [])) {
    if (!repoIds.has(v.id)) pending.push(`venue "${v.id}" is new in the master`);
}

if (pending.length) {
    console.log(`\n=== ${pending.length} change(s) waiting to be exported — informational ===`);
    pending.forEach((p) => console.log(`- ${p}`));
}

if (lost.length) {
    console.log(`\n=== ${lost.length} item(s) the export WOULD DESTROY ===`);
    lost.forEach((l) => console.log(`- ${l}`));
    console.log('\nThe master is behind the repo. Exporting now would overwrite the above.');
    console.log('Sync the master first, then export. Do not fix js/data.json alone —');
    console.log('the master is the source of truth and the next export would undo it.');
    process.exit(1);
}

console.log('\nNo repo content is at risk. Safe to export.');
