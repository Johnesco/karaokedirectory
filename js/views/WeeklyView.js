/**
 * WeeklyView
 * Displays 7-day schedule of karaoke venues.
 * Renders DayCard components for each day in the current week.
 * Responds to weekStart, showDedicated, and search filter changes.
 */

import { Component } from '../components/Component.js';
import { renderDayCard } from '../components/DayCard.js';
import { renderExtendedSection, attachExtendedSectionListeners } from '../components/ExtendedSection.js';
import { getState, subscribe } from '../core/state.js';
import { on, emit, Events } from '../core/events.js';
import { getWeekDates, getWeekStart, getNextWeekRange, getThisMonthRange, getNextMonthRange, getMonthName } from '../utils/date.js';
import { getVenueById, getVenuesForDate } from '../services/venues.js';

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
        const searchQuery = getState('searchQuery');
        const currentWeekStart = getWeekStart(weekStart);
        const dates = getWeekDates(currentWeekStart);

        // Render current week
        const currentWeekHtml = dates.map(date => `
            <div class="weekly-view__day">
                ${renderDayCard(date)}
            </div>
        `).join('');

        // Extended sections (Next Week, This Month, Next Month)
        const extendedSectionsHtml = this.renderExtendedSections(currentWeekStart, dates);

        return `
            <div class="weekly-view">
                <div class="weekly-view__grid">
                    ${currentWeekHtml}
                </div>
                ${extendedSectionsHtml}
            </div>
        `;
    }

    /**
     * Render extended sections (Next Week, This Month, Next Month)
     * @param {Date} currentWeekStart - Start of current week
     * @param {Date[]} currentWeekDates - Dates in current week
     * @returns {string} HTML for extended sections
     */
    renderExtendedSections(currentWeekStart, currentWeekDates) {
        const today = new Date();
        const showDedicated = getState('showDedicated');
        const searchQuery = getState('searchQuery');
        const seenVenues = new Set();

        // Collect venue IDs from current week (no deduplication for current week)
        currentWeekDates.forEach(date => {
            const venues = getVenuesForDate(date, { includeDedicated: showDedicated, searchQuery });
            venues.forEach(v => seenVenues.add(v.id));
        });

        const sections = [];

        // Next Week section
        const nextWeekRange = getNextWeekRange(currentWeekStart);
        sections.push(renderExtendedSection({
            title: 'Next Week',
            startDate: nextWeekRange.start,
            endDate: nextWeekRange.end,
            seenVenues,
            deduplicate: false // Show all matches in Next Week
        }));

        // This Month section (after next week, within current month)
        const thisMonthRange = getThisMonthRange(nextWeekRange.end);
        if (thisMonthRange) {
            const monthName = getMonthName(thisMonthRange.start);
            sections.push(renderExtendedSection({
                title: `Later in ${monthName}`,
                startDate: thisMonthRange.start,
                endDate: thisMonthRange.end,
                seenVenues,
                deduplicate: true // Skip venues already shown
            }));
        }

        // Next Month section
        const nextMonthRange = getNextMonthRange(today, 60);
        if (nextMonthRange) {
            const monthName = getMonthName(nextMonthRange.start);
            sections.push(renderExtendedSection({
                title: monthName,
                startDate: nextMonthRange.start,
                endDate: nextMonthRange.end,
                seenVenues,
                deduplicate: true // Skip venues already shown
            }));
        }

        return sections.filter(s => s).join('');
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

        // Attach extended section toggle listeners
        if (this.container) {
            attachExtendedSectionListeners(this.container);
        }

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
