/**
 * Shared rendering utilities
 * Provides reusable HTML generation for venue display components
 */

import { escapeHtml } from './string.js';
import { formatScheduleEntry, formatDateRangeText } from './date.js';
import { createSocialLinks } from './url.js';

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
        const { day, frequencyPrefix, time } = formatScheduleEntry(entry, { showEvery: true });

        return `
            <tr>
                <td>${frequencyPrefix}${day}</td>
                <td>${time}</td>
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
 * Render a dedicated venue badge
 * @param {boolean} isDedicated - Whether venue is a dedicated karaoke venue
 * @param {string} classPrefix - CSS class prefix
 * @param {Object} options - Display options
 * @param {boolean} options.fullText - Use full "Dedicated Karaoke Venue" text (default: false)
 * @returns {string} HTML string or empty if not dedicated
 */
export function renderDedicatedBadge(isDedicated, classPrefix, options = {}) {
    if (!isDedicated) return '';

    const { fullText = false } = options;
    const text = fullText ? 'Dedicated Karaoke Venue' : 'Dedicated';

    return `<span class="${classPrefix}__badge">${text}</span>`;
}

/**
 * Get common venue data prepared for rendering
 * Consolidates repeated data preparation logic
 * @param {Object} venue - Venue object
 * @param {Object} options - Options for data preparation
 * @returns {Object} Prepared data for rendering
 */
export function prepareVenueData(venue, options = {}) {
    const { socialSize = 'fa-lg' } = options;

    // Import dynamically to avoid circular dependencies
    const { buildMapUrl, buildDirectionsUrl, createSocialLinks: createLinks, formatAddress } =
        import('./url.js').then ? {} : require('./url.js');

    return {
        // These can be computed in the component since they need url.js imports
        // This function is primarily for documentation of the pattern
    };
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
