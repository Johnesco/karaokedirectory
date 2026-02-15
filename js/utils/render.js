/**
 * Shared rendering utilities
 * Provides reusable HTML generation for venue display components
 */

import { escapeHtml } from './string.js';
import { formatScheduleEntry, formatDateRangeText } from './date.js';
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
 * Render a date range notice with icon
 * @param {Object} dateRange - Object with start and/or end date strings
 * @param {string} classPrefix - CSS class prefix
 * @returns {string} HTML string or empty if no range
 */
export function renderDateRange(dateRange, classPrefix) {
    const text = formatDateRangeText(dateRange);
    if (!text) return '';

    return `<p class="${classPrefix}__date-range"><i class="fa-solid fa-calendar-check"></i> ${text}</p>`;
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
 * Render schedule context for compact venue cards
 * Combines the frequency label (e.g., "Every Friday") and "+N more" indicator
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

    // Count additional schedule entries
    const moreCount = (venue.schedule?.length || 1) - 1;
    const moreText = moreCount > 0 ? `+${moreCount} more` : '';

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
