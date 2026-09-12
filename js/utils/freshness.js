/**
 * Freshness lens — `?fresh=1` (#259).
 *
 * Reveals each show's `lastVerified` (ADR-015, #275): the show date the latest
 * evidence confirms, and how long ago that night was. Off by default and
 * URL-only — no localStorage twin, unlike debug mode — because the decision was
 * that visitors see nothing unless they ask. The curator's "Preview site"
 * button opens the site with it on.
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
 * One show's freshness as markup, with the state as a BEM modifier on the
 * caller's block so each surface can colour it.
 *
 * The wording follows the one thing the date says — the night it confirms
 * (ADR-015, #275) — so it reads forwards before that night and backwards
 * after: "📣 Announced for Oct 1", "✓ Verified today", "✓ Verified Sep 10 · 3d".
 * There is no evidence level to consult: a poster and a phone call say the
 * same thing about the same night.
 *
 * Empty string when the lens is off, and ALSO for an unverified show (#267):
 * the lens is an internal testing aid, and a card with nothing to say should
 * say nothing.
 *
 * @param {Object} entry - Schedule entry (reads `lastVerified`)
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
    // Ahead of the night, the date is a promise rather than a measurement, so
    // it carries no age: "3 days until" is not what a reader wants to know.
    const upcoming = f.state === 'upcoming';
    const icon = upcoming ? 'fa-bullhorn' : 'fa-check';
    const text = upcoming ? `Announced for ${when}`
        : f.days === 0 ? 'Verified today'
            : `Verified ${when} · ${f.days}d`;
    return `<${tag} class="${cls}" title="Latest evidence confirms the show on ${escapeHtml(f.iso)}">`
        + `<i class="fa-solid ${icon}"></i> ${escapeHtml(text)}</${tag}>`;
}
