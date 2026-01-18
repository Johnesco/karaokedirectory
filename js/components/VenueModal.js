/**
 * VenueModal Component
 * Full-screen modal for venue details
 */

import { Component } from './Component.js';
import { escapeHtml } from '../utils/string.js';
import { buildMapUrl, buildDirectionsUrl, createSocialLinks, formatAddress } from '../utils/url.js';
import { on, emit, Events } from '../core/events.js';
import { getState } from '../core/state.js';
import { renderTags } from '../utils/tags.js';
import { renderScheduleTable, renderDateRange, renderHostSection } from '../utils/render.js';

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
                        ${venue.eventName ? `<p class="venue-modal__event-name">${escapeHtml(venue.eventName)}</p>` : ''}
                        ${renderTags(venue.tags, { dedicated: venue.dedicated })}
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
                        ${renderScheduleTable(venue.schedule, 'venue-modal')}
                        ${renderDateRange(venue.dateRange, 'venue-modal')}
                    </section>

                    ${renderHostSection(venue.host, 'venue-modal')}

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

        // Don't open modal in map view (immersive mode handles its own venue display)
        if (getState('view') === 'map') {
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
