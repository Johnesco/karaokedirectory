/**
 * DayCard Component
 * Displays venues for a specific day in the weekly calendar view.
 *
 * Applies CSS state classes based on date and content:
 * - .day-card--today: Current day (purple border highlight)
 * - .day-card--past: Days before today (collapsed by default, click to expand)
 * - .day-card--empty: No venues match current filters/search (collapsed to header-only)
 *
 * Filtering:
 * - Respects showDedicated state for dedicated venue filter
 * - Respects searchQuery state for search filtering
 */

import { Component } from './Component.js';
import { renderVenueCard } from './VenueCard.js';
import { formatDateShort, isToday, getDayDisplayName, getDayName } from '../utils/date.js';
import { getVenueEventsForDate } from '../services/venues.js';
import { getState } from '../core/state.js';

/**
 * Check if a date is in the past (before today)
 */
function isPast(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
}

export class DayCard extends Component {
    /**
     * @param {HTMLElement|string} container
     * @param {Object} props
     * @param {Date} props.date - Date for this day
     */

    template() {
        const { date } = this.props;
        const showDedicated = getState('showDedicated');
        const searchQuery = getState('searchQuery');
        // One entry per matching schedule entry, so a venue with two events
        // on the same day renders two cards (each with its own event title/time).
        const events = getVenueEventsForDate(date, { includeDedicated: showDedicated, searchQuery });
        // Footer count is unique venues, since "venues" is the user-facing unit
        // even when a single venue contributes multiple cards.
        const uniqueVenueCount = new Set(events.map(e => e.venue.id)).size;

        const dayName = getDayDisplayName(date);
        const dateStr = formatDateShort(date);
        const dayOfWeek = getDayName(date);
        const todayClass = isToday(date) ? 'day-card--today' : '';
        const pastClass = isPast(date) ? 'day-card--past' : '';
        const emptyClass = events.length === 0 ? 'day-card--empty' : '';

        return `
            <article class="day-card day-card--${dayOfWeek} ${todayClass} ${pastClass} ${emptyClass}">
                <header class="day-card__header">
                    <h2 class="day-card__day">${dayName}</h2>
                    <span class="day-card__date">${dateStr}</span>
                    ${isToday(date) ? '<span class="day-card__today-badge">Today</span>' : ''}
                    <span class="day-card__expand-indicator">
                        <i class="fa-solid fa-chevron-down"></i>
                    </span>
                </header>

                <div class="day-card__content">
                    ${events.length > 0
                        ? this.renderEvents(events, date)
                        : '<p class="day-card__empty">No karaoke scheduled</p>'
                    }
                </div>

                ${events.length > 0 ? `
                    <footer class="day-card__footer">
                        <span class="day-card__count">${uniqueVenueCount} venue${uniqueVenueCount !== 1 ? 's' : ''}</span>
                    </footer>
                ` : ''}
            </article>
        `;
    }

    renderEvents(events, date) {
        return `
            <ul class="day-card__venues">
                ${events.map(({ venue, schedule }) => `
                    <li class="day-card__venue-item">
                        ${renderVenueCard(venue, { mode: 'compact', date, schedule, showSchedule: true })}
                    </li>
                `).join('')}
            </ul>
        `;
    }
}

/**
 * Render a day card without component instance
 * @param {Date} date - Date to render
 * @returns {string} HTML string
 */
export function renderDayCard(date) {
    const container = document.createElement('div');
    const card = new DayCard(container, { date });
    return card.template();
}
