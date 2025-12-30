/**
 * Geocode venues using the free US Census Geocoder
 * No API key required
 *
 * Usage: node scripts/geocode-venues.js
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

// Census Geocoder endpoint
const CENSUS_API = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

// Delay between requests to be polite (ms)
const REQUEST_DELAY = 500;

/**
 * Geocode a single address using Census API
 */
function geocodeAddress(address) {
    return new Promise((resolve, reject) => {
        const query = encodeURIComponent(address);
        const url = `${CENSUS_API}?address=${query}&benchmark=Public_AR_Current&format=json`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const matches = json.result?.addressMatches;

                    if (matches && matches.length > 0) {
                        const coords = matches[0].coordinates;
                        resolve({
                            lat: coords.y,
                            lng: coords.x,
                            matchedAddress: matches[0].matchedAddress
                        });
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

/**
 * Build full address string from venue
 */
function buildAddress(venue) {
    // Handle both legacy and new format
    const addr = venue.Address || venue.address;
    if (!addr) return null;

    const street = addr.Street || addr.street || '';
    const city = addr.City || addr.city || '';
    const state = addr.State || addr.state || 'TX';
    const zip = addr.Zip || addr.zip || '';

    return `${street}, ${city}, ${state} ${zip}`.trim();
}

/**
 * Sleep for ms milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main function
 */
async function main() {
    // Read data.js
    const dataPath = path.join(__dirname, '..', 'js', 'data.js');
    console.log('Reading:', dataPath);

    let content = fs.readFileSync(dataPath, 'utf8');

    // Extract the data object (handle both formats)
    let data;
    try {
        // Try to extract JSON from the file
        const match = content.match(/const\s+karaokeData\s*=\s*(\{[\s\S]*\});?\s*$/);
        if (match) {
            data = JSON.parse(match[1]);
        } else {
            throw new Error('Could not parse data.js');
        }
    } catch (e) {
        console.error('Error parsing data.js:', e.message);
        process.exit(1);
    }

    const venues = data.listings;
    console.log(`Found ${venues.length} venues\n`);

    let geocoded = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < venues.length; i++) {
        const venue = venues[i];
        const name = venue.VenueName || venue.name;

        // Check if already has coordinates
        if (venue.coordinates?.lat && venue.coordinates?.lng) {
            console.log(`[${i + 1}/${venues.length}] SKIP: ${name} (already has coordinates)`);
            skipped++;
            continue;
        }

        const address = buildAddress(venue);
        if (!address) {
            console.log(`[${i + 1}/${venues.length}] SKIP: ${name} (no address)`);
            skipped++;
            continue;
        }

        console.log(`[${i + 1}/${venues.length}] Geocoding: ${name}`);
        console.log(`  Address: ${address}`);

        try {
            const result = await geocodeAddress(address);

            if (result) {
                venue.coordinates = {
                    lat: result.lat,
                    lng: result.lng
                };
                console.log(`  SUCCESS: ${result.lat}, ${result.lng}`);
                console.log(`  Matched: ${result.matchedAddress}`);
                geocoded++;
            } else {
                console.log(`  FAILED: No match found`);
                failed++;
            }
        } catch (e) {
            console.log(`  ERROR: ${e.message}`);
            failed++;
        }

        // Be polite - wait between requests
        if (i < venues.length - 1) {
            await sleep(REQUEST_DELAY);
        }
    }

    console.log('\n--- Summary ---');
    console.log(`Geocoded: ${geocoded}`);
    console.log(`Failed: ${failed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Total: ${venues.length}`);

    // Write back to data.js
    if (geocoded > 0) {
        const newContent = `const karaokeData = ${JSON.stringify(data, null, 2)};\n`;

        // Backup original
        const backupPath = dataPath + '.backup';
        fs.writeFileSync(backupPath, content);
        console.log(`\nBackup saved to: ${backupPath}`);

        // Write new data
        fs.writeFileSync(dataPath, newContent);
        console.log(`Updated: ${dataPath}`);
    } else {
        console.log('\nNo changes made.');
    }
}

main().catch(console.error);
