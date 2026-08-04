/**
 * Unit tests for js/core/router.js.
 *
 * The module only touches `window` inside function bodies, so a minimal stub is
 * enough to exercise it in Node — no jsdom, no new dependency. The stub records
 * what replaceState was called with, which is the actual contract: writeLocation
 * must be the only thing that writes the URL, and it must never fire hashchange.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const ORIGIN = 'https://karaokedirectory.com';

/** Install a fake window at a given URL. Returns the recorder. */
function at(href) {
    const url = new URL(href);
    const calls = [];
    globalThis.window = {
        location: {
            get href() { return url.href; },
            get origin() { return url.origin; },
            get pathname() { return url.pathname; },
            get search() { return url.search; },
            get hash() { return url.hash; },
        },
        addEventListener() {},
        removeEventListener() {},
    };
    globalThis.history = {
        replaceState(_s, _t, next) {
            calls.push(next);
            const merged = new URL(next, url.origin);
            url.search = merged.search;
            url.hash = merged.hash;
        },
    };
    globalThis.window.__calls = calls;
    return calls;
}

const { readLocation, writeLocation, venueShareUrl, resolveView, isKJView, VALID_VIEWS, DEFAULT_VIEW, SENTINELS } =
    await import('../js/core/router.js');

describe('readLocation — query', () => {
    it('reads a valid ?view=', () => {
        at(ORIGIN + '/?view=map');
        assert.equal(readLocation().view, 'map');
    });

    it('ignores an invalid ?view= rather than trusting it', () => {
        at(ORIGIN + '/?view=nonsense');
        assert.equal(readLocation().view, null);
    });

    it('reads ?kj= verbatim, including the sentinels', () => {
        at(ORIGIN + '/?kj=armando');
        assert.equal(readLocation().hostFilter, 'armando');
        at(ORIGIN + '/?kj=' + SENTINELS.INDEX);
        assert.equal(readLocation().hostFilter, 'all');
        at(ORIGIN + '/?kj=' + SENTINELS.NO_HOST);
        assert.equal(readLocation().hostFilter, 'none');
    });

    it('decodes an encoded ?kj= value', () => {
        at(ORIGIN + '/?kj=' + encodeURIComponent('KJ Armando and Paola'));
        assert.equal(readLocation().hostFilter, 'KJ Armando and Paola');
    });

    it('reads ?debug=1 only when it is exactly 1', () => {
        at(ORIGIN + '/?debug=1');
        assert.equal(readLocation().debug, true);
        at(ORIGIN + '/?debug=true');
        assert.equal(readLocation().debug, false);
        at(ORIGIN + '/');
        assert.equal(readLocation().debug, false);
    });

    it('defaults cleanly on a bare URL', () => {
        at(ORIGIN + '/');
        assert.deepEqual(readLocation(), {
            view: null, venueId: null, hostFilter: '', debug: false, isLegacyHashView: false,
        });
    });
});

describe('readLocation — hash', () => {
    it('reads #view= and #venue=', () => {
        at(ORIGIN + '/#view=map&venue=knomad-bar');
        const loc = readLocation();
        assert.equal(loc.view, 'map');
        assert.equal(loc.venueId, 'knomad-bar');
    });

    it('honours the legacy bare hash', () => {
        at(ORIGIN + '/#alphabetical');
        const loc = readLocation();
        assert.equal(loc.view, 'alphabetical');
        assert.equal(loc.isLegacyHashView, true);
    });

    it('does not treat an unknown bare hash as a view', () => {
        at(ORIGIN + '/#something-else');
        const loc = readLocation();
        assert.equal(loc.view, null);
        assert.equal(loc.isLegacyHashView, false);
    });

    it('query view wins over hash view', () => {
        at(ORIGIN + '/?view=map#view=weekly');
        assert.equal(readLocation().view, 'map');
    });

    it('decodes an encoded venue id', () => {
        at(ORIGIN + '/#venue=' + encodeURIComponent("dog-n-bone"));
        assert.equal(readLocation().venueId, 'dog-n-bone');
    });
});

describe('writeLocation', () => {
    beforeEach(() => at(ORIGIN + '/'));

    it('sets and clears ?kj=', () => {
        writeLocation({ hostFilter: 'armando' });
        assert.match(window.location.search, /kj=armando/);
        writeLocation({ hostFilter: '' });
        assert.equal(window.location.search.includes('kj='), false);
    });

    it('writes the venue hash with the view it was given', () => {
        writeLocation({ view: 'map', venueId: 'knomad-bar' });
        assert.equal(window.location.hash, '#view=map&venue=knomad-bar');
    });

    it('clears the whole hash when the venue is cleared', () => {
        writeLocation({ view: 'weekly', venueId: 'knomad-bar' });
        writeLocation({ venueId: null });
        // A view-only hash is redundant with the query string / default.
        assert.equal(window.location.hash, '');
    });

    it('leaves keys absent from the patch untouched', () => {
        writeLocation({ hostFilter: 'armando' });
        writeLocation({ view: 'map', venueId: 'x' });
        assert.match(window.location.search, /kj=armando/);
        assert.match(window.location.hash, /view=map/);
    });

    it('is the only thing that writes — and uses replaceState', () => {
        const calls = window.__calls;
        writeLocation({ hostFilter: 'a' });
        writeLocation({ venueId: 'b' });
        assert.equal(calls.length, 2, 'expected exactly one replaceState per write');
    });

    it('round-trips through readLocation', () => {
        writeLocation({ hostFilter: 'KJ Armando and Paola', view: 'map', venueId: 'knomad-bar' });
        const loc = readLocation();
        assert.equal(loc.hostFilter, 'KJ Armando and Paola');
        assert.equal(loc.view, 'map');
        assert.equal(loc.venueId, 'knomad-bar');
    });

    it('encodes a hostile value rather than letting it break the URL', () => {
        writeLocation({ hostFilter: '<img src=x onerror=1>' });
        assert.equal(window.location.search.includes('<'), false);
        assert.equal(readLocation().hostFilter, '<img src=x onerror=1>');
    });
});

describe('venueShareUrl', () => {
    it('pins weekly on purpose, regardless of the current view', () => {
        at(ORIGIN + '/?view=map');
        assert.equal(venueShareUrl('knomad-bar'), ORIGIN + '/#view=weekly&venue=knomad-bar');
    });

    it('encodes the id', () => {
        at(ORIGIN + '/');
        assert.ok(venueShareUrl('a b').endsWith('venue=a%20b'));
    });
});

describe('resolveView', () => {
    it('returns the base view when there is no host filter', () => {
        assert.equal(resolveView({ view: 'map' }), 'map');
        assert.equal(resolveView({ view: 'alphabetical', hostFilter: '' }), 'alphabetical');
    });

    it('falls back to the default for an unknown or missing view', () => {
        assert.equal(resolveView({ view: 'nonsense' }), DEFAULT_VIEW);
        assert.equal(resolveView({}), DEFAULT_VIEW);
        assert.equal(resolveView(), DEFAULT_VIEW);
    });

    it('routes the two sentinels to their own views, case-insensitively', () => {
        assert.equal(resolveView({ hostFilter: 'all' }), 'kj-index');
        assert.equal(resolveView({ hostFilter: 'ALL' }), 'kj-index');
        assert.equal(resolveView({ hostFilter: 'none' }), 'kj-none');
        assert.equal(resolveView({ hostFilter: 'None' }), 'kj-none');
    });

    it('routes any other host filter to the dossier', () => {
        assert.equal(resolveView({ hostFilter: 'armando' }), 'kj-dossier');
        assert.equal(resolveView({ hostFilter: 'KJ Armando and Paola' }), 'kj-dossier');
    });

    it('a host filter overrides the base view', () => {
        assert.equal(resolveView({ view: 'map', hostFilter: 'armando' }), 'kj-dossier');
        assert.equal(resolveView({ view: 'map', hostFilter: 'all' }), 'kj-index');
    });

    it('treats a whitespace-only filter as absent', () => {
        assert.equal(resolveView({ view: 'map', hostFilter: '   ' }), 'map');
    });

    it('a KJ literally named "all" would still hit the index — the collision ADR-011 names', () => {
        // Documented, not endorsed. It is why the sentinels are slated to leave
        // the id namespace entirely.
        assert.equal(resolveView({ hostFilter: 'all' }), 'kj-index');
    });
});

describe('isKJView', () => {
    it('is true for exactly the three ?kj= destinations', () => {
        for (const k of ['kj-index', 'kj-dossier', 'kj-none']) {
            assert.equal(isKJView(k), true, k);
        }
    });

    it('is false for every base view', () => {
        for (const v of VALID_VIEWS) assert.equal(isKJView(v), false, v);
    });
});

describe('constants', () => {
    it('VALID_VIEWS is the single list, and contains the default', () => {
        assert.deepEqual(VALID_VIEWS, ['weekly', 'alphabetical', 'map']);
        assert.ok(VALID_VIEWS.includes(DEFAULT_VIEW));
    });

    it('sentinels are not valid view names, and stay out of the id space', () => {
        for (const s of Object.values(SENTINELS)) {
            assert.equal(VALID_VIEWS.includes(s), false);
        }
    });
});
