/**
 * VenueCard Component
 * Displays venue information in compact or full mode
 */

import { Component } from './Component.js';
import { escapeHtml } from '../utils/string.js';
import { formatTimeRange, formatScheduleEntry, scheduleMatchesDate, getScheduleExclusion } from '../utils/date.js';
import { buildMapUrl, createSocialLinks, formatAddress, sanitizeUrl } from '../utils/url.js';
import { emit, Events } from '../core/events.js';
import { isDebugMode, getDebugHtml } from '../utils/debug.js';
import { renderTags } from '../utils/tags.js';
import { formatHostDisplay, renderScheduleContext } from '../utils/render.js';

export class VenueCard extends Component {
    /**
     * @param {HTMLElement|string} container
     * @param {Object} props
     * @param {Object} props.venue - Venue data
     * @param {string} [props.mode='compact'] - Display mode: 'compact' | 'full'
     * @param {Date} [props.date] - Date for schedule display
     * @param {Object} [props.schedule] - Specific schedule entry to render (overrides date-based auto-pick)
     * @param {boolean} [props.showSchedule=true] - Show schedule info
     */
    init() {
        this.state = {
            expanded: false
        };
    }

    template() {
        const { venue, mode = 'compact', date, schedule, showSchedule = true } = this.props;

        if (mode === 'compact') {
            return this.compactTemplate(venue, date, showSchedule, schedule);
        }
        return this.fullTemplate(venue);
    }

    compactTemplate(venue, date, showSchedule, scheduleProp) {
        // Prefer explicit schedule prop (so callers can pick the specific event
        // when a venue has multiple matches on the same date). Fall back to
        // auto-detection when no prop is passed.
        const schedule = scheduleProp || this.getScheduleForDate(venue, date);
        const timeDisplay = schedule
            ? formatTimeRange(schedule.startTime, schedule.endTime)
            : '';

        // Detect special event
        const isSpecialEvent = schedule?.frequency === 'once';
        // Excluded: a recurring entry suppressed on this specific date (e.g. holiday, private event)
        const exclusion = (schedule && date) ? getScheduleExclusion(schedule, date) : null;
        const classes = ['venue-card', 'venue-card--compact'];
        if (isSpecialEvent) classes.push('venue-card--special-event');
        if (exclusion) classes.push('venue-card--excluded');
        const cardClass = classes.join(' ');
        const eventName = isSpecialEvent ? (schedule.eventName || 'Special Event') : null;
        const exclusionBanner = exclusion
            ? `<div class="venue-card__exclusion-banner"><i class="fa-solid fa-ban"></i> Closed${exclusion.reason ? `: ${escapeHtml(exclusion.reason)}` : ' tonight'}</div>`
            : '';

        // Build tag list, injecting 'special-event' tag for one-time events
        const tags = isSpecialEvent
            ? ['special-event', ...(venue.tags || [])]
            : venue.tags;

        // Schedule context: frequency label + "+N more" indicator (HTML-ready).
        // Passes the render date so the "Also" list can exclude same-day entries
        // (avoids "Also May 30" appearing on a card already rendered for May 30).
        const { frequencyHtml, moreNightsHtml } = renderScheduleContext(venue, schedule, date);

        // Build full address string and map URL
        const fullAddress = formatAddress(venue.address);
        const mapsUrl = buildMapUrl(venue.address, venue.name);

        // KJ/Host info using shared utility
        const hostDisplay = formatHostDisplay(venue.host);

        // Debug info for schedule matching
        const debugHtml = getDebugHtml(venue, date);

        return `
            <div class="${cardClass}" data-venue-id="${escapeHtml(venue.id)}">
                ${exclusionBanner}
                ${debugHtml}
                <div class="venue-card__header">
                    <h3 class="venue-card__name">
                        <button class="venue-card__link" type="button">
                            ${escapeHtml(venue.name)}
                        </button>
                    </h3>
                </div>
                ${eventName ? `<div class="venue-card__event-name"><i class="fa-solid fa-star"></i> ${schedule?.eventUrl ? `<a href="${escapeHtml(sanitizeUrl(schedule.eventUrl) || '')}" target="_blank" rel="noopener noreferrer" class="venue-card__event-link">${escapeHtml(eventName)} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : escapeHtml(eventName)}</div>` : ''}
                ${showSchedule && timeDisplay ? `
                    <div class="venue-card__time">
                        <i class="fa-regular fa-clock"></i> ${frequencyHtml}${timeDisplay}
                        ${!eventName && schedule?.eventUrl ? `<a href="${escapeHtml(sanitizeUrl(schedule.eventUrl) || '')}" target="_blank" rel="noopener noreferrer" class="venue-card__event-link" title="Event page"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ''}
                    </div>
                ` : ''}
                ${showSchedule ? moreNightsHtml : ''}
                <div class="venue-card__location">
                    <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="venue-card__map-link">
                        <i class="fa-solid fa-location-dot"></i>
                        ${escapeHtml(fullAddress)}
                    </a>
                </div>
                ${hostDisplay ? `
                    <div class="venue-card__host-info">
                        Presented by ${escapeHtml(hostDisplay)}
                    </div>
                ` : ''}
                ${renderTags(tags, { dedicated: venue.dedicated })}
            </div>
        `;
    }

    fullTemplate(venue) {
        const addressHtml = formatAddress(venue.address);
        const mapUrl = buildMapUrl(venue.address, venue.name);
        const socialLinksHtml = createSocialLinks(venue.socials);
        const hostSocialsHtml = venue.host?.socials ? createSocialLinks(venue.host.socials) : '';

        return `
            <div class="venue-card venue-card--full" data-venue-id="${escapeHtml(venue.id)}">
                <div class="venue-card__header">
                    <h3 class="venue-card__name">
                        <button class="venue-card__link" type="button">
                            ${escapeHtml(venue.name)}
                        </button>
                    </h3>
                </div>

                <div class="venue-card__address">
                    <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="venue-card__map-link">
                        <i class="fa-solid fa-location-dot"></i>
                        ${addressHtml}
                    </a>
                </div>

                <div class="venue-card__schedule">
                    <h4>Schedule</h4>
                    ${this.renderScheduleList(venue.schedule)}
                </div>

                ${venue.host ? `
                    <div class="venue-card__host">
                        <h4>Host</h4>
                        ${venue.host.name ? `<div class="venue-card__host-name">${escapeHtml(venue.host.name)}</div>` : ''}
                        ${venue.host.affiliation ? `<div class="venue-card__host-affiliation">${escapeHtml(venue.host.affiliation)}</div>` : ''}
                        ${hostSocialsHtml ? `<div class="venue-card__host-socials">${hostSocialsHtml}</div>` : ''}
                    </div>
                ` : ''}

                ${socialLinksHtml ? `
                    <div class="venue-card__socials">
                        ${socialLinksHtml}
                    </div>
                ` : ''}
                ${renderTags(venue.tags, { dedicated: venue.dedicated })}
            </div>
        `;
    }

    renderScheduleList(schedule) {
        if (!schedule || schedule.length === 0) {
            return '<p class="venue-card__no-schedule">No schedule available</p>';
        }

        const items = schedule.map(entry => {
            const formatted = formatScheduleEntry(entry, { showEvery: false });

            // For one-time events, show the frequencyPrefix (event name) and day (date)
            const dayLabel = entry.frequency === 'once'
                ? `${formatted.frequencyPrefix} — ${formatted.day}`
                : `${formatted.frequencyPrefix}${formatted.day}`;

            const eventLink = entry.eventUrl ? `<a href="${escapeHtml(sanitizeUrl(entry.eventUrl) || '')}" target="_blank" rel="noopener noreferrer" class="venue-card__event-link" title="Event page"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : '';

            return `
                <li class="venue-card__schedule-item">
                    <span class="venue-card__schedule-day">${dayLabel}${eventLink}</span>
                    <span class="venue-card__schedule-time">${formatted.time}</span>
                </li>
            `;
        }).join('');

        return `<ul class="venue-card__schedule-list">${items}</ul>`;
    }

    getScheduleForDate(venue, date) {
        if (!date || !venue.schedule) return venue.schedule?.[0] || null;

        // Check for one-time event on this exact date first
        const onceEntry = venue.schedule.find(s =>
            s.frequency === 'once' && scheduleMatchesDate(s, date)
        );
        if (onceEntry) return onceEntry;

        // Fall back to recurring match
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        return venue.schedule.find(s => s.day?.toLowerCase() === dayName) || venue.schedule[0];
    }

    afterRender() {
        // Handle venue name click to show details
        this.delegate('click', '.venue-card__link', (e, target) => {
            e.preventDefault();
            emit(Events.VENUE_SELECTED, this.props.venue);
        });
    }
}

/**
 * Create a venue card without a component instance
 * Useful for rendering lists
 * @param {Object} venue - Venue data
 * @param {Object} options - Render options
 * @returns {string} HTML string
 */
export function renderVenueCard(venue, options = {}) {
    const { mode = 'compact', date = null, schedule = null, showSchedule = true } = options;

    // Create a temporary container and component
    const container = document.createElement('div');
    const card = new VenueCard(container, { venue, mode, date, schedule, showSchedule });
    return card.template();
}
