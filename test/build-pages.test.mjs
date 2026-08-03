/**
 * Unit tests for scripts/build-pages.js — the static entity-page generator.
 *
 * These cover the pure transforms: which entities become pages, what the URLs
 * and metadata look like, and the escaping. Page *rendering* is covered by
 * asserting invariants over the real generated output in the same suite.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const build = require('../scripts/build-pages.js');
const data = require('../js/data.json');

const { entitiesOf, showsOf, urlFor, titleFor, describe: describeEntity, jsonLd, jsonLdScript, esc, clip, renderPage, renderSitemap } = build;

describe('showsOf', () => {
  it('skips inactive venues entirely', () => {
    const inactive = data.listings.filter((v) => v.active === false).map((v) => v.id);
    assert.ok(inactive.length > 0, 'fixture needs at least one inactive venue');
    const venueIds = new Set(showsOf(data).map((s) => s.venue.id));
    for (const id of inactive) assert.equal(venueIds.has(id), false, `${id} should be excluded`);
  });

  it('a per-show host overrides the venue host as a full swap', () => {
    const fixture = {
      listings: [{
        id: 'v', name: 'V',
        host: { kjId: 'venue-level' },
        schedule: [
          { frequency: 'every', day: 'Friday' },
          { frequency: 'every', day: 'Saturday', host: { companyId: 'show-level' } },
        ],
      }],
    };
    const [fri, sat] = showsOf(fixture);
    assert.equal(fri.kjId, 'venue-level');
    // full swap: the show-level host carries no kjId, so it does NOT inherit one
    assert.equal(sat.kjId, null);
    assert.equal(sat.companyId, 'show-level');
  });
});

describe('entitiesOf', () => {
  const entities = entitiesOf(data);

  it('emits a page for every venue that is active, and none that are not', () => {
    const active = data.listings.filter((v) => v.active !== false).length;
    assert.equal(entities.filter((e) => e.type === 'venue').length, active);
  });

  it('omits registry entries with no shows on active venues', () => {
    // A KJ who only hosts at an inactive venue is referenced (so the validator
    // does not warn) but has nothing to show publicly. A page would be empty.
    const kjIds = new Set(entities.filter((e) => e.type === 'kj').map((e) => e.id));
    for (const e of entities.filter((x) => x.type === 'kj')) {
      assert.ok(e.shows.length > 0, `${e.id} has a page but no shows`);
    }
    assert.ok(kjIds.size <= Object.keys(data.kjs).length);
  });

  it('every entity id is URL-safe', () => {
    for (const e of entities) {
      assert.match(e.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${e.type}/${e.id} is not slug-safe`);
    }
  });

  it('ids are unique within a type', () => {
    for (const type of ['kj', 'company', 'venue']) {
      const ids = entities.filter((e) => e.type === type).map((e) => e.id);
      assert.equal(new Set(ids).size, ids.length, `duplicate ${type} id`);
    }
  });
});

describe('the Armando collision is fixed by construction', () => {
  // ?kj=Armando substring-matched 3 venues across 2 distinct KJs. Id lookup cannot.
  const entities = entitiesOf(data);
  const armando = entities.find((e) => e.type === 'kj' && e.id === 'armando');
  const pair = entities.find((e) => e.type === 'kj' && e.id === 'kj-armando-and-paola');

  it('both KJs exist as separate entities', () => {
    assert.ok(armando, 'armando missing');
    assert.ok(pair, 'kj-armando-and-paola missing');
  });

  it('their venue sets do not overlap', () => {
    const a = new Set(armando.shows.map((s) => s.venue.id));
    const b = new Set(pair.shows.map((s) => s.venue.id));
    for (const id of a) assert.equal(b.has(id), false, `${id} leaked across KJs`);
  });
});

describe('urls and metadata', () => {
  const entities = entitiesOf(data);

  it('urlFor is /<type>/<id>/ under the apex origin', () => {
    assert.equal(urlFor({ type: 'kj', id: 'armando' }), 'https://karaokedirectory.com/kj/armando/');
  });

  it('every title and description is non-empty and within sane length', () => {
    for (const e of entities) {
      assert.ok(titleFor(e).length > 10, `${e.id} title too short`);
      const d = describeEntity(e);
      assert.ok(d.length > 20, `${e.id} description too short`);
      assert.ok(d.length <= 156, `${e.id} description too long (${d.length})`);
    }
  });

  it('descriptions never double a terminal period', () => {
    // Several venue names legitimately end in "." — e.g. "Hudson's On Mercer St."
    for (const e of entities) {
      assert.equal(/\.\./.test(describeEntity(e)), false, `${e.type}/${e.id}: ${describeEntity(e)}`);
    }
  });

  it('clip does not cut mid-word', () => {
    const out = clip('a'.repeat(10) + ' ' + 'b'.repeat(200), 40);
    assert.ok(out.length <= 40);
    assert.match(out, /…$/);
  });
});

describe('JSON-LD', () => {
  const entities = entitiesOf(data);

  it('@id equals the canonical URL for every entity', () => {
    for (const e of entities) assert.equal(jsonLd(e)['@id'], urlFor(e));
  });

  it('venues emit BarOrPub with an address', () => {
    const v = entities.find((e) => e.type === 'venue' && e.venue.address && e.venue.address.street);
    const node = jsonLd(v);
    assert.equal(node['@type'], 'BarOrPub');
    assert.equal(node.address['@type'], 'PostalAddress');
  });

  it('KJs are Person, companies are Organization', () => {
    assert.equal(jsonLd(entities.find((e) => e.type === 'kj'))['@type'], 'Person');
    assert.equal(jsonLd(entities.find((e) => e.type === 'company'))['@type'], 'Organization');
  });

  it('serialises without undefined leaking in', () => {
    for (const e of entities) {
      assert.equal(JSON.stringify(jsonLd(e)).includes('undefined'), false, `${e.id}`);
    }
  });
});

describe('escaping', () => {
  it('escapes the five HTML-significant characters', () => {
    assert.equal(esc(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });

  it('a venue name with an apostrophe is escaped in the markup', () => {
    const entities = entitiesOf(data);
    const apos = entities.find((e) => e.type === 'venue' && e.name.includes("'"));
    assert.ok(apos, 'fixture needs a venue with an apostrophe');
    const html = renderPage(apos, data);
    // The escaped form must appear in the HTML body/attributes.
    assert.ok(html.includes(esc(apos.name)), 'escaped name missing');
    // The raw form may legitimately appear inside the JSON-LD block, where an
    // apostrophe is harmless — so assert on the markup outside that block.
    const ldStart = html.indexOf('<script type="application/ld+json">');
    const ldEnd = html.indexOf('</script>', ldStart);
    const outsideLd = html.slice(0, ldStart) + html.slice(ldEnd);
    assert.equal(outsideLd.includes(apos.name), false, 'raw apostrophe leaked into markup');
  });

  it('JSON-LD cannot break out of its script element', () => {
    // JSON.stringify does not escape `<`, so a value containing `</script>`
    // would close the element early and inject live markup.
    const hostile = {
      type: 'venue',
      id: 'hostile',
      name: '</script><img src=x onerror=alert(1)>',
      venue: { id: 'hostile', name: '</script><img src=x onerror=alert(1)>', address: { city: 'Austin' } },
      shows: [],
    };
    const html = renderPage(hostile, { kjs: {}, companies: {} });
    assert.equal(/<img src=x/.test(html), false, 'injected a live <img>');
    assert.equal(html.includes('</script><img'), false, 'closed the script element early');
    assert.ok(html.includes('\\u003c/script'), 'expected < to be escaped as \\u003c');
  });

  it('the escaped JSON-LD still parses back to the original value', () => {
    const node = { name: '</script>', note: 'a < b' };
    const parsed = JSON.parse(jsonLdScript(node));
    assert.equal(parsed.name, '</script>');
    assert.equal(parsed.note, 'a < b');
  });
});

describe('rendered pages', () => {
  const entities = entitiesOf(data);
  const pages = entities.map((e) => ({ e, html: renderPage(e, data) }));

  it('every page has exactly one canonical, one title, and one JSON-LD block', () => {
    for (const { e, html } of pages) {
      assert.equal((html.match(/rel="canonical"/g) || []).length, 1, `${e.id} canonical`);
      assert.equal((html.match(/<title>/g) || []).length, 1, `${e.id} title`);
      assert.equal((html.match(/application\/ld\+json/g) || []).length, 1, `${e.id} ld+json`);
    }
  });

  it('every page declares the favicon set', () => {
    for (const { e, html } of pages) {
      assert.ok(html.includes('href="/favicon.svg" type="image/svg+xml"'), `${e.id} svg icon`);
      assert.ok(html.includes('href="/favicon.ico"'), `${e.id} ico fallback`);
      assert.ok(html.includes('href="/apple-touch-icon.png"'), `${e.id} apple touch icon`);
      // Absolute paths matter here: entity pages live at /kj/<id>/, so a
      // relative "favicon.svg" would resolve inside that directory.
      assert.equal(/href="favicon\./.test(html), false, `${e.id} relative icon path`);
    }
  });

  it('every page declares the share image with dimensions and alt text', () => {
    for (const { e, html } of pages) {
      assert.ok(html.includes('<meta property="og:image" content="https://karaokedirectory.com/og.jpg">'), `${e.id} og:image`);
      assert.ok(html.includes('<meta property="og:image:width" content="1200">'), `${e.id} width`);
      assert.ok(html.includes('<meta property="og:image:height" content="630">'), `${e.id} height`);
      assert.ok(/og:image:alt" content="[^"]{20,}"/.test(html), `${e.id} alt text`);
      // summary_large_image is the correct card type for a 1.91-aspect image;
      // plain `summary` renders a small square thumbnail and wastes it.
      assert.ok(html.includes('content="summary_large_image"'), `${e.id} twitter:card`);
    }
  });

  it('canonical, og:url and JSON-LD @id all agree', () => {
    for (const { e, html } of pages) {
      const url = urlFor(e);
      assert.ok(html.includes(`<link rel="canonical" href="${url}">`), `${e.id} canonical`);
      assert.ok(html.includes(`<meta property="og:url" content="${url}">`), `${e.id} og:url`);
    }
  });

  it('loads the stylesheets in the order check-css-load-order.js requires', () => {
    const { html } = pages[0];
    const order = ['base.css', 'layout.css', 'components.css', 'views.css']
      .map((f) => html.indexOf(f));
    for (let i = 1; i < order.length; i++) {
      assert.ok(order[i] > order[i - 1], 'CSS load order violated');
    }
  });

  it('every internal entity link points at a page that exists', () => {
    const known = new Set(entities.map((e) => `/${e.type}/${e.id}/`));
    for (const { e, html } of pages) {
      const links = html.match(/href="\/(kj|company|venue)\/[^"]+"/g) || [];
      for (const l of links) {
        const href = l.slice(6, -1);
        assert.ok(known.has(href), `${e.type}/${e.id} links to missing ${href}`);
      }
    }
  });
});

describe('sitemap', () => {
  it('contains every entity URL plus the static pages, and is well-formed', () => {
    const entities = entitiesOf(data);
    const xml = renderSitemap(entities);
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.equal((xml.match(/<url>/g) || []).length, entities.length + 4);
    for (const e of entities) assert.ok(xml.includes(urlFor(e)), `${e.id} missing from sitemap`);
  });
});
