/**
 * VenueModal Component
 * Full-screen modal for venue details
 */

import { Component } from './Component.js';
import { escapeHtml } from '../utils/string.js';
import { shareVenue } from '../utils/url.js';
import { on, emit, Events } from '../core/events.js';
import { getState } from '../core/state.js';
import { renderTags } from '../utils/tags.js';
import { renderVenueDetailSections } from '../utils/render.js';

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

                    ${renderVenueDetailSections(venue, { classPrefix: 'venue-modal' })}
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

        // Share button
        this.addEventListener('.venue-modal__share', 'click', (e) => {
            shareVenue(this.state.venue, e.currentTarget);
        });

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
