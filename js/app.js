/**
 * Austin Karaoke Directory - Main Application
 * Entry point that initializes all components and views
 */

import { setState, subscribe, getState, goToCurrentWeek } from './core/state.js';
import { on, emit, Events } from './core/events.js';
import { initVenues, getVenueById } from './services/venues.js';
import { Navigation } from './components/Navigation.js';
import { VenueModal } from './components/VenueModal.js';
import { VenueDetailPane } from './components/VenueDetailPane.js';
import { WeeklyView } from './views/WeeklyView.js';
import { AlphabeticalView } from './views/AlphabeticalView.js';
import { MapView } from './views/MapView.js';
import { KJDossierView } from './views/KJDossierView.js';
import { KJIndexView } from './views/KJIndexView.js';
import { initDebugMode, isDebugMode } from './utils/debug.js';
import { initTagConfig } from './utils/tags.js';
import { getHashParams } from './utils/url.js';
import { config } from './config.js';
import { fetchVenueData } from './services/supabase.js';

// View instances
let navigation = null;
let venueModal = null;
let venueDetailPane = null;
let currentView = null;

const views = {
    weekly: WeeklyView,
    alphabetical: AlphabeticalView,
    map: MapView
};

/**
 * Initialize the application
 */
async function init() {
    console.log('Initializing Austin Karaoke Directory...');

    // Initialize debug mode (check for ?debug=1 in URL)
    initDebugMode();

    // Load venue data
    await loadData();

    // Initialize navigation
    navigation = new Navigation('#navigation');
    navigation.render();

    // Dynamically track navigation height so sticky headers sit right below it
    const navContainer = document.querySelector('.navigation-container');
    if (navContainer) {
        const updateNavHeight = () => {
            const h = navContainer.getBoundingClientRect().height;
            document.documentElement.style.setProperty('--nav-height', `${h}px`);
        };
        updateNavHeight();
        new ResizeObserver(updateNavHeight).observe(navContainer);
    }

    // Initialize modal (for mobile/tablet, hidden by default)
    venueModal = new VenueModal('#venue-modal');
    venueModal.render();

    // Initialize detail pane (for wide screens, shown via CSS)
    venueDetailPane = new VenueDetailPane('#venue-detail-pane');
    venueDetailPane.render();

    // Handle venue selection highlighting + URL hash sync
    on(Events.VENUE_SELECTED, (venue) => {
        // Remove selected state from all venue cards
        document.querySelectorAll('.venue-card--selected').forEach(card => {
            card.classList.remove('venue-card--selected');
        });
        // Add selected state to matching card(s)
        if (venue) {
            document.querySelectorAll(`[data-venue-id="${venue.id}"]`).forEach(card => {
                card.classList.add('venue-card--selected');
            });
            // Update URL hash (replaceState avoids triggering hashchange)
            history.replaceState(null, '', '#view=weekly&venue=' + venue.id);
        }
    });

    // Clear selection when venue is closed (modal closed)
    on(Events.VENUE_CLOSED, () => {
        document.querySelectorAll('.venue-card--selected').forEach(card => {
            card.classList.remove('venue-card--selected');
        });
        // Clear URL hash
        history.replaceState(null, '', window.location.pathname + window.location.search);
    });

    // Subscribe to view changes
    subscribe('view', (view) => {
        renderView(view);
    });

    // Determine initial view from ?view= query parameter, falling back to 'weekly'
    const validViews = ['weekly', 'alphabetical', 'map'];
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    const initialView = validViews.includes(viewParam) ? viewParam : 'weekly';

    // Read ?kj= for the KJ/host filter (substring match, host fields only)
    const kjParam = urlParams.get('kj');
    if (kjParam) {
        setState({ hostFilter: kjParam });
    }

    // Sync state to match the URL-driven initial view, then render.
    // setState alone won't trigger the subscriber if the value matches the
    // default ('weekly'), so we always call renderView explicitly as well.
    setState({ view: initialView });
    renderView(initialView);

    // Keep ?kj= in the URL in sync with hostFilter state and re-render the view
    // (toggle between KJDossierView and the regular weekly/alphabetical/map views).
    subscribe('hostFilter', (value) => {
        const url = new URL(window.location.href);
        if (value) {
            url.searchParams.set('kj', value);
        } else {
            url.searchParams.delete('kj');
        }
        history.replaceState(null, '', url.pathname + url.search + url.hash);
        renderView(getState('view'));
        emit(Events.FILTER_CHANGED, { hostFilter: value });
    });

    // Expose helper for map popups
    window.showVenueDetails = (venueId) => {
        const venue = getVenueById(venueId);
        if (venue) {
            emit(Events.VENUE_SELECTED, venue);
        }
    };

    // Expose helper for "Jump to Today" button
    window.jumpToToday = () => {
        // Go to current week
        setState({ view: 'weekly', weekStart: new Date() });

        // Wait for render, then scroll to today
        setTimeout(() => {
            const todayCard = document.querySelector('.day-card--today');
            if (todayCard) {
                todayCard.scrollIntoView({ behavior: 'instant', block: 'start' });
            }
        }, 50);
    };

    // Handle initial deep link (e.g. #venue=xyz on page load)
    handleHashChange();

    // Expose helper to check if viewing current week
    window.isCurrentWeek = () => {
        const weekStart = getState('weekStart');
        const today = new Date();
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - today.getDay());
        currentWeekStart.setHours(0, 0, 0, 0);

        const viewingWeekStart = new Date(weekStart);
        viewingWeekStart.setDate(weekStart.getDate() - weekStart.getDay());
        viewingWeekStart.setHours(0, 0, 0, 0);

        return currentWeekStart.getTime() === viewingWeekStart.getTime();
    };

    console.log('Application initialized');
}

/**
 * Load venue data — tries Supabase first, falls back to local data.js
 *
 * Data source priority:
 *   1. sessionStorage cache (if fresh and useSupabase enabled)
 *   2. Supabase fetch (if useSupabase enabled)
 *   3. karaokeData global (from data.js script tag — fallback)
 *   4. Dynamic import of data.js (legacy fallback)
 */
async function loadData() {
    try {
        let data = null;
        let dataSource = 'unknown';

        // Try Supabase (or its cache) first
        if (config.useSupabase) {
            try {
                data = await fetchVenueData();
                dataSource = data.source || 'supabase';
            } catch (supabaseError) {
                console.warn('Supabase unavailable, falling back to local data:', supabaseError.message);
            }
        }

        // Fallback: global variable from data.js script tag
        if (!data && typeof karaokeData !== 'undefined') {
            data = karaokeData;
            dataSource = 'local-fallback';
            console.log('Data source: local-fallback (global)');
        }

        // Fallback: dynamic import
        if (!data) {
            try {
                const dataModule = await import('./data.js');
                data = dataModule.karaokeData || dataModule.default;
                dataSource = 'local-fallback';
                console.log('Data source: local-fallback (module)');
            } catch (importError) {
                console.warn('Could not import data.js as module:', importError);
            }
        }

        if (!data) {
            throw new Error('No venue data found. Make sure data.js is loaded.');
        }

        // Initialize tag configuration from data
        initTagConfig(data.tagDefinitions);

        initVenues(data);
        emit(Events.DATA_LOADED, data);

        // Update debug indicator with data source
        if (isDebugMode()) {
            const indicator = document.querySelector('.debug-indicator');
            if (indicator) {
                indicator.innerHTML = `<i class="fa-solid fa-bug"></i> Debug Mode | ${dataSource}`;
            }
        }
    } catch (error) {
        console.error('Failed to load venue data:', error);
        emit(Events.DATA_ERROR, error);

        // Show error to user
        const container = document.querySelector('#main-content');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <h2>Error Loading Data</h2>
                    <p>Failed to load venue data. Please refresh the page.</p>
                    <pre>${error.message}</pre>
                </div>
            `;
        }
    }
}

/**
 * Render the specified view
 */
function renderView(viewName) {
    const container = document.querySelector('#main-content');
    if (!container) {
        console.error('Main content container not found');
        return;
    }

    // KJ-mode overrides the normal weekly/alphabetical/map views.
    // ?kj=all   → KJIndexView (alphabetical directory of every KJ name)
    // ?kj=<n>   → KJDossierView (one KJ's full schedule across venues)
    const hostFilter = getState('hostFilter');
    const inKJIndexMode = hostFilter && hostFilter.toLowerCase() === 'all';
    const inDossierMode = !!hostFilter && !inKJIndexMode;
    const inKJMode = inKJIndexMode || inDossierMode;

    // Toggle body class for immersive map mode (only when NOT in KJ mode)
    document.body.classList.toggle('view--map', viewName === 'map' && !inKJMode);
    document.body.classList.toggle('view--kj-dossier', inDossierMode);
    document.body.classList.toggle('view--kj-index', inKJIndexMode);

    // Destroy current view
    if (currentView) {
        currentView.destroy();
        currentView = null;
    }

    const ViewClass = inKJIndexMode
        ? KJIndexView
        : inDossierMode
            ? KJDossierView
            : views[viewName];
    if (!ViewClass) {
        console.error(`Unknown view: ${viewName}`);
        return;
    }

    currentView = new ViewClass(container);
    currentView.render();
}

/**
 * Handle URL hash for deep linking
 */
function handleHashChange() {
    const params = getHashParams();
    const validViews = ['weekly', 'alphabetical', 'map'];

    // Switch view if specified
    if (params.view && validViews.includes(params.view)) {
        if (getState('view') !== params.view) {
            setState({ view: params.view });
        }
    }

    // Open venue if specified
    if (params.venue) {
        const venue = getVenueById(params.venue);
        if (venue) {
            // Default to weekly view for venue links if no view was specified
            if (!params.view && getState('view') !== 'weekly') {
                setState({ view: 'weekly' });
            }
            emit(Events.VENUE_SELECTED, venue);
        }
    } else if (!params.view) {
        // Legacy single-value hashes (e.g. #weekly)
        const hash = window.location.hash.slice(1);
        if (validViews.includes(hash)) {
            setState({ view: hash });
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Handle hash changes for deep linking
window.addEventListener('hashchange', handleHashChange);

// Export for debugging
export { init, renderView, getState };
