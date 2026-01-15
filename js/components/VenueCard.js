/**
 * VenueCard Component
 * Displays venue information in compact or full mode
 */

import { Component } from './Component.js';
import { escapeHtml } from '../utils/string.js';
import { formatTimeRange, formatScheduleEntry } from '../utils/date.js';
import { buildMapUrl, createSocialLinks, formatAddress } from '../utils/url.js';
import { emit, Events } from '../core/events.js';
import { isDebugMode, getDebugHtml } from '../utils/debug.js';
import { renderTags } from '../utils/tags.js';
import { formatHostDisplay, renderDedicatedBadge } from '../utils/render.js';

export class VenueCard extends Component {
    /**
     * @param {HTMLElement|string} container
     * @param {Object} props
     * @param {Object} props.venue - Venue data
     * @param {string} [props.mode='compact'] - Display mode: 'compact' | 'full'
     * @param {Date} [props.date] - Date for schedule display
     * @param {boolean} [props.showSchedule=true] - Show schedule info
     */
    init() {
        this.state = {
            expanded: false
        };
    }

    template() {
        const { venue, mode = 'compact', date, showSchedule = true } = this.props;

        if (mode === 'compact') {
            return this.compactTemplate(venue, date, showSchedule);
        }
        return this.fullTemplate(venue);
    }

    compactTemplate(venue, date, showSchedule) {
        const schedule = this.getScheduleForDate(venue, date);
        const timeDisplay = schedule
            ? formatTimeRange(schedule.startTime, schedule.endTime)
            : '';

        // Build full address string and map URL
        const fullAddress = formatAddress(venue.address);
        const mapsUrl = buildMapUrl(venue.address, venue.name);

        // KJ/Host info using shared utility
        const hostDisplay = formatHostDisplay(venue.host);

        // Debug info for schedule matching
        const debugHtml = getDebugHtml(venue, date);

        return `
            <div class="venue-card venue-card--compact" data-venue-id="${escapeHtml(venue.id)}">
                ${debugHtml}
                <div class="venue-card__header">
                    <h3 class="venue-card__name">
                        <button class="venue-card__link" type="button">
                            ${escapeHtml(venue.name)}
                        </button>
                    </h3>
                    ${renderDedicatedBadge(venue.dedicated, 'venue-card')}
                </div>
                ${renderTags(venue.tags)}
                ${showSchedule && timeDisplay ? `
                    <div class="venue-card__time">
                        <i class="fa-regular fa-clock"></i> ${timeDisplay}
                        ${schedule?.note ? `<span class="venue-card__note">${escapeHtml(schedule.note)}</span>` : ''}
                    </div>
                ` : ''}
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
                    ${renderDedicatedBadge(venue.dedicated, 'venue-card')}
                </div>
                ${renderTags(venue.tags)}

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
                        ${venue.host.company ? `<div class="venue-card__host-company">${escapeHtml(venue.host.company)}</div>` : ''}
                        ${hostSocialsHtml ? `<div class="venue-card__host-socials">${hostSocialsHtml}</div>` : ''}
                    </div>
                ` : ''}

                ${socialLinksHtml ? `
                    <div class="venue-card__socials">
                        ${socialLinksHtml}
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderScheduleList(schedule) {
        if (!schedule || schedule.length === 0) {
            return '<p class="venue-card__no-schedule">No schedule available</p>';
        }

        const items = schedule.map(entry => {
            const { day, frequencyPrefix, time } = formatScheduleEntry(entry, { showEvery: false });

            return `
                <li class="venue-card__schedule-item">
                    <span class="venue-card__schedule-day">${frequencyPrefix}${day}</span>
                    <span class="venue-card__schedule-time">${time}</span>
                    ${entry.note ? `<span class="venue-card__schedule-note">${escapeHtml(entry.note)}</span>` : ''}
                </li>
            `;
        }).join('');

        return `<ul class="venue-card__schedule-list">${items}</ul>`;
    }

    getScheduleForDate(venue, date) {
        if (!date || !venue.schedule) return venue.schedule?.[0] || null;

        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        return venue.schedule.find(s => s.day === dayName) || venue.schedule[0];
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
    const { mode = 'compact', date = null, showSchedule = true } = options;

    // Create a temporary container and component
    const container = document.createElement('div');
    const card = new VenueCard(container, { venue, mode, date, showSchedule });
    return card.template();
}
