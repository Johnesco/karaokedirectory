/**
 * Tag configuration and rendering utilities
 * Tags provide descriptive information about venue characteristics (type, policies, amenities)
 * Configuration is loaded from js/data.json at runtime
 */

import { html } from './string.js';

// Tag configuration - initialized from js/data.json
let tagConfig = {};

const STYLE_ELEMENT_ID = 'tag-colors';

/** Only ids a CSS attribute selector can safely carry. */
const SAFE_TAG_ID = /^[a-zA-Z0-9_+-]+$/;
/** Colours are curator-written; accept the forms CSS actually takes. */
const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/;

/**
 * Build one stylesheet for every tag colour, keyed on `[data-tag]`.
 *
 * Tag colours live in data.json, so they cannot be written into a stylesheet
 * ahead of time — which is why both call sites used to emit an inline
 * `style="background:…"`. One generated sheet replaces both (#166), and keeps
 * the colours out of the markup where a CSP would object to them.
 *
 * Values are validated rather than escaped: anything that is not a plain id or
 * a recognisable colour is skipped, because a stylesheet has no equivalent of
 * HTML escaping — a stray `}` would end the rule and start a new one.
 *
 * @param {Object} definitions
 * @returns {string} CSS text
 */
export function buildTagStyles(definitions) {
    return Object.entries(definitions || {})
        .filter(([id, def]) =>
            SAFE_TAG_ID.test(id) && def && SAFE_COLOR.test(String(def.color || '')) &&
            SAFE_COLOR.test(String(def.textColor || ''))
        )
        .map(([id, def]) =>
            `.tag[data-tag="${id}"]{background:${def.color};color:${def.textColor}}`
        )
        .join('\n');
}

/**
 * Initialize tag configuration from data, and paint the tag colours.
 * @param {Object} definitions - Tag definitions from the data file's tagDefinitions
 */
export function initTagConfig(definitions) {
    tagConfig = definitions || {};

    if (typeof document === 'undefined') return;   // unit tests, build scripts
    let el = document.getElementById(STYLE_ELEMENT_ID);
    if (!el) {
        el = document.createElement('style');
        el.id = STYLE_ELEMENT_ID;
        document.head.appendChild(el);
    }
    el.textContent = buildTagStyles(tagConfig);
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
 * Render tags as HTML badges
 * @param {string[]} tags - Array of tag IDs
 * @param {Object} options - Render options
 * @param {boolean} options.dedicated - Whether to include the dedicated tag
 * @returns {string} HTML string of tag badges
 */
export function renderTags(tags, options = {}) {
    const { dedicated = false } = options;

    // Build the full tag list, prepending 'dedicated' if applicable
    const allTags = dedicated ? ['dedicated', ...(tags || [])] : (tags || []);

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
