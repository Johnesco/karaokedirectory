/**
 * Validate data.js JSON structure
 */

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
console.log('Reading:', dataPath);

const content = fs.readFileSync(dataPath, 'utf8');

// Extract JSON - handle trailing semicolon
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

    // Find approximate line
    const posMatch = e.message.match(/position (\d+)/);
    if (posMatch) {
        const pos = parseInt(posMatch[1]);
        const lines = match[1].substring(0, pos).split('\n');
        console.log('Approximate line in JSON:', lines.length);
        console.log('Context:', match[1].substring(pos - 30, pos + 30));
    }
    process.exit(1);
}

// Validate structure
console.log('=== Summary ===');
console.log('Total venues:', data.listings.length);

const withCoords = data.listings.filter(v => v.coordinates?.lat && v.coordinates?.lng).length;
console.log('With coordinates:', withCoords);

// Check for issues
let issues = [];

data.listings.forEach((venue, i) => {
    const name = venue.VenueName || venue.name || `index ${i}`;

    // Required fields
    if (!venue.id) issues.push(`${name}: missing id`);
    if (!venue.VenueName && !venue.name) issues.push(`${name}: missing name`);
    if (!venue.Address && !venue.address) issues.push(`${name}: missing address`);
    if (!venue.schedule || venue.schedule.length === 0) issues.push(`${name}: missing schedule`);

    // Check for duplicate IDs
    const dupes = data.listings.filter(v => v.id === venue.id);
    if (dupes.length > 1 && i === data.listings.findIndex(v => v.id === venue.id)) {
        issues.push(`Duplicate ID: ${venue.id} (${dupes.length} times)`);
    }

    // Check coordinates format
    if (venue.coordinates) {
        if (typeof venue.coordinates.lat !== 'number') {
            issues.push(`${name}: coordinates.lat is not a number`);
        }
        if (typeof venue.coordinates.lng !== 'number') {
            issues.push(`${name}: coordinates.lng is not a number`);
        }
    }
});

if (issues.length > 0) {
    console.log('\n=== Issues Found ===');
    issues.forEach(issue => console.log('-', issue));
} else {
    console.log('\nNo issues found!');
}

// Data quality checks
console.log('\n=== Data Quality ===');

// Duplicate names
const names = data.listings.map(v => v.VenueName);
const dupeNames = names.filter((n, i) => names.indexOf(n) !== i);
if (dupeNames.length > 0) {
    console.log('Duplicate venue names:', [...new Set(dupeNames)].join(', '));
} else {
    console.log('No duplicate venue names');
}

// Cities
const cities = [...new Set(data.listings.map(v => v.Address?.City))].sort();
console.log('Cities covered:', cities.length);
console.log(' ', cities.join(', '));

// Coordinate bounds (Austin area check)
const lats = data.listings.map(v => v.coordinates?.lat).filter(Boolean);
const lngs = data.listings.map(v => v.coordinates?.lng).filter(Boolean);
console.log('\nCoordinate bounds:');
console.log('  Lat range:', Math.min(...lats).toFixed(3), 'to', Math.max(...lats).toFixed(3));
console.log('  Lng range:', Math.min(...lngs).toFixed(3), 'to', Math.max(...lngs).toFixed(3));
