/**
 * KJIndexView
 * Alphabetical index of every KJ name in the directory. Reached via
 * ?kj=all. Each entry links to that KJ's dossier (?kj=<name>).
 *
 * Audience: a KJ who doesn't know the exact spelling of their own name
 * in the data, or someone browsing who books at karaokedirectory.com.
 */

import { Component } from '../components/Component.js';
import { getAllVenues } from '../services/venues.js';
import { escapeHtml } from '../utils/string.js';

export class KJIndexView extends Component {
    template() {
        const kjs = this.collectKJs();

        if (kjs.length === 0) {
            return `
                <div class="kj-index">
                    <header class="kj-index__header">
                        <h2 class="kj-index__title">All KJs</h2>
                    </header>
                    <p class="kj-index__empty">No KJs found in the directory.</p>
                </div>
            `;
        }

        return `
            <div class="kj-index">
                <header class="kj-index__header">
                    <h2 class="kj-index__title">
                        <i class="fa-solid fa-microphone-lines"></i>
                        All KJs
                    </h2>
                    <p class="kj-index__stats">
                        ${kjs.length} KJ${kjs.length !== 1 ? 's' : ''} listed across the directory.
                        Click a name to see their venues.
                    </p>
                </header>
                <ul class="kj-index__list">
                    ${kjs.map(kj => this.renderEntry(kj)).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * Walk every active venue and collect a unique set of KJ names,
     * pulling from venue.host.{name,company} and per-show
     * schedule[N].host.{name,company}. Case-insensitive de-dupe.
     */
    collectKJs() {
        const map = new Map();

        const add = (rawName, venueId) => {
            if (!rawName || typeof rawName !== 'string' || !rawName.trim()) return;
            const display = rawName.trim();
            const key = display.toLowerCase();
            if (!map.has(key)) {
                map.set(key, { name: display, venueIds: new Set() });
            }
            map.get(key).venueIds.add(venueId);
        };

        getAllVenues().forEach(v => {
            add(v.host?.name, v.id);
            add(v.host?.company, v.id);
            (v.schedule || []).forEach(e => {
                add(e.host?.name, v.id);
                add(e.host?.company, v.id);
            });
        });

        return [...map.values()]
            .map(e => ({ name: e.name, venueCount: e.venueIds.size }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }

    renderEntry({ name, venueCount }) {
        // Real anchor link: navigating to ?kj=<name> triggers a page load
        // which app.js handles on boot (reads ?kj=, sets hostFilter, renders
        // the dossier). Keeps URL/state behavior consistent.
        const href = `?kj=${encodeURIComponent(name)}`;
        return `
            <li class="kj-index__item">
                <a class="kj-index__link" href="${href}">
                    <span class="kj-index__name">${escapeHtml(name)}</span>
                    <span class="kj-index__count">${venueCount} venue${venueCount !== 1 ? 's' : ''}</span>
                </a>
            </li>
        `;
    }
}
