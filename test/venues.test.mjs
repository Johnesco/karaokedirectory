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

import { venuePasses, venueMatchesSearch, venueMatchesHost, byName } from '../js/services/venues.js';
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

  it('an activePeriod of a single day includes that day', () => {
    // Same #60 shape as the date.js suite, one layer up
    const v = venue({ activePeriod: { start: '2026-01-02', end: '2026-01-02' } });
    assert.equal(venuePasses(v, { date: JAN(2) }), true);
    assert.equal(venuePasses(v, { date: JAN(3) }), false);
  });
});

describe('venueMatchesSearch', () => {
  it('matches on name, city, and neighborhood, case-insensitively', () => {
    const v = venue({ name: 'Ego\'s', address: { city: 'Austin', neighborhood: 'Downtown' } });
    assert.equal(venueMatchesSearch(v, 'ego'), true);
    assert.equal(venueMatchesSearch(v, 'AUSTIN'), true);
    assert.equal(venueMatchesSearch(v, 'downtown'), true);
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

  it('matches on SUBSTRING, so distinct KJs collide', () => {
    // Not an endorsement — this is the live defect behind the ?kj= identity
    // work (#124 Phase 5, #171). A query of "Joe" matches "Average Joe" and
    // would equally match any other Joe. When ?kj= moves to registry ids this
    // test should be replaced by an exact-id assertion.
    const v = venue({ host: { name: 'Average Joe' } });
    assert.equal(venueMatchesHost(v, 'Joe'), true);
    assert.equal(venueMatchesHost(v, 'ave'), true);
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
