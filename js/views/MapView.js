/**
 * MapView
 * Interactive map showing venue locations using Leaflet.js.
 * Supports immersive full-screen mode with floating controls.
 * Markers update based on showDedicated and search filter changes.
 */

import { Component } from '../components/Component.js';
import { getState, setState, subscribe } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { getVenuesWithCoordinates, getAllVenues } from '../services/venues.js';
import { escapeHtml } from '../utils/string.js';
import { buildDirectionsUrl, shareVenue } from '../utils/url.js';
import { renderTags } from '../utils/tags.js';
import { renderScheduleCompact, renderVenueDetailSections } from '../utils/render.js';
import { getVenueExclusionForDate, isPastOnceEvent, getWeekRange, startOfToday } from '../utils/date.js';

/**
 * The map's date filter (#215). One row per button: the id state carries, the
 * label, and the span it plots.
 *
 * `range` is a function, not a value, so it is computed per click — a tab left
 * open past midnight answers with the new day rather than the day it was opened.
 * An open-ended `end: null` means "everything from here on"; see
 * venueHasShowInRange for what that does to recurring vs one-time entries.
 *
 * Adding a span (This Month, say) is a new row here plus nothing else.
 */
const DATE_FILTERS = [
    { id: 'all', label: 'All', range: () => ({ start: startOfToday(), end: null }) },
    { id: 'week', label: 'This Week', range: () => getWeekRange() },
    { id: 'today', label: 'Today', range: () => ({ start: startOfToday(), end: startOfToday() }) },
];

/** Resolve a filter id to its span, falling back to the first row. */
function dateFilterRange(id) {
    const filter = DATE_FILTERS.find(f => f.id === id) || DATE_FILTERS[0];
    return filter.range();
}

export class MapView extends Component {
    init() {
        this.map = null;
        this.markers = [];
        this.markerMap = new Map(); // Map venue ID to marker
        this.clusterGroup = null;
        this.selectedVenue = null;
        this.selectedMarker = null;
        // Set by onDestroy so the in-flight loadLeaflet() promise knows not to
        // build a map for an instance nobody is listening to any more. See
        // afterRender.
        this.destroyed = false;

        // One subscription per key that affects which markers are shown.
        // `showDedicated` was previously covered twice — once here and once via
        // FILTER_CHANGED — so a single toggle ran updateMarkers three times.
        //
        // `searchQuery` is deliberately absent (#217). The map filters by time,
        // not text: the date buttons are its search, and the text box belongs to
        // the two list views. It also could not have worked honestly here — the
        // navigation bar that holds the input is display:none in immersive map
        // mode, so a query carried over from the calendar narrowed the map with
        // nothing on screen to explain it or clear it.
        this.subscribe(subscribe('showDedicated', () => {
            this.syncDedicatedButton();
            this.updateMarkers();
        }));
        this.subscribe(subscribe('mapDateFilter', () => {
            this.syncDateFilterButtons();
            this.updateMarkers();
        }));

        this.bindEscape();
    }

    /**
     * Update the floating "Hide/Show Dedicated" button to match state, without
     * re-rendering the view. A full render rebuilds the Leaflet map from
     * scratch, so the label is patched in place instead.
     */
    syncDedicatedButton() {
        const btn = this.$('[data-action="toggle-dedicated"]');
        if (!btn) return;
        const showDedicated = getState('showDedicated');
        btn.classList.toggle('map-controls__btn--active', showDedicated);
        btn.textContent = showDedicated ? 'Hide Dedicated' : 'Show Dedicated';
    }

    /**
     * Mark the active date-filter button. Patched in place for the same reason
     * the dedicated label is: a re-render would rebuild the Leaflet map.
     */
    syncDateFilterButtons() {
        const active = getState('mapDateFilter');
        this.$$('[data-date-filter]').forEach(btn => {
            const isActive = btn.dataset.dateFilter === active;
            btn.classList.toggle('map-date-filter__btn--active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        });
    }

    /**
     * Create a custom marker icon
     * @param {boolean} isSelected - Whether the marker is selected
     */
    createMarkerIcon(isSelected = false, isExcluded = false) {
        return L.divIcon({
            className: `map-marker ${isSelected ? 'map-marker--selected' : ''}${isExcluded ? ' map-marker--excluded' : ''}`,
            html: `<div class="map-marker__pin"></div>`,
            iconSize: [30, 40],
            iconAnchor: [15, 40],
            popupAnchor: [0, -40]
        });
    }

    /**
     * Return today's exclusion for a venue, if any — a recurring show that would
     * normally run today but is suppressed (holiday, private event, cancellation).
     * The map isn't date-scoped, so "today" is the relevant date for a closure cue.
     * @param {Object} venue
     * @returns {{date: string, reason: string|null}|null}
     */
    getTodaysExclusion(venue) {
        return getVenueExclusionForDate(venue, new Date());
    }

    template() {
        const venuesWithCoords = getVenuesWithCoordinates();
        const totalVenues = getAllVenues().length;
        const showDedicated = getState('showDedicated');
        const activeDateFilter = getState('mapDateFilter');

        return `
            <div class="map-view">
                <div class="map-view__container" id="venue-map"></div>
                <div class="map-view__info">
                    <p>
                        <i class="fa-solid fa-map-pin"></i>
                        ${venuesWithCoords.length} of ${totalVenues} venues have map coordinates.
                        ${venuesWithCoords.length < totalVenues ? `
                            <span class="map-view__hint">
                                Add coordinates in the editor to show more venues.
                            </span>
                        ` : ''}
                    </p>
                </div>

                <!-- Floating Controls (left side) -->
                <div class="map-controls">
                    <div class="map-date-filter" role="group" aria-label="Filter venues by date">
                        ${DATE_FILTERS.map(f => `
                            <button
                                class="map-date-filter__btn ${f.id === activeDateFilter ? 'map-date-filter__btn--active' : ''}"
                                data-date-filter="${f.id}"
                                aria-pressed="${f.id === activeDateFilter}"
                                type="button"
                            >${f.label}</button>
                        `).join('')}
                    </div>
                    <button
                        class="map-controls__btn map-controls__btn--text ${showDedicated ? 'map-controls__btn--active' : ''}"
                        data-action="toggle-dedicated"
                        type="button"
                    >
                        ${showDedicated ? 'Hide Dedicated' : 'Show Dedicated'}
                    </button>
                </div>

                <!-- View Switcher (right side) -->
                <div class="map-view-switcher">
                    <button class="map-view-switcher__btn" data-view="weekly" type="button">
                        <i class="fa-regular fa-calendar"></i>
                        <span>Calendar</span>
                    </button>
                    <button class="map-view-switcher__btn" data-view="alphabetical" type="button">
                        <i class="fa-solid fa-list"></i>
                        <span>A-Z</span>
                    </button>
                </div>

                <!-- Floating Venue Card -->
                <div class="map-venue-card" id="map-venue-card">
                    <!-- Content populated dynamically -->
                </div>
            </div>
        `;
    }

    afterRender() {
        // Load Leaflet if not already loaded.
        //
        // The destroyed check is what keeps the map alive on a `?view=map` deep
        // link. app.js boots that path with two renderView() calls — setState
        // notifies the `view` subscriber AND the explicit call runs — so a first
        // MapView is built and destroyed before its CDN load resolves. Without
        // this guard that dead instance still ran initMap(), claiming the live
        // instance's container: the survivor then threw "Map container is
        // already initialized", left this.map null, and every updateMarkers()
        // returned early. The map on screen belonged to a destroyed component
        // with no subscriptions, so the date filter, the dedicated toggle and
        // search all silently did nothing — only on that entry path, which is
        // the one shared links use.
        this.loadLeaflet().then(() => {
            if (this.destroyed) return;
            this.initMap();
        });

        // View switcher buttons
        this.delegate('click', '[data-view]', (e, target) => {
            setState({ view: target.dataset.view });
        });

        // Dedicated toggle. setState and stop — the `showDedicated` subscriber
        // updates the markers and this button's own label.
        //
        // This used to call this.render() as well, just to refresh the label,
        // which tears the whole Leaflet instance down and builds a new one
        // (fresh tile requests, re-bound handlers, discarded cluster group).
        // Patching the label in place avoids that.
        //
        // The viewport still shifts on a toggle, because updateMarkers() fits
        // bounds to whatever markers remain — that is its own behaviour and is
        // unchanged here.
        this.delegate('click', '[data-action="toggle-dedicated"]', () => {
            setState({ showDedicated: !getState('showDedicated') });
        });

        // Date filter. Same contract as the dedicated toggle — setState and
        // stop; the `mapDateFilter` subscriber repaints the markers and the
        // button states.
        this.delegate('click', '[data-date-filter]', (e, target) => {
            setState({ mapDateFilter: target.dataset.dateFilter });
        });

        // Close venue card
        this.delegate('click', '[data-action="close-card"]', () => {
            this.hideVenueCard();
        });

        // Expand card to show full venue details
        this.delegate('click', '[data-action="view-details"]', () => {
            if (this.selectedVenue) {
                this.showVenueDetails(this.selectedVenue);
            }
        });

        // Collapse back to compact summary
        this.delegate('click', '[data-action="back-to-summary"]', () => {
            if (this.selectedVenue) {
                this.showVenueCard(this.selectedVenue, this.selectedMarker);
            }
        });

    }

    /**
     * Escape closes the venue card first, then exits the map to the calendar.
     *
     * Registered in init(), not afterRender(): afterRender runs on every render,
     * and each pass built a fresh closure and called raw
     * `document.addEventListener` on it — orphaning the previous one, since only
     * the newest was tracked for removal. init() runs exactly once per instance,
     * and this.addEventListener records the listener so destroy() removes it.
     */
    bindEscape() {
        this.addEventListener(document, 'keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (this.selectedVenue) {
                this.hideVenueCard();
            } else {
                // Exit to weekly view
                setState({ view: 'weekly' });
            }
        });
    }

    async loadLeaflet() {
        // Load Leaflet if not already loaded
        if (!window.L) {
            // Load Leaflet CSS
            if (!document.querySelector('link[href*="leaflet.css"]')) {
                const css = document.createElement('link');
                css.rel = 'stylesheet';
                css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(css);
            }

            // Load Leaflet JS
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
            });
        }

        // Load MarkerCluster plugin if not already loaded
        if (!window.L.MarkerClusterGroup) {
            // Load MarkerCluster CSS files
            if (!document.querySelector('link[href*="MarkerCluster.css"]')) {
                const clusterCss = document.createElement('link');
                clusterCss.rel = 'stylesheet';
                clusterCss.href = 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css';
                document.head.appendChild(clusterCss);

                const clusterDefaultCss = document.createElement('link');
                clusterDefaultCss.rel = 'stylesheet';
                clusterDefaultCss.href = 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css';
                document.head.appendChild(clusterDefaultCss);
            }

            // Load MarkerCluster JS
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js';
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
            });
        }
    }

    initMap() {
        const container = this.$('#venue-map');
        if (!container || !window.L) return;

        // Tear down any previous instance before building another. Nothing
        // calls initMap twice per instance today — the dedicated toggle stopped
        // re-rendering in #157 — but L.map() on a container that already hosts a
        // map throws "Map container is already initialized", and the orphaned
        // instance keeps its own document-level listeners alive.
        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        // Default center on Austin, TX
        const austinCenter = [30.2672, -97.7431];

        this.map = L.map(container).setView(austinCenter, 11);

        // Add tile layer (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);

        // Close venue card when clicking on map (not on marker)
        this.map.on('click', () => {
            this.hideVenueCard();
        });

        this.updateMarkers();
    }

    /**
     * Create a custom cluster icon styled to match the app's purple theme
     * @param {object} cluster - MarkerCluster cluster object
     */
    createClusterIcon(cluster) {
        const count = cluster.getChildCount();
        let sizeClass = 'map-cluster--small';
        let size = 36;
        if (count >= 20) {
            sizeClass = 'map-cluster--large';
            size = 48;
        } else if (count >= 10) {
            sizeClass = 'map-cluster--medium';
            size = 42;
        }

        return L.divIcon({
            html: `<span>${count}</span>`,
            className: `map-cluster ${sizeClass}`,
            iconSize: L.point(size, size)
        });
    }

    updateMarkers() {
        if (!this.map) return;

        // Clear existing cluster group / markers
        if (this.clusterGroup) {
            this.clusterGroup.clearLayers();
            this.map.removeLayer(this.clusterGroup);
        }
        this.markers = [];
        this.markerMap.clear();
        this.selectedMarker = null;

        // Get venues with coordinates, respecting the map's own two filters —
        // the date span and the dedicated toggle. Text search is not one of
        // them (#217).
        const showDedicated = getState('showDedicated');
        const dateRange = dateFilterRange(getState('mapDateFilter'));
        const venues = getVenuesWithCoordinates({ includeDedicated: showDedicated, dateRange });

        // A selected venue can drop out of the plotted set — switch to "Today"
        // while a Friday-only venue's card is open and the card is left
        // describing a pin that is no longer on the map. Close it.
        if (this.selectedVenue && !venues.some(v => v.id === this.selectedVenue.id)) {
            this.hideVenueCard();
        }

        // Create cluster group
        this.clusterGroup = L.markerClusterGroup({
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: false,
            maxClusterRadius: 40,
            disableClusteringAtZoom: 17,
            iconCreateFunction: (cluster) => this.createClusterIcon(cluster)
        });

        // Slow zoom when clicking a cluster
        this.clusterGroup.on('clusterclick', (e) => {
            const bounds = e.layer.getBounds().pad(0.1);
            this.map.flyToBounds(bounds, { duration: 0.8 });
        });

        // Cluster hover tooltip listing all venues
        this.clusterGroup.on('clustermouseover', (e) => {
            const childMarkers = e.layer.getAllChildMarkers();
            const names = childMarkers
                .map(m => m.venueData ? escapeHtml(m.venueData.name) : '')
                .filter(Boolean)
                .sort();

            const maxDisplay = 12;
            let content = names.slice(0, maxDisplay).join('<br>');
            if (names.length > maxDisplay) {
                content += `<br><em>and ${names.length - maxDisplay} more\u2026</em>`;
            }

            e.layer.bindTooltip(content, {
                direction: 'top',
                className: 'map-cluster-tooltip',
                offset: L.point(0, -20)
            }).openTooltip();
        });

        this.clusterGroup.on('clustermouseout', (e) => {
            e.layer.unbindTooltip();
        });

        // Add markers to cluster group
        venues.forEach(venue => {
            // Dim the marker if the venue is closed today (excluded occurrence)
            const isExcludedToday = !!this.getTodaysExclusion(venue);
            const marker = L.marker(
                [venue.coordinates.lat, venue.coordinates.lng],
                { icon: this.createMarkerIcon(false, isExcludedToday) }
            );

            // Store venue data on marker for cluster tooltip access
            marker.venueData = venue;
            // Remember exclusion state so it survives select/deselect re-icons
            marker.isExcluded = isExcludedToday;

            // Hover tooltip showing venue name
            marker.bindTooltip(escapeHtml(venue.name), {
                direction: 'top',
                offset: L.point(0, -35)
            });

            // Store reference to marker by venue ID
            this.markerMap.set(venue.id, marker);

            // Click marker to show floating card (not popup)
            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                // Emit VENUE_SELECTED so app-level subscribers (URL hash sync,
                // venue-card highlight) fire. VenueModal/VenueDetailPane skip
                // opening when the current view is 'map' — the floating
                // .map-venue-card is the contextual UI here.
                emit(Events.VENUE_SELECTED, venue);
                this.showVenueCard(venue, marker);

                // Pan map to center on marker with offset for card visibility
                this.map.panTo([venue.coordinates.lat, venue.coordinates.lng]);
            });

            this.markers.push(marker);
            this.clusterGroup.addLayer(marker);
        });

        this.map.addLayer(this.clusterGroup);

        // Fit bounds if we have markers
        if (this.markers.length > 0) {
            const group = L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    showVenueCard(venue, marker) {
        // Reset previously selected marker (keeping its excluded dimming)
        if (this.selectedMarker) {
            this.selectedMarker.setIcon(this.createMarkerIcon(false, this.selectedMarker.isExcluded));
        }

        // Set new selected marker
        this.selectedVenue = venue;
        this.selectedMarker = marker;

        // Highlight the selected marker (preserving excluded state)
        if (marker) {
            marker.setIcon(this.createMarkerIcon(true, marker.isExcluded));
        }

        const cardEl = this.$('#map-venue-card');
        if (!cardEl || !venue) return;

        // The map card is a forward-looking snapshot: past one-time events are
        // clutter here even though they're still part of the venue's schedule.
        const upcomingSchedule = (venue.schedule || []).filter(s => !isPastOnceEvent(s));
        const scheduleHtml = renderScheduleCompact(upcomingSchedule);

        // Build directions URL
        const directionsUrl = buildDirectionsUrl(venue.address, venue.name);

        // Build tags HTML (includes dedicated tag if applicable)
        const tagsHtml = renderTags(venue.tags, { dedicated: venue.dedicated });

        // "Closed today" notice when a recurring show is excluded on the current date
        const exclusion = this.getTodaysExclusion(venue);
        const exclusionBanner = exclusion
            ? `<div class="map-venue-card__exclusion-banner"><i class="fa-solid fa-ban"></i> Closed Today${exclusion.reason ? `: ${escapeHtml(exclusion.reason)}` : ''}</div>`
            : '';

        cardEl.innerHTML = `
            <button class="map-venue-card__close" data-action="close-card" type="button" aria-label="Close">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div class="map-venue-card__header">
                <h3 class="map-venue-card__title">${escapeHtml(venue.name)}</h3>
                ${tagsHtml}
            </div>
            ${exclusionBanner}
            <div class="map-venue-card__schedule">${scheduleHtml}</div>
            <div class="map-venue-card__actions">
                <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary btn--small">
                    <i class="fa-solid fa-diamond-turn-right"></i> Directions
                </a>
                <button class="btn btn--primary btn--small" data-action="view-details" type="button">
                    <i class="fa-solid fa-info-circle"></i> Details
                </button>
            </div>
        `;

        cardEl.classList.remove('map-venue-card--expanded');
        cardEl.classList.add('map-venue-card--visible');
    }

    showVenueDetails(venue) {
        const cardEl = this.$('#map-venue-card');
        if (!cardEl || !venue) return;

        const tagsHtml = renderTags(venue.tags, { dedicated: venue.dedicated });

        // Strip past one-time events from the schedule table — the map detail
        // view, like the compact card, is forward-looking.
        const venueForDisplay = {
            ...venue,
            schedule: (venue.schedule || []).filter(s => !isPastOnceEvent(s))
        };

        cardEl.innerHTML = `
            <button class="map-venue-card__close" data-action="close-card" type="button" aria-label="Close">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div class="map-venue-card__header map-venue-card__header--detail">
                <button class="map-venue-card__back" data-action="back-to-summary" type="button" aria-label="Back to summary">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <h3 class="map-venue-card__title">${escapeHtml(venue.name)}</h3>
            </div>
            ${tagsHtml}
            <div class="map-venue-card__detail-content venue-detail venue-detail--compact">
                ${renderVenueDetailSections(venueForDisplay, { hostSocialSize: '' })}
            </div>
        `;

        cardEl.classList.add('map-venue-card--expanded');

        // Bind share button
        const shareBtn = cardEl.querySelector('.venue-detail__share');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => shareVenue(venue, shareBtn));
        }
    }

    hideVenueCard() {
        // Reset the selected marker's icon (keeping its excluded dimming)
        if (this.selectedMarker) {
            this.selectedMarker.setIcon(this.createMarkerIcon(false, this.selectedMarker.isExcluded));
            this.selectedMarker = null;
        }

        this.selectedVenue = null;
        const cardEl = this.$('#map-venue-card');
        if (cardEl) {
            cardEl.classList.remove('map-venue-card--visible');
            cardEl.classList.remove('map-venue-card--expanded');
        }
    }

    onDestroy() {
        // The keydown listener is not unbound here — it went through
        // this.addEventListener, so Component.destroy() has already removed it.

        // Anything still in flight (the Leaflet CDN load) must not act.
        this.destroyed = true;

        // Clean up cluster group
        if (this.clusterGroup) {
            this.clusterGroup.clearLayers();
            if (this.map) {
                this.map.removeLayer(this.clusterGroup);
            }
            this.clusterGroup = null;
        }

        // Clean up map
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        this.markers = [];
    }
}
