/**
 * VenueDetailPane Component
 * Sticky side panel for venue details on wide screens
 */

import { Component } from './Component.js';
import { escapeHtml } from '../utils/string.js';
import { buildMapUrl, buildDirectionsUrl, createSocialLinks, formatAddress } from '../utils/url.js';
import { on, emit, Events } from '../core/events.js';
import { renderTags } from '../utils/tags.js';
import { renderScheduleTable, renderDateRange, renderHostSection, renderDedicatedBadge } from '../utils/render.js';

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

        return `
            <div class="detail-pane">
                <header class="detail-pane__header">
                    <h2 class="detail-pane__title">
                        ${escapeHtml(venue.name)}
                    </h2>
                    ${renderDedicatedBadge(venue.dedicated, 'detail-pane', { fullText: true })}
                    ${venue.eventName ? `<p class="detail-pane__event-name">${escapeHtml(venue.eventName)}</p>` : ''}
                    ${renderTags(venue.tags)}
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
                    ${renderScheduleTable(venue.schedule, 'detail-pane')}
                    ${renderDateRange(venue.dateRange, 'detail-pane')}
                </section>

                ${renderHostSection(venue.host, 'detail-pane')}

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

    showVenue(venue) {
        this.setState({ venue });
        // Emit event so VenueCard can show selected state
        emit(Events.VENUE_DETAIL_SHOWN, venue);
    }

    clearVenue() {
        this.setState({ venue: null });
    }
}
