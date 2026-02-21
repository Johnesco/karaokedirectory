/**
 * Shared rendering utilities
 * Provides reusable HTML generation for venue display components
 */

import { escapeHtml } from './string.js';
import { formatScheduleEntry, formatActivePeriodText } from './date.js';
import { createSocialLinks, sanitizeUrl } from './url.js';

/**
 * Render a schedule table for venue details
 * Used by VenueModal and VenueDetailPane
 * @param {Object[]} schedule - Array of schedule entries
 * @param {string} classPrefix - CSS class prefix (e.g., 'venue-modal', 'detail-pane')
 * @returns {string} HTML string for schedule table
 */
export function renderScheduleTable(schedule, classPrefix) {
    if (!schedule || schedule.length === 0) {
        return '<p>No schedule information available.</p>';
    }

    const rows = schedule.map(entry => {
        const formatted = formatScheduleEntry(entry, { showEvery: true });

        // For one-time events, show event name/label and date together
        const dayLabel = entry.frequency === 'once'
            ? `${formatted.frequencyPrefix} — ${formatted.day}`
            : `${formatted.frequencyPrefix}${formatted.day}`;

        const eventLink = entry.eventUrl
            ? ` <a href="${escapeHtml(sanitizeUrl(entry.eventUrl) || '')}" target="_blank" rel="noopener noreferrer" class="schedule-event-link" title="Event page"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>`
            : '';

        return `
            <tr>
                <td>${dayLabel}${eventLink}</td>
                <td>${formatted.time}</td>
                ${entry.note ? `<td class="schedule-note">${escapeHtml(entry.note)}</td>` : '<td></td>'}
            </tr>
        `;
    }).join('');

    return `
        <table class="${classPrefix}__schedule-table">
            <thead>
                <tr>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Note</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

/**
 * Render an active period notice with icon
 * @param {Object} activePeriod - Object with start and/or end date strings
 * @param {string} classPrefix - CSS class prefix
 * @returns {string} HTML string or empty if no active period
 */
export function renderActivePeriod(activePeriod, classPrefix) {
    const text = formatActivePeriodText(activePeriod);
    if (!text) return '';

    return `<p class="${classPrefix}__active-period"><i class="fa-solid fa-calendar-check"></i> ${text}</p>`;
}

/**
 * Render the host/KJ section for venue details
 * @param {Object} host - Host object with name, company, website, socials
 * @param {string} classPrefix - CSS class prefix
 * @param {Object} options - Options for social links
 * @returns {string} HTML string or empty if no host
 */
export function renderHostSection(host, classPrefix, options = {}) {
    if (!host) return '';

    const { socialSize = 'fa-lg' } = options;
    const hostSocialsHtml = host.socials
        ? createSocialLinks(host.socials, { size: socialSize })
        : '';

    return `
        <section class="${classPrefix}__section">
            <h3>Presented By</h3>
            <div class="${classPrefix}__host">
                ${host.name ? `<p class="${classPrefix}__host-name">${escapeHtml(host.name)}</p>` : ''}
                ${host.company ? `<p class="${classPrefix}__host-company">${escapeHtml(host.company)}</p>` : ''}
                ${host.website ? `
                    <a href="${escapeHtml(host.website)}" target="_blank" rel="noopener noreferrer" class="${classPrefix}__host-website">
                        <i class="fa-solid fa-globe"></i> Website
                    </a>
                ` : ''}
                ${hostSocialsHtml ? `
                    <p class="${classPrefix}__socials-label">KJ Social Media</p>
                    <div class="${classPrefix}__host-socials">${hostSocialsHtml}</div>
                ` : ''}
            </div>
        </section>
    `;
}

/**
 * Abbreviate a full day name to 3 letters
 * @param {string} dayName - Full day name (e.g., "Wednesday")
 * @returns {string} 3-letter abbreviation (e.g., "Wed")
 */
function abbreviateDay(dayName) {
    return dayName.charAt(0).toUpperCase() + dayName.slice(1, 3).toLowerCase();
}

/**
 * Build the "Also ..." or "Nightly" text from a venue's other schedule entries
 * @param {Object[]} otherEntries - Schedule entries other than the current card's match
 * @param {Object[]} allEntries - All schedule entries for the venue
 * @returns {string} Formatted text like "Also Tue, Wed", "Nightly", or ""
 */
function buildAlsoText(otherEntries, allEntries) {
    // Check for "Nightly": all entries are "every" and cover all 7 weekdays
    const everyEntries = allEntries.filter(e => e.frequency === 'every');
    const uniqueDays = new Set(everyEntries.map(e => e.day.toLowerCase()));
    if (everyEntries.length === allEntries.length && uniqueDays.size === 7) {
        return 'Everyday';
    }

    // Group entries by day name for same-day ordinal combining
    // e.g., "second Friday" + "fourth Friday" → "2nd & 4th Fri"
    const groups = [];
    const dayMap = new Map(); // day name → array of entries

    for (const entry of otherEntries) {
        if (entry.frequency === 'once') {
            // One-time events get their own entry: "Mar 15"
            const dateObj = new Date(entry.date + 'T12:00:00');
            const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            groups.push({ sort: dateObj.getTime(), text: label });
        } else {
            const dayKey = entry.day.toLowerCase();
            if (!dayMap.has(dayKey)) {
                dayMap.set(dayKey, []);
            }
            dayMap.get(dayKey).push(entry);
        }
    }

    // Ordinal abbreviation map
    const ordinalAbbrev = {
        first: '1st', second: '2nd', third: '3rd',
        fourth: '4th', fifth: '5th', last: 'Last'
    };

    // Day sort order for consistent ordering
    const daySortOrder = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6
    };

    // Process day-grouped entries
    for (const [dayKey, entries] of dayMap) {
        const abbrevDay = abbreviateDay(entries[0].day);
        const sortKey = daySortOrder[dayKey] ?? 7;

        // Check if all entries for this day are "every"
        const allEvery = entries.every(e => e.frequency === 'every');
        if (allEvery) {
            groups.push({ sort: sortKey, text: abbrevDay });
        } else {
            // Combine ordinals: "2nd & 4th Fri"
            const ordinals = entries.map(e => ordinalAbbrev[e.frequency] || e.frequency);
            groups.push({ sort: sortKey, text: `${ordinals.join(' & ')} ${abbrevDay}` });
        }
    }

    // Sort: weekday entries by day order, then once events by date
    groups.sort((a, b) => a.sort - b.sort);

    return `Also ${groups.map(g => g.text).join(', ')}`;
}

/**
 * Render schedule context for compact venue cards
 * Combines the frequency label (e.g., "Every Friday") and the "Also ..." indicator
 * into a single output for display after the time.
 * @param {Object} venue - Venue data object (needs schedule array)
 * @param {Object|null} schedule - The matched schedule entry for this card
 * @returns {{ frequencyLabel: string, moreCount: number, moreText: string }} Schedule context parts
 */
export function getScheduleContext(venue, schedule) {
    // Build frequency label for non-once events
    let frequencyLabel = '';
    if (schedule && schedule.frequency !== 'once') {
        const formatted = formatScheduleEntry(schedule, { showEvery: true });
        frequencyLabel = `${formatted.frequencyPrefix}${formatted.day}`;
    }

    // Build "Also ..." or "Nightly" text for multi-entry venues
    const moreCount = (venue.schedule?.length || 1) - 1;
    let moreText = '';
    if (moreCount > 0) {
        const otherEntries = venue.schedule.filter(s => s !== schedule);
        moreText = buildAlsoText(otherEntries, venue.schedule);
    }

    return { frequencyLabel, moreCount, moreText };
}

/**
 * Render a compact host display line (for venue cards)
 * Shows "Presented by [name]" format
 * @param {Object} host - Host object with name and/or company
 * @returns {string} Formatted host display string or empty
 */
export function formatHostDisplay(host) {
    if (!host) return '';

    const { name, company } = host;

    if (name && company) {
        return `${name} (${company})`;
    }

    return name || company || '';
}
