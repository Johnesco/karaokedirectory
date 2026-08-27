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
import { readLocation, writeLocation, onLocationChange, resolveView, DEFAULT_VIEW } from './core/router.js';
import { initFabs } from './components/fabs.js';

// View instances
let navigation = null;
let venueModal = null;
let venueDetailPane = null;
let currentView = null;

/**
 * The view registry.
 *
 * Every renderable view is a row here: which class draws it, and which body
 * class the page wears while it is up. Previously only three views were
 * registered while five existed — the two KJ views were reached through a
 * `hostFilter` ternary and three hand-toggled body classes, so adding a
 * destination meant editing branching logic in two places.
 *
 * ADR-011 shapes this: a future `?tag=` or `?city=` destination should be a new
 * row, not a new `if`. `kj-index` and `kj-none` are the sentinel routes; only
 * `kj-dossier` addresses an actual entity.
 */
const VIEWS = {
    weekly: { Class: WeeklyView, bodyClass: null },
    alphabetical: { Class: AlphabeticalView, bodyClass: null },
    map: { Class: MapView, bodyClass: 'view--map' },
    'kj-index': { Class: KJIndexView, bodyClass: 'view--kj-index' },
    'kj-dossier': { Class: KJDossierView, bodyClass: 'view--kj-dossier' },
    // `?kj=none` is its own route but the dossier view renders it — it reads
    // hostFilter itself and switches to its no-host listing.
    'kj-none': { Class: KJDossierView, bodyClass: 'view--kj-dossier' },
};

/** Every body class the registry can apply, so swapping is data-driven. */
const ALL_BODY_CLASSES = [...new Set(
    Object.values(VIEWS).map((v) => v.bodyClass).filter(Boolean)
)];

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

    const location = readLocation();
    const initialView = location.view || DEFAULT_VIEW;

    if (location.hostFilter) {
        setState({ hostFilter: location.hostFilter });
    }

    // Seed state from the URL BEFORE subscribing, then render exactly once.
    //
    // Order matters. With the subscription in place first, `?view=map` rendered
    // twice: setState notified the subscriber (setState only notifies on an
    // actual change), and the explicit renderView() below ran again — building,
    // destroying and rebuilding a view before the first paint. `?view=weekly`
    // rendered once, because the value already matched the default and setState
    // stayed quiet. The explicit call existed to cover exactly that case.
    //
    // Seeding first makes the notify impossible, so one render covers both. The
    // hostFilter setState above already relies on the same ordering — its
    // subscriber is registered further down.
    //
    // This was the root cause behind the frozen map in #215/#217: MapView loads
    // Leaflet from a CDN after render, so the discarded first instance finished
    // initialising into the live one's container. That symptom is separately
    // guarded by `MapView.destroyed`; this removes the cause (#218).
    setState({ view: initialView });

    // renderView() reads state itself, so it cannot be handed a stale view name.
    subscribe('view', () => renderView());

    renderView();

    // Keep ?kj= in the URL in sync with hostFilter state and re-render the view
    // (toggle between the KJ views and the regular weekly/alphabetical/map ones).
    //
    // renderView() builds a fresh view instance, so it has already rendered by
    // the time this returns. The FILTER_CHANGED emit that used to follow landed
    // on that brand-new instance and rendered it a second time.
    subscribe('hostFilter', (value) => {
        writeLocation({ hostFilter: value });
        renderView();
    });

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

        // Update debug indicator with data source
        if (isDebugMode()) {
            const indicator = document.querySelector('.debug-indicator');
            if (indicator) {
                indicator.innerHTML = `<i class="fa-solid fa-bug"></i> Debug Mode | ${dataSource}`;
            }
        }
    } catch (error) {
        console.error('Failed to load venue data:', error);

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
function renderView() {
    const container = document.querySelector('#main-content');
    if (!container) {
        console.error('Main content container not found');
        return;
    }

    // One resolution, from the router. Nothing here re-derives "KJ mode".
    const key = resolveView({ view: getState('view'), hostFilter: getState('hostFilter') });
    const descriptor = VIEWS[key];
    if (!descriptor) {
        console.error(`Unknown view: ${key}`);
        return;
    }

    // Body classes come from the descriptor: clear every one the registry
    // knows about, then apply this view's. Adding a view with its own body
    // class needs no change here.
    for (const cls of ALL_BODY_CLASSES) {
        document.body.classList.toggle(cls, cls === descriptor.bodyClass);
    }

    if (currentView) {
        currentView.destroy();
        currentView = null;
    }

    currentView = new descriptor.Class(container);
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
