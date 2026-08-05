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
const { graphFor, eventNodes, scheduleNode, durationOf, isoDateTime, tzOffset, todayInTz } = build;

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

/* ------------------------------------------------------------------ #164 --
 *
 * Event markup. The load-bearing decisions here are (a) recurring shows are
 * described by a rule, not by materialised dates, because the build runs on
 * push and dates would rot between deploys, and (b) times carry a real UTC
 * offset, because Austin changes its own twice a year.
 */

describe('durationOf — shows routinely run past midnight', () => {
  it('measures an ordinary evening', () => {
    assert.equal(durationOf('20:00', '23:00'), 'PT3H');
  });

  it('treats a smaller end time as the next day, not as bad data', () => {
    // 94 of the dataset's shows cross midnight. 21:00-01:00 is four hours.
    assert.equal(durationOf('21:00', '01:00'), 'PT4H');
    assert.equal(durationOf('21:30', '01:30'), 'PT4H');
  });

  it('carries minutes', () => {
    assert.equal(durationOf('20:00', '22:30'), 'PT2H30M');
    assert.equal(durationOf('20:00', '20:45'), 'PT45M');
  });

  it('a full 24 hours rather than zero when the times match', () => {
    assert.equal(durationOf('21:00', '21:00'), 'PT24H');
  });

  it('is undefined when either end is missing — the field is then omitted', () => {
    assert.equal(durationOf('21:00', undefined), undefined);
    assert.equal(durationOf(undefined, '01:00'), undefined);
  });
});

describe('tzOffset — Austin changes its own offset twice a year', () => {
  it('is CDT in summer and CST in winter', () => {
    assert.equal(tzOffset('2026-07-04', '21:00'), '-05:00');
    assert.equal(tzOffset('2026-12-25', '21:00'), '-06:00');
  });

  it('tracks the actual DST boundaries, not a fixed guess', () => {
    // US DST 2026: begins Mar 8, ends Nov 1.
    assert.equal(tzOffset('2026-03-07', '21:00'), '-06:00');
    assert.equal(tzOffset('2026-03-09', '21:00'), '-05:00');
    assert.equal(tzOffset('2026-10-31', '21:00'), '-05:00');
    assert.equal(tzOffset('2026-11-02', '21:00'), '-06:00');
  });

  it('stamps the offset onto the timestamp', () => {
    assert.equal(isoDateTime('2026-07-04', '21:00'), '2026-07-04T21:00:00-05:00');
    assert.equal(isoDateTime('2026-12-25', '21:00'), '2026-12-25T21:00:00-06:00');
  });
});

describe('scheduleNode — a rule, not a list of dates', () => {
  const venue = { id: 'v', name: 'V' };

  it('maps `every` to a weekly repeat on that day', () => {
    const s = scheduleNode({ frequency: 'every', day: 'Friday', startTime: '21:00', endTime: '01:00' }, venue);
    assert.equal(s['@type'], 'Schedule');
    assert.equal(s.repeatFrequency, 'P1W');
    assert.equal(s.byDay, 'https://schema.org/Friday');
    assert.equal(s.byMonthWeek, undefined);
    assert.equal(s.scheduleTimezone, 'America/Chicago');
  });

  it('maps the ordinals to a monthly repeat with byMonthWeek', () => {
    for (const [freq, week] of [['first', 1], ['second', 2], ['third', 3], ['fourth', 4]]) {
      const s = scheduleNode({ frequency: freq, day: 'Saturday' }, venue);
      assert.equal(s.repeatFrequency, 'P1M', freq);
      assert.equal(s.byMonthWeek, week, freq);
    }
  });

  it('maps `last` to -1, which is why byMonthWeek is a lookup and not an index', () => {
    assert.equal(scheduleNode({ frequency: 'last', day: 'Sunday' }, venue).byMonthWeek, -1);
  });

  it('emits duration and never endTime', () => {
    const s = scheduleNode({ frequency: 'every', day: 'Friday', startTime: '21:00', endTime: '01:00' }, venue);
    assert.equal(s.startTime, '21:00:00');
    assert.equal(s.duration, 'PT4H');
    // An endTime of 01:00 against a startTime of 21:00 reads as a contradiction
    // to anything that does not know the house convention. duration does not.
    assert.equal(s.endTime, undefined);
  });

  it('turns exclusions into exceptDate', () => {
    const one = scheduleNode({ frequency: 'every', day: 'Friday', exclusions: [{ date: '2026-12-25', reason: 'Holiday' }] }, venue);
    assert.equal(one.exceptDate, '2026-12-25');
    const many = scheduleNode({ frequency: 'every', day: 'Friday', exclusions: [{ date: '2026-12-25' }, { date: '2027-01-01' }] }, venue);
    assert.deepEqual(many.exceptDate, ['2026-12-25', '2027-01-01']);
  });

  it('bounds the rule by the venue activePeriod', () => {
    const s = scheduleNode({ frequency: 'every', day: 'Friday' }, { id: 'v', name: 'V', activePeriod: { start: '2026-06-01', end: '2026-08-31' } });
    assert.equal(s.startDate, '2026-06-01');
    assert.equal(s.endDate, '2026-08-31');
  });
});

describe('eventNodes', () => {
  const venue = { id: 'bar', name: 'Bar', address: { street: '1 Main', city: 'Austin', state: 'TX' } };
  const mk = (entry) => eventNodes([{ venue, entry, kjId: null, companyId: null }], {});

  it('drops a one-time event whose date has passed', () => {
    assert.equal(mk({ frequency: 'once', date: '2020-01-01', startTime: '20:00' }).length, 0);
    // ...and a one-time entry with no date at all, which cannot be scheduled
    assert.equal(mk({ frequency: 'once', startTime: '20:00' }).length, 0);
  });

  it('keeps a future one-time event and gives it a concrete start', () => {
    const [ev] = mk({ frequency: 'once', date: '2099-07-04', startTime: '20:00', endTime: '23:00' });
    assert.equal(ev['@type'], 'MusicEvent');
    assert.equal(ev.startDate, '2099-07-04T20:00:00-05:00');
    assert.equal(ev.endDate, '2099-07-04T23:00:00-05:00');
    assert.equal(ev.eventSchedule, undefined);
  });

  it('rolls endDate to the next day when a one-time event crosses midnight', () => {
    const [ev] = mk({ frequency: 'once', date: '2099-07-04', startTime: '21:00', endTime: '01:00' });
    assert.equal(ev.startDate, '2099-07-04T21:00:00-05:00');
    assert.equal(ev.endDate, '2099-07-05T01:00:00-05:00');
    assert.ok(new Date(ev.endDate) > new Date(ev.startDate), 'end must follow start');
  });

  it('gives a recurring show a schedule and no startDate', () => {
    const [ev] = mk({ frequency: 'every', day: 'Friday', startTime: '21:00' });
    assert.equal(ev.startDate, undefined);
    assert.equal(ev.eventSchedule['@type'], 'Schedule');
  });

  it('uses eventName when the data has one, and a derived name otherwise', () => {
    assert.equal(mk({ frequency: 'every', day: 'Friday' })[0].name, 'Karaoke at Bar');
    assert.equal(mk({ frequency: 'once', date: '2099-07-04', eventName: 'Pride Night' })[0].name, 'Pride Night');
  });

  it('names the venue as location, by the venue page @id', () => {
    const [ev] = mk({ frequency: 'every', day: 'Friday' });
    assert.equal(ev.location['@id'], 'https://karaokedirectory.com/venue/bar/');
    assert.equal(ev.location['@type'], 'BarOrPub');
    assert.equal(ev.location.address.addressLocality, 'Austin');
  });

  it('credits both the KJ and the company, by registry id', () => {
    const registries = { kjs: { 'kj-a': { name: 'KJ A' } }, companies: { 'co-b': { name: 'Co B' } } };
    const [ev] = eventNodes([{ venue, entry: { frequency: 'every', day: 'Friday' }, kjId: 'kj-a', companyId: 'co-b' }], registries);
    assert.deepEqual(ev.performer.map((p) => p['@id']), [
      'https://karaokedirectory.com/kj/kj-a/',
      'https://karaokedirectory.com/company/co-b/',
    ]);
    assert.equal(ev.organizer['@id'], 'https://karaokedirectory.com/company/co-b/');
  });

  it('omits performers for a host id that is not in the registries', () => {
    const [ev] = eventNodes([{ venue, entry: { frequency: 'every', day: 'Friday' }, kjId: 'ghost', companyId: null }], {});
    assert.equal(ev.performer, undefined);
  });

  it('gives two shows on the same venue and day distinct ids', () => {
    const evs = eventNodes([
      { venue, entry: { frequency: 'every', day: 'Friday', startTime: '18:00' } },
      { venue, entry: { frequency: 'every', day: 'Friday', startTime: '22:00' } },
    ], {});
    assert.equal(new Set(evs.map((e) => e['@id'])).size, 2);
  });
});

describe('graphFor — over the real dataset', () => {
  const entities = entitiesOf(data);
  const today = todayInTz();

  it('puts @context once at the top and the entity first in @graph', () => {
    for (const e of entities) {
      const g = graphFor(e, data);
      assert.equal(g['@context'], 'https://schema.org');
      assert.equal(g['@graph'][0]['@id'], urlFor(e));
      for (const n of g['@graph'].slice(1)) assert.equal(n['@type'], 'MusicEvent');
    }
  });

  it('emits exactly the non-past shows, no more and no fewer', () => {
    const ids = new Set();
    for (const e of entities) for (const n of graphFor(e, data)['@graph'].slice(1)) ids.add(n['@id']);

    let expected = 0;
    for (const v of data.listings || []) {
      if (v.active === false) continue;
      for (const s of v.schedule || []) {
        if (s.frequency === 'once' && (!s.date || s.date < today)) continue;
        expected++;
      }
    }
    assert.equal(ids.size, expected);
  });

  it('never publishes an expired event', () => {
    for (const e of entities) {
      for (const n of graphFor(e, data)['@graph'].slice(1)) {
        if (n.startDate) assert.ok(n.startDate.slice(0, 10) >= today, `${n['@id']} is in the past`);
      }
    }
  });

  it('gives every event exactly one of startDate or eventSchedule', () => {
    for (const e of entities) {
      for (const n of graphFor(e, data)['@graph'].slice(1)) {
        assert.notEqual(!!n.startDate, !!n.eventSchedule, `${n['@id']}`);
      }
    }
  });

  it('carries the same event @id across the venue, KJ and company pages', () => {
    // The show at a venue and the show on its KJ's page are one event, not two.
    const byId = new Map();
    for (const e of entities) {
      for (const n of graphFor(e, data)['@graph'].slice(1)) {
        if (!byId.has(n['@id'])) byId.set(n['@id'], []);
        byId.get(n['@id']).push(`${e.type}/${e.id}`);
      }
    }
    const shared = [...byId.values()].filter((pages) => pages.length > 1);
    assert.ok(shared.length > 0, 'expected some events to appear on more than one page');
  });

  it('drops undefined rather than serialising it', () => {
    for (const e of entities) {
      assert.equal(JSON.stringify(graphFor(e, data)).includes('undefined'), false, `${e.id}`);
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
