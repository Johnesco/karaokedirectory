/**
 * Navigation Component
 * View toggles, week navigation, and filters
 */

import { Component } from './Component.js';
import { getState, setState, subscribe, navigateWeek, goToCurrentWeek } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { formatWeekRange, getWeekStart } from '../utils/date.js';

export class Navigation extends Component {
    init() {
        // Subscribe to state changes
        this.subscribe(subscribe('view', () => this.render()));
        this.subscribe(subscribe('weekStart', () => this.render()));
        this.subscribe(subscribe('showDedicated', () => this.render()));
    }

    template() {
        const view = getState('view');
        const weekStart = getState('weekStart');
        const showDedicated = getState('showDedicated');

        const weekRange = formatWeekRange(getWeekStart(weekStart));
        const isCurrentWeek = this.isCurrentWeek(weekStart);

        return `
            <nav class="navigation">
                <div class="navigation__views">
                    <button
                        class="nav-btn ${view === 'weekly' ? 'nav-btn--active' : ''}"
                        data-view="weekly"
                        type="button"
                    >
                        <i class="fa-regular fa-calendar"></i>
                        <span>Weekly</span>
                    </button>
                    <button
                        class="nav-btn ${view === 'alphabetical' ? 'nav-btn--active' : ''}"
                        data-view="alphabetical"
                        type="button"
                    >
                        <i class="fa-solid fa-list"></i>
                        <span>A-Z</span>
                    </button>
                    <button
                        class="nav-btn ${view === 'map' ? 'nav-btn--active' : ''}"
                        data-view="map"
                        type="button"
                    >
                        <i class="fa-solid fa-map-location-dot"></i>
                        <span>Map</span>
                    </button>
                </div>

                ${view === 'weekly' ? `
                    <div class="navigation__week">
                        <button class="nav-btn nav-btn--icon" data-week="-1" type="button" title="Previous week">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <span class="navigation__week-range">${weekRange}</span>
                        <button class="nav-btn nav-btn--icon" data-week="1" type="button" title="Next week">
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                        ${!isCurrentWeek ? `
                            <button class="nav-btn nav-btn--small" data-week="today" type="button">
                                Today
                            </button>
                        ` : ''}
                    </div>
                ` : ''}

                <div class="navigation__filters">
                    <label class="navigation__toggle">
                        <input
                            type="checkbox"
                            ${showDedicated ? 'checked' : ''}
                            data-filter="dedicated"
                        >
                        <span>Show dedicated venues</span>
                    </label>
                </div>
            </nav>
        `;
    }

    isCurrentWeek(weekStart) {
        const today = new Date();
        const currentWeekStart = getWeekStart(today);
        const compareWeekStart = getWeekStart(weekStart);
        return currentWeekStart.toDateString() === compareWeekStart.toDateString();
    }

    afterRender() {
        // View toggle buttons
        this.delegate('click', '[data-view]', (e, target) => {
            const view = target.dataset.view;
            setState({ view });
            emit(Events.VIEW_CHANGED, view);
        });

        // Week navigation
        this.delegate('click', '[data-week]', (e, target) => {
            const action = target.dataset.week;
            if (action === 'today') {
                goToCurrentWeek();
            } else {
                navigateWeek(parseInt(action, 10));
            }
            emit(Events.WEEK_CHANGED, getState('weekStart'));
        });

        // Dedicated toggle
        this.delegate('change', '[data-filter="dedicated"]', (e, target) => {
            setState({ showDedicated: target.checked });
            emit(Events.FILTER_CHANGED, { showDedicated: target.checked });
        });
    }
}
