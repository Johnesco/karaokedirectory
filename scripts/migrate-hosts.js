#!/usr/bin/env node
/**
 * One-time migration: inline hosts → kjs/companies registries (ADR-007, #124).
 *
 * Reads js/data.json, extracts every distinct KJ and company into the two
 * top-level registries, and rewrites each host to a `{ kjId?, companyId? }`
 * reference pair. Writes a candidate file by default so nothing is overwritten
 * until the report has been read.
 *
 * Usage:
 *   node scripts/migrate-hosts.js            # write js/data.migrated.json + report
 *   node scripts/migrate-hosts.js --apply    # overwrite js/data.json in place
 *
 * Merge policy (ADR-007): the tooling flags, the curator decides. Names are
 * merged only on an exact case-insensitive match. Anything softer — "Jen" vs
 * "KJ J3N", a duo vs its solo act — is left as separate entries, because those
 * calls need knowledge the data doesn't carry.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'js', 'data.json');
const OUT_PATH = process.argv.includes('--apply')
    ? DATA_PATH
    : path.join(ROOT, 'js', 'data.migrated.json');

/**
 * A host carrying BOTH a name and an affiliation plus a website is ambiguous:
 * the URL could belong to either the KJ or the company. Rather than guess, the
 * migration refuses to run unless the case is listed here with a decision.
 *
 * Keyed by website URL → 'kj' | 'company'.
 */
const WEBSITE_OWNER = {
    // facebook.com/brkaraoke is By Request Karaoke's own page, not Baby Jesus's.
    'https://www.facebook.com/brkaraoke': 'company',
};

const slugify = (s) => s
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const rawSource = fs.readFileSync(DATA_PATH, 'utf-8');
const data = JSON.parse(rawSource);
// Preserve the source file's line-ending style so the diff shows only the host
// changes rather than every line.
const usesCrlf = rawSource.includes('\r\n');

const kjs = {};        // id → { name, website?, socials? }
const companies = {};
const kjIdByName = new Map();      // lowercased name → id
const companyIdByName = new Map();
const report = { kjMerges: [], companyMerges: [], conflicts: [], ambiguous: [] };

/** Register a name in a registry, reusing the id on an exact case-insensitive match. */
function register(registry, idByName, rawName, extras, label) {
    const name = rawName.trim();
    const key = name.toLowerCase();

    if (idByName.has(key)) {
        const id = idByName.get(key);
        const entry = registry[id];
        // Fold in detail the first occurrence lacked; report genuine disagreements.
        for (const field of ['website', 'socials']) {
            const incoming = extras[field];
            if (!incoming) continue;
            if (!entry[field]) {
                entry[field] = incoming;
                report[label === 'kjs' ? 'kjMerges' : 'companyMerges'].push(
                    `${name}: filled in ${field} from a later record`);
            } else if (JSON.stringify(entry[field]) !== JSON.stringify(incoming)) {
                report.conflicts.push(
                    `${label} "${name}" has conflicting ${field}: kept ${JSON.stringify(entry[field])}, ignored ${JSON.stringify(incoming)}`);
            }
        }
        return id;
    }

    let id = slugify(name);
    if (registry[id]) id = `${id}-2`;   // slug collision between different names
    registry[id] = { name };
    if (extras.website) registry[id].website = extras.website;
    if (extras.socials) registry[id].socials = extras.socials;
    idByName.set(key, id);
    return id;
}

/** Convert one inline host object into a { kjId?, companyId? } ref. */
function toRef(host, where) {
    const name = (host.name || '').trim();
    const affiliation = (host.affiliation || '').trim();
    const hasBoth = name && affiliation;

    // Decide who owns website/socials before registering either side.
    let kjExtras = {}, companyExtras = {};
    const extras = {};
    if (host.website) extras.website = host.website;
    if (host.socials) extras.socials = host.socials;

    if (Object.keys(extras).length) {
        if (!hasBoth) {
            if (name) kjExtras = extras; else companyExtras = extras;
        } else {
            const owner = WEBSITE_OWNER[host.website];
            if (!owner) {
                report.ambiguous.push(
                    `${where}: "${name}" / "${affiliation}" carries ${host.website || 'socials'} — add it to WEBSITE_OWNER in migrate-hosts.js`);
            } else if (owner === 'kj') {
                kjExtras = extras;
            } else {
                companyExtras = extras;
            }
        }
    }

    const ref = {};
    if (name) ref.kjId = register(kjs, kjIdByName, name, kjExtras, 'kjs');
    if (affiliation) ref.companyId = register(companies, companyIdByName, affiliation, companyExtras, 'companies');
    return Object.keys(ref).length ? ref : null;
}

// ---- Rewrite listings ----
let venueHosts = 0, showHosts = 0;
for (const venue of data.listings) {
    if (venue.host) {
        const ref = toRef(venue.host, `${venue.id} (venue host)`);
        if (ref) { venue.host = ref; venueHosts++; }
    }
    for (const [i, entry] of (venue.schedule || []).entries()) {
        if (entry.host) {
            const ref = toRef(entry.host, `${venue.id} schedule[${i}]`);
            if (ref) { entry.host = ref; showHosts++; }
        }
    }
}

// Registries sit next to tagDefinitions, before listings — same shape the schema declares.
const migrated = {
    tagDefinitions: data.tagDefinitions,
    kjs: Object.fromEntries(Object.entries(kjs).sort(([a], [b]) => a.localeCompare(b))),
    companies: Object.fromEntries(Object.entries(companies).sort(([a], [b]) => a.localeCompare(b))),
    listings: data.listings,
};

// ---- Report ----
console.log('=== Host registry migration ===\n');
console.log(`Rewrote ${venueHosts} venue-level and ${showHosts} per-show hosts to refs.`);
console.log(`Registries: ${Object.keys(kjs).length} KJs, ${Object.keys(companies).length} companies.\n`);

if (report.ambiguous.length) {
    console.log('AMBIGUOUS — migration refused:');
    report.ambiguous.forEach(m => console.log('  ' + m));
    console.log('\nNothing written.');
    process.exit(1);
}

const section = (title, rows) => {
    if (!rows.length) return;
    console.log(`${title}:`);
    rows.forEach(r => console.log('  ' + r));
    console.log('');
};
section('Detail folded in during merge', [...report.kjMerges, ...report.companyMerges]);
section('CONFLICTS — first value kept, please review', report.conflicts);

console.log('KJs:');
for (const [id, e] of Object.entries(migrated.kjs)) {
    console.log(`  ${id.padEnd(28)} ${e.name}${e.website ? '  [website]' : ''}${e.socials ? '  [socials]' : ''}`);
}
console.log('\nCompanies:');
for (const [id, e] of Object.entries(migrated.companies)) {
    console.log(`  ${id.padEnd(28)} ${e.name}${e.website ? '  [website]' : ''}${e.socials ? '  [socials]' : ''}`);
}

const serialized = JSON.stringify(migrated, null, 2) + '\n';
fs.writeFileSync(OUT_PATH, usesCrlf ? serialized.replace(/\n/g, '\r\n') : serialized);
console.log(`\nWrote ${OUT_PATH}`);
if (OUT_PATH !== DATA_PATH) {
    console.log('Review it, then re-run with --apply to overwrite js/data.json.');
}
