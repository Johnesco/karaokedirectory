/**
 * Unit tests for js/utils/tags.js.
 *
 * The interesting property is deduplication. Two tags are DERIVED rather than
 * stored — `dedicated` from the venue flag, `special-event` from a schedule
 * entry being `frequency: "once"` — and each is prepended by whichever module
 * knows the condition. Neither prepend can see whether the venue also lists
 * that tag, so `renderTags` is where the two sources have to reconcile (#208).
 *
 * `initTagConfig` no-ops its stylesheet work when `document` is undefined,
 * which is what lets this run under `node --test` with no DOM.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import { renderTags, renderTagBadge, initTagConfig, getTagConfig, buildTagStyles } from '../js/utils/tags.js';

const DEFS = {
    dedicated: { label: 'Dedicated', color: '#7c3aed', textColor: '#ffffff' },
    'special-event': { label: 'Special Event', color: '#ec4899', textColor: '#ffffff' },
    lgbtq: { label: 'LGBTQ+', color: '#d946ef', textColor: '#ffffff' },
    dive: { label: 'Dive Bar', color: '#a16207', textColor: '#ffffff' },
};

/** Tag ids in render order, read back out of the emitted markup. */
function renderedTags(htmlString) {
    return [...String(htmlString).matchAll(/data-tag="([^"]+)"/g)].map((m) => m[1]);
}

before(() => initTagConfig(DEFS));

describe('renderTags — a tag renders at most once', () => {
    it('drops a stored copy of the injected `dedicated` tag', () => {
        // Latent before #208: no venue set both, but nothing prevented it.
        const out = renderTags(['dedicated', 'dive'], { dedicated: true });
        assert.deepEqual(renderedTags(out), ['dedicated', 'dive']);
    });

    it('drops a stored copy of `special-event`, which VenueCard prepends', () => {
        // The live case: austin-deaf-club stores special-event and its only
        // show is a `once` entry, so VenueCard hands over ['special-event',
        // 'lgbtq', 'special-event'] and the badge rendered twice.
        const out = renderTags(['special-event', 'lgbtq', 'special-event']);
        assert.deepEqual(renderedTags(out), ['special-event', 'lgbtq']);
    });

    it('collapses any repeat, not just the two derived ids', () => {
        assert.deepEqual(renderedTags(renderTags(['dive', 'lgbtq', 'dive'])), ['dive', 'lgbtq']);
    });

    it('keeps the derived tag first and the rest in order', () => {
        const out = renderTags(['lgbtq', 'dive'], { dedicated: true });
        assert.deepEqual(renderedTags(out), ['dedicated', 'lgbtq', 'dive']);
    });
});

describe('renderTags — unchanged behaviour', () => {
    it('renders an ordinary list once each', () => {
        assert.deepEqual(renderedTags(renderTags(['lgbtq', 'dive'])), ['lgbtq', 'dive']);
    });

    it('prepends dedicated when the venue is dedicated and does not store it', () => {
        assert.deepEqual(renderedTags(renderTags(['dive'], { dedicated: true })), ['dedicated', 'dive']);
    });

    it('returns empty string for no tags, rather than an empty wrapper', () => {
        assert.equal(renderTags([]), '');
        assert.equal(renderTags(null), '');
        assert.equal(renderTags(undefined), '');
    });

    it('skips ids with no definition, and emits nothing if none survive', () => {
        assert.deepEqual(renderedTags(renderTags(['lgbtq', 'no-such-tag'])), ['lgbtq']);
        assert.equal(renderTags(['no-such-tag']), '');
    });

    it('wraps the badges in .venue-tags', () => {
        assert.match(renderTags(['lgbtq']), /^<div class="venue-tags">.*<\/div>$/s);
    });
});

describe('renderTagBadge', () => {
    it('renders a span by default and an anchor when given an href', () => {
        assert.match(renderTagBadge('lgbtq'), /^<span class="tag" data-tag="lgbtq">LGBTQ\+<\/span>$/);
        assert.match(renderTagBadge('lgbtq', { href: '?tag=lgbtq' }),
            /^<a class="tag" data-tag="lgbtq" href="\?tag=lgbtq">LGBTQ\+<\/a>$/);
    });

    it('returns empty for an unknown id', () => {
        assert.equal(renderTagBadge('nope'), '');
    });

    it('escapes a hostile label rather than emitting it raw', () => {
        initTagConfig({ ...DEFS, evil: { label: '<img src=x onerror=alert(1)>', color: '#000', textColor: '#fff' } });
        const out = renderTagBadge('evil');
        assert.equal(out.includes('<img'), false, 'raw markup survived');
        assert.match(out, /&lt;img/);
        initTagConfig(DEFS);
    });
});

describe('buildTagStyles — colours come from curator data, so they are validated', () => {
    it('emits one rule per tag', () => {
        const css = buildTagStyles({ lgbtq: { color: '#d946ef', textColor: '#fff' } });
        assert.equal(css, '.tag[data-tag="lgbtq"]{background:#d946ef;color:#fff}');
    });

    it('skips a colour that could break out of the rule', () => {
        // A stylesheet has no escaping: a stray `}` would end the rule and
        // start a new one, so bad values are dropped rather than emitted.
        const css = buildTagStyles({ bad: { color: 'red}.x{display:none', textColor: '#fff' } });
        assert.equal(css, '');
    });

    it('skips an id an attribute selector could not carry', () => {
        assert.equal(buildTagStyles({ 'a"]{x': { color: '#fff', textColor: '#000' } }), '');
    });

    it('accepts the colour forms the data actually uses', () => {
        for (const c of ['#fff', '#ffffff', 'rebeccapurple', 'rgb(1, 2, 3)', 'hsl(1, 2%, 3%)']) {
            assert.notEqual(buildTagStyles({ t: { color: c, textColor: '#000' } }), '', c);
        }
    });
});

describe('getTagConfig', () => {
    it('returns the definition, or null for an unknown id', () => {
        assert.equal(getTagConfig('lgbtq').label, 'LGBTQ+');
        assert.equal(getTagConfig('nope'), null);
    });
});
