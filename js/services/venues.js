/**
 * Venue data service
 * Handles loading, filtering, sorting, and querying venue data.
 *
 * Every surface reads through one predicate and one comparator:
 * - venuePasses(venue, ctx): the dedicated + search + activePeriod gate
 * - byName(a, b): alphabetical, leading articles ignored
 *
 * One more predicate sits alongside rather than inside those, because only the
 * map asks it:
 * - venueHasShowInRange(venue, start, end): does the schedule reach this span
 *
 * Entry points:
 * - initVenues(data): Initialize from js/data.json (resolves host refs)
 * - getAllVenues() / getVenueById(id)
 * - getVenuesForDate(date, options): venues with karaoke on a date
 * - getVenueEventsForDate(date, options): the same, one row per show
 * - getVenuesSorted(options): all venues, alphabetical
 * - getVenuesWithCoordinates(options): map view
 * - venueMatchesSearch(venue, query) / venueMatchesHost(venue, query)
 *
 * Search matches against: name, city, host, affiliation, tags (ID and label).
 * It does NOT match event names — see #37.
 *
 * A second, unused query API lived here for months: searchVenues, filterVenues,
 * getCities and getNeighborhoods. All four were reachable from nothing, and
 * filterVenues carried its own copy of the predicate this file exists to
 * centralise — plus a day filter comparing the stored "Friday" against
 * `day.toLowerCase()`, which could never match. Deleted in #117; the
 * lesson is that an exported function with no caller is not an API, it is a
 * second implementation waiting to disagree with the first.
 */

import { scheduleMatchesDate, isDateInRange, getDateRange, parseLocalDate } from '../utils/date.js';
import { getSortableName, containsIgnoreCase } from '../utils/string.js';
import { getTagConfig } from '../utils/tags.js';
import { getVenueHosts } from '../utils/render.js';
import { hydrateVenues } from '../utils/hosts.js';

let venues = [];

// Registry ids (kjs + companies), lowercased. Populated by initVenues.
let registryIds = new Set();

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
 * Check if a venue's activePeriod includes the given date.
 * Venues without an activePeriod are always considered active.
 * @param {Object} venue - Venue object
 * @param {Date} date - Date to check
 * @returns {boolean} True if the venue is in its active window on `date`
 */
function isVenueActiveOn(venue, date) {
    if (!venue.activePeriod) return true;
    return isDateInRange(date, venue.activePeriod.start, venue.activePeriod.end);
}

/**
 * Get only active venues (filters out inactive ones)
 * @returns {Object[]} Active venues only
 */
function getActiveVenues() {
    return venues.filter(isVenueActive);
}

/**
 * Shared filter predicate for the public venue lists: a venue "passes" when it
 * isn't hidden by the dedicated toggle, matches the search query (if any), and
 * is within its activePeriod on the relevant date. Callers start from
 * getActiveVenues() (the `active` flag) and layer on their own date/coords
 * checks. Single source of truth for the dedicated + search + activePeriod gate.
 * @param {Object} venue - Venue object
 * @param {Object} [ctx]
 * @param {Date} [ctx.date] - Date for the activePeriod check (defaults to today)
 * @param {boolean} [ctx.includeDedicated=true]
 * @param {string} [ctx.searchQuery='']
 * @returns {boolean}
 */
export function venuePasses(venue, { date = null, includeDedicated = true, searchQuery = '' } = {}) {
    if (!includeDedicated && venue.dedicated) return false;
    if (searchQuery && !venueMatchesSearch(venue, searchQuery)) return false;
    if (!isVenueActiveOn(venue, date || new Date())) return false;
    return true;
}

/**
 * Does this venue have at least one show inside a date range?
 *
 * A schedule-only question. It does not consider `active`, `activePeriod`,
 * search, or the dedicated toggle — callers compose it with `venuePasses`, which
 * owns those. Used by the map's date filter (#215).
 *
 * Two modes, because "all future shows" is not a finite span:
 *
 *   - **Open-ended** (`end` is null) — a recurring entry qualifies on sight,
 *     since it keeps recurring; only `once` entries have a date to fall behind.
 *     This is what separates "All" from today's unfiltered map: a venue whose
 *     sole listing is last month's special event drops off.
 *   - **Bounded** — walks each date in the span and asks `scheduleMatchesDate`,
 *     the same matcher the weekly calendar uses, so the two views agree about
 *     what happens on a given day.
 *
 * Exclusions are deliberately not consulted. A closed occurrence is still an
 * occurrence: the weekly view lists it with a closure banner and the map dims
 * its marker, and filtering it out would hide the very thing those cues exist to
 * announce.
 *
 * @param {Object} venue - Venue object (needs .schedule)
 * @param {Date} start - First date in the span
 * @param {Date|null} [end=null] - Last date, or null for open-ended
 * @returns {boolean}
 */
export function venueHasShowInRange(venue, start, end = null) {
    const entries = venue?.schedule || [];
    if (!entries.length) return false;
    if (!start && !end) return true;

    if (!end) {
        const from = new Date(start);
        from.setHours(0, 0, 0, 0);
        return entries.some(entry => {
            if (entry.frequency !== 'once') return true;
            return entry.date ? parseLocalDate(entry.date) >= from : false;
        });
    }

    return getDateRange(start, end).some(date =>
        entries.some(entry => scheduleMatchesDate(entry, date))
    );
}

/**
 * Alphabetical comparator on sortable venue name (leading articles ignored).
 * @param {Object} a - Venue object
 * @param {Object} b - Venue object
 * @returns {number}
 */
export function byName(a, b) {
    return getSortableName(a.name).toLowerCase().localeCompare(getSortableName(b.name).toLowerCase());
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

    // Resolve any { kjId, companyId } host refs against the kjs/companies
    // registries so everything downstream sees one host shape (ADR-007).
    venues = hydrateVenues(data);

    // The set of ids `?kj=` can name. Kept so venueMatchesHost can tell an id
    // query from a name query — see hostMatches (#124 Phase 5).
    registryIds = new Set([
        ...Object.keys(data.kjs || {}),
        ...Object.keys(data.companies || {}),
    ].map(id => id.toLowerCase()));
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
 * Check if a venue is hosted by the KJ or company the query identifies.
 *
 * Two modes, in order:
 *
 *   1. **Registry id** — an exact match against `host.kjId` or `host.companyId`.
 *      This is what `?kj=` carries now, and it identifies exactly one entity.
 *   2. **Name substring** — the old behaviour, kept so links already shared or
 *      indexed keep working.
 *
 * Mode 2 is why this needed fixing (#124 Phase 5). A substring cannot identify
 * an entity: `?kj=armando` matched both "Armando" and "KJ Armando and Paola" —
 * two different KJs on one dossier — and `?kj=karaoke` matched 23 venues across
 * 13 distinct hosts, because most company names contain the word. A dossier is
 * supposed to be one host's shows.
 *
 * Ids are checked first and exactly, so a registry id can never widen into a
 * substring sweep.
 *
 * Does NOT match venue name, city, tags, or event names — use
 * venueMatchesSearch() for that.
 *
 * `hostMatches` is exported so the dossier can filter individual schedule
 * entries by the same rule. It used to substring-match them separately, which
 * would show zero shows for a dossier reached by id.
 *
 * @param {Object} venue - Venue object
 * @param {string} query - Registry id (preferred) or host-name substring
 * @returns {boolean} True if the venue is hosted by that entity
 */
export function hostMatches(host, query) {
    if (!host) return false;
    const q = (query || '').toLowerCase().trim();
    if (!q) return true;

    // An id query is answered by id alone. Falling through to the substring
    // pass would undo the whole fix: `?kj=armando` is a valid KJ id, but the
    // string "armando" is also inside "KJ Armando and Paola", so a venue hosted
    // ONLY by the duo still matched. Verified against Feral Housewife Wine,
    // whose single host is the duo (#124 Phase 5).
    if (registryIds.has(q)) {
        return host.kjId === q || host.companyId === q;
    }

    // Not an id — a legacy name link. Substring, as before.
    return containsIgnoreCase(host.name, q) || containsIgnoreCase(host.affiliation, q);
}

export function venueMatchesHost(venue, query) {
    if (!query?.trim()) return true;
    return getVenueHosts(venue).some(({ host }) => hostMatches(host, query));
}

/**
 * Resolve a `?kj=` value to a display label.
 *
 * A registry id is not a name — `?kj=kj-armando-and-paola` should title the page
 * "KJ Armando and Paola", not echo the slug. Falls back to the query itself for
 * legacy name links (#124 Phase 5).
 *
 * @param {string} query - Registry id or legacy name
 * @returns {string} Display label
 */
export function resolveHostLabel(query) {
    const q = (query || '').trim();
    if (!q) return '';

    for (const venue of getAllVenues()) {
        for (const { host } of getVenueHosts(venue)) {
            if (host.kjId === q && host.name) return host.name;
            if (host.companyId === q && host.affiliation) return host.affiliation;
        }
    }
    return q;
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

    // Search in host name
    if (containsIgnoreCase(venue.host?.name, q)) return true;

    // Search in affiliation
    if (containsIgnoreCase(venue.host?.affiliation, q)) return true;

    // Search in per-show hosts (multi-host venues like The Highball)
    if (Array.isArray(venue.schedule)) {
        for (const entry of venue.schedule) {
            if (containsIgnoreCase(entry.host?.name, q)) return true;
            if (containsIgnoreCase(entry.host?.affiliation, q)) return true;
        }
    }

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
    // Derive unique venues from the per-event list: getVenueEventsForDate already
    // applies the shared filter and sorts specials-first then alphabetically, so
    // taking each venue's first appearance preserves that order without
    // duplicating the filter/sort logic here.
    const seen = new Set();
    const result = [];
    for (const { venue } of getVenueEventsForDate(date, options)) {
        if (!seen.has(venue.id)) {
            seen.add(venue.id);
            result.push(venue);
        }
    }
    return result;
}

/**
 * Get every venue+schedule pairing for a date — one entry per matching
 * schedule entry, so a venue with two events on the same day appears twice.
 *
 * This is what the weekly calendar should render (one card per event), in
 * contrast to getVenuesForDate which returns each venue at most once. Use
 * getVenuesForDate when you need unique-venue counts; use this when you're
 * rendering per-event UI.
 *
 * Sort order:
 *   1. Special one-time events sort to the top
 *   2. Then alphabetical by venue name (ignoring leading "The")
 *   3. Ties broken by startTime
 *
 * @param {Date} date - Date to check
 * @param {Object} options - Filter options
 * @returns {Array<{venue: Object, schedule: Object}>} One entry per matching schedule entry
 */
export function getVenueEventsForDate(date, options = {}) {
    const { includeDedicated = true, searchQuery = '' } = options;

    const events = [];
    for (const venue of getActiveVenues()) {
        if (!venuePasses(venue, { date, includeDedicated, searchQuery })) continue;

        for (const schedule of venue.schedule) {
            if (scheduleMatchesDate(schedule, date)) {
                events.push({ venue, schedule });
            }
        }
    }

    return events.sort((a, b) => {
        // Special one-time events sort to the top
        const aSpecial = a.schedule.frequency === 'once';
        const bSpecial = b.schedule.frequency === 'once';
        if (aSpecial !== bSpecial) return aSpecial ? -1 : 1;

        // Then alphabetical by venue name, ties broken by start time so multiple
        // events at one venue read chronologically
        const nameCmp = byName(a.venue, b.venue);
        if (nameCmp !== 0) return nameCmp;
        return (a.schedule.startTime || '').localeCompare(b.schedule.startTime || '');
    });
}

/**
 * Get all venues sorted alphabetically.
 * Filters out venues whose activePeriod doesn't include today — seasonally-
 * bounded venues should not appear in the global list outside their window.
 * @param {Object} options - Filter options
 * @returns {Object[]} Sorted venues
 */
export function getVenuesSorted(options = {}) {
    const { includeDedicated = true, searchQuery = '' } = options;
    return getActiveVenues()
        .filter(v => venuePasses(v, { includeDedicated, searchQuery }))
        .sort(byName);
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
 * Get active venues with coordinates (for map view).
 * Also filters out venues outside their activePeriod for today.
 * @param {Object} options - Filter options
 * @param {boolean} [options.includeDedicated=true]
 * @param {string} [options.searchQuery='']
 * @param {{start: Date, end: Date|null}|null} [options.dateRange=null] - Only
 *   venues with a show in this span (see venueHasShowInRange). Null = no date
 *   constraint, which is the whole directory rather than the map's "All".
 * @returns {Object[]} Active venues with valid coordinates
 */
export function getVenuesWithCoordinates(options = {}) {
    const { includeDedicated = true, searchQuery = '', dateRange = null } = options;
    return getActiveVenues().filter(v =>
        v.coordinates?.lat && v.coordinates?.lng &&
        venuePasses(v, { includeDedicated, searchQuery }) &&
        (!dateRange || venueHasShowInRange(v, dateRange.start, dateRange.end))
    );
}

export { venues };
