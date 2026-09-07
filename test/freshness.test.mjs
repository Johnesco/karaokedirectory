/**
 * Unit tests for js/utils/freshness.js — the ?fresh=1 lens (#259).
 *
 * The contract the e2e suite leans on: with the lens OFF the helper returns
 * '' (so the default page carries no new markup at all); with it ON a
 * verified entry gets a line and an unverified one still gets nothing (#267).
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

  it('shows the date and age of a verified show', () => {
    initFreshLens(true);
    const html = renderFreshness(friday({ lastVerified: '2026-08-28' }), { now: NOW });
    assert.match(html, /venue-card__verified--fresh/);
    assert.match(html, /Verified Aug 28 · 9d/);
    assert.match(html, /title="Last verified 2026-08-28"/);
  });

  it('words announcement-level evidence as "Announced" with a bullhorn (#263)', () => {
    initFreshLens(true);
    const html = renderFreshness(friday({ lastVerified: '2026-09-06', verifiedBy: 'announcement' }), { now: NOW });
    assert.match(html, /fa-bullhorn/);
    assert.match(html, /Announced Sep 6 · today/);
    assert.match(html, /venue-card__verified--fresh/);
    assert.doesNotMatch(html, /Verified Sep/);
    // A plain check keeps the old wording, with or without the explicit level.
    assert.match(renderFreshness(friday({ lastVerified: '2026-09-06', verifiedBy: 'check' }), { now: NOW }), /fa-check"><\/i> Verified Sep 6/);
  });

  it('marks a show past the 60-day horizon overdue, and a same-day stamp as today', () => {
    initFreshLens(true);
    assert.match(renderFreshness(friday({ lastVerified: '2026-06-01' }), { now: NOW }), /--overdue/);
    assert.match(renderFreshness(friday({ lastVerified: '2026-09-06' }), { now: NOW }), /· today/);
  });

  it("hangs the modifier on the caller's block and honours the tag", () => {
    initFreshLens(true);
    const html = renderFreshness(friday({ lastVerified: '2026-08-28' }), { block: 'kj-dossier', tag: 'div', now: NOW });
    assert.match(html, /^<div class="kj-dossier__verified kj-dossier__verified--fresh"/);
    assert.match(html, /<\/div>$/);
  });
});
