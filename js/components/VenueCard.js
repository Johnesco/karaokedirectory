/**
 * VenueCard Component
 * Displays venue information in compact or full mode
 */

import { Component } from './Component.js';
import { escapeHtml } from '../utils/string.js';
import { formatTimeRange, getScheduleExclusion } from '../utils/date.js';
import { buildMapUrl, formatAddress, sanitizeUrl } from '../utils/url.js';
import { emit, Events } from '../core/events.js';
import { isDebugMode, getDebugHtml } from '../utils/debug.js';
import { renderTags } from '../utils/tags.js';
import { formatHostDisplay, renderScheduleContext, renderVenueDetailSections } from '../utils/render.js';

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

    compactTemplate(venue, date, showSchedule, schedule) {
        // `schedule` is required in compact mode: the caller already knows which
        // entry matched the date it is rendering, so it passes that entry.
        //
        // A getScheduleForDate() fallback used to sit here for callers that
        // omitted it. It matched on weekday alone with no frequency check — so
        // a "first Monday" show would have been picked for any Monday — and
        // then fell back to schedule[0], an unrelated entry with the wrong
        // time. Nothing ever reached it (getVenueEventsForDate always supplies
        // the matched entry), so it was a wrong-time bug one call site away
        // from activating rather than a live one. Deleted in #160.
        if (!schedule) {
            console.warn(`VenueCard: compact mode needs a schedule entry (venue: ${venue?.id})`);
        }

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

        // formatAddress escapes its own fields (#160) — do not wrap this in
        // escapeHtml, or the separators it emits get escaped too.
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
                        ${fullAddress}
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
        // Inline-expanded card for the Alphabetical view. Delegates to the same
        // shared section renderer the modal/pane/map detail use, so the A–Z card
        // shows the same facts (per-show hosts, exclusions, upcoming closures,
        // active period). `actions: false` drops the View Map / Directions / Share
        // button row to keep the long A–Z list light — full actions live in the
        // detail pane/modal opened on click.
        return `
            <div class="venue-card venue-card--full venue-detail venue-detail--inline" data-venue-id="${escapeHtml(venue.id)}">
                <div class="venue-card__header">
                    <h3 class="venue-card__name">
                        <button class="venue-card__link" type="button">
                            ${escapeHtml(venue.name)}
                        </button>
                    </h3>
                    ${renderTags(venue.tags, { dedicated: venue.dedicated })}
                </div>
                ${renderVenueDetailSections(venue, { actions: false })}
            </div>
        `;
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
