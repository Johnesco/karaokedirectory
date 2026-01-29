/**
 * Venue data service
 * Handles loading, filtering, sorting, and querying venue data.
 *
 * Key exports:
 * - initVenues(data): Initialize venue data from data.js
 * - getAllVenues(): Get all active venues
 * - getVenueById(id): Get single venue by ID
 * - getVenuesForDate(date, options): Get venues with karaoke on a specific date
 * - getVenuesSorted(options): Get all venues sorted alphabetically
 * - getVenuesWithCoordinates(options): Get venues with map coordinates
 * - venueMatchesSearch(venue, query): Check if venue matches search query
 *
 * Search matches against: name, city, neighborhood, host, company, tags (ID and label)
 */

import { scheduleMatchesDate, isDateInRange } from '../utils/date.js';
import { getSortableName, containsIgnoreCase } from '../utils/string.js';
import { getTagConfig } from '../utils/tags.js';

let venues = [];

/**
 * Check if a venue is active
 * Venues without an 'active' property are considered active (default true)
 * @param {Object} venue - Venue object
 * @returns {boolean} True if venue is active
 */
function isVenueActive(venue) {
    return venue.active !== false;
}

/**
 * Get only active venues (filters out inactive ones)
 * @returns {Object[]} Active venues only
 */
function getActiveVenues() {
    return venues.filter(isVenueActive);
}

/**
 * Initialize venues from data
 * @param {Object} data - Karaoke data object
 */
export function initVenues(data) {
    if (!data || !data.listings) {
        console.error('Invalid venue data');
        venues = [];
        return;
    }

    venues = data.listings;
    const activeCount = getActiveVenues().length;
    const inactiveCount = venues.length - activeCount;
    console.log(`Loaded ${venues.length} venues (${activeCount} active, ${inactiveCount} inactive)`);
}

/**
 * Get all active venues
 * @returns {Object[]} All active venues
 */
export function getAllVenues() {
    return getActiveVenues();
}

/**
 * Get venue by ID (only returns active venues)
 * @param {string} id - Venue ID
 * @returns {Object|null} Venue or null
 */
export function getVenueById(id) {
    const venue = venues.find(v => v.id === id);
    // Only return if venue exists and is active
    return venue && isVenueActive(venue) ? venue : null;
}

/**
 * Check if a venue matches search query
 * @param {Object} venue - Venue object
 * @param {string} query - Search query
 * @returns {boolean} True if venue matches
 */
export function venueMatchesSearch(venue, query) {
    if (!query?.trim()) return true;

    const q = query.toLowerCase().trim();

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

    // Search in tags (by ID or label)
    if (venueMatchesTag(venue, q)) return true;

    // Search for "dedicated" venues
    if (venueMatchesDedicated(venue, q)) return true;

    return false;
}

/**
 * Get venues that have karaoke on a specific date
 * @param {Date} date - Date to check
 * @param {Object} options - Filter options
 * @returns {Object[]} Matching venues
 */
export function getVenuesForDate(date, options = {}) {
    const { includeDedicated = true, searchQuery = '' } = options;

    return getActiveVenues().filter(venue => {
        // Check dedicated filter
        if (!includeDedicated && venue.dedicated) {
            return false;
        }

        // Check search query
        if (searchQuery && !venueMatchesSearch(venue, searchQuery)) {
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
    }).sort((a, b) => {
        // Special events sort to top
        const aSpecial = a.schedule?.some(s => s.frequency === 'once' && scheduleMatchesDate(s, date));
        const bSpecial = b.schedule?.some(s => s.frequency === 'once' && scheduleMatchesDate(s, date));
        if (aSpecial && !bSpecial) return -1;
        if (!aSpecial && bSpecial) return 1;

        // Then alphabetical
        const nameA = getSortableName(a.name).toLowerCase();
        const nameB = getSortableName(b.name).toLowerCase();
        return nameA.localeCompare(nameB);
    });
}

/**
 * Get all venues sorted alphabetically
 * @param {Object} options - Filter options
 * @returns {Object[]} Sorted venues
 */
export function getVenuesSorted(options = {}) {
    const { includeDedicated = true, searchQuery = '' } = options;

    let result = getActiveVenues();

    if (!includeDedicated) {
        result = result.filter(v => !v.dedicated);
    }

    if (searchQuery) {
        result = result.filter(v => venueMatchesSearch(v, searchQuery));
    }

    return [...result].sort((a, b) => {
        const nameA = getSortableName(a.name).toLowerCase();
        const nameB = getSortableName(b.name).toLowerCase();
        return nameA.localeCompare(nameB);
    });
}

/**
 * Check if a venue matches a tag by ID or label
 * @param {Object} venue - Venue object
 * @param {string} query - Search query (lowercase)
 * @returns {boolean} True if venue has a matching tag
 */
function venueMatchesTag(venue, query) {
    if (!venue.tags || venue.tags.length === 0) return false;

    return venue.tags.some(tagId => {
        // Match tag ID (e.g., "lgbtq", "dive")
        if (tagId.toLowerCase().includes(query)) return true;

        // Match tag label (e.g., "LGBTQ+", "Dive Bar")
        const tagConfig = getTagConfig(tagId);
        if (tagConfig && tagConfig.label.toLowerCase().includes(query)) return true;

        return false;
    });
}

/**
 * Check if venue is a dedicated karaoke venue (for search matching)
 * @param {Object} venue - Venue object
 * @param {string} query - Search query (lowercase)
 * @returns {boolean} True if query matches "dedicated" and venue is dedicated
 */
function venueMatchesDedicated(venue, query) {
    if (!venue.dedicated) return false;
    return 'dedicated'.includes(query) || 'karaoke'.includes(query);
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

    return getActiveVenues().filter(venue => {
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

        // Search in tags (by ID or label)
        if (venueMatchesTag(venue, q)) return true;

        // Search for "dedicated" venues
        if (venueMatchesDedicated(venue, q)) return true;

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

    let result = getActiveVenues();

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

    // Sort alphabetically, ignoring articles
    return result.sort((a, b) => {
        const nameA = getSortableName(a.name).toLowerCase();
        const nameB = getSortableName(b.name).toLowerCase();
        return nameA.localeCompare(nameB);
    });
}

/**
 * Get unique cities from active venues
 * @returns {string[]} Sorted list of cities
 */
export function getCities() {
    const cities = new Set(getActiveVenues().map(v => v.address.city).filter(Boolean));
    return [...cities].sort();
}

/**
 * Get unique neighborhoods from active venues
 * @returns {string[]} Sorted list of neighborhoods
 */
export function getNeighborhoods() {
    const neighborhoods = new Set(
        getActiveVenues().map(v => v.address.neighborhood).filter(Boolean)
    );
    return [...neighborhoods].sort();
}

/**
 * Get active venues with coordinates (for map view)
 * @param {Object} options - Filter options
 * @returns {Object[]} Active venues with valid coordinates
 */
export function getVenuesWithCoordinates(options = {}) {
    const { includeDedicated = true, searchQuery = '' } = options;

    return getActiveVenues().filter(v => {
        // Must have coordinates
        if (!v.coordinates?.lat || !v.coordinates?.lng) return false;

        // Check dedicated filter
        if (!includeDedicated && v.dedicated) return false;

        // Check search query
        if (searchQuery && !venueMatchesSearch(v, searchQuery)) return false;

        return true;
    });
}

export { venues };
