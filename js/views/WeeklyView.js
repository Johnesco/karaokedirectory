/**
 * WeeklyView
 * Displays 7-day schedule of karaoke venues.
 * Renders DayCard components for each day in the current week.
 * Responds to weekStart, showDedicated, and search filter changes.
 */

import { Component } from '../components/Component.js';
import { renderDayCard } from '../components/DayCard.js';
import { getState, subscribe } from '../core/state.js';
import { on, emit, Events } from '../core/events.js';
import { getWeekDates, getWeekStart } from '../utils/date.js';
import { getVenueById } from '../services/venues.js';

export class WeeklyView extends Component {
    init() {
        // Re-render when relevant state changes
        this.subscribe(subscribe('weekStart', () => this.render()));
        this.subscribe(subscribe('showDedicated', () => this.render()));

        // Listen for filter changes
        this.subscribe(on(Events.FILTER_CHANGED, () => this.render()));
    }

    template() {
        const weekStart = getState('weekStart');
        const dates = getWeekDates(getWeekStart(weekStart));

        return `
            <div class="weekly-view">
                <div class="weekly-view__grid">
                    ${dates.map(date => `
                        <div class="weekly-view__day">
                            ${renderDayCard(date)}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    afterRender() {
        // Event delegation for past day card header clicks to toggle expansion
        this.delegate('click', '.day-card--past .day-card__header', (_e, target) => {
            const dayCard = target.closest('.day-card--past');
            if (dayCard) {
                dayCard.classList.toggle('day-card--expanded');
            }
        });

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

        // Auto-scroll to today if viewing current week
        this.scrollToToday();
    }

    scrollToToday() {
        const weekStart = getState('weekStart');
        const today = new Date();
        const weekStartDate = getWeekStart(weekStart);
        const currentWeekStart = getWeekStart(today);

        // Check if we're viewing the current week
        if (weekStartDate.toDateString() === currentWeekStart.toDateString()) {
            const todayCard = this.$('.day-card--today');
            if (todayCard) {
                // Instant scroll to today's card
                todayCard.scrollIntoView({ behavior: 'instant', block: 'start' });
            }
        }
    }
}
