/**
 * Data Migration Script
 * Converts old venue data format to new schema
 *
 * Run in browser console or Node.js to generate new data.js
 *
 * Usage:
 *   1. Open the current site in browser
 *   2. Paste this script in console
 *   3. Copy the output and save to js/data.js
 */

/**
 * Parse time string like "9:00 PM - 12:00 AM" into 24-hour format
 * @param {string} timeStr - Time string
 * @returns {{ startTime: string, endTime: string|null }}
 */
function parseTimeRange(timeStr) {
    if (!timeStr) return { startTime: '21:00', endTime: null };

    // Normalize the string
    const normalized = timeStr
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .replace(/(\d)(AM|PM)/gi, '$1 $2')
        .trim();

    // Handle special cases
    if (normalized.includes('CLOSE') || normalized.includes('???')) {
        const startMatch = normalized.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)/i);
        if (startMatch) {
            return {
                startTime: convertTo24Hour(startMatch[1], startMatch[2] || '00', startMatch[3]),
                endTime: null
            };
        }
    }

    if (normalized.includes('MIDNIGHT')) {
        const parts = normalized.split(/\s*[-–to]+\s*/i);
        const startMatch = parts[0].match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)/i);
        if (startMatch) {
            return {
                startTime: convertTo24Hour(startMatch[1], startMatch[2] || '00', startMatch[3]),
                endTime: '00:00'
            };
        }
    }

    // Standard format: "9:00 PM - 12:00 AM"
    const parts = normalized.split(/\s*[-–to]+\s*/i);
    if (parts.length >= 2) {
        const startMatch = parts[0].match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
        const endMatch = parts[1].match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);

        if (startMatch && endMatch) {
            // If start doesn't have AM/PM, infer from end
            const startPeriod = startMatch[3] || endMatch[3] || 'PM';
            const endPeriod = endMatch[3] || 'AM';

            return {
                startTime: convertTo24Hour(startMatch[1], startMatch[2] || '00', startPeriod),
                endTime: convertTo24Hour(endMatch[1], endMatch[2] || '00', endPeriod)
            };
        }
    }

    // Fallback
    console.warn(`Could not parse time: "${timeStr}"`);
    return { startTime: '21:00', endTime: null };
}

/**
 * Convert 12-hour time to 24-hour format
 */
function convertTo24Hour(hours, minutes, period) {
    let h = parseInt(hours, 10);
    const m = minutes || '00';

    if (period && period.toUpperCase() === 'PM' && h !== 12) {
        h += 12;
    } else if (period && period.toUpperCase() === 'AM' && h === 12) {
        h = 0;
    }

    return `${h.toString().padStart(2, '0')}:${m}`;
}

/**
 * Convert old schedule format to new format
 */
function migrateSchedule(oldSchedule) {
    if (!oldSchedule || !Array.isArray(oldSchedule)) return [];

    return oldSchedule.map(entry => {
        // Old format: { day: ["every", "Wednesday"], time: "9:00 PM - 12:00 AM" }
        // New format: { frequency: "every", day: "wednesday", startTime: "21:00", endTime: "00:00" }

        let frequency = 'every';
        let day = 'monday';

        if (Array.isArray(entry.day) && entry.day.length >= 2) {
            frequency = entry.day[0].toLowerCase();
            day = entry.day[1].toLowerCase();
        } else if (typeof entry.day === 'string') {
            day = entry.day.toLowerCase();
        }

        const { startTime, endTime } = parseTimeRange(entry.time);

        const migrated = {
            frequency,
            day,
            startTime,
            endTime
        };

        // Preserve description/note if present
        if (entry.description) {
            migrated.note = entry.description;
        }

        return migrated;
    });
}

/**
 * Convert old socials format (remove nulls, lowercase keys)
 */
function migrateSocials(oldSocials) {
    if (!oldSocials || typeof oldSocials !== 'object') return {};

    const result = {};
    for (const [key, value] of Object.entries(oldSocials)) {
        if (value && value.trim && value.trim()) {
            result[key.toLowerCase()] = value.trim();
        }
    }
    return result;
}

/**
 * Convert old host/KJ format
 */
function migrateHost(oldKJ) {
    if (!oldKJ) return null;

    const hasData = oldKJ.Host || oldKJ.Company || oldKJ.Website || oldKJ.KJsocials;
    if (!hasData) return null;

    const host = {};

    if (oldKJ.Host && oldKJ.Host.trim()) {
        host.name = oldKJ.Host.trim();
    }
    if (oldKJ.Company && oldKJ.Company.trim()) {
        host.company = oldKJ.Company.trim();
    }
    if (oldKJ.Website && oldKJ.Website.trim()) {
        host.website = oldKJ.Website.trim();
    }
    if (oldKJ.KJsocials) {
        const socials = migrateSocials(oldKJ.KJsocials);
        if (Object.keys(socials).length > 0) {
            host.socials = socials;
        }
    }

    return Object.keys(host).length > 0 ? host : null;
}

/**
 * Migrate a single venue
 */
function migrateVenue(oldVenue) {
    const venue = {
        // Core (required)
        id: oldVenue.id,
        name: oldVenue.VenueName,
        active: true,

        // Location (required)
        address: {
            street: oldVenue.Address?.Street?.trim() || '',
            city: oldVenue.Address?.City?.trim() || '',
            state: oldVenue.Address?.State?.trim() || 'TX',
            zip: oldVenue.Address?.Zip?.trim() || '',
            neighborhood: ''  // To be filled in manually
        },

        // Coordinates (for map view - to be filled in manually)
        coordinates: null,

        // Schedule
        schedule: migrateSchedule(oldVenue.schedule)
    };

    // Optional fields - only include if present
    if (oldVenue.Dedicated !== undefined) {
        venue.dedicated = Boolean(oldVenue.Dedicated);
    }

    // Host info
    const host = migrateHost(oldVenue.KJ);
    if (host) {
        venue.host = host;
    }

    // Socials
    const socials = migrateSocials(oldVenue.socials);
    if (Object.keys(socials).length > 0) {
        venue.socials = socials;
    }

    // Date range (for temporary venues)
    if (oldVenue.Timeframe) {
        if (oldVenue.Timeframe.StartDate || oldVenue.Timeframe.EndDate) {
            venue.dateRange = {};
            if (oldVenue.Timeframe.StartDate) {
                venue.dateRange.start = oldVenue.Timeframe.StartDate;
            }
            if (oldVenue.Timeframe.EndDate) {
                venue.dateRange.end = oldVenue.Timeframe.EndDate;
            }
        }
    }

    // ShowName or EventName
    if (oldVenue.KJ?.ShowName) {
        venue.eventName = oldVenue.KJ.ShowName;
    } else if (oldVenue.KJ?.EventName) {
        venue.eventName = oldVenue.KJ.EventName;
    }

    // Metadata
    venue.lastVerified = null;

    return venue;
}

/**
 * Migrate entire dataset
 */
function migrateData(oldData) {
    const today = new Date().toISOString().split('T')[0];

    return {
        version: '2.0',
        lastUpdated: today,
        listings: oldData.listings.map(migrateVenue)
    };
}

/**
 * Run migration and output result
 */
function runMigration() {
    // Check if karaokeData exists (browser) or import it (Node)
    if (typeof karaokeData === 'undefined') {
        console.error('karaokeData not found. Make sure to load data.js first.');
        return;
    }

    const migrated = migrateData(karaokeData);

    // Output as JavaScript module
    const output = `/**
 * Austin Karaoke Directory - Venue Data
 * Schema Version: ${migrated.version}
 * Last Updated: ${migrated.lastUpdated}
 */

export const karaokeData = ${JSON.stringify(migrated, null, 2)};

export default karaokeData;
`;

    console.log('=== MIGRATION COMPLETE ===');
    console.log(`Migrated ${migrated.listings.length} venues`);
    console.log('Copy the output below to js/data.js:\n');
    console.log(output);

    return migrated;
}

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { migrateData, migrateVenue, runMigration };
}

// Auto-run if karaokeData is available
if (typeof karaokeData !== 'undefined') {
    runMigration();
}
