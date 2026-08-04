/**
 * Unit tests for js/utils/string.js.
 *
 * slugify is the interesting one. Two implementations of it used to exist —
 * this, and a `generateVenueId` inside submit.html — and they diverged in both
 * directions, each able to emit ids the schema rejects (#168). The curator
 * fixed those by hand.
 *
 * So the id pattern is not hardcoded here: it is read out of
 * schema/venue.schema.json at test time. If the schema tightens, this fails
 * rather than quietly drifting from it, which is the whole failure mode being
 * closed.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { slugify, escapeHtml, getSortableName } from '../js/utils/string.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(path.join(ROOT, 'schema/venue.schema.json'), 'utf8'));

/** The venue id pattern, from the schema itself. */
function venueIdPattern(node) {
    if (node && typeof node === 'object') {
        if (node.properties?.id?.pattern) return node.properties.id.pattern;
        for (const v of Object.values(node)) {
            const found = venueIdPattern(v);
            if (found) return found;
        }
    }
    return null;
}

const ID_PATTERN = venueIdPattern(schema);
const ID_RE = new RegExp(ID_PATTERN);

describe('slugify — against the schema id pattern', () => {
    it('found the pattern in the schema (not hardcoded here)', () => {
        assert.equal(ID_PATTERN, '^[a-z0-9][a-z0-9-]*$');
    });

    it('produces schema-valid ids for real and awkward venue names', () => {
        const names = [
            "Ego's",
            'The Highball',
            'Dog \'n\' Bone Pub',
            "Hudson's On Mercer St.",
            '21+ Lounge',
            'Ñoño Bar',
            'A  double  space',
            'Cafe_Blue',                 // underscore: \w kept it, schema rejects it
            '  Leading and trailing  ',  // padding became edge hyphens
            '-Dash Start',
            'The Highball!!!',
            'Bar & Grill',
        ];
        for (const name of names) {
            const id = slugify(name);
            assert.notEqual(id, '', `${name} produced an empty id`);
            assert.match(id, ID_RE, `${name} -> ${id} violates ${ID_PATTERN}`);
        }
    });

    it('drops underscores — `\\w` kept them and the schema forbids them', () => {
        assert.equal(slugify('Cafe_Blue'), 'cafeblue');
    });

    it('never starts or ends with a hyphen', () => {
        for (const name of ['  padded  ', '-leading', 'trailing-', '--both--', '!!! Bar !!!']) {
            const id = slugify(name);
            if (!id) continue;
            assert.equal(id.startsWith('-'), false, `${name} -> ${id}`);
            assert.equal(id.endsWith('-'), false, `${name} -> ${id}`);
        }
    });

    it('collapses runs of separators', () => {
        assert.equal(slugify('A  double  space'), 'a-double-space');
        assert.equal(slugify('a---b'), 'a-b');
    });

    it('returns empty for input with no alphanumerics, which callers must handle', () => {
        // The schema requires at least one character, so '' is not a valid id.
        // slugify reports it rather than inventing one.
        for (const v of ['!!!', '   ', '---', '', null, undefined]) {
            assert.equal(slugify(v), '');
        }
    });

    it('is idempotent — slugifying a slug changes nothing', () => {
        for (const name of ["Ego's", '  Cafe_Blue  Lounge!  ', '21+ Lounge']) {
            const once = slugify(name);
            assert.equal(slugify(once), once);
        }
    });

    it('handles the exact input that broke the deleted generateVenueId', () => {
        // submit.html's copy emitted "-cafeblue-lounge-" here: it replaced
        // spaces with hyphens before trimming, so the padding became edge
        // hyphens and .trim() had nothing left to remove.
        const id = slugify('  Cafe_Blue  Lounge!  ');
        assert.equal(id, 'cafeblue-lounge');
        assert.match(id, ID_RE);
    });
});

describe('escapeHtml', () => {
    it('escapes the five characters that matter', () => {
        assert.equal(escapeHtml('&'), '&amp;');
        assert.equal(escapeHtml('<'), '&lt;');
        assert.equal(escapeHtml('>'), '&gt;');
        assert.equal(escapeHtml('"'), '&quot;');
        assert.equal(escapeHtml("'"), '&#39;');
    });

    it('covers everything the deleted escapeHtmlForTextarea did', () => {
        // submit.html carried a fourth escaper handling & < > " only. This is a
        // superset, so replacing it lost nothing (#168).
        const hostile = `Tom & "Jerry" <script>alert(1)</script>`;
        const out = escapeHtml(hostile);

        // `&` is expected in the output — it opens every entity. What must not
        // survive is a bare one, or any raw < > ".
        for (const ch of ['<', '>', '"']) {
            assert.equal(out.includes(ch), false, `raw ${ch} survived`);
        }
        assert.equal(/&(?!(amp|lt|gt|quot|#39);)/.test(out), false, 'a bare & survived');
        assert.equal(out, 'Tom &amp; &quot;Jerry&quot; &lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('leaves ordinary text alone', () => {
        assert.equal(escapeHtml('Karaoke at 9pm'), 'Karaoke at 9pm');
    });
});

describe('getSortableName', () => {
    it('moves a leading article to the end, library style', () => {
        assert.equal(getSortableName('The Highball'), 'Highball, The');
        assert.equal(getSortableName('A Bar'), 'Bar, A');
    });

    it('leaves names that merely start with those letters', () => {
        assert.equal(getSortableName('Theory Bar'), 'Theory Bar');
    });

    it('leaves a bare article alone — there is nothing to sort on', () => {
        assert.equal(getSortableName('The'), 'The');
    });
});
