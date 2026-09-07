/**
 * Freshness lens — `?fresh=1` (#259).
 *
 * Reveals each show's `lastVerified` (ADR-013 §4, #246): the date a human
 * last confirmed it, and how long ago. Off by default and URL-only — no
 * localStorage twin, unlike debug mode — because the decision was that
 * visitors see nothing unless they ask. The curator's "Preview site" button
 * opens the site with it on.
 *
 * Same shape as debug mode: a flag set once at boot, a body class, a corner
 * indicator, and one render helper every surface calls. The helper returns ''
 * when the lens is off, so the default page emits no new markup at all — the
 * e2e suite asserts exactly that.
 */

import { escapeHtml } from './string.js';
import { freshnessOf, formatDateMonthDay } from './date.js';

let lensOn = false;

/**
 * Turn the lens on or off. Takes the boolean rather than reading the URL —
 * the router owns the URL (`readLocation().fresh`), and a plain argument keeps
 * this callable from a unit test with no DOM.
 * @param {boolean} enabled
 * @returns {boolean} the resulting state
 */
export function initFreshLens(enabled) {
    lensOn = !!enabled;
    if (!lensOn || typeof document === 'undefined') return lensOn;

    document.body.classList.add('fresh-lens');
    const indicator = document.createElement('div');
    indicator.className = 'fresh-indicator';
    indicator.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Freshness lens';
    indicator.title = 'Showing when each show was last verified. Remove ?fresh=1 from the URL to hide.';
    document.body.appendChild(indicator);
    return lensOn;
}

/** @returns {boolean} */
export function isFreshLens() {
    return lensOn;
}

/**
 * One show's freshness as markup: "✓ Verified Aug 28 · 6d", or "📣 Announced
 * Sep 6 · today" when the evidence is an announcement (#263) — with the state
 * as a BEM modifier on the caller's block so each surface can colour it.
 * Empty string when the lens is off, and ALSO for an unverified show (#267):
 * the lens is an internal testing aid, and a card with nothing to say should
 * say nothing.
 *
 * @param {Object} entry - Schedule entry (reads `lastVerified`, `verifiedBy`)
 * @param {Object} [options]
 * @param {string} [options.block='venue-card'] - BEM block to hang `__verified` on
 * @param {string} [options.tag='span'] - Wrapper element
 * @param {Date} [options.now] - Reference date (injectable for tests)
 * @returns {string} HTML string or ''
 */
export function renderFreshness(entry, { block = 'venue-card', tag = 'span', now } = {}) {
    if (!lensOn) return '';

    const f = freshnessOf(entry, now);
    if (f.state === 'never') return '';
    const cls = `${block}__verified ${block}__verified--${f.state}`;

    const when = formatDateMonthDay(f.iso, now ? { now } : {});
    const age = f.days < 0 ? 'future' : f.days === 0 ? 'today' : `${f.days}d`;
    // The evidence level (#263): the venue or host said so, or the curator checked.
    const announced = entry?.verifiedBy === 'announcement';
    const icon = announced ? 'fa-bullhorn' : 'fa-check';
    const verb = announced ? 'Announced' : 'Verified';
    return `<${tag} class="${cls}" title="Last verified ${escapeHtml(f.iso)}${announced ? ' — announced by the venue or host' : ''}">`
        + `<i class="fa-solid ${icon}"></i> ${verb} ${escapeHtml(when)} · ${escapeHtml(age)}</${tag}>`;
}
