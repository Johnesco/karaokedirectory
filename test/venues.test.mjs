/**
 * Unit tests for the pure parts of the venue service and host hydration.
 *
 * These modules load in Node because they touch no DOM. `js/utils/render.js`
 * (imported transitively by venues.js) became Node-safe once `escapeHtml` was
 * rewritten to use string replacement instead of a detached div — see #147.
 *
 * View classes are deliberately NOT unit tested. They belong to the e2e suite.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { venuePasses, venueHasShowInRange, venueMatchesSearch, venueMatchesHost, byName, initVenues, hostMatches, resolveHostLabel } from '../js/services/venues.js';
import { hydrateVenues, isHostRef, resolveHostRef } from '../js/utils/hosts.js';

const JAN = (d) => new Date(2026, 0, d);

/** Minimal venue; override whatever a test cares about. */
const venue = (over = {}) => ({
  id: 'test-venue',
  name: 'Test Venue',
  address: { city: 'Austin', state: 'TX' },
  schedule: [{ frequency: 'every', day: 'Friday', startTime: '21:00', endTime: '01:00' }],
  ...over,
});

describe('venuePasses', () => {
  it('passes an ordinary venue', () => {
    assert.equal(venuePasses(venue(), { date: JAN(2) }), true);
  });

  it('hides dedicated venues when includeDedicated is false', () => {
    const v = venue({ dedicated: true });
    assert.equal(venuePasses(v, { date: JAN(2), includeDedicated: false }), false);
    assert.equal(venuePasses(v, { date: JAN(2), includeDedicated: true }), true);
  });

  it('keeps non-dedicated venues when the dedicated filter is off', () => {
    assert.equal(venuePasses(venue({ dedicated: false }), { date: JAN(2), includeDedicated: false }), true);
  });

  it('applies the search query', () => {
    assert.equal(venuePasses(venue(), { date: JAN(2), searchQuery: 'Test' }), true);
    assert.equal(venuePasses(venue(), { date: JAN(2), searchQuery: 'nonexistent' }), false);
  });

  it('respects activePeriod on the supplied date', () => {
    const v = venue({ activePeriod: { start: '2026-06-01', end: '2026-08-31' } });
    assert.equal(venuePasses(v, { date: JAN(2) }), false);
    assert.equal(venuePasses(v, { date: new Date(2026, 6, 15) }), true);
  });

  it('called with no context at all, gates on activePeriod against today', () => {
    // This is the shape the KJ index and dossier use (#117): they want the
    // activePeriod gate and nothing else, so they pass no ctx. Worth pinning —
    // if the defaults ever changed, those two views would silently start
    // hiding venues with no visible control to explain it.
    assert.equal(venuePasses(venue()), true);
    assert.equal(venuePasses(venue({ dedicated: true })), true, 'dedicated is included by default');
    assert.equal(venuePasses(venue({ activePeriod: { start: '2099-01-01' } })), false);
    assert.equal(venuePasses(venue({ activePeriod: { end: '2000-01-01' } })), false);
  });

  it('an activePeriod of a single day includes that day', () => {
    // Same #60 shape as the date.js suite, one layer up
    const v = venue({ activePeriod: { start: '2026-01-02', end: '2026-01-02' } });
    assert.equal(venuePasses(v, { date: JAN(2) }), true);
    assert.equal(venuePasses(v, { date: JAN(3) }), false);
  });
});

describe('venueHasShowInRange — the map date filter (#215)', () => {
  // Jan 2026: Sun 4 through Sat 10 is a whole week; the 9th is its Friday.
  const WEEK = { start: JAN(4), end: JAN(10) };

  it('bounded: matches a recurring show whose day falls in the span', () => {
    assert.equal(venueHasShowInRange(venue(), WEEK.start, WEEK.end), true);
  });

  it('bounded: rejects a recurring show whose day does not fall in the span', () => {
    // Friday the 9th is in the week, but a single Saturday (the 10th) is not.
    const v = venue();
    assert.equal(venueHasShowInRange(v, JAN(10), JAN(10)), false);
    assert.equal(venueHasShowInRange(v, JAN(9), JAN(9)), true);
  });

  it('bounded: honours ordinal frequencies via scheduleMatchesDate', () => {
    // First Friday of Jan 2026 is the 2nd, so it misses the Jan 4-10 week.
    const v = venue({ schedule: [{ frequency: 'first', day: 'Friday' }] });
    assert.equal(venueHasShowInRange(v, WEEK.start, WEEK.end), false);
    assert.equal(venueHasShowInRange(v, JAN(2), JAN(2)), true);
  });

  it('bounded: matches a one-time event dated inside the span', () => {
    const v = venue({ schedule: [{ frequency: 'once', date: '2026-01-07' }] });
    assert.equal(venueHasShowInRange(v, WEEK.start, WEEK.end), true);
    assert.equal(venueHasShowInRange(v, JAN(11), JAN(17)), false);
  });

  it('open-ended: a recurring show always qualifies', () => {
    // No end date means "from here on", and a recurring entry keeps recurring —
    // there is nothing to walk.
    assert.equal(venueHasShowInRange(venue(), JAN(4), null), true);
  });

  it('open-ended: a past one-time event does not, a future one does', () => {
    // This is the whole difference between the map's "All" and the unfiltered
    // map it replaced: a venue whose sole listing already happened drops off.
    const past = venue({ schedule: [{ frequency: 'once', date: '2026-01-01' }] });
    const future = venue({ schedule: [{ frequency: 'once', date: '2026-02-14' }] });
    assert.equal(venueHasShowInRange(past, JAN(4), null), false);
    assert.equal(venueHasShowInRange(future, JAN(4), null), true);
  });

  it('open-ended: today counts as future', () => {
    const v = venue({ schedule: [{ frequency: 'once', date: '2026-01-04' }] });
    assert.equal(venueHasShowInRange(v, JAN(4), null), true);
  });

  it('open-ended: a mixed schedule qualifies on its recurring entry alone', () => {
    const v = venue({
      schedule: [
        { frequency: 'once', date: '2026-01-01' },
        { frequency: 'every', day: 'Friday' },
      ],
    });
    assert.equal(venueHasShowInRange(v, JAN(4), null), true);
  });

  it('an excluded occurrence still counts — closures are shown, not hidden', () => {
    // The weekly view lists a closed night with a banner and the map dims its
    // marker. Filtering it out would suppress the cue.
    const v = venue({
      schedule: [{
        frequency: 'every',
        day: 'Friday',
        exclusions: [{ date: '2026-01-09', reason: 'Holiday' }],
      }],
    });
    assert.equal(venueHasShowInRange(v, JAN(9), JAN(9)), true);
  });

  it('an empty or missing schedule never matches', () => {
    assert.equal(venueHasShowInRange(venue({ schedule: [] }), JAN(4), JAN(10)), false);
    assert.equal(venueHasShowInRange(venue({ schedule: [] }), JAN(4), null), false);
    assert.equal(venueHasShowInRange({}, JAN(4), null), false);
    assert.equal(venueHasShowInRange(null, JAN(4), null), false);
  });

  it('no span at all is no constraint', () => {
    assert.equal(venueHasShowInRange(venue(), null, null), true);
  });
});

describe('venueMatchesSearch', () => {
  it('matches on name and city, case-insensitively', () => {
    const v = venue({ name: 'Ego\'s', address: { city: 'Austin' } });
    assert.equal(venueMatchesSearch(v, 'ego'), true);
    assert.equal(venueMatchesSearch(v, 'AUSTIN'), true);
  });

  it('no longer matches neighborhood — the field is gone (#170)', () => {
    // It was populated on 5 of 80 venues, and one of its three values was a
    // city rather than a neighborhood. Search now covers name, city, host
    // and tags.
    const v = venue({ name: 'Ego\'s', address: { city: 'Austin', neighborhood: 'Downtown' } });
    assert.equal(venueMatchesSearch(v, 'downtown'), false);
  });

  it('matches on host name and affiliation', () => {
    const v = venue({ host: { name: 'KJ Stephanie', affiliation: 'Starling Karaoke' } });
    assert.equal(venueMatchesSearch(v, 'stephanie'), true);
    assert.equal(venueMatchesSearch(v, 'starling'), true);
  });

  it('returns true for an empty or whitespace query', () => {
    assert.equal(venueMatchesSearch(venue(), ''), true);
    assert.equal(venueMatchesSearch(venue(), '   '), true);
  });

  it('returns false for a term that appears nowhere', () => {
    assert.equal(venueMatchesSearch(venue(), 'zzzznope'), false);
  });

  it('does NOT match event names', () => {
    // Recorded deliberately: CLAUDE.md claims eventName is searchable and it is
    // not. Whichever way #37 modality 1 is resolved — implement it or fix the
    // doc — this assertion has to be revisited, which is the point.
    const v = venue({
      schedule: [{ frequency: 'once', date: '2026-01-30', eventName: 'Halloween Spooktacular' }],
    });
    assert.equal(venueMatchesSearch(v, 'spooktacular'), false);
  });
});

describe('venueMatchesHost', () => {
  it('matches venue-level host name and affiliation', () => {
    const v = venue({ host: { name: 'KJ Stephanie', affiliation: 'Starling Karaoke' } });
    assert.equal(venueMatchesHost(v, 'Stephanie'), true);
    assert.equal(venueMatchesHost(v, 'Starling'), true);
  });

  it('matches a per-show host override', () => {
    const v = venue({
      schedule: [{ frequency: 'every', day: 'Friday', host: { name: 'Guest KJ' } }],
    });
    assert.equal(venueMatchesHost(v, 'Guest'), true);
  });

  it('returns true for an empty query', () => {
    assert.equal(venueMatchesHost(venue(), ''), true);
  });

  it('still substring-matches a NAME, for links that predate ids', () => {
    // Legacy behaviour, kept deliberately so shared and indexed ?kj=<name>
    // links keep working. No link the app renders produces one any more.
    const v = venue({ host: { name: 'Average Joe' } });
    assert.equal(venueMatchesHost(v, 'Joe'), true);
    assert.equal(venueMatchesHost(v, 'ave'), true);
  });
});

describe('venueMatchesHost — registry ids (#124 Phase 5)', () => {
  // The collision this closes: "Armando" is a substring of "KJ Armando and
  // Paola", so a dossier for one showed venues belonging to the other. Ids are
  // matched exactly; names are not.
  const DATA = {
    kjs: {
      'armando': { name: 'Armando' },
      'kj-armando-and-paola': { name: 'KJ Armando and Paola' },
    },
    companies: {
      'starling-karaoke': { name: 'Starling Karaoke' },
    },
    listings: [
      { id: 'solo-bar', name: 'Solo Bar', address: {}, schedule: [],
        host: { kjId: 'armando' } },
      { id: 'duo-bar', name: 'Duo Bar', address: {}, schedule: [],
        host: { kjId: 'kj-armando-and-paola' } },
      { id: 'company-bar', name: 'Company Bar', address: {}, schedule: [],
        host: { companyId: 'starling-karaoke' } },
    ],
  };

  it('an id matches only its own entity', () => {
    initVenues(structuredClone(DATA));
    const solo = { ...DATA.listings[0] };
    const duo = { ...DATA.listings[1] };
    assert.equal(venueMatchesHost(solo, 'armando'), true);
    assert.equal(venueMatchesHost(duo, 'armando'), false,
      'the duo must NOT appear under the solo KJ');
    assert.equal(venueMatchesHost(duo, 'kj-armando-and-paola'), true);
    assert.equal(venueMatchesHost(solo, 'kj-armando-and-paola'), false);
  });

  it('an id query never falls back to substring matching', () => {
    // This is the subtle half. "armando" IS a valid id, and it is also a
    // substring of the duo's name — so a fallback pass would re-open the
    // collision the id was meant to close.
    initVenues(structuredClone(DATA));
    assert.equal(hostMatches({ kjId: 'kj-armando-and-paola', name: 'KJ Armando and Paola' }, 'armando'),
      false);
  });

  it('company ids work the same way', () => {
    initVenues(structuredClone(DATA));
    assert.equal(hostMatches({ companyId: 'starling-karaoke', affiliation: 'Starling Karaoke' }, 'starling-karaoke'), true);
    assert.equal(hostMatches({ kjId: 'armando', name: 'Armando' }, 'starling-karaoke'), false);
  });

  it('a non-id query still substring-matches, so old links survive', () => {
    initVenues(structuredClone(DATA));
    // "Paola" is nobody's id, so it behaves as a name query.
    assert.equal(hostMatches({ kjId: 'kj-armando-and-paola', name: 'KJ Armando and Paola' }, 'Paola'), true);
  });

  it('resolveHostLabel turns an id back into a display name', () => {
    initVenues(structuredClone(DATA));
    assert.equal(resolveHostLabel('kj-armando-and-paola'), 'KJ Armando and Paola');
    assert.equal(resolveHostLabel('starling-karaoke'), 'Starling Karaoke');
    // A legacy name link resolves to itself rather than an empty title.
    assert.equal(resolveHostLabel('Some Old Name'), 'Some Old Name');
  });
});

describe('byName — leading articles are ignored', () => {
  it('sorts "The Highball" under H', () => {
    const sorted = [
      { name: 'The Highball' },
      { name: 'Alcove' },
      { name: 'Knomad' },
    ].sort(byName).map((v) => v.name);
    assert.deepEqual(sorted, ['Alcove', 'The Highball', 'Knomad']);
  });
});

describe('isHostRef', () => {
  it('recognises a ref by either id key', () => {
    assert.equal(isHostRef({ kjId: 'kj-stephanie' }), true);
    assert.equal(isHostRef({ companyId: 'starling-karaoke' }), true);
    assert.equal(isHostRef({ kjId: 'a', companyId: 'b' }), true);
  });

  it('rejects a legacy inline host and empty values', () => {
    assert.equal(isHostRef({ name: 'KJ Stephanie' }), false);
    assert.equal(isHostRef({}), false);
    assert.equal(isHostRef(null), false);
    assert.equal(isHostRef(undefined), false);
  });
});

describe('resolveHostRef', () => {
  const registries = {
    kjs: { 'kj-stephanie': { name: 'KJ Stephanie' } },
    companies: { 'starling-karaoke': { name: 'Starling Karaoke', website: 'https://starling.example' } },
  };

  it('resolves a KJ-only ref', () => {
    const h = resolveHostRef({ kjId: 'kj-stephanie' }, registries);
    assert.equal(h.name, 'KJ Stephanie');
    assert.equal(h.affiliation, undefined);
    assert.equal(h.kjId, 'kj-stephanie');
  });

  it('resolves a company-only ref into the affiliation slot', () => {
    const h = resolveHostRef({ companyId: 'starling-karaoke' }, registries);
    assert.equal(h.name, undefined);
    assert.equal(h.affiliation, 'Starling Karaoke');
    assert.equal(h.website, 'https://starling.example');
  });

  it('lets the company fill a website the KJ lacks', () => {
    const h = resolveHostRef({ kjId: 'kj-stephanie', companyId: 'starling-karaoke' }, registries);
    assert.equal(h.name, 'KJ Stephanie');
    assert.equal(h.affiliation, 'Starling Karaoke');
    assert.equal(h.website, 'https://starling.example');
  });

  it('returns null when neither id resolves', () => {
    assert.equal(resolveHostRef({ kjId: 'nope' }, registries), null);
  });
});

describe('hydrateVenues', () => {
  const data = {
    kjs: { 'kj-stephanie': { name: 'KJ Stephanie' } },
    companies: { 'starling-karaoke': { name: 'Starling Karaoke' } },
    listings: [
      { id: 'a', name: 'A', host: { kjId: 'kj-stephanie' }, schedule: [] },
      { id: 'b', name: 'B', host: { name: 'Legacy Inline KJ' }, schedule: [] },
      {
        id: 'c',
        name: 'C',
        schedule: [{ frequency: 'every', day: 'Friday', host: { companyId: 'starling-karaoke' } }],
      },
    ],
  };

  it('resolves a venue-level ref into the display shape', () => {
    const [a] = hydrateVenues(data);
    assert.equal(a.host.name, 'KJ Stephanie');
  });

  it('leaves a legacy inline host untouched', () => {
    const b = hydrateVenues(data)[1];
    assert.equal(b.host.name, 'Legacy Inline KJ');
  });

  it('resolves per-show refs on schedule entries', () => {
    const c = hydrateVenues(data)[2];
    assert.equal(c.schedule[0].host.affiliation, 'Starling Karaoke');
  });

  it('does not mutate the input listings', () => {
    const input = JSON.parse(JSON.stringify(data));
    hydrateVenues(input);
    assert.deepEqual(input.listings[0].host, { kjId: 'kj-stephanie' });
  });

  it('tolerates missing registries and empty data', () => {
    assert.deepEqual(hydrateVenues({ listings: [] }), []);
    assert.deepEqual(hydrateVenues({}), []);
    assert.deepEqual(hydrateVenues(null), []);
  });
});
