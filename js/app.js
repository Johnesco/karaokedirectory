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
import { readLocation, writeLocation, onLocationChange, VALID_VIEWS, DEFAULT_VIEW } from './core/router.js';
import { initFabs } from './components/fabs.js';

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
            // The hash records the ACTUAL view, not a hard-coded 'weekly'.
            // Selecting a venue on the map used to rewrite the URL to
            // view=weekly, so reloading dropped you somewhere else than where
            // you were. Sharing still pins weekly — see router.venueShareUrl.
            writeLocation({ view: getState('view'), venueId: venue.id });
        }
    });

    // Clear selection when venue is closed (modal closed)
    on(Events.VENUE_CLOSED, () => {
        document.querySelectorAll('.venue-card--selected').forEach(card => {
            card.classList.remove('venue-card--selected');
        });
        writeLocation({ venueId: null });
    });

    // Subscribe to view changes
    subscribe('view', (view) => {
        renderView(view);
    });

    const location = readLocation();
    const initialView = location.view || DEFAULT_VIEW;

    if (location.hostFilter) {
        setState({ hostFilter: location.hostFilter });
    }

    // Sync state to match the URL-driven initial view, then render.
    // setState alone won't trigger the subscriber if the value matches the
    // default ('weekly'), so we always call renderView explicitly as well.
    setState({ view: initialView });
    renderView(initialView);

    // Keep ?kj= in the URL in sync with hostFilter state and re-render the view
    // (toggle between KJDossierView and the regular weekly/alphabetical/map views).
    subscribe('hostFilter', (value) => {
        writeLocation({ hostFilter: value });
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

    // Floating action buttons. Previously an inline <script> in index.html that
    // polled window.isCurrentWeek() every 500ms, because an inline script has no
    // way to subscribe to state.
    initFabs();

    // Handle initial deep link (e.g. #venue=xyz on page load)
    handleHashChange();

    console.log('Application initialized');
}

/**
 * Load venue data from js/data.json — the single source (ADR-006, ADR-008).
 *
 * There is no second source. The Supabase path was parked by ADR-009 and its
 * scaffolding moved to _deprecated/; restore from there if the re-entry
 * trigger in that ADR ever fires.
 *
 * Needs the page served over http(s): fetch is blocked on file:// origins, so
 * opening index.html straight from disk won't work. Run a local server
 * (`npm run dev`).
 */
async function loadData() {
    try {
        // Resolved against this module's URL rather than the document's, so it
        // holds wherever the page is served from.
        const response = await fetch(new URL('data.json', import.meta.url));
        if (!response.ok) {
            throw new Error(`Could not load js/data.json (HTTP ${response.status})`);
        }
        const data = await response.json();
        const dataSource = 'local-json';
        console.log('Data source: local-json');

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
    // readLocation() already normalises query, hash, and the legacy `#weekly`
    // form into one shape, so this function no longer parses anything.
    const { view, venueId } = readLocation();

    if (view && getState('view') !== view) {
        setState({ view });
    }

    if (venueId) {
        const venue = getVenueById(venueId);
        if (venue) {
            // A venue link with no view lands on the calendar.
            if (!view && getState('view') !== DEFAULT_VIEW) {
                setState({ view: DEFAULT_VIEW });
            }
            emit(Events.VENUE_SELECTED, venue);
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Browser-driven location changes (back/forward, manual edits). replaceState
// does not fire this, so writeLocation cannot feed itself.
onLocationChange(handleHashChange);

// Export for debugging
export { init, renderView, getState };
