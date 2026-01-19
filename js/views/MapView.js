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
import { buildDirectionsUrl } from '../utils/url.js';
import { renderTags } from '../utils/tags.js';

export class MapView extends Component {
    init() {
        this.map = null;
        this.markers = [];
        this.selectedVenue = null;
        this._escHandler = null;

        this.subscribe(subscribe('showDedicated', () => this.updateMarkers()));
        this.subscribe(on(Events.FILTER_CHANGED, () => this.updateMarkers()));
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

        // View details button - switch to weekly and open modal
        this.delegate('click', '[data-action="view-details"]', () => {
            const venue = this.selectedVenue;
            if (!venue) return;

            // Switch to weekly view
            setState({ view: 'weekly' });
            emit(Events.VIEW_CHANGED, 'weekly');

            // Small delay to let view render, then select venue
            setTimeout(() => {
                emit(Events.VENUE_SELECTED, venue);
            }, 100);
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
        // Check if Leaflet is already loaded
        if (window.L) return;

        // Load CSS
        if (!document.querySelector('link[href*="leaflet"]')) {
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(css);
        }

        // Load JS
        return new Promise((resolve, reject) => {
            if (window.L) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
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

    updateMarkers() {
        if (!this.map) return;

        // Clear existing markers
        this.markers.forEach(marker => marker.remove());
        this.markers = [];

        // Get venues with coordinates, respecting filters
        const showDedicated = getState('showDedicated');
        const searchQuery = getState('searchQuery');
        const venues = getVenuesWithCoordinates({ includeDedicated: showDedicated, searchQuery });

        // Add markers
        venues.forEach(venue => {
            const marker = L.marker([venue.coordinates.lat, venue.coordinates.lng])
                .addTo(this.map);

            // Click marker to show floating card (not popup)
            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                this.showVenueCard(venue);

                // Pan map to center on marker with offset for card visibility
                this.map.panTo([venue.coordinates.lat, venue.coordinates.lng]);
            });

            this.markers.push(marker);
        });

        // Fit bounds if we have markers
        if (this.markers.length > 0) {
            const group = L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    showVenueCard(venue) {
        this.selectedVenue = venue;
        const cardEl = this.$('#map-venue-card');
        if (!cardEl || !venue) return;

        // Build schedule HTML using shared utility
        const scheduleHtml = venue.schedule.map(s => {
            const { fullText } = formatScheduleEntry(s, { showEvery: false });
            return `<div>${fullText}</div>`;
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

        cardEl.classList.add('map-venue-card--visible');
    }

    hideVenueCard() {
        this.selectedVenue = null;
        const cardEl = this.$('#map-venue-card');
        if (cardEl) {
            cardEl.classList.remove('map-venue-card--visible');
        }
    }

    onDestroy() {
        // Remove escape key handler
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
        }

        // Clean up map
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        this.markers = [];
    }
}
