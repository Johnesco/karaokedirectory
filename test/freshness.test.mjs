/**
 * Unit tests for js/utils/freshness.js — the ?fresh=1 lens (#259).
 *
 * The contract the e2e suite leans on: with the lens OFF the helper returns
 * '' (so the default page carries no new markup at all); with it ON a
 * confirmed entry gets a line and an unconfirmed one still gets nothing
 * (#267). The wording follows the one thing the date says - the night it
 * confirms (ADR-015) - so it reads forwards before that night, backwards
 * after.
 * No DOM here — initFreshLens guards its document access, which is what makes
 * it callable from Node.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { initFreshLens, isFreshLens, renderFreshness } from '../js/utils/freshness.js';

const NOW = new Date(2026, 8, 6);   // 2026-09-06
const friday = (over = {}) => ({ frequency: 'every', day: 'Friday', startTime: '21:00', endTime: '01:00', ...over });

describe('renderFreshness', () => {
  afterEach(() => initFreshLens(false));

  it('is silent when the lens is off', () => {
    initFreshLens(false);
    assert.equal(isFreshLens(), false);
    assert.equal(renderFreshness(friday({ lastVerified: '2026-08-28' }), { now: NOW }), '');
    assert.equal(renderFreshness(friday(), { now: NOW }), '');
  });

  it('renders nothing for an unverified show, even with the lens on (#267)', () => {
    initFreshLens(true);
    assert.equal(renderFreshness(friday(), { now: NOW }), '');
    assert.equal(renderFreshness(friday({ lastVerified: '' }), { now: NOW }), '');
  });

  it('shows the night and how long ago it was, once it has passed', () => {
    initFreshLens(true);
    const html = renderFreshness(friday({ lastVerified: '2026-08-28' }), { now: NOW });
    assert.match(html, /venue-card__verified--fresh/);
    assert.match(html, /Verified Aug 28 · 9d/);
    assert.match(html, /title="Latest evidence confirms the show on 2026-08-28"/);
  });

  it('reads forwards for a night that has not arrived (ADR-015)', () => {
    initFreshLens(true);
    const html = renderFreshness(friday({ lastVerified: '2026-10-02' }), { now: NOW });
    assert.match(html, /fa-bullhorn/);
    assert.match(html, /Announced for Oct 2/);
    assert.match(html, /venue-card__verified--upcoming/);
    // No age ahead of the night: "26 days until" is not what a reader wants.
    assert.doesNotMatch(html, /·/);
  });

  it('says "today" on the night itself, with no evidence level to choose', () => {
    initFreshLens(true);
    const html = renderFreshness(friday({ lastVerified: '2026-09-06' }), { now: NOW });
    assert.match(html, /fa-check"><\/i> Verified today/);
    assert.match(html, /venue-card__verified--fresh/);
    assert.doesNotMatch(html, /Sep 6/);
  });

  it('marks a night past the 60-day horizon overdue', () => {
    initFreshLens(true);
    assert.match(renderFreshness(friday({ lastVerified: '2026-06-01' }), { now: NOW }), /--overdue/);
  });

  it("hangs the modifier on the caller's block and honours the tag", () => {
    initFreshLens(true);
    const html = renderFreshness(friday({ lastVerified: '2026-08-28' }), { block: 'kj-dossier', tag: 'div', now: NOW });
    assert.match(html, /^<div class="kj-dossier__verified kj-dossier__verified--fresh"/);
    assert.match(html, /<\/div>$/);
  });
});
