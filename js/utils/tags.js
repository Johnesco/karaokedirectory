/**
 * Tag configuration and rendering utilities
 * Tags provide descriptive information about venue characteristics (type, policies, amenities)
 * Labels are loaded from js/data.json at runtime; colours are authored CSS.
 */

import { html } from './string.js';

// Tag labels - initialized from js/data.json
let tagConfig = {};

/**
 * Initialize tag configuration from data.
 *
 * This used to also inject a stylesheet built from the definitions' colour
 * fields. Colours are authored in css/components.css since ADR-014 (#238) —
 * data.json is purely factual, so a stale curator export can no longer revert
 * design work. Any color/textColor still present in the data is ignored here
 * and warned about by validate-data.js.
 *
 * @param {Object} definitions - Tag definitions from the data file's tagDefinitions
 */
export function initTagConfig(definitions) {
    tagConfig = definitions || {};
}

/**
 * Render one tag chip.
 *
 * The single tag renderer, used by the directory and by submit.html — they
 * previously built the same chip two different ways, under two class names,
 * each with its own inline style.
 *
 * Pass `href` to get an anchor instead of a span. **Nothing links today**;
 * the parameter exists so that wiring a destination later (a `?tag=` view,
 * per ADR-011) does not mean introducing a third chip that every call site
 * would have to be rewritten to use.
 *
 * @param {string} tagId
 * @param {Object} [options]
 * @param {string} [options.href] - When set, renders `<a class="tag">`
 * @returns {string} HTML string, or '' when the tag has no definition
 */
export function renderTagBadge(tagId, { href } = {}) {
    const config = tagConfig[tagId];
    if (!config) return '';

    return href
        ? String(html`<a class="tag" data-tag="${tagId}" href="${href}">${config.label}</a>`)
        : String(html`<span class="tag" data-tag="${tagId}">${config.label}</span>`);
}

/**
 * Render tags as HTML badges.
 *
 * Two tags are **derived** rather than stored, and are prepended by whoever
 * knows the condition: `dedicated` here, and `special-event` by VenueCard when
 * the entry it is rendering is a one-time show. Neither prepend can know
 * whether the venue also lists that tag in its own `tags`, so the list is
 * deduplicated here — the one funnel every surface renders through.
 *
 * Without it, `austin-deaf-club` — which stores `special-event` and whose only
 * show is a `once` entry — rendered `Special Event · LGBTQ+ · Special Event`
 * (#208). The equivalent `dedicated` collision was latent: no venue sets
 * `dedicated: true` *and* lists `dedicated`, but nothing prevented it.
 *
 * Order is preserved, first occurrence wins, so a derived tag keeps the
 * leading position it already rendered in.
 *
 * @param {string[]} tags - Array of tag IDs
 * @param {Object} options - Render options
 * @param {boolean} options.dedicated - Whether to include the dedicated tag
 * @returns {string} HTML string of tag badges
 */
export function renderTags(tags, options = {}) {
    const { dedicated = false } = options;

    // Build the full tag list, prepending 'dedicated' if applicable
    const allTags = [...new Set(dedicated ? ['dedicated', ...(tags || [])] : (tags || []))];

    if (allTags.length === 0) return '';

    const badges = allTags.map(tag => renderTagBadge(tag)).filter(Boolean).join('');

    return badges ? `<div class="venue-tags">${badges}</div>` : '';
}

/**
 * Get tag configuration by ID
 * @param {string} tagId - Tag identifier
 * @returns {Object|null} Tag configuration or null if not found
 */
export function getTagConfig(tagId) {
    return tagConfig[tagId] || null;
}
