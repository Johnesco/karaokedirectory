/**
 * Venue data service
 * Handles loading, filtering, sorting, and querying venue data
 */

import { scheduleMatchesDate, isDateInRange } from '../utils/date.js';
import { getSortableName, containsIgnoreCase } from '../utils/string.js';

let venues = [];
let isLegacyFormat = false;

/**
 * Initialize venues from data
 * Supports both legacy and new formats
 * @param {Object} data - Karaoke data object
 */
export function initVenues(data) {
    if (!data || !data.listings) {
        console.error('Invalid venue data');
        venues = [];
        return;
    }

    // Detect format version
    isLegacyFormat = !data.version;

    if (isLegacyFormat) {
        // Convert legacy format on the fly
        venues = data.listings.map(normalizeLegacyVenue);
    } else {
        venues = data.listings;
    }

    console.log(`Loaded ${venues.length} venues (format: ${isLegacyFormat ? 'legacy' : 'v' + data.version})`);
}

/**
 * Normalize legacy venue format to new format
 */
function normalizeLegacyVenue(old) {
    return {
        id: old.id,
        name: old.VenueName,
        active: true,
        dedicated: old.Dedicated || false,
        address: {
            street: old.Address?.Street || '',
            city: old.Address?.City || '',
            state: old.Address?.State || 'TX',
            zip: old.Address?.Zip || '',
            neighborhood: ''
        },
        coordinates: null,
        schedule: normalizeLegacySchedule(old.schedule),
        host: normalizeLegacyHost(old.KJ),
        socials: normalizeLegacySocials(old.socials),
        dateRange: old.Timeframe ? {
            start: old.Timeframe.StartDate,
            end: old.Timeframe.EndDate
        } : null,
        lastVerified: null
    };
}

function normalizeLegacySchedule(schedule) {
    if (!schedule) return [];
    return schedule.map(entry => {
        const [frequency, day] = Array.isArray(entry.day) ? entry.day : ['every', entry.day];
        const { startTime, endTime } = parseLegacyTime(entry.time);
        return {
            frequency: frequency.toLowerCase(),
            day: day.toLowerCase(),
            startTime,
            endTime,
            note: entry.description || null
        };
    });
}

function parseLegacyTime(timeStr) {
    if (!timeStr) return { startTime: '21:00', endTime: null };

    const normalized = timeStr.toUpperCase();

    // Handle "CLOSE" or unknown end times
    if (normalized.includes('CLOSE') || normalized.includes('???')) {
        const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)/i);
        if (match) {
            return { startTime: to24Hour(match[1], match[2], match[3]), endTime: null };
        }
    }

    // Handle "MIDNIGHT"
    if (normalized.includes('MIDNIGHT')) {
        const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)/i);
        if (match) {
            return { startTime: to24Hour(match[1], match[2], match[3]), endTime: '00:00' };
        }
    }

    // Standard: "9:00 PM - 12:00 AM"
    const parts = timeStr.split(/\s*[-–to]+\s*/i);
    if (parts.length >= 2) {
        const startMatch = parts[0].match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
        const endMatch = parts[1].match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
        if (startMatch && endMatch) {
            const endPeriod = endMatch[3] || 'AM';
            const startPeriod = startMatch[3] || (parseInt(startMatch[1]) < 6 ? 'AM' : 'PM');
            return {
                startTime: to24Hour(startMatch[1], startMatch[2], startPeriod),
                endTime: to24Hour(endMatch[1], endMatch[2], endPeriod)
            };
        }
    }

    return { startTime: '21:00', endTime: null };
}

function to24Hour(hours, minutes, period) {
    let h = parseInt(hours, 10);
    const m = minutes || '00';
    if (period?.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (period?.toUpperCase() === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m}`;
}

function normalizeLegacyHost(kj) {
    if (!kj) return null;
    const host = {};
    if (kj.Host?.trim()) host.name = kj.Host.trim();
    if (kj.Company?.trim()) host.company = kj.Company.trim();
    if (kj.Website?.trim()) host.website = kj.Website.trim();
    if (kj.KJsocials) {
        const socials = normalizeLegacySocials(kj.KJsocials);
        if (Object.keys(socials).length) host.socials = socials;
    }
    return Object.keys(host).length ? host : null;
}

function normalizeLegacySocials(socials) {
    if (!socials) return {};
    const result = {};
    for (const [key, value] of Object.entries(socials)) {
        if (value?.trim?.()) result[key.toLowerCase()] = value.trim();
    }
    return result;
}

/**
 * Get all venues
 * @returns {Object[]} All venues
 */
export function getAllVenues() {
    return venues;
}

/**
 * Get venue by ID
 * @param {string} id - Venue ID
 * @returns {Object|null} Venue or null
 */
export function getVenueById(id) {
    return venues.find(v => v.id === id) || null;
}

/**
 * Get venues that have karaoke on a specific date
 * @param {Date} date - Date to check
 * @param {Object} options - Filter options
 * @returns {Object[]} Matching venues
 */
export function getVenuesForDate(date, options = {}) {
    const { includeDedicated = true } = options;

    return venues.filter(venue => {
        // Check dedicated filter
        if (!includeDedicated && venue.dedicated) {
            return false;
        }

        // Check date range
        if (venue.dateRange) {
            if (!isDateInRange(date, venue.dateRange.start, venue.dateRange.end)) {
                return false;
            }
        }

        // Check if any schedule matches this date
        return venue.schedule.some(sched => scheduleMatchesDate(sched, date));
    });
}

/**
 * Get all venues sorted alphabetically
 * @param {Object} options - Filter options
 * @returns {Object[]} Sorted venues
 */
export function getVenuesSorted(options = {}) {
    const { includeDedicated = true } = options;

    let result = venues;

    if (!includeDedicated) {
        result = result.filter(v => !v.dedicated);
    }

    return [...result].sort((a, b) => {
        const nameA = getSortableName(a.name).toLowerCase();
        const nameB = getSortableName(b.name).toLowerCase();
        return nameA.localeCompare(nameB);
    });
}

/**
 * Search venues by query
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Object[]} Matching venues
 */
export function searchVenues(query, options = {}) {
    if (!query?.trim()) {
        return options.returnAll ? getVenuesSorted(options) : [];
    }

    const q = query.toLowerCase().trim();
    const { includeDedicated = true } = options;

    return venues.filter(venue => {
        if (!includeDedicated && venue.dedicated) {
            return false;
        }

        // Search in name
        if (containsIgnoreCase(venue.name, q)) return true;

        // Search in city
        if (containsIgnoreCase(venue.address.city, q)) return true;

        // Search in neighborhood
        if (containsIgnoreCase(venue.address.neighborhood, q)) return true;

        // Search in host name
        if (containsIgnoreCase(venue.host?.name, q)) return true;

        // Search in company
        if (containsIgnoreCase(venue.host?.company, q)) return true;

        return false;
    }).sort((a, b) => {
        // Prioritize name matches
        const aNameMatch = containsIgnoreCase(a.name, q);
        const bNameMatch = containsIgnoreCase(b.name, q);
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;

        // Then sort alphabetically
        return getSortableName(a.name).localeCompare(getSortableName(b.name));
    });
}

/**
 * Filter venues by multiple criteria
 * @param {Object} filters - Filter criteria
 * @returns {Object[]} Filtered venues
 */
export function filterVenues(filters = {}) {
    const {
        day = null,           // Day of week (lowercase)
        city = null,          // City name
        neighborhood = null,  // Neighborhood
        dedicated = null,     // true/false/null (null = include all)
        search = '',          // Search query
        date = null           // Specific date
    } = filters;

    let result = venues;

    // Filter by dedicated
    if (dedicated !== null) {
        result = result.filter(v => v.dedicated === dedicated);
    }

    // Filter by city
    if (city) {
        result = result.filter(v =>
            v.address.city.toLowerCase() === city.toLowerCase()
        );
    }

    // Filter by neighborhood
    if (neighborhood) {
        result = result.filter(v =>
            v.address.neighborhood?.toLowerCase() === neighborhood.toLowerCase()
        );
    }

    // Filter by specific date
    if (date) {
        result = result.filter(venue => {
            if (venue.dateRange && !isDateInRange(date, venue.dateRange.start, venue.dateRange.end)) {
                return false;
            }
            return venue.schedule.some(sched => scheduleMatchesDate(sched, date));
        });
    }
    // Or filter by day of week
    else if (day) {
        result = result.filter(venue =>
            venue.schedule.some(sched => sched.day === day.toLowerCase())
        );
    }

    // Filter by search query
    if (search?.trim()) {
        const q = search.toLowerCase().trim();
        result = result.filter(venue =>
            containsIgnoreCase(venue.name, q) ||
            containsIgnoreCase(venue.address.city, q) ||
            containsIgnoreCase(venue.address.neighborhood, q) ||
            containsIgnoreCase(venue.host?.name, q) ||
            containsIgnoreCase(venue.host?.company, q)
        );
    }

    return result;
}

/**
 * Get unique cities from venues
 * @returns {string[]} Sorted list of cities
 */
export function getCities() {
    const cities = new Set(venues.map(v => v.address.city).filter(Boolean));
    return [...cities].sort();
}

/**
 * Get unique neighborhoods from venues
 * @returns {string[]} Sorted list of neighborhoods
 */
export function getNeighborhoods() {
    const neighborhoods = new Set(
        venues.map(v => v.address.neighborhood).filter(Boolean)
    );
    return [...neighborhoods].sort();
}

/**
 * Get venues with coordinates (for map view)
 * @returns {Object[]} Venues with valid coordinates
 */
export function getVenuesWithCoordinates() {
    return venues.filter(v => v.coordinates?.lat && v.coordinates?.lng);
}

export { venues, isLegacyFormat };
