/**
 * Unit tests for js/utils/url.js — the escaping and scheme-blocking helpers.
 *
 * These are the app's two defences against hostile venue data, and both had
 * gaps that #160 closed. They load in Node because url.js touches `window` only
 * inside function bodies (venueShareUrl), same as the router.
 *
 * The venue data is curator-maintained, not user-submitted, so nothing here was
 * a live exploit. It is defence in depth: submit.html emits venue partials that
 * a curator reconciles, so hostile text has a path toward data.json.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatAddress, sanitizeUrl, buildMapUrl } from '../js/utils/url.js';

describe('formatAddress — escaping', () => {
    it('leaves an ordinary address alone', () => {
        assert.equal(
            formatAddress({ street: '1120 S Lamar Blvd', city: 'Austin', state: 'TX', zip: '78704' }),
            '1120 S Lamar Blvd, Austin, TX 78704'
        );
    });

    it('escapes markup in the street', () => {
        // renderVenueDetailSections interpolates this straight into an <address>
        // element, so an unescaped tag here executes.
        const out = formatAddress({ street: '<img src=x onerror=alert(1)>', city: 'Austin' });
        assert.equal(out.includes('<img'), false);
        assert.match(out, /&lt;img/);
    });

    it('escapes quotes, which would otherwise break out of an attribute', () => {
        const out = formatAddress({ street: 'a" onmouseover="evil()', city: 'Austin' });
        assert.equal(out.includes('"'), false);
        assert.match(out, /&quot;/);
    });

    it('escapes every field, not just the street', () => {
        for (const field of ['street', 'city', 'state', 'zip']) {
            const out = formatAddress({ [field]: '<b>x</b>' });
            assert.equal(out.includes('<b>'), false, `${field} was not escaped`);
        }
    });

    it('keeps its own <br> separator intact in multiline mode', () => {
        // This is why the escaping lives inside formatAddress: a caller wrapping
        // the result in escapeHtml would turn this separator into &lt;br&gt;.
        const out = formatAddress({ street: '1 A St', city: 'Austin', state: 'TX' }, true);
        assert.equal(out, '1 A St<br>Austin, TX');
    });

    it('handles missing pieces without emitting stray separators', () => {
        assert.equal(formatAddress({ city: 'Austin', state: 'TX' }), 'Austin, TX');
        assert.equal(formatAddress({ street: '1 A St' }), '1 A St');
        assert.equal(formatAddress(null), '');
        assert.equal(formatAddress({}), '');
    });
});

describe('sanitizeUrl — scheme blocking', () => {
    it('rejects javascript: and data:, case-insensitively', () => {
        for (const bad of [
            'javascript:alert(1)',
            'JavaScript:alert(1)',
            '  javascript:alert(1)',
            'data:text/html,<script>alert(1)</script>',
            'DATA:text/html,x',
        ]) {
            assert.equal(sanitizeUrl(bad), null, bad);
        }
    });

    it('upgrades a bare host to https', () => {
        assert.equal(sanitizeUrl('example.com'), 'https://example.com');
    });

    it('passes through http and https unchanged', () => {
        assert.equal(sanitizeUrl('https://example.com/x'), 'https://example.com/x');
        assert.equal(sanitizeUrl('http://example.com/x'), 'http://example.com/x');
    });

    it('returns null for empty or non-string input', () => {
        for (const v of ['', '   ', null, undefined, 42, {}]) {
            assert.equal(sanitizeUrl(v), null, String(v));
        }
    });

    it('escapeHtml alone would NOT have stopped these — hence sanitizeUrl', () => {
        // The gap #160 closed: host.website went through escapeHtml only, which
        // leaves `javascript:alert(1)` a perfectly valid href.
        const hostile = 'javascript:alert(1)';
        assert.equal(hostile.includes('<'), false, 'nothing for escapeHtml to escape');
        assert.equal(sanitizeUrl(hostile), null);
    });
});

describe('buildMapUrl', () => {
    it('encodes the address into the query rather than interpolating it raw', () => {
        const url = buildMapUrl({ street: '1 A St & Co', city: 'Austin', state: 'TX' }, 'Bar "X"');
        assert.equal(url.startsWith('https://'), true);
        assert.equal(url.includes(' '), false);
        assert.equal(url.includes('"'), false);
    });
});
