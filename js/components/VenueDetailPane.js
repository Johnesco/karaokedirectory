/**
 * VenueDetailPane Component
 * Sticky side panel for venue details on wide screens
 */

import { Component } from './Component.js';
import { escapeHtml } from '../utils/string.js';
import { formatTimeRange } from '../utils/date.js';
import { buildMapUrl, buildDirectionsUrl, createSocialLinks, formatAddress } from '../utils/url.js';
import { on, emit, Events } from '../core/events.js';

export class VenueDetailPane extends Component {
    init() {
        this.state = {
            venue: null
        };

        // Listen for venue selection events
        this.subscribe(on(Events.VENUE_SELECTED, (venue) => this.showVenue(venue)));
        this.subscribe(on(Events.VENUE_CLOSED, () => this.clearVenue()));
    }

    template() {
        const { venue } = this.state;

        if (!venue) {
            return this.renderEmptyState();
        }

        const addressHtml = formatAddress(venue.address);
        const mapUrl = buildMapUrl(venue.address, venue.name);
        const directionsUrl = buildDirectionsUrl(venue.address, venue.name);
        const socialLinksHtml = createSocialLinks(venue.socials, { size: 'fa-lg' });
        const hostSocialsHtml = venue.host?.socials
            ? createSocialLinks(venue.host.socials, { size: 'fa-lg' })
            : '';

        return `
            <div class="detail-pane">
                <header class="detail-pane__header">
                    <h2 class="detail-pane__title">
                        ${escapeHtml(venue.name)}
                    </h2>
                    ${venue.dedicated ? '<span class="detail-pane__badge">Dedicated Karaoke Venue</span>' : ''}
                    ${venue.eventName ? `<p class="detail-pane__event-name">${escapeHtml(venue.eventName)}</p>` : ''}
                </header>

                <section class="detail-pane__section">
                    <h3><i class="fa-solid fa-location-dot"></i> Location</h3>
                    <address class="detail-pane__address">
                        ${addressHtml}
                    </address>
                    <div class="detail-pane__map-links">
                        <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary">
                            <i class="fa-solid fa-map"></i> View Map
                        </a>
                        <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary">
                            <i class="fa-solid fa-diamond-turn-right"></i> Directions
                        </a>
                    </div>
                </section>

                <section class="detail-pane__section">
                    <h3><i class="fa-regular fa-calendar"></i> Schedule</h3>
                    ${this.renderSchedule(venue.schedule)}
                    ${venue.dateRange ? this.renderDateRange(venue.dateRange) : ''}
                </section>

                ${venue.host ? `
                    <section class="detail-pane__section">
                        <h3><i class="fa-solid fa-microphone"></i> Karaoke Host</h3>
                        <div class="detail-pane__host">
                            ${venue.host.name ? `<p class="detail-pane__host-name">${escapeHtml(venue.host.name)}</p>` : ''}
                            ${venue.host.company ? `<p class="detail-pane__host-company">${escapeHtml(venue.host.company)}</p>` : ''}
                            ${venue.host.website ? `
                                <a href="${escapeHtml(venue.host.website)}" target="_blank" rel="noopener noreferrer" class="detail-pane__host-website">
                                    <i class="fa-solid fa-globe"></i> Website
                                </a>
                            ` : ''}
                            ${hostSocialsHtml ? `
                                <p class="detail-pane__socials-label">KJ Social Media</p>
                                <div class="detail-pane__host-socials">${hostSocialsHtml}</div>
                            ` : ''}
                        </div>
                    </section>
                ` : ''}

                ${socialLinksHtml ? `
                    <section class="detail-pane__section">
                        <h3><i class="fa-solid fa-share-nodes"></i> Venue Social Media</h3>
                        <div class="detail-pane__socials">
                            ${socialLinksHtml}
                        </div>
                    </section>
                ` : ''}

                ${venue.phone ? `
                    <section class="detail-pane__section">
                        <h3><i class="fa-solid fa-phone"></i> Contact</h3>
                        <a href="tel:${venue.phone}" class="detail-pane__phone">${escapeHtml(venue.phone)}</a>
                    </section>
                ` : ''}
            </div>
        `;
    }

    renderEmptyState() {
        return `
            <div class="detail-pane detail-pane--empty">
                <div class="detail-pane__empty-content">
                    <i class="fa-solid fa-microphone detail-pane__empty-icon"></i>
                    <p class="detail-pane__empty-text">Select a venue to see details, schedule, and host information</p>
                </div>
            </div>
        `;
    }

    renderSchedule(schedule) {
        if (!schedule || schedule.length === 0) {
            return '<p>No schedule information available.</p>';
        }

        const rows = schedule.map(entry => {
            const day = entry.day.charAt(0).toUpperCase() + entry.day.slice(1);
            const freq = entry.frequency === 'every'
                ? 'Every'
                : entry.frequency.charAt(0).toUpperCase() + entry.frequency.slice(1);
            const time = formatTimeRange(entry.startTime, entry.endTime);

            return `
                <tr>
                    <td>${freq} ${day}</td>
                    <td>${time}</td>
                    ${entry.note ? `<td class="schedule-note">${escapeHtml(entry.note)}</td>` : '<td></td>'}
                </tr>
            `;
        }).join('');

        return `
            <table class="detail-pane__schedule-table">
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

    renderDateRange(dateRange) {
        const { start, end } = dateRange;
        let text = '';

        if (start && end) {
            text = `Available ${start} to ${end}`;
        } else if (start) {
            text = `Starting ${start}`;
        } else if (end) {
            text = `Until ${end}`;
        }

        return text ? `<p class="detail-pane__date-range"><i class="fa-solid fa-calendar-check"></i> ${text}</p>` : '';
    }

    showVenue(venue) {
        this.setState({ venue });
        // Emit event so VenueCard can show selected state
        emit(Events.VENUE_DETAIL_SHOWN, venue);
    }

    clearVenue() {
        this.setState({ venue: null });
    }
}
