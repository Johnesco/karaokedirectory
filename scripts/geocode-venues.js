/**
 * Geocode venues using multiple sources:
 * 1. US Census Geocoder (free, no API key)
 * 2. Google Maps URL parsing (fallback)
 *
 * Usage: node scripts/geocode-venues.js
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

// Census Geocoder endpoint
const CENSUS_API = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

// Delay between requests to be polite (ms)
const REQUEST_DELAY = 1000;

/**
 * Make an HTTPS request with redirect following
 */
function httpsGet(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        const makeRequest = (requestUrl, redirectsLeft) => {
            https.get(requestUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, (res) => {
                // Handle redirects
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    if (redirectsLeft <= 0) {
                        reject(new Error('Too many redirects'));
                        return;
                    }
                    let redirectUrl = res.headers.location;
                    // Handle relative URLs
                    if (redirectUrl.startsWith('/')) {
                        const urlObj = new URL(requestUrl);
                        redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
                    }
                    makeRequest(redirectUrl, redirectsLeft - 1);
                    return;
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data,
                        finalUrl: requestUrl
                    });
                });
            }).on('error', reject);
        };

        makeRequest(url, maxRedirects);
    });
}

/**
 * Geocode using Census API
 */
async function geocodeCensus(address) {
    const query = encodeURIComponent(address);
    const url = `${CENSUS_API}?address=${query}&benchmark=Public_AR_Current&format=json`;

    try {
        const response = await httpsGet(url);
        const json = JSON.parse(response.body);
        const matches = json.result?.addressMatches;

        if (matches && matches.length > 0) {
            const coords = matches[0].coordinates;
            return {
                lat: coords.y,
                lng: coords.x,
                source: 'census',
                matchedAddress: matches[0].matchedAddress
            };
        }
    } catch (e) {
        console.log(`    Census API error: ${e.message}`);
    }

    return null;
}

/**
 * Extract coordinates from Google Maps URL or page content
 * Looks for patterns like @30.2672,-97.7431 or !3d30.2672!4d-97.7431
 */
function extractCoordsFromGoogle(url, body) {
    // Try to find @lat,lng pattern in URL
    const urlMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (urlMatch) {
        return {
            lat: parseFloat(urlMatch[1]),
            lng: parseFloat(urlMatch[2])
        };
    }

    // Try to find !3d (lat) and !4d (lng) pattern in URL or body
    const text = url + ' ' + body;
    const latMatch = text.match(/!3d(-?\d+\.?\d*)/);
    const lngMatch = text.match(/!4d(-?\d+\.?\d*)/);
    if (latMatch && lngMatch) {
        return {
            lat: parseFloat(latMatch[1]),
            lng: parseFloat(lngMatch[1])
        };
    }

    // Try to find coordinates in JSON-like structures in the body
    // Google Maps embeds coords in various formats
    const jsonMatch = body.match(/\[(-?\d{1,3}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})\]/);
    if (jsonMatch) {
        const lat = parseFloat(jsonMatch[1]);
        const lng = parseFloat(jsonMatch[2]);
        // Sanity check - should be roughly in Texas area
        if (lat > 25 && lat < 37 && lng > -107 && lng < -93) {
            return { lat, lng };
        }
    }

    return null;
}

/**
 * Geocode using Google Maps search
 */
async function geocodeGoogle(address) {
    const query = encodeURIComponent(address);
    const url = `https://www.google.com/maps/search/${query}`;

    try {
        const response = await httpsGet(url, 10);

        // Try to extract coords from final URL or body
        const coords = extractCoordsFromGoogle(response.finalUrl, response.body);

        if (coords) {
            return {
                lat: coords.lat,
                lng: coords.lng,
                source: 'google',
                searchUrl: url
            };
        }
    } catch (e) {
        console.log(`    Google Maps error: ${e.message}`);
    }

    return null;
}

/**
 * Build full address string from venue
 */
function buildAddress(venue) {
    const addr = venue.address;
    if (!addr) return null;

    const street = addr.street || '';
    const city = addr.city || '';
    const state = addr.state || 'TX';
    const zip = addr.zip || '';

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

    // Extract the data object
    let data;
    try {
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
    const failedVenues = [];

    for (let i = 0; i < venues.length; i++) {
        const venue = venues[i];
        const name = venue.name;

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
        console.log(`    Address: ${address}`);

        // Try Census API first
        console.log('    Trying Census API...');
        let result = await geocodeCensus(address);

        // Fall back to Google Maps if Census fails
        if (!result) {
            console.log('    Census failed, trying Google Maps...');
            await sleep(REQUEST_DELAY); // Extra delay before Google
            result = await geocodeGoogle(address);
        }

        if (result) {
            venue.coordinates = {
                lat: result.lat,
                lng: result.lng
            };
            console.log(`    SUCCESS (${result.source}): ${result.lat}, ${result.lng}`);
            if (result.matchedAddress) {
                console.log(`    Matched: ${result.matchedAddress}`);
            }
            geocoded++;
        } else {
            console.log(`    FAILED: Could not geocode`);
            console.log(`    Manual: https://www.google.com/maps/search/${encodeURIComponent(address)}`);
            failedVenues.push({ name, address });
            failed++;
        }

        // Wait between requests
        if (i < venues.length - 1) {
            await sleep(REQUEST_DELAY);
        }
    }

    console.log('\n--- Summary ---');
    console.log(`Geocoded: ${geocoded}`);
    console.log(`Failed: ${failed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Total: ${venues.length}`);

    // Show failed venues with manual lookup links
    if (failedVenues.length > 0) {
        console.log('\n--- Failed Venues (manual lookup needed) ---');
        failedVenues.forEach(v => {
            console.log(`\n${v.name}`);
            console.log(`  https://www.google.com/maps/search/${encodeURIComponent(v.address)}`);
        });
    }

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
