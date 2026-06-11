#!/usr/bin/env node
/**
 * Validate js/data.json against schema/venue.schema.json (via Ajv) plus the
 * supplementary checks JSON Schema cannot express: cross-row constraints
 * (unique venue ids, tag-id cross-reference) and data-quality heuristics
 * (minute-typo detection, noon end-time after evening start).
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
const DATA_PATH = path.join(ROOT, 'js', 'data.json');

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

function fail(venue, msg) {
    issues.push(`${venue.name || 'index ?'} (${venue.id || '?'}): ${msg}`);
}

const idCounts = {};
for (const venue of data.listings) {
    if (venue.id) idCounts[venue.id] = (idCounts[venue.id] || 0) + 1;

    // Tag cross-reference: every tag id must exist in tagDefinitions
    if (Array.isArray(venue.tags)) {
        for (const tag of venue.tags) {
            if (!VALID_TAGS.includes(tag)) {
                fail(venue, `tag "${tag}" is not defined in tagDefinitions`);
            }
        }
    }

    if (Array.isArray(venue.schedule)) {
        venue.schedule.forEach((entry, i) => {
            const prefix = `schedule[${i}]`;

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

// ---- Output ----
console.log('=== Summary ===');
console.log('Total venues:', data.listings.length);
const withCoords = data.listings.filter(v => v.coordinates?.lat && v.coordinates?.lng).length;
console.log('With coordinates:', withCoords);

if (issues.length > 0) {
    console.log(`\n=== ${issues.length} Issue(s) Found ===`);
    issues.forEach(issue => console.log('- ' + issue));
} else {
    console.log('\nNo issues found!');
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
