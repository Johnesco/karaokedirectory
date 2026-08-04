#!/usr/bin/env node
/**
 * Validate js/data.json against schema/venue.schema.json (via Ajv) plus the
 * supplementary checks JSON Schema cannot express: cross-row constraints
 * (unique venue ids, tag-id and host-ref cross-reference) and data-quality
 * heuristics (minute-typo detection, noon end-time after evening start).
 *
 * Registry hygiene (unreferenced or same-named kjs/companies entries) and
 * stale venues (active, but every event is in the past) are reported as
 * warnings — worth a look, but not a build failure.
 *
 * Exits non-zero on failure — suitable as a pre-commit / CI gate. Enforced
 * by .github/workflows/ci.yml.
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'schema', 'venue.schema.json');
// Defaults to the canonical data file; an explicit path lets the migration
// script validate a candidate file before it overwrites anything.
const DATA_PATH = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(ROOT, 'js', 'data.json');

console.log('Reading:', DATA_PATH);

const src = fs.readFileSync(DATA_PATH, 'utf-8');

let data;
try {
    data = JSON.parse(src);
} catch (e) {
    console.log('JSON PARSE ERROR:', e.message);
    const posMatch = e.message.match(/position (\d+)/);
    if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const lines = src.substring(0, pos).split('\n');
        console.log('Approximate line in JSON:', lines.length);
        console.log('Context:', src.substring(pos - 30, pos + 30));
    }
    process.exit(1);
}
console.log('JSON is valid!\n');

// ---- Schema validation (Ajv) ----
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
const schemaOk = validate(data);

const issues = [];
const warnings = [];

function venueLabel(idx) {
    const v = data.listings[idx];
    return v?.name ? `${v.name} (${v.id || '?'})` : `index ${idx}`;
}

function fmtSchemaError(e) {
    const m = (e.instancePath || '').match(/^\/listings\/(\d+)(.*)$/);
    if (m) {
        const rest = m[2] || '';
        return `${venueLabel(+m[1])}${rest} — ${e.message}`;
    }
    return `${e.instancePath || '(root)'} — ${e.message}`;
}

if (!schemaOk) {
    for (const e of validate.errors) issues.push(fmtSchemaError(e));
}

// ---- Supplementary checks ----
const VALID_TAGS = Object.keys(data.tagDefinitions || {});
const KJS = data.kjs || {};
const COMPANIES = data.companies || {};

// Registry ids actually pointed at by a host, so unused entries can be reported.
const referenced = { kjs: new Set(), companies: new Set() };

function fail(venue, msg) {
    issues.push(`${venue.name || 'index ?'} (${venue.id || '?'}): ${msg}`);
}

/**
 * Host ref cross-reference: kjId/companyId must resolve in the registries —
 * the same class of check as tag ids against tagDefinitions (ADR-007). Legacy
 * inline hosts carry neither id and are skipped.
 */
function checkHostRef(venue, host, where) {
    for (const [key, registry, label] of [
        ['kjId', KJS, 'kjs'],
        ['companyId', COMPANIES, 'companies'],
    ]) {
        const id = host?.[key];
        if (!id) continue;
        referenced[label].add(id);
        if (!(id in registry)) {
            fail(venue, `${where} ${key} "${id}" is not defined in ${label}`);
        }
    }
}

// Generous box around the Austin metro. Every venue in the directory sits well
// inside it; the point is to catch a sign flip or a wrong-city geocode, not to
// police the edges of the service area.
const AUSTIN_BOX = { minLat: 29.0, maxLat: 31.5, minLng: -99.0, maxLng: -96.5 };

/**
 * Nearest tag id by edit distance, for the "did you mean" hint. Returns null
 * when nothing is close enough to be a plausible typo — suggesting a wildly
 * different tag is worse than suggesting nothing.
 */
function findClosestTag(input) {
    const lower = String(input).toLowerCase();
    let best = null;
    let bestDist = Infinity;
    for (const tag of VALID_TAGS) {
        const dist = levenshtein(lower, tag.toLowerCase());
        if (dist < bestDist) {
            bestDist = dist;
            best = tag;
        }
    }
    return bestDist <= Math.max(2, Math.ceil(lower.length / 3)) ? best : null;
}

function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
            );
        }
    }
    return dp[m][n];
}

const idCounts = {};
for (const venue of data.listings) {
    if (venue.id) idCounts[venue.id] = (idCounts[venue.id] || 0) + 1;

    // Tag cross-reference: every tag id must exist in tagDefinitions.
    // The nearest-match hint is a real curator affordance — a mistyped tag is
    // almost always one edit away from a valid one.
    if (Array.isArray(venue.tags)) {
        for (const tag of venue.tags) {
            if (!VALID_TAGS.includes(tag)) {
                const suggestion = findClosestTag(tag);
                fail(venue, `tag "${tag}" is not defined in tagDefinitions` +
                    (suggestion ? ` — did you mean "${suggestion}"?` : ''));
            }
        }
    }

    // Coordinate sanity. The frame is fixed at Austin-metro, so anything well
    // outside it is a transposed sign or a bad geocode (see #127, where a venue
    // landed 200 miles west). A warning, not a failure — the box is generous
    // and a legitimate outlying venue should not break the build.
    if (venue.coordinates) {
        const { lat, lng } = venue.coordinates;
        if (typeof lat === 'number' && typeof lng === 'number') {
            if (lat < AUSTIN_BOX.minLat || lat > AUSTIN_BOX.maxLat) {
                warnings.push(`${venue.name} (${venue.id}): latitude ${lat} is outside the Austin-metro box`);
            }
            if (lng < AUSTIN_BOX.minLng || lng > AUSTIN_BOX.maxLng) {
                warnings.push(`${venue.name} (${venue.id}): longitude ${lng} is outside the Austin-metro box`);
            }
        }
    }

    // NOTE: audit-for-supabase.js also warned on socials URLs without an http
    // scheme. Not ported — schema/venue.schema.json types every URL field with
    // `format: "uri"`, so Ajv already rejects them as hard errors. Verified
    // against a planted `instagram.com/nope`. Re-adding it as a warning would
    // duplicate a stronger check with a weaker one.

    checkHostRef(venue, venue.host, 'host');

    if (Array.isArray(venue.schedule)) {
        venue.schedule.forEach((entry, i) => {
            const prefix = `schedule[${i}]`;
            checkHostRef(venue, entry.host, `${prefix}.host`);

            // Minute-typo heuristic — start times should land on :00/:15/:30/:45.
            // Catches things like 17:03 that should have been 17:00.
            if (entry.startTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.startTime)) {
                const mins = entry.startTime.slice(3);
                if (!['00', '15', '30', '45'].includes(mins)) {
                    fail(venue, `${prefix} startTime "${entry.startTime}" has an unusual minute — typo? expected :00/:15/:30/:45`);
                }
            }

            // Karaoke "ending at noon" after an evening start is almost certainly
            // a typo for midnight or a PM hour (Maggie Mae's case from #41).
            if (entry.endTime === '12:00' && entry.startTime) {
                const startH = parseInt(entry.startTime.slice(0, 2), 10);
                if (startH >= 14) {
                    fail(venue, `${prefix} endTime "12:00" (noon) for a ${entry.startTime} start — likely typo`);
                }
            }
        });
    }
}

for (const [id, count] of Object.entries(idCounts)) {
    if (count > 1) issues.push(`Duplicate ID: ${id} (${count} times)`);
}

// ---- Registry hygiene (warnings — bad smells, not broken data) ----
// An unreferenced entry is dead weight; two entries with the same name are the
// duplication ADR-007 exists to remove, creeping back in.
for (const [label, registry] of [['kjs', KJS], ['companies', COMPANIES]]) {
    const namesSeen = new Map();

    for (const [id, entry] of Object.entries(registry)) {
        if (!referenced[label].has(id)) {
            warnings.push(`${label}["${id}"] (${entry.name}) is never referenced by a host`);
        }

        const key = (entry.name || '').trim().toLowerCase();
        if (!key) continue;
        if (!namesSeen.has(key)) namesSeen.set(key, []);
        namesSeen.get(key).push(id);
    }

    for (const [, ids] of namesSeen) {
        if (ids.length > 1) {
            warnings.push(`${label} entries share the name "${registry[ids[0]].name}": ${ids.join(', ')} — merge?`);
        }
    }
}

// ---- Stale venue check (#135) ----
// An active venue whose events are all in the past has nothing to advertise, but
// still renders a marker on the map and a card in the A-Z listing. Warned rather
// than failed: the fix needs real-world knowledge (did they stop hosting, or is
// our data just behind?), and only the curator can tell those apart.
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

for (const venue of data.listings) {
    if (venue.active === false) continue;
    const schedule = Array.isArray(venue.schedule) ? venue.schedule : [];

    const hasRecurring = schedule.some(e => e.frequency !== 'once');
    const hasUpcoming = schedule.some(e => {
        if (e.frequency !== 'once' || !e.date) return false;
        return new Date(e.date + 'T00:00:00') >= TODAY;
    });
    if (hasRecurring || hasUpcoming) continue;

    const lastDate = schedule.map(e => e.date).filter(Boolean).sort().pop();
    warnings.push(
        `${venue.name} (${venue.id}) is active but has no upcoming events` +
        (lastDate ? ` — most recent was ${lastDate}` : ' — no dated entries at all')
    );
}

// ---- Spent one-time events (#169) ----
// `once` does not mean "happens only once" — it means the date is not on a
// predictable cadence, so it has to be listed explicitly. A venue or KJ may
// legitimately carry many, and this check says nothing about how many there are.
//
// It reports individual rows whose date has passed: those can never match again
// and only pad the schedule table with history. Thirty days is the grace period
// — long enough not to nag about last weekend, short enough that a year-old row
// gets noticed.
//
// Warned, not failed: deleting rows is curation, and only the curator knows
// whether a past date is finished or about to be rescheduled (#135).
const STALE_ONCE_DAYS = 30;
const staleCutoff = new Date(TODAY);
staleCutoff.setDate(staleCutoff.getDate() - STALE_ONCE_DAYS);

for (const venue of data.listings) {
    for (const entry of venue.schedule || []) {
        if (entry.frequency !== 'once' || !entry.date) continue;
        if (new Date(entry.date + 'T00:00:00') >= staleCutoff) continue;
        warnings.push(
            `${venue.name} (${venue.id}) has a spent one-time event on ${entry.date}` +
            (entry.eventName ? ` ("${entry.eventName}")` : '') +
            ` — more than ${STALE_ONCE_DAYS} days past and can never match again`
        );
    }
}

// ---- Output ----
console.log('=== Summary ===');
console.log('Total venues:', data.listings.length);
const withCoords = data.listings.filter(v => v.coordinates?.lat && v.coordinates?.lng).length;
console.log('With coordinates:', withCoords);

const kjCount = Object.keys(KJS).length;
const companyCount = Object.keys(COMPANIES).length;
if (kjCount || companyCount) {
    console.log('Registered KJs:', kjCount);
    console.log('Registered companies:', companyCount);
}

if (issues.length > 0) {
    console.log(`\n=== ${issues.length} Issue(s) Found ===`);
    issues.forEach(issue => console.log('- ' + issue));
} else {
    console.log('\nNo issues found!');
}

if (warnings.length > 0) {
    console.log(`\n=== ${warnings.length} Warning(s) — not fatal ===`);
    warnings.forEach(warning => console.log('- ' + warning));
}

console.log('\n=== Data Quality (informational) ===');

const names = data.listings.map(v => v.name);
const dupeNames = names.filter((n, i) => names.indexOf(n) !== i);
if (dupeNames.length > 0) {
    console.log('Duplicate venue names:', [...new Set(dupeNames)].join(', '));
} else {
    console.log('No duplicate venue names');
}

const cities = [...new Set(data.listings.map(v => v.address?.city))].sort();
console.log('Cities covered:', cities.length);

const lats = data.listings.map(v => v.coordinates?.lat).filter(Boolean);
const lngs = data.listings.map(v => v.coordinates?.lng).filter(Boolean);
if (lats.length > 0) {
    console.log('Lat range:', Math.min(...lats).toFixed(3), 'to', Math.max(...lats).toFixed(3));
    console.log('Lng range:', Math.min(...lngs).toFixed(3), 'to', Math.max(...lngs).toFixed(3));
}

if (issues.length > 0) {
    console.log('\nValidation FAILED. Fix the issues above.');
    process.exit(1);
}
