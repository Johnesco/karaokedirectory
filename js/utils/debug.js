/**
 * Debug utilities
 * Enable with ?debug=1 in URL or localStorage.setItem('debug', '1')
 */

import { scheduleMatchesDate } from './date.js';
import { escapeHtml } from './string.js';
import { sanitizeUrl } from './url.js';

let debugMode = false;

// Post links behind each show's latest confirmation (#305). They are private:
// never in js/data.json, never deployed. The curator's local preview serves
// them as js/sources.local.json, generated on request from its own records, so
// debug mode shows them on the owner's machine and nowhere else.
let debugSources = {};

/** Hosts where the local-only file can exist. Production is never one. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Initialize debug mode from URL or localStorage
 */
export function initDebugMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlDebug = urlParams.get('debug') === '1';
    const localDebug = localStorage.getItem('debug') === '1';

    debugMode = urlDebug || localDebug;

    if (debugMode) {
        document.body.classList.add('debug-mode');
        showDebugIndicator();
        console.log('%c[Debug Mode Enabled]', 'color: #f59e0b; font-weight: bold;');
        console.log('Venue cards will show schedule match reasons on hover.');
        console.log('To disable: remove ?debug=1 from URL or run: localStorage.removeItem("debug")');
    }

    return debugMode;
}

/**
 * Check if debug mode is enabled
 */
export function isDebugMode() {
    return debugMode;
}

/**
 * Load the local-only source links, in debug mode on a local host only. Any
 * failure leaves the map empty: the file is optional by design.
 * @param {URL|string} url - Where js/sources.local.json would be
 * @returns {Promise<number>} How many shows have a link
 */
export async function loadDebugSources(url) {
    debugSources = {};
    if (!debugMode || !LOCAL_HOSTS.has(window.location.hostname)) return 0;
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) return 0;
        const map = await response.json();
        if (map && typeof map === 'object') debugSources = map;
    } catch {
        // No curator preview behind this server — nothing to show.
    }
    return Object.keys(debugSources).length;
}

/**
 * A show's identity across the export: the curator's own id is stripped, so
 * the venue plus what makes the show itself. Must match buildDebugSources()
 * in the curator's server.js.
 * @param {string} venueId
 * @param {Object} entry - Schedule entry
 * @returns {string}
 */
export function debugSourceKey(venueId, entry) {
    const when = entry.frequency === 'once' ? entry.date : entry.day;
    return [venueId, entry.frequency, when, entry.startTime].join('|');
}

/**
 * A link to the post behind a show's latest confirmation, in debug mode when
 * the local file supplied one. '' otherwise, so normal pages gain no markup.
 * @param {Object} venue
 * @param {Object} entry - Schedule entry
 * @returns {string} HTML
 */
export function renderDebugSource(venue, entry) {
    if (!debugMode || !venue || !entry) return '';
    const found = debugSources[debugSourceKey(venue.id, entry)];
    const href = found && sanitizeUrl(found.url);
    if (!href) return '';
    const title = 'Source of the latest confirmation' + (found.for ? ` (night of ${found.for})` : '');
    return ` <a class="debug-source" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(title)}"><i class="fa-solid fa-link"></i></a>`;
}

/**
 * Show debug indicator in corner of screen
 */
function showDebugIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'debug-indicator';
    indicator.innerHTML = '<i class="fa-solid fa-bug"></i> Debug Mode';
    indicator.title = 'Debug mode is active. Hover over venue cards to see schedule match reasons.';
    document.body.appendChild(indicator);
}

/**
 * Get debug info for a venue on a specific date
 * Returns the reason why the venue appears on that date
 * @param {Object} venue - Venue data
 * @param {Date} date - Date to check
 * @returns {Object} Debug info with matchReason and scheduleDetails
 */
export function getVenueDebugInfo(venue, date) {
    if (!date || !venue.schedule) {
        return {
            matchReason: 'No date context',
            scheduleDetails: []
        };
    }

    const matchingSchedules = [];

    for (const sched of venue.schedule) {
        // Handle one-time special events
        if (sched.frequency === 'once') {
            if (scheduleMatchesDate(sched, date)) {
                matchingSchedules.push({
                    frequency: sched.frequency,
                    day: sched.date,
                    startTime: sched.startTime,
                    endTime: sched.endTime,
                    eventName: sched.eventName
                });
            }
            continue;
        }

        // No day-name pre-filter here: scheduleMatchesDate() already checks the
        // weekday, and doing it again first meant this loop disagreed with the
        // real matcher about what counts as a match. It also read `sched.day`
        // unguarded, which throws on a recurring entry missing a day (#160).
        const matches = scheduleMatchesDate(sched, date);
        if (matches) {
            matchingSchedules.push({
                frequency: sched.frequency,
                day: sched.day,
                startTime: sched.startTime,
                endTime: sched.endTime,
                activePeriod: sched.activePeriod
            });
        }
    }

    if (matchingSchedules.length === 0) {
        return {
            matchReason: 'No matching schedule',
            scheduleDetails: []
        };
    }

    // Format the match reason
    const primary = matchingSchedules[0];
    let matchReason;

    if (primary.frequency === 'once') {
        matchReason = primary.eventName || 'Special Event';
    } else if (primary.frequency === 'every') {
        matchReason = `Every ${capitalize(primary.day)}`;
    } else {
        matchReason = `${capitalize(primary.frequency)} ${capitalize(primary.day)}`;
    }

    // The show's own lifespan (ADR-016), so a switch can be checked by eye
    // without the public page ever saying it is coming.
    const period = primary.activePeriod;
    if (period?.start) matchReason += ` · from ${period.start}`;
    if (period?.end) matchReason += ` · until ${period.end}`;

    return {
        matchReason,
        scheduleDetails: matchingSchedules
    };
}

/**
 * Generate debug HTML for a venue card
 * @param {Object} venue - Venue data
 * @param {Date} date - Date context
 * @param {Object} [entry] - The show this card is for; adds its source link (#305)
 * @returns {string} HTML string for debug overlay
 */
export function getDebugHtml(venue, date, entry) {
    if (!debugMode) return '';

    const info = getVenueDebugInfo(venue, date);

    return `
        <span class="venue-card__debug">${info.matchReason}${renderDebugSource(venue, entry)}</span>
        <div class="venue-card__debug-tooltip">
            <strong>${venue.name}</strong><br>
            Match: ${info.matchReason}<br>
            Date: ${date ? date.toLocaleDateString() : 'N/A'}
        </div>
    `;
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
