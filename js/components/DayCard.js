/**
 * DayCard Component
 * Displays venues for a specific day
 */

import { Component } from './Component.js';
import { renderVenueCard } from './VenueCard.js';
import { formatDateShort, isToday, getDayDisplayName } from '../utils/date.js';
import { getVenuesForDate } from '../services/venues.js';
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
        const venues = getVenuesForDate(date, { includeDedicated: showDedicated });

        const dayName = getDayDisplayName(date);
        const dateStr = formatDateShort(date);
        const todayClass = isToday(date) ? 'day-card--today' : '';
        const pastClass = isPast(date) ? 'day-card--past' : '';
        const emptyClass = venues.length === 0 ? 'day-card--empty' : '';

        return `
            <article class="day-card ${todayClass} ${pastClass} ${emptyClass}">
                <header class="day-card__header">
                    <h2 class="day-card__day">${dayName}</h2>
                    <span class="day-card__date">${dateStr}</span>
                    ${isToday(date) ? '<span class="day-card__today-badge">Today</span>' : ''}
                </header>

                <div class="day-card__content">
                    ${venues.length > 0
                        ? this.renderVenues(venues, date)
                        : '<p class="day-card__empty">No karaoke scheduled</p>'
                    }
                </div>

                ${venues.length > 0 ? `
                    <footer class="day-card__footer">
                        <span class="day-card__count">${venues.length} venue${venues.length !== 1 ? 's' : ''}</span>
                    </footer>
                ` : ''}
            </article>
        `;
    }

    renderVenues(venues, date) {
        return `
            <ul class="day-card__venues">
                ${venues.map(venue => `
                    <li class="day-card__venue-item">
                        ${renderVenueCard(venue, { mode: 'compact', date, showSchedule: true })}
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
