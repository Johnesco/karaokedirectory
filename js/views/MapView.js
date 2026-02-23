/**
 * MapView
 * Interactive map showing venue locations using Leaflet.js.
 * Supports immersive full-screen mode with floating controls.
 * Markers update based on showDedicated and search filter changes.
 */

import { Component } from '../components/Component.js';
import { getState, setState, subscribe } from '../core/state.js';
import { emit, on, Events } from '../core/events.js';
import { getVenuesWithCoordinates, getAllVenues } from '../services/venues.js';
import { escapeHtml } from '../utils/string.js';
import { formatScheduleEntry } from '../utils/date.js';
import { buildDirectionsUrl, buildMapUrl, formatAddress, createSocialLinks, sanitizeUrl, shareVenue } from '../utils/url.js';
import { renderTags } from '../utils/tags.js';
import { renderScheduleTable, renderActivePeriod, renderHostSection } from '../utils/render.js';

export class MapView extends Component {
    init() {
        this.map = null;
        this.markers = [];
        this.markerMap = new Map(); // Map venue ID to marker
        this.clusterGroup = null;
        this.selectedVenue = null;
        this.selectedMarker = null;
        this._escHandler = null;

        this.subscribe(subscribe('showDedicated', () => this.updateMarkers()));
        this.subscribe(on(Events.FILTER_CHANGED, () => this.updateMarkers()));
    }

    /**
     * Create a custom marker icon
     * @param {boolean} isSelected - Whether the marker is selected
     */
    createMarkerIcon(isSelected = false) {
        return L.divIcon({
            className: `map-marker ${isSelected ? 'map-marker--selected' : ''}`,
            html: `<div class="map-marker__pin"></div>`,
            iconSize: [30, 40],
            iconAnchor: [15, 40],
            popupAnchor: [0, -40]
        });
    }

    template() {
        const venuesWithCoords = getVenuesWithCoordinates();
        const totalVenues = getAllVenues().length;
        const showDedicated = getState('showDedicated');

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
        // Load Leaflet if not already loaded
        this.loadLeaflet().then(() => {
            this.initMap();
        });

        // View switcher buttons
        this.delegate('click', '[data-view]', (e, target) => {
            const view = target.dataset.view;
            setState({ view });
            emit(Events.VIEW_CHANGED, view);
        });

        // Dedicated toggle
        this.delegate('click', '[data-action="toggle-dedicated"]', () => {
            const showDedicated = !getState('showDedicated');
            setState({ showDedicated });
            emit(Events.FILTER_CHANGED, { showDedicated });
            this.render(); // Re-render to update button state
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

        // Escape key to exit map view or close card
        this._escHandler = (e) => {
            if (e.key === 'Escape') {
                if (this.selectedVenue) {
                    this.hideVenueCard();
                } else {
                    // Exit to weekly view
                    setState({ view: 'weekly' });
                    emit(Events.VIEW_CHANGED, 'weekly');
                }
            }
        };
        document.addEventListener('keydown', this._escHandler);
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

        // Get venues with coordinates, respecting filters
        const showDedicated = getState('showDedicated');
        const searchQuery = getState('searchQuery');
        const venues = getVenuesWithCoordinates({ includeDedicated: showDedicated, searchQuery });

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
            const marker = L.marker(
                [venue.coordinates.lat, venue.coordinates.lng],
                { icon: this.createMarkerIcon(false) }
            );

            // Store venue data on marker for cluster tooltip access
            marker.venueData = venue;

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
        // Reset previously selected marker
        if (this.selectedMarker) {
            this.selectedMarker.setIcon(this.createMarkerIcon(false));
        }

        // Set new selected marker
        this.selectedVenue = venue;
        this.selectedMarker = marker;

        // Highlight the selected marker
        if (marker) {
            marker.setIcon(this.createMarkerIcon(true));
        }

        const cardEl = this.$('#map-venue-card');
        if (!cardEl || !venue) return;

        // Build schedule HTML using shared utility
        const scheduleHtml = venue.schedule.map(s => {
            const { fullText } = formatScheduleEntry(s, { showEvery: false });
            const eventLink = s.eventUrl
                ? ` <a href="${escapeHtml(sanitizeUrl(s.eventUrl) || '')}" target="_blank" rel="noopener noreferrer" class="schedule-event-link" title="Event page"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>`
                : '';
            return `<div>${fullText}${eventLink}</div>`;
        }).join('');

        // Build directions URL
        const directionsUrl = buildDirectionsUrl(venue.address, venue.name);

        // Build tags HTML (includes dedicated tag if applicable)
        const tagsHtml = renderTags(venue.tags, { dedicated: venue.dedicated });

        cardEl.innerHTML = `
            <button class="map-venue-card__close" data-action="close-card" type="button" aria-label="Close">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div class="map-venue-card__header">
                <h3 class="map-venue-card__title">${escapeHtml(venue.name)}</h3>
                ${tagsHtml}
            </div>
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

        const addressHtml = formatAddress(venue.address);
        const mapUrl = buildMapUrl(venue.address, venue.name);
        const directionsUrl = buildDirectionsUrl(venue.address, venue.name);
        const socialLinksHtml = createSocialLinks(venue.socials, { size: 'fa-lg' });
        const tagsHtml = renderTags(venue.tags, { dedicated: venue.dedicated });

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
            <div class="map-venue-card__detail-content">
                <section class="map-venue-card__section">
                    <h4><i class="fa-solid fa-location-dot"></i> Location</h4>
                    <address class="map-venue-card__address">${addressHtml}</address>
                    <div class="map-venue-card__map-links">
                        <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary btn--small">
                            <i class="fa-solid fa-map"></i> Map
                        </a>
                        <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary btn--small">
                            <i class="fa-solid fa-diamond-turn-right"></i> Directions
                        </a>
                        <button class="btn btn--secondary btn--small map-venue-card__share" type="button">
                            <i class="fa-solid fa-share-from-square"></i> Share
                        </button>
                    </div>
                </section>

                <section class="map-venue-card__section">
                    <h4><i class="fa-regular fa-calendar"></i> Schedule</h4>
                    ${renderScheduleTable(venue.schedule, 'map-venue-card')}
                    ${renderActivePeriod(venue.activePeriod, 'map-venue-card')}
                </section>

                ${renderHostSection(venue.host, 'map-venue-card', { socialSize: '' })}

                ${socialLinksHtml ? `
                    <section class="map-venue-card__section">
                        <h4><i class="fa-solid fa-share-nodes"></i> Venue Social Media</h4>
                        <div class="map-venue-card__socials">${socialLinksHtml}</div>
                    </section>
                ` : ''}

                ${venue.phone ? `
                    <section class="map-venue-card__section">
                        <h4><i class="fa-solid fa-phone"></i> Contact</h4>
                        <a href="tel:${venue.phone}" class="map-venue-card__phone">${escapeHtml(venue.phone)}</a>
                    </section>
                ` : ''}
            </div>
        `;

        cardEl.classList.add('map-venue-card--expanded');

        // Bind share button
        const shareBtn = cardEl.querySelector('.map-venue-card__share');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => shareVenue(venue, shareBtn));
        }
    }

    hideVenueCard() {
        // Reset the selected marker's icon
        if (this.selectedMarker) {
            this.selectedMarker.setIcon(this.createMarkerIcon(false));
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
        // Remove escape key handler
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
        }

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
