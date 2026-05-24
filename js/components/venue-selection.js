/**
 * Shared venue-selection listener.
 *
 * Wires a delegated click handler on `.venue-card` (or a custom selector)
 * that emits VENUE_SELECTED for the matched venue. Skips clicks that
 * originated on a nested <a> so embedded links (address, event URL) still
 * navigate normally.
 *
 * Used by WeeklyView and AlphabeticalView. MapView has its own marker-based
 * trigger that emits the same event payload.
 */

import { emit, Events } from '../core/events.js';
import { getVenueById } from '../services/venues.js';

/**
 * @param {Component} component - Component instance (must provide `delegate`)
 * @param {string} [selector='.venue-card'] - Card selector inside the component's container
 */
export function attachVenueSelectionListener(component, selector = '.venue-card') {
    component.delegate('click', selector, (e, target) => {
        if (e.target.closest('a')) return;
        e.preventDefault();
        const venue = getVenueById(target.dataset.venueId);
        if (venue) emit(Events.VENUE_SELECTED, venue);
    });
}
