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
        // Don't re-render on searchQuery change to avoid losing focus
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
                        class="nav-btn nav-btn--labeled ${view === 'weekly' ? 'nav-btn--active' : ''}"
                        data-view="weekly"
                        type="button"
                    >
                        <i class="fa-regular fa-calendar"></i>
                        <span class="nav-btn__label">CAL</span>
                    </button>
                    <button
                        class="nav-btn nav-btn--labeled ${view === 'alphabetical' ? 'nav-btn--active' : ''}"
                        data-view="alphabetical"
                        type="button"
                    >
                        <i class="fa-solid fa-list"></i>
                        <span class="nav-btn__label">A-Z</span>
                    </button>
                    <button
                        class="nav-btn nav-btn--labeled ${view === 'map' ? 'nav-btn--active' : ''}"
                        data-view="map"
                        type="button"
                    >
                        <i class="fa-solid fa-map-location-dot"></i>
                        <span class="nav-btn__label">MAP</span>
                    </button>
                    <a
                        class="nav-btn nav-btn--labeled"
                        href="bingo.html"
                    >
                        <i class="fa-solid fa-table-cells"></i>
                        <span class="nav-btn__label">BINGO</span>
                    </a>
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

                <div class="navigation__search">
                    <div class="search-input">
                        <i class="fa-solid fa-magnifying-glass search-input__icon"></i>
                        <input
                            type="text"
                            class="search-input__field"
                            placeholder="Search venues, tags, hosts..."
                            data-search="query"
                            value="${getState('searchQuery') || ''}"
                        >
                        ${getState('searchQuery') ? `
                            <button class="search-input__clear" data-search="clear" type="button" title="Clear search">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>

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

        // Search input
        this.delegate('input', '[data-search="query"]', (e, target) => {
            const query = target.value;
            setState({ searchQuery: query });
            emit(Events.FILTER_CHANGED, { searchQuery: query });

            // Update clear button visibility without full re-render
            const clearBtn = this.container.querySelector('[data-search="clear"]');
            if (query && !clearBtn) {
                const searchInput = this.container.querySelector('.search-input');
                if (searchInput) {
                    const btn = document.createElement('button');
                    btn.className = 'search-input__clear';
                    btn.setAttribute('data-search', 'clear');
                    btn.setAttribute('type', 'button');
                    btn.setAttribute('title', 'Clear search');
                    btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                    searchInput.appendChild(btn);
                }
            } else if (!query && clearBtn) {
                clearBtn.remove();
            }
        });

        // Search clear button
        this.delegate('click', '[data-search="clear"]', () => {
            const input = this.container.querySelector('[data-search="query"]');
            if (input) {
                input.value = '';
                input.focus();
            }
            setState({ searchQuery: '' });
            emit(Events.FILTER_CHANGED, { searchQuery: '' });

            // Remove clear button
            const clearBtn = this.container.querySelector('[data-search="clear"]');
            if (clearBtn) clearBtn.remove();
        });
    }
}
