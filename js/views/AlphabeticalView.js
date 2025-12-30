/**
 * AlphabeticalView
 * Displays all venues sorted A-Z
 */

import { Component } from '../components/Component.js';
import { renderVenueCard } from '../components/VenueCard.js';
import { getState, subscribe } from '../core/state.js';
import { on, emit, Events } from '../core/events.js';
import { getVenuesSorted, getVenueById } from '../services/venues.js';
import { getSortableName } from '../utils/string.js';

export class AlphabeticalView extends Component {
    init() {
        // Re-render when relevant state changes
        this.subscribe(subscribe('showDedicated', () => this.render()));
        this.subscribe(on(Events.FILTER_CHANGED, () => this.render()));
    }

    template() {
        const showDedicated = getState('showDedicated');
        const venues = getVenuesSorted({ includeDedicated: showDedicated });

        if (venues.length === 0) {
            return `
                <div class="alphabetical-view">
                    <p class="alphabetical-view__empty">No venues found.</p>
                </div>
            `;
        }

        // Group venues by first letter
        const groups = this.groupByLetter(venues);

        return `
            <div class="alphabetical-view">
                <div class="alphabetical-view__index">
                    ${Object.keys(groups).map(letter => `
                        <a href="#venues-${letter}" class="alphabetical-view__index-link">${letter}</a>
                    `).join('')}
                </div>

                <div class="alphabetical-view__list">
                    ${Object.entries(groups).map(([letter, letterVenues]) => `
                        <section class="alphabetical-view__group" id="venues-${letter}">
                            <h2 class="alphabetical-view__letter">${letter}</h2>
                            <div class="alphabetical-view__venues">
                                ${letterVenues.map(venue => `
                                    <div class="alphabetical-view__venue">
                                        ${renderVenueCard(venue, { mode: 'full' })}
                                    </div>
                                `).join('')}
                            </div>
                        </section>
                    `).join('')}
                </div>

                <p class="alphabetical-view__count">
                    ${venues.length} venue${venues.length !== 1 ? 's' : ''} total
                </p>
            </div>
        `;
    }

    groupByLetter(venues) {
        const groups = {};

        venues.forEach(venue => {
            const sortName = getSortableName(venue.name);
            const letter = sortName.charAt(0).toUpperCase();

            if (!groups[letter]) {
                groups[letter] = [];
            }
            groups[letter].push(venue);
        });

        return groups;
    }

    afterRender() {
        // Event delegation for venue card clicks (whole card is clickable)
        this.delegate('click', '.venue-card', (e, target) => {
            // Don't trigger modal if clicking on a link (like address)
            if (e.target.closest('a')) {
                return;
            }

            e.preventDefault();
            const venueId = target.dataset.venueId;
            const venue = getVenueById(venueId);
            if (venue) {
                emit(Events.VENUE_SELECTED, venue);
            }
        });
    }
}
