/**
 * Shared rendering utilities
 * Provides reusable HTML generation for venue display components
 */

import { escapeHtml } from './string.js';
import { formatScheduleEntry, formatActivePeriodText, scheduleMatchesDate, WEEKDAYS, getVenueExclusionForDate, getUpcomingExclusions, parseLocalDate } from './date.js';
import { buildMapUrl, buildDirectionsUrl, createSocialLinks, formatAddress, sanitizeUrl } from './url.js';

/**
 * Resolve the effective host for a single show.
 * Per-show host overrides venue host; falls back to null when neither is set.
 * @param {Object} venue - Venue data
 * @param {Object} scheduleEntry - One entry from venue.schedule
 * @returns {Object|null} Host object ({ name?, affiliation?, website?, socials? }) or null
 */
export function resolveHostFor(venue, scheduleEntry) {
    return scheduleEntry?.host ?? venue?.host ?? null;
}

/**
 * @param {Object} venue
 * @returns {boolean} True if any schedule entry carries its own host
 */
function hasPerShowHosts(venue) {
    return Array.isArray(venue?.schedule) && venue.schedule.some(e => e.host);
}

/**
 * Render a schedule table for venue details.
 * When any schedule entry has its own host (multi-host venue, e.g. The Highball),
 * a Host column is added. Otherwise the column is omitted and host info lives
 * in the venue-level "Presented By" section as before.
 * @param {Object} venue - Full venue object (needs .schedule and optionally .host)
 * @param {string} classPrefix - CSS class prefix (e.g., 'venue-modal', 'detail-pane')
 * @returns {string} HTML string for schedule table
 */
export function renderScheduleTable(venue, classPrefix) {
    const schedule = venue?.schedule;
    if (!schedule || schedule.length === 0) {
        return '<p>No schedule information available.</p>';
    }

    const showHostColumn = hasPerShowHosts(venue);

    const rows = schedule.map(entry => {
        const formatted = formatScheduleEntry(entry, { showEvery: true });

        // For one-time events, show event name/label and date together
        const dayLabel = entry.frequency === 'once'
            ? `${formatted.frequencyPrefix} — ${formatted.day}`
            : `${formatted.frequencyPrefix}${formatted.day}`;

        const eventLink = entry.eventUrl
            ? ` <a href="${escapeHtml(sanitizeUrl(entry.eventUrl) || '')}" target="_blank" rel="noopener noreferrer" class="schedule-event-link" title="Event page"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>`
            : '';

        const hostCell = showHostColumn
            ? `<td data-label="Host">${escapeHtml(formatHostDisplay(resolveHostFor(venue, entry)))}</td>`
            : '';

        // data-label drives the stacked card layout on small phones (<480px),
        // where the table collapses to label/value rows — see components.css.
        return `
            <tr>
                <td data-label="Day">${dayLabel}${eventLink}</td>
                <td data-label="Time">${formatted.time}</td>
                ${hostCell}
                ${entry.note ? `<td class="schedule-note" data-label="Note">${escapeHtml(entry.note)}</td>` : '<td data-label="Note"></td>'}
            </tr>
        `;
    }).join('');

    return `
        <table class="${classPrefix}__schedule-table">
            <thead>
                <tr>
                    <th>Day</th>
                    <th>Time</th>
                    ${showHostColumn ? '<th>Host</th>' : ''}
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
 * Render a compact schedule list (div per entry, no table) for summary cards.
 * Used by MapView's marker-popup card where a table would be too heavy.
 * @param {Object[]} schedule - Array of schedule entries
 * @returns {string} HTML string of <div> elements, or empty string
 */
export function renderScheduleCompact(schedule) {
    if (!schedule || schedule.length === 0) return '';
    return schedule.map(entry => {
        const { fullText } = formatScheduleEntry(entry, { showEvery: false });
        const eventLink = entry.eventUrl
            ? ` <a href="${escapeHtml(sanitizeUrl(entry.eventUrl) || '')}" target="_blank" rel="noopener noreferrer" class="schedule-event-link" title="Event page"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>`
            : '';
        return `<div>${fullText}${eventLink}</div>`;
    }).join('');
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
 * Render an "Upcoming closures" line listing a venue's exclusion dates within
 * the next 60 days (e.g. "Dec 25 (Christmas), Dec 26 (Repairs)"). Returns an
 * empty string when there are none.
 * @param {Object} venue - Venue object (needs .schedule)
 * @param {string} classPrefix - CSS class prefix
 * @returns {string} HTML string or empty
 */
export function renderUpcomingClosures(venue, classPrefix) {
    const upcoming = getUpcomingExclusions(venue, 60);
    if (!upcoming.length) return '';

    const list = upcoming.map(ex => {
        const label = parseLocalDate(ex.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return ex.reason ? `${escapeHtml(label)} (${escapeHtml(ex.reason)})` : escapeHtml(label);
    }).join(', ');

    return `<p class="${classPrefix}__upcoming-closures"><i class="fa-solid fa-ban"></i> Upcoming closures: ${list}</p>`;
}

/**
 * Render the host/KJ section for venue details
 * @param {Object} host - Host object with name, affiliation, website, socials
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
                ${host.affiliation ? `<p class="${classPrefix}__host-affiliation">${escapeHtml(host.affiliation)}</p>` : ''}
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
 * Build the "Also ..." text for a venue's other schedule entries.
 * Every variant starts with "Also" so the more-nights indicator reads
 * uniformly under the time row.
 * @param {Object[]} otherEntries - Schedule entries other than the current card's match
 * @param {Object[]} allEntries - All schedule entries for the venue
 * @returns {string} Formatted text like "Also Tue, Wed", "Also every day", etc.
 */
function buildAlsoText(otherEntries, allEntries) {
    // All 7 weekdays, all "every" frequency -> the venue runs daily
    const everyEntries = allEntries.filter(e => e.frequency === 'every');
    const uniqueDays = new Set(everyEntries.map(e => e.day.toLowerCase()));
    if (everyEntries.length === allEntries.length && uniqueDays.size === 7) {
        return 'Also every day';
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

    // Process day-grouped entries
    for (const [dayKey, entries] of dayMap) {
        const abbrevDay = abbreviateDay(entries[0].day);
        const dayIdx = WEEKDAYS.indexOf(dayKey);
        const sortKey = dayIdx >= 0 ? dayIdx : 7;

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
 * @param {Date|null} [currentDate] - Date the card is rendered for; if given, schedule entries on the same date are excluded from the "Also" list (avoids "Also May 30" on a card already on May 30)
 * @returns {{ frequencyLabel: string, moreCount: number, moreText: string }} Schedule context parts
 */
export function getScheduleContext(venue, schedule, currentDate = null) {
    // Build frequency label for non-once events
    let frequencyLabel = '';
    if (schedule && schedule.frequency !== 'once') {
        const formatted = formatScheduleEntry(schedule, { showEvery: true });
        frequencyLabel = `${formatted.frequencyPrefix}${formatted.day}`;
    }

    // "Other" entries: everything that isn't the matched one, and (if a date is
    // provided) isn't a different entry that also matches the same date.
    // The second clause prevents the "Also" list from listing today's other
    // events as if they were on another night.
    const otherEntries = (venue.schedule || []).filter(s => {
        if (s === schedule) return false;
        if (currentDate && scheduleMatchesDate(s, currentDate)) return false;
        return true;
    });

    const moreCount = otherEntries.length;
    let moreText = '';
    if (moreCount > 0) {
        moreText = buildAlsoText(otherEntries, venue.schedule);
    }

    return { frequencyLabel, moreCount, moreText };
}

/**
 * Render the full venue-detail sections (location, schedule, host, socials, contact)
 * shared by VenueModal, VenueDetailPane, and MapView's expanded detail card.
 *
 * Caller wraps these sections in their own outer container + header — the surfaces
 * differ in their wrappers (modal backdrop vs sticky pane vs floating map card).
 *
 * @param {Object} venue - Venue data object
 * @param {Object} options
 * @param {string} options.classPrefix - BEM prefix (e.g. 'venue-modal', 'detail-pane', 'map-venue-card')
 * @param {string} [options.hostSocialSize='fa-lg'] - Font Awesome size class for host socials ('' for compact)
 * @returns {string} HTML string of <section> elements
 */
export function renderVenueDetailSections(venue, { classPrefix, hostSocialSize = 'fa-lg' }) {
    const addressHtml = formatAddress(venue.address);
    const mapUrl = buildMapUrl(venue.address, venue.name);
    const directionsUrl = buildDirectionsUrl(venue.address, venue.name);
    const socialLinksHtml = createSocialLinks(venue.socials, { size: 'fa-lg' });

    // "Closed today" banner when a recurring show is excluded on the current date
    const todayExclusion = getVenueExclusionForDate(venue, new Date());
    const exclusionBanner = todayExclusion
        ? `<div class="${classPrefix}__exclusion-banner"><i class="fa-solid fa-ban"></i> Closed Today${todayExclusion.reason ? `: ${escapeHtml(todayExclusion.reason)}` : ''}</div>`
        : '';

    return `
        ${exclusionBanner}
        <section class="${classPrefix}__section">
            <h3><i class="fa-solid fa-location-dot"></i> Location</h3>
            <address class="${classPrefix}__address">${addressHtml}</address>
            <div class="${classPrefix}__map-links">
                <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary">
                    <i class="fa-solid fa-map"></i> View Map
                </a>
                <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary">
                    <i class="fa-solid fa-diamond-turn-right"></i> Directions
                </a>
                <button class="btn btn--secondary ${classPrefix}__share" type="button">
                    <i class="fa-solid fa-share-from-square"></i> Share
                </button>
            </div>
        </section>

        <section class="${classPrefix}__section">
            <h3><i class="fa-regular fa-calendar"></i> Schedule</h3>
            ${renderScheduleTable(venue, classPrefix)}
            ${renderActivePeriod(venue.activePeriod, classPrefix)}
            ${renderUpcomingClosures(venue, classPrefix)}
        </section>

        ${renderHostSection(venue.host, classPrefix, { socialSize: hostSocialSize })}

        ${socialLinksHtml ? `
            <section class="${classPrefix}__section">
                <h3><i class="fa-solid fa-share-nodes"></i> Venue Social Media</h3>
                <div class="${classPrefix}__socials">${socialLinksHtml}</div>
            </section>
        ` : ''}

        ${venue.phone ? `
            <section class="${classPrefix}__section">
                <h3><i class="fa-solid fa-phone"></i> Contact</h3>
                <a href="tel:${venue.phone}" class="${classPrefix}__phone">${escapeHtml(venue.phone)}</a>
            </section>
        ` : ''}
    `;
}

/**
 * Render the schedule context HTML for compact venue cards.
 * Wraps getScheduleContext and returns the two HTML fragments the caller
 * needs to embed: an inline frequency badge (placed before the time in
 * the time row) and a separate more-nights block (placed below the time).
 *
 * Centralizes assembly + escaping so VenueCard doesn't duplicate the
 * markup or forget to escape user-provided data (day/event names).
 *
 * @param {Object} venue - Venue data (needs venue.schedule)
 * @param {Object|null} schedule - The matched schedule entry for this card
 * @returns {{ frequencyHtml: string, moreNightsHtml: string }}
 */
export function renderScheduleContext(venue, schedule, currentDate = null) {
    const { frequencyLabel, moreCount, moreText } = getScheduleContext(venue, schedule, currentDate);

    const frequencyHtml = frequencyLabel
        ? `<span class="venue-card__frequency">${escapeHtml(frequencyLabel)}</span> &middot; `
        : '';

    let moreNightsHtml = '';
    if (moreCount > 0) {
        moreNightsHtml = `<div class="venue-card__more-nights"><i class="fa-regular fa-calendar-days"></i> ${escapeHtml(moreText)}</div>`;
    }

    return { frequencyHtml, moreNightsHtml };
}

/**
 * Render a compact host display line (for venue cards)
 * Shows "Presented by [name]" format
 * @param {Object} host - Host object with name and/or affiliation
 * @returns {string} Formatted host display string or empty
 */
export function formatHostDisplay(host) {
    if (!host) return '';

    const { name, affiliation } = host;

    if (name && affiliation) {
        return `${name} (${affiliation})`;
    }

    return name || affiliation || '';
}
