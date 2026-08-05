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
import { getAllVenues, venuePasses } from '../services/venues.js';
import { getVenueHosts } from '../utils/render.js';
import { escapeHtml, getSortableHostName } from '../utils/string.js';

export class KJIndexView extends Component {
    /**
     * Filter rows in place against the search box. Done in the DOM rather than by
     * re-rendering so the input keeps focus and the caret between keystrokes.
     *
     * A company row survives if the company matches OR any of its KJs does; when
     * only a KJ matches, the company stays visible but shows just that KJ — so
     * searching either half of "KJ Stephanie / Starling Karaoke" finds the show.
     */
    applyFilter(query) {
        const q = query.trim().toLowerCase();
        let visible = 0;

        for (const group of this.$$('.kj-index__group')) {
            const companyMatch = !q || (group.dataset.search || '').includes(q);
            let kjMatches = 0;

            for (const sub of group.querySelectorAll('.kj-index__subitem')) {
                const hit = !q || companyMatch || (sub.dataset.search || '').includes(q);
                sub.hidden = !hit;
                if (hit) kjMatches++;
            }

            const show = companyMatch || kjMatches > 0;
            group.hidden = !show;
            if (show) visible++;
        }

        for (const item of this.$$('.kj-index__item')) {
            const hit = !q || (item.dataset.search || '').includes(q);
            item.hidden = !hit;
            if (hit) visible++;
        }

        // Hide a section entirely once every row inside it is filtered out
        for (const section of this.$$('.kj-index__section')) {
            const anyVisible = [...section.querySelectorAll('.kj-index__group, .kj-index__item')]
                .some(el => !el.hidden);
            section.hidden = !anyVisible;
        }

        const empty = this.$('.kj-index__no-matches');
        if (empty) empty.hidden = visible > 0;
    }

    afterRender() {
        const input = this.$('.kj-index__filter-input');
        if (!input) return;
        this.addEventListener(input, 'input', (e) => this.applyFilter(e.target.value));
        this.addEventListener(input, 'search', (e) => this.applyFilter(e.target.value));
    }

    template() {
        const { affiliations, independents, noHostCount } = this.collectIndex();

        if (affiliations.length === 0 && independents.length === 0 && noHostCount === 0) {
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
                        ${affiliations.length} compan${affiliations.length !== 1 ? 'ies' : 'y'}
                        · ${totalKjs} KJ${totalKjs !== 1 ? 's' : ''}.
                        Click any name to see their venues.
                    </p>
                    <div class="kj-index__filter">
                        <i class="fa-solid fa-magnifying-glass kj-index__filter-icon"></i>
                        <input type="search" class="kj-index__filter-input"
                               placeholder="Filter by KJ or company…"
                               aria-label="Filter by KJ or company name"
                               autocomplete="off" autocapitalize="off" spellcheck="false">
                    </div>
                </header>

                <p class="kj-index__no-matches" hidden>No KJ or company matches that.</p>

                ${affiliations.length > 0 ? `
                    <section class="kj-index__section">
                        <h3 class="kj-index__section-title">Companies</h3>
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

                ${noHostCount > 0 ? `
                    <p class="kj-index__no-host-link">
                        <a href="?kj=none">
                            <i class="fa-solid fa-circle-question"></i>
                            ${noHostCount} venue${noHostCount !== 1 ? 's' : ''} with no host listed
                        </a>
                    </p>
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

        // Group by registry id, falling back to the lowercased name for the
        // legacy inline hosts the schema still accepts from submissions.
        //
        // The name was the key for both before #124 Phase 5, which is how
        // "Armando" and "KJ Armando and Paola" ended up sharing a dossier: the
        // link carried a name, and a name is matched by substring. An id is
        // matched exactly, so the link means one entity.
        const addAffiliation = (rawAff, companyId, venueId) => {
            const aff = (rawAff || '').trim();
            if (!aff) return null;
            const key = companyId || aff.toLowerCase();
            if (!affiliations.has(key)) {
                affiliations.set(key, { id: companyId || null, name: aff, venueIds: new Set(), kjs: new Map() });
            }
            const entry = affiliations.get(key);
            entry.venueIds.add(venueId);
            return entry;
        };

        const addKJUnder = (affEntry, rawName, kjId, venueId) => {
            const name = (rawName || '').trim();
            if (!name) return;
            const key = kjId || name.toLowerCase();
            if (!affEntry.kjs.has(key)) {
                affEntry.kjs.set(key, { id: kjId || null, name, venueIds: new Set() });
            }
            affEntry.kjs.get(key).venueIds.add(venueId);
        };

        const addIndependent = (rawName, kjId, venueId) => {
            const name = (rawName || '').trim();
            if (!name) return;
            const key = kjId || name.toLowerCase();
            if (!independents.has(key)) {
                independents.set(key, { id: kjId || null, name, venueIds: new Set() });
            }
            independents.get(key).venueIds.add(venueId);
        };

        const processHost = (host, venueId) => {
            if (!host) return false;
            const affEntry = addAffiliation(host.affiliation, host.companyId, venueId);
            if (affEntry) {
                addKJUnder(affEntry, host.name, host.kjId, venueId);
                return true;
            }
            const nm = (host.name || '').trim();
            if (!nm) return false;
            addIndependent(host.name, host.kjId, venueId);
            return true;
        };

        let noHostCount = 0;
        // Same activePeriod gate every other surface uses (#117). A venue outside
        // its season is not operating, so it should not contribute a KJ here
        // while being absent from the calendar, A–Z and map.
        //
        // `includeDedicated` is deliberately left at its default. The dedicated
        // toggle has no control in KJ mode — Navigation renders only the view
        // switcher and the filter chip — so honouring it would silently drop
        // venues from a page with no visible way to bring them back. See the
        // note in KJDossierView for why that matters more there than here.
        getAllVenues().filter(v => venuePasses(v)).forEach(v => {
            let attributed = false;
            for (const { host } of getVenueHosts(v)) {
                if (processHost(host, v.id)) attributed = true;
            }
            if (!attributed) noHostCount++;
        });

        // Sort on the stage-title-stripped form so "KJ Average Joe" files under A
        // next to "Average Joe", and "DJ Cysum & Mo" under C rather than D.
        const sortByName = (a, b) =>
            getSortableHostName(a.name).localeCompare(
                getSortableHostName(b.name), undefined, { sensitivity: 'base' });

        const affiliationList = [...affiliations.values()]
            .map(a => ({
                id: a.id,
                name: a.name,
                venueCount: a.venueIds.size,
                kjs: [...a.kjs.values()]
                    .map(k => ({ id: k.id, name: k.name, venueCount: k.venueIds.size }))
                    .sort(sortByName),
            }))
            .sort(sortByName);

        const independentList = [...independents.values()]
            .map(k => ({ id: k.id, name: k.name, venueCount: k.venueIds.size }))
            .sort(sortByName);

        return { affiliations: affiliationList, independents: independentList, noHostCount };
    }

    renderAffiliation({ id, name, venueCount, kjs }) {
        // Prefer the registry id: it identifies one entity exactly. Falls back
        // to the name for legacy inline hosts, which have no id (#124 Phase 5).
        const href = `?kj=${encodeURIComponent(id || name)}`;
        const subList = kjs.length > 0
            ? `
                <ul class="kj-index__sublist">
                    ${kjs.map(kj => this.renderKjUnderAffiliation(kj)).join('')}
                </ul>
            `
            : '';
        return `
            <li class="kj-index__group" data-search="${escapeHtml(name.toLowerCase())}">
                <a class="kj-index__link kj-index__link--affiliation" href="${href}">
                    <span class="kj-index__name">${escapeHtml(name)}</span>
                    <span class="kj-index__count">${venueCount} venue${venueCount !== 1 ? 's' : ''}</span>
                </a>
                ${subList}
            </li>
        `;
    }

    renderKjUnderAffiliation({ id, name, venueCount }) {
        // Prefer the registry id: it identifies one entity exactly. Falls back
        // to the name for legacy inline hosts, which have no id (#124 Phase 5).
        const href = `?kj=${encodeURIComponent(id || name)}`;
        return `
            <li class="kj-index__subitem" data-search="${escapeHtml(name.toLowerCase())}">
                <a class="kj-index__link kj-index__link--kj" href="${href}">
                    <span class="kj-index__name">${escapeHtml(name)}</span>
                    <span class="kj-index__count">${venueCount} venue${venueCount !== 1 ? 's' : ''}</span>
                </a>
            </li>
        `;
    }

    renderIndependent({ id, name, venueCount }) {
        // Prefer the registry id: it identifies one entity exactly. Falls back
        // to the name for legacy inline hosts, which have no id (#124 Phase 5).
        const href = `?kj=${encodeURIComponent(id || name)}`;
        return `
            <li class="kj-index__item" data-search="${escapeHtml(name.toLowerCase())}">
                <a class="kj-index__link" href="${href}">
                    <span class="kj-index__name">${escapeHtml(name)}</span>
                    <span class="kj-index__count">${venueCount} venue${venueCount !== 1 ? 's' : ''}</span>
                </a>
            </li>
        `;
    }
}
