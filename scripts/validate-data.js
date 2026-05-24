#!/usr/bin/env node
/**
 * Validate js/data.js — catches structural issues, schema violations,
 * and the data-quality patterns from #41 (empty strings, wrong day
 * casing, invalid tags, implausible times). Exits non-zero on failure
 * so the script is suitable as a pre-commit / CI gate.
 */

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
console.log('Reading:', dataPath);

const content = fs.readFileSync(dataPath, 'utf8');

const match = content.match(/const\s+karaokeData\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
if (!match) {
    console.log('ERROR: Could not extract JSON from data.js');
    process.exit(1);
}

let data;
try {
    data = JSON.parse(match[1]);
    console.log('JSON is valid!\n');
} catch (e) {
    console.log('JSON PARSE ERROR:', e.message);
    const posMatch = e.message.match(/position (\d+)/);
    if (posMatch) {
        const pos = parseInt(posMatch[1]);
        const lines = match[1].substring(0, pos).split('\n');
        console.log('Approximate line in JSON:', lines.length);
        console.log('Context:', match[1].substring(pos - 30, pos + 30));
    }
    process.exit(1);
}

// --- Canonical vocabularies ---
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const VALID_FREQUENCIES = ['every', 'first', 'second', 'third', 'fourth', 'fifth', 'last', 'once'];
const VALID_TAGS = Object.keys(data.tagDefinitions || {});

// Fields that, when present on a populated object, must not be empty strings.
// Empty strings should be either omitted or set to null.
const NO_EMPTY_STRING_FIELDS = [
    ['host', 'name'],
    ['host', 'company'],
    ['host', 'website'],
    ['address', 'neighborhood'],
    ['activePeriod', 'start'],
    ['activePeriod', 'end'],
];

const issues = [];
function fail(venue, msg) {
    issues.push(`${venue.name || `index ?`} (${venue.id || '?'}): ${msg}`);
}

// --- Per-venue checks ---
const idCounts = {};
for (const venue of data.listings) {
    const name = venue.name || `index ${data.listings.indexOf(venue)}`;

    // Required fields
    if (!venue.id) fail(venue, 'missing id');
    if (!venue.name) fail(venue, 'missing name');
    if (!venue.address) fail(venue, 'missing address');
    if (!venue.schedule || venue.schedule.length === 0) fail(venue, 'missing schedule');

    // ID uniqueness
    if (venue.id) idCounts[venue.id] = (idCounts[venue.id] || 0) + 1;

    // Coordinates type
    if (venue.coordinates) {
        if (typeof venue.coordinates.lat !== 'number') fail(venue, 'coordinates.lat not a number');
        if (typeof venue.coordinates.lng !== 'number') fail(venue, 'coordinates.lng not a number');
    }

    // Empty-string fields (should be omitted instead)
    for (const [parent, child] of NO_EMPTY_STRING_FIELDS) {
        const v = venue[parent]?.[child];
        if (v === '') fail(venue, `${parent}.${child} is an empty string — omit the field instead`);
    }

    // Empty socials object {}
    if (venue.socials && typeof venue.socials === 'object' && Object.keys(venue.socials).length === 0) {
        fail(venue, 'socials is an empty {} — omit the field instead');
    }

    // Tags must be in the registry
    if (Array.isArray(venue.tags)) {
        for (const tag of venue.tags) {
            if (!VALID_TAGS.includes(tag)) {
                fail(venue, `tag "${tag}" is not defined in tagDefinitions`);
            }
        }
    }

    // Schedule entry checks
    if (Array.isArray(venue.schedule)) {
        venue.schedule.forEach((entry, i) => {
            const prefix = `schedule[${i}]`;

            if (entry.frequency && !VALID_FREQUENCIES.includes(entry.frequency)) {
                fail(venue, `${prefix} frequency "${entry.frequency}" is not in [${VALID_FREQUENCIES.join(', ')}]`);
            }

            // Day name casing — must match WEEKDAY_NAMES exactly (data convention)
            // 'once' events skip the day field
            if (entry.frequency !== 'once' && entry.day && !WEEKDAY_NAMES.includes(entry.day)) {
                fail(venue, `${prefix} day "${entry.day}" must be one of ${WEEKDAY_NAMES.join(', ')} (case-sensitive)`);
            }

            // Time format HH:MM
            const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
            if (entry.startTime && !timeRe.test(entry.startTime)) {
                fail(venue, `${prefix} startTime "${entry.startTime}" not in HH:MM`);
            }
            if (entry.endTime && entry.endTime !== '' && !timeRe.test(entry.endTime)) {
                fail(venue, `${prefix} endTime "${entry.endTime}" not in HH:MM`);
            }

            // Implausible :03 / :07 etc — typos like "17:03" instead of "17:00"
            // Flag start times whose minutes are not 00, 15, 30, or 45.
            if (entry.startTime && timeRe.test(entry.startTime)) {
                const mins = entry.startTime.slice(3);
                const ROUND = ['00', '15', '30', '45'];
                if (!ROUND.includes(mins)) {
                    fail(venue, `${prefix} startTime "${entry.startTime}" has an unusual minute — typo? expected :00/:15/:30/:45`);
                }
            }

            // Implausible noon endTime for an evening event (Maggie Mae's case)
            // Karaoke "ending at noon" is almost certainly a typo for "midnight" or PM hour.
            // Flag endTime of "12:00" when startTime is >= 14:00 (post-2pm start).
            if (entry.endTime === '12:00' && entry.startTime) {
                const startH = parseInt(entry.startTime.slice(0, 2), 10);
                if (startH >= 14) {
                    fail(venue, `${prefix} endTime "12:00" (noon) for a ${entry.startTime} start — likely typo`);
                }
            }

            // Per-show host (multi-host venues) — same empty-string rules as venue-level host
            if (entry.host) {
                for (const f of ['name', 'company', 'website']) {
                    if (entry.host[f] === '') fail(venue, `${prefix} host.${f} is an empty string — omit the field instead`);
                }
            }
        });
    }
}

// Duplicate IDs
for (const [id, count] of Object.entries(idCounts)) {
    if (count > 1) issues.push(`Duplicate ID: ${id} (${count} times)`);
}

// --- Output ---
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

// Data quality (informational, not failure)
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

// Exit non-zero if any structural / schema / data-quality issue
if (issues.length > 0) {
    console.log('\nValidation FAILED. Fix the issues above (#41 tracks the known ones).');
    process.exit(1);
}
