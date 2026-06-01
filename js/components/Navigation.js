/**
 * Navigation Component
 * View toggles, week navigation, search input, and filters.
 *
 * Features:
 * - View switcher buttons (Calendar, A-Z, Map) + Bingo link (separate page)
 * - Week navigation (prev/next/today) - only shown in weekly view
 * - Global search input with clear button
 * - Dedicated venue toggle checkbox
 *
 * Note: Component does NOT re-render on searchQuery changes to preserve
 * input focus. Clear button visibility is managed via DOM manipulation.
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
        this.subscribe(subscribe('hostFilter', () => this.render()));
        // Don't re-render on searchQuery change to avoid losing focus
    }

    template() {
        const view = getState('view');
        const weekStart = getState('weekStart');
        const showDedicated = getState('showDedicated');
        const hostFilter = getState('hostFilter');

        // KJ mode (dossier or index): show the full view switcher + a filter chip.
        // CAL/A-Z/MAP click handlers clear hostFilter (see afterRender), so clicking
        // any of them leaves KJ mode cleanly. The KJs link is active on the index.
        if (hostFilter) {
            const isIndex = hostFilter.toLowerCase() === 'all';
            const chipLabel = isIndex ? '' : 'KJ:';
            const chipValue = isIndex ? 'All KJs' : hostFilter;
            return `
                <nav class="navigation navigation--dossier">
                    ${this.renderViewSwitcher({ view, kjIndexActive: isIndex })}
                    <div class="navigation__active-filters">
                        <span class="filter-chip" role="status">
                            <i class="fa-solid fa-microphone-lines"></i>
                            ${chipLabel ? `<span class="filter-chip__label">${chipLabel}</span>` : ''}
                            <span class="filter-chip__value">${chipValue}</span>
                            <button class="filter-chip__clear" data-filter="clear-kj" type="button" aria-label="Exit KJ view">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </span>
                    </div>
                </nav>
            `;
        }

        const weekRange = formatWeekRange(getWeekStart(weekStart));
        const isCurrentWeek = this.isCurrentWeek(weekStart);

        return `
            <nav class="navigation">
                ${this.renderViewSwitcher({ view, kjIndexActive: false })}

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

    /**
     * Render the CAL / A-Z / MAP / KJs / BINGO view switcher. Shared between
     * the main nav and the KJ-mode nav so users can leave KJ mode by clicking
     * any other view.
     *
     * @param {Object} opts
     * @param {string} opts.view - Current view state (weekly|alphabetical|map)
     * @param {boolean} opts.kjIndexActive - True when on the KJ index page
     *   (gives the KJs link the active indicator). When in dossier mode,
     *   pass false — no nav button is "active" for a single-KJ view.
     */
    renderViewSwitcher({ view, kjIndexActive }) {
        // In KJ mode, CAL/A-Z/MAP shouldn't appear active even though `view`
        // still holds the prior selection — the user isn't in those views.
        const inKJMode = !!getState('hostFilter');
        const cls = (active) => `nav-btn nav-btn--labeled${active ? ' nav-btn--active' : ''}`;
        return `
            <div class="navigation__views">
                <button class="${cls(!inKJMode && view === 'weekly')}" data-view="weekly" type="button">
                    <i class="fa-regular fa-calendar"></i>
                    <span class="nav-btn__label">CAL</span>
                </button>
                <button class="${cls(!inKJMode && view === 'alphabetical')}" data-view="alphabetical" type="button">
                    <i class="fa-solid fa-list"></i>
                    <span class="nav-btn__label">A-Z</span>
                </button>
                <button class="${cls(!inKJMode && view === 'map')}" data-view="map" type="button">
                    <i class="fa-solid fa-map-location-dot"></i>
                    <span class="nav-btn__label">MAP</span>
                </button>
                <a class="${cls(kjIndexActive)}" href="?kj=all">
                    <i class="fa-solid fa-microphone-lines"></i>
                    <span class="nav-btn__label">KJs</span>
                </a>
                <a class="nav-btn nav-btn--labeled" href="bingo.html">
                    <i class="fa-solid fa-table-cells"></i>
                    <span class="nav-btn__label">BINGO</span>
                </a>
            </div>
        `;
    }

    isCurrentWeek(weekStart) {
        const today = new Date();
        const currentWeekStart = getWeekStart(today);
        const compareWeekStart = getWeekStart(weekStart);
        return currentWeekStart.toDateString() === compareWeekStart.toDateString();
    }

    afterRender() {
        // View toggle buttons. Always clear hostFilter so clicking from a KJ
        // page exits KJ mode cleanly. No-op when hostFilter is already empty.
        this.delegate('click', '[data-view]', (e, target) => {
            const view = target.dataset.view;
            setState({ view, hostFilter: '' });
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

        // KJ filter chip clear
        this.delegate('click', '[data-filter="clear-kj"]', () => {
            setState({ hostFilter: '' });
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
