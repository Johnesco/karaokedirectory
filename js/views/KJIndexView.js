/**
 * KJIndexView
 * Directory of every KJ and affiliation in the data. Reached via ?kj=all.
 *
 * Structure:
 *   - Affiliations section: each affiliation (e.g. "Starling Karaoke") is a
 *     clickable parent row that filters to all venues under that affiliation;
 *     named KJs under it are nested as clickable children filtering to that
 *     specific KJ.
 *   - Independent KJs section: KJs with no affiliation listed.
 *
 * Both venue-level (venue.host) and per-show (schedule[N].host) hosts are
 * collected, so multi-host venues like The Highball contribute every KJ
 * who appears in a schedule entry.
 *
 * Audience: a KJ who doesn't know the exact spelling of their own name in
 * the data, or anyone browsing who books venues.
 */

import { Component } from '../components/Component.js';
import { getAllVenues } from '../services/venues.js';
import { escapeHtml } from '../utils/string.js';

export class KJIndexView extends Component {
    template() {
        const { affiliations, independents } = this.collectIndex();

        if (affiliations.length === 0 && independents.length === 0) {
            return `
                <div class="kj-index">
                    <header class="kj-index__header">
                        <h2 class="kj-index__title">All KJs</h2>
                    </header>
                    <p class="kj-index__empty">No KJs found in the directory.</p>
                </div>
            `;
        }

        const totalKjs = independents.length
            + affiliations.reduce((sum, a) => sum + a.kjs.length, 0);

        return `
            <div class="kj-index">
                <header class="kj-index__header">
                    <h2 class="kj-index__title">
                        <i class="fa-solid fa-microphone-lines"></i>
                        All KJs
                    </h2>
                    <p class="kj-index__stats">
                        ${affiliations.length} affiliation${affiliations.length !== 1 ? 's' : ''}
                        · ${totalKjs} KJ${totalKjs !== 1 ? 's' : ''}.
                        Click any name to see their venues.
                    </p>
                </header>

                ${affiliations.length > 0 ? `
                    <section class="kj-index__section">
                        <h3 class="kj-index__section-title">Affiliations</h3>
                        <ul class="kj-index__list">
                            ${affiliations.map(a => this.renderAffiliation(a)).join('')}
                        </ul>
                    </section>
                ` : ''}

                ${independents.length > 0 ? `
                    <section class="kj-index__section">
                        <h3 class="kj-index__section-title">Independent KJs</h3>
                        <ul class="kj-index__list">
                            ${independents.map(kj => this.renderIndependent(kj)).join('')}
                        </ul>
                    </section>
                ` : ''}
            </div>
        `;
    }

    /**
     * Walk every active venue and collect:
     *   - affiliations: Map<affiliation, { name, venueIds: Set, kjs: Map<kj, venueIds:Set> }>
     *   - independents: Map<kj, { name, venueIds: Set }>
     *
     * A host with both name + affiliation contributes the affiliation as a parent
     * and the name as a KJ under that affiliation. A host with only a name (no
     * affiliation) goes to Independents. A host with only an affiliation just
     * registers the parent row with no children.
     *
     * Names are de-duped case-insensitively (using lowercase keys); display uses
     * the first casing seen.
     */
    collectIndex() {
        const affiliations = new Map();
        const independents = new Map();

        const addAffiliation = (rawAff, venueId) => {
            const aff = (rawAff || '').trim();
            if (!aff) return null;
            const key = aff.toLowerCase();
            if (!affiliations.has(key)) {
                affiliations.set(key, { name: aff, venueIds: new Set(), kjs: new Map() });
            }
            const entry = affiliations.get(key);
            entry.venueIds.add(venueId);
            return entry;
        };

        const addKJUnder = (affEntry, rawName, venueId) => {
            const name = (rawName || '').trim();
            if (!name) return;
            const key = name.toLowerCase();
            if (!affEntry.kjs.has(key)) {
                affEntry.kjs.set(key, { name, venueIds: new Set() });
            }
            affEntry.kjs.get(key).venueIds.add(venueId);
        };

        const addIndependent = (rawName, venueId) => {
            const name = (rawName || '').trim();
            if (!name) return;
            const key = name.toLowerCase();
            if (!independents.has(key)) {
                independents.set(key, { name, venueIds: new Set() });
            }
            independents.get(key).venueIds.add(venueId);
        };

        const processHost = (host, venueId) => {
            if (!host) return;
            const affEntry = addAffiliation(host.affiliation, venueId);
            if (affEntry) {
                addKJUnder(affEntry, host.name, venueId);
            } else {
                addIndependent(host.name, venueId);
            }
        };

        getAllVenues().forEach(v => {
            processHost(v.host, v.id);
            (v.schedule || []).forEach(e => processHost(e.host, v.id));
        });

        const sortByName = (a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

        const affiliationList = [...affiliations.values()]
            .map(a => ({
                name: a.name,
                venueCount: a.venueIds.size,
                kjs: [...a.kjs.values()]
                    .map(k => ({ name: k.name, venueCount: k.venueIds.size }))
                    .sort(sortByName),
            }))
            .sort(sortByName);

        const independentList = [...independents.values()]
            .map(k => ({ name: k.name, venueCount: k.venueIds.size }))
            .sort(sortByName);

        return { affiliations: affiliationList, independents: independentList };
    }

    renderAffiliation({ name, venueCount, kjs }) {
        const href = `?kj=${encodeURIComponent(name)}`;
        const subList = kjs.length > 0
            ? `
                <ul class="kj-index__sublist">
                    ${kjs.map(kj => this.renderKjUnderAffiliation(kj)).join('')}
                </ul>
            `
            : '';
        return `
            <li class="kj-index__group">
                <a class="kj-index__link kj-index__link--affiliation" href="${href}">
                    <span class="kj-index__name">${escapeHtml(name)}</span>
                    <span class="kj-index__count">${venueCount} venue${venueCount !== 1 ? 's' : ''}</span>
                </a>
                ${subList}
            </li>
        `;
    }

    renderKjUnderAffiliation({ name, venueCount }) {
        const href = `?kj=${encodeURIComponent(name)}`;
        return `
            <li class="kj-index__subitem">
                <a class="kj-index__link kj-index__link--kj" href="${href}">
                    <span class="kj-index__name">${escapeHtml(name)}</span>
                    <span class="kj-index__count">${venueCount} venue${venueCount !== 1 ? 's' : ''}</span>
                </a>
            </li>
        `;
    }

    renderIndependent({ name, venueCount }) {
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
