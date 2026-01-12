/**
 * Debug utilities
 * Enable with ?debug=1 in URL or localStorage.setItem('debug', '1')
 */

import { scheduleMatchesDate, getDayName } from './date.js';

let debugMode = false;

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

    const dayName = getDayName(date);
    const matchingSchedules = [];

    for (const sched of venue.schedule) {
        const schedDay = sched.day.toLowerCase();
        if (schedDay !== dayName) continue;

        const matches = scheduleMatchesDate(sched, date);
        if (matches) {
            matchingSchedules.push({
                frequency: sched.frequency,
                day: sched.day,
                startTime: sched.startTime,
                endTime: sched.endTime,
                note: sched.note
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

    if (primary.frequency === 'every') {
        matchReason = `Every ${capitalize(primary.day)}`;
    } else {
        matchReason = `${capitalize(primary.frequency)} ${capitalize(primary.day)}`;
    }

    return {
        matchReason,
        scheduleDetails: matchingSchedules
    };
}

/**
 * Generate debug HTML for a venue card
 * @param {Object} venue - Venue data
 * @param {Date} date - Date context
 * @returns {string} HTML string for debug overlay
 */
export function getDebugHtml(venue, date) {
    if (!debugMode) return '';

    const info = getVenueDebugInfo(venue, date);

    return `
        <span class="venue-card__debug">${info.matchReason}</span>
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
