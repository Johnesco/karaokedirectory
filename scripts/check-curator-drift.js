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
 * Schedule entries have no id, so they match on content. `lastVerified` is
 * left out of that identity and compared by direction on its own (#246) —
 * see compareVenue for why.
 *
 * The master lives outside this repo and is not required. When it is absent
 * this exits 0 with a note, so CI and other contributors are unaffected.
 *
 * Usage:
 *   npm run curator:check
 *   node scripts/check-curator-drift.js [path/to/data-curated.js]
 *   CURATOR_MASTER=/some/path npm run curator:check
 *   REPO_DATA=/tmp/main-data.json CURATOR_BASE=~/karaoke-curator/last-published.json \
 *       node scripts/check-curator-drift.js     # what scripts/publish-data.js runs
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// The public file to compare against. Normally the working copy; the publish
// script points it at what `main` actually holds, which is the thing a publish
// would overwrite.
const REPO_DATA = process.env.REPO_DATA || path.join(ROOT, 'js', 'data.json');
const DEFAULT_MASTER = path.join(os.homedir(), 'karaoke-curator', 'data-curated.js');
const MASTER = process.argv[2] || process.env.CURATOR_MASTER || DEFAULT_MASTER;

/* The last thing this curator published, if it has ever published (#277).
   Without it the check is two-way and has to treat every repo/master
   difference as content at risk. That made ORDINARY EDITING fatal: rename a
   venue, fix an address, move a show half an hour, and the repo's old value
   looks like something the export would destroy. It is the master's job to
   hold newer values.

   With a base, the question becomes answerable: a repo value is at risk only
   where it differs from what we last published, because that means someone
   ELSE changed it. Everything else the master differs on is our own edit. */
const BASE = process.env.CURATOR_BASE || path.join(path.dirname(MASTER), 'last-published.json');

/* Keys the master legitimately carries that the public file never has: anything
   underscore-prefixed, at any level (`_curatorMeta` on a venue, `_announcements`
   on a schedule entry, #264). Curator bookkeeping, not drift — the export
   strips them by design, and the curator's own safety check refuses an export
   in which one survived. */
const isCuratorOnly = (key) => key.startsWith('_');

/* Verification fields (#246, #263) are compared by direction, not as identity:
   the curator changes them routinely, and a stamped-but-unexported show must
   read as pending, not as a fatal loss. See compareVenue. */
const VERIFICATION_FIELDS = new Set(['lastVerified']);

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
    const baseReg = (base && base[name]) || null;
    const publishedSame = (id, field, rv) => baseReg && baseReg[id] && canon(baseReg[id][field]) === canon(rv);
    for (const [id, repoVal] of Object.entries(repoReg)) {
        const masterVal = masterReg[id];
        if (masterVal === undefined) {
            if (baseReg && baseReg[id] !== undefined) pending.push(`${name}.${id} removed in master (edited since our last publish)`);
            else lost.push(`${name}.${id} exists in the repo but not in the master`);
            continue;
        }
        for (const [field, rv] of Object.entries(repoVal)) {
            if (canon(rv) === canon(masterVal[field])) continue;
            if (publishedSame(id, field, rv)) pending.push(`${name}.${id}.${field} edited in master: ${JSON.stringify(rv)} -> ${JSON.stringify(masterVal[field])}`);
            else lost.push(`${name}.${id}.${field}: repo ${JSON.stringify(rv)} -> master ${JSON.stringify(masterVal[field])}`);
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
        if (canon(rv) === canon(mv)) continue;
        const ours = weLastPublished(repoV.id, field, rv);
        const what = mv === undefined
            ? `${repoV.id}.${field} removed in master`
            : `${repoV.id}.${field}: repo ${JSON.stringify(rv)} -> master ${JSON.stringify(mv)}`;
        if (ours) pending.push(`${what} (edited since our last publish)`);
        else if (mv === undefined) lost.push(`${repoV.id}.${field} exists in the repo but not in the master`);
        else lost.push(what);
    }
    for (const field of Object.keys(masterV)) {
        if (isCuratorOnly(field)) continue;
        if (repoV[field] === undefined) pending.push(`${repoV.id}.${field} is new in the master`);
    }

    // Schedule entries compare as a multiset: order carries no meaning, and two
    // identical entries pair off one-to-one.
    //
    // `lastVerified` is matched separately (#246, ADR-015). It is the one field
    // the curator changes routinely — every poster confirmed is a new date — so
    // folding it into the identity would report each stamped-but-unexported
    // show as a fatal loss and bury real drift in noise. An entry's identity
    // is everything EXCEPT that date, and the dates of a matched pair are then
    // compared by direction like any other field: the master being newer is a
    // pending export; the repo being newer, or holding a date the master lacks,
    // is content the export would strip. Later dates sort later as strings,
    // which is what makes ">" the right comparison for an ISO date.
    //
    // Editing a show's time AND verifying it in one pass still reports as a
    // lost + pending pair — with no id, an edit is indistinguishable from a
    // delete-and-add. That is pre-existing for every entry edit.
    const identity = (e) => {
        const rest = {};
        for (const [k, val] of Object.entries(e)) {
            if (VERIFICATION_FIELDS.has(k) || isCuratorOnly(k)) continue;
            rest[k] = val;
        }
        return canon(rest);
    };
    const repoEntries = repoV.schedule || [];
    const masterEntries = masterV.schedule || [];
    const pool = new Map();
    for (const e of masterEntries) {
        const key = identity(e);
        if (!pool.has(key)) pool.set(key, []);
        pool.get(key).push(e);
    }
    // An entry the base also had, in the same shape, is one WE published — so
    // the master no longer having it is our own edit or deletion, not a loss.
    const baseEntries = (baseById.get(repoV.id) || {}).schedule || [];
    const basePool = new Set(baseEntries.map(identity));
    // The same question for the date: if the repo still holds the date WE
    // published, the master differing is our own correction, in either
    // direction. A curator may legitimately move a date back — fixing a stamp
    // that named the wrong night — and that must not read as destroying work.
    const baseNight = new Map(baseEntries.map((e) => [identity(e), e.lastVerified || '']));

    for (const r of repoEntries) {
        const candidates = pool.get(identity(r));
        const m = candidates && candidates.shift();
        if (!m) {
            if (basePool.has(identity(r))) pending.push(`${repoV.id} schedule entry edited or removed in master: ${describeEntry(r)}`);
            else lost.push(`${repoV.id} schedule entry missing from master: ${describeEntry(r)}`);
            continue;
        }
        const rv = r.lastVerified || '';
        const mv = m.lastVerified || '';
        const where = `${repoV.id} ${describeEntry(r)}`;
        if (rv === mv) continue;
        // Ours to change: the repo still holds the date we published.
        const oursToChange = base && baseNight.has(identity(r)) && baseNight.get(identity(r)) === rv;
        if (!rv) pending.push(`${where}: confirmed for ${mv} in master, not yet exported`);
        else if (oursToChange) pending.push(`${where}: changed in master, ${rv} → ${mv || '(none)'} (edited since our last publish)`);
        else if (!mv) lost.push(`${where}: repo confirmed for ${rv}, master has no date — export would strip it`);
        else if (mv > rv) pending.push(`${where}: re-confirmed for ${mv} in master (repo has ${rv})`);
        else lost.push(`${where}: repo confirmed for ${rv}, master still ${mv} — export would revert it`);
    }
    for (const unmatched of pool.values()) {
        for (const e of unmatched) pending.push(`${repoV.id} new schedule entry in master: ${describeEntry(e)}`);
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

let base = null;
if (fs.existsSync(BASE)) {
    try { base = JSON.parse(fs.readFileSync(BASE, 'utf8')); }
    catch (err) { console.error(`WARNING: ignoring unreadable ${BASE}: ${err.message}`); }
}
const baseById = new Map(base ? (base.listings || []).map((v) => [v.id, v]) : []);
/* Did WE publish this exact value? Then the master differing from it is our
   own edit, not someone else's work about to be overwritten. */
const weLastPublished = (venueId, field, repoValue) => {
    if (!base) return false;
    const bv = baseById.get(venueId);
    return !!bv && canon(bv[field]) === canon(repoValue);
};

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
console.log(base
    ? `base:   ${BASE} (three-way — repo content is at risk only where it differs from our last publish)`
    : `base:   none (strict — every repo/master difference counts as content at risk)`);
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
        if (baseById.has(v.id)) pending.push(`venue "${v.id}" removed in master (edited since our last publish)`);
        else lost.push(`venue "${v.id}" exists in the repo but not in the master`);
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
