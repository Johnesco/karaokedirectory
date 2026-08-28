/**
 * Unit tests for host resolution in the shared render layer.
 *
 * `js/utils/render.js` is Node-safe — `escapeHtml` uses string replacement
 * rather than a detached div (#147), so these pure functions load without a DOM.
 * The views that consume them are covered by e2e, per CLAUDE.md.
 *
 * The case that matters most here cannot be reached from the real data: no
 * venue today has both a venue-level host AND a per-show override, so a card
 * reading `venue.host` looked correct by accident. These fixtures construct it.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveHostFor, getVenueHosts, renderHostSection } from '../js/utils/render.js';

const KJ_A = { name: 'KJ Alpha', website: 'https://alpha.example' };
const KJ_B = { name: 'KJ Beta' };

const friday = (over = {}) => ({ frequency: 'every', day: 'Friday', startTime: '21:00', endTime: '01:00', ...over });
const once = (date, over = {}) => ({ frequency: 'once', date, startTime: '20:00', endTime: '23:00', ...over });

describe('resolveHostFor', () => {
  it('uses the venue host when the entry has none', () => {
    const v = { host: KJ_A, schedule: [friday()] };
    assert.equal(resolveHostFor(v, v.schedule[0]), KJ_A);
  });

  it('prefers the per-show host over the venue host', () => {
    // The masked case: with both present, reading venue.host yields the WRONG
    // host rather than none, which is why #223 was invisible in the live data.
    const v = { host: KJ_A, schedule: [friday({ host: KJ_B })] };
    assert.equal(resolveHostFor(v, v.schedule[0]), KJ_B);
  });

  it('returns null when neither level names a host', () => {
    const v = { schedule: [friday()] };
    assert.equal(resolveHostFor(v, v.schedule[0]), null);
  });
});

describe('getVenueHosts', () => {
  it('reports both scopes', () => {
    const v = { host: KJ_A, schedule: [friday(), friday({ host: KJ_B })] };
    const scopes = getVenueHosts(v).map((h) => h.scope);
    assert.deepEqual(scopes, ['venue', 'show']);
  });
});

describe('renderHostSection', () => {
  it('renders nothing when the venue has no host at all', () => {
    assert.equal(renderHostSection({ schedule: [friday()] }), '');
  });

  it('renders a venue-level host with no show attribution', () => {
    const html = renderHostSection({ host: KJ_A, schedule: [friday()] });
    assert.match(html, /Presented By/);
    assert.match(html, /KJ Alpha/);
    // A lone host covers everything; naming shows would be noise.
    assert.doesNotMatch(html, /venue-detail__host-shows/);
  });

  it('renders a host that exists only on schedule entries', () => {
    // The Highball's shape: no venue-level host, hosts on the entries. This
    // produced no section at all before #223.
    const v = { schedule: [once('2026-08-22', { host: KJ_A })] };
    const html = renderHostSection(v);
    assert.match(html, /Presented By/);
    assert.match(html, /KJ Alpha/);
  });

  it('carries a per-show host website through to the page', () => {
    const v = { schedule: [once('2026-08-22', { host: KJ_A })] };
    assert.match(renderHostSection(v), /https:\/\/alpha\.example/);
  });

  it('deduplicates one host named on several entries', () => {
    // hydrateVenues builds a fresh object per entry from the registry refs, so
    // dedup has to key on identity, not object equality.
    const v = {
      schedule: [
        once('2026-08-01', { host: { ...KJ_A } }),
        once('2026-08-07', { host: { ...KJ_A } }),
        once('2026-08-22', { host: { ...KJ_A } }),
      ],
    };
    const html = renderHostSection(v);
    assert.equal(html.match(/venue-detail__host-name/g).length, 1);
  });

  it('attributes shows when a venue has more than one host', () => {
    const v = {
      host: KJ_A,
      schedule: [friday(), friday({ day: 'Saturday', host: KJ_B })],
    };
    const html = renderHostSection(v);
    assert.match(html, /KJ Alpha/);
    assert.match(html, /KJ Beta/);
    assert.match(html, /venue-detail__host-shows/);
    // The venue host covers whatever the overrides do not.
    assert.match(html, /All other nights/);
    assert.match(html, /Every Saturday/);
  });

  it('escapes host names', () => {
    const v = { host: { name: '<script>x</script>' }, schedule: [friday()] };
    const html = renderHostSection(v);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
  });
});
