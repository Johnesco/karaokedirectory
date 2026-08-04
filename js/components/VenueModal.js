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

        // Listen for venue selection events. MODAL_CLOSE was subscribed here
        // too, but nothing ever emitted it — the modal closes through its own
        // close button, backdrop, and Escape handlers.
        this.subscribe(on(Events.VENUE_SELECTED, (venue) => this.open(venue)));

        // Escape closes the modal. Bound once, here, rather than per-render:
        // afterRender() built a fresh closure and registered it with raw
        // document.addEventListener every time it ran, tracking only the newest
        // for removal. Selecting a venue while the modal was already open
        // therefore orphaned one listener per selection. It guards on isOpen
        // instead of relying on being unbound while closed.
        this.addEventListener(document, 'keydown', (e) => {
            if (e.key === 'Escape' && this.state.isOpen) this.close();
        });

        // Tab cycle. Bound here, not in trapFocus(), because trapFocus runs from
        // afterRender on every render and this.addEventListener does not
        // de-duplicate — binding it there would stack one handler per render
        // (#158). init() runs once per instance.
        this.addEventListener(document, 'keydown', (e) => {
            if (e.key !== 'Tab' || !this.state.isOpen) return;

            const items = this.focusableElements();
            if (!items.length) return;

            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;

            if (e.shiftKey && (active === first || !items.includes(active))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        });
    }

    template() {
        const { venue, isOpen } = this.state;

        if (!isOpen || !venue) {
            return '<div class="venue-modal" hidden></div>';
        }

        return `
            <div class="venue-modal venue-modal--open" role="dialog" aria-modal="true" aria-labelledby="venue-modal-title">
                <div class="venue-modal__backdrop"></div>
                <div class="venue-modal__content venue-detail">
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

                    ${renderVenueDetailSections(venue)}
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
        this.addEventListener('.venue-detail__share', 'click', (e) => {
            shareVenue(this.state.venue, e.currentTarget);
        });

        // Trap focus in modal
        this.trapFocus();
    }

    open(venue) {
        // Don't open modal on wide screens where detail pane is visible
        if (window.innerWidth >= 1400) {
            return;
        }
        // On map view the floating .map-venue-card is the contextual UI;
        // opening the modal would obscure the map.
        if (getState('view') === 'map') {
            return;
        }

        // Remember what had focus so close() can hand it back. Without this the
        // modal dropped focus to the top of the document on close, so a keyboard
        // user tabbing through the calendar landed back at the page start every
        // time they looked at a venue (#167).
        this._returnFocusTo = document.activeElement;

        this.setState({ venue, isOpen: true });
        document.body.style.overflow = 'hidden';
    }

    close() {
        document.body.style.overflow = '';
        this.setState({ isOpen: false });
        emit(Events.VENUE_CLOSED, this.state.venue);

        // Back to the card that opened it, if it is still in the document.
        const target = this._returnFocusTo;
        this._returnFocusTo = null;
        if (target && document.contains(target) && typeof target.focus === 'function') {
            target.focus();
        }
    }

    /** Everything inside the modal a user can tab to, in DOM order. */
    focusableElements() {
        const modal = this.$('.venue-modal__content');
        if (!modal) return [];
        return [...modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )].filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
    }

    /**
     * Move focus into the modal and keep it there.
     *
     * The old version only focused the first element and called that a trap —
     * Tab walked straight out into the page behind, which is still scrolled
     * and inert. This wraps at both ends (#167).
     */
    trapFocus() {
        const focusable = this.focusableElements();
        if (focusable.length) focusable[0].focus();
    }

    onDestroy() {
        // The keydown listener is not unbound here — it went through
        // this.addEventListener, so Component.destroy() has already removed it.
        // Body scroll must still be restored: destroying a component while its
        // modal is open would otherwise leave the page permanently unscrollable.
        document.body.style.overflow = '';
    }
}
