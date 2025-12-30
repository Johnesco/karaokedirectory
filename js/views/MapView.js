/**
 * MapView
 * Interactive map showing venue locations
 * Uses Leaflet.js for mapping
 */

import { Component } from '../components/Component.js';
import { getState, subscribe } from '../core/state.js';
import { emit, on, Events } from '../core/events.js';
import { getVenuesWithCoordinates, getAllVenues } from '../services/venues.js';
import { escapeHtml } from '../utils/string.js';
import { formatTimeRange } from '../utils/date.js';

export class MapView extends Component {
    init() {
        this.map = null;
        this.markers = [];

        this.subscribe(subscribe('showDedicated', () => this.updateMarkers()));
        this.subscribe(on(Events.FILTER_CHANGED, () => this.updateMarkers()));
    }

    template() {
        const venuesWithCoords = getVenuesWithCoordinates();
        const totalVenues = getAllVenues().length;

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
            </div>
        `;
    }

    afterRender() {
        // Load Leaflet if not already loaded
        this.loadLeaflet().then(() => {
            this.initMap();
        });
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

        this.updateMarkers();
    }

    updateMarkers() {
        if (!this.map) return;

        // Clear existing markers
        this.markers.forEach(marker => marker.remove());
        this.markers = [];

        // Get venues with coordinates
        const showDedicated = getState('showDedicated');
        let venues = getVenuesWithCoordinates();

        if (!showDedicated) {
            venues = venues.filter(v => !v.dedicated);
        }

        // Add markers
        venues.forEach(venue => {
            const marker = L.marker([venue.coordinates.lat, venue.coordinates.lng])
                .addTo(this.map)
                .bindPopup(this.createPopup(venue));

            marker.on('click', () => {
                emit(Events.VENUE_SELECTED, venue);
            });

            this.markers.push(marker);
        });

        // Fit bounds if we have markers
        if (this.markers.length > 0) {
            const group = L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    createPopup(venue) {
        const scheduleHtml = venue.schedule.map(s => {
            const day = s.day.charAt(0).toUpperCase() + s.day.slice(1);
            const time = formatTimeRange(s.startTime, s.endTime);
            return `<div>${day}: ${time}</div>`;
        }).join('');

        return `
            <div class="map-popup">
                <h3 class="map-popup__name">${escapeHtml(venue.name)}</h3>
                <div class="map-popup__schedule">${scheduleHtml}</div>
                <button class="map-popup__details btn btn--small" onclick="window.showVenueDetails('${venue.id}')">
                    View Details
                </button>
            </div>
        `;
    }

    onDestroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        this.markers = [];
    }
}
