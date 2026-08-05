/**
 * KJDossierView
 * Renders when ?kj=<name> URL param is set (hostFilter state). Audit-focused
 * view for a KJ to verify their own listings: one card per venue, full
 * schedule details (every recurring slot + every upcoming one-time event
 * hosted by this KJ).
 *
 * Audience: the KJ themselves, not customers browsing. Replaces the normal
 * weekly/alphabetical/map views while active.
 *
 * Both match paths run venues through `venuePasses` so an out-of-activePeriod
 * venue is absent here exactly as it is from the calendar, A–Z and map (#117).
 *
 * The **dedicated toggle is deliberately not applied.** #117's acceptance
 * criteria asked for it; this view is where that would do harm. Its stated job
 * is "verify your listings" — silently omitting a KJ's shows because of a
 * checkbox that KJ mode does not even render would defeat the page's purpose,
 * and there would be no visible control to explain the gap. The activePeriod
 * gate has no such problem: an out-of-season venue is genuinely not running.
 */

import { Component } from '../components/Component.js';
import { getState } from '../core/state.js';
import { getAllVenues, venuePasses, venueMatchesHost, hostMatches, resolveHostLabel } from '../services/venues.js';
import { escapeHtml, getSortableName } from '../utils/string.js';
import {
    formatScheduleEntry,
    parseLocalDate,
    WEEKDAYS
} from '../utils/date.js';
import { resolveHostFor, getVenueHosts } from '../utils/render.js';

export class KJDossierView extends Component {
    init() {
        // No subscriptions, deliberately. This view's only input is
        // `hostFilter`, and a hostFilter change replaces the view outright —
        // app.js re-renders through the registry and builds a new instance,
        // so there is nothing for a live instance to react to.
        //
        // It used to subscribe to FILTER_CHANGED, which also fired on every
        // searchQuery keystroke. This view never reads searchQuery, so those
        // were full re-renders producing byte-identical output (#157). KJ mode
        // does not even show a search input.
    }

    template() {
        const kjName = getState('hostFilter');
        if (!kjName) {
            return '<div class="kj-dossier kj-dossier--empty"></div>';
        }

        const isNone = kjName.toLowerCase() === 'none';
        const matches = isNone ? this.getNoHostMatches() : this.getMatches(kjName);
        // `?kj=` now carries a registry id, which is a slug, not a name. Resolve
        // it back for display; legacy name links resolve to themselves (#124 P5).
        const label = isNone ? '' : resolveHostLabel(kjName);

        if (matches.length === 0) {
            return `
                <div class="kj-dossier">
                    <header class="kj-dossier__header">
                        <h2 class="kj-dossier__title">${isNone ? 'Venues with no listed host' : `KJ: ${escapeHtml(label)}`}</h2>
                        <p class="kj-dossier__stats">No venues currently listed.</p>
                    </header>
                    ${!isNone ? `
                        <p class="kj-dossier__empty-hint">
                            Nothing matches that KJ name in the directory data.
                            Check spelling or contact the directory maintainer to get your venues listed.
                        </p>
                    ` : `
                        <p class="kj-dossier__empty-hint">
                            Every active venue has a host listed. Nice.
                        </p>
                    `}
                </div>
            `;
        }

        const totalRecurring = matches.reduce((sum, m) => sum + m.recurring.length, 0);
        const totalOneTimes = matches.reduce((sum, m) => sum + m.oneTimes.length, 0);

        const title = isNone
            ? `<i class="fa-solid fa-circle-question"></i> Venues with no listed host`
            : `<i class="fa-solid fa-microphone-lines"></i> KJ: ${escapeHtml(label)}`;

        const hint = isNone
            ? 'These venues have no <code>host</code> field on the venue or on any schedule entry. If you host at one of these, contact the directory to get your attribution added.'
            : 'Verify your listings here. Anything wrong or missing? Contact the directory.';

        return `
            <div class="kj-dossier">
                <header class="kj-dossier__header">
                    <h2 class="kj-dossier__title">${title}</h2>
                    <p class="kj-dossier__stats">
                        ${matches.length} venue${matches.length !== 1 ? 's' : ''}
                        &middot; ${totalRecurring} recurring slot${totalRecurring !== 1 ? 's' : ''}
                        &middot; ${totalOneTimes} upcoming one-time event${totalOneTimes !== 1 ? 's' : ''}
                    </p>
                    <p class="kj-dossier__hint">${hint}</p>
                </header>
                <div class="kj-dossier__venues">
                    ${matches.map(m => this.renderVenue(m)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Find venues with no host info anywhere — no host.name or host.affiliation
     * at the venue level, AND no host.name or host.affiliation on any schedule
     * entry. A venue gets attributed at the per-show level if even one entry
     * names a host, so those are excluded here.
     */
    getNoHostMatches() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const hasNamedHost = (v) => getVenueHosts(v).some(({ host }) =>
            host.name?.trim() || host.affiliation?.trim()
        );

        return getAllVenues()
            .filter(v => venuePasses(v))
            .filter(v => !hasNamedHost(v))
            .map(v => {
                const recurring = (v.schedule || [])
                    .filter(e => e.frequency !== 'once')
                    .sort((a, b) => {
                        const aIdx = WEEKDAYS.indexOf(a.day?.toLowerCase());
                        const bIdx = WEEKDAYS.indexOf(b.day?.toLowerCase());
                        return aIdx - bIdx;
                    });

                const oneTimes = (v.schedule || [])
                    .filter(e => e.frequency === 'once' && e.date)
                    .filter(e => parseLocalDate(e.date) >= today)
                    .sort((a, b) => a.date.localeCompare(b.date));

                return { venue: v, recurring, oneTimes };
            })
            // Show every hostless venue — including ones with no upcoming events.
            // These are exactly the records a curator wants to audit, so don't hide
            // stale ones (unlike the KJ-dossier path, which filters out stale-only).
            .sort((a, b) => getSortableName(a.venue.name).localeCompare(getSortableName(b.venue.name)));
    }

    /**
     * Find venues this KJ hosts at; for each, separate the schedule into
     * recurring slots and upcoming one-time events that belong to this KJ.
     *
     * Per-show host overrides take precedence: an entry with its own `host`
     * uses that host's name/affiliation, not the venue's. So a venue whose
     * venue-level host matches the queried KJ still excludes any schedule
     * entry that has been overridden to a different KJ. (Earlier this
     * shortcut-included every entry whenever the venue-level host matched,
     * which produced phantom dossier rows under the venue's "default" KJ.)
     */
    getMatches(kjName) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const matches = getAllVenues()
            .filter(v => venuePasses(v))
            .filter(v => venueMatchesHost(v, kjName))
            .map(v => {
                // Same predicate the venue filter uses. Substring-matching here
                // separately meant a dossier reached by registry id matched the
                // venue but none of its shows (#124 Phase 5).
                const kjEntries = (v.schedule || []).filter(e =>
                    hostMatches(resolveHostFor(v, e), kjName)
                );

                const recurring = kjEntries
                    .filter(e => e.frequency !== 'once')
                    .sort((a, b) => {
                        const aIdx = WEEKDAYS.indexOf(a.day?.toLowerCase());
                        const bIdx = WEEKDAYS.indexOf(b.day?.toLowerCase());
                        return aIdx - bIdx;
                    });

                const oneTimes = kjEntries
                    .filter(e => e.frequency === 'once' && e.date)
                    .filter(e => parseLocalDate(e.date) >= today)
                    .sort((a, b) => a.date.localeCompare(b.date));

                return { venue: v, recurring, oneTimes };
            })
            .filter(m => m.recurring.length > 0 || m.oneTimes.length > 0)
            .sort((a, b) => getSortableName(a.venue.name).localeCompare(getSortableName(b.venue.name)));

        return matches;
    }

    renderVenue({ venue, recurring, oneTimes }) {
        const addr = venue.address;
        const addrLine = [addr?.street, addr?.city].filter(Boolean).join(', ');

        return `
            <article class="kj-dossier__venue">
                <header class="kj-dossier__venue-header">
                    <h3 class="kj-dossier__venue-name">${escapeHtml(venue.name)}</h3>
                    ${addrLine ? `
                        <p class="kj-dossier__venue-address">
                            <i class="fa-solid fa-location-dot"></i> ${escapeHtml(addrLine)}
                        </p>
                    ` : ''}
                </header>
                <ul class="kj-dossier__shows">
                    ${recurring.map(e => this.renderRecurring(e)).join('')}
                    ${oneTimes.map(e => this.renderOneTime(e)).join('')}
                </ul>
            </article>
        `;
    }

    renderRecurring(entry) {
        const { day, frequencyPrefix, time } = formatScheduleEntry(entry);
        return `
            <li class="kj-dossier__show kj-dossier__show--recurring">
                <span class="kj-dossier__show-when">
                    <i class="fa-regular fa-calendar"></i>
                    ${escapeHtml(frequencyPrefix)}${escapeHtml(day)}
                </span>
                <span class="kj-dossier__show-time">${escapeHtml(time)}</span>
            </li>
        `;
    }

    renderOneTime(entry) {
        const { day: dateStr, time } = formatScheduleEntry(entry, { weekday: true });
        return `
            <li class="kj-dossier__show kj-dossier__show--once">
                <span class="kj-dossier__show-when">
                    <i class="fa-solid fa-star"></i>
                    ${escapeHtml(dateStr)}
                </span>
                <span class="kj-dossier__show-time">${escapeHtml(time)}</span>
                ${entry.eventName ? `
                    <span class="kj-dossier__show-event">${escapeHtml(entry.eventName)}</span>
                ` : ''}
            </li>
        `;
    }
}
