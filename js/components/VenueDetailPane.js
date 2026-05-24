/**
 * VenueDetailPane Component
 * Sticky side panel for venue details on wide screens
 */

import { Component } from './Component.js';
import { escapeHtml } from '../utils/string.js';
import { shareVenue } from '../utils/url.js';
import { on, emit, Events } from '../core/events.js';
import { renderTags } from '../utils/tags.js';
import { renderVenueDetailSections } from '../utils/render.js';

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

        return `
            <div class="detail-pane">
                <header class="detail-pane__header">
                    <h2 class="detail-pane__title">
                        ${escapeHtml(venue.name)}
                    </h2>
                    ${venue.eventName ? `<p class="detail-pane__event-name">${escapeHtml(venue.eventName)}</p>` : ''}
                    ${renderTags(venue.tags, { dedicated: venue.dedicated })}
                </header>

                ${renderVenueDetailSections(venue, { classPrefix: 'detail-pane' })}
            </div>
        `;
    }

    afterRender() {
        if (!this.state.venue) return;

        // Share button
        this.addEventListener('.detail-pane__share', 'click', (e) => {
            shareVenue(this.state.venue, e.currentTarget);
        });
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
