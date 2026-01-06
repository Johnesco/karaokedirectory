/**
 * VenueModal Component
 * Full-screen modal for venue details
 */

import { Component } from './Component.js';
import { escapeHtml } from '../utils/string.js';
import { formatTimeRange } from '../utils/date.js';
import { buildMapUrl, buildDirectionsUrl, createSocialLinks, formatAddress } from '../utils/url.js';
import { on, emit, Events } from '../core/events.js';

export class VenueModal extends Component {
    init() {
        this.state = {
            venue: null,
            isOpen: false
        };

        // Listen for venue selection events
        this.subscribe(on(Events.VENUE_SELECTED, (venue) => this.open(venue)));
        this.subscribe(on(Events.MODAL_CLOSE, () => this.close()));
    }

    template() {
        const { venue, isOpen } = this.state;

        if (!isOpen || !venue) {
            return '<div class="venue-modal" hidden></div>';
        }

        const addressHtml = formatAddress(venue.address);
        const mapUrl = buildMapUrl(venue.address, venue.name);
        const directionsUrl = buildDirectionsUrl(venue.address, venue.name);
        const socialLinksHtml = createSocialLinks(venue.socials, { size: 'fa-lg' });
        const hostSocialsHtml = venue.host?.socials
            ? createSocialLinks(venue.host.socials, { size: 'fa-lg' })
            : '';

        return `
            <div class="venue-modal venue-modal--open" role="dialog" aria-modal="true" aria-labelledby="venue-modal-title">
                <div class="venue-modal__backdrop"></div>
                <div class="venue-modal__content">
                    <button class="venue-modal__close" type="button" aria-label="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>

                    <header class="venue-modal__header">
                        <h2 id="venue-modal-title" class="venue-modal__title">
                            ${escapeHtml(venue.name)}
                        </h2>
                        ${venue.dedicated ? '<span class="venue-modal__badge">Dedicated Karaoke Venue</span>' : ''}
                        ${venue.eventName ? `<p class="venue-modal__event-name">${escapeHtml(venue.eventName)}</p>` : ''}
                    </header>

                    <section class="venue-modal__section">
                        <h3><i class="fa-solid fa-location-dot"></i> Location</h3>
                        <address class="venue-modal__address">
                            ${addressHtml}
                        </address>
                        <div class="venue-modal__map-links">
                            <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary">
                                <i class="fa-solid fa-map"></i> View Map
                            </a>
                            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary">
                                <i class="fa-solid fa-diamond-turn-right"></i> Directions
                            </a>
                        </div>
                    </section>

                    <section class="venue-modal__section">
                        <h3><i class="fa-regular fa-calendar"></i> Schedule</h3>
                        ${this.renderSchedule(venue.schedule)}
                        ${venue.dateRange ? this.renderDateRange(venue.dateRange) : ''}
                    </section>

                    ${venue.host ? `
                        <section class="venue-modal__section">
                            <h3><i class="fa-solid fa-microphone"></i> Karaoke Host</h3>
                            <div class="venue-modal__host">
                                ${venue.host.name ? `<p class="venue-modal__host-name">${escapeHtml(venue.host.name)}</p>` : ''}
                                ${venue.host.company ? `<p class="venue-modal__host-company">${escapeHtml(venue.host.company)}</p>` : ''}
                                ${venue.host.website ? `
                                    <a href="${escapeHtml(venue.host.website)}" target="_blank" rel="noopener noreferrer" class="venue-modal__host-website">
                                        <i class="fa-solid fa-globe"></i> Website
                                    </a>
                                ` : ''}
                                ${hostSocialsHtml ? `
                                    <p class="venue-modal__socials-label">KJ Social Media</p>
                                    <div class="venue-modal__host-socials">${hostSocialsHtml}</div>
                                ` : ''}
                            </div>
                        </section>
                    ` : ''}

                    ${socialLinksHtml ? `
                        <section class="venue-modal__section">
                            <h3><i class="fa-solid fa-share-nodes"></i> Venue Social Media</h3>
                            <div class="venue-modal__socials">
                                ${socialLinksHtml}
                            </div>
                        </section>
                    ` : ''}

                    ${venue.phone ? `
                        <section class="venue-modal__section">
                            <h3><i class="fa-solid fa-phone"></i> Contact</h3>
                            <a href="tel:${venue.phone}" class="venue-modal__phone">${escapeHtml(venue.phone)}</a>
                        </section>
                    ` : ''}
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
            <table class="venue-modal__schedule-table">
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

        return text ? `<p class="venue-modal__date-range"><i class="fa-solid fa-calendar-check"></i> ${text}</p>` : '';
    }

    afterRender() {
        if (!this.state.isOpen) return;

        // Close button
        this.addEventListener('.venue-modal__close', 'click', () => this.close());

        // Backdrop click
        this.addEventListener('.venue-modal__backdrop', 'click', () => this.close());

        // Escape key
        this._escHandler = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this._escHandler);

        // Trap focus in modal
        this.trapFocus();
    }

    open(venue) {
        // Don't open modal on wide screens where detail pane is visible
        if (window.innerWidth >= 1400) {
            return;
        }
        this.setState({ venue, isOpen: true });
        document.body.style.overflow = 'hidden';
        emit(Events.MODAL_OPEN, venue);
    }

    close() {
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
        }
        document.body.style.overflow = '';
        this.setState({ isOpen: false });
        emit(Events.VENUE_CLOSED, this.state.venue);
    }

    trapFocus() {
        const modal = this.$('.venue-modal__content');
        if (!modal) return;

        const focusable = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusable.length) {
            focusable[0].focus();
        }
    }

    onDestroy() {
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
        }
        document.body.style.overflow = '';
    }
}
