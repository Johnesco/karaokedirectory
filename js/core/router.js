/**
 * Router — the single owner of URL <-> state.
 *
 * Before this module, URL reads and writes were spread across app.js (7 sites),
 * debug.js, and url.js, with `validViews` declared identically twice and two
 * exported hash helpers that nothing imported. Nothing owned the question
 * "what does this URL mean", so every new surface answered it again.
 *
 * Everything the URL can say now goes through exactly two functions:
 *
 *   readLocation()          query + hash  ->  a normalized location object
 *   writeLocation(patch)    a patch       ->  the URL, via replaceState
 *
 * `writeLocation` is the ONLY caller of history.replaceState in the app.
 *
 * ADR-011 note: the entity contract says every linkable thing is a {type, id}
 * pair addressed as /<type>/<id>/, and that the `all`/`none` sentinels belong
 * outside the id namespace. This module is shaped for that — SENTINELS is a
 * separate lookup from the id, and `entity` is a first-class field — but it
 * does NOT introduce path routing. Generated entity pages (ADR-012) are static
 * files Netlify serves directly; the SPA's job is to keep the legacy `?kj=`
 * surface working. Reconciling the two is #124 Phase 5.
 */

/** The views the SPA can render. Previously declared twice in app.js. */
export const VALID_VIEWS = ['weekly', 'alphabetical', 'map'];

export const DEFAULT_VIEW = 'weekly';

/**
 * `?kj=` values that are routes rather than host identifiers.
 * Kept separate from the id namespace so a real KJ named "All" can never
 * collide with the index (ADR-011).
 */
export const SENTINELS = {
    INDEX: 'all',
    NO_HOST: 'none',
};

/**
 * Which view should be on screen, given the current state.
 *
 * This is the ONLY place `hostFilter` is turned into a view. It used to be
 * re-derived in four independent expressions across app.js and Navigation.js,
 * each with its own spelling of "am I in KJ mode?".
 *
 * Pure on purpose — it takes state rather than reading it, so it is testable
 * without a DOM and cannot drift from what the caller actually has.
 *
 * The two sentinels get their own view keys rather than being folded into the
 * dossier, so the routing table shows all three `?kj=` destinations explicitly.
 * That is ADR-011's point: `all` and `none` are routes, not host identifiers.
 *
 * @param {{view?: string, hostFilter?: string}} state
 * @returns {string} a key into the view registry
 */
export function resolveView({ view, hostFilter } = {}) {
    const kj = (hostFilter || '').trim();

    if (kj) {
        const lower = kj.toLowerCase();
        if (lower === SENTINELS.INDEX) return 'kj-index';
        if (lower === SENTINELS.NO_HOST) return 'kj-none';
        return 'kj-dossier';
    }

    return VALID_VIEWS.includes(view) ? view : DEFAULT_VIEW;
}

/** True when the resolved view is one of the `?kj=` destinations. */
export function isKJView(viewKey) {
    return viewKey === 'kj-index' || viewKey === 'kj-dossier' || viewKey === 'kj-none';
}

/** Parse a `key=value&key2=value2` hash body. Bare keys become `true`. */
function parseHash(rawHash) {
    const hash = (rawHash || '').replace(/^#/, '');
    if (!hash) return {};

    const params = {};
    for (const part of hash.split('&')) {
        if (!part) continue;
        const eq = part.indexOf('=');
        if (eq === -1) {
            params[decodeURIComponent(part)] = true;
            continue;
        }
        const key = decodeURIComponent(part.slice(0, eq));
        if (key) params[key] = decodeURIComponent(part.slice(eq + 1));
    }
    return params;
}

/**
 * Everything the current URL says, normalized.
 *
 * Precedence is query-then-hash for the view, because `?view=` is the
 * shareable form and `#view=` exists for in-session deep links. A bare legacy
 * hash (`#weekly`) is still honoured — those links are in the wild.
 *
 * @returns {{view: string|null, venueId: string|null, hostFilter: string,
 *            debug: boolean, isLegacyHashView: boolean}}
 */
export function readLocation() {
    const query = new URLSearchParams(window.location.search);
    const hash = parseHash(window.location.hash);

    const queryView = query.get('view');
    const hashView = typeof hash.view === 'string' ? hash.view : null;

    // Legacy single-value hash: `#weekly` rather than `#view=weekly`.
    const bareHash = window.location.hash.replace(/^#/, '');
    const legacyView = !hashView && VALID_VIEWS.includes(bareHash) ? bareHash : null;

    const view = [queryView, hashView, legacyView].find((v) => VALID_VIEWS.includes(v)) || null;

    return {
        view,
        venueId: typeof hash.venue === 'string' && hash.venue ? hash.venue : null,
        hostFilter: query.get('kj') || '',
        debug: query.get('debug') === '1',
        isLegacyHashView: !!legacyView,
    };
}

/**
 * Write a partial location back to the URL.
 *
 * Only the keys present in `patch` are touched, so callers never have to
 * reconstruct the parts they do not care about. Uses replaceState throughout:
 * pushState would put a history entry behind every filter toggle, and
 * replaceState also avoids firing `hashchange` back at us.
 *
 * @param {Object} patch
 * @param {string} [patch.view] - one of VALID_VIEWS
 * @param {string|null} [patch.venueId] - null clears the venue from the hash
 * @param {string|null} [patch.hostFilter] - falsy removes `?kj=`
 */
export function writeLocation(patch = {}) {
    const url = new URL(window.location.href);

    if ('hostFilter' in patch) {
        if (patch.hostFilter) url.searchParams.set('kj', patch.hostFilter);
        else url.searchParams.delete('kj');
    }

    // The hash carries the transient selection: which view, which venue.
    const current = parseHash(url.hash);
    const next = { ...current };

    if ('view' in patch) next.view = patch.view;
    if ('venueId' in patch) {
        if (patch.venueId) next.venue = patch.venueId;
        else delete next.venue;
    }

    // A venue-less hash has nothing worth keeping — `#view=weekly` alone just
    // duplicates state the query string or the default already covers.
    if (!next.venue) {
        url.hash = '';
    } else {
        url.hash = Object.entries(next)
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => (v === true ? encodeURIComponent(k) : `${encodeURIComponent(k)}=${encodeURIComponent(v)}`))
            .join('&');
    }

    history.replaceState(null, '', url.pathname + url.search + url.hash);
}

/**
 * Subscribe to browser-driven location changes (back/forward, manual edits).
 * replaceState does not fire this, so writeLocation cannot feed itself.
 *
 * @param {(location: ReturnType<readLocation>) => void} handler
 * @returns {() => void} unsubscribe
 */
export function onLocationChange(handler) {
    const listener = () => handler(readLocation());
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
}

/**
 * Build a shareable absolute URL for a venue.
 *
 * Pins `view=weekly` on purpose: a shared venue link should land on the
 * calendar regardless of which view the sharer happened to be in. That is a
 * different question from what the address bar shows while browsing, which
 * tracks the actual view.
 *
 * @param {string} venueId
 * @returns {string}
 */
export function venueShareUrl(venueId) {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}#view=weekly&venue=${encodeURIComponent(venueId)}`;
}
